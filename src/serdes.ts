import { decodeBase64, encodeBase64 } from '@std/encoding/base64'
import { encodeHex } from '@std/encoding/hex'
import { asArray } from './utils.ts'

export type ResInfo = Partial<Record<string, Serialized>>

export type Serialized = {
	lastSaved: string
	request: SerializedRequest
	response: SerializedResponse
}

// #region Request

export type SerializedRequest = {
	method: string
	url: string
	headers: Record<string, string | string[]>
	body: SerializedBody
}

export async function serializeRequest(req: Request): Promise<SerializedRequest> {
	return {
		method: req.method,
		url: new URL(req.url).href,
		headers: serializeHeaders(req.headers),
		body: serializeBody(await req.clone().arrayBuffer()),
	}
}

// #endregion
// #region Response

export type SerializedResponse = {
	body: SerializedBody
	headers: SerializedHeaders
	status: number
	statusText: string
}

export async function serializeResponse(res: Response): Promise<SerializedResponse> {
	const { status, statusText } = res
	const body = serializeBody(await res.clone().arrayBuffer())
	const headers = serializeHeaders(res.headers)
	return { status, statusText, headers, body }
}

export function deserializeResponse(serialized: SerializedResponse): Response {
	const { status, statusText, headers, body } = serialized

	return new Response(
		deserializeBody(body),
		{
			headers: deserializeHeaders(headers),
			status,
			statusText,
		},
	)
}

// #endregion
// #region Headers

export type SerializedHeaders = Record<string, string | string[]>

export function serializeHeaders(headers: Headers): SerializedHeaders {
	const out: SerializedHeaders = {}
	for (const [key, value] of headers.entries()) {
		out[key] = Object.hasOwn(out, key) ? [...asArray(out[key]), value] : value
	}

	return out
}

export function deserializeHeaders(headers: SerializedHeaders): Headers {
	const out = new Headers()
	for (const [key, value] of Object.entries(headers)) {
		for (const val of asArray(value)) {
			out.append(key, val)
		}
	}

	return out
}

// #endregion
// #region Body

export type SerializedBody = null | Base64Body | TextBody | JsonBody
type Base64Body = { kind: 'base64'; data: string }
type TextBody = { kind: 'text'; data: string }
type JsonBody = { kind: 'json'; data: unknown }

/**
 * Serialize the body of a response, preferring human-readable formats when possible.
 * We don't bother to check content type or encoding headers, just whether the content can be parsed, falling back to
 * base64 encoding if it can't.
 */
export function serializeBody(body: ArrayBuffer | Uint8Array | null): SerializedBody {
	if (body == null || body.byteLength === 0) {
		return null
	}

	try {
		const str = new TextDecoder(undefined, {
			// badly named option, setting to true actually means BOM will be included verbatim
			ignoreBOM: true,
			fatal: true,
		}).decode(body)

		try {
			const data = JSON.parse(str)
			return { kind: 'json', data }
		} catch {
			return { kind: 'text', data: str }
		}
	} catch {
		// invalid as UTF-8
		return { kind: 'base64', data: encodeBase64(body) }
	}
}

export function deserializeBody(body: SerializedBody): Uint8Array | null {
	if (body === null) return null

	switch (body.kind) {
		case 'base64': {
			return decodeBase64(body.data)
		}
		case 'text': {
			return new TextEncoder().encode(body.data)
		}
		case 'json': {
			return new TextEncoder().encode(JSON.stringify(body.data))
		}
	}
}

// #endregion
// #region Misc

export function getFileName(req: SerializedRequest): string {
	return `${encodeURIComponent(new URL(req.url).host)}.json`
}

export async function getKey(req: SerializedRequest): Promise<string> {
	return encodeHex(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jsonStringifyDeterministically(req))),
	)
}

// always use same order for keys
export function jsonStringifyDeterministically(obj: unknown): string {
	return JSON.stringify(
		obj,
		(_, value) => {
			if (typeof value === 'object' && value != null && !Array.isArray(value)) {
				return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a > b ? 1 : a < b ? -1 : 0))
			}
			return value
		},
	)
}

// #endregion
