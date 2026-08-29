import fs from 'node:fs';
import path from 'node:path';
import {
  repoRoot,
  terminalRoot,
  readSkeletonSpec,
  projectSkeletonGraph,
  readPackageCensus,
  moduleNameToPath,
  moduleNameToPackageName,
  packageNameToModuleName,
  packageScope,
  collectStaticImportDeclarations,
  collectStaticImportSpecifiers,
} from './graph-model.mjs';

export const RULE_NAMES = Object.freeze([
  'graph-comparison',
  'triple-naming',
  'dependency-direction',
  'dependency-declaration-completeness',
  'tr01-reducer-boundary',
  'kernel-platform-independence',
]);

export const SUPPORT_CHECK_COUNT = 1;

const REQUIRED_IGNORE_LINES = Object.freeze([
  '.expo/',
  '.turbo/',
  '**/android/build/',
  '**/android/app/build/',
  '**/android/.gradle/',
  '*.apk',
  '*.aab',
  '*.keystore',
  '**/.kotlin/',
]);

function sorted(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return sorted(left).filter(value => !rightSet.has(value));
}

function assertEqualSet(label, actual, expected) {
  const missing = difference(expected, actual);
  const extra = difference(actual, expected);
  if (missing.length || extra.length) {
    throw new Error(`${label} mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }
}

function assertAcyclic(projected) {
  const visiting = new Set();
  const visited = new Set();
  const pathStack = [];

  function visit(moduleName) {
    if (visiting.has(moduleName)) {
      const cycleStart = pathStack.indexOf(moduleName);
      const cycle = [...pathStack.slice(cycleStart), moduleName];
      throw new Error(`dependency graph cycle: ${cycle.join(' -> ')}`);
    }
    if (visited.has(moduleName)) return;
    visiting.add(moduleName);
    pathStack.push(moduleName);
    const entry = projected[moduleName];
    for (const dependency of [...(entry?.dependencies ?? []), ...(entry?.devDependencies ?? [])]) {
      if (projected[dependency]) visit(dependency);
    }
    pathStack.pop();
    visiting.delete(moduleName);
    visited.add(moduleName);
  }

  for (const moduleName of Object.keys(projected)) visit(moduleName);
}

function moduleNameFromPackageDirectory(packageDirectory, root) {
  const relative = path.relative(path.join(root, 'apps/terminal'), packageDirectory);
  if (!relative || relative.startsWith('..')) return null;
  const segments = relative.split(path.sep);
  return segments.length === 3 ? segments.join('.') : null;
}

function leafPackageEntries(census, root) {
  return census
    .filter(entry => entry.relativePath !== 'apps/terminal')
    .map(entry => ({
      ...entry,
      moduleName: moduleNameFromPackageDirectory(entry.packageDirectory, root),
    }));
}

function declaredWorkspaceDependencies(packageJson, spec) {
  const declared = [];
  for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const packageName of Object.keys(packageJson[field] ?? {})) {
      if (packageName.startsWith('@catering-v2s/')) {
        const moduleName = packageNameToModuleName(packageName, spec);
        if (moduleName) declared.push(moduleName);
      }
    }
  }
  return sorted(declared);
}

function declaredByField(packageJson, field, spec) {
  return sorted(
    Object.keys(packageJson[field] ?? {})
      .map(packageName => packageNameToModuleName(packageName, spec))
      .filter(Boolean),
  );
}

function moduleSpecifierMatches(actual, expected) {
  if (actual === expected) return true;
  return ['.ts', '.tsx', '.js', '.jsx'].some(extension => actual === `${expected}${extension}`);
}

function entryFile(packageDirectory, relativePath, label) {
  const filePath = path.join(packageDirectory, relativePath);
  if (!fs.existsSync(filePath)) throw new Error(`assembly entry file missing: ${label} (${relativePath})`);
  return filePath;
}

function readPackageModuleName(packageDirectory, expectedModuleName) {
  const moduleNamePath = path.join(packageDirectory, 'src/moduleName.ts');
  if (!fs.existsSync(moduleNamePath)) throw new Error(`${expectedModuleName} moduleName.ts is missing`);
  const source = fs.readFileSync(moduleNamePath, 'utf8');
  const match = source.match(
    /^\s*export\s+const\s+moduleName\s*=\s*(['"])([^'"]+)\1\s+as\s+const\s*;\s*$/m,
  );
  if (!match) throw new Error(`${expectedModuleName} moduleName.ts must export a string literal moduleName`);
  return {moduleName: match[2], filePath: moduleNamePath};
}

function assertRuntimeImport(filePath, expectedSpecifier, label) {
  const imports = collectStaticImportDeclarations(filePath);
  if (!imports.some(importDeclaration =>
    importDeclaration.isRuntime && moduleSpecifierMatches(importDeclaration.moduleSpecifier, expectedSpecifier))) {
    throw new Error(`${label} must have a runtime import of ${expectedSpecifier}`);
  }
}

function runAssemblyEntryReachability(context) {
  const {projected, root} = context;
  const assemblyModuleName = 'assembly.android.pos-desktop';
  if (!projected[assemblyModuleName]) return;
  const assemblyDirectory = moduleNameToPath(assemblyModuleName, root);
  const entryPath = entryFile(assemblyDirectory, 'index.ts', 'index.ts');
  const appPath = entryFile(assemblyDirectory, 'App.tsx', 'App.tsx');
  const bootstrapPath = entryFile(assemblyDirectory, 'src/skeletonBootstrap.ts', 'skeletonBootstrap.ts');

  assertRuntimeImport(entryPath, './App', 'assembly index.ts');
  assertRuntimeImport(appPath, './src/skeletonBootstrap', 'assembly App.tsx');

  const bootstrapImports = collectStaticImportDeclarations(bootstrapPath);
  if (/\b(?:require|import)\s*\(/.test(fs.readFileSync(bootstrapPath, 'utf8'))) {
    throw new Error('assembly skeletonBootstrap.ts must not use dynamic import or require');
  }
  const relativeImports = bootstrapImports
    .map(importDeclaration => importDeclaration.moduleSpecifier)
    .filter(moduleSpecifier => moduleSpecifier.startsWith('.'));
  assertEqualSet('assembly bootstrap local imports', relativeImports, ['./index']);
  const localRootImport = bootstrapImports.find(importDeclaration =>
    importDeclaration.isRuntime && moduleSpecifierMatches(importDeclaration.moduleSpecifier, './index'));
  if (!localRootImport) throw new Error('assembly skeletonBootstrap.ts must runtime-import local ./index');

  const workspaceImports = bootstrapImports.filter(importDeclaration =>
    importDeclaration.moduleSpecifier.startsWith('@catering-v2s/'));
  const workspacePackageNames = workspaceImports.map(importDeclaration => importDeclaration.moduleSpecifier);
  const importedModules = workspacePackageNames.map(packageName => packageNameToModuleName(packageName, context.spec));
  if (importedModules.some(moduleName => !moduleName)) {
    throw new Error(`assembly bootstrap contains a non-root workspace import: ${JSON.stringify(workspacePackageNames)}`);
  }
  if (workspaceImports.some(importDeclaration => !importDeclaration.isRuntime)) {
    throw new Error('assembly bootstrap workspace imports must be runtime imports');
  }
  const expectedDependencies = projected[assemblyModuleName].dependencies;
  assertEqualSet('assembly bootstrap workspace roots', importedModules, expectedDependencies);
  const unexpectedImports = bootstrapImports.filter(importDeclaration =>
    !importDeclaration.moduleSpecifier.startsWith('@catering-v2s/') &&
    !importDeclaration.moduleSpecifier.startsWith('.'));
  if (unexpectedImports.length) {
    throw new Error(`assembly bootstrap has unexpected external imports: ${JSON.stringify(
      unexpectedImports.map(importDeclaration => importDeclaration.moduleSpecifier),
    )}`);
  }

  const reachable = [assemblyModuleName, ...importedModules];
  assertEqualSet('assembly App entry reachable TER package roots', reachable, Object.keys(projected));
}

function runGraphComparison(context) {
  const {spec, projected, root} = context;
  for (const [moduleName, entry] of Object.entries(spec.graph)) {
    for (const dependency of [...entry.dependencies, ...entry.devDependencies]) {
      if (!spec.graph[dependency]) {
        throw new Error(`${moduleName} references unknown workspace module ${dependency}`);
      }
    }
  }
  assertAcyclic(projected);
  const entries = leafPackageEntries(readPackageCensus(root), root);
  if (!entries.length) throw new Error('TER leaf package census is empty at CP-1; package graph is not built yet');
  const expectedNames = Object.keys(projected);
  const actualNames = entries.map(entry => entry.moduleName).filter(Boolean);
  assertEqualSet('active TER package census', actualNames, expectedNames);
  for (const moduleName of expectedNames) {
    const entry = entries.find(candidate => candidate.moduleName === moduleName);
    if (!entry) continue;
    const expected = projected[moduleName];
    assertEqualSet(
      `${moduleName} dependencies`,
      declaredByField(entry.package, 'dependencies', spec),
      expected.dependencies,
    );
    assertEqualSet(
      `${moduleName} devDependencies`,
      declaredByField(entry.package, 'devDependencies', spec),
      expected.devDependencies,
    );
    const declared = declaredWorkspaceDependencies(entry.package, spec);
    const sourceSpecifiers =
      entry.packageDirectory && fs.existsSync(path.join(entry.packageDirectory, 'src'))
        ? collectStaticImportSpecifiers(entry.packageDirectory)
        : [];
    const nonRootWorkspaceImports = sourceSpecifiers.filter(
      value => value.startsWith(packageScope) && !packageNameToModuleName(value, spec),
    );
    if (nonRootWorkspaceImports.length) {
      throw new Error(
        `${moduleName} source contains non-root workspace import(s): ${nonRootWorkspaceImports.join(', ')}`,
      );
    }
    const sourceImports = sourceSpecifiers.map(value => packageNameToModuleName(value, spec)).filter(Boolean);
    assertEqualSet(`${moduleName} source imports`, sourceImports, declared);
  }
  const assembly = projected['assembly.android.pos-desktop'];
  if (assembly) {
    const reachable = new Set();
    const visit = moduleName => {
      if (reachable.has(moduleName)) return;
      reachable.add(moduleName);
      for (const dependency of projected[moduleName]?.dependencies ?? []) visit(dependency);
      for (const dependency of projected[moduleName]?.devDependencies ?? []) visit(dependency);
    };
    visit('assembly.android.pos-desktop');
    assertEqualSet('assembly dependency closure', [...reachable], expectedNames);
  }
  runAssemblyEntryReachability(context);
}

function runTripleNaming(context) {
  const {spec, projected, root} = context;
  for (const moduleName of Object.keys(projected)) {
    const packageDirectory = moduleNameToPath(moduleName, root);
    const packageJsonPath = path.join(packageDirectory, 'package.json');
    if (!fs.existsSync(packageJsonPath)) throw new Error(`missing package.json for ${moduleName}`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (packageJson.name !== moduleNameToPackageName(moduleName)) {
      throw new Error(`${moduleName} package name must be ${moduleNameToPackageName(moduleName)}`);
    }
    const declaredModuleName = readPackageModuleName(packageDirectory, moduleName);
    if (declaredModuleName.moduleName !== moduleName) {
      throw new Error(
        `${moduleName} src/moduleName.ts must export ${moduleName}, got ${declaredModuleName.moduleName}`,
      );
    }
    if (/(?:^|-)v?\d+(?:[.-]|$)/.test(packageJson.name) || /expo|react-native/i.test(packageJson.name)) {
      throw new Error(`${moduleName} package name contains a version or framework name`);
    }
    if (packageJson.plannedKind !== undefined || packageJson.kind !== undefined) {
      throw new Error(`${moduleName} package.json must not carry plannedKind/kind`);
    }
  }
  if (Object.keys(spec.graph).length !== 22)
    throw new Error(`skeleton spec must contain 22 nodes, got ${Object.keys(spec.graph).length}`);
}

function layerFor(moduleName) {
  return moduleName.split('.')[0];
}

function runDependencyDirection(context) {
  const {projected} = context;
  for (const [moduleName, entry] of Object.entries(projected)) {
    for (const dependency of [...entry.dependencies, ...entry.devDependencies]) {
      const dependencyLayer = layerFor(dependency);
      if (moduleName.startsWith('kernel.') && dependencyLayer !== 'kernel') {
        throw new Error(`${moduleName} points outside kernel: ${dependency}`);
      }
      if (moduleName.startsWith('ui.') && dependencyLayer === 'adapter') {
        throw new Error(`${moduleName} may not depend on adapter: ${dependency}`);
      }
      if (moduleName.startsWith('adapter.') && dependency !== 'kernel.base.platform-ports') {
        throw new Error(`${moduleName} may only depend on kernel.base.platform-ports: ${dependency}`);
      }
      if (moduleName.startsWith('assembly.') && dependency === moduleName) {
        throw new Error(`${moduleName} contains a self edge`);
      }
    }
  }
}

function runDependencyDeclarationCompleteness(context) {
  const {projected, root, spec} = context;
  for (const moduleName of Object.keys(projected)) {
    const packageDirectory = moduleNameToPath(moduleName, root);
    const declared = new Set([
      ...declaredByField(
        JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')),
        'dependencies',
        spec,
      ),
      ...declaredByField(
        JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json'), 'utf8')),
        'devDependencies',
        spec,
      ),
    ]);
    for (const packageName of collectStaticImportSpecifiers(packageDirectory)) {
      const importedModule = packageNameToModuleName(packageName, spec);
      if (importedModule && !declared.has(importedModule)) {
        throw new Error(`${moduleName} imports undeclared workspace package ${packageName}`);
      }
    }
  }
}

function runTr01Boundary(context) {
  const {root, projected} = context;
  const allowed = new Set(['kernel.base.runtime', 'kernel.base.state']);
  for (const moduleName of Object.keys(projected)) {
    const packageDirectory = moduleNameToPath(moduleName, root);
    for (const sourcePath of collectSourceFiles(packageDirectory)) {
      const sourceText = fs.readFileSync(sourcePath, 'utf8');
      if (
        /\bdispatchAction\s*\(|\bstore\.dispatch\s*\(|\buseDispatch\s*\(/.test(sourceText) &&
        !allowed.has(moduleName)
      ) {
        throw new Error(`TR-01 reducer call outside whitelist: ${path.relative(root, sourcePath)}`);
      }
    }
  }
}

function collectSourceFiles(packageDirectory) {
  const sourceRoot = path.join(packageDirectory, 'src');
  const result = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) result.push(entryPath);
    }
  }
  visit(sourceRoot);
  return result;
}

function runKernelPlatformIndependence(context) {
  const {root, projected} = context;
  for (const moduleName of Object.keys(projected).filter(name => name.startsWith('kernel.'))) {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(moduleNameToPath(moduleName, root), 'package.json'), 'utf8'),
    );
    const allDependencies = Object.keys(packageJson.dependencies ?? {}).concat(
      Object.keys(packageJson.peerDependencies ?? {}),
    );
    const forbidden = allDependencies.filter(dependency =>
      /^(expo|react|react-native|react-dom)(-|$)/.test(dependency),
    );
    if (forbidden.length) throw new Error(`${moduleName} has forbidden platform dependencies: ${forbidden.join(', ')}`);
    for (const sourcePath of collectSourceFiles(moduleNameToPath(moduleName, root))) {
      const sourceText = fs.readFileSync(sourcePath, 'utf8');
      const staticPlatformImport = collectStaticImportDeclarations(sourcePath).find(importDeclaration =>
        /^(?:expo|react|react-native|react-dom)(?:-|$)/.test(importDeclaration.moduleSpecifier),
      );
      if (
        staticPlatformImport ||
        /import\s*\(\s*['"](?:expo|react|react-native|react-dom)(?:-|['"])/.test(sourceText)
      ) {
        throw new Error(`${moduleName} imports a forbidden platform module in ${path.relative(root, sourcePath)}`);
      }
    }
  }
}

function runScaffoldHygiene(context) {
  const {root, projected} = context;
  const violations = [];
  const ignored = new Set(
    fs
      .readFileSync(path.join(root, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean),
  );
  for (const requiredLine of REQUIRED_IGNORE_LINES)
    if (!ignored.has(requiredLine)) violations.push(`missing .gitignore entry ${requiredLine}`);
  const scaffoldPackages = Object.keys(projected).filter(
    moduleName => moduleName.startsWith('adapter.') || moduleName.startsWith('assembly.'),
  );
  for (const moduleName of scaffoldPackages) {
    const packageRoot = moduleNameToPath(moduleName, root);
    if (!fs.existsSync(packageRoot)) continue;
    for (const forbidden of [
      '.git',
      'node_modules',
      'AGENTS.md',
      'CLAUDE.md',
      '.claude',
      'eslint.config.cjs',
      '.prettierrc',
      'LICENSE',
    ]) {
      if (fs.existsSync(path.join(packageRoot, forbidden)))
        violations.push(`scaffold metadata remains: ${path.relative(root, path.join(packageRoot, forbidden))}`);
    }
  }
  if (violations.length) throw new Error(violations.join('; '));
}

export function runStaticChecks({root = repoRoot, batch} = {}) {
  const spec = readSkeletonSpec(path.join(root, 'apps/terminal/skeleton-graph.ts'));
  const projected = projectSkeletonGraph(spec, batch ?? spec.activeBatch);
  const context = {root, terminalRoot: path.join(root, 'apps/terminal'), spec, projected};
  const checks = [
    ['graph-comparison', () => runGraphComparison(context)],
    ['triple-naming', () => runTripleNaming(context)],
    ['dependency-direction', () => runDependencyDirection(context)],
    ['dependency-declaration-completeness', () => runDependencyDeclarationCompleteness(context)],
    ['tr01-reducer-boundary', () => runTr01Boundary(context)],
    ['kernel-platform-independence', () => runKernelPlatformIndependence(context)],
  ];
  const results = [];
  for (const [name, check] of checks) {
    try {
      check();
      results.push({name, status: 'PASS'});
    } catch (error) {
      results.push({name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)});
    }
  }
  let hygiene;
  try {
    runScaffoldHygiene(context);
    hygiene = {status: 'PASS'};
  } catch (error) {
    hygiene = {status: 'FAIL', error: error instanceof Error ? error.message : String(error)};
  }
  return {activeBatch: spec.activeBatch, projectedCount: Object.keys(projected).length, results, hygiene};
}

function printUsage() {
  console.log('Usage: node tools/terminal-skeleton/check-static.mjs [--help]');
  console.log('Runs six TER static rule gates and one separately reported scaffold hygiene check.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const report = runStaticChecks();
  console.log(`RULE_GATES=${RULE_NAMES.length}`);
  console.log(`SUPPORT_CHECKS=${SUPPORT_CHECK_COUNT}`);
  for (const result of report.results) {
    console.log(`RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`);
    if (result.error) console.error(`FIRST_FAILURE:${result.name}:${result.error}`);
  }
  console.log(`SCAFFOLD_HYGIENE=${report.hygiene.status}`);
  if (report.hygiene.error) console.error(`HYGIENE_FAILURE:${report.hygiene.error}`);
  if (report.results.some(result => result.status !== 'PASS') || report.hygiene.status !== 'PASS') process.exit(1);
}
