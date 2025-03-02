import { assertEquals, assertNotEquals } from '@std/assert'
import { HttpSaver } from './httpSaver.ts'

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

async function getBody(res: Response) {
	try {
		return await res.clone().json()
	} catch {
		try {
			return await res.clone().text()
		} catch {
			return await res.clone().bytes()
		}
	}
}

Deno.test(HttpSaver.name, async () => {
	using spy = simpleSpyFetch()
	const spiedFetch = globalThis.fetch

	const httpSaver = new HttpSaver({
		dirPath: '_temp/path',
		mode: 'reset',
	})

	let liveResponses: Response[]
	let cachedResponses: Response[]
	const requestConfigs = [
		{ url: 'https://example.com' },
		{ url: 'https://http.cat/200.jpg' },

		{ url: 'https://jsonplaceholder.typicode.com/todos/1' },
		{ url: 'https://jsonplaceholder.typicode.com/todos/1?q=1' },
		{ url: 'https://jsonplaceholder.typicode.com/todos/2' },
		{ url: 'https://jsonplaceholder.typicode.com/todos/3' },

		{
			url: 'https://jsonplaceholder.typicode.com/todos/6',
			headers: {
				authorization: 'Basic YWxhZGRpbjpvcGVuc2VzYW1l',
			},
		},

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
		using _ = httpSaver.stubFetch()
		assertNotEquals(fetch, spiedFetch)

		liveResponses = await Promise.all(requestConfigs.map(async ({ url, method, body }) => {
			return await fetch(url, { method, body })
		}))
	}
	{
		using _ = httpSaver.stubFetch()
		assertNotEquals(fetch, spiedFetch)

		cachedResponses = await Promise.all(requestConfigs.map(async ({ url, method, body }) => {
			return await fetch(url, { method, body })
		}))
	}

	assertEquals(fetch, spiedFetch)
	assertEquals(spy.timesCalled, requestConfigs.length)

	for (const i of requestConfigs.keys()) {
		const liveRes = liveResponses[i]!
		const cachedRes = cachedResponses[i]!

		assertEquals(cachedRes.headers.get('content-type'), liveRes.headers.get('content-type'))
		// `date` header should be removed due to not being in default sanitization allow-list
		assertEquals(cachedRes.headers.get('date'), null)

		assertEquals(await getBody(cachedRes), await getBody(liveRes))
		assertEquals(cachedRes.url, liveRes.url)
		assertEquals(cachedRes.status, liveRes.status)
		assertEquals(cachedRes.statusText, liveRes.statusText)
	}
})
