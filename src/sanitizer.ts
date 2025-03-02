import type { SerializedHeaders, SerializedRequest, SerializedResponse } from './serdes.ts'

const defaultSanitizerOptions: SanitizerOptions = {
	allowedHeaders: [
		'accept',
		'accept-charset',
		'accept-encoding',
		'accept-language',
		'accept-ranges',
		'connection',
		'content-disposition',
		'content-encoding',
		'content-language',
		'content-type',
		'host',
		'link',
		'origin',
		'referer',
		'transfer-encoding',
		'user-agent',
	],
	blockedQueryParams: /api[_\-]?key|auth|pass|secret|secur|token/i,
}

/**
 * Constructor options for {@linkcode Sanitizer}
 */
export type SanitizerOptions = {
	allowedHeaders: readonly string[]
	blockedQueryParams: RegExp
}

/**
 * A class to sanitize sensitive data from requests and responses.
 */
export class Sanitizer {
	readonly allowedHeaders: ReadonlySet<string>
	readonly blockedQueryParams: RegExp

	constructor(options?: Partial<SanitizerOptions>) {
		const opts = {
			...defaultSanitizerOptions,
			...options,
		}

		this.allowedHeaders = new Set(opts.allowedHeaders.map((header) => header.toLowerCase()))
		this.blockedQueryParams = opts.blockedQueryParams
	}

	/**
	 * @param req A cloned version of the request
	 * @returns A sanitized version of the request
	 */
	sanitizeRequest(req: SerializedRequest): SerializedRequest | Promise<SerializedRequest> {
		return {
			method: req.method,
			url: this.sanitizeUrl(req.url).href,
			headers: this.sanitizeHeaders(req.headers),
			body: req.body,
		}
	}

	/**
	 * @param res A cloned version of the response
	 * @param req A cloned version of the request
	 * @returns A sanitized version of the response
	 */
	sanitizeResponse(
		res: SerializedResponse,
		// deno-lint-ignore no-unused-vars
		req: SerializedRequest,
	): SerializedResponse | Promise<SerializedResponse> {
		return {
			status: res.status,
			statusText: res.statusText,
			url: res.url,
			headers: this.sanitizeHeaders(res.headers),
			body: res.body,
		}
	}

	sanitizeHeaders(headers: SerializedHeaders): SerializedHeaders {
		return Object.fromEntries(
			Object.entries(headers).filter(([key]) => this.allowedHeaders.has(key.toLowerCase())),
		)
	}

	sanitizeUrl(url: URL | string): URL {
		url = new URL(url)
		url.searchParams.sort()

		// iterate first and store in array, otherwise deleting in place will cause the iterator to skip some keys
		for (const key of url.searchParams.keys()) {
			if (this.blockedQueryParams.test(key)) {
				url.searchParams.delete(key)
			}
		}
		url.search = url.searchParams.toString()
		url.password = ''

		return url
	}
}
