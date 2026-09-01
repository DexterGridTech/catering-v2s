import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import ts from 'typescript';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolDirectory, '../..');
export const contractsRoot = path.join(repoRoot, 'apps/terminal/kernel/base/contracts');

export const CONTRACT_RULE_NAMES = Object.freeze([
  'zero-adapter-capability',
  'tr05-named-boundary',
  'runtime-id-prefix-exact-set',
  'closed-literal-unions',
]);
export const CONTRACT_SUPPORT_CHECK_COUNT = 1;

const expectedRuntimeIdPrefixes = Object.freeze({
  runtime: 'run',
  request: 'req',
  command: 'cmd',
  session: 'ses',
  node: 'nod',
  connection: 'con',
  envelope: 'env',
  dispatch: 'dsp',
  projection: 'prj',
});

const expectedLiteralUnions = Object.freeze({
  ErrorCategory: ['BUSINESS', 'VALIDATION', 'AUTHENTICATION', 'AUTHORIZATION', 'NETWORK', 'DATABASE', 'EXTERNAL_API', 'SYSTEM', 'UNKNOWN'],
  ErrorSeverity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
  ParameterValueType: ['string', 'number', 'boolean', 'json'],
  RequestLifecycleStatus: ['started', 'completed', 'partial-failed', 'timed-out', 'error'],
  'CommandRouteContext.workspace': ['MAIN', 'BRANCH'],
  'CommandRouteContext.instanceMode': ['MASTER', 'SLAVE'],
  'CommandRouteContext.displayMode': ['PRIMARY', 'SECONDARY'],
});

const forbiddenCapabilityIdentifiers = new Set([
  'fetch',
  'XMLHttpRequest',
  'localStorage',
  'AsyncStorage',
  'process',
  'fs',
  'readFile',
  'readFileSync',
  'writeFile',
  'writeFileSync',
  'NativeModules',
  'TurboModuleRegistry',
  'requireNativeModule',
  'requireOptionalNativeModule',
]);

const forbiddenImportPattern = /^(?:node:)?(?:fs(?:\/|$)|path$|os$|child_process$|react(?:-native)?(?:\/|$)|expo(?:-|\/|$)|@react-native(?:\/|$))/;

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

function relativeSourcePath(filePath, root) {
  return path.relative(root, filePath) || filePath;
}

function createProgram(root) {
  const files = sourceFiles(root);
  const options = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true,
  };
  const program = ts.createProgram(files, options);
  return {files, program, checker: program.getTypeChecker()};
}

function syntaxKindName(node) {
  return ts.SyntaxKind[node.kind] ?? 'unknown';
}

function location(node, sourceFile, root) {
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
  return `${relativeSourcePath(sourceFile.fileName, root)}:${line}`;
}

function throwViolation(message, node, sourceFile, root) {
  throw new Error(`${message} at ${location(node, sourceFile, root)}`);
}

function importModuleText(node) {
  return ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
}

