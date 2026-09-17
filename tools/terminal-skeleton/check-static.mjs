import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {readPackageInvariant} from '../terminal-shared/package-invariants.mjs';
import {assertClosedUnionConsumers} from '../terminal-shared/closed-union-consumers.mjs';
import {
  createAnalysisProgram,
  resolveAliasedSymbol,
  resolveValueExpressionSymbol,
} from '../terminal-shared/typescript-analysis.mjs';
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
  collectBoundaryImportCapabilities,
} from './graph-model.mjs';

export const RULE_NAMES = Object.freeze([
  'graph-comparison',
  'triple-naming',
  'dependency-direction',
  'dependency-declaration-completeness',
  'runtime-dependency-contract',
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

function isWithin(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function packageRecordForPath(packageRecords, candidatePath) {
  return [...packageRecords]
    .filter(entry => isWithin(entry.packageDirectory, candidatePath))
    .sort((left, right) => right.packageDirectory.length - left.packageDirectory.length)[0];
}

function modulePackageRecords(root) {
  return leafPackageEntries(readPackageCensus(root), root).filter(entry => entry.moduleName);
}

function packageRecordByName(packageRecords) {
  return new Map(packageRecords.map(entry => [entry.package.name, entry]));
}

function boundaryTargetPackage(packageRecords, byName, filePath, moduleSpecifier, spec) {
  if (moduleSpecifier.startsWith(packageScope)) {
    return byName.get(moduleSpecifier) ?? packageRecords.find(entry =>
      entry.moduleName === packageNameToModuleName(moduleSpecifier, spec));
  }
  if (!moduleSpecifier.startsWith('.')) return undefined;
  return packageRecordForPath(packageRecords, path.resolve(path.dirname(filePath), moduleSpecifier));
}

function boundaryTsconfigFiles(packageDirectory) {
  const files = [];
  const visit = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.git', 'build', 'dist', '.turbo', '.expo', '.runtime', '.gradle', '.kotlin', '.vite', 'coverage'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /^tsconfig(?:\..+)?\.json$/.test(entry.name)) files.push(entryPath);
    }
  };
  visit(packageDirectory);
  return files.sort();
}

function boundaryTsconfigValues(tsconfig) {
  const values = [];
  for (const reference of tsconfig.references ?? []) {
    if (reference && typeof reference.path === 'string') values.push(reference.path);
  }
  const paths = tsconfig.compilerOptions?.paths;
  if (paths && typeof paths === 'object') {
    for (const targets of Object.values(paths)) {
      if (Array.isArray(targets)) {
        for (const target of targets) if (typeof target === 'string') values.push(target);
      }
    }
  }
  return values;
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

function unwrapStaticExpression(expression) {
  let current = expression;
  while (
    ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isSatisfiesExpression(current)
    || ts.isParenthesizedExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function isExportedVariableStatement(statement) {
  return statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) === true;
}

function readExportedArrayInitializer(filePath, exportName) {
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !isExportedVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== exportName) continue;
      if (!declaration.initializer) throw new Error(`${filePath} ${exportName} must have an initializer`);
      const initializer = unwrapStaticExpression(declaration.initializer);
      if (!ts.isArrayLiteralExpression(initializer)) {
        throw new Error(`${filePath} ${exportName} must be a literal array`);
      }
      return {sourceFile, initializer};
    }
  }
  return {sourceFile, initializer: null};
}

function readModuleNameImports(sourceFile, spec) {
  const bindings = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (statement.importClause?.isTypeOnly === true) continue;
    if (!statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
    const importedModuleName = packageNameToModuleName(statement.moduleSpecifier.text, spec);
    if (!importedModuleName) continue;
    for (const element of statement.importClause.namedBindings.elements) {
      const importedName = element.propertyName?.text ?? element.name.text;
      if (importedName === 'moduleName') bindings.set(element.name.text, importedModuleName);
    }
  }
  return bindings;
}

function readDependencyArray(filePath, exportName, spec) {
  const {sourceFile, initializer} = readExportedArrayInitializer(filePath, exportName);
  if (initializer === null) return null;
  const moduleNameImports = readModuleNameImports(sourceFile, spec);
  const values = [];
  for (const element of initializer.elements) {
    const value = unwrapStaticExpression(element);
    if (!ts.isIdentifier(value) || !moduleNameImports.has(value.text)) {
      throw new Error(
        `${filePath} ${exportName} must contain only imported moduleName bindings; opaque expression ${value.getText(sourceFile)}`,
      );
    }
    values.push(moduleNameImports.get(value.text));
  }
  return values;
}

