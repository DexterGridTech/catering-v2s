import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import {createAnalysisProgram, resolveAliasedSymbol} from './typescript-analysis.mjs';
import {readPackageInvariant} from './package-invariants.mjs';

function invariantFiles(root) {
  const scanRoot = fs.existsSync(path.join(root, 'apps/terminal'))
    ? path.join(root, 'apps/terminal')
    : root;
  const result = [];
  const visit = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.git', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && entry.name === 'terminal-invariants.json') result.push(entryPath);
    }
  };
  visit(scanRoot);
  return result.sort();
}

function packageRootFromInvariant(filePath) {
  return path.dirname(filePath);
}

function declarationName(node) {
  return node.name && ts.isIdentifier(node.name) ? node.name.text : null;
}

function findNamedDeclaration(sourceFile, name) {
  let found = null;
  const visit = node => {
    if (found) return;
    if (
      (ts.isTypeAliasDeclaration(node)
        || ts.isInterfaceDeclaration(node)
        || ts.isFunctionDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isVariableDeclaration(node))
      && declarationName(node) === name
    ) {
      found = node;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function unwrap(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current)
    || ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return null;
}

function typeForDeclaration(declaration, checker) {
  if (ts.isTypeAliasDeclaration(declaration)) return checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(declaration.name));
  if (ts.isInterfaceDeclaration(declaration)) return checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(declaration.name));
  if (ts.isVariableDeclaration(declaration) || ts.isFunctionDeclaration(declaration)) {
    const symbol = checker.getSymbolAtLocation(declaration.name);
    if (!symbol) return null;
    return checker.getTypeOfSymbolAtLocation(symbol, declaration);
  }
  return null;
}

function targetType(declaration, memberPath, checker, sourceFile) {
  const segments = memberPath.split('.').filter(Boolean);
  if (!segments.length) return null;

  if (ts.isTypeAliasDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) {
    const declared = typeForDeclaration(declaration, checker);
    if (!declared) return null;
    const property = checker.getPropertyOfType(declared, segments[0]);
    if (!property) return null;
    const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
    let current = propertyDeclaration.type
      ? checker.getTypeFromTypeNode(propertyDeclaration.type)
      : checker.getTypeOfSymbolAtLocation(property, propertyDeclaration);
    for (const segment of segments.slice(1)) {
      const nested = checker.getPropertyOfType(current, segment);
      if (nested) {
        const nestedDeclaration = nested.valueDeclaration ?? nested.declarations?.[0] ?? propertyDeclaration;
        current = nestedDeclaration.type
          ? checker.getTypeFromTypeNode(nestedDeclaration.type)
          : checker.getTypeOfSymbolAtLocation(nested, nestedDeclaration);
        continue;
      }
      const signatures = current.getCallSignatures?.() ?? [];
      const parameter = signatures.flatMap(signature => signature.parameters ?? [])
        .find(candidate => candidate.name === segment);
      if (!parameter) return null;
      const parameterDeclaration = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? propertyDeclaration;
      current = checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration);
    }
    return current;
  }

  if (ts.isFunctionDeclaration(declaration)) {
    const parameter = declaration.parameters.find(candidate => propertyName(candidate.name) === segments[0]);
    if (!parameter?.type) return null;
    return checker.getTypeAtLocation(parameter.type);
  }

  if (ts.isVariableDeclaration(declaration)) {
    const declared = typeForDeclaration(declaration, checker);
    if (!declared) return null;
    const signatures = declared.getCallSignatures?.() ?? [];
    const parameter = signatures.flatMap(signature => signature.parameters ?? [])
      .find(candidate => candidate.name === segments[0]);
    if (parameter) {
      const parameterDeclaration = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? declaration;
      return checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration);
    }
    return checker.getPropertyOfType(declared, segments[0]) ?? null;
  }

  void sourceFile;
  return null;
}

function unionSymbols(type, checker, result = new Map(), seen = new Set()) {
  if (!type || seen.has(type)) return result;
  seen.add(type);
  const alias = type.aliasSymbol ? resolveAliasedSymbol(checker, type.aliasSymbol) : null;
  if (alias?.name) result.set(alias.name, alias);
  const symbol = type.symbol ? resolveAliasedSymbol(checker, type.symbol) : null;
  if (symbol?.name && type.isUnion?.()) result.set(symbol.name, symbol);
  for (const member of type.types ?? []) unionSymbols(member, checker, result, seen);
  for (const argument of type.aliasTypeArguments ?? []) unionSymbols(argument, checker, result, seen);
  // Only walk generic arguments and call parameters.  Walking every property
  // and return type of library shapes (notably Redux Reducer) creates a large
  // recursive graph and provides no additional union-origin signal.
  for (const signature of type.getCallSignatures?.() ?? []) {
    for (const parameter of signature.parameters ?? []) {
      const declaration = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? signature.declaration;
      if (declaration) unionSymbols(checker.getTypeOfSymbolAtLocation(parameter, declaration), checker, result, seen);
    }
  }
  return result;
}