function runZeroAdapterCapability({root, files}) {
  for (const filePath of files) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;
      const moduleName = importModuleText(statement);
      if (moduleName && forbiddenImportPattern.test(moduleName)) {
        throwViolation(`forbidden adapter/platform import ${moduleName}`, statement, sourceFile, root);
      }
    }
    function visit(node) {
      if (ts.isIdentifier(node) && forbiddenCapabilityIdentifiers.has(node.text)) {
        throwViolation(`forbidden adapter/platform capability ${node.text}`, node, sourceFile, root);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const moduleName = node.arguments[0] && ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (moduleName && forbiddenImportPattern.test(moduleName)) {
          throwViolation(`forbidden dynamic adapter/platform import ${moduleName}`, node, sourceFile, root);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
}

function isExported(node) {
  return node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function isUnknownOrAnyType(typeNode) {
  return typeNode.kind === ts.SyntaxKind.UnknownKeyword || typeNode.kind === ts.SyntaxKind.AnyKeyword;
}

function isForbiddenRecordUnknown(node) {
  if (!ts.isTypeReferenceNode(node)) return false;
  if (node.typeName.getText() !== 'Record' || node.typeArguments?.length !== 2) return false;
  const [keyType, valueType] = node.typeArguments;
  return keyType.kind === ts.SyntaxKind.StringKeyword && valueType.kind === ts.SyntaxKind.UnknownKeyword;
}

function scanTypeNode(typeNode, sourceFile, root, context) {
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      throwViolation(`TR-05 any in ${context}`, node, sourceFile, root);
    }
    if (isForbiddenRecordUnknown(node)) {
      throwViolation(`TR-05 Record<string, unknown> in ${context}`, node, sourceFile, root);
    }
    ts.forEachChild(node, visit);
  }
  visit(typeNode);
}

function scanTypeParameters(typeParameters, sourceFile, root) {
  for (const typeParameter of typeParameters ?? []) {
    if (typeParameter.constraint) scanTypeNode(typeParameter.constraint, sourceFile, root, 'generic constraint');
    if (typeParameter.default) scanTypeNode(typeParameter.default, sourceFile, root, 'generic default');
  }
}

function scanParameters(parameters, sourceFile, root, context) {
  for (const parameter of parameters ?? []) {
    if (parameter.type) scanTypeNode(parameter.type, sourceFile, root, `${context} parameter`);
  }
}

function scanSignatureLike(node, sourceFile, root, context) {
  scanTypeParameters(node.typeParameters, sourceFile, root);
  scanParameters(node.parameters, sourceFile, root, context);
  if (node.type) scanTypeNode(node.type, sourceFile, root, `${context} return`);
}

function scanInterfaceMembers(node, sourceFile, root) {
  for (const member of node.members) {
    if (ts.isPropertySignature(member) && member.type) {
      scanTypeNode(member.type, sourceFile, root, 'exported interface member');
    } else if (
      ts.isMethodSignature(member) ||
      ts.isCallSignatureDeclaration(member) ||
      ts.isConstructSignatureDeclaration(member)
    ) {
      scanSignatureLike(member, sourceFile, root, 'exported interface signature');
    } else if (ts.isIndexSignatureDeclaration(member)) {
      scanParameters(member.parameters, sourceFile, root, 'exported interface index signature');
      if (member.type) scanTypeNode(member.type, sourceFile, root, 'exported interface index signature return');
    }
  }
}

export function runTr05NamedBoundary({root, files}) {
  for (const filePath of files) {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    function visitDoubleAssertion(node) {
      if (
        ts.isAsExpression(node) &&
        (ts.isAsExpression(node.expression) || ts.isTypeAssertionExpression(node.expression)) &&
        isUnknownOrAnyType(node.expression.type)
      ) {
        throwViolation('TR-05 double assertion', node, sourceFile, root);
      }
      ts.forEachChild(node, visitDoubleAssertion);
    }
    visitDoubleAssertion(sourceFile);

    for (const statement of sourceFile.statements) {
      if (!isExported(statement)) continue;
      if (ts.isInterfaceDeclaration(statement)) {
        scanTypeParameters(statement.typeParameters, sourceFile, root);
        scanInterfaceMembers(statement, sourceFile, root);
      } else if (ts.isTypeAliasDeclaration(statement)) {
        scanTypeParameters(statement.typeParameters, sourceFile, root);
        scanTypeNode(statement.type, sourceFile, root, 'exported type alias');
      } else if (ts.isFunctionDeclaration(statement)) {
        scanSignatureLike(statement, sourceFile, root, 'exported function');
      } else if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          if (declaration.type) scanTypeNode(declaration.type, sourceFile, root, 'exported variable');
          const initializer = declaration.initializer;
          if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
            scanSignatureLike(initializer, sourceFile, root, 'exported function value');
          }
        }
      } else if (ts.isClassDeclaration(statement)) {
        for (const member of statement.members) {
          if (ts.isMethodDeclaration(member)) scanSignatureLike(member, sourceFile, root, 'exported class method');
        }
      }
    }
  }
}

function resolveAliasedSymbol(checker, symbol) {
  let current = symbol;
  const seen = new Set();
  while (current && (current.flags & ts.SymbolFlags.Alias) && !seen.has(current)) {
    seen.add(current);
    const next = checker.getAliasedSymbol(current);
    if (!next || next === current) break;
    current = next;
  }
  return current;
}

function isForbiddenRecordType(type) {
  if (!type?.aliasSymbol || type.aliasSymbol.name !== 'Record') return false;
  const [keyType, valueType] = type.aliasTypeArguments ?? [];
  return Boolean(
    keyType
      && valueType
      && keyType.flags & ts.TypeFlags.String
      && valueType.flags & ts.TypeFlags.Unknown,
  );
}

