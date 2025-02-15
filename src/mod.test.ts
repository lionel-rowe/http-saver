import { assertEquals, assertNotEquals } from '@std/assert'
import { HttpSaver } from './mod.ts'

// Can't use spy/stub from `@std/testing/mock` because they don't allow the same function to be stubbed multiple times
function simpleSpyFetch() {
	const originalFetch = globalThis.fetch

	const out = {
		[Symbol.dispose]() {
			globalThis.fetch = originalFetch
		},
		timesCalled: 0,
	}

	const spiedFetch: typeof originalFetch = (x, y) => {
		++out.timesCalled
		return originalFetch(x, y)
	}

	globalThis.fetch = spiedFetch

	return out
}

Deno.test(HttpSaver.name, async () => {
	using spy = simpleSpyFetch()
	const spiedFetch = globalThis.fetch

	const httpSaver = new HttpSaver({
		dirPath: '_temp/path',
	})

	try {
		await Deno.remove(httpSaver.options.dirPath, { recursive: true })
	} catch {
		// ignore if dir doesn't exist yet
	}

	let liveJsons: unknown[]
	let cachedJsons: unknown[]
	const requestConfigs = [
		{ method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1' },
		{ method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/1?q=1' },
		{ method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/2' },
		{ method: 'GET', url: 'https://jsonplaceholder.typicode.com/todos/3' },
		{
			method: 'POST',
			url: 'https://jsonplaceholder.typicode.com/todos',
			body: JSON.stringify({
				userId: 1,
				title: 'abc',
				completed: true,
			}),
		},
		{
			method: 'POST',
			url: 'https://jsonplaceholder.typicode.com/todos',
			body: JSON.stringify({
				userId: 1,
				title: 'def',
				completed: true,
			}),
		},
		{
			method: 'POST',
			url: 'https://jsonplaceholder.typicode.com/todos?q=1',
			body: JSON.stringify({
				userId: 1,
				title: 'ghi',
				completed: true,
			}),
		},
		{
			method: 'POST',
			url: 'https://jsonplaceholder.typicode.com/no-exist',
		},
	]

	{
		httpSaver.options.mode = 'overwrite'
		using _ = httpSaver.stubFetch()
		assertNotEquals(fetch, spiedFetch)

		liveJsons = await Promise.all(requestConfigs.map(async ({ url, method, body }) => {
			const res = await fetch(url, { method, body })
			return await res.json()
		}))
	}
	{
		httpSaver.options.mode = 'readOnly'
		using _ = httpSaver.stubFetch()
		assertNotEquals(fetch, spiedFetch)

		cachedJsons = await Promise.all(requestConfigs.map(async ({ url, method, body }) => {
			const res = await fetch(url, { method, body })
			return await res.json()
		}))
	}

	assertEquals(fetch, spiedFetch)
	assertEquals(spy.timesCalled, requestConfigs.length)

	assertEquals(liveJsons, cachedJsons)
})
