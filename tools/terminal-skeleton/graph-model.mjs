import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolsDirectory, '../..');
export const terminalRoot = path.join(repoRoot, 'apps/terminal');
export const skeletonGraphPath = path.join(terminalRoot, 'skeleton-graph.ts');
export const terminalPackageName = '@catering-v2s/terminal';
export const packageScope = '@catering-v2s/';

function propertyName(node) {
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) {
    return node.name.text;
  }
  throw new Error(`Unsupported property name at ${node.getStart()}`);
}

function literalValue(node) {
  if (ts.isParenthesizedExpression(node)) return literalValue(node.expression);
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return literalValue(node.expression);
  }
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(node)) {
    const result = {};
    for (const member of node.properties) {
      if (!ts.isPropertyAssignment(member)) {
        throw new Error(`Unsupported object member at ${member.getStart()}`);
      }
      result[propertyName(member)] = literalValue(member.initializer);
    }
    return result;
  }
  throw new Error(`Unsupported literal at ${node.getStart()}: ${ts.SyntaxKind[node.kind]}`);
}

function readVariable(sourceFile, variableName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === variableName && declaration.initializer) {
        return literalValue(declaration.initializer);
      }
    }
  }
  throw new Error(`Missing literal variable ${variableName} in ${skeletonGraphPath}`);
}

function rootFromGraphPath(graphPath) {
  const graphDirectory = path.dirname(graphPath);
  if (path.basename(graphDirectory) === 'terminal' && path.basename(path.dirname(graphDirectory)) === 'apps') {
    return path.resolve(graphDirectory, '../..');
  }
  return repoRoot;
}

