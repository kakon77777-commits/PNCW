import { readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) out.push(...await collect(path))
    else if (entry.name.endsWith('.test.mjs')) out.push(path)
  }
  return out.sort()
}

const requested = process.argv.slice(2)
const files = requested.length ? requested.map(item => resolve(item)) : await collect('tests')
const child = spawn(process.execPath, ['--test', ...files], { stdio: 'inherit' })
child.on('exit', code => { process.exitCode = code ?? 1 })
