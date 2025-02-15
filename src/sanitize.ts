const DEFAULT_HEADER_ALLOW_LIST: readonly string[] = [
	'host',
	'user-agent',
	'content-encoding',
	'content-type',
	'content-disposition',
	'content-language',
	'accept',
	'accept-language',
	'accept-encoding',
	'referer',
	'connection',
	'upgrade-insecure-requests',
]

const DEFAULT_QUERY_PARAM_BLOCK_LIST_REGEX = /secur|secret|api[_\-]?key|token|pass|auth/i

export function sanitizeRequest(req: Request): Request {
	const url = new URL(req.url)
	url.searchParams.sort()
	for (const key of url.searchParams.keys()) {
		if (DEFAULT_QUERY_PARAM_BLOCK_LIST_REGEX.test(key)) {
			url.searchParams.delete(key)
		}
	}
	url.search = url.searchParams.toString()
	url.password = ''

	const headers = new Headers()
	for (const key of headers.keys()) {
		if (DEFAULT_HEADER_ALLOW_LIST.includes(key.toLowerCase())) {
			headers.append(key, req.headers.get(key)!)
		}
	}

	return new Request(req.clone(), { headers })
}

export function sanitizeResponse(res: Response): Response {
	const headers = new Headers()
	for (const key of headers.keys()) {
		if (DEFAULT_HEADER_ALLOW_LIST.includes(key.toLowerCase())) {
			headers.append(key, res.headers.get(key)!)
		}
	}

	return new Response(res.clone().body, {
		status: res.status,
		statusText: res.statusText,
		headers,
	})
}