function isSourceWithinRoot(filePath, root) {
  const relative = path.relative(root, filePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function scanCheckerType(type, checker, root, originNode, originSourceFile, state, context) {
  if (!type || state.types.has(type)) return;
  state.types.add(type);

  if (type.flags & ts.TypeFlags.Any) {
    throwViolation(`TR-05 any in ${context}`, originNode, originSourceFile, root);
  }
  if (isForbiddenRecordType(type)) {
    throwViolation(`TR-05 Record<string, unknown> in ${context}`, originNode, originSourceFile, root);
  }

  if (type.isUnionOrIntersection?.()) {
    for (const member of type.types) {
      scanCheckerType(member, checker, root, originNode, originSourceFile, state, context);
    }
  }

  for (const typeArgument of type.aliasTypeArguments ?? []) {
    scanCheckerType(typeArgument, checker, root, originNode, originSourceFile, state, context);
  }

  for (const property of type.getProperties?.() ?? []) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? originNode;
    const sourceFile = declaration?.getSourceFile?.() ?? originSourceFile;
    if (!sourceFile || !isSourceWithinRoot(sourceFile.fileName, root)) continue;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration ?? originNode);
    scanCheckerType(propertyType, checker, root, declaration ?? originNode, sourceFile, state, `${context} member`);
  }

  for (const signature of [
    ...(type.getCallSignatures?.() ?? []),
    ...(type.getConstructSignatures?.() ?? []),
  ]) {
    const declaration = signature.declaration ?? originNode;
    const sourceFile = declaration?.getSourceFile?.() ?? originSourceFile;
    if (!sourceFile || !isSourceWithinRoot(sourceFile.fileName, root)) continue;
    for (const parameter of signature.parameters ?? []) {
      const parameterDeclaration = parameter.valueDeclaration ?? parameter.declarations?.[0] ?? declaration;
      const parameterSourceFile = parameterDeclaration?.getSourceFile?.() ?? sourceFile;
      scanCheckerType(
        checker.getTypeOfSymbolAtLocation(parameter, parameterDeclaration ?? declaration),
        checker,
        root,
        parameterDeclaration ?? declaration,
        parameterSourceFile,
        state,
        `${context} parameter`,
      );
    }
    scanCheckerType(
      checker.getReturnTypeOfSignature(signature),
      checker,
      root,
      declaration,
      sourceFile,
      state,
      `${context} return`,
    );
  }

  for (const indexInfo of checker.getIndexInfosOfType?.(type) ?? []) {
    scanCheckerType(indexInfo.keyType, checker, root, originNode, originSourceFile, state, `${context} index key`);
    scanCheckerType(indexInfo.type, checker, root, originNode, originSourceFile, state, `${context} index value`);
  }
}

function scanCheckerExportSymbol(symbol, checker, root, state) {
  const resolved = resolveAliasedSymbol(checker, symbol);
  if (!resolved || state.symbols.has(resolved)) return;
  state.symbols.add(resolved);

  for (const declaration of resolved.declarations ?? []) {
    const sourceFile = declaration.getSourceFile();
    const nameNode = declaration.name ?? declaration;
    if (ts.isTypeAliasDeclaration(declaration)) {
      scanTypeParameters(declaration.typeParameters, sourceFile, root);
      scanCheckerType(
        checker.getTypeFromTypeNode(declaration.type),
        checker,
        root,
        declaration.type,
        sourceFile,
        state,
        `exported type alias ${resolved.name}`,
      );
    } else if (ts.isInterfaceDeclaration(declaration)) {
      scanTypeParameters(declaration.typeParameters, sourceFile, root);
      scanCheckerType(
        checker.getDeclaredTypeOfSymbol(resolved),
        checker,
        root,
        nameNode,
        sourceFile,
        state,
        `exported interface ${resolved.name}`,
      );
    } else if (ts.isFunctionDeclaration(declaration)) {
      scanTypeParameters(declaration.typeParameters, sourceFile, root);
      scanCheckerType(
        checker.getTypeOfSymbolAtLocation(resolved, declaration),
        checker,
        root,
        nameNode,
        sourceFile,
        state,
        `exported function ${resolved.name}`,
      );
    } else if (ts.isVariableDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
      scanCheckerType(
        checker.getTypeOfSymbolAtLocation(resolved, declaration),
        checker,
        root,
        nameNode,
        sourceFile,
        state,
        `exported value ${resolved.name}`,
      );
    }
  }
}

export function runTr05CheckerBoundary({root, files, program, checker}) {
  const state = {symbols: new Set(), types: new Set()};
  for (const filePath of files) {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) continue;
    const module = checker.getSymbolAtLocation(sourceFile);
    if (!module) continue;
    for (const symbol of checker.getExportsOfModule(module)) {
      scanCheckerExportSymbol(symbol, checker, root, state);
    }
  }
}

function moduleSymbol(checker, indexSourceFile) {
  const symbol = checker.getSymbolAtLocation(indexSourceFile);
  if (!symbol) throw new Error('contracts src/index.ts has no module symbol');
  return symbol;
}

