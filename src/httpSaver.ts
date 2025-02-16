import { stub } from '@std/testing/mock'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from '@std/path/join'
import { getJsonTextFromFile } from './fs.ts'
import type { SerializedRequest } from './serdes.ts'
import { deserializeResponse, getFileName, getKey, serializeRequest, serializeResponse } from './serdes.ts'
import { Sanitizer } from './sanitizer.ts'

export type Mode = 'ensure' | 'overwrite' | 'readOnly'

/**
 * Constructor options for {@linkcode HttpSaver}
 */
export type HttpSaverOptions = {
	/**
	 * - If `ensure`, cached responses will be used where available, substituting and caching live responses otherwise.
	 * - If `overwrite`, live requests will always be made, bypassing and overwriting the currently cached responses.
	 * - If `readOnly`, only cached responses will be used instead of making live requests. Any unavailable cached responses
	 *   will throw an error.
	 *
	 * @default {'ensure'}
	 */
	mode: Mode
	/**
	 * Directory path to store cached responses.
	 * @default {'_fixtures/responses'}
	 */
	dirPath: string
	/**
	 * Sanitizer instance to sanitize sensitive data from requests and responses.
	 * @default {new Sanitizer()}
	 */
	sanitizer: Sanitizer
	/**
	 * JSON space for pretty printing of the cached responses.
	 * @default {'\t'}
	 */
	jsonSpace: '\t' | number
}

const defaultOptions: HttpSaverOptions = {
	mode: 'ensure',
	dirPath: '_fixtures/responses',
	sanitizer: new Sanitizer(),
	jsonSpace: '\t',
}

function toRequest(input: URL | Request | string, init?: RequestInit) {
	if (input instanceof URL) {
		return new Request(input.href, init)
	} else if (input instanceof Request) {
		return input
	} else {
		return new Request(input, init)
	}
}

/**
 * A class to cache responses for testing in the file system.
 */
export class HttpSaver {
	options: HttpSaverOptions
	#realFetch = globalThis.fetch

	constructor(options?: Partial<HttpSaverOptions>) {
		this.options = {
			...defaultOptions,
			...options,
		}
	}

	/**
	 * Stubs the global fetch function to cache responses.
	 */
	stubFetch(): ReturnType<typeof stub<typeof globalThis, 'fetch'>> {
		return stub(globalThis, 'fetch', async (input, init) => {
			const req = toRequest(input, init)
			const serializedRequest = await serializeRequest(await this.options.sanitizer.sanitizeRequest(req.clone()))

			const [fileName, key] = await Promise.all([
				getFileName(serializedRequest),
				getKey(serializedRequest),
			])

			const filePath = join(this.options.dirPath, fileName)

			const params = { req, serializedRequest, key, filePath }

			switch (this.options.mode) {
				case 'ensure': {
					try {
						return await this.#read(params)
					} catch {
						return this.#overwrite(params)
					}
				}
				case 'overwrite': {
					return this.#overwrite(params)
				}
				case 'readOnly': {
					return this.#read(params)
				}
			}
		})
	}

	async #read({ key, filePath }: StubFetchSubMethodParams) {
		const resInfo = await getJsonTextFromFile(filePath)
		if (!Object.hasOwn(resInfo, key)) {
			throw new Error(
				`No cached response found for ${JSON.stringify(key)} in ${JSON.stringify(filePath)}`,
			)
		}

		return deserializeResponse(resInfo[key]!.response)
	}

	async #overwrite({ req, serializedRequest, key, filePath }: StubFetchSubMethodParams) {
		const [, res, resInfo] = await Promise.all([
			mkdir(this.options.dirPath, { recursive: true }),
			this.#realFetch(req.clone()),
			getJsonTextFromFile(filePath),
		])

		resInfo[key] = {
			request: serializedRequest,
			response: await serializeResponse(await this.options.sanitizer.sanitizeResponse(res.clone())),
		}
		await writeFile(filePath, JSON.stringify(resInfo, null, this.options.jsonSpace) + '\n')

		return res
	}
}

type StubFetchSubMethodParams = {
	req: Request
	serializedRequest: SerializedRequest
	key: string
	filePath: string
}
