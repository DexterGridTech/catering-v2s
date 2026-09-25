import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import ts from 'typescript'
import {
  collectImportedCapabilities,
  findImportCapabilityViolation,
} from '../terminal-shared/import-capabilities.mjs'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(toolDirectory, '../..')
export const terminalRoot = path.join(repoRoot, 'apps/terminal')

export const LAYERING_RULE_NAMES = Object.freeze([
  'p-5a-direction',
  'p-5c-state-edge',
  'p-10-kernel-ui-literals',
  'p-5d-ui-feature-native-elements',
])

export const LAYERING_SUPPORT_CHECK_COUNT = 0

const workspacePackagePrefix = '@catering-v2s/'
const runtimeModuleSpecifier = '@catering-v2s/kernel-base-runtime'
const stateModuleSpecifier = '@catering-v2s/kernel-base-state'
const reactReduxModuleSpecifier = 'react-redux'
const toolkitModuleSpecifier = '@reduxjs/toolkit'

const uiFeatureImportBoundary = Object.freeze({
  forbiddenModules: [reactReduxModuleSpecifier],
  forbiddenNamespaceModules: [runtimeModuleSpecifier, stateModuleSpecifier, toolkitModuleSpecifier],
  forbiddenImportedNames: [
    'getStore',
    'dispatch',
    'dispatchAction',
    'useDispatch',
    'useSelector',
    'defineCommand',
    'RuntimeModule',
    'StateRoot',
    'createSlice',
    'createReducer',
    'configureStore',
    'createStore',
    'combineReducers',
    'install',
  ],
  forbiddenImportedNamesByModule: {
    [runtimeModuleSpecifier]: ['Runtime', 'createRuntime'],
    [stateModuleSpecifier]: [
      'StateRuntime',
      'CreateStateRuntimeInput',
      'createStateRuntime',
      'defineStateRuntimeSlice',
      'createPartitionedActionDispatcher',
      'createPartitionedStateKeys',
      'readPartitionedState',
      'toPartitionedStateDescriptors',
    ],
  },
  allowedImportedNamesByModule: {
    [runtimeModuleSpecifier]: ['defineCommand', 'RuntimeModule'],
  },
})

function sourceFiles(packageRoot) {
  const root = path.join(packageRoot, 'src')
  const result = []
  const visit = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) result.push(entryPath)
    }
  }
  visit(root)
  return result.sort()
}

const dependencyFilePattern = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/

function dependencySourceFiles(packageRoot) {
  const result = []
  const visit = directory => {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && dependencyFilePattern.test(entry.name)) result.push(entryPath)
    }
  }

  for (const directoryName of ['src', 'test', 'test-expo', 'scripts']) {
    visit(path.join(packageRoot, directoryName))
  }
  if (fs.existsSync(packageRoot)) {
    for (const entry of fs.readdirSync(packageRoot, {withFileTypes: true})) {
      if (entry.isFile() && dependencyFilePattern.test(entry.name)) result.push(path.join(packageRoot, entry.name))
    }
  }
  return [...new Set(result)].sort()
}

function moduleNameFromPackageDirectory(root, packageRoot) {
  const relative = path.relative(path.join(root, 'apps/terminal'), packageRoot)
  if (!relative || relative.startsWith('..')) return null
  const segments = relative.split(path.sep)
  return segments.length === 3 ? segments.join('.') : null
}

function packageDirectories(root) {
  const result = []
  for (const layer of ['kernel', 'ui', 'adapter', 'application']) {
    const layerRoot = path.join(root, 'apps/terminal', layer)
    if (!fs.existsSync(layerRoot)) continue
    const visit = directory => {
      for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        if (['node_modules', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue
        const entryPath = path.join(directory, entry.name)
        if (entry.isDirectory()) visit(entryPath)
        else if (entry.isFile() && entry.name === 'package.json') {
          const packageRoot = path.dirname(entryPath)
          const packageJson = JSON.parse(fs.readFileSync(entryPath, 'utf8'))
          const moduleName = moduleNameFromPackageDirectory(root, packageRoot)
          result.push({
            directory: packageRoot,
            layer,
            moduleName,
            packageName: packageJson.name ?? (moduleName ? `${workspacePackagePrefix}${moduleName.replaceAll('.', '-')}` : null),
          })
        }
      }
    }
    visit(layerRoot)
  }
  return result.sort((left, right) => left.directory.localeCompare(right.directory))
}

function parseSource(filePath) {
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : /\.(?:jsx)$/.test(filePath)
      ? ts.ScriptKind.JSX
      : /\.(?:js|mjs|cjs)$/.test(filePath)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  )
}

