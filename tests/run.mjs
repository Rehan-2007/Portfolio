import { spawnSync } from 'node:child_process'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { rolldown } from 'rolldown'

const filters = process.argv.slice(2)
const tests = (await readdir(resolve('tests')))
  .filter((file) => file.endsWith('.test.ts') && (!filters.length || filters.some((filter) => file.includes(filter))))
  .sort()
if (!tests.length) throw new Error('No regression tests were found')

const output = await mkdtemp(join(tmpdir(), 'anti-ai-regression-'))
try {
  for (const test of tests) {
    const bundle = await rolldown({
      input: resolve('tests', test),
      platform: 'node',
      logLevel: 'warn',
    })
    const target = join(output, test.replace('.ts', '.mjs'))
    await bundle.write({ file: target, format: 'esm', sourcemap: false })
    await bundle.close()
    const result = spawnSync(process.execPath, ['--test', target], {
      stdio: 'inherit',
      env: process.env,
    })
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1
      break
    }
  }
} finally {
  await rm(output, { recursive: true, force: true })
}
