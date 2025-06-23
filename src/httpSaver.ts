import { stub } from '@std/testing/mock'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from '@std/path/join'
import { getJsonDataFromFile } from './fs.ts'
import type { ResInfo, SerializedRequest } from './serdes.ts'
import { deserializeResponse, getFileName, getKey, serializeRequest, serializeResponse } from './serdes.ts'
import { Sanitizer } from './sanitizer.ts'
import { rm } from 'node:fs/promises'
import { assert } from '@std/assert/assert'

/**
 * @module
 * Save API responses for testing.
 */

/** Constructor options for {@linkcode HttpSaver} */
export type HttpSaverOptions = {
	/**
	 * - If `ensure`, cached responses will be used where available, substituting and caching live responses otherwise.
	 * - If `overwrite`, live requests will always be made, bypassing and overwriting the currently cached responses.
	 * - If `readOnly`, only cached responses will be used instead of making live requests. Any unavailable cached
	 *   responses will throw an error.
	 * - If `reset`, the behavior is the same as `ensure`, but starting from a clean slate, i.e. the directory will
	 *   be deleted upon instantiation of the `HttpSaver` class.
	 *
	 * @default {'ensure'}
	 */
	mode: 'ensure' | 'overwrite' | 'readOnly' | 'reset'
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

class CacheMissError extends Error {
	override name = this.constructor.name
}

/** A class to cache responses for testing in the file system. */
export class HttpSaver {
	options: HttpSaverOptions
	#realFetch = globalThis.fetch
	#ready = Promise.withResolvers<void>()

	constructor(options?: Partial<HttpSaverOptions>) {
		const opts = {
			...defaultOptions,
			...options,
		}

		this.options = opts

		assert(opts.dirPath !== '', 'dirPath must not be an empty string')

		const ready = this.options.mode === 'reset'
			? rm(opts.dirPath, { recursive: true, force: true })
			: Promise.resolve()

		ready.then(() => this.#ready.resolve())
	}

	/**
	 * Stubs the global fetch function to cache responses.
	 *
	 * @example
	 * ```ts
	 * const httpSaver = new HttpSaver()
	 *
	 * Deno.test('some API', () => {
	 * 	using _ = httpSaver.stubFetch()
	 *
	 * 	// First time the test runs, the response will be saved under `_fixtures/responses`
	 * 	// Subsequent test runs will use the saved response, without making a network request
	 * 	const res = await fetch('https://api.example.com')
	 *
	 * 	// ... do something with `res`
	 * })
	 */
	stubFetch(): ReturnType<typeof stub<typeof globalThis, 'fetch'>> {
		return stub(globalThis, 'fetch', async (input, init) => {
			await this.#ready.promise

			const req = new Request(input, init)

			const signal = init?.signal ?? undefined
			if (signal?.aborted) throw signal.reason

			const serializedRequest = await this.options.sanitizer.sanitizeRequest(await serializeRequest(req))

			const [fileName, key] = await Promise.all([
				getFileName(serializedRequest),
				getKey(serializedRequest),
			])

			const filePath = join(this.options.dirPath, fileName)

			const params = { req, serializedRequest, key, filePath, signal }

			switch (this.options.mode) {
				case 'ensure':
				case 'reset': {
					try {
						return await this.#read(params)
					} catch (e) {
						if (e instanceof CacheMissError) {
							return this.#overwrite(params)
						}

						throw e
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

	async #read({ key, filePath, signal }: StubFetchSubMethodParams) {
		const resInfo = await getJsonDataFromFile<ResInfo>(filePath)
		if (!Object.hasOwn(resInfo, key)) {
			throw new CacheMissError(
				`No cached response found for ${JSON.stringify(key)} in ${JSON.stringify(filePath)}`,
			)
		}

		return deserializeResponse(resInfo[key]!.response, signal)
	}

	async #overwrite({ req, serializedRequest, key, filePath, signal }: StubFetchSubMethodParams) {
		const [, res, resInfo] = await Promise.all([
			mkdir(this.options.dirPath, { recursive: true }),
			this.#realFetch(req.clone()),
			getJsonDataFromFile<ResInfo>(filePath),
		])

		const response = await this.options.sanitizer.sanitizeResponse(
			await serializeResponse(res.clone()),
			await serializeRequest(req.clone()),
		)

		resInfo[key] = {
			lastSaved: new Date().toISOString(),
			request: serializedRequest,
			response,
		}

		await writeFile(filePath, JSON.stringify(resInfo, null, this.options.jsonSpace) + '\n')

		return deserializeResponse(resInfo[key]!.response, signal)
	}
}

type StubFetchSubMethodParams = {
	req: Request
	serializedRequest: SerializedRequest
	key: string
	filePath: string
	signal?: AbortSignal
}