function workspaceLayer(moduleSpecifier) {
  if (!moduleSpecifier.startsWith(workspacePackagePrefix)) return null
  const name = moduleSpecifier.slice(workspacePackagePrefix.length)
  if (name.startsWith('kernel-')) return 'kernel'
  if (name.startsWith('ui-')) return 'ui'
  if (name.startsWith('adapter-')) return 'adapter'
  if (name.startsWith('application-')) return 'application'
  return null
}

function relativePath(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join('/')
}

function throwViolation(message, filePath, root, line = 1) {
  throw new Error(`${message} at ${relativePath(filePath, root)}:${line}`)
}

function lineOf(node, sourceFile) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function isInvalidDirection(fromLayer, toLayer) {
  if (fromLayer === 'kernel') return toLayer !== 'kernel'
  if (fromLayer === 'ui') return toLayer === 'adapter' || toLayer === 'application'
  if (fromLayer === 'adapter') return toLayer === 'ui' || toLayer === 'application'
  return false
}

function runP5aDirection({root, packages}) {
  for (const {directory: packageRoot, layer} of packages) {
    for (const filePath of sourceFiles(packageRoot)) {
      const sourceFile = parseSource(filePath)
      for (const capability of collectImportedCapabilities(sourceFile)) {
        const targetLayer = workspaceLayer(capability.moduleName)
        if (targetLayer !== null && isInvalidDirection(layer, targetLayer)) {
          throwViolation(
            `P-5a reverse dependency ${layer}->${targetLayer} (${capability.moduleName})`,
            filePath,
            root,
            lineOf(capability.node, sourceFile),
          )
        }
      }
    }
  }
}

function featurePackages(root, layer, feature) {
  const featureRoot = path.join(root, 'apps/terminal', layer, feature)
  if (!fs.existsSync(featureRoot)) return []
  return fs.readdirSync(featureRoot, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && !['node_modules', '.turbo', '.expo'].includes(entry.name))
    .map(entry => path.join(featureRoot, entry.name))
    .filter(directory => fs.existsSync(path.join(directory, 'package.json')))
    .sort()
}

export function integrationPackages(root) {
  const integrationRoot = path.join(root, 'apps/terminal/ui/integration')
  if (!fs.existsSync(integrationRoot)) return []
  return fs.readdirSync(integrationRoot, {withFileTypes: true})
    .filter(entry => entry.isDirectory() && !['node_modules', '.turbo', '.expo'].includes(entry.name))
    .map(entry => path.join(integrationRoot, entry.name))
    .filter(directory => fs.existsSync(path.join(directory, 'package.json')))
    .sort()
}

export function uiNativePackages(root) {
  const packages = [
    ...featurePackages(root, 'ui', 'feature'),
    ...integrationPackages(root),
  ]
  const devHostRoot = path.join(root, 'apps/terminal/ui/base/dev-host')
  if (fs.existsSync(path.join(devHostRoot, 'package.json'))) packages.push(devHostRoot)
  return [...new Set(packages)].sort()
}

function runP5cStateEdge({root}) {
  const packages = featurePackages(root, 'ui', 'feature')
  if (packages.length === 0) throw new Error('ui feature package denominator is empty')
  for (const packageRoot of packages) {
    const files = sourceFiles(packageRoot)
    if (files.length === 0) throw new Error(`ui feature package has no production source: ${relativePath(packageRoot, root)}`)
    for (const filePath of files) {
      const sourceFile = parseSource(filePath)
      const violation = findImportCapabilityViolation(sourceFile, uiFeatureImportBoundary)
      if (violation !== undefined) {
        throw new Error(
          `P-5c forbidden imported capability ${violation.importedName} from ${violation.moduleName} at ${relativePath(filePath, root)}:${lineOf(violation.node, sourceFile)}`,
        )
      }
    }
  }
}

function runP10KernelUiLiterals({root}) {
  const packages = featurePackages(root, 'kernel', 'feature')
  if (packages.length === 0) throw new Error('kernel feature package denominator is empty')
  for (const packageRoot of packages) {
    const files = sourceFiles(packageRoot)
    if (files.length === 0) throw new Error(`kernel feature package has no production source: ${relativePath(packageRoot, root)}`)
    for (const filePath of files) {
      const sourceFile = parseSource(filePath)
      const source = fs.readFileSync(filePath, 'utf8')
      const match = source.match(/\b(?:partKey|containerKey|displayMode)\b/)
      if (match !== null) {
        const position = source.indexOf(match[0])
        const line = source.slice(0, position).split('\n').length
        throwViolation(`P-10 kernel UI literal ${match[0]}`, filePath, root, line)
      }
      void sourceFile
    }
  }
}

