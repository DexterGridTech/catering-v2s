import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import ts from 'typescript';
import {readPackageInvariant} from '../terminal-shared/package-invariants.mjs';
import {
  createAnalysisProgram,
  resolveAliasedSymbol,
  resolveValueExpressionSymbol,
} from '../terminal-shared/typescript-analysis.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolDirectory, '../..');
export const runtimeRoot = path.join(repoRoot, 'apps/terminal/kernel/base/runtime');
export const skeletonGraphPath = path.join(repoRoot, 'apps/terminal/skeleton-graph.ts');

export const RUNTIME_RULE_NAMES = Object.freeze([
  'context-exact-set',
  'command-mount-shape',
  'owner-kind',
  'restart-positive',
  'ledger-record-shape',
]);
export const RUNTIME_SUPPORT_CHECK_COUNT = 1;

function sourceFiles(root) {
  const sourceRoot = path.join(root, 'src');
  const files = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(entryPath);
    }
  }
  visit(sourceRoot);
  return files.sort();
}

function testFiles(root) {
  const testRoot = path.join(root, 'test');
  const files = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) files.push(entryPath);
    }
  }
  visit(testRoot);
  return files.sort();
}

function parseSource(filePath) {
  const sourceText = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function createProgram(root) {
  const files = sourceFiles(root);
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
      '@reduxjs/toolkit': ['node_modules/@reduxjs/toolkit/dist/index.d.ts'],
    },
  });
  return {files, program, checker: program.getTypeChecker()};
}

function relativePath(filePath, root) {
  return path.relative(root, filePath) || filePath;
}

function violation(message, node, sourceFile, root) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  throw new Error(`${message} at ${relativePath(sourceFile.fileName, root)}:${line}`);
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function declarationName(declaration) {
  return declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : null;
}

function findDeclaration(sourceFile, predicate) {
  for (const statement of sourceFile.statements) {
    if (predicate(statement)) return statement;
  }
  return null;
}

function findFunctionLike(sourceFile, functionName) {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && declarationName(statement) === functionName) return statement;
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declarationName(declaration) !== functionName || !declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) return initializer;
    }
  }
  return null;
}

function findTypeDeclaration(root, typeName) {
  for (const filePath of sourceFiles(root)) {
    const sourceFile = parseSource(filePath);
    const declaration = findDeclaration(
      sourceFile,
      statement =>
        (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) &&
        declarationName(statement) === typeName,
    );
    if (declaration) return {declaration, sourceFile};
  }
  throw new Error(`Missing runtime type declaration ${typeName}`);
}

function typeMembers(declaration) {
  let typeNode = ts.isTypeAliasDeclaration(declaration) ? declaration.type : declaration;
  while (
    ts.isTypeReferenceNode(typeNode) &&
    typeReferenceName(typeNode) === 'Readonly' &&
    typeNode.typeArguments?.length === 1
  ) {
    typeNode = typeNode.typeArguments[0];
  }
  const members = ts.isTypeLiteralNode(typeNode) || ts.isInterfaceDeclaration(typeNode) ? typeNode.members : null;
  if (!members) throw new Error(`${declarationName(declaration)} must be an object type literal or interface`);
  const names = [];
  for (const member of members) {
    const name = member.name ? propertyName(member.name) : null;
    if (!name || ts.isIndexSignatureDeclaration(member) || ts.isCallSignatureDeclaration(member)) {
      throw new Error(`${declarationName(declaration)} contains an unnamed/index/call member`);
    }
    names.push(name);
  }
  return names;
}

