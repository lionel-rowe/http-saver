const urlMap = new WeakMap<MockResponse, string>()

/**
 * @module
 * A mock response class that allows setting and getting the URL.
 */

/** A mock response class that allows setting and getting the URL. */
export class MockResponse extends Response {
	override get url(): string {
		return urlMap.get(this) ?? ''
	}

	override set url(val: string | URL) {
		urlMap.set(this, val ? new URL(val).href : '')
	}

	override clone(): MockResponse {
		const cloned = super.clone() as MockResponse
		Object.setPrototypeOf(cloned, this.constructor.prototype)
		cloned.url = this.url ?? ''
		return cloned
	}
}
