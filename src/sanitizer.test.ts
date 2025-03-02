import { assertEquals } from '@std/assert'
import { Sanitizer } from './sanitizer.ts'
import type { SerializedRequest, SerializedResponse } from './serdes.ts'

Deno.test(Sanitizer.name, async (t) => {
	const sanitizer = new Sanitizer()

	await t.step(Sanitizer.prototype.sanitizeRequest.name, async () => {
		const req: SerializedRequest = {
			method: 'POST',
			url: 'https://user:pass@example.com?q=42&c=3&api-key=1&password=999&APIKEY=66&b=2&a=1&repeat=1&repeat=2',
			headers: {
				'content-type': 'application/json',
				authorization: 'Bearer cd6a7da6-ebc7-479b-8dda-bb9fc67f2d66',
			},
			body: { kind: 'text', data: 'some text' },
		}

		const sanitized = await sanitizer.sanitizeRequest(req)

		assertEquals(sanitized.url, 'https://user@example.com/?a=1&b=2&c=3&q=42&repeat=1&repeat=2')
		assertEquals(sanitized.method, 'POST')
		assertEquals(sanitized.headers['content-type'], 'application/json')
		assertEquals(sanitized.headers['authorization'], undefined)
		assertEquals(sanitized.body, { kind: 'text', data: 'some text' })
	})

	await t.step(Sanitizer.prototype.sanitizeResponse.name, async () => {
		const res: SerializedResponse = {
			status: 234,
			statusText: 'xyz',
			url: 'https://example.com',
			headers: {
				'content-type': 'application/json',
				'x-sensitive-data': 'sensitive',
				'set-cookie': 'id=a3fWa; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
			},
			body: { kind: 'text', data: 'some text' },
		}

		const sanitized = await sanitizer.sanitizeResponse(res, {} as SerializedRequest)

		assertEquals(sanitized.status, 234)
		assertEquals(sanitized.statusText, 'xyz')

		assertEquals(sanitized.headers['content-type'], 'application/json')
		assertEquals(sanitized.headers['x-sensitive-data'], undefined)

		assertEquals(sanitized.headers['set-cookie'], undefined)

		assertEquals(sanitized.body, { kind: 'text', data: 'some text' })
	})
})
