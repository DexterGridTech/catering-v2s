import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const toolsRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolsRoot, '../..')
const runtimeSource = path.join(repositoryRoot, 'apps/terminal/kernel/base/runtime')
const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest')

const packageNames = Object.freeze([
  'contracts',
  'platform-ports',
  'state',
])

const copyPackage = (source, target) => {
  fs.cpSync(source, target, {
    recursive: true,
    filter: candidate => !candidate.includes(`${path.sep}.turbo${path.sep}`)
      && !candidate.includes(`${path.sep}node_modules${path.sep}`),
  })
}

const replaceOnce = (filePath, before, after) => {
  const source = fs.readFileSync(filePath, 'utf8')
  const occurrences = source.split(before).length - 1
  if (occurrences !== 1) {
    throw new Error(`mutation anchor count ${occurrences} for ${filePath}`)
  }
  fs.writeFileSync(filePath, source.replace(before, after))
}

const createSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-runtime-behavior-'))
  const baseRoot = path.join(root, 'apps/terminal/kernel/base')
  const runtimeRoot = path.join(baseRoot, 'runtime')
  const nodeModulesRoot = path.join(root, 'node_modules')
  fs.mkdirSync(baseRoot, {recursive: true})
  fs.copyFileSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(root, 'apps/terminal/tsconfig.base.json'),
  )
  copyPackage(runtimeSource, runtimeRoot)
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
  return Object.freeze({root, runtimeRoot})
}

const runVitest = (sandbox, testNamePattern) => {
  const result = spawnSync(vitestPath, [
    'run',
    '--config',
    'vitest.config.ts',
    'test/runtimeSubscription.test.ts',
    '-t',
    testNamePattern,
  ], {
    cwd: sandbox.runtimeRoot,
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
    timeout: 30_000,
    killSignal: 'SIGTERM',
  })
  if (result.error && result.error.code !== 'ETIMEDOUT') throw result.error
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  return Object.freeze({
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status ?? 1),
    output: result.error?.code === 'ETIMEDOUT' ? `${output}\n[vitest timed out after 30000ms]` : output,
  })
}

const printTail = output => {
  const lines = output.trim().split('\n')
  console.log(lines.slice(Math.max(0, lines.length - 12)).join('\n'))
}

const baseline = createSandbox()
try {
  const result = runVitest(baseline, 'runtime facade subscription')
  if (result.status !== 0) {
    printTail(result.output)
    throw new Error(`runtime subscription baseline failed with status ${result.status}`)
  }
  const testCount = result.output.match(/Tests\s+(\d+) passed \((\d+)\)/)?.[1]
  if (testCount === undefined) throw new Error('baseline output did not contain a Vitest test count')
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_BASELINE=PASS tests=${testCount}`)
  printTail(result.output)
} finally {
  fs.rmSync(baseline.root, {recursive: true, force: true})
}

const mutation = createSandbox()
try {
  replaceOnce(
    path.join(mutation.runtimeRoot, 'src/application/createRuntime.ts'),
    'if (!subscription.active) return',
    'if (subscription.active) return',
  )
  const result = runVitest(mutation, 'makes unsubscribe idempotent')
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('UNSUBSCRIBE mutation did not turn its focused proof red')
  }
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_RED_UNSUBSCRIBE=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(mutation.root, {recursive: true, force: true})
}

const preStartMutation = createSandbox()
try {
  replaceOnce(
    path.join(preStartMutation.runtimeRoot, 'src/application/createRuntime.ts'),
    "status = 'starting'\n    notifyRuntimeSubscribers()",
    "status = 'starting'",
  )
  const result = runVitest(preStartMutation, 'retains a pre-start subscription')
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('PRE_START mutation did not turn its focused proof red')
  }
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_RED_PRE_START=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(preStartMutation.root, {recursive: true, force: true})
}

const stateAttachMutation = createSandbox()
try {
  replaceOnce(
    path.join(stateAttachMutation.runtimeRoot, 'src/application/createRuntime.ts'),
    'stateSubscription = createStateSubscription(stateRuntime.getStore(), notifyRuntimeSubscribers)',
    'stateSubscription = undefined',
  )
  const result = runVitest(stateAttachMutation, 'notifies synchronously while an actor dispatches a state action')
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('STATE_ATTACH mutation did not turn its focused proof red')
  }
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_RED_STATE_ATTACH=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(stateAttachMutation.root, {recursive: true, force: true})
}

const failedCloseMutation = createSandbox()
try {
  replaceOnce(
    path.join(failedCloseMutation.runtimeRoot, 'src/application/createRuntime.ts'),
    '        closeRuntimeSubscriptions()\n',
    '',
  )
  const result = runVitest(failedCloseMutation, 'reports failed after failure is written and closes facade subscriptions')
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('FAILED_CLOSE mutation did not turn its focused proof red')
  }
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_RED_FAILED_CLOSE=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(failedCloseMutation.root, {recursive: true, force: true})
}

const failedSubscribeMutation = createSandbox()
try {
  replaceOnce(
    path.join(failedSubscribeMutation.runtimeRoot, 'src/application/createRuntime.ts'),
    "if (status === 'failed') return () => undefined",
    '',
  )
  const result = runVitest(failedSubscribeMutation, 'reports failed after failure is written and closes facade subscriptions')
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('FAILED_SUBSCRIBE mutation did not turn its focused proof red')
  }
  console.log(`TERMINAL_RUNTIME_BEHAVIOR_RED_FAILED_SUBSCRIBE=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(failedSubscribeMutation.root, {recursive: true, force: true})
}

console.log('TERMINAL_RUNTIME_BEHAVIOR_CLEANUP=PASS')
