import { assertEquals } from '@std/assert'
import { Sanitizer } from './sanitizer.ts'

Deno.test(Sanitizer.name, async (t) => {
	const sanitizer = new Sanitizer()

	await t.step(Sanitizer.prototype.sanitizeRequest.name, async () => {
		const req = new Request(
			'https://user:pass@example.com?q=42&c=3&api-key=1&password=999&APIKEY=66&b=2&a=1&repeat=1&repeat=2',
			{
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					authorization: 'Bearer cd6a7da6-ebc7-479b-8dda-bb9fc67f2d66',
				},
				body: 'some text',
			},
		)

		const sanitized = await sanitizer.sanitizeRequest(req.clone())

		// consume body of original request
		await req.blob()

		assertEquals(sanitized.url, 'https://user@example.com/?a=1&b=2&c=3&q=42&repeat=1&repeat=2')
		assertEquals(sanitized.method, 'POST')
		assertEquals(sanitized.headers.get('content-type'), 'application/json')
		assertEquals(sanitized.headers.get('authorization'), null)
		assertEquals(await sanitized.text(), 'some text')
	})

	await t.step(Sanitizer.prototype.sanitizeResponse.name, async () => {
		const res = new Response('some text', {
			status: 234,
			statusText: 'xyz',
			headers: {
				'content-type': 'application/json',
				'x-sensitive-data': 'sensitive',
				'set-cookie': 'id=a3fWa; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
			},
		})

		const sanitized = await sanitizer.sanitizeResponse(res.clone())

		// consume body of original response
		await res.blob()

		assertEquals(sanitized.status, 234)
		assertEquals(sanitized.statusText, 'xyz')

		assertEquals(sanitized.headers.get('content-type'), 'application/json')
		assertEquals(sanitized.headers.get('x-sensitive-data'), null)

		assertEquals(sanitized.headers.get('set-cookie'), null)
		assertEquals(sanitized.headers.getSetCookie(), [])

		assertEquals(await sanitized.text(), 'some text')
	})
})
