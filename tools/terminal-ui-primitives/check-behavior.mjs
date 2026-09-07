import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

const toolsRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(toolsRoot, '../..')
const primitivesSource = path.join(repositoryRoot, 'apps/terminal/ui/base/primitives')
const sharedTestSupportSource = path.join(repositoryRoot, 'tools/terminal-shared')
const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest')

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
  if (occurrences !== 1) throw new Error(`mutation anchor count ${occurrences} for ${filePath}`)
  fs.writeFileSync(filePath, source.replace(before, after))
}

const linkNodeModule = (nodeModulesRoot, packageName, target) => {
  const linkPath = path.join(nodeModulesRoot, packageName)
  fs.mkdirSync(path.dirname(linkPath), {recursive: true})
  fs.symlinkSync(target, linkPath, 'dir')
}

const createSandbox = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-primitives-behavior-'))
  const packageRoot = path.join(root, 'apps/terminal/ui/base/primitives')
  const sharedTestSupportRoot = path.join(root, 'tools/terminal-shared')
  const nodeModulesRoot = path.join(root, 'node_modules')
  fs.mkdirSync(path.dirname(packageRoot), {recursive: true})
  fs.mkdirSync(path.join(root, 'apps/terminal'), {recursive: true})
  fs.copyFileSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(root, 'apps/terminal/tsconfig.base.json'),
  )
  copyPackage(primitivesSource, packageRoot)
  fs.mkdirSync(sharedTestSupportRoot, {recursive: true})
  for (const fileName of ['react-native-vitest-entry.ts', 'react-native-vitest.setup.cjs']) {
    fs.copyFileSync(
      path.join(sharedTestSupportSource, fileName),
      path.join(sharedTestSupportRoot, fileName),
    )
  }
  for (const packageName of [
    '@babel/core',
    'babel-preset-expo',
    'react',
    'react-is',
    'react-test-renderer',
    'scheduler',
    'typescript',
    'vitest',
  ]) {
    linkNodeModule(nodeModulesRoot, packageName, path.join(repositoryRoot, 'node_modules', packageName))
  }
  linkNodeModule(
    nodeModulesRoot,
    'react-native',
    path.join(repositoryRoot, 'apps/terminal/node_modules/react-native'),
  )
  return Object.freeze({root, packageRoot})
}

const runVitest = (sandbox, args) => {
  const result = spawnSync(vitestPath, args, {
    cwd: sandbox.packageRoot,
    encoding: 'utf8',
    env: {...process.env, FORCE_COLOR: '0'},
    timeout: 30_000,
    killSignal: 'SIGTERM',
  })
  if (result.error && result.error.code !== 'ETIMEDOUT') throw result.error
  return Object.freeze({
    status: result.error?.code === 'ETIMEDOUT' ? 124 : (result.status ?? 1),
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  })
}

const printTail = output => {
  const lines = output.trim().split('\n')
  console.log(lines.slice(Math.max(0, lines.length - 10)).join('\n'))
}

const testFile = 'test/primitives.test.tsx'
const testName = 'renders addressable native controls with required testIDs'
const baseline = createSandbox()
try {
  const result = runVitest(baseline, ['run', '--config', 'vitest.config.ts'])
  if (result.status !== 0) {
    printTail(result.output)
    throw new Error(`primitive behavior baseline failed with status ${result.status}`)
  }
  console.log('TERMINAL_PRIMITIVES_BEHAVIOR_BASELINE=PASS')
} finally {
  fs.rmSync(baseline.root, {recursive: true, force: true})
}

const mutation = createSandbox()
try {
  replaceOnce(
    path.join(mutation.packageRoot, 'src/theme/tokens.ts'),
    "container: 'flex-1 bg-canvas p-6 gap-4'",
    "container: 'flex-1 bg-mutated p-6 gap-4'",
  )
  const result = runVitest(mutation, ['run', '--config', 'vitest.config.ts', testFile, '-t', testName])
  if (result.status === 0) {
    printTail(result.output)
    throw new Error('THEME_TOKEN_RENDER unexpectedly passed its production mutation')
  }
  console.log(`TERMINAL_PRIMITIVES_BEHAVIOR_RED_THEME_TOKEN=PASS mutation_exit=${result.status}`)
  printTail(result.output)
} finally {
  fs.rmSync(mutation.root, {recursive: true, force: true})
}

console.log('TERMINAL_PRIMITIVES_BEHAVIOR_CLEANUP=PASS')
