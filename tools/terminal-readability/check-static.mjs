import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {fileURLToPath} from 'node:url';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolDirectory, '../..');

export const VOCABULARY = Object.freeze([
  'types',
  'foundations',
  'implementations',
  'features',
  'selectors',
  'application',
  'components',
  'hooks',
  'contexts',
  'defaults',
  'parts',
  'assembly',
  'theme',
  'vendor',
  'generated',
  'testing',
]);

export const LEGAL_SOURCE_FILES = Object.freeze(['index.ts', 'moduleName.ts', 'dependencies.ts']);
export const FEATURE_DIRECTORIES = Object.freeze(['actors', 'commands', 'slices', 'variables']);
const PORT_DESCRIPTOR_KEY_TEXT = 'catering-v2s.platform-ports.descriptor';

const descriptorCapabilities = (keys, state, source) => Object.freeze(keys.map(capability => Object.freeze({
  capability,
  state,
  source,
})));

const DEVICE_CAPABILITIES = Object.freeze([
  'getDeviceInfo',
  'getDisplayInfo',
  'getSystemStatus',
  'getPowerStatus',
  'subscribePowerStatus',
  'unsubscribePowerStatus',
]);
const STORAGE_CAPABILITIES = Object.freeze([
  'read',
  'write',
  'remove',
  'readMany',
  'writeMany',
  'removeMany',
  'listKeys',
  'clear',
]);

const unavailableDescriptor = (port, keys) => ({
  port,
  capabilities: descriptorCapabilities(keys, 'unavailable', 'default'),
});

const realDescriptor = (port, keys, source) => ({
  port,
  capabilities: descriptorCapabilities(keys, 'real', source),
});

const partialDeviceDescriptor = source => ({
  port: 'device',
  capabilities: Object.freeze([
    ...descriptorCapabilities(['getDeviceInfo'], 'unavailable', 'default'),
    ...descriptorCapabilities(['getDisplayInfo'], 'real', source),
    ...descriptorCapabilities(DEVICE_CAPABILITIES.slice(2), 'unavailable', 'default'),
  ]),
});

const androidDeviceDescriptor = source => ({
  port: 'device',
  capabilities: Object.freeze([
    ...descriptorCapabilities(['getDeviceInfo', 'getDisplayInfo'], 'real', source),
    ...descriptorCapabilities(DEVICE_CAPABILITIES.slice(2), 'unavailable', 'default'),
  ]),
});

