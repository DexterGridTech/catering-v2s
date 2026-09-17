import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import ts from 'typescript'
import {assertExactList, readPackageInvariant} from '../terminal-shared/package-invariants.mjs'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(toolDirectory, '../..')
export const displayContextRoot = path.join(repoRoot, 'apps/terminal/kernel/base/display-context')

export const DISPLAY_CONTEXT_RULE_NAMES = Object.freeze([
  'display-context-public-surface',
  'display-context-owner-kind',
  'display-context-restart-positive',
  'display-context-no-display-index-in-slice',
])
export const DISPLAY_CONTEXT_SUPPORT_CHECK_COUNT = 1

function sourceFiles(root) {
  const sourceRoot = path.join(root, 'src')
  const files = []
  function visit(directory) {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(entryPath)
    }
  }
  visit(sourceRoot)
  return files.sort()
}

function testFiles(root) {
  const testRoot = path.join(root, 'test')
  const files = []
  function visit(directory) {
    if (!fs.existsSync(directory)) return
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(entryPath)
    }
  }
  visit(testRoot)
  return files.sort()
}

function parseSource(filePath) {
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
      '@catering-v2s/kernel-base-contracts': ['apps/terminal/kernel/base/contracts/src/index.ts'],
      '@catering-v2s/kernel-base-platform-ports': ['apps/terminal/kernel/base/platform-ports/src/index.ts'],
      '@catering-v2s/kernel-base-state': ['apps/terminal/kernel/base/state/src/index.ts'],
      '@catering-v2s/kernel-base-runtime': ['apps/terminal/kernel/base/runtime/src/index.ts'],
      '@reduxjs/toolkit': ['node_modules/@reduxjs/toolkit/dist/index.d.ts'],
    },
  })
  return {files, program, checker: program.getTypeChecker()}
}

function moduleSymbol(checker, sourceFile, label) {
  const symbol = checker.getSymbolAtLocation(sourceFile)
  if (!symbol) throw new Error(`${label} has no module symbol`)
  return symbol
}

function publicExports(checker, indexSourceFile) {
  return checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile, 'display-context src/index.ts'))
    .map(symbol => symbol.name)
    .sort()
}

function declarationName(declaration) {
  return declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : null
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return null
}

function findTypeDeclaration(root, typeName) {
  for (const filePath of sourceFiles(root)) {
    const sourceFile = parseSource(filePath)
    for (const statement of sourceFile.statements) {
      if (
        (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement))
        && declarationName(statement) === typeName
      ) {
        return {sourceFile, declaration: statement}
      }
    }
  }
  throw new Error(`Missing type declaration ${typeName}`)
}

function unwrapReadonly(typeNode) {
  let current = typeNode
  while (ts.isTypeReferenceNode(current) && current.typeName.getText() === 'Readonly' && current.typeArguments?.length === 1) {
    current = current.typeArguments[0]
  }
  return current
}

function typeMemberNames(root, typeName) {
  const {declaration} = findTypeDeclaration(root, typeName)
  const typeNode = ts.isTypeAliasDeclaration(declaration) ? unwrapReadonly(declaration.type) : declaration
  const members = ts.isTypeLiteralNode(typeNode) || ts.isInterfaceDeclaration(typeNode) ? typeNode.members : null
  if (!members) throw new Error(`${typeName} must be a type literal or interface`)
  const names = []
  for (const member of members) {
    if (ts.isIndexSignatureDeclaration(member) || ts.isCallSignatureDeclaration(member) || ts.isConstructSignatureDeclaration(member)) {
      throw new Error(`${typeName} must not contain index/call/construct members`)
    }
    const name = member.name ? propertyName(member.name) : null
    if (!name) throw new Error(`${typeName} contains an unnamed or computed member`)
    names.push(name)
  }
  return names
}

function literalConstValue(sourceFile, exportName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    const exported = statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declarationName(declaration) !== exportName || !declaration.initializer) continue
      const initializer = declaration.initializer
      const value = ts.isAsExpression(initializer) ? initializer.expression : initializer
      if (ts.isStringLiteralLike(value)) return value.text
    }
  }
  throw new Error(`Missing exported literal const ${exportName}`)
}

function runPublicSurface({checker, indexSourceFile, invariant}) {
  assertExactList('display-context public exports', publicExports(checker, indexSourceFile), invariant.publicExports)
}

function runOwnerKind({root, invariant}) {
  const moduleNameSource = parseSource(path.join(root, 'src/moduleName.ts'))
  const moduleName = literalConstValue(moduleNameSource, 'moduleName')
  const moduleKind = literalConstValue(moduleNameSource, 'moduleKind')
  if (moduleKind !== invariant.ownerKind || moduleKind !== 'owner') {
    throw new Error(`moduleKind must be owner; actual=${moduleKind}`)
  }
  if (invariant.sliceName !== `${moduleName}.display-role`) {
    throw new Error(`display slice name mismatch; actual=${String(invariant.sliceName)}`)
  }
  const moduleSource = fs.readFileSync(path.join(root, 'src/application/createDisplayContextModule.ts'), 'utf8')
  if (!moduleSource.includes('slices: [{name: displayRoleSliceName, persistIntent:')) {
    throw new Error('createDisplayContextModule must declare exactly the display role owner slice')
  }
  if ((moduleSource.match(/stateSlices:/g) ?? []).length !== 1) {
    throw new Error('createDisplayContextModule must expose one stateSlices field')
  }
}

