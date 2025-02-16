import { memoize } from '@std/cache/memoize'
import { readFile } from 'node:fs/promises'
import { ResInfo } from './serdes.ts'

async function _getJsonTextFromFile(filePath: string): Promise<ResInfo> {
	try {
		return JSON.parse(await readFile(filePath, { encoding: 'utf-8' }))
	} catch {
		return {}
	}
}

export const getJsonTextFromFile = memoize(_getJsonTextFromFile)