export const PORT_DESCRIPTOR_ATTACHMENTS = Object.freeze([
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/logger.ts', ...realDescriptor('logger', ['write'], 'default')},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts', ...unavailableDescriptor('appControl', ['resetRuntime', 'exitApplication', 'clearHostDataCache', 'setFullscreen', 'getFullscreen', 'setKioskMode', 'getKioskMode', 'showNativeLoading', 'hideNativeLoading'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableConnector.ts', ...unavailableDescriptor('connector', ['call', 'subscribe', 'unsubscribe', 'on'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableDevice.ts', ...unavailableDescriptor('device', DEVICE_CAPABILITIES)},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableHotUpdate.ts', ...unavailableDescriptor('hotUpdate', ['downloadPackage', 'writeBootMarker', 'readBootMarker', 'readActiveMarker', 'readRollbackMarker', 'clearBootMarker', 'confirmLoadComplete'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableLogUpload.ts', ...unavailableDescriptor('logUpload', ['uploadLogsForDate'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailablePersistSecure.ts', ...unavailableDescriptor('persistSecure', STORAGE_CAPABILITIES)},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableScript.ts', ...unavailableDescriptor('script', ['execute', 'getStats', 'clearStats'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/unavailableTopologyHost.ts', ...unavailableDescriptor('topologyHost', ['start', 'stop', 'getStatus', 'getDiagnosticsSnapshot'])},
  {path: 'apps/terminal/kernel/base/platform-ports/src/defaults/processMemoryStorage.ts', ...realDescriptor('persistKv', STORAGE_CAPABILITIES, 'default')},
  {path: 'apps/terminal/adapter/android/device/src/implementations/androidDevice.ts', ...androidDeviceDescriptor('adapter')},
  {path: 'apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts', ...realDescriptor('persistKv', STORAGE_CAPABILITIES, 'adapter')},
  {path: 'apps/terminal/ui/base/dev-host/src/implementations/webPlatform.ts', ...partialDeviceDescriptor('web')},
  {path: 'apps/terminal/ui/base/dev-host/src/implementations/webStorage.ts', ...realDescriptor('persistKv', STORAGE_CAPABILITIES, 'web')},
].map(attachment => Object.freeze({
  ...attachment,
  capabilities: Object.freeze(attachment.capabilities),
})));

export const RULE_TIERS = Object.freeze({
  'TR-R01': 'R',
  'TR-R02': 'L',
  'TR-R03': 'L',
  'TR-R04': 'L',
  'TR-R05': 'L',
  'TR-R06': 'L',
  'TR-R07': 'L',
});

const RULE_CHECKERS = Object.freeze({
  'TR-R02': 'tr-r02-local-export',
  'TR-R03': 'tr-r03-create-element',
  'TR-R04': 'tr-r04-parameter-count',
  'TR-R05': 'tr-r05-control-depth',
  'TR-R06': 'tr-r06-source-layout',
  'TR-R07': 'tr-r07-testing-graph',
});

const SKIP_DIRECTORY_NAMES = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.expo',
  'build',
  'dist',
  'android/build',
  'android/app/build',
  'android/.gradle',
]);
const SOURCE_PATTERN = /\.(?:ts|tsx|mts|cts)$/;
const TS_SOURCE_PATTERN = /\.(?:ts|tsx)$/;
const TR_R03_ALLOWLIST = 'apps/terminal/ui/base/render/src/components/resolvePart.ts';

function slash(value) {
  return value.split(path.sep).join('/');
}

function relativePath(root, filePath) {
  return slash(path.relative(root, filePath));
}

function isSkippedDirectory(relative) {
  return relative.split('/').some(segment => SKIP_DIRECTORY_NAMES.has(segment))
    || relative.includes('/android/build/')
    || relative.includes('/android/app/build/')
    || relative.includes('/android/.gradle/');
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${filePath}: ${error.message}`);
  }
}

export function terminalSourceRoot(root) {
  const candidate = path.join(root, 'apps/terminal');
  return fs.existsSync(candidate) ? candidate : root;
}

export function collectSourceFiles(root) {
  return collectPackageRoots(root)
    .flatMap(packageEntry => sourceFilesForPackage(packageEntry))
    .sort();
}

export function collectPackageRoots(root) {
  const sourceRoot = terminalSourceRoot(root);
  const packages = [];
  const visit = directory => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      const relative = relativePath(root, entryPath);
      if (entry.isDirectory()) {
        if (!isSkippedDirectory(relative)) visit(entryPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== 'package.json') continue;
      const packageDirectory = path.dirname(entryPath);
      if (packageDirectory === sourceRoot) continue;
      const sourceDirectory = path.join(packageDirectory, 'src');
      if (!fs.existsSync(sourceDirectory)) continue;
      const packageJson = readJson(entryPath, `package.json for ${relativePath(root, packageDirectory)}`);
      packages.push({
        directory: packageDirectory,
        sourceDirectory,
        packageJson,
        moduleName: moduleNameForPackage(root, packageDirectory),
      });
    }
  };
  visit(sourceRoot);
  return packages.sort((left, right) => left.directory.localeCompare(right.directory));
}

function moduleNameForPackage(root, packageDirectory) {
  const relative = path.relative(terminalSourceRoot(root), packageDirectory);
  const segments = relative.split(path.sep).filter(Boolean);
  return segments.length === 3 ? segments.join('.') : null;
}

function sourceFilesForPackage(packageEntry) {
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!isSkippedDirectory(relativePath(packageEntry.directory, entryPath))) visit(entryPath);
      } else if (entry.isFile() && SOURCE_PATTERN.test(entry.name)) {
        files.push(entryPath);
      }
    }
  };
  visit(packageEntry.sourceDirectory);
  return files.sort();
}

function sourceFile(root, filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function finding(root, ruleId, filePath, node, message) {
  const source = node?.getSourceFile?.() ?? sourceFile(root, filePath);
  const position = node?.getStart?.(source) ?? 0;
  return {
    ruleId,
    file: relativePath(root, filePath),
    line: source.getLineAndCharacterOfPosition(position).line + 1,
    message,
  };
}

function throwIfFindings(ruleId, findings) {
  if (!findings.length) return;
  const first = findings[0];
  throw new Error(`${ruleId} ${first.file}:${first.line} ${first.message}; findings=${findings.length}`);
}

function isNamedProperty(node, name) {
  if (!node?.name) return false;
  return (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) && node.name.text === name;
}

function objectProperty(object, name) {
  if (!ts.isObjectLiteralExpression(object)) return null;
  return object.properties.find(property => (
    (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property))
    && isNamedProperty(property, name)
  )) ?? null;
}

function propertyValue(object, name) {
  const property = objectProperty(object, name);
  if (!property) return null;
  return ts.isShorthandPropertyAssignment(property) ? property.name : property.initializer;
}

function isNamedMemberCall(node, objectName, memberName) {
  return ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && node.expression.expression.text === objectName
    && node.expression.name.text === memberName;
}

function isSymbolForCall(node) {
  return isNamedMemberCall(node, 'Symbol', 'for')
    && node.arguments.length === 1
    && ts.isStringLiteralLike(node.arguments[0])
    && node.arguments[0].text === PORT_DESCRIPTOR_KEY_TEXT;
}

function isObjectFreezeCall(node) {
  return isNamedMemberCall(node, 'Object', 'freeze') && node.arguments.length === 1;
}

function stringLiteralValues(node) {
  const values = new Set();
  const visit = current => {
    if (ts.isStringLiteralLike(current)) values.add(current.text);
    ts.forEachChild(current, visit);
  };
  visit(node);
  return values;
}

function hasFalseProperty(object, name) {
  const value = propertyValue(object, name);
  return value?.kind === ts.SyntaxKind.FalseKeyword;
}

function isUnderDevBranch(node, source) {
  let current = node.parent;
  while (current) {
    if (ts.isIfStatement(current)
      && ts.isIdentifier(current.expression)
      && current.expression.text === '__DEV__'
      && current.thenStatement.getStart(source) <= node.getStart(source)
      && current.thenStatement.end >= node.end) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function descriptorCalls(source) {
  const calls = [];
  const visit = node => {
    if (isNamedMemberCall(node, 'Object', 'defineProperty') && node.arguments.length === 3) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

function descriptorValue(call) {
  const propertyDescriptor = call.arguments[2];
  if (!ts.isObjectLiteralExpression(propertyDescriptor)) return null;
  const value = propertyValue(propertyDescriptor, 'value');
  if (!isObjectFreezeCall(value)) return null;
  const descriptor = value.arguments[0];
  return ts.isObjectLiteralExpression(descriptor) ? descriptor : null;
}

function hasFrozenCapabilityEntry(node) {
  let found = false;
  const visit = current => {
    if (found) return;
    if (isObjectFreezeCall(current)
      && ts.isObjectLiteralExpression(current.arguments[0])
      && objectProperty(current.arguments[0], 'capability')
      && objectProperty(current.arguments[0], 'state')
      && objectProperty(current.arguments[0], 'source')) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function keyDeclarationCount(source) {
  let count = 0;
  const visit = node => {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'PORT_DESCRIPTOR_KEY'
      && isSymbolForCall(node.initializer)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

function checkDescriptorAttachment(root, attachment) {
  const filePath = path.join(root, attachment.path);
  const findings = [];
  if (!fs.existsSync(filePath)) {
    return [{
      ruleId: 'RD-6',
      file: attachment.path,
      line: 1,
      message: 'descriptor attach site is missing',
    }];
  }
  const source = sourceFile(root, filePath);
  if (keyDeclarationCount(source) !== 1) {
    findings.push(finding(root, 'RD-6', filePath, source, `descriptor key must be Symbol.for('${PORT_DESCRIPTOR_KEY_TEXT}') exactly once`));
  }
  const allCalls = descriptorCalls(source).filter(call => {
    const key = call.arguments[1];
    return ts.isIdentifier(key) && key.text === 'PORT_DESCRIPTOR_KEY';
  });
  const calls = allCalls.filter(call => {
    const descriptor = descriptorValue(call);
    const portValue = descriptor === null ? null : propertyValue(descriptor, 'port');
    return portValue !== null && (
      (ts.isStringLiteralLike(portValue) && portValue.text === attachment.port)
      || (ts.isIdentifier(portValue) && portValue.text === 'port')
    );
  });
  if (calls.length !== 1) {
    findings.push(finding(root, 'RD-6', filePath, source, `exactly one descriptor defineProperty call must describe '${attachment.port}'`));
    return findings;
  }
  const call = calls[0];
  if (isUnderDevBranch(call, source)) {
    findings.push(finding(root, 'RD-6', filePath, call, 'descriptor attachment must be available in all supported builds; do not guard it with __DEV__'));
  }
  const descriptor = descriptorValue(call);
  if (!descriptor) {
    findings.push(finding(root, 'RD-6', filePath, call, 'descriptor value must be Object.freeze(object)'));
    return findings;
  }
  const descriptorNames = descriptor.properties
    .filter(property => ts.isPropertyAssignment(property))
    .map(property => property.name?.getText(source));
  if (descriptorNames.some(name => !['port', 'capabilities'].includes(name))) {
    findings.push(finding(root, 'RD-6', filePath, descriptor, 'descriptor may contain only port and capabilities'));
  }
  const portValue = propertyValue(descriptor, 'port');
  if (!((portValue && ts.isStringLiteralLike(portValue) && portValue.text === attachment.port)
    || (portValue && ts.isIdentifier(portValue) && portValue.text === 'port'))) {
    findings.push(finding(root, 'RD-6', filePath, descriptor, `descriptor port must be '${attachment.port}' or the factory port parameter`));
  }
  const capabilities = propertyValue(descriptor, 'capabilities');
  if (!isObjectFreezeCall(capabilities)) {
    findings.push(finding(root, 'RD-6', filePath, descriptor, 'descriptor capabilities must be Object.freeze(...)'));
  } else {
    if (!hasFrozenCapabilityEntry(capabilities)) {
      findings.push(finding(root, 'RD-6', filePath, capabilities, 'each capability descriptor must be frozen and contain capability/state/source'));
    }
    const values = stringLiteralValues(capabilities);
    for (const expected of attachment.capabilities) {
      if (!values.has(expected.capability)) {
        findings.push(finding(root, 'RD-6', filePath, capabilities, `missing capability '${expected.capability}'`));
      }
    }
    for (const state of new Set(attachment.capabilities.map(capability => capability.state))) {
      if (!values.has(state)) findings.push(finding(root, 'RD-6', filePath, capabilities, `missing descriptor state '${state}'`));
    }
    for (const sourceName of new Set(attachment.capabilities.map(capability => capability.source))) {
      if (!values.has(sourceName)) findings.push(finding(root, 'RD-6', filePath, capabilities, `missing descriptor source '${sourceName}'`));
    }
  }
  const propertyDescriptor = call.arguments[2];
  if (!ts.isObjectLiteralExpression(propertyDescriptor)
    || !hasFalseProperty(propertyDescriptor, 'enumerable')
    || !hasFalseProperty(propertyDescriptor, 'writable')
    || !hasFalseProperty(propertyDescriptor, 'configurable')) {
    findings.push(finding(root, 'RD-6', filePath, call, 'sidecar property descriptor must be non-enumerable, non-writable and non-configurable'));
  }
  return findings;
}

export function checkDescriptorProtocol(root = repoRoot) {
  return PORT_DESCRIPTOR_ATTACHMENTS.flatMap(attachment => checkDescriptorAttachment(root, attachment));
}

function hasBody(node) {
  return Boolean(node.body);
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node)
    || ts.isSetAccessorDeclaration(node);
}

function visitFunctionLikes(source, callback) {
  const visit = node => {
    if (isFunctionLike(node)) callback(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

export function checkTrR02(root) {
  const findings = [];
  for (const filePath of collectSourceFiles(root)) {
    if (path.basename(filePath) === 'index.ts') continue;
    const source = sourceFile(root, filePath);
    const visit = node => {
      if (ts.isExportDeclaration(node) && !node.moduleSpecifier) {
        findings.push(finding(root, 'TR-R02', filePath, node, 'local export block must be at the definition site'));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

function createWorkspaceProgram(root) {
  const packages = collectPackageRoots(root);
  const files = collectSourceFiles(root);
  const paths = {};
  for (const entry of packages) {
    const packageName = entry.packageJson.name;
    if (typeof packageName !== 'string') continue;
    paths[packageName] = [relativePath(root, path.join(entry.sourceDirectory, 'index.ts'))];
    paths[`${packageName}/*`] = [relativePath(root, path.join(entry.sourceDirectory, '*'))];
  }
  const options = {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    baseUrl: root,
    paths,
  };
  return {packages, files, options, program: ts.createProgram(files, options)};
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

function symbolIsReactCreateElement(checker, symbol) {
  const resolved = symbol ? resolveAliasedSymbol(checker, symbol) : null;
  if (!resolved || resolved.name !== 'createElement') return false;
  return (resolved.declarations ?? []).some(declaration => {
    const fileName = slash(declaration.getSourceFile().fileName);
    return fileName.includes('/node_modules/react/') || fileName.includes('/node_modules/@types/react/');
  });
}

function reactImportBindings(source) {
  const named = new Set();
  const namespaces = new Set();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== 'react') continue;
    const defaultBinding = statement.importClause?.name;
    if (defaultBinding) namespaces.add(defaultBinding.text);
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text);
    if (!ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName?.text ?? element.name.text) === 'createElement') named.add(element.name.text);
    }
  }
  return {named, namespaces};
}

function isCreateElementCall(checker, source, node) {
  const bindings = reactImportBindings(source);
  if (ts.isIdentifier(node.expression) && bindings.named.has(node.expression.text)) {
    return symbolIsReactCreateElement(checker, checker.getSymbolAtLocation(node.expression));
  }
  if (ts.isPropertyAccessExpression(node.expression)
    && ts.isIdentifier(node.expression.expression)
    && bindings.namespaces.has(node.expression.expression.text)
    && node.expression.name.text === 'createElement') {
    return symbolIsReactCreateElement(checker, checker.getSymbolAtLocation(node.expression.name));
  }
  return false;
}

export function checkTrR03(root) {
  const findings = [];
  const context = createWorkspaceProgram(root);
  const checker = context.program.getTypeChecker();
  for (const filePath of context.files) {
    if (!TS_SOURCE_PATTERN.test(filePath) || relativePath(root, filePath) === TR_R03_ALLOWLIST) continue;
    const source = context.program.getSourceFile(filePath) ?? sourceFile(root, filePath);
    const visit = node => {
      if (ts.isCallExpression(node) && isCreateElementCall(checker, source, node)) {
        findings.push(finding(root, 'TR-R03', filePath, node, 'React createElement is not allowed outside the registered renderer exception'));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

export function checkTrR04(root) {
  const findings = [];
  for (const filePath of collectSourceFiles(root)) {
    const source = sourceFile(root, filePath);
    visitFunctionLikes(source, node => {
      if (hasBody(node) && node.parameters.length > 3) {
        findings.push(finding(root, 'TR-R04', filePath, node, `function-like has ${node.parameters.length} parameters; maximum is 3`));
      }
    });
  }
  return findings;
}

const CONTROL_NODES = new Set([
  ts.SyntaxKind.IfStatement,
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
  ts.SyntaxKind.WhileStatement,
  ts.SyntaxKind.SwitchStatement,
  ts.SyntaxKind.TryStatement,
]);

function controlDepthFindings(root, filePath, functionNode) {
  const findings = [];
  const visit = (node, depth) => {
    if (node !== functionNode && isFunctionLike(node)) return;
    const nextDepth = CONTROL_NODES.has(node.kind) ? depth + 1 : depth;
    if (CONTROL_NODES.has(node.kind) && nextDepth > 3) {
      findings.push(finding(root, 'TR-R05', filePath, node, `control nesting depth ${nextDepth} exceeds 3`));
    }
    ts.forEachChild(node, child => visit(child, nextDepth));
  };
  if (functionNode.body) visit(functionNode.body, 0);
  return findings;
}

export function checkTrR05(root) {
  const findings = [];
  for (const filePath of collectSourceFiles(root)) {
    const source = sourceFile(root, filePath);
    visitFunctionLikes(source, node => findings.push(...controlDepthFindings(root, filePath, node)));
  }
  return findings;
}

export function checkTrR06(root) {
  const findings = [];
  const vocabulary = new Set(VOCABULARY);
  const featureDirectories = new Set(FEATURE_DIRECTORIES);
  for (const entry of collectPackageRoots(root)) {
    for (const child of fs.readdirSync(entry.sourceDirectory, {withFileTypes: true})) {
      const childPath = path.join(entry.sourceDirectory, child.name);
      if (child.isFile()) {
        if (!LEGAL_SOURCE_FILES.includes(child.name)) {
          findings.push({
            ruleId: 'TR-R06',
            file: relativePath(root, childPath),
            line: 1,
            message: `source root file must be one of ${LEGAL_SOURCE_FILES.join(', ')}`,
          });
        }
        continue;
      }
      if (!child.isDirectory() || !vocabulary.has(child.name)) {
        findings.push({
          ruleId: 'TR-R06',
          file: relativePath(root, childPath),
          line: 1,
          message: `source root directory must be one of ${VOCABULARY.join(', ')}`,
        });
        continue;
      }
      if (child.name !== 'features') continue;
      const featuresPath = childPath;
      for (const featureChild of fs.readdirSync(featuresPath, {withFileTypes: true})) {
        if (!featureChild.isDirectory() || !featureDirectories.has(featureChild.name)) {
          findings.push({
            ruleId: 'TR-R06',
            file: relativePath(root, path.join(featuresPath, featureChild.name)),
            line: 1,
            message: `features direct child must be one of ${FEATURE_DIRECTORIES.join(', ')}`,
          });
        }
      }
    }
  }
  return findings;
}

function runtimeImportDeclarations(source) {
  const declarations = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const importClause = statement.importClause;
      const namedBindings = importClause?.namedBindings;
      const isSpecifierTypeOnly = Boolean(
        importClause
        && !importClause.name
        && namedBindings
        && ts.isNamedImports(namedBindings)
        && namedBindings.elements.length > 0
        && namedBindings.elements.every(element => element.isTypeOnly),
      );
      if (!importClause?.isTypeOnly && !isSpecifierTypeOnly) {
        declarations.push({statement, specifier: statement.moduleSpecifier.text});
      }
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.isTypeOnly) continue;
      const exportClause = statement.exportClause;
      if (exportClause && ts.isNamedExports(exportClause)
        && exportClause.elements.length > 0
        && exportClause.elements.every(element => element.isTypeOnly)) continue;
      if (statement.moduleSpecifier) declarations.push({statement, specifier: statement.moduleSpecifier.text});
      continue;
    }
    if (ts.isImportEqualsDeclaration(statement)
      && ts.isExternalModuleReference(statement.moduleReference)
      && ts.isStringLiteral(statement.moduleReference.expression)) {
      declarations.push({statement, specifier: statement.moduleReference.expression.text});
    }
  }
  return declarations;
}

function resolveRuntimeImport(context, containingFile, specifier) {
  const result = ts.resolveModuleName(specifier, containingFile, context.options, ts.sys).resolvedModule;
  if (!result) return null;
  const resolved = path.resolve(result.resolvedFileName);
  return context.files.includes(resolved) ? resolved : null;
}

function packageForFile(context, filePath) {
  return context.packages.find(entry => {
    const prefix = `${entry.sourceDirectory}${path.sep}`;
    return filePath.startsWith(prefix);
  }) ?? null;
}

export function collectProductionImportGraph(root) {
  const context = createWorkspaceProgram(root);
  const files = new Set(context.files);
  const edges = [];
  const reachableByEntry = [];
  for (const entry of context.packages) {
    const entryPath = path.join(entry.sourceDirectory, 'index.ts');
    if (!files.has(entryPath)) continue;
    const reachable = new Set();
    const queue = [entryPath];
    while (queue.length) {
      const currentPath = queue.shift();
      if (reachable.has(currentPath)) continue;
      reachable.add(currentPath);
      const source = context.program.getSourceFile(currentPath) ?? sourceFile(root, currentPath);
      for (const declaration of runtimeImportDeclarations(source)) {
        const targetPath = resolveRuntimeImport(context, currentPath, declaration.specifier);
        if (!targetPath) continue;
        edges.push({sourcePath: currentPath, targetPath, specifier: declaration.specifier});
        if (!reachable.has(targetPath)) queue.push(targetPath);
      }
    }
    reachableByEntry.push({entry, entryPath, reachable});
  }
  return {context, edges, reachableByEntry};
}

function isTestingSource(filePath) {
  const normalized = slash(filePath);
  return normalized.includes('/src/testing/') || normalized.endsWith('/src/testing');
}

export function checkTrR07(root) {
  const graph = collectProductionImportGraph(root);
  const findings = [];
  for (const entry of graph.reachableByEntry) {
    for (const targetPath of entry.reachable) {
      if (isTestingSource(targetPath)) {
        findings.push({
          ruleId: 'TR-R07',
          file: relativePath(root, targetPath),
          line: 1,
          message: `production entry ${relativePath(root, entry.entryPath)} reaches src/testing`,
        });
      }
    }
  }
  return findings;
}

function layerOfPackage(entry, root) {
  const relative = relativePath(root, entry.directory);
  return relative.split('/')[2] ?? null;
}

function isInternalRuntimeOrRenderSpecifier(specifier, targetPath, context, root) {
  const targetPackage = packageForFile(context, targetPath);
  if (!targetPackage || !['kernel.base.runtime', 'ui.base.render'].includes(targetPackage.moduleName)) return false;
  return specifier.includes('/src/') || specifier.startsWith('.') && relativePath(root, targetPath).includes('/src/');
}

export function checkRd12(root) {
  const graph = collectProductionImportGraph(root);
  const findings = [];
  for (const edge of graph.edges) {
    const sourcePackage = packageForFile(graph.context, edge.sourcePath);
    const targetPackage = packageForFile(graph.context, edge.targetPath);
    if (!sourcePackage || !targetPackage) continue;
    if (layerOfPackage(sourcePackage, root) === 'kernel' && layerOfPackage(targetPackage, root) === 'ui') {
      findings.push({
        ruleId: 'RD-12',
        file: relativePath(root, edge.sourcePath),
        line: 1,
        message: `kernel production import reaches ui package via ${edge.specifier}`,
      });
    }
    if (sourcePackage.moduleName === 'ui.integration.sample-console'
      && /(?:^|\/)assembly(?:\/assembly)?\.tsx?$/.test(relativePath(root, edge.sourcePath))
      && isInternalRuntimeOrRenderSpecifier(edge.specifier, edge.targetPath, graph.context, root)) {
      findings.push({
        ruleId: 'RD-12',
        file: relativePath(root, edge.sourcePath),
        line: 1,
        message: `sample-console assembly imports a runtime/render internal path: ${edge.specifier}`,
      });
    }
  }
  return findings;
}

export function validateResponsibilityMatrix(matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return ['responsibility matrix is empty'];
  const errors = [];
  const requiredFields = [
    'ownerSource',
    'symbolOrTransition',
    'responsibilityFactFromSource',
    'testFile',
    'testNameOrOracle',
    'preObservation',
    'postObservation',
    'gapAction',
  ];
  const countOnlyOracle = /^(?:called|invoked|mock(?:ed)?|call count|invocation count)(?:\s+(?:once|twice|\d+ times))?$|^(?:调用一次|调用次数|mock调用次数)$/i;
  for (const row of matrix) {
    const label = row?.symbolOrTransition ?? '<unknown>';
    for (const field of requiredFields) {
      if (!row || typeof row[field] !== 'string' || !row[field].trim()) {
        errors.push(`${label} is missing ${field}`);
      }
    }
    for (const field of ['testNameOrOracle', 'preObservation', 'postObservation']) {
      if (typeof row?.[field] === 'string' && countOnlyOracle.test(row[field].trim())) {
        errors.push(`${label} has a call-count-only behavior oracle in ${field}`);
      }
    }
  }
  return errors;
}

export function validateSurfacePair(events) {
  if (!Array.isArray(events)) return ['surface events are not an array'];
  const errors = [];
  const expected = Object.freeze({
    declaredSurfaceSize: Object.freeze({owner: 'integration', field: 'declaredSurfaceSize'}),
    measuredSurfaceFrame: Object.freeze({owner: 'measurement', field: 'measuredSurfaceFrame'}),
  });
  const declared = events.filter(event => event?.kind === 'declaredSurfaceSize');
  const measured = events.filter(event => event?.kind === 'measuredSurfaceFrame');
  if (!declared.length) errors.push('declaredSurfaceSize is missing');
  if (!measured.length) errors.push('measuredSurfaceFrame is missing');
  for (const event of events) {
    const rule = expected[event?.kind];
    if (!rule) {
      errors.push(`unknown surface event kind ${event?.kind ?? '<unknown>'}`);
      continue;
    }
    if (event.owner !== rule.owner) errors.push(`${event.kind} owner must be ${rule.owner}`);
    if (event.field !== rule.field) errors.push(`${event.kind} field must be ${rule.field}`);
  }
  return errors;
}

function validateCatalog(root) {
  const catalogPath = path.join(root, 'tools/terminal-readability/rule-catalog.json');
  const catalog = readJson(catalogPath, 'readability rule catalog');
  if (!Array.isArray(catalog) || catalog.length !== 7) throw new Error('rule catalog must contain exactly 7 rows');
  const seen = new Set();
  for (const row of catalog) {
    if (!row || Object.keys(row).sort().join(',') !== 'ruleId,tier') throw new Error('rule catalog rows must contain only ruleId and tier');
    if (!RULE_TIERS[row.ruleId] || seen.has(row.ruleId) || RULE_TIERS[row.ruleId] !== row.tier) {
      throw new Error(`rule catalog tier mismatch for ${row?.ruleId ?? '<unknown>'}`);
    }
    seen.add(row.ruleId);
  }
  if (seen.size !== Object.keys(RULE_TIERS).length) throw new Error('rule catalog rule IDs are not closed');
  return catalog;
}

function validateManifest(root, catalog) {
  const manifestPath = path.join(root, 'tools/terminal-readability/checker-manifest.json');
  const manifest = readJson(manifestPath, 'readability checker manifest');
  const expectedIds = Object.entries(RULE_TIERS).filter(([, tier]) => tier === 'L').map(([ruleId]) => ruleId).sort();
  if (!Array.isArray(manifest) || manifest.length !== expectedIds.length) throw new Error('checker manifest must contain exactly the six L rules');
  const seen = new Set();
  for (const row of manifest) {
    if (!row || Object.keys(row).sort().join(',') !== 'checkerId,enabled,ruleId') throw new Error('checker manifest rows must contain only ruleId, checkerId and enabled');
    if (RULE_TIERS[row.ruleId] !== 'L' || seen.has(row.ruleId) || RULE_CHECKERS[row.ruleId] !== row.checkerId || typeof row.enabled !== 'boolean') {
      throw new Error(`checker manifest mismatch for ${row?.ruleId ?? '<unknown>'}`);
    }
    seen.add(row.ruleId);
  }
  if (expectedIds.join(',') !== [...seen].sort().join(',')) throw new Error('checker manifest does not cover all L rules');
  void catalog;
  return manifest;
}

export function validateRuleContracts(root = repoRoot) {
  const catalog = validateCatalog(root);
  const manifest = validateManifest(root, catalog);
  return {catalog, manifest};
}

export function validateAllLRulesEnabled(root = repoRoot) {
  const {manifest} = validateRuleContracts(root);
  return manifest
    .filter(row => !row.enabled)
    .map(row => `${row.ruleId} checker ${row.checkerId} is disabled`);
}

const CHECKERS = Object.freeze({
  'TR-R02': checkTrR02,
  'TR-R03': checkTrR03,
  'TR-R04': checkTrR04,
  'TR-R05': checkTrR05,
  'TR-R06': checkTrR06,
  'TR-R07': checkTrR07,
});

export function runStaticChecks({root = repoRoot, ruleId = null, force = false} = {}) {
  const contracts = validateRuleContracts(root);
  const manifestByRule = new Map(contracts.manifest.map(row => [row.ruleId, row]));
  let selected;
  if (ruleId) {
    if (!RULE_TIERS[ruleId]) throw new Error(`unknown readability rule ${ruleId}`);
    selected = [ruleId];
  } else {
    selected = contracts.manifest.filter(row => force || row.enabled).map(row => row.ruleId);
  }
  const results = selected.map(currentRuleId => {
    try {
      const findings = CHECKERS[currentRuleId](root);
      return {
        name: RULE_CHECKERS[currentRuleId],
        ruleId: currentRuleId,
        tier: RULE_TIERS[currentRuleId],
        enabled: manifestByRule.get(currentRuleId)?.enabled ?? false,
        status: findings.length ? 'FAIL' : 'PASS',
        findings,
        error: findings.length ? `${findings.length} finding(s)` : null,
      };
    } catch (error) {
      return {
        name: RULE_CHECKERS[currentRuleId],
        ruleId: currentRuleId,
        tier: RULE_TIERS[currentRuleId],
        enabled: manifestByRule.get(currentRuleId)?.enabled ?? false,
        status: 'FAIL',
        findings: [],
        error: error.message,
      };
    }
  });
  return {contracts, results};
}

function usage() {
  console.log('Usage: node tools/terminal-readability/check-static.mjs [--rule TR-R02..TR-R07] [--force]');
  console.log('       node tools/terminal-readability/check-static.mjs --startup');
  console.log('Checks the readability catalog, manifest, enabled L rule gates, or startup descriptors.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--help')) {
    usage();
    process.exit(0);
  }
  if (process.argv.includes('--startup')) {
    const findings = checkDescriptorProtocol(repoRoot);
    console.log(`STARTUP_DESCRIPTOR_ATTACH_SITES=${PORT_DESCRIPTOR_ATTACHMENTS.length}`);
    console.log(`STARTUP_DESCRIPTOR=${findings.length ? 'FAIL' : 'PASS'}`);
    for (const descriptorFinding of findings) {
      console.error(`STARTUP_DESCRIPTOR_ERROR=${descriptorFinding.file}:${descriptorFinding.line} ${descriptorFinding.message}`);
    }
    if (findings.length) process.exit(1);
    process.exit(0);
  }
  const ruleIndex = process.argv.indexOf('--rule');
  const ruleId = ruleIndex >= 0 ? process.argv[ruleIndex + 1] : null;
  try {
    const report = runStaticChecks({root: repoRoot, ruleId, force: process.argv.includes('--force')});
    console.log(`READABILITY_RULE_GATES=${report.results.length}`);
    for (const result of report.results) {
      console.log(`RULE_${result.ruleId.replaceAll('-', '_')}=${result.status}`);
      if (result.error) console.error(`READABILITY_${result.ruleId}_ERROR=${result.error}`);
    }
    if (report.results.some(result => result.status !== 'PASS')) process.exit(1);
    console.log('READABILITY_STATIC=PASS');
  } catch (error) {
    console.error(`READABILITY_STATIC_ERROR=${error.message}`);
    process.exit(1);
  }
}