function definitionMap(entries) {
  const definitions = new Map();
  for (const entry of entries) {
    for (const [name, values] of Object.entries(entry.invariant.closedUnionDefinitions ?? {})) {
      definitions.set(name, {
        packageName: entry.packageName,
        packageRoot: entry.packageRoot,
        values: [...values].sort(),
      });
    }
  }
  return definitions;
}

function assertClosedUnionDefinitionRows(entries, analysis, definitions) {
  const failures = [];
  for (const entry of entries) {
    if (
      entry.invariant.closedUnionConsumerCount !== undefined
      && (entry.invariant.closedUnionConsumers ?? []).length !== entry.invariant.closedUnionConsumerCount
    ) {
      failures.push(`${entry.packageName} closedUnionConsumers count mismatch expected=${entry.invariant.closedUnionConsumerCount} actual=${(entry.invariant.closedUnionConsumers ?? []).length}`);
    }
    for (const row of entry.invariant.closedUnionConsumers ?? []) {
      const expectedSymbol = `${row.unionPackage}#${row.union}`;
      if (row.expectedSymbol !== expectedSymbol) {
        failures.push(`${entry.packageName}:${row.declarationId}.${row.member} expectedSymbol=${expectedSymbol} actual=${row.expectedSymbol}`);
        continue;
      }
      const definition = definitions.get(row.union);
      if (!definition || definition.packageName !== row.unionPackage) {
        failures.push(`${entry.packageName}:${row.declarationId}.${row.member} unknown union owner ${expectedSymbol}`);
        continue;
      }
      const sourcePath = path.resolve(entry.packageRoot, row.sourceFile);
      const sourceFile = analysis.program.getSourceFile(sourcePath);
      if (!sourceFile) {
        failures.push(`${entry.packageName}:${row.sourceFile} missing consumer source`);
        continue;
      }
      const declaration = findNamedDeclaration(sourceFile, row.declarationId);
      if (!declaration) {
        failures.push(`${entry.packageName}:${row.sourceFile} missing declaration ${row.declarationId}`);
        continue;
      }
      const type = targetType(declaration, row.member, analysis.program.getTypeChecker(), sourceFile);
      const checker = analysis.program.getTypeChecker();
      const symbols = unionSymbols(type, checker);
      
      const unionSymbol = symbols.get(row.union);
      const values = unionSymbol
        ? (analysis.program.getTypeChecker().getDeclaredTypeOfSymbol(unionSymbol).types ?? [])
          .filter(member => member.flags & ts.TypeFlags.StringLiteral)
          .map(member => member.value)
          .sort()
        : [];
      if (!unionSymbol || JSON.stringify(values) !== JSON.stringify(definition.values)) {
        failures.push(`${entry.packageName}:${row.declarationId}.${row.member} must resolve to ${expectedSymbol}; actual=${checker.typeToString(type)}`);
      }
    }
  }
  if (failures.length) throw new Error(`closed union consumer mismatch; ${failures.join('; ')}`);
}

/**
 * Validate package-local closed-union definitions and all declared consumer
 * bindings.  The invariant files are the only expected-set owner; source is
 * resolved with TypeScript so a same-text string or widened `string` cannot
 * satisfy a row.
 */
export function assertClosedUnionConsumers(root) {
  const entries = invariantFiles(root).map(filePath => {
    const packageRoot = packageRootFromInvariant(filePath);
    const invariant = readPackageInvariant(packageRoot);
    return {
      packageRoot,
      packageName: invariant.package,
      invariant,
    };
  });
  const definitions = definitionMap(entries);
  const analysis = createAnalysisProgram(root);
  const checker = analysis.program.getTypeChecker();
  for (const entry of entries) {
    for (const [unionName, expectedValues] of Object.entries(entry.invariant.closedUnionDefinitions ?? {})) {
      const sourceCandidates = analysis.files.filter(filePath => filePath.startsWith(`${entry.packageRoot}${path.sep}`));
      const symbol = sourceCandidates.map(filePath => analysis.program.getSourceFile(filePath))
        .filter(Boolean)
        .flatMap(sourceFile => {
          const module = checker.getSymbolAtLocation(sourceFile);
          return module ? checker.getExportsOfModule(module) : [];
        })
        .find(candidate => candidate.name === unionName);
      if (!symbol) throw new Error(`${entry.packageName} closed union definition missing ${unionName}`);
      const resolved = resolveAliasedSymbol(checker, symbol);
      const actual = (checker.getDeclaredTypeOfSymbol(resolved).types ?? [])
        .filter(member => member.flags & ts.TypeFlags.StringLiteral)
        .map(member => member.value)
        .sort();
      if (JSON.stringify(actual) !== JSON.stringify([...expectedValues].sort())) {
        throw new Error(`${entry.packageName}.${unionName} closed union mismatch`);
      }
    }
  }
  assertClosedUnionDefinitionRows(entries, analysis, definitions);
  return {definitions: definitions.size, consumers: entries.reduce((sum, entry) => sum + (entry.invariant.closedUnionConsumers?.length ?? 0), 0)};
}
