import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import ts from 'typescript'
import {assertExactList, readPackageInvariant} from '../terminal-shared/package-invariants.mjs'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(toolDirectory, '../..')
export const uiStateRoot = path.join(repoRoot, 'apps/terminal/kernel/base/ui-state')

export const UI_STATE_RULE_NAMES = Object.freeze([
  'ui-state-public-surface',
  'ui-state-owner-kind',
  'ui-state-test-skeleton',
  'ui-state-package-boundary',
  'ui-state-skeleton-graph',
  'ui-state-rtk-action-form',
  'ui-state-workspace-reuse',
  'ui-state-catalog-state-boundary',
])
export const UI_STATE_SUPPORT_CHECK_COUNT = 1

const expectedWorkspaceDependencies = Object.freeze([
  '@catering-v2s/kernel-base-contracts',
  '@catering-v2s/kernel-base-display-context',
  '@catering-v2s/kernel-base-platform-ports',
  '@catering-v2s/kernel-base-runtime',
  '@catering-v2s/kernel-base-state',
])

function sorted(values) {
  return [...new Set(values)].sort()
}

function difference(left, right) {
  const rightSet = new Set(right)
  return sorted(left).filter(value => !rightSet.has(value))
}

function sourceFiles(root) {
  const directory = path.join(root, 'src')
  const result = []
  function visit(current) {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push(entryPath)
    }
  }
  visit(directory)
  return result.sort()
}

function testFiles(root) {
  const directory = path.join(root, 'test')
  const result = []
  function visit(current) {
    if (!fs.existsSync(current)) return
    for (const entry of fs.readdirSync(current, {withFileTypes: true})) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && /\.tsx?$/.test(entry.name)) result.push(entryPath)
    }
  }
  visit(directory)
  return result.sort()
}

function collectWorkspaceImports(root) {
  return sorted(sourceFiles(root).flatMap(filePath => {
    const source = fs.readFileSync(filePath, 'utf8')
    return [...source.matchAll(/from\s+['"](@catering-v2s\/[^'"]+)['"]/g)].map(match => match[1])
  }))
}

function namedImports(source, moduleName) {
  const imports = new Set()
  source.statements.forEach(statement => {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== moduleName) return
    if (!statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) return
    for (const element of statement.importClause.namedBindings.elements) imports.add(element.name.text)
  })
  return imports
}

function walk(source, visitor) {
  function visit(node) {
    visitor(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function sourceFile(filePath) {
  return ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function createProgram(root) {
  const files = sourceFiles(root)
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: repoRoot,
    paths: {
      '@catering-v2s/kernel-base-ui-state': ['apps/terminal/kernel/base/ui-state/src/index.ts'],
    },
  })
  return {program, checker: program.getTypeChecker()}
}

function literalConstValue(filePath, exportName) {
  const file = sourceFile(filePath)
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    if (!statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name?.getText(file) !== exportName || !declaration.initializer) continue
      const initializer = ts.isAsExpression(declaration.initializer)
      const expression = initializer ? declaration.initializer.expression : declaration.initializer
      if (ts.isStringLiteralLike(expression)) return expression.text
    }
  }
  throw new Error(`missing exported literal const ${exportName}`)
}

function moduleSymbol(program, checker, filePath) {
  const source = program.getSourceFile(filePath)
  const symbol = source === undefined ? undefined : checker.getSymbolAtLocation(source)
  if (!symbol) throw new Error(`ui-state index has no module symbol`)
  return symbol
}

function publicExports(program, checker, indexPath) {
  return checker.getExportsOfModule(moduleSymbol(program, checker, indexPath)).map(symbol => symbol.name).sort()
}

function runPublicSurface({root, program, checker, invariant}) {
  assertExactList(
    'ui-state public exports',
    publicExports(program, checker, path.join(root, 'src/index.ts')),
    invariant.publicExports ?? [],
  )
}

