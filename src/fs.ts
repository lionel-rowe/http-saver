import { memoize } from '@std/cache/memoize'
import { assert } from '@std/assert/assert'
import { readFile } from 'node:fs/promises'

export const getJsonDataFromFile = memoize(
	async function getJsonDataFromFile<T extends Partial<Record<string, unknown>> = never>(
		filePath: string,
	): Promise<NoInfer<T>> {
		let fileText: string

		try {
			fileText = await readFile(filePath, { encoding: 'utf-8' })
		} catch (e) {
			if ((e as { code?: unknown }).code === 'ENOENT') {
				return {} as T
			}

			throw e
		}

		// allow empty file
		if (!/\S/.test(fileText)) return {} as T

		const data = JSON.parse(fileText)

		// disallow contentful file that isn't valid JSON
		assert(typeof data === 'object' && data != null, 'data must be an object')

		return data as T
	},
)
