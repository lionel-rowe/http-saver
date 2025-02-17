import { assertEquals, assertStringIncludes } from '@std/assert'
import { getJsonDataFromFile } from './fs.ts'
import { encodeBase64 } from '@std/encoding/base64'

type RunParams = {
	importPath: string
	filePath: string
}

async function run({ filePath, importPath }: RunParams) {
	const { getJsonDataFromFile } = await import(importPath)
	console.info(JSON.stringify(await getJsonDataFromFile(filePath)))
}

async function tempFile() {
	const filePath = await Deno.makeTempFile()

	return {
		filePath,
		async [Symbol.asyncDispose]() {
			try {
				await Deno.remove(filePath)
			} catch { /* ignore if already deleted */ }
		},
	}
}

type Expect = {
	success: true
	stdout: string
} | {
	success: false
	stderr: string
}

type TestParams = {
	permissionFlags: string[]
	fileContent: string | null
	expect: Expect
}

async function testWithParams({ permissionFlags, fileContent, expect }: TestParams) {
	await using f = await tempFile()
	const { filePath } = f

	const params: RunParams = { filePath, importPath: import.meta.resolve('./fs.ts') }

	if (fileContent == null) {
		await Deno.remove(filePath)
	} else {
		await Deno.writeTextFile(filePath, fileContent)
	}

	const output = await new Deno.Command(Deno.execPath(), {
		args: [
			'run',
			...permissionFlags,
			'--config',
			'./deno.jsonc',
			`data:application/javascript;base64,${encodeBase64(`await (${run})(${JSON.stringify(params)})`)}`,
		],
		stderr: 'piped',
		stdout: 'piped',
	}).spawn().output()

	assertEquals(output.success, expect.success)

	if (expect.success) {
		assertStringIncludes(new TextDecoder().decode(output.stdout), expect.stdout)
	} else {
		assertStringIncludes(new TextDecoder().decode(output.stderr), expect.stderr)
	}
}

Deno.test(getJsonDataFromFile.name, async (t) => {
	await t.step('success scenarios', async (t) => {
		await t.step('file doesn’t exist (return empty object)', async () => {
			await testWithParams({
				permissionFlags: ['--allow-read'],
				fileContent: null,
				expect: {
					success: true,
					stdout: JSON.stringify({}),
				},
			})
		})

		await t.step('file is a valid JSON object (return contents)', async () => {
			await testWithParams({
				permissionFlags: ['--allow-read'],
				fileContent: JSON.stringify({ a: 1, b: 2 }) + '\n',
				expect: {
					success: true,
					stdout: JSON.stringify({ a: 1, b: 2 }),
				},
			})
		})
	})

	await t.step('error scenarios', async (t) => {
		await t.step('file is empty', async () => {
			await testWithParams({
				permissionFlags: ['--allow-read'],
				fileContent: '',
				expect: {
					success: false,
					stderr: 'Unexpected end of JSON input',
				},
			})
		})

		await t.step('file isn’t valid JSON', async () => {
			await testWithParams({
				permissionFlags: ['--allow-read'],
				fileContent: 'hello world',
				expect: {
					success: false,
					stderr: "SyntaxError: Unexpected token 'h'",
				},
			})
		})

		await t.step('file JSON isn’t an object', async () => {
			await testWithParams({
				permissionFlags: ['--allow-read'],
				fileContent: '"hello world"',
				expect: {
					success: false,
					stderr: 'AssertionError: data must be an object',
				},
			})
		})

		await t.step('permission denied', async () => {
			await testWithParams({
				permissionFlags: [],
				fileContent: JSON.stringify({ a: 1, b: 2 }),
				expect: {
					success: false,
					stderr: 'TypeError: Requires read access',
				},
			})
		})
	})
})