function runOwnerKind({root, invariant}) {
  const moduleNamePath = path.join(root, 'src/moduleName.ts')
  const moduleKind = literalConstValue(moduleNamePath, 'moduleKind')
  if (moduleKind !== 'owner' || moduleKind !== invariant.ownerKind) {
    throw new Error(`moduleKind must be owner; actual=${moduleKind}`)
  }
}

function runTestSkeleton({root, invariant}) {
  const owned = invariant.owned?.test
  if (owned?.kind !== 'REAL_TESTS' || owned.owner !== invariant.package || owned.runner !== 'vitest') {
    throw new Error('ui-state invariant must own REAL_TESTS with vitest')
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (typeof packageJson.scripts?.test !== 'string' || !packageJson.scripts.test.includes('run-owned-tests.mjs')) {
    throw new Error('ui-state package must use run-owned-tests.mjs')
  }
  if (!fs.existsSync(path.join(root, 'vitest.config.ts'))) throw new Error('ui-state vitest.config.ts is missing')
  if (!testFiles(root).some(filePath => filePath.endsWith('.test.ts'))) {
    throw new Error('ui-state test skeleton must contain a .test.ts file')
  }
}

function runPackageBoundary({root}) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  if (packageJson.dependencies?.['@reduxjs/toolkit'] !== '2.12.0') {
    throw new Error('package must directly declare @reduxjs/toolkit 2.12.0')
  }
  const actualWorkspaceDependencies = sorted(
    Object.keys(packageJson.dependencies ?? {}).filter(name => name.startsWith('@catering-v2s/')),
  )
  const missing = difference(expectedWorkspaceDependencies, actualWorkspaceDependencies)
  const extra = difference(actualWorkspaceDependencies, expectedWorkspaceDependencies)
  if (missing.length || extra.length) {
    throw new Error(`workspace dependency mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`)
  }
  const undeclared = difference(collectWorkspaceImports(root), actualWorkspaceDependencies)
  if (undeclared.length) throw new Error(`undeclared workspace import: ${undeclared.join(', ')}`)

  const forbiddenQueueSymbols = new Set(['readyToEnter', 'indexInContainer', 'findFirstReady', 'screenReady'])
  const forbiddenImports = []
  const queueSymbols = []
  const ownPersistenceTypes = []
  const layerPersistenceFields = []
  const syncDeclarations = []
  let workspaceDescriptorCalls = 0
  let isolatedDeclarations = 0
  for (const filePath of sourceFiles(root)) {
    const file = sourceFile(filePath)
    for (const statement of file.statements) {
      if (ts.isImportDeclaration(statement)) {
        const moduleSpecifier = statement.moduleSpecifier.text
        if (moduleSpecifier === 'react' || moduleSpecifier === 'react-native' || moduleSpecifier.startsWith('react/')) {
          forbiddenImports.push(`${path.relative(root, filePath)}:${moduleSpecifier}`)
        }
      }
    }
    walk(file, node => {
      if (ts.isIdentifier(node) && forbiddenQueueSymbols.has(node.text)) {
        queueSymbols.push(`${path.relative(root, filePath)}:${node.text}`)
      }
      if (ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
        const name = node.name.text
        if (/persist|storage|flush/i.test(name)) ownPersistenceTypes.push(`${path.relative(root, filePath)}:${name}`)
      }
      if (ts.isPropertyAssignment(node)) {
        const name = node.name.getText(file)
        if (name === 'sync') syncDeclarations.push(`${path.relative(root, filePath)}:${node.getStart(file)}`)
        if (name === 'syncIntent') {
          const expression = unwrapExpression(node.initializer)
          if (ts.isStringLiteralLike(expression) && expression.text === 'isolated') isolatedDeclarations += 1
          else syncDeclarations.push(`${path.relative(root, filePath)}:${node.getStart(file)}`)
        }
        if (name === 'persistence' && containsPropertyName(node.initializer, 'layers')) {
          layerPersistenceFields.push(`${path.relative(root, filePath)}:${node.getStart(file)}`)
        }
      }
      if (ts.isCallExpression(node) && node.expression.getText(file) === 'toWorkspaceStateDescriptors') {
        workspaceDescriptorCalls += 1
      }
    })
  }
  if (forbiddenImports.length) throw new Error(`ui-state must not import React/RN: ${forbiddenImports.join(', ')}`)
  if (queueSymbols.length) throw new Error(`ui-state must not define queue symbols: ${queueSymbols.join(', ')}`)
  if (ownPersistenceTypes.length) throw new Error(`ui-state must not define persistence types: ${ownPersistenceTypes.join(', ')}`)
  if (layerPersistenceFields.length) throw new Error(`ui-state persistence must not include layers: ${layerPersistenceFields.join(', ')}`)
  if (workspaceDescriptorCalls < 2 || isolatedDeclarations !== 2 || syncDeclarations.length) {
    throw new Error(`ui-state registrations must be two isolated workspace families without sync; descriptors=${workspaceDescriptorCalls} isolated=${isolatedDeclarations} sync=${JSON.stringify(syncDeclarations)}`)
  }
}

