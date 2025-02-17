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
	protected readonly allowedHeaders: ReadonlySet<string>
	protected readonly blockedQueryParams: RegExp

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
	sanitizeRequest(req: Request): Request | Promise<Request> {
		return new Request(
			this.sanitizeUrl(req.url),
			{
				method: req.method,
				headers: this.sanitizeHeaders(req.headers),
				body: req.body,
			},
		)
	}

	/**
	 * @param res A cloned version of the response
	 * @returns A sanitized version of the response
	 */
	sanitizeResponse(res: Response): Response | Promise<Response> {
		return new Response(
			res.body,
			{
				status: res.status,
				statusText: res.statusText,
				headers: this.sanitizeHeaders(res.headers),
			},
		)
	}

	protected sanitizeHeaders(headers: Headers): Headers {
		const sanitizedHeaders = new Headers()

		for (const key of headers.keys()) {
			if (this.allowedHeaders.has(key)) {
				sanitizedHeaders.append(key, headers.get(key)!)
			}
		}

		return sanitizedHeaders
	}

	protected sanitizeUrl(url: URL | string): URL {
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