function runRestartPositive({root, invariant}) {
  const required = invariant.requiredTestIds ?? []
  if (!required.includes('display-context-restart-positive')) {
    throw new Error('display-context-restart-positive must be required by invariant')
  }
  const contents = testFiles(root).map(filePath => fs.readFileSync(filePath, 'utf8')).join('\n')
  if (!contents.includes('display-context-restart-positive')) {
    throw new Error('display-context-restart-positive test id is missing')
  }
}

function runNoDisplayIndexInSlice({root}) {
  assertExactList('DisplayRoleState members', typeMemberNames(root, 'DisplayRoleState'), ['displayRole', 'powerConfirmation'])
  const sliceSource = fs.readFileSync(path.join(root, 'src/features/slices/displayRole.ts'), 'utf8')
  if (/\bdisplayIndex\b/.test(sliceSource)) {
    throw new Error('display role slice must not persist displayIndex')
  }
  const normalizedSliceSource = sliceSource.replace(/\n/g, ' ')
  const hasLegacyReducerInitialState = /state:\s*DisplayRoleState\s*=\s*\{\s*displayRole:\s*'CHIEF'\s*,\s*powerConfirmation:\s*null\s*\}/.test(normalizedSliceSource)
  const hasCreateSliceInitialState = /initialState:\s*\{\s*displayRole:\s*'CHIEF'\s*,\s*powerConfirmation:\s*null\s*\}\s*as\s*DisplayRoleState/.test(normalizedSliceSource)
  if (!hasLegacyReducerInitialState && !hasCreateSliceInitialState) {
    throw new Error('display role slice initial state must contain only displayRole: CHIEF')
  }
}

function runSupport({invariant}) {
  if (invariant.owned?.test?.kind !== 'REAL_TESTS') {
    throw new Error('display-context test owner must be REAL_TESTS')
  }
  if (invariant.owned.test.owner !== invariant.package) {
    throw new Error('display-context test owner must equal package')
  }
  if (invariant.owned.test.runner !== 'vitest') {
    throw new Error('display-context test runner must be vitest')
  }
}

function pass(name) {
  return {name, status: 'PASS'}
}

function fail(name, error) {
  return {name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
}

export function runDisplayContextStaticChecks({displayContextPackageRoot = displayContextRoot} = {}) {
  const invariant = readPackageInvariant(displayContextPackageRoot, '@catering-v2s/kernel-base-display-context')
  const {program, checker} = createProgram(displayContextPackageRoot)
  const indexSourceFile = program.getSourceFile(path.join(displayContextPackageRoot, 'src/index.ts'))
  if (!indexSourceFile) throw new Error('display-context src/index.ts is missing from TypeScript program')
  const checks = [
    ['display-context-public-surface', () => runPublicSurface({checker, indexSourceFile, invariant})],
    ['display-context-owner-kind', () => runOwnerKind({root: displayContextPackageRoot, invariant})],
    ['display-context-restart-positive', () => runRestartPositive({root: displayContextPackageRoot, invariant})],
    ['display-context-no-display-index-in-slice', () => runNoDisplayIndexInSlice({root: displayContextPackageRoot})],
  ]
  const results = checks.map(([name, check]) => {
    try {
      check()
      return pass(name)
    } catch (error) {
      return fail(name, error)
    }
  })
  let support
  try {
    runSupport({invariant})
    support = {name: 'display-context-owned-test-support', status: 'PASS'}
  } catch (error) {
    support = {name: 'display-context-owned-test-support', status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
  }
  return {results, support}
}

function printReport(report) {
  for (const result of report.results) {
    console.log(`DISPLAY_CONTEXT_RULE name=${result.name} status=${result.status}`)
    if (result.error) console.error(`DISPLAY_CONTEXT_RULE_FAILURE name=${result.name} error=${result.error}`)
  }
  console.log(`DISPLAY_CONTEXT_RULE_GATES=${DISPLAY_CONTEXT_RULE_NAMES.length}`)
  console.log(`DISPLAY_CONTEXT_SUPPORT_CHECKS=${DISPLAY_CONTEXT_SUPPORT_CHECK_COUNT}`)
  console.log(`DISPLAY_CONTEXT_SUPPORT=${report.support.status}`)
  if (report.support.error) console.error(`DISPLAY_CONTEXT_SUPPORT_FAILURE error=${report.support.error}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runDisplayContextStaticChecks()
  printReport(report)
  const failed = report.results.filter(result => result.status !== 'PASS')
  if (failed.length || report.support.status !== 'PASS') {
    console.error(`TERMINAL_DISPLAY_CONTEXT_STATIC=FAIL failed=${failed.map(result => result.name).join(',')}`)
    process.exit(1)
  }
  console.log('TERMINAL_DISPLAY_CONTEXT_STATIC=PASS')
}