function realizedModuleKind(moduleName, graphPath) {
  if (moduleName !== 'kernel.base.runtime') return null;
  const root = rootFromGraphPath(graphPath);
  const manifestPath = path.join(
    root,
    'apps/terminal/kernel/base/runtime/src/application/createInternalRuntimeModule.ts',
  );
  if (!fs.existsSync(manifestPath)) return null;
  const source = fs.readFileSync(manifestPath, 'utf8');
  const match = source.match(/\bkind\s*:\s*['"](owner|toolkit)['"]\s+as\s+const\b/);
  return match ? match[1] : null;
}

export function readSkeletonSpec(graphPath = skeletonGraphPath) {
  const sourceText = fs.readFileSync(graphPath, 'utf8');
  const sourceFile = ts.createSourceFile(graphPath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const activeBatch = readVariable(sourceFile, 'activeSkeletonBatch');
  const graph = readVariable(sourceFile, 'skeletonGraph');
  if (!Number.isInteger(activeBatch) || activeBatch < 1) {
    throw new Error(`activeSkeletonBatch must be a positive integer, got ${String(activeBatch)}`);
  }
  if (!graph || Array.isArray(graph) || typeof graph !== 'object') {
    throw new Error('skeletonGraph must be an object literal');
  }
  for (const [moduleName, entry] of Object.entries(graph)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error(`${moduleName} has an invalid entry`);
    if (!Number.isInteger(entry.batch) || ![1, 2].includes(entry.batch))
      throw new Error(`${moduleName} has an invalid batch`);
    const manifestKind = realizedModuleKind(moduleName, graphPath);
    if (entry.plannedKind !== undefined && manifestKind !== null) {
      throw new Error(`${moduleName} must not declare both plannedKind and manifest kind`);
    }
    if (entry.plannedKind === undefined && manifestKind === null) {
      throw new Error(`${moduleName} has neither plannedKind nor manifest kind`);
    }
    entry.plannedKind = entry.plannedKind ?? manifestKind;
    if (!['toolkit', 'owner'].includes(entry.plannedKind)) throw new Error(`${moduleName} has an invalid plannedKind`);
    for (const field of ['dependencies', 'devDependencies']) {
      if (!Array.isArray(entry[field]) || entry[field].some(value => typeof value !== 'string')) {
        throw new Error(`${moduleName}.${field} must be a string array`);
      }
    }
    if (entry.dependencies.includes(moduleName) || entry.devDependencies.includes(moduleName)) {
      throw new Error(`${moduleName} contains a self dependency`);
    }
  }
  return {activeBatch, graph, sourceText};
}

export function projectSkeletonGraph(spec, batch = spec.activeBatch) {
  const nodes = Object.fromEntries(Object.entries(spec.graph).filter(([, entry]) => entry.batch <= batch));
  const nodeNames = new Set(Object.keys(nodes));
  const projected = {};
  for (const [moduleName, entry] of Object.entries(nodes)) {
    projected[moduleName] = {
      batch: entry.batch,
      plannedKind: entry.plannedKind,
      dependencies: entry.dependencies.filter(dependency => nodeNames.has(dependency)),
      devDependencies: entry.devDependencies.filter(dependency => nodeNames.has(dependency)),
    };
  }
  return projected;
}

export function moduleNameToRelativePath(moduleName) {
  const segments = moduleName.split('.');
  if (segments.length !== 3 || segments.some(segment => !/^[a-z0-9-]+$/.test(segment))) {
    throw new Error(`Invalid TER moduleName: ${moduleName}`);
  }
  return path.join('apps/terminal', ...segments);
}

export function moduleNameToPath(moduleName, root = repoRoot) {
  return path.join(root, moduleNameToRelativePath(moduleName));
}

export function moduleNameToPackageName(moduleName) {
  return `${packageScope}${moduleName.replaceAll('.', '-')}`;
}

export function packageNameToModuleName(packageName, spec = readSkeletonSpec()) {
  for (const moduleName of Object.keys(spec.graph)) {
    if (moduleNameToPackageName(moduleName) === packageName) return moduleName;
  }
  return null;
}

function walk(directory, result = []) {
  if (!fs.existsSync(directory)) return result;
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (['node_modules', '.git', 'build', 'dist', '.turbo', '.expo'].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(entryPath, result);
    else if (entry.isFile() && entry.name === 'package.json') result.push(entryPath);
  }
  return result;
}

export function readPackageCensus(root = repoRoot) {
  const entries = walk(path.join(root, 'apps/terminal')).map(packageJsonPath => {
    const packageDirectory = path.dirname(packageJsonPath);
    const relativePath = path.relative(root, packageDirectory);
    return {
      packageJsonPath,
      packageDirectory,
      relativePath,
      package: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')),
    };
  });
  return entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function readAllSourceFiles(packageDirectory) {
  const sourceRoot = path.join(packageDirectory, 'src');
  const files = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(entryPath);
    }
  }
  visit(sourceRoot);
  return files.sort();
}

export function collectPackageRootImports(filePath) {
  return collectStaticImportDeclarations(filePath)
    .map(importDeclaration => importDeclaration.moduleSpecifier)
    .filter(moduleSpecifier => moduleSpecifier.startsWith(packageScope))
    .sort();
}

function importDeclarationIsRuntime(node) {
  if (!node.importClause) return true;
  if (node.importClause.isTypeOnly) return false;
  const bindings = node.importClause.namedBindings;
  if (!bindings || ts.isNamespaceImport(bindings)) return true;
  return bindings.elements.some(element => !element.isTypeOnly);
}

export function collectStaticImportDeclarations(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  return sourceFile.statements
    .filter(statement => ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier))
    .map(statement => ({
      moduleSpecifier: statement.moduleSpecifier.text,
      isRuntime: importDeclarationIsRuntime(statement),
    }));
}

export function collectStaticImportSpecifiers(packageDirectory) {
  const imports = new Set();
  for (const filePath of readAllSourceFiles(packageDirectory)) {
    for (const moduleSpecifier of collectPackageRootImports(filePath)) imports.add(moduleSpecifier);
  }
  return [...imports].sort();
}

export function activeModuleNames(spec, batch = spec.activeBatch) {
  return Object.keys(projectSkeletonGraph(spec, batch)).sort();
}

export function packageEntriesForProjection(spec, batch = spec.activeBatch, root = repoRoot) {
  return activeModuleNames(spec, batch).map(moduleName => ({
    moduleName,
    packageName: moduleNameToPackageName(moduleName),
    packageDirectory: moduleNameToPath(moduleName, root),
  }));
}
