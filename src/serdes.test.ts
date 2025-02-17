import { assertEquals, assertNotEquals } from '@std/assert'
import type { SerializedHeaders, SerializedRequest, SerializedResponse } from './serdes.ts'
import {
	deserializeBody,
	deserializeHeaders,
	deserializeResponse,
	getFileName,
	getKey,
	jsonStringifyDeterministically,
	serializeBody,
	serializeHeaders,
	serializeRequest,
	// no `deserializeRequest` because we don't bother deserializing (equality determined by file name/key)
	serializeResponse,
} from './serdes.ts'
import { SerializedBody } from './serdes.ts'

const textEncoder = new TextEncoder()

type Cases<H, S> = readonly {
	description: string
	hydrated: H
	serialized: S
}[]

const requestCases: Cases<Request, SerializedRequest> = [
	{
		description: 'no body',
		hydrated: new Request('https://example.com', {}),
		serialized: {
			method: 'GET',
			url: 'https://example.com/',
			headers: {},
			body: null,
		},
	},
	{
		description: 'JSON body',
		hydrated: new Request('https://example.com', {
			method: 'POST',
			body: JSON.stringify({ a: 1 }),
		}),
		serialized: {
			method: 'POST',
			url: 'https://example.com/',
			headers: { 'content-type': 'text/plain;charset=UTF-8' },
			body: { kind: 'json', data: { a: 1 } },
		},
	},
]

const responseCases: Cases<Response, SerializedResponse> = [
	{
		description: 'no body',
		hydrated: new Response(null),
		serialized: {
			status: 200,
			statusText: '',
			headers: {},
			body: null,
		},
	},
	{
		description: 'JSON body',
		hydrated: new Response(JSON.stringify({ a: 1 }), { status: 234, statusText: 'xyz' }),
		serialized: {
			status: 234,
			statusText: 'xyz',
			headers: { 'content-type': 'text/plain;charset=UTF-8' },
			body: { kind: 'json', data: { a: 1 } },
		},
	},
]

const headersCases: Cases<Headers, SerializedHeaders> = [
	{
		description: 'empty',
		hydrated: new Headers(),
		serialized: {},
	},
	{
		description: 'single',
		hydrated: new Headers({ a: '1' }),
		serialized: { a: '1' },
	},
	{
		description: 'multiple',
		hydrated: new Headers([
			['a', '1'],
			['a', '2'],
		]),
		serialized: {
			a: '1, 2',
		},
	},
	{
		description: 'single set-cookie',
		hydrated: new Headers([
			['set-cookie', 'id=c88684ef-be61-4c2e-b14e-ac48cfe59a91; Expires=Wed, 21 Oct 2015 07:28:00 GMT'],
		]),
		serialized: {
			'set-cookie': 'id=c88684ef-be61-4c2e-b14e-ac48cfe59a91; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
		},
	},
	{
		description: 'multiple set-cookie',
		hydrated: new Headers([
			['set-cookie', 'id=c88684ef-be61-4c2e-b14e-ac48cfe59a91; Expires=Wed, 21 Oct 2015 07:28:00 GMT'],
			['set-cookie', 'id=6707e2d2-b60d-4af7-b13d-3dbd61cd94df; Expires=Thu, 22 Oct 2015 08:29:00 GMT'],
		]),
		serialized: {
			'set-cookie': [
				'id=c88684ef-be61-4c2e-b14e-ac48cfe59a91; Expires=Wed, 21 Oct 2015 07:28:00 GMT',
				'id=6707e2d2-b60d-4af7-b13d-3dbd61cd94df; Expires=Thu, 22 Oct 2015 08:29:00 GMT',
			],
		},
	},
]

const bodyCases: Cases<Uint8Array | null, SerializedBody> = [
	{
		description: 'null',
		hydrated: null,
		serialized: null,
	},
	{
		description: 'string',
		hydrated: textEncoder.encode('some text'),
		serialized: { kind: 'text', data: 'some text' },
	},
	{
		description: 'JSON',
		hydrated: textEncoder.encode(JSON.stringify({ a: 1 })),
		serialized: { kind: 'json', data: { a: 1 } },
	},
	{
		description: 'binary/base64',
		hydrated: new Uint8Array([1, 2, 3, 255]),
		serialized: { kind: 'base64', data: 'AQID/w==' },
	},
]

Deno.test(serializeRequest.name, async (t) => {
	for (const { description, hydrated, serialized } of requestCases) {
		await t.step(description, async () => {
			assertEquals(await serializeRequest(hydrated), serialized)
		})
	}
})

