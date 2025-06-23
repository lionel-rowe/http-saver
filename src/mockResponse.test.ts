import { assertEquals } from '@std/assert'
import { MockResponse } from './mockResponse.ts'

Deno.test(MockResponse.name, async () => {
	const bodyText = 'body text'

	const res1 = new MockResponse(bodyText)
	assertEquals(res1.url, '')

	const url1 = new URL('https://example.com/1')
	res1.url = url1

	assertEquals(res1.url, url1.href)
	assertEquals(res1.clone().clone().url, url1.href)
	assertEquals(await res1.clone().text(), bodyText)

	const res2 = res1.clone()
	const url2 = new URL('https://example.com/2')
	res2.url = url2.href

	assertEquals(res2.clone().url, url2.href)
	assertEquals(await res2.clone().text(), bodyText)

	// not modified
	assertEquals(res1.clone().url, url1.href)
})