function exportSymbol(checker, indexSourceFile, name) {
  const symbol = checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile)).find(candidate => candidate.name === name);
  if (!symbol) throw new Error(`contracts public export ${name} is missing`);
  return symbol;
}

function stringLiteralUnion(checker, symbol, label) {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const members = type.isUnion() ? type.types : [type];
  if (!members.length || members.some(member => !(member.flags & ts.TypeFlags.StringLiteral))) {
    throw new Error(`${label} must be a string literal union`);
  }
  return members.map(member => member.value).sort();
}

function runRuntimeIdPrefixExactSet({root, checker, indexSourceFile}) {
  const kindSymbol = exportSymbol(checker, indexSourceFile, 'RuntimeIdKind');
  const kindValues = stringLiteralUnion(checker, kindSymbol, 'RuntimeIdKind');
  const expectedKinds = Object.keys(expectedRuntimeIdPrefixes).sort();
  if (JSON.stringify(kindValues) !== JSON.stringify(expectedKinds)) {
    throw new Error(`RuntimeIdKind mismatch; expected=${JSON.stringify(expectedKinds)} actual=${JSON.stringify(kindValues)}`);
  }

  const prefixesSymbol = exportSymbol(checker, indexSourceFile, 'runtimeIdPrefixes');
  const declaration = prefixesSymbol.valueDeclaration ?? prefixesSymbol.declarations?.[0];
  const prefixesType = checker.getTypeOfSymbolAtLocation(prefixesSymbol, declaration);
  const actualKeys = prefixesType.getProperties().map(property => property.name).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKinds)) {
    throw new Error(`runtimeIdPrefixes keys mismatch; missing/extra against ${JSON.stringify(expectedKinds)} actual=${JSON.stringify(actualKeys)}`);
  }
  const actualValues = {};
  for (const property of prefixesType.getProperties()) {
    const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
    const propertyType = checker.getTypeOfSymbolAtLocation(property, propertyDeclaration);
    const value = propertyType.flags & ts.TypeFlags.StringLiteral ? propertyType.value : undefined;
    if (value === undefined) throw new Error(`runtimeIdPrefixes.${property.name} must be a string literal`);
    actualValues[property.name] = value;
  }
  if (JSON.stringify(actualValues) !== JSON.stringify(expectedRuntimeIdPrefixes)) {
    throw new Error(`runtimeIdPrefixes values mismatch; expected=${JSON.stringify(expectedRuntimeIdPrefixes)} actual=${JSON.stringify(actualValues)}`);
  }
  if (new Set(Object.values(actualValues)).size !== expectedKinds.length) {
    throw new Error('runtimeIdPrefixes values must be unique');
  }
  void root;
}

function typeProperty(checker, indexSourceFile, typeName, propertyName) {
  const symbol = exportSymbol(checker, indexSourceFile, typeName);
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const property = checker.getPropertyOfType(type, propertyName);
  if (!property) throw new Error(`${typeName}.${propertyName} is missing`);
  const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
  return {
    type: checker.getTypeOfSymbolAtLocation(property, propertyDeclaration),
    optional: Boolean(property.flags & ts.SymbolFlags.Optional),
  };
}

function requiredStringLiteralMembers(type, label, optional) {
  const members = type.isUnion() ? type.types : [type];
  const literalMembers = members.filter(member => member.flags & ts.TypeFlags.StringLiteral);
  const nonUndefinedMembers = optional
    ? members.filter(member => !(member.flags & ts.TypeFlags.Undefined))
    : members;
  if (!literalMembers.length || nonUndefinedMembers.some(member => !(member.flags & ts.TypeFlags.StringLiteral))) {
    throw new Error(`${label} must be a string literal union`);
  }
  return literalMembers.map(member => member.value).sort();
}

function runClosedLiteralUnions({checker, indexSourceFile}) {
  for (const [label, expectedValues] of Object.entries(expectedLiteralUnions)) {
    const actualValues = label.includes('.')
      ? (() => {
          const [typeName, propertyName] = label.split('.');
          const property = typeProperty(checker, indexSourceFile, typeName, propertyName);
          return requiredStringLiteralMembers(property.type, label, property.optional);
        })()
      : stringLiteralUnion(checker, exportSymbol(checker, indexSourceFile, label), label);
    const expected = [...expectedValues].sort();
    if (JSON.stringify(actualValues) !== JSON.stringify(expected)) {
      throw new Error(`${label} mismatch; expected=${JSON.stringify(expected)} actual=${JSON.stringify(actualValues)}`);
    }
  }
}