Deno.test(serializeResponse.name, async (t) => {
	for (const { description, hydrated, serialized } of responseCases) {
		await t.step(description, async () => {
			assertEquals(await serializeResponse(hydrated), serialized)
		})
	}
})

Deno.test(deserializeResponse.name, async (t) => {
	for (const { description, hydrated, serialized } of responseCases) {
		await t.step(description, () => {
			const deserialized = deserializeResponse(serialized)

			assertEquals(deserialized.status, hydrated.status)
			assertEquals(deserialized.statusText, hydrated.statusText)
			assertEquals(Object.fromEntries(deserialized.headers), Object.fromEntries(hydrated.headers))
			assertEquals(deserialized.clone().bytes(), hydrated.clone().bytes())
		})
	}
})

Deno.test(serializeHeaders.name, async (t) => {
	for (const { description, hydrated, serialized } of headersCases) {
		await t.step(description, () => {
			assertEquals(serializeHeaders(hydrated), serialized)
		})
	}
})

Deno.test(deserializeHeaders.name, async (t) => {
	for (const { description, hydrated, serialized } of headersCases) {
		await t.step(description, () => {
			const deserialized = deserializeHeaders(serialized)
			assertEquals(Object.fromEntries(deserialized), Object.fromEntries(hydrated))
		})
	}
})

Deno.test(serializeBody.name, async (t) => {
	for (const { description, hydrated, serialized } of bodyCases) {
		await t.step(description, () => {
			assertEquals(serializeBody(hydrated), serialized)
		})
	}
})

Deno.test(deserializeBody.name, async (t) => {
	for (const { description, hydrated, serialized } of bodyCases) {
		await t.step(description, () => {
			const deserialized = deserializeBody(serialized)
			assertEquals(deserialized, hydrated)
		})
	}
})

Deno.test(jsonStringifyDeterministically.name, () => {
	const unsorted = {
		nullish: null,
		c: 3,
		b: 2,
		a: 1,
		arr: [1, 2],
		nested: {
			b: {
				d: 4,
				c: 3,
			},
			a: 2,
		},
	}
	const sorted = {
		a: 1,
		arr: [1, 2],
		b: 2,
		c: 3,
		nested: {
			a: 2,
			b: {
				c: 3,
				d: 4,
			},
		},
		nullish: null,
	}
	const stringified = '{"a":1,"arr":[1,2],"b":2,"c":3,"nested":{"a":2,"b":{"c":3,"d":4}},"nullish":null}'

	assertNotEquals(JSON.stringify(unsorted), JSON.stringify(sorted))
	assertEquals(jsonStringifyDeterministically(unsorted), JSON.stringify(sorted))
	assertEquals(jsonStringifyDeterministically(unsorted), stringified)
	assertEquals(jsonStringifyDeterministically(unsorted), jsonStringifyDeterministically(sorted))
})

Deno.test(getFileName.name, async () => {
	assertEquals(getFileName(await serializeRequest(new Request('https://example.com'))), 'example.com.json')
	assertEquals(getFileName(await serializeRequest(new Request('https://example.com/path'))), 'example.com.json')
	assertEquals(getFileName(await serializeRequest(new Request('https://example.com?a=1'))), 'example.com.json')
})

Deno.test(getKey.name, async () => {
	assertEquals(
		await getKey(await serializeRequest(new Request('https://example.com'))),
		'd23acf131dc06be940b7a84ff8304caabe9d5a3f458d5ded467cddac45a8dc81',
	)
	assertEquals(
		await getKey(
			await serializeRequest(
				new Request('https://example.com', { headers: { a: '1' }, method: 'POST', body: 'some text' }),
			),
		),
		'54fdfaa244567899f780f7ab55045547018306b54b4974eb854e650623636b6b',
	)

	const keys = new Set<string>()

	const reqs = [
		new Request('https://example.com'),
		new Request('https://example.com', { headers: { a: '1' } }),
		new Request('https://example.com', { method: 'POST' }),
		new Request('https://example.com', { method: 'POST', body: 'some text' }),
		new Request('https://example.com?a=1'),
		new Request('https://example.com', { headers: { a: '1' }, method: 'POST', body: 'some text' }),
	]

	for (const req of reqs) {
		keys.add(await getKey(await serializeRequest(req.clone())))
	}

	assertEquals(keys.size, reqs.length, 'Keys must be unique')

	for (const req of reqs) {
		keys.add(await getKey(await serializeRequest(req.clone())))
	}

	assertEquals(keys.size, reqs.length, 'Keys must be stable for same request input, even if not reference-equal')
})