function assertExactNames(label, actualNames, expectedNames) {
  const actual = [...actualNames].sort();
  const expected = [...expectedNames].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length || new Set(actual).size !== actual.length) {
    throw new Error(
      `${label} exact member mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
    );
  }
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function objectProperty(object, name) {
  return (
    object.properties.find(member => ts.isPropertyAssignment(member) && propertyName(member.name) === name) ?? null
  );
}

function objectReturnedByFunction(sourceFile, functionName) {
  const objectFromExpression = expression => {
    const unwrapped = unwrapExpression(expression);
    if (ts.isObjectLiteralExpression(unwrapped)) return unwrapped;
    if (ts.isCallExpression(unwrapped) && unwrapped.arguments.length >= 1) {
      return objectFromExpression(unwrapped.arguments[0]);
    }
    return null;
  };
  const objectFromBody = body => {
    if (ts.isBlock(body)) {
      let result = null;
      function visit(node) {
        if (!result && ts.isReturnStatement(node) && node.expression) result = objectFromExpression(node.expression);
        if (!result) ts.forEachChild(node, visit);
      }
      visit(body);
      return result;
    }
    return objectFromExpression(body);
  };
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && declarationName(statement) === functionName && statement.body) {
      const result = objectFromBody(statement.body);
      if (result) return result;
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declarationName(declaration) !== functionName || !declaration.initializer) continue;
      const initializer = unwrapExpression(declaration.initializer);
      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        const result = objectFromBody(initializer.body);
        if (result) return result;
      }
    }
  }
  throw new Error(`Cannot find object returned by ${functionName}`);
}

function arrayElements(property, label) {
  if (!property) throw new Error(`${label} property is missing`);
  const expression = unwrapExpression(property.initializer);
  if (!ts.isArrayLiteralExpression(expression)) throw new Error(`${label} must be an array literal`);
  return expression.elements.map(unwrapExpression);
}

function stringProperty(object, name, label, moduleName) {
  const member = objectProperty(object, name);
  if (!member) throw new Error(`${label}.${name} property is missing`);
  const initializer = unwrapExpression(member.initializer);
  if (ts.isStringLiteralLike(initializer)) return initializer.text;
  if (ts.isTemplateExpression(initializer)) {
    let value = initializer.head.text;
    for (const span of initializer.templateSpans) {
      if (!ts.isIdentifier(span.expression) || span.expression.text !== 'moduleName') {
        throw new Error(`${label}.${name} must be a string literal or moduleName template`);
      }
      if (!moduleName) throw new Error(`${label}.${name} moduleName binding is missing`);
      value += moduleName;
      value += span.literal.text;
    }
    return value;
  }
  throw new Error(`${label}.${name} must be a string literal`);
}

function readModuleNameValue(root) {
  const moduleNamePath = findFile(root, path.join('src', 'moduleName.ts'));
  const source = parseSource(moduleNamePath);
  const declaration = findDeclaration(
    source,
    statement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(candidate => declarationName(candidate) === 'moduleName'),
  )?.declarationList.declarations.find(candidate => declarationName(candidate) === 'moduleName');
  const initializer = declaration?.initializer && unwrapExpression(declaration.initializer);
  if (!initializer || !ts.isStringLiteralLike(initializer)) {
    throw new Error('runtime moduleName.ts must export moduleName as a string literal');
  }
  return initializer.text;
}

function identifierProperty(object, name, label) {
  const member = objectProperty(object, name);
  if (!member) throw new Error(`${label}.${name} property is missing`);
  const initializer = unwrapExpression(member.initializer);
  if (!ts.isIdentifier(initializer)) throw new Error(`${label}.${name} must be an identifier`);
  return initializer.text;
}

function findFile(root, suffix) {
  const match = sourceFiles(root).find(filePath => filePath.endsWith(suffix));
  if (!match) throw new Error(`Missing runtime source ${suffix}`);
  return match;
}

function runContextExactSet({root, invariant}) {
  const moduleContext = findTypeDeclaration(root, 'RuntimeModuleContext');
  const actorContext = findTypeDeclaration(root, 'ActorExecutionContext');
  assertExactNames('RuntimeModuleContext', typeMembers(moduleContext.declaration), invariant.moduleContextMembers);
  assertExactNames('ActorExecutionContext', typeMembers(actorContext.declaration), invariant.actorContextMembers);
}

function typeReferenceName(node) {
  if (!node || !ts.isTypeReferenceNode(node)) return null;
  return ts.isIdentifier(node.typeName) ? node.typeName.text : null;
}

function isIdentifierNamed(node, name) {
  return ts.isIdentifier(node) && node.text === name;
}

function hasPayloadParameterizedBrand(commandDeclaration) {
  if (!ts.isTypeAliasDeclaration(commandDeclaration)) return false;
  let typeNode = commandDeclaration.type;
  while (
    ts.isTypeReferenceNode(typeNode) &&
    typeReferenceName(typeNode) === 'Readonly' &&
    typeNode.typeArguments?.length === 1
  ) {
    typeNode = typeNode.typeArguments[0];
  }
  if (!ts.isTypeLiteralNode(typeNode)) return false;
  const typeParameter = commandDeclaration.typeParameters?.find(parameter => declarationName(parameter) === 'TPayload');
  if (!typeParameter) return false;
  for (const member of typeNode.members) {
    if (!ts.isPropertySignature(member) || !member.name || !ts.isComputedPropertyName(member.name)) continue;
    const expression = member.name.expression;
    if (!isIdentifierNamed(expression, 'commandDefinitionBrand')) continue;
    if (!member.type || !ts.isFunctionTypeNode(member.type)) return false;
    const parameter = member.type.parameters[0];
    if (!parameter || !parameter.type || !isIdentifierNamed(parameter.name, 'payload')) return false;
    if (typeReferenceName(parameter.type) !== 'TPayload' || typeReferenceName(member.type.type) !== 'TPayload')
      return false;
    return true;
  }
  return false;
}

function hasBrandedHandlerDefinition(handlerDeclaration) {
  if (!ts.isTypeAliasDeclaration(handlerDeclaration)) return false;
  let typeNode = handlerDeclaration.type;
  while (
    ts.isTypeReferenceNode(typeNode) &&
    typeReferenceName(typeNode) === 'Readonly' &&
    typeNode.typeArguments?.length === 1
  ) {
    typeNode = typeNode.typeArguments[0];
  }
  if (!ts.isTypeLiteralNode(typeNode)) return false;
  if (
    !typeNode.members.some(
      member => ts.isPropertySignature(member) && member.name && propertyName(member.name) === 'definition',
    )
  )
    return false;
  for (const member of typeNode.members) {
    if (!ts.isPropertySignature(member) || !member.name || !ts.isComputedPropertyName(member.name)) continue;
    const expression = member.name.expression;
    if (!isIdentifierNamed(expression, 'actorCommandHandlerDefinitionBrand')) continue;
    return (
      member.type?.kind === ts.SyntaxKind.TrueKeyword ||
      (member.type !== undefined &&
        ts.isLiteralTypeNode(member.type) &&
        member.type.literal.kind === ts.SyntaxKind.TrueKeyword)
    );
  }
  return false;
}

function runCommandMountShape({root, invariant}) {
  const moduleName = readModuleNameValue(root);
  const commandPath = findFile(root, path.join('src', 'types', 'command.ts'));
  const commandSource = parseSource(commandPath);
  const commandDeclaration = findDeclaration(
    commandSource,
    statement => ts.isTypeAliasDeclaration(statement) && declarationName(statement) === 'CommandDefinition',
  );
  if (!commandDeclaration || !hasPayloadParameterizedBrand(commandDeclaration)) {
    throw new Error('CommandDefinition must carry a payload-parameterized private brand');
  }

  const actorTypePath = findFile(root, path.join('src', 'types', 'actor.ts'));
  const actorTypeSource = parseSource(actorTypePath);
  const handlerDeclaration = findDeclaration(
    actorTypeSource,
    statement => ts.isTypeAliasDeclaration(statement) && declarationName(statement) === 'ActorCommandHandlerDefinition',
  );
  if (!handlerDeclaration || !hasBrandedHandlerDefinition(handlerDeclaration)) {
    throw new Error('ActorCommandHandlerDefinition must carry definition identity and a private brand');
  }

  const actorPath = findFile(root, path.join('src', 'foundations', 'defineActor.ts'));
  const actorSource = parseSource(actorPath);
  if (!actorSource.text.includes('actorCommandHandlerDefinitionBrand')) {
    throw new Error('onCommand must stamp actor handler definitions with a private brand');
  }
  const onCommand = findFunctionLike(actorSource, 'onCommand');
  if (!onCommand || onCommand.parameters.length < 1) throw new Error('onCommand declaration is missing');
  const firstParameter = onCommand.parameters[0];
  if (typeReferenceName(firstParameter.type) !== 'CommandDefinition') {
    throw new Error('onCommand first parameter must be CommandDefinition, not a string command name');
  }
  if (!actorSource.text.includes('defineActor')) throw new Error('defineActor factory is missing');
  let foundOnCommandCall = false;
  for (const filePath of sourceFiles(root)) {
    const sourceFile = parseSource(filePath);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'onCommand') {
        foundOnCommandCall = true;
        const firstArgument = node.arguments[0];
        if (!firstArgument || ts.isStringLiteralLike(firstArgument)) {
          violation('onCommand must mount a command definition object', node, sourceFile, root);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  if (!foundOnCommandCall) throw new Error('runtime must contain an onCommand definition mount');

  const internalPath = findFile(root, path.join('src', 'application', 'createInternalRuntimeModule.ts'));
  const internalSource = parseSource(internalPath);
  const returned = objectReturnedByFunction(internalSource, 'createInternalRuntimeModule');
  const commands = arrayElements(objectProperty(returned, 'commands'), 'runtime module commands');
  const commandEntries = commands.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element))
      throw new Error(`runtime module command ${index} must be an object literal`);
    const visibility = stringProperty(element, 'visibility', `runtime module command ${index}`, moduleName);
    if (!['internal', 'public'].includes(visibility)) {
      throw new Error(`runtime module command ${index}.visibility must be internal or public`);
    }
    return {element, visibility};
  });
  const internalCommandEntries = commandEntries.filter(entry => entry.visibility === 'internal');
  const commandNames = internalCommandEntries.map(({element}, index) =>
    stringProperty(element, 'name', `internal command ${index}`, moduleName),
  );
  assertExactNames('internal command declarations', commandNames, invariant.internalCommands);

  const definitions = arrayElements(objectProperty(returned, 'commandDefinitions'), 'internal command definitions');
  const allDefinitionNames = definitions.map((element, index) => {
    if (!ts.isIdentifier(element)) throw new Error(`internal command definition ${index} must be a named definition`);
    return element.text;
  });
  const definitionNames = allDefinitionNames.filter((_, index) => commandEntries[index]?.visibility === 'internal');
  assertExactNames('internal command definition mounts', definitionNames, invariant.internalCommandDefinitions);
  if (definitions.length !== commands.length) {
    throw new Error(
      `internal command declaration/definition count mismatch; declarations=${commands.length} definitions=${definitions.length}`,
    );
  }
  if (!internalSource.text.includes('moduleName'))
    throw new Error('internal module must derive command ownership from moduleName');
}

function readGraphRuntimeEntry(graphPath = skeletonGraphPath) {
  if (!fs.existsSync(graphPath)) throw new Error(`Missing skeleton graph ${graphPath}`);
  const sourceFile = parseSource(graphPath);
  const variable = findDeclaration(
    sourceFile,
    statement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(declaration => declarationName(declaration) === 'skeletonGraph'),
  );
  const declaration = variable?.declarationList.declarations.find(
    candidate => declarationName(candidate) === 'skeletonGraph',
  );
  if (!declaration?.initializer) throw new Error('skeletonGraph literal is missing');
  const initializer = unwrapExpression(declaration.initializer);
  if (!ts.isObjectLiteralExpression(initializer)) throw new Error('skeletonGraph must be an object literal');
  const entry = initializer.properties.find(
    member => ts.isPropertyAssignment(member) && propertyName(member.name) === 'kernel.base.runtime',
  );
  if (!entry || !ts.isPropertyAssignment(entry)) throw new Error('kernel.base.runtime skeleton entry is missing');
  const entryObject = unwrapExpression(entry.initializer);
  if (!ts.isObjectLiteralExpression(entryObject))
    throw new Error('kernel.base.runtime graph entry must be an object literal');
  return {sourceFile, entryObject};
}

function runOwnerKind({root, graphPath = skeletonGraphPath}) {
  const moduleNamePath = findFile(root, path.join('src', 'moduleName.ts'));
  const analysis = createAnalysisProgram(root);
  const checker = analysis.program.getTypeChecker();
  const moduleNameSource = analysis.program.getSourceFile(moduleNamePath) ?? parseSource(moduleNamePath);
  const moduleSymbol = checker.getSymbolAtLocation(moduleNameSource);
  const moduleKindExport = moduleSymbol
    ? checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === 'moduleKind')
    : null;
  const resolvedModuleKind = moduleKindExport ? resolveAliasedSymbol(checker, moduleKindExport) : null;
  const moduleKindDeclaration = findDeclaration(
    moduleNameSource,
    statement =>
      ts.isVariableStatement(statement) &&
      statement.declarationList.declarations.some(declaration => declarationName(declaration) === 'moduleKind'),
  );
  const moduleKindVariable = moduleKindDeclaration?.declarationList.declarations.find(
    declaration => declarationName(declaration) === 'moduleKind',
  );
  const moduleKindInitializer = moduleKindVariable?.initializer && unwrapExpression(moduleKindVariable.initializer);
  if (
    !moduleKindVariable ||
    !resolvedModuleKind ||
    !moduleKindInitializer ||
    !ts.isStringLiteral(moduleKindInitializer) ||
    !['owner', 'toolkit'].includes(moduleKindInitializer.text)
  ) {
    throw new Error('runtime moduleName.ts must export moduleKind as an owner/toolkit literal');
  }
  const internalPath = findFile(root, path.join('src', 'application', 'createInternalRuntimeModule.ts'));
  const internalSource = analysis.program.getSourceFile(internalPath) ?? parseSource(internalPath);
  const returned = objectReturnedByFunction(internalSource, 'createInternalRuntimeModule');
  const kindMember = objectProperty(returned, 'kind');
  const kindInitializer = kindMember ? unwrapExpression(kindMember.initializer) : null;
  if (!kindInitializer) {
    throw new Error('runtime module manifest kind must reference moduleKind from moduleName.ts');
  }
  const resolvedKind = resolveValueExpressionSymbol(checker, kindInitializer);
  const sameModuleKind = Boolean(
    resolvedKind &&
    resolvedKind === resolvedModuleKind &&
    resolvedKind.declarations?.some(
      declaration =>
        path.resolve(declaration.getSourceFile().fileName) === path.resolve(moduleNamePath) &&
        declarationName(declaration) === 'moduleKind',
    ),
  );
  if (!sameModuleKind) {
    throw new Error('runtime module manifest kind must reference moduleKind from src/moduleName.ts');
  }
  const stateSlices = arrayElements(objectProperty(returned, 'stateSlices'), 'internal runtime stateSlices');
  if (stateSlices.length < 1) throw new Error('owner runtime module must declare at least one state slice');
  const slices = arrayElements(objectProperty(returned, 'slices'), 'internal runtime slices');
  if (slices.length < 1) throw new Error('owner runtime module must declare at least one slice descriptor');
  const graph = readGraphRuntimeEntry(graphPath);
  if (objectProperty(graph.entryObject, 'plannedKind')) {
    throw new Error('kernel.base.runtime must remove skeleton plannedKind after manifest kind is real');
  }
  const manifestPath = findFile(root, path.join('src', 'application', 'moduleManifest.ts'));
  const manifestSource = parseSource(manifestPath);
  if (!manifestSource.text.includes('kind: module.kind')) {
    throw new Error('runtime module manifest must retain the module kind');
  }
}

function runRestartPositive({root}) {
  const rolePath = findFile(root, path.join('src', 'features', 'slices', 'runtimeInstanceMode.ts'));
  const roleSource = parseSource(rolePath);
  if (!/persistIntent\s*:\s*['"]owner-only['"]/.test(roleSource.text)) {
    throw new Error('runtime role slice must use owner-only persistence');
  }
  if (
    !/kind\s*:\s*['"]field['"]/.test(roleSource.text) ||
    !/stateKey\s*:\s*['"]instanceMode['"]/.test(roleSource.text)
  ) {
    throw new Error('runtime role persistence descriptor must persist instanceMode as a field');
  }
  const recoveryTest = testFiles(root).find(filePath => {
    const text = fs.readFileSync(filePath, 'utf8');
    const runtimeCreations = [...text.matchAll(/\bcreateRuntime\s*\(/g)].length;
    return runtimeCreations >= 2 && /instanceMode|instance-mode/.test(text) && /plainStorage|shared|Map/.test(text);
  });
  if (!recoveryTest) {
    throw new Error('runtime tests must include a cross-runtime role persistence recovery case');
  }
}

function runLedgerRecordShape({root, invariant}) {
  const record = findTypeDeclaration(root, 'RequestExecutionRecord');
  const observation = findTypeDeclaration(root, 'CommandExecutionObservation');
  assertExactNames(
    'RequestExecutionRecord',
    typeMembers(record.declaration),
    invariant.ledgerRecordShape.RequestExecutionRecord,
  );
  assertExactNames(
    'CommandExecutionObservation',
    typeMembers(observation.declaration),
    invariant.ledgerRecordShape.CommandExecutionObservation,
  );
}

function moduleSymbol(checker, sourceFile) {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) throw new Error('runtime src/index.ts has no module symbol');
  return symbol;
}

function runPublicSupport({checker, indexSourceFile, root, invariant}) {
  const actual = checker
    .getExportsOfModule(moduleSymbol(checker, indexSourceFile))
    .map(symbol => symbol.name)
    .sort();
  const expected = [...invariant.publicExports].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length || new Set(actual).size !== actual.length) {
    throw new Error(
      `runtime public export exact-set mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} actualCount=${actual.length}`,
    );
  }
  for (const statement of indexSourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.exportClause) {
      violation('runtime public index must not use export *', statement, indexSourceFile, root);
    }
  }
}

export function runRuntimeStaticChecks({runtimePackageRoot: root = runtimeRoot, graphPath = skeletonGraphPath} = {}) {
  const context = createProgram(root);
  const invariant = readPackageInvariant(root, '@catering-v2s/kernel-base-runtime');
  const indexPath = path.join(root, 'src/index.ts');
  const indexSourceFile = context.program.getSourceFile(indexPath);
  if (!indexSourceFile) throw new Error(`runtime src/index.ts is missing under ${root}`);
  const checks = [
    ['context-exact-set', () => runContextExactSet({root, invariant})],
    ['command-mount-shape', () => runCommandMountShape({root, invariant})],
    ['owner-kind', () => runOwnerKind({root, graphPath})],
    ['restart-positive', () => runRestartPositive({root})],
    ['ledger-record-shape', () => runLedgerRecordShape({root, invariant})],
  ];
  const results = checks.map(([name, check]) => {
    try {
      check();
      return {name, status: 'PASS'};
    } catch (error) {
      return {name, status: 'FAIL', error: error instanceof Error ? error.message : String(error)};
    }
  });
  let support;
  try {
    runPublicSupport({checker: context.checker, indexSourceFile, root, invariant});
    support = {status: 'PASS'};
  } catch (error) {
    support = {status: 'FAIL', error: error instanceof Error ? error.message : String(error)};
  }
  return {results, support};
}

function printUsage() {
  console.log('Usage: node tools/terminal-runtime/check-static.mjs [--help]');
  console.log('Runs five runtime rule gates and one exact public-surface support check.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const report = runRuntimeStaticChecks();
  console.log(`RUNTIME_RULE_GATES=${RUNTIME_RULE_NAMES.length}`);
  console.log(`RUNTIME_SUPPORT_CHECKS=${RUNTIME_SUPPORT_CHECK_COUNT}`);
  for (const result of report.results) {
    console.log(`RUNTIME_RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`);
    if (result.error) console.error(`RUNTIME_FIRST_FAILURE:${result.name}:${result.error}`);
  }
  console.log(`RUNTIME_SUPPORT_EXPORTS=${report.support.status}`);
  if (report.support.error) console.error(`RUNTIME_SUPPORT_FAILURE:${report.support.error}`);
  const failed = report.results.some(result => result.status !== 'PASS') || report.support.status !== 'PASS';
  if (failed) process.exit(1);
  console.log('TERMINAL_RUNTIME_STATIC=PASS');
}
