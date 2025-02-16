# HTTP Saver [![JSR](https://jsr.io/badges/@li/http-saver)](https://jsr.io/@li/http-saver)

Save API responses for testing.

## Usage

```ts
const httpSaver = new HttpSaver()

Deno.test('some API', () => {
    using _ = httpSaver.stubFetch()

    // First time the test runs, the response will be saved under `_fixtures/responses`
    // Subsequent test runs will use the saved response, without making a network request
    const res = await fetch('https://api.example.com')

    // ... do something with `res`
})
```