function unwrapExpression(expression) {
  let current = expression
  while (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression
  }
  return current
}

function propertyNameText(node, file) {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return node.text ?? node.getText(file)
  return node.getText(file)
}

function containsPropertyName(node, expected) {
  let found = false
  function visit(current) {
    if (found) return
    if (ts.isPropertyAssignment(current) || ts.isPropertyDeclaration(current) || ts.isMethodDeclaration(current)) {
      if (propertyNameText(current.name, current.getSourceFile()) === expected) {
        found = true
        return
      }
    }
    if (ts.isPropertyAccessExpression(current) && current.name.text === expected) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

function readStringArrayConst(file, exportName) {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(file) !== exportName || !declaration.initializer) continue
      const initializer = unwrapExpression(declaration.initializer)
      if (!ts.isArrayLiteralExpression(initializer)) continue
      return initializer.elements
        .filter(element => ts.isStringLiteralLike(element))
        .map(element => element.text)
    }
  }
  return undefined
}

function runCatalogStateBoundary({root}) {
  const catalogPath = path.join(root, 'src/foundations/catalog.ts')
  const catalogFile = sourceFile(catalogPath)
  const approved = readStringArrayConst(catalogFile, 'approvedEntryKeys')
  assertExactList(
    'ui-state catalog approved entry keys',
    approved ?? [],
    ['partKey', 'rendererKey', 'containerKeys', 'displayModes', 'workspaces', 'instanceModes', 'title', 'description'],
  )
  const statePathPattern = /(?:types[\\/]content|types[\\/]variable|foundations[\\/]workspaceSlices|foundations[\\/]variableSlices|features[\\/]commands|features[\\/]actors|selectors[\\/])/
  const forbiddenStateNames = new Set(['title', 'description', 'rendererKey', 'containerKeys'])
  const leaks = []
  for (const filePath of sourceFiles(root)) {
    const relativePath = path.relative(root, filePath)
    if (!statePathPattern.test(relativePath)) continue
    const file = sourceFile(filePath)
    walk(file, node => {
      if (!ts.isIdentifier(node) || !forbiddenStateNames.has(node.text)) return
      leaks.push(`${relativePath}:${node.text}`)
    })
  }
  if (leaks.length) throw new Error(`ui-state state boundary leaks catalog-only fields: ${leaks.join(', ')}`)
}