function runP5dUiFeatureNativeElements({root}) {
  const packages = uiNativePackages(root)
  if (packages.length === 0) throw new Error('ui native package denominator is empty')
  for (const packageRoot of packages) {
    const files = sourceFiles(packageRoot)
    if (files.length === 0) throw new Error(`ui native package has no production source: ${relativePath(packageRoot, root)}`)
    for (const filePath of files) {
      const sourceFile = parseSource(filePath)
      const importedCreateElementNames = new Set()
      const reactNamespaceNames = new Set()
      const collectBindings = node => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === 'react') {
          const clause = node.importClause
          if (clause?.name !== undefined) reactNamespaceNames.add(clause.name.text)
          if (clause?.namedBindings !== undefined && ts.isNamespaceImport(clause.namedBindings)) {
            reactNamespaceNames.add(clause.namedBindings.name.text)
          } else if (clause?.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) {
              const importedName = element.propertyName?.text ?? element.name.text
              if (importedName === 'createElement') importedCreateElementNames.add(element.name.text)
            }
          }
        }
        ts.forEachChild(node, collectBindings)
      }
      collectBindings(sourceFile)

      const jsxHostTagText = tagName => {
        if (ts.isIdentifier(tagName)) return tagName.text
        if (ts.isJsxNamespacedName(tagName)) {
          return `${tagName.namespace.text}:${tagName.name.text}`
        }
        return undefined
      }

      const isStringHostTag = tagName => {
        const text = jsxHostTagText(tagName)
        return text !== undefined && (/^[a-z]/.test(text) || text.includes('-'))
      }

      let violation
      const visit = node => {
        if (violation !== undefined) return
        if (ts.isJsxElement(node) && isStringHostTag(node.openingElement.tagName)) {
          violation = node.openingElement
        }
        if (ts.isJsxSelfClosingElement(node) && isStringHostTag(node.tagName)) {
          violation = node
        }
        if (ts.isCallExpression(node) && node.arguments.length > 0 && ts.isStringLiteralLike(node.arguments[0])) {
          const expression = node.expression
          const directCall = ts.isIdentifier(expression) && importedCreateElementNames.has(expression.text)
          const namespaceCall = ts.isPropertyAccessExpression(expression)
            && expression.name.text === 'createElement'
            && ts.isIdentifier(expression.expression)
            && reactNamespaceNames.has(expression.expression.text)
          if (directCall || namespaceCall) violation = node
        }
        ts.forEachChild(node, visit)
      }
      visit(sourceFile)
      if (violation !== undefined) {
        throwViolation(
          'P-5d ui feature must use typed components, not string host tags or string createElement arguments',
          filePath,
          root,
          lineOf(violation, sourceFile),
        )
      }
    }
  }
}

export function runLayeringChecks({root = repoRoot} = {}) {
  const packages = packageDirectories(root)
  const checks = [
    ['p-5a-direction', () => runP5aDirection({root, packages})],
    ['p-5c-state-edge', () => runP5cStateEdge({root})],
    ['p-10-kernel-ui-literals', () => runP10KernelUiLiterals({root})],
    ['p-5d-ui-feature-native-elements', () => runP5dUiFeatureNativeElements({root})],
  ]
  const results = checks.map(([name, check]) => {
    try {
      check()
      return {name, status: 'PASS'}
    } catch (error) {
      return {name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
    }
  })
  return {results, support: {status: 'PASS'}}
}

function printUsage() {
  console.log('Usage: node tools/terminal-layering/check-static.mjs [--help]')
  console.log('Runs P-5a direction, P-5c UI/state-edge, P-10 kernel UI-literal, and P-5d UI native-element gates.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    printUsage()
    process.exit(0)
  }
  const report = runLayeringChecks()
  console.log(`TERMINAL_LAYERING_RULE_GATES=${LAYERING_RULE_NAMES.length}`)
  console.log(`TERMINAL_LAYERING_SUPPORT_CHECKS=${LAYERING_SUPPORT_CHECK_COUNT}`)
  for (const result of report.results) {
    console.log(`TERMINAL_LAYERING_RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`)
    if (result.error) console.error(`TERMINAL_LAYERING_FIRST_FAILURE:${result.name}:${result.error}`)
  }
  const failed = report.results.some(result => result.status !== 'PASS')
  if (failed) process.exit(1)
  console.log('TERMINAL_LAYERING=PASS')
}