function readDeclaredModuleKind(packageDirectory) {
  const filePath = path.join(packageDirectory, 'src/moduleName.ts');
  if (!fs.existsSync(filePath)) throw new Error(`${packageDirectory} src/moduleName.ts is missing`);
  const sourceFile = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !isExportedVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'moduleKind') continue;
      if (!declaration.initializer) throw new Error(`${filePath} moduleKind must have an initializer`);
      const value = unwrapStaticExpression(declaration.initializer);
      if (!ts.isStringLiteral(value) || !['owner', 'toolkit'].includes(value.text)) {
        throw new Error(`${filePath} moduleKind must be the literal owner or toolkit`);
      }
      return value.text;
    }
  }
  return null;
}

function listProductionSourceFiles(directory) {
  const files = [];
  const visit = currentDirectory => {
    for (const entry of fs.readdirSync(currentDirectory, {withFileTypes: true})) {
      const filePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === 'dist') continue;
        visit(filePath);
      } else if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        files.push(filePath);
      }
    }
  };
  visit(directory);
  return files;
}

function expressionContainsIdentifier(expression, identifierName) {
  let found = false;
  const visit = node => {
    if (found) return;
    if (ts.isIdentifier(node) && node.text === identifierName) {
      found = true;
      return;
    }
    node.forEachChild(visit);
  };
  visit(expression);
  return found;
}

function hasRuntimeDeclarationConsumption(packageDirectory) {
  const dependenciesPath = path.join(packageDirectory, 'src/dependencies.ts');
  for (const filePath of listProductionSourceFiles(path.join(packageDirectory, 'src'))) {
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const localNames = [];
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      if (statement.importClause?.isTypeOnly === true) continue;
      if (!statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) continue;
      const importedPath = path.resolve(path.dirname(filePath), statement.moduleSpecifier.text);
      if (importedPath !== dependenciesPath && `${importedPath}.ts` !== dependenciesPath) continue;
      for (const element of statement.importClause.namedBindings.elements) {
        const importedName = element.propertyName?.text ?? element.name.text;
        if (importedName === 'runtimeModuleDependencyNames') localNames.push(element.name.text);
      }
    }
    if (!localNames.length) continue;
    let consumed = false;
    const visit = node => {
      if (consumed) return;
      if (ts.isPropertyAssignment(node)) {
        const propertyName = node.name;
        const isDependenciesProperty =
          (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName))
          && propertyName.text === 'dependencies';
        if (isDependenciesProperty) {
          const initializer = node.initializer;
          const isRuntimeArrayMap = ts.isCallExpression(initializer)
            && ts.isPropertyAccessExpression(initializer.expression)
            && initializer.expression.name.text === 'map'
            && ts.isIdentifier(initializer.expression.expression)
            && localNames.includes(initializer.expression.expression.text)
            && initializer.arguments.length === 1;
          if (isRuntimeArrayMap) {
            const callback = initializer.arguments[0];
            const callbackBody = ts.isArrowFunction(callback)
              ? callback.body
              : undefined;
            const returnedObject = callbackBody === undefined
              ? undefined
              : ts.isParenthesizedExpression(callbackBody)
                ? callbackBody.expression
                : callbackBody;
            const callbackParameter = ts.isArrowFunction(callback)
              && callback.parameters.length === 1
              && ts.isIdentifier(callback.parameters[0].name)
                ? callback.parameters[0].name.text
                : undefined;
            const properties = returnedObject !== undefined && ts.isObjectLiteralExpression(returnedObject)
              ? returnedObject.properties
              : undefined;
            const strictDescriptor = callbackParameter !== undefined
              && properties !== undefined
              && properties.length === 1
              && ts.isPropertyAssignment(properties[0])
              && (ts.isIdentifier(properties[0].name) || ts.isStringLiteral(properties[0].name))
              && properties[0].name.text === 'moduleName'
              && ts.isIdentifier(properties[0].initializer)
              && properties[0].initializer.text === callbackParameter;
            if (strictDescriptor) {
              consumed = true;
              return;
            }
            throw new Error(`${filePath} dependencies must map runtimeModuleDependencyNames to exact {moduleName} descriptors without optional/opaque fields`);
          }
          if (expressionContainsIdentifier(initializer, localNames[0])) {
            throw new Error(`${filePath} dependencies must directly map runtimeModuleDependencyNames to exact {moduleName} descriptors`);
          }
        }
      }
      node.forEachChild(visit);
    };
    visit(sourceFile);
    if (consumed) return true;
  }
  return false;
}

