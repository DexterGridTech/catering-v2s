import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import ts from 'typescript'
import {assertExactList, readPackageInvariant} from '../terminal-shared/package-invariants.mjs'

const toolDirectory = path.dirname(fileURLToPath(import.meta.url))
export const repoRoot = path.resolve(toolDirectory, '../..')
export const renderRoot = path.join(repoRoot, 'apps/terminal/ui/base/render')

export const RENDER_STATIC_RULE_NAMES = Object.freeze([
  'render-public-surface',
  'render-package-boundary',
  'render-source-forbidden-apis',
  'render-source-forbidden-keys',
  'render-hooks-unconditional',
  'render-surface-props-required',
  'render-test-wiring',
])
export const RENDER_STATIC_SUPPORT_CHECK_COUNT = 1

const INFRASTRUCTURE_EXPORTS = Object.freeze([
  'dependencyModuleNames',
  'devDependencyModuleNames',
  'moduleName',
])

function sourceFiles(root) {
  const sourceRoot = path.join(root, 'src')
  const files = []
  const visit = directory => {
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
  const visit = directory => {
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
      '@catering-v2s/kernel-base-display-context': ['apps/terminal/kernel/base/display-context/src/index.ts'],
      '@catering-v2s/kernel-base-platform-ports': ['apps/terminal/kernel/base/platform-ports/src/index.ts'],
      '@catering-v2s/kernel-base-runtime': ['apps/terminal/kernel/base/runtime/src/index.ts'],
      '@catering-v2s/kernel-base-state': ['apps/terminal/kernel/base/state/src/index.ts'],
      '@catering-v2s/kernel-base-ui-state': ['apps/terminal/kernel/base/ui-state/src/index.ts'],
      '@reduxjs/toolkit': ['node_modules/@reduxjs/toolkit/dist/index.d.ts'],
    },
  })
  return {program, checker: program.getTypeChecker()}
}

function moduleSymbol(checker, sourceFile) {
  const symbol = checker.getSymbolAtLocation(sourceFile)
  if (!symbol) throw new Error('render src/index.ts has no module symbol')
  return symbol
}

function publicExports(checker, indexSourceFile) {
  return checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile))
    .map(symbol => symbol.name)
    .sort()
}

function runPublicSurface({root, invariant, checker, indexSourceFile}) {
  const actual = publicExports(checker, indexSourceFile)
  assertExactList('render public exports', actual, invariant.publicExports)
  assertExactList('render infrastructure exports', INFRASTRUCTURE_EXPORTS, actual.filter(name => INFRASTRUCTURE_EXPORTS.includes(name)))
  const domain = actual.filter(name => !INFRASTRUCTURE_EXPORTS.includes(name))
  const expectedDomain = invariant.publicExports.filter(name => !INFRASTRUCTURE_EXPORTS.includes(name))
  assertExactList('render domain exports', domain, expectedDomain)
  if (actual.length !== 16) throw new Error(`render public export count must be 16; actual=${actual.length}`)
  void root
}

function readPackageJson(root) {
  const packagePath = path.join(root, 'package.json')
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'))
}

function runPackageBoundary({root}) {
  const packageJson = readPackageJson(root)
  const dependencies = packageJson.dependencies ?? {}
  const peers = packageJson.peerDependencies ?? {}
  if (dependencies.react !== undefined || dependencies['react-native'] !== undefined) {
    throw new Error('react and react-native must not be runtime dependencies')
  }
  if (peers.react !== '19.2.3' || peers['react-native'] !== '0.86.3') {
    throw new Error(`React peer boundary mismatch: ${JSON.stringify(peers)}`)
  }
  const allDependencyNames = [
    ...Object.keys(dependencies),
    ...Object.keys(peers),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ]
  if (allDependencyNames.includes('react-redux')) {
    throw new Error('react-redux must not be a render package dependency')
  }
  assertExactList(
    'render runtime dependencies',
    Object.keys(dependencies),
    [
      '@catering-v2s/kernel-base-platform-ports',
      '@catering-v2s/kernel-base-runtime',
      '@catering-v2s/kernel-base-ui-state',
    ],
  )
}

function runSourceForbiddenApis({root}) {
  const forbidden = [
    [/\bgetStore\b/, 'getStore'],
    [/\bdispatch(?:Command|Action)?\s*\(/, 'dispatch'],
    [/\bdefineCommand\b/, 'defineCommand'],
    [/\bRuntimeModule\b/, 'RuntimeModule'],
    [/\bcreateSlice\b/, 'createSlice'],
    [/\bslices\s*:/, 'slices'],
    [/\binstall\b/, 'install'],
    [/\breact-redux\b/, 'react-redux'],
    [/\bStateRoot\b/, 'StateRoot'],
  ]
  for (const filePath of sourceFiles(root)) {
    const source = fs.readFileSync(filePath, 'utf8')
    for (const [pattern, label] of forbidden) {
      if (pattern.test(source)) throw new Error(`${label} is forbidden in ${path.relative(root, filePath)}`)
    }
  }
}

function propertyText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return undefined
}

