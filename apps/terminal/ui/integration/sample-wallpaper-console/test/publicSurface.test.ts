import * as ts from 'typescript';
import {existsSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';
import packageJson from '../package.json';
import invariant from '../terminal-invariants.json';

type ImportBinding = Readonly<{name: string; typeOnly: boolean}>;
type ImportRecord = Readonly<{
  moduleSpecifier: string;
  sideEffectOnly: boolean;
  bindings: readonly ImportBinding[];
}>;

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const packageName = '@catering-v2s/ui-integration-sample-wallpaper-console';
const cssSubpath = packageName + '/theme/global.css';
const terminalUpdateFixtureSpecifier =
  /(?:kernel-base-terminal-update\/testing|(?:^|\/)terminalUpdateFixture(?:\.[^/]*)?)$/u;
type ProductionModule = Readonly<{filePath: string; moduleSpecifiers: readonly string[]}>;

const sourceFiles = (root: string): readonly string[] => {
  if (!existsSync(root)) return [];
  return readdirSync(root, {withFileTypes: true}).flatMap(entry => {
    const entryPath = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && /\.tsx?$/u.test(entry.name) ? [entryPath] : [];
  });
};

const moduleSpecifiers = (filePath: string): readonly string[] => {
  const sourceFile = readSourceFile(filePath);
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      values.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      values.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
};

const isTerminalUpdateTestFixture = (specifier: string): boolean =>
  terminalUpdateFixtureSpecifier.test(specifier);

const productionSourceRoots = (): readonly string[] => {
  const consoleIntegrationRoot = fileURLToPath(new URL('../../sample-console/', import.meta.url));
  const wallpaperIntegrationRoot = fileURLToPath(new URL('../', import.meta.url));
  const consoleRoot = fileURLToPath(new URL('../../../../application/android/sample-terminal/', import.meta.url));
  const wallpaperRoot = fileURLToPath(
    new URL('../../../../application/android/sample-wallpaper-terminal/', import.meta.url),
  );
  return [
    ...sourceFiles(resolve(consoleIntegrationRoot, 'src')),
    ...sourceFiles(resolve(wallpaperIntegrationRoot, 'src')),
    ...sourceFiles(resolve(consoleRoot, 'src')),
    resolve(consoleRoot, 'App.tsx'),
    ...sourceFiles(resolve(wallpaperRoot, 'src')),
    resolve(wallpaperRoot, 'App.tsx'),
  ];
};

const fixtureImportViolations = (modules: readonly ProductionModule[]): readonly ProductionModule[] =>
  modules.filter(module => module.moduleSpecifiers.some(isTerminalUpdateTestFixture));

const readPublicExports = (): readonly string[] => {
  const indexPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));
  const program = ts.createProgram({
    rootNames: [indexPath],
    options: {
      target: ts.ScriptTarget.ES2023,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      jsx: ts.JsxEmit.ReactJSX,
      strict: true,
      skipLibCheck: true,
      resolveJsonModule: true,
    },
  });
  const sourceFile = program.getSourceFile(indexPath);
  if (sourceFile === undefined) throw new Error(`missing source file: ${indexPath}`);
  const moduleSymbol = program.getTypeChecker().getSymbolAtLocation(sourceFile);
  if (moduleSymbol === undefined) throw new Error(`missing module symbol: ${indexPath}`);
  return program
    .getTypeChecker()
    .getExportsOfModule(moduleSymbol)
    .map(symbol => symbol.name)
    .sort();
};

const sortBindings = (bindings: readonly ImportBinding[]): readonly ImportBinding[] =>
  [...bindings].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : Number(left.typeOnly) - Number(right.typeOnly),
  );