const expectedPublicExports = Object.freeze([
  'moduleName', 'dependencyModuleNames', 'devDependencyModuleNames',
  'TimestampMs', 'RuntimeInstanceId', 'RequestId', 'CommandId', 'SessionId', 'NodeId', 'ConnectionId', 'EnvelopeId', 'DispatchId', 'ProjectionId', 'RuntimeIdKind',
  'runtimeIdPrefixes', 'createRuntimeId', 'createRuntimeInstanceId', 'createRequestId', 'createCommandId', 'createSessionId', 'createNodeId', 'createConnectionId', 'createEnvelopeId', 'createDispatchId', 'createProjectionId', 'nowTimestampMs',
  'ErrorCategory', 'ErrorSeverity', 'ErrorDefinition', 'ErrorTemplateValue', 'ErrorTemplateArguments', 'RenderedErrorTemplate', 'AppError', 'CreateAppErrorContext', 'CreateAppErrorInput', 'renderErrorTemplate', 'createAppError', 'isAppError',
  'ParameterValueType', 'ParameterDefinition', 'ParameterDescriptor', 'DefineErrorInput', 'DefineParameterInput', 'ModuleErrorFactory', 'ModuleParameterFactory', 'createModuleErrorFactory', 'createModuleParameterFactory', 'listDefinitions',
  'AppModuleKind', 'AppModuleDependency', 'AppModuleCommandDescriptor', 'AppModuleActorDescriptor', 'AppModuleSliceDescriptor', 'AppModule',
  'CommandLifecycleStatus', 'RequestLifecycleStatus', 'CommandResultPatch', 'CommandResultSnapshot', 'RequestCommandSnapshot', 'RequestLifecycleSnapshot', 'CommandRouteContext',
  'TransportRequestContext', 'TransportServerAddress', 'TransportServerDefinition', 'TransportServerConfigSpace', 'TransportServerConfig', 'TransportServerAddressOverride', 'TransportServerOverride', 'ResolveTransportServerConfigOptions',
]);

function runPublicSupport({checker, indexSourceFile, root}) {
  const module = moduleSymbol(checker, indexSourceFile);
  const actual = checker.getExportsOfModule(module).map(symbol => symbol.name).sort();
  const expected = [...expectedPublicExports].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length || new Set(actual).size !== actual.length) {
    throw new Error(`public export exact-set mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} actualCount=${actual.length}`);
  }
  for (const statement of indexSourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.exportClause) {
      throwViolation('public index must not use export *', statement, indexSourceFile, root);
    }
  }
}

export function runContractsStaticChecks({contractsRoot: root = contractsRoot} = {}) {
  const context = createProgram(root);
  const indexSourceFile = context.program.getSourceFile(path.join(root, 'src/index.ts'));
  if (!indexSourceFile) throw new Error(`contracts src/index.ts is missing under ${root}`);
  const checks = [
    ['zero-adapter-capability', () => runZeroAdapterCapability({root, files: context.files})],
    ['tr05-named-boundary', () => {
      runTr05NamedBoundary({root, files: context.files});
      runTr05CheckerBoundary({root, ...context});
    }],
    ['runtime-id-prefix-exact-set', () => runRuntimeIdPrefixExactSet({root, ...context, indexSourceFile})],
    ['closed-literal-unions', () => runClosedLiteralUnions({root, ...context, indexSourceFile})],
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
    runPublicSupport({checker: context.checker, indexSourceFile, root});
    support = {status: 'PASS'};
  } catch (error) {
    support = {status: 'FAIL', error: error instanceof Error ? error.message : String(error)};
  }
  return {results, support};
}

function printUsage() {
  console.log('Usage: node tools/terminal-contracts/check-static.mjs [--help]');
  console.log('Runs four contracts rule gates and one exact public-surface support check.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const report = runContractsStaticChecks();
  console.log(`CONTRACT_RULE_GATES=${CONTRACT_RULE_NAMES.length}`);
  console.log(`CONTRACT_SUPPORT_CHECKS=${CONTRACT_SUPPORT_CHECK_COUNT}`);
  for (const result of report.results) {
    console.log(`CONTRACT_RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`);
    if (result.error) console.error(`CONTRACT_FIRST_FAILURE:${result.name}:${result.error}`);
  }
  console.log(`CONTRACT_SUPPORT=${report.support.status}`);
  if (report.support.error) console.error(`CONTRACT_SUPPORT_FAILURE:${report.support.error}`);
  const failed = report.results.some(result => result.status !== 'PASS') || report.support.status !== 'PASS';
  if (failed) process.exit(1);
  console.log('TERMINAL_CONTRACTS_STATIC=PASS');
}