function isConcreteString(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

function isKeyName(name) {
  return /^(?:default|business|known)?(?:part|container)[_-]?key$/i.test(name)
    || /(?:part|container)[_-]?key$/i.test(name)
}

function isKeyAccess(node) {
  if (ts.isPropertyAccessExpression(node)) return isKeyName(node.name.text)
  if (ts.isElementAccessExpression(node) && node.argumentExpression !== undefined) {
    return isConcreteString(node.argumentExpression) && isKeyName(node.argumentExpression.text)
  }
  return false
}

function runSourceForbiddenKeys({root}) {
  for (const filePath of sourceFiles(root)) {
    const sourceFile = parseSource(filePath)
    let failure
    const visit = node => {
      if (failure !== undefined) return
      if (ts.isPropertyAssignment(node)) {
        const name = propertyText(node.name)
        if ((name === 'partKey' || name === 'containerKey') && isConcreteString(node.initializer)) {
          failure = `${name} literal is forbidden in ${path.relative(root, filePath)}`
          return
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
        if (isKeyName(node.name.text) && isConcreteString(node.initializer)) {
          failure = `${node.name.text} literal is forbidden in ${path.relative(root, filePath)}`
          return
        }
      }
      if (ts.isBinaryExpression(node) && [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)) {
        const leftKey = isKeyAccess(node.left)
        const rightKey = isKeyAccess(node.right)
        if ((leftKey && isConcreteString(node.right)) || (rightKey && isConcreteString(node.left))) {
          failure = `concrete key comparison is forbidden in ${path.relative(root, filePath)}`
          return
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    if (failure !== undefined) throw new Error(failure)
  }
}

function isHookCall(node) {
  return ts.isCallExpression(node)
    && ts.isIdentifier(node.expression)
    && /^use[A-Z]/.test(node.expression.text)
}

function isDescendant(node, ancestor) {
  let current = node
  while (current !== undefined) {
    if (current === ancestor) return true
    current = current.parent
  }
  return false
}

function runHooksUnconditional({root}) {
  for (const filePath of sourceFiles(root)) {
    const sourceFile = parseSource(filePath)
    let failure
    const visit = node => {
      if (failure !== undefined) return
      if (isHookCall(node)) {
        let current = node.parent
        while (current !== undefined && !ts.isSourceFile(current)) {
          if (ts.isBinaryExpression(current) && [
            ts.SyntaxKind.QuestionQuestionToken,
            ts.SyntaxKind.AmpersandAmpersandToken,
            ts.SyntaxKind.BarBarToken,
          ].includes(current.operatorToken.kind) && isDescendant(node, current.right)) {
            failure = `conditional hook call in ${path.relative(root, filePath)}`
            return
          }
          if (ts.isConditionalExpression(current)
            && (isDescendant(node, current.whenTrue) || isDescendant(node, current.whenFalse))) {
            failure = `conditional hook call in ${path.relative(root, filePath)}`
            return
          }
          if (ts.isIfStatement(current)
            && (isDescendant(node, current.thenStatement) || (current.elseStatement !== undefined && isDescendant(node, current.elseStatement)))) {
            failure = `conditional hook call in ${path.relative(root, filePath)}`
            return
          }
          current = current.parent
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    if (failure !== undefined) throw new Error(failure)
  }
}

function unwrapReadonly(node) {
  let current = node
  while (
    ts.isTypeReferenceNode(current)
    && current.typeName.getText() === 'Readonly'
    && current.typeArguments?.length === 1
  ) current = current.typeArguments[0]
  return current
}

function runSurfacePropsRequired({root}) {
  const propsFile = path.join(root, 'src/types/props.ts')
  const sourceFile = parseSource(propsFile)
  const declaration = sourceFile.statements.find(statement =>
    ts.isTypeAliasDeclaration(statement) && statement.name.text === 'SurfaceRootProps',
  )
  if (!declaration || !ts.isTypeAliasDeclaration(declaration)) throw new Error('SurfaceRootProps declaration is missing')
  const typeNode = unwrapReadonly(declaration.type)
  if (!ts.isTypeLiteralNode(typeNode)) throw new Error('SurfaceRootProps must be a type literal')
  for (const required of ['displayMode', 'containerKey']) {
    const member = typeNode.members.find(candidate => propertyText(candidate.name) === required)
    if (!member || !ts.isPropertySignature(member)) throw new Error(`SurfaceRootProps.${required} is missing`)
    if (member.questionToken !== undefined) throw new Error(`SurfaceRootProps.${required} must be required`)
  }
}

function runTestWiring({root, invariant}) {
  const packageJson = readPackageJson(root)
  if (typeof packageJson.scripts?.test !== 'string' || !packageJson.scripts.test.includes('run-owned-tests.mjs')) {
    throw new Error('render package test script must use run-owned-tests.mjs')
  }
  if (invariant.owned?.test?.kind !== 'REAL_TESTS' || invariant.owned.test.runner !== 'vitest') {
    throw new Error('render test ownership must be REAL_TESTS/vitest')
  }
  const vitestConfigPath = path.join(root, 'vitest.config.ts')
  if (!fs.existsSync(vitestConfigPath)) throw new Error('vitest.config.ts is missing')
  const vitestConfig = fs.readFileSync(vitestConfigPath, 'utf8')
  if (!vitestConfig.includes('test/**/*.test.tsx')) throw new Error('vitest config must include .test.tsx')
  const tsconfig = fs.readFileSync(path.join(root, 'tsconfig.json'), 'utf8')
  if (!tsconfig.includes('test/**/*.tsx') || !tsconfig.includes('src/**/*.tsx')) {
    throw new Error('tsconfig must include .tsx source and test files')
  }
  if (!testFiles(root).some(filePath => filePath.endsWith('.tsx'))) throw new Error('no .tsx test file is collectable')
  if (packageJson.devDependencies?.vitest !== '4.1.10') throw new Error('vitest devDependency must be 4.1.10')
  if (packageJson.devDependencies?.['react-test-renderer'] !== '19.2.3') {
    throw new Error('react-test-renderer devDependency must be 19.2.3')
  }
}

function pass(name) {
  return {name, status: 'PASS'}
}

function fail(name, error) {
  return {name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
}

export function runRenderStaticChecks({renderPackageRoot = renderRoot} = {}) {
  const invariant = readPackageInvariant(renderPackageRoot, '@catering-v2s/ui-base-render')
  const {program, checker} = createProgram(renderPackageRoot)
  const indexSourceFile = program.getSourceFile(path.join(renderPackageRoot, 'src/index.ts'))
  if (!indexSourceFile) throw new Error('render src/index.ts is missing from TypeScript program')
  const checks = [
    ['render-public-surface', () => runPublicSurface({root: renderPackageRoot, invariant, checker, indexSourceFile})],
    ['render-package-boundary', () => runPackageBoundary({root: renderPackageRoot})],
    ['render-source-forbidden-apis', () => runSourceForbiddenApis({root: renderPackageRoot})],
    ['render-source-forbidden-keys', () => runSourceForbiddenKeys({root: renderPackageRoot})],
    ['render-hooks-unconditional', () => runHooksUnconditional({root: renderPackageRoot})],
    ['render-surface-props-required', () => runSurfacePropsRequired({root: renderPackageRoot})],
    ['render-test-wiring', () => runTestWiring({root: renderPackageRoot, invariant})],
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
    const testCount = testFiles(renderPackageRoot).length
    if (testCount === 0) throw new Error('render test directory is empty')
    support = {name: 'render-owned-test-support', status: 'PASS'}
  } catch (error) {
    support = {name: 'render-owned-test-support', status: 'FAIL', error: error instanceof Error ? error.message : String(error)}
  }
  return {results, support}
}

function printReport(report) {
  for (const result of report.results) {
    console.log(`RENDER_STATIC_RULE name=${result.name} status=${result.status}`)
    if (result.error) console.error(`RENDER_STATIC_RULE_FAILURE name=${result.name} error=${result.error}`)
  }
  console.log(`RENDER_STATIC_RULE_GATES=${RENDER_STATIC_RULE_NAMES.length}`)
  console.log(`RENDER_STATIC_SUPPORT_CHECKS=${RENDER_STATIC_SUPPORT_CHECK_COUNT}`)
  console.log(`RENDER_STATIC_SUPPORT=${report.support.status}`)
  if (report.support.error) console.error(`RENDER_STATIC_SUPPORT_FAILURE error=${report.support.error}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = runRenderStaticChecks()
  printReport(report)
  const failed = report.results.filter(result => result.status !== 'PASS')
  if (failed.length || report.support.status !== 'PASS') {
    console.error(`TERMINAL_RENDER_STATIC=FAIL failed=${failed.map(result => result.name).join(',')}`)
    process.exit(1)
  }
  console.log('TERMINAL_RENDER_STATIC=PASS')
}