function runRuntimeDependencyContract(context) {
  const {projected, root, spec} = context;
  for (const moduleName of Object.keys(projected)) {
    const packageDirectory = moduleNameToPath(moduleName, root);
    const packageJsonPath = path.join(packageDirectory, 'package.json');
    const dependenciesPath = path.join(packageDirectory, 'src/dependencies.ts');
    if (!fs.existsSync(dependenciesPath)) throw new Error(`${moduleName} src/dependencies.ts is missing`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const dependencyNames = readDependencyArray(dependenciesPath, 'dependencyModuleNames', spec);
    const devDependencyNames = readDependencyArray(dependenciesPath, 'devDependencyModuleNames', spec);
    if (dependencyNames === null || devDependencyNames === null) {
      throw new Error(`${moduleName} must export dependencyModuleNames and devDependencyModuleNames literal arrays`);
    }
    if (new Set(dependencyNames).size !== dependencyNames.length) {
      throw new Error(`${moduleName} dependencyModuleNames contains duplicate module names`);
    }
    if (new Set(devDependencyNames).size !== devDependencyNames.length) {
      throw new Error(`${moduleName} devDependencyModuleNames contains duplicate module names`);
    }
    assertEqualSet(
      `${moduleName} dependencyModuleNames`,
      dependencyNames,
      declaredByField(packageJson, 'dependencies', spec),
    );
    assertEqualSet(
      `${moduleName} devDependencyModuleNames`,
      devDependencyNames,
      declaredByField(packageJson, 'devDependencies', spec),
    );

    const declaredKind = readDeclaredModuleKind(packageDirectory);
    const runtimeNames = readDependencyArray(dependenciesPath, 'runtimeModuleDependencyNames', spec);
    if (declaredKind !== 'owner') {
      if (runtimeNames !== null && runtimeNames.length) {
        throw new Error(`${moduleName} non-owner package may not declare runtime module dependencies`);
      }
      continue;
    }
    const expectedRuntimeNames = dependencyNames.filter(dependency =>
      readDeclaredModuleKind(moduleNameToPath(dependency, root)) === 'owner',
    );
    if (runtimeNames === null) {
      throw new Error(`${moduleName} owner package must export runtimeModuleDependencyNames`);
    }
    if (new Set(runtimeNames).size !== runtimeNames.length) {
      throw new Error(`${moduleName} runtimeModuleDependencyNames contains duplicate module names`);
    }
    assertEqualSet(
      `${moduleName} runtimeModuleDependencyNames`,
      runtimeNames,
      expectedRuntimeNames,
    );
    if (runtimeNames.length && !hasRuntimeDeclarationConsumption(packageDirectory)) {
      throw new Error(`${moduleName} runtimeModuleDependencyNames is not consumed by a production RuntimeModule dependencies property`);
    }
  }
}

function plannedWorkspaceDependencies(packageJson, spec) {
  const planned = packageJson.plannedDependencies ?? [];
  if (!Array.isArray(planned) || planned.some(packageName => typeof packageName !== 'string')) {
    throw new Error('package.json plannedDependencies must be a string array');
  }
  return sorted(planned.map(packageName => {
    const moduleName = packageNameToModuleName(packageName, spec);
    if (!moduleName) throw new Error(`planned dependency is not a TER workspace package: ${packageName}`);
    return moduleName;
  }));
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
  const assemblyModuleNames = Object.keys(projected)
    .filter(moduleName => {
      const [layer, tier] = moduleName.split('.');
      return layer === 'assembly' && tier !== 'base';
    })
    .sort();
  if (!assemblyModuleNames.length) {
    throw new Error('no non-base assembly App entry was discovered');
  }
  for (const assemblyModuleName of assemblyModuleNames) {
    const assemblyDirectory = moduleNameToPath(assemblyModuleName, root);
    const entryPath = entryFile(assemblyDirectory, 'index.ts', `${assemblyModuleName} index.ts`);
    const appPath = entryFile(assemblyDirectory, 'App.tsx', `${assemblyModuleName} App.tsx`);
    const platformPortsPath = entryFile(
      assemblyDirectory,
      'src/assembly/platformPorts.ts',
      `${assemblyModuleName} assembly/platformPorts.ts`,
    );

    assertRuntimeImport(entryPath, './App', `${assemblyModuleName} index.ts`);
    assertRuntimeImport(appPath, './src/assembly/platformPorts', `${assemblyModuleName} App.tsx`);

    const appSource = fs.readFileSync(appPath, 'utf8');
    if (/skeletonBootstrap|bootstrapSession|bootstrapRuntime/.test(appSource)) {
      throw new Error(`${assemblyModuleName} App.tsx must not contain bootstrap wiring`);
    }
    if (/\b(?:require|import)\s*\(/.test(appSource)) {
      throw new Error(`${assemblyModuleName} App.tsx must not use dynamic import or require`);
    }

    const platformPortsSource = fs.readFileSync(platformPortsPath, 'utf8');
    if (/\b(?:require|import)\s*\(/.test(platformPortsSource)) {
      throw new Error(`${assemblyModuleName} platformPorts.ts must not use dynamic import or require`);
    }
  }
}

function workspacePatternMatches(pattern, relativePath) {
  const patternSegments = pattern.replace(/^\.\//, '').split('/').filter(Boolean);
  const pathSegments = relativePath.split('/').filter(Boolean);
  const match = (patternIndex, pathIndex) => {
    if (patternIndex === patternSegments.length) return pathIndex === pathSegments.length;
    const segment = patternSegments[patternIndex];
    if (segment === '**') {
      return match(patternIndex + 1, pathIndex)
        || (pathIndex < pathSegments.length && match(patternIndex, pathIndex + 1));
    }
    if (pathIndex === pathSegments.length) return false;
    if (segment !== '*' && segment !== pathSegments[pathIndex]) return false;
    return match(patternIndex + 1, pathIndex + 1);
  };
  return match(0, 0);
}

function runRootWorkspaceEnumeration(root) {
  const rootPackagePath = path.join(root, 'package.json');
  if (!fs.existsSync(rootPackagePath)) throw new Error('root package.json is missing');
  const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
  const declaredWorkspaces = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : rootPackage.workspaces && Array.isArray(rootPackage.workspaces.packages)
      ? rootPackage.workspaces.packages
      : null;
  if (declaredWorkspaces === null || declaredWorkspaces.some(pattern => typeof pattern !== 'string')) {
    throw new Error('root package.json workspaces must be a string array or {packages: string[]}');
  }
  const patterns = declaredWorkspaces.filter(pattern => !pattern.startsWith('!'));
  const packageEntries = readPackageCensus(root).filter(entry => {
    if (entry.relativePath === 'apps/terminal') return true;
    const relative = path.relative(path.join(root, 'apps/terminal'), entry.packageDirectory);
    return relative && !relative.startsWith('..') && relative.split(path.sep).length === 3;
  });
  if (!packageEntries.length) throw new Error('TER workspace package census is empty');
  const uncovered = packageEntries
    .map(entry => entry.relativePath.split(path.sep).join('/'))
    .filter(relativePath => !patterns.some(pattern => workspacePatternMatches(pattern, relativePath)));
  if (uncovered.length) {
    throw new Error(`root workspace enumeration misses TER package(s): ${JSON.stringify(sorted(uncovered))}`);
  }
}

function runGraphComparison(context) {
  const {spec, projected, root} = context;
  runRootWorkspaceEnumeration(root);
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
      expected.dependencies.filter(dependency => !plannedWorkspaceDependencies(entry.package, spec).includes(dependency)),
    );
    assertEqualSet(
      `${moduleName} plannedDependencies`,
      plannedWorkspaceDependencies(entry.package, spec),
      expected.dependencies.filter(dependency => plannedWorkspaceDependencies(entry.package, spec).includes(dependency)),
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
  runAssemblyEntryReachability(context);
  // The package-local invariant files own the closed-union denominator.  Do
  // not freeze the migration-time 9/22 totals here: a later owner package may
  // add or remove a legitimate consumer and must update its own invariant
  // without changing this checker.
  assertClosedUnionConsumers(root);
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
  if (Object.keys(spec.graph).length !== 33)
    throw new Error(`skeleton spec must contain 33 nodes, got ${Object.keys(spec.graph).length}`);
}

function layerFor(moduleName) {
  return moduleName.split('.')[0];
}

function baseGraphDependencyViolation(sourceModuleName, targetModuleName) {
  const sourceSegments = sourceModuleName.split('.');
  if (!targetModuleName) return null;
  const targetSegments = targetModuleName.split('.');
  if (sourceSegments[1] !== 'base') return null;
  if (targetSegments[1] === 'feature' || targetSegments[1] === 'integration') {
    return `${sourceModuleName} may not depend on ${targetModuleName}`;
  }
  if (targetSegments[0] === 'assembly' && targetSegments[1] !== 'base') {
    return `${sourceModuleName} may not depend on App package ${targetModuleName}`;
  }
  if (sourceSegments[0] === 'assembly' && targetSegments[0] === 'adapter'
    && sourceSegments[2] !== targetSegments[1]) {
    return `${sourceModuleName} may only depend on same-platform adapter ${targetModuleName}`;
  }
  return null;
}

function assemblyAdapterDependencyViolation(sourceModuleName, targetModuleName) {
  if (!targetModuleName) return null;
  const sourceSegments = sourceModuleName.split('.');
  const targetSegments = targetModuleName.split('.');
  if (sourceSegments[0] === 'assembly' && sourceSegments[1] !== 'base' && targetSegments[0] === 'adapter') {
    return `${sourceModuleName} may not depend on adapter ${targetModuleName}`;
  }
  return null;
}

function sourceDependencyViolation(sourceModuleName, targetModuleName) {
  return baseGraphDependencyViolation(sourceModuleName, targetModuleName)
    ?? assemblyAdapterDependencyViolation(sourceModuleName, targetModuleName);
}

function sourceLine(node, sourceFile) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function throwBoundaryViolation(root, violation, filePath, line, shape) {
  throw new Error(`${violation} via ${shape} at ${path.relative(root, filePath).split(path.sep).join('/')}:${line}`);
}

function runBaseSourceDependencyBoundary(context) {
  const {root, projected, spec} = context;
  const packageRecords = modulePackageRecords(root);
  const packageByName = packageRecordByName(packageRecords);
  for (const sourcePackage of packageRecords.filter(entry => {
    const [layer, tier] = entry.moduleName.split('.');
    return projected[entry.moduleName] && (tier === 'base' || layer === 'assembly');
  })) {
    const sourceModuleName = sourcePackage.moduleName;
    const inspectTarget = (targetPackage, filePath, line, shape) => {
      const violation = sourceDependencyViolation(sourceModuleName, targetPackage?.moduleName);
      if (violation !== null) throwBoundaryViolation(root, violation, filePath, line, shape);
    };

    const packageJsonPath = path.join(sourcePackage.packageDirectory, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
      for (const packageName of Object.keys(packageJson[field] ?? {})) {
        inspectTarget(packageByName.get(packageName), packageJsonPath, 1, `package.json ${field} (${packageName})`);
      }
    }

    for (const tsconfigPath of boundaryTsconfigFiles(sourcePackage.packageDirectory)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
      for (const value of boundaryTsconfigValues(tsconfig)) {
        const targetPackage = value.startsWith(packageScope)
          ? packageByName.get(value)
          : packageRecordForPath(
            packageRecords,
            path.resolve(path.dirname(tsconfigPath), value.replace(/\*.*$/, '')),
          );
        inspectTarget(targetPackage, tsconfigPath, 1, `tsconfig path/reference (${value})`);
      }
    }

    for (const {filePath, sourceFile, ...capability} of collectBoundaryImportCapabilities(sourcePackage.packageDirectory)) {
      const targetPackage = boundaryTargetPackage(
        packageRecords,
        packageByName,
        filePath,
        capability.moduleName,
        spec,
      );
      inspectTarget(
        targetPackage,
        filePath,
        sourceLine(capability.node, sourceFile),
        `${capability.kind} (${capability.moduleName})`,
      );
    }
  }
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
      const sourceViolation = sourceDependencyViolation(moduleName, dependency);
      if (sourceViolation !== null) throw new Error(sourceViolation);
    }
  }
  runBaseSourceDependencyBoundary(context);
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

function hasAncestorTypeAlias(node, aliasName) {
  let current = node.parent;
  while (current) {
    if (ts.isTypeAliasDeclaration(current) && current.name.text === aliasName) return true;
    current = current.parent;
  }
  return false;
}

function isActorDispatchProperty(checker, symbol) {
  const resolved = symbol ? resolveAliasedSymbol(checker, symbol) : null;
  return Boolean(
    resolved?.name === 'dispatchAction'
      && resolved.declarations?.some(declaration =>
        ts.isPropertySignature(declaration)
        && hasAncestorTypeAlias(declaration, 'ActorExecutionContext'),
      ),
  );
}

function resolveElementAccessProperty(checker, expression) {
  if (!ts.isElementAccessExpression(expression)) return null;
  const argument = expression.argumentExpression;
  if (!argument || (!ts.isStringLiteral(argument) && !ts.isNoSubstitutionTemplateLiteral(argument))) return null;
  const receiverType = checker.getTypeAtLocation(expression.expression);
  return checker.getPropertyOfType(receiverType, argument.text) ?? null;
}

function resolvesToActorDispatch(checker, expression) {
  if (!expression) return false;
  const elementProperty = resolveElementAccessProperty(checker, expression);
  if (elementProperty && isActorDispatchProperty(checker, elementProperty)) return true;
  const symbol = resolveValueExpressionSymbol(checker, expression);
  return isActorDispatchProperty(checker, symbol);
}

function declarationIsFromPackage(declaration, packageName) {
  const fileName = declaration?.getSourceFile?.().fileName?.split(path.sep).join('/') ?? '';
  return fileName.includes(`/node_modules/${packageName}/`);
}

function isReduxStoreType(checker, type, seen = new Set()) {
  if (!type || seen.has(type)) return false;
  seen.add(type);

  const symbols = [type.aliasSymbol, type.symbol]
    .filter(Boolean)
    .map(symbol => resolveAliasedSymbol(checker, symbol));
  if (symbols.some(symbol =>
    (symbol?.name === 'Store' && symbol.declarations?.some(declaration => declarationIsFromPackage(declaration, 'redux')))
      || (symbol?.name === 'EnhancedStore' && symbol.declarations?.some(declaration => declarationIsFromPackage(declaration, '@reduxjs/toolkit'))),
  )) {
    return true;
  }

  if (type.types?.some(candidate => isReduxStoreType(checker, candidate, seen))) return true;
  if (type.intersectionTypes?.some(candidate => isReduxStoreType(checker, candidate, seen))) return true;
  if (typeof type.getBaseTypes === 'function'
    && type.getBaseTypes()?.some(candidate => isReduxStoreType(checker, candidate, seen))) return true;
  const apparent = checker.getApparentType(type);
  return apparent !== type && isReduxStoreType(checker, apparent, seen);
}

function isStoreDispatchProperty(checker, expression) {
  if (!ts.isPropertyAccessExpression(expression) && !ts.isElementAccessExpression(expression)) return false;
  const propertyName = ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : (ts.isStringLiteral(expression.argumentExpression) || ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
      ? expression.argumentExpression.text
      : null;
  if (propertyName !== 'dispatch') return false;
  return isReduxStoreType(checker, checker.getTypeAtLocation(expression.expression));
}

function tr01ExceptionKey(exception) {
  return [exception.sourceFile, exception.declarationId, exception.dispatchExpression, exception.reasonCategory].join('\u0000');
}

function tr01ExceptionBaseKey(exception) {
  return [exception.sourceFile, exception.declarationId, exception.dispatchExpression].join('\u0000');
}

function runTr01Boundary(context) {
  const {root, projected} = context;
  const analysis = createAnalysisProgram(root);
  const checker = analysis.program.getTypeChecker();
  const actorPath = /(?:^|[\\/])features[\\/]actors[\\/]/;
  const packageExceptions = new Map();
  for (const moduleName of Object.keys(projected)) {
    const packageDirectory = moduleNameToPath(moduleName, root);
    const packageName = moduleNameToPackageName(moduleName);
    const invariantPath = path.join(packageDirectory, 'terminal-invariants.json');
    const exceptions = fs.existsSync(invariantPath)
      ? readPackageInvariant(packageDirectory, packageName).tr01Exceptions ?? []
      : [];
    packageExceptions.set(moduleName, exceptions);
    for (const sourcePath of collectSourceFiles(packageDirectory)) {
      const sourceText = fs.readFileSync(sourcePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        sourcePath,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        sourcePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const relativeSource = path.relative(packageDirectory, sourcePath).split(path.sep).join('/');
      const sourceExceptions = exceptions.filter(item => item.sourceFile === relativeSource);
      const exceptionBuckets = new Map();
      for (const exception of sourceExceptions) {
        const key = tr01ExceptionKey(exception);
        const bucketKey = tr01ExceptionBaseKey(exception);
        if (exceptionBuckets.has(key)) {
          throw new Error(`TR-01 duplicate exception declaration: ${relativeSource}:${exception.declarationId}:${exception.dispatchExpression}:${exception.reasonCategory}`);
        }
        const bucket = exceptionBuckets.get(bucketKey) ?? [];
        bucket.push(exception);
        exceptionBuckets.set(bucketKey, bucket);
      }
      for (const bucket of exceptionBuckets.values()) {
        bucket.sort((left, right) => left.reasonCategory.localeCompare(right.reasonCategory));
      }
      const exceptionOccurrences = new Map();
      const consumedExceptions = new Set();
      const typedSourceFile = analysis.program.getSourceFile(sourcePath);
      const isRuntimeFactorySymbol = (identifier, expectedName) => {
        if (!typedSourceFile || identifier.text !== expectedName) return false;
        const symbol = checker.getSymbolAtLocation(identifier);
        const resolved = symbol ? resolveAliasedSymbol(checker, symbol) : null;
        return Boolean(resolved?.declarations?.some(declaration =>
          path.basename(declaration.getSourceFile().fileName) === 'defineActor.ts'
          && declaration.name?.text === expectedName,
        ));
      };
      const actorFactoryNames = new Set();
      const scanActorQualification = node => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
          && (node.expression.text === 'defineActor' || node.expression.text === 'onCommand')
          && isRuntimeFactorySymbol(node.expression, node.expression.text)) {
          actorFactoryNames.add(node.expression.text);
        }
        ts.forEachChild(node, scanActorQualification);
      };
      // Resolve actor factories from the same AST nodes owned by the TypeScript
      // Program.  Nodes parsed separately with createSourceFile have no
      // checker symbols, so using them here would silently de-qualify every
      // real actor even when its imports resolve correctly.
      scanActorQualification(typedSourceFile ?? sourceFile);
      const qualificationSource = typedSourceFile ?? sourceFile;
      const exportedActorDefinition = qualificationSource.statements.some(statement => {
        if (!ts.isVariableStatement(statement) || !statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
          return false;
        }
        return statement.declarationList.declarations.some(declaration => {
          const type = declaration.type;
          if (!type || !ts.isTypeReferenceNode(type) || !ts.isIdentifier(type.typeName) || type.typeName.text !== 'ActorDefinition') return false;
          const symbol = checker.getSymbolAtLocation(type.typeName);
          const resolved = symbol ? resolveAliasedSymbol(checker, symbol) : null;
          return Boolean(resolved?.declarations?.some(candidate =>
            path.basename(candidate.getSourceFile().fileName) === 'actor.ts'
            && candidate.name?.text === 'ActorDefinition',
          ));
        });
      });
      const isActorSource = actorPath.test(relativeSource)
        && (exportedActorDefinition || (actorFactoryNames.has('defineActor') && actorFactoryNames.has('onCommand')));
      const scopeStack = [];
      const scanSource = typedSourceFile ?? sourceFile;
      const functionScopeName = node => {
        if (ts.isFunctionDeclaration(node) && node.name) return node.name.text;
        let parent = node.parent;
        while (parent) {
          if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
          if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) {
            return parent.name.text;
          }
          if (ts.isStatement(parent) || ts.isSourceFile(parent)) break;
          parent = parent.parent;
        }
        return null;
      };
      const visit = (node, insideOnCommandHandler = false) => {
        let nextInsideHandler = insideOnCommandHandler;
        let pushedScope = false;
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'onCommand') {
          const handler = node.arguments[1];
          if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler))) {
            const body = handler.body;
            const visitHandler = child => visit(child, true);
            if (body) ts.forEachChild(body, visitHandler);
            return;
          }
        }
        if (ts.isFunctionDeclaration(node) && node.name) {
          scopeStack.push(node.name.text);
          pushedScope = true;
        } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
          && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
          scopeStack.push(node.name.text);
          pushedScope = true;
        } else if ((ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && functionScopeName(node)) {
          scopeStack.push(functionScopeName(node));
          pushedScope = true;
        }
        if (ts.isCallExpression(node)) {
          const expression = node.expression;
          const dispatchExpression = ts.isPropertyAccessExpression(expression)
            ? expression.getText(scanSource)
            : ts.isElementAccessExpression(expression)
              ? expression.getText(scanSource)
              : ts.isIdentifier(expression) ? expression.text : null;
          const actorDispatchCall = resolvesToActorDispatch(checker, expression);
          const propertyName = ts.isPropertyAccessExpression(expression)
            ? expression.name.text
            : ts.isElementAccessExpression(expression)
              && (ts.isStringLiteral(expression.argumentExpression)
                || ts.isNoSubstitutionTemplateLiteral(expression.argumentExpression))
              ? expression.argumentExpression.text
              : ts.isIdentifier(expression) ? expression.text : null;
          const receiver = ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)
            ? expression.expression
            : null;
          const globalLikeReceiver = Boolean(receiver && ts.isIdentifier(receiver))
            && (receiver.text === 'globalThis' || receiver.text === 'window');
          const namedDispatchCall = propertyName === 'dispatchAction' && !globalLikeReceiver;
          const isReducerCall = actorDispatchCall
            || namedDispatchCall
            || propertyName === 'useDispatch'
            || isStoreDispatchProperty(checker, expression);
          if (isReducerCall) {
            const matchingExceptionCandidates = sourceExceptions.filter(item =>
              item.dispatchExpression === dispatchExpression
              && scopeStack.includes(item.declarationId),
            );
            const matchingExceptionBaseKey = matchingExceptionCandidates.length > 0
              ? tr01ExceptionBaseKey(matchingExceptionCandidates[0])
              : null;
            const occurrence = matchingExceptionBaseKey === null
              ? 0
              : (exceptionOccurrences.get(matchingExceptionBaseKey) ?? 0);
            if (matchingExceptionBaseKey !== null) {
              exceptionOccurrences.set(matchingExceptionBaseKey, occurrence + 1);
            }
            const matchingException = matchingExceptionBaseKey === null
              ? undefined
              : exceptionBuckets.get(matchingExceptionBaseKey)?.[occurrence];
            if (matchingException) consumedExceptions.add(tr01ExceptionKey(matchingException));
            const actorAllowed = actorDispatchCall && isActorSource && insideOnCommandHandler;
            if (!matchingException && !actorAllowed) {
              const lineSource = node.getSourceFile();
              throw new Error(
                `TR-01 reducer call outside actor handler/declared exception: ${path.relative(root, sourcePath)}:${lineSource.getLineAndCharacterOfPosition(node.getStart(lineSource)).line + 1}`,
              );
            }
          }
          // Passing the actor context's dispatch function to a helper crosses
          // the lexical handler boundary and is intentionally rejected.  It
          // is the finite machine-checkable form of the D-3 rule; deeper
          // inter-file data flow remains an independent semantic review item.
          if (!insideOnCommandHandler || isActorSource) {
            const isOnCommandCall = ts.isIdentifier(expression) && expression.text === 'onCommand';
            if (!isOnCommandCall && node.arguments.some(argument => resolvesToActorDispatch(checker, argument))) {
              const lineSource = node.getSourceFile();
              throw new Error(
                `TR-01 actor dispatchAction passed to helper: ${path.relative(root, sourcePath)}:${lineSource.getLineAndCharacterOfPosition(node.getStart(lineSource)).line + 1}`,
              );
            }
          }
        }
        ts.forEachChild(node, child => visit(child, nextInsideHandler));
        if (pushedScope) scopeStack.pop();
      };
      visit(scanSource);
      for (const exception of sourceExceptions) {
        if (!consumedExceptions.has(tr01ExceptionKey(exception))) {
          throw new Error(
            `TR-01 exception not consumed: ${relativeSource}:${exception.declarationId}:${exception.dispatchExpression}:${exception.reasonCategory}`,
          );
        }
      }
    }
  }
  void packageExceptions;
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
    ['runtime-dependency-contract', () => runRuntimeDependencyContract(context)],
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
  console.log('Runs seven TER static rule gates and one separately reported scaffold hygiene check.');
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
