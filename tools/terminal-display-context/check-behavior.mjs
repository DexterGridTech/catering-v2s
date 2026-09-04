import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const toolsRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolsRoot, '../..')
const displayContextSource = path.join(repositoryRoot, 'apps/terminal/kernel/base/display-context')
const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest')

const packageNames = Object.freeze(['contracts', 'platform-ports', 'runtime', 'state'])

const copyPackage = (source, target) => fs.cpSync(source, target, {
  recursive: true,
  filter: candidate => !candidate.includes(`${path.sep}.turbo${path.sep}`)
    && !candidate.includes(`${path.sep}node_modules${path.sep}`),
})

const replaceOnce = (filePath, before, after) => {
  const source = fs.readFileSync(filePath, 'utf8')
  const occurrences = source.split(before).length - 1
  if (occurrences !== 1) throw new Error(`mutation anchor count ${occurrences} for ${filePath}`)
  fs.writeFileSync(filePath, source.replace(before, after))
}

const createSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-display-context-behavior-'))
  const baseRoot = path.join(root, 'apps/terminal/kernel/base')
  const displayContextRoot = path.join(baseRoot, 'display-context')
  const nodeModulesRoot = path.join(root, 'node_modules')
  fs.mkdirSync(baseRoot, {recursive: true})
  fs.copyFileSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(root, 'apps/terminal/tsconfig.base.json'),
  )
  copyPackage(displayContextSource, displayContextRoot)
  for (const packageName of packageNames) {
    fs.symlinkSync(
      path.join(repositoryRoot, 'apps/terminal/kernel/base', packageName),
      path.join(baseRoot, packageName),
      'dir',
    )
  }
  fs.mkdirSync(path.join(nodeModulesRoot, '@catering-v2s'), {recursive: true})
  for (const packageName of packageNames) {
    fs.symlinkSync(
      path.join(baseRoot, packageName),
      path.join(nodeModulesRoot, '@catering-v2s', `kernel-base-${packageName}`),
      'dir',
    )
  }
  for (const packageName of ['@reduxjs/toolkit', 'typescript', 'vitest']) {
    fs.mkdirSync(path.dirname(path.join(nodeModulesRoot, packageName)), {recursive: true})
    fs.symlinkSync(
      path.join(repositoryRoot, 'node_modules', packageName),
      path.join(nodeModulesRoot, packageName),
      'dir',
    )
  }
  return Object.freeze({root, displayContextRoot})
}

const runVitest = (sandbox, testName) => {
  const result = spawnSync(vitestPath, [
    'run', '--config', 'vitest.config.ts', 'test/derivation.test.ts', '-t', testName,
  ], {
    cwd: sandbox.displayContextRoot,
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
    timeout: 30_000,
    killSignal: 'SIGTERM',
  })
  if (result.error && result.error.code !== 'ETIMEDOUT') throw result.error
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return Object.freeze({
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status ?? 1),
    output: result.error?.code === 'ETIMEDOUT'
      ? `${output}\n[vitest timed out after 30000ms]`
      : output,
  })
}

const printTail = output => {
  const lines = output.trim().split('\n')
  console.log(lines.slice(Math.max(0, lines.length - 12)).join('\n'))
}

const focusedTest = 'S-18 resolves the four display availability branches with unknown-to-single fallback'

const baseline = createSandbox()
try {
  const result = runVitest(baseline, focusedTest)
  if (result.status !== 0) {
    printTail(result.output)
    throw new Error('display-context behavior baseline failed')
  }
  console.log('TERMINAL_DISPLAY_CONTEXT_BEHAVIOR_BASELINE=PASS')
  printTail(result.output)
} finally {
  fs.rmSync(baseline.root, {recursive: true, force: true})
}

const mutation = createSandbox()
try {
  replaceOnce(
    path.join(mutation.displayContextRoot, 'src/foundations/displayDerivation.ts'),
    "input.status === 'valid' && input.displayCount >= 2",
    "input.status === 'valid'",
  )
  const result = runVitest(mutation, focusedTest)
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('SECONDARY_SURFACE mutation unexpectedly passed')
  }
  console.log(`TERMINAL_DISPLAY_CONTEXT_BEHAVIOR_RED_SECONDARY_SURFACE=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(mutation.root, {recursive: true, force: true})
}

console.log('TERMINAL_DISPLAY_CONTEXT_BEHAVIOR_CLEANUP=PASS')