const readSourceFile = (filePath: string): ts.SourceFile => {
  const program = ts.createProgram({
    rootNames: [filePath],
    options: {
      allowJs: true,
      noEmit: true,
      noResolve: true,
      target: ts.ScriptTarget.Latest,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  const sourceFile = program.getSourceFile(filePath);
  if (sourceFile === undefined) throw new Error('missing source file: ' + filePath);
  const diagnostics = program.getSyntacticDiagnostics(sourceFile);
  if (diagnostics.length > 0) {
    const message = ts.flattenDiagnosticMessageText(diagnostics[0].messageText, ' ');
    throw new Error('invalid TypeScript source: ' + filePath + ': ' + message);
  }
  return sourceFile;
};

const readImports = (filePath: string): readonly ImportRecord[] => {
  const sourceFile = readSourceFile(filePath);
  return sourceFile.statements.flatMap(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    const clause = statement.importClause;
    const bindings: ImportBinding[] = [];
    if (clause?.name) bindings.push({name: 'default', typeOnly: clause.isTypeOnly});
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
      bindings.push({name: '*', typeOnly: clause.isTypeOnly});
    }
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindings.push({
          name: element.propertyName?.text ?? element.name.text,
          typeOnly: clause.isTypeOnly || element.isTypeOnly,
        });
      }
    }
    return [{moduleSpecifier: statement.moduleSpecifier.text, sideEffectOnly: clause === undefined, bindings}];
  });
};

const readGlobalCssPaths = (filePath: string): readonly string[] => {
  const sourceFile = readSourceFile(filePath);
  const values: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
      node.name.text === 'globalCssPath' &&
      ts.isStringLiteralLike(node.initializer)
    ) {
      values.push(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return values;
};

const expectNamedImports = (filePath: string, moduleSpecifier: string, expected: readonly ImportBinding[]): void => {
  const actual = readImports(filePath)
    .filter(record => record.moduleSpecifier === moduleSpecifier)
    .flatMap(record => record.bindings);
  expect(sortBindings(actual)).toEqual(sortBindings(expected));
};

describe('sample2 integration public surface', () => {
  it('keeps the Web update fixture outside both production source graphs', () => {
    const productionModules = productionSourceRoots().map(filePath => ({
      filePath,
      moduleSpecifiers: moduleSpecifiers(filePath),
    }));
    expect(fixtureImportViolations(productionModules)).toEqual([]);
  });

  it('rejects a fixture import injected into a production module', () => {
    const fixtureSpecifier = '@catering-v2s/kernel-base-terminal-update/testing';
    const [productionPath] = productionSourceRoots();
    expect(productionPath).toBeDefined();
    expect(
      fixtureImportViolations([
        {filePath: productionPath, moduleSpecifiers: [fixtureSpecifier]},
      ]),
    ).toEqual([{filePath: productionPath, moduleSpecifiers: [fixtureSpecifier]}]);
    expect(isTerminalUpdateTestFixture(`${packageName}/test-expo/TerminalUpdateAssetLoadProbe`)).toBe(false);
  });

  it('matches terminal-invariants exactly, including type exports', () => {
    expect(readPublicExports()).toEqual([...invariant.publicExports].sort());
  });

  it('matches package exports to the exact invariant map and existing targets', () => {
    expect(packageJson.exports).toEqual(invariant.publicExportMap);
    for (const target of Object.values(invariant.publicExportMap)) {
      expect(existsSync(resolve(packageRoot, target))).toBe(true);
    }
  });

  it('keeps the Android host package-root imports bound to the documented exports', () => {
    const appPath = fileURLToPath(
      new URL('../../../../application/android/sample-wallpaper-terminal/App.tsx', import.meta.url),
    );
    const platformPortsPath = fileURLToPath(
      new URL(
        '../../../../application/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts',
        import.meta.url,
      ),
    );
    const dependenciesPath = fileURLToPath(
      new URL('../../../../application/android/sample-wallpaper-terminal/src/dependencies.ts', import.meta.url),
    );
    const metroConfigPath = fileURLToPath(
      new URL('../../../../application/android/sample-wallpaper-terminal/metro.config.js', import.meta.url),
    );

    expectNamedImports(appPath, packageName, [
      {name: 'createSurfaceForDisplayIndex', typeOnly: false},
      {name: 'SurfaceForm', typeOnly: true},
      {name: 'WallpaperConsoleAssembly', typeOnly: true},
    ]);
    expectNamedImports(platformPortsPath, packageName, [
      {name: 'createSampleWallpaperConsoleAssembly', typeOnly: false},
      {name: 'SurfaceForm', typeOnly: true},
    ]);
    expectNamedImports(dependenciesPath, packageName, [{name: 'moduleName', typeOnly: false}]);
    expect(
      readImports(appPath)
        .filter(record => record.moduleSpecifier === cssSubpath)
        .map(record => record.sideEffectOnly),
    ).toEqual([true]);
    expect(readGlobalCssPaths(metroConfigPath)).toEqual([cssSubpath]);
  });
});