function runRtkActionForm({root}) {
  let hasCreateSliceImport = false
  const manualActionTypes = []
  const forbiddenRtkImports = []
  for (const filePath of sourceFiles(root)) {
    const file = sourceFile(filePath)
    const rtkImports = namedImports(file, '@reduxjs/toolkit')
    if (rtkImports.has('createSlice')) hasCreateSliceImport = true
    for (const name of ['createAction', 'createReducer']) {
      if (rtkImports.has(name)) forbiddenRtkImports.push(`${path.relative(root, filePath)}:${name}`)
    }
    walk(file, node => {
      if (!ts.isPropertyAssignment(node) || node.name.getText(file) !== 'type') return
      if (ts.isStringLiteralLike(node.initializer)) {
        manualActionTypes.push(`${path.relative(root, filePath)}:${node.getStart(file)}`)
      }
    })
  }
  if (!hasCreateSliceImport) throw new Error('ui-state must create slices with Redux Toolkit createSlice')
  if (forbiddenRtkImports.length) {
    throw new Error(`ui-state must not import manual RTK action/reducer factories: ${forbiddenRtkImports.join(', ')}`)
  }
  if (manualActionTypes.length) {
    throw new Error(`ui-state contains hand-written action type literal: ${manualActionTypes.join(', ')}`)
  }
}

function runWorkspaceReuse({root}) {
  const required = ['createWorkspaceStateKeys', 'createWorkspaceActionDispatcher', 'toWorkspaceStateDescriptors']
  const imported = new Set()
  const localForbidden = []
  const workspaceKeySuffix = /\.(?:MAIN|BRANCH)(?:$|[^A-Za-z0-9_])/u
  const localWorkspaceHelperName = /(?:workspace|partition|state).*(?:key|keys|router|route|dispatch)|(?:key|keys|router|route|dispatch).*(?:workspace|partition|state)/iu

  function propertyName(node, file) {
    if (!ts.isPropertyAssignment(node) && !ts.isMethodDeclaration(node) && !ts.isShorthandPropertyAssignment(node)) return undefined
    return node.name === undefined ? undefined : node.name.getText(file).replace(/^['"]|['"]$/g, '')
  }

  function isWorkspaceDescriptorReducerMap(node, file) {
    const reducerProperty = node.parent
    const argument = reducerProperty?.parent
    const call = argument?.parent
    return ts.isPropertyAssignment(reducerProperty)
      && propertyName(reducerProperty, file) === 'reducers'
      && ts.isObjectLiteralExpression(argument)
      && ts.isCallExpression(call)
      && call.expression.getText(file) === 'toWorkspaceStateDescriptors'
  }

  function isCanonicalWorkspaceKeyDeclaration(node, file) {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isCallExpression(node.initializer)) return false
    return node.initializer.expression.getText(file) === 'createWorkspaceStateKeys'
  }

  for (const filePath of sourceFiles(root)) {
    const file = sourceFile(filePath)
    for (const name of namedImports(file, '@catering-v2s/kernel-base-state')) imported.add(name)
    walk(file, node => {
      if (ts.isStringLiteralLike(node) && workspaceKeySuffix.test(node.text)) {
        localForbidden.push(`${path.relative(root, filePath)}:${node.getText(file)}`)
      }
      if (ts.isTemplateExpression(node) && workspaceKeySuffix.test(node.getText(file))) {
        localForbidden.push(`${path.relative(root, filePath)}:${node.getText(file)}`)
      }
      if (ts.isObjectLiteralExpression(node)) {
        const names = new Set(node.properties.map(property => propertyName(property, file)).filter(Boolean))
        if (names.has('MAIN') && names.has('BRANCH') && !isWorkspaceDescriptorReducerMap(node, file)) {
          localForbidden.push(`${path.relative(root, filePath)}:{MAIN,BRANCH}`)
        }
      }
      if (!ts.isVariableDeclaration(node) && !ts.isFunctionDeclaration(node) && !ts.isClassDeclaration(node)) return
      const name = node.name?.getText(file)
      if (name !== undefined && localWorkspaceHelperName.test(name) && !isCanonicalWorkspaceKeyDeclaration(node, file)) {
        localForbidden.push(`${path.relative(root, filePath)}:${name}`)
      }
    })
  }
  const missing = required.filter(name => !imported.has(name))
  if (missing.length) throw new Error(`ui-state must import state workspace helpers: ${missing.join(', ')}`)
  if (localForbidden.length) throw new Error(`ui-state defines a local workspace key/router helper: ${localForbidden.join(', ')}`)
}

function graphEntry(source) {
  const match = source.match(/'kernel\.base\.ui-state':\s*\{([\s\S]*?)\n\s*\},\n\s*'kernel\.base\.test-support':/)
  if (!match) throw new Error('skeleton graph has no ui-state entry')
  return match[1]
}

function runSkeletonGraph({graphPath}) {
  const entry = graphEntry(fs.readFileSync(graphPath, 'utf8'))
  if (!/\bkind:\s*'owner'/.test(entry) || /\bplannedKind\s*:/.test(entry)) {
    throw new Error('skeleton graph ui-state must use actual kind owner without plannedKind')
  }
  const dependencyBlock = entry.match(/dependencies:\s*\[([\s\S]*?)\],\n\s*devDependencies:/)?.[1]
  const actual = dependencyBlock === undefined
    ? []
    : sorted([...dependencyBlock.matchAll(/'([^']+)'/g)].map(match => match[1]))
  const expected = ['kernel.base.contracts', 'kernel.base.display-context', 'kernel.base.platform-ports', 'kernel.base.runtime', 'kernel.base.state']
  if (actual.length !== expected.length || difference(expected, actual).length || difference(actual, expected).length) {
    throw new Error(`skeleton graph ui-state dependencies mismatch: ${JSON.stringify(actual)}`)
  }
}

function runSupport({root, invariant}) {
  const errors = []
  if (!fs.existsSync(path.join(root, 'package.json'))) errors.push('package.json is missing')
  if (!fs.existsSync(path.join(root, 'src/index.ts'))) errors.push('src/index.ts is missing')
  if (invariant.package !== '@catering-v2s/kernel-base-ui-state') errors.push('package identity mismatch')
  if (errors.length) throw new Error(errors.join('; '))
}

export function runUiStateStaticChecks({
  uiStatePackageRoot = uiStateRoot,
  skeletonGraphPath = path.join(repoRoot, 'apps/terminal/skeleton-graph.ts'),
} = {}) {
  const invariant = readPackageInvariant(uiStatePackageRoot, '@catering-v2s/kernel-base-ui-state')
  const {program, checker} = createProgram(uiStatePackageRoot)
  const checks = [
    ['ui-state-public-surface', () => runPublicSurface({root: uiStatePackageRoot, program, checker, invariant})],
    ['ui-state-owner-kind', () => runOwnerKind({root: uiStatePackageRoot, invariant})],
    ['ui-state-test-skeleton', () => runTestSkeleton({root: uiStatePackageRoot, invariant})],
    ['ui-state-package-boundary', () => runPackageBoundary({root: uiStatePackageRoot})],
    ['ui-state-skeleton-graph', () => runSkeletonGraph({graphPath: skeletonGraphPath})],
    ['ui-state-rtk-action-form', () => runRtkActionForm({root: uiStatePackageRoot})],
    ['ui-state-workspace-reuse', () => runWorkspaceReuse({root: uiStatePackageRoot})],
    ['ui-state-catalog-state-boundary', () => runCatalogStateBoundary({root: uiStatePackageRoot})],
  ]
  const results = checks.map(([name, check]) => {
    try {
      check()
      return {name, status: 'PASS'}
    } catch (error) {
      return {name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
    }
  })
  let support
  try {
    runSupport({root: uiStatePackageRoot, invariant})
    support = {status: 'PASS'}
  } catch (error) {
    support = {status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
  }
  return {results, support}
}

function main() {
  const report = runUiStateStaticChecks()
  for (const result of report.results) {
    console.log(`TERMINAL_UI_STATE_STATIC_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}${result.error ? ` error=${result.error}` : ''}`)
  }
  console.log(`TERMINAL_UI_STATE_STATIC_SUPPORT=${report.support.status}${report.support.error ? ` error=${report.support.error}` : ''}`)
  if (report.results.some(result => result.status === 'FAIL') || report.support.status === 'FAIL') process.exitCode = 1
}

if (import.meta.url === `file://${process.argv[1]}`) main()
