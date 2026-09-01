import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import ts from 'typescript';
import {
  runTr05CheckerBoundary,
  runTr05NamedBoundary,
} from '../terminal-contracts/check-static.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(toolDirectory, '../..');
export const platformPortsRoot = path.join(repoRoot, 'apps/terminal/kernel/base/platform-ports');

export const PLATFORM_PORT_RULE_NAMES = Object.freeze([
  'tr05-named-boundary',
  'required-port-shape',
  'default-import-allowlist',
  'platform-identifier-boundary',
]);
export const PLATFORM_PORT_SUPPORT_CHECK_COUNT = 1;

const expectedPortKeys = Object.freeze([
  'logger',
  'persistKv',
  'persistSecure',
  'device',
  'appControl',
  'script',
  'connector',
  'hotUpdate',
  'logUpload',
  'topologyHost',
]);

const expectedPortMethods = Object.freeze({
  LoggerPort: ['debug', 'info', 'warn', 'error', 'scope', 'withContext'],
  StateStoragePort: ['read', 'write', 'remove', 'readMany', 'writeMany', 'removeMany', 'listKeys', 'clear'],
  DevicePort: ['getDeviceInfo', 'getSystemStatus', 'getPowerStatus', 'subscribePowerStatus', 'unsubscribePowerStatus'],
  AppControlPort: [
    'resetRuntime',
    'exitApplication',
    'clearHostDataCache',
    'setFullscreen',
    'getFullscreen',
    'setKioskMode',
    'getKioskMode',
    'showNativeLoading',
    'hideNativeLoading',
  ],
  ScriptPort: ['execute', 'getStats', 'clearStats'],
  ConnectorPort: ['call', 'subscribe', 'unsubscribe', 'on'],
  HotUpdatePort: [
    'downloadPackage',
    'writeBootMarker',
    'readBootMarker',
    'readActiveMarker',
    'readRollbackMarker',
    'clearBootMarker',
    'confirmLoadComplete',
  ],
  LogUploadPort: ['uploadLogsForDate'],
  TopologyHostPort: ['start', 'stop', 'getStatus', 'getDiagnosticsSnapshot'],
});

const forbiddenPlatformIdentifiers = new Set([
  'NativeModules',
  'TurboModuleRegistry',
  'requireNativeModule',
  'requireOptionalNativeModule',
  'UIApplication',
  'UIDevice',
  'BrowserWindow',
  'webContents',
  'ipcMain',
  'ipcRenderer',
]);

const forbiddenPlatformImportPattern = /^(?:react-native(?:\/|$)|expo(?:-|\/|$)|@expo(?:-|\/|$)|@react-native(?:\/|$)|electron(?:\/|$)|node:(?:fs|child_process)(?:\/|$)|(?:fs|child_process)(?:\/|$))/;

const expectedPublicExports = Object.freeze([
  'moduleName', 'dependencyModuleNames', 'devDependencyModuleNames',
  'EnvironmentMode', 'PlatformPortName', 'CapabilityUnavailableReason', 'PortUnavailable', 'PortError', 'PortFailure', 'PortTimedOut', 'PortSucceeded', 'PortAccepted', 'NoOutput', 'PortResult', 'PortActionResult',
  'LogLevel', 'LogMaskingMode', 'LogPrimitive', 'LogValue', 'LogFields', 'LogScope', 'LogScopeBinding', 'LogContext', 'LogError', 'LogSecurity', 'LogEvent', 'LogWriteInput', 'LogWriteResult', 'LoggerPort',
  'StateStorageCall', 'StateStorageReadInput', 'StateStorageWriteInput', 'StateStorageKeysInput', 'StateStorageEntriesInput', 'StateStorageEntry', 'StateStorageReadValue', 'StateStorageReadEntry', 'StateStoragePort',
  'DeviceInfo', 'ProcessorStatus', 'MemoryStatus', 'StorageStatus', 'NetworkStatus', 'PowerStatus', 'SystemStatus', 'PowerStatusChanged', 'PowerStatusListener', 'DeviceCall', 'PowerStatusSubscriptionInput', 'PowerStatusUnsubscribeInput', 'DevicePort',
  'AppControlCall', 'RuntimeResetInput', 'ExitApplicationInput', 'SurfaceActionInput', 'SurfaceToggleInput', 'NativeLoadingInput', 'ApplicationToggleInput', 'ToggleState', 'RuntimeTransitionObservation', 'ExitTransitionObservation', 'AppControlPort',
  'NativeFunctionInvocation', 'NativeFunctionOutput', 'NativeFunctionDispatcher', 'ScriptNativeBindings', 'ScriptExecutionInput', 'ScriptExecutionOutput', 'ScriptStats', 'ScriptCall', 'ScriptPort',
  'ConnectorScalar', 'ConnectorValue', 'ConnectorObject', 'ConnectorChannelRef', 'ConnectorCallRequest', 'ConnectorCallResponse', 'ConnectorMessage', 'ConnectorError', 'ConnectorSubscriptionError', 'ConnectorSubscribeInput', 'ConnectorEvent', 'ConnectorOnInput', 'ConnectorUnsubscribeInput', 'ConnectorSubscription', 'ConnectorPort',
  'HotUpdateCall', 'HotUpdateDownloadInput', 'HotUpdateInstall', 'HotUpdateMarkerInput', 'HotUpdateMarker', 'HotUpdateMarkerRead', 'HotUpdateMarkerWrite', 'HotUpdatePort',
  'LogUploadInput', 'UploadedLogFile', 'LogUploadOutput', 'LogUploadPort',
  'TopologyHostState', 'TopologyHostRuntimeConfig', 'TopologyHostConfig', 'TopologyHostAddress', 'TopologyHostStatus', 'TopologyHostStats', 'TopologyHostDiagnostics', 'TopologyHostCall', 'TopologyHostPort',
  'LoggerConsoleBinding', 'LoggerSinkBinding', 'LoggerBinding', 'PlatformPortBindings', 'PlatformPorts', 'CreatePlatformPortsInput', 'createPlatformPorts',
  'consoleLoggerBinding', 'createProcessMemoryStateStoragePort', 'unavailablePersistSecurePort', 'unavailableDevicePort', 'unavailableAppControlPort', 'unavailableScriptPort', 'unavailableConnectorPort', 'unavailableHotUpdatePort', 'unavailableLogUploadPort', 'unavailableTopologyHostPort',
]);

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
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true,
  });
  return {files, program, checker: program.getTypeChecker()};
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

function isRuntimeModuleReference(statement) {
  if (ts.isImportDeclaration(statement)) return !statement.importClause?.isTypeOnly;
  if (!ts.isExportDeclaration(statement)) return false;
  return !statement.isTypeOnly;
}

function resolvePackageSourceImport(moduleName, filePath, root) {
  const basePath = path.resolve(path.dirname(filePath), moduleName);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.mts'),
    path.join(basePath, 'index.cts'),
  ];
  const resolved = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  const sourceRoot = path.join(root, 'src');
  const relative = path.relative(sourceRoot, resolved ?? basePath);
  if (!resolved || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function moduleSymbol(checker, sourceFile, label) {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) throw new Error(`${label} has no module symbol`);
  return symbol;
}

function exportSymbol(checker, indexSourceFile, name) {
  const symbol = checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile, 'platform-ports src/index.ts')).find(candidate => candidate.name === name);
  if (!symbol) throw new Error(`platform-ports public export ${name} is missing`);
  return symbol;
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

function typeDeclaration(checker, indexSourceFile, name) {
  const symbol = resolveAliasedSymbol(checker, exportSymbol(checker, indexSourceFile, name));
  const declaration = symbol.declarations?.find(candidate => ts.isInterfaceDeclaration(candidate) || ts.isTypeAliasDeclaration(candidate));
  if (!declaration) throw new Error(`${name} must be declared as a public interface or type alias`);
  return declaration;
}

function declaredInterface(checker, indexSourceFile, name) {
  const declaration = typeDeclaration(checker, indexSourceFile, name);
  if (!ts.isInterfaceDeclaration(declaration)) throw new Error(`${name} must be an interface`);
  return declaration;
}

function memberName(member) {
  return member.name && ts.isIdentifier(member.name) ? member.name.text : null;
}

function assertExactRequiredProperties(checker, indexSourceFile, typeName, expectedNames, {callable = false} = {}) {
  const declaration = declaredInterface(checker, indexSourceFile, typeName);
  const symbol = resolveAliasedSymbol(checker, exportSymbol(checker, indexSourceFile, typeName));
  const type = checker.getDeclaredTypeOfSymbol(symbol);
  const actual = type.getProperties().map(property => property.name).sort();
  const expected = [...expectedNames].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length) {
    throw new Error(`${typeName} exact required members mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`);
  }
  if (declaration.members.some(member =>
    ts.isIndexSignatureDeclaration(member) ||
    ts.isCallSignatureDeclaration(member) ||
    ts.isConstructSignatureDeclaration(member) ||
    memberName(member) === null,
  )) {
    throw new Error(`${typeName} must not contain index, call, construct, or computed members`);
  }
  for (const property of type.getProperties()) {
    if (property.flags & ts.SymbolFlags.Optional) throw new Error(`optional port member ${typeName}.${property.name}`);
    if (callable) {
      const declaration = property.valueDeclaration ?? property.declarations?.[0];
      const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration ?? indexSourceFile);
      if (!propertyType.getCallSignatures().length) throw new Error(`${typeName}.${property.name} must be callable`);
    }
  }
}

function runRequiredPortShape({checker, indexSourceFile}) {
  assertExactRequiredProperties(checker, indexSourceFile, 'PlatformPorts', expectedPortKeys);
  assertExactRequiredProperties(checker, indexSourceFile, 'PlatformPortBindings', expectedPortKeys);
  for (const [typeName, methods] of Object.entries(expectedPortMethods)) {
    assertExactRequiredProperties(checker, indexSourceFile, typeName, methods, {callable: true});
  }
}

function runDefaultImportAllowlist({root}) {
  const defaultsRoot = path.join(root, 'src/defaults');
  const defaultFiles = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(entryPath);
      else if (entry.isFile() && /\.(?:ts|tsx|mts|cts)$/.test(entry.name)) defaultFiles.push(entryPath);
    }
  }
  visit(defaultsRoot);
  const pending = [...defaultFiles.sort()];
  const visited = new Set();
  const inspectModuleReference = (moduleName, node, sourceFile, enqueueRuntime) => {
    if (moduleName.startsWith('.')) {
      const resolved = resolvePackageSourceImport(moduleName, sourceFile.fileName, root);
      if (!resolved) {
        throwViolation(`default relative import outside package source: ${moduleName}`, node, sourceFile, root);
      }
      // The production dependency closure follows runtime edges. Type-only edges are erased by TypeScript and
      // are checked by the package typecheck, but do not add a runtime dependency to a default implementation.
      if (enqueueRuntime && !visited.has(resolved)) pending.push(resolved);
      return;
    }
    if (moduleName === '@catering-v2s/kernel-base-contracts') return;
    throwViolation(`default import outside allowlist: ${moduleName}`, node, sourceFile, root);
  };
  while (pending.length) {
    const filePath = pending.shift();
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) {
        const moduleName = importModuleText(statement);
        if (moduleName) inspectModuleReference(moduleName, statement, sourceFile, isRuntimeModuleReference(statement));
      } else if (ts.isImportEqualsDeclaration(statement) && ts.isExternalModuleReference(statement.moduleReference)) {
        const expression = statement.moduleReference.expression;
        if (!expression || !ts.isStringLiteral(expression)) {
          throwViolation('default import-equals must use a literal module name', statement, sourceFile, root);
        }
        inspectModuleReference(expression.text, statement, sourceFile, true);
      }
    }
    function visitRuntimeImports(node) {
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const moduleName = node.arguments[0] && ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (!moduleName) throwViolation('default dynamic import must use a literal module name', node, sourceFile, root);
        inspectModuleReference(moduleName, node, sourceFile, true);
      } else if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        const moduleName = node.arguments[0] && ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (!moduleName) throwViolation('default require must use a literal module name', node, sourceFile, root);
        inspectModuleReference(moduleName, node, sourceFile, true);
      }
      ts.forEachChild(node, visitRuntimeImports);
    }
    visitRuntimeImports(sourceFile);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const productionDependencies = Object.keys(manifest.dependencies ?? {}).sort();
  const expected = ['@catering-v2s/kernel-base-contracts'];
  if (JSON.stringify(productionDependencies) !== JSON.stringify(expected)) {
    throw new Error(`production dependency mismatch; expected=${JSON.stringify(expected)} actual=${JSON.stringify(productionDependencies)}`);
  }
}

function runPlatformIdentifierBoundary({root, files}) {
  for (const filePath of files) {
    const sourceFile = ts.createSourceFile(filePath, fs.readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true);
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      const moduleName = importModuleText(statement);
      if (moduleName && forbiddenPlatformImportPattern.test(moduleName)) {
        throwViolation(`platform import ${moduleName}`, statement, sourceFile, root);
      }
    }
    function visit(node) {
      if (ts.isIdentifier(node) && forbiddenPlatformIdentifiers.has(node.text)) {
        throwViolation(`platform identifier ${node.text}`, node, sourceFile, root);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const moduleName = node.arguments[0] && ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (moduleName && forbiddenPlatformImportPattern.test(moduleName)) {
          throwViolation(`platform dynamic import ${moduleName}`, node, sourceFile, root);
        }
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        const moduleName = node.arguments[0] && ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (moduleName && forbiddenPlatformImportPattern.test(moduleName)) {
          throwViolation(`platform require ${moduleName}`, node, sourceFile, root);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
}

function runPublicSupport({checker, indexSourceFile, root}) {
  const actual = checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile, 'platform-ports src/index.ts')).map(symbol => symbol.name).sort();
  const expected = [...expectedPublicExports].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length || new Set(actual).size !== actual.length) {
    throw new Error(`public export exact-set mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} actualCount=${actual.length}`);
  }
  for (const forbidden of ['localWebServer', 'display', 'automation', 'emit']) {
    if (actual.includes(forbidden)) throw new Error(`forbidden public export ${forbidden}`);
  }
  for (const statement of indexSourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.exportClause) {
      throwViolation('public index must not use export *', statement, indexSourceFile, root);
    }
  }
}

export function runPlatformPortsStaticChecks({platformPortsRoot: root = platformPortsRoot} = {}) {
  const context = createProgram(root);
  const indexSourceFile = context.program.getSourceFile(path.join(root, 'src/index.ts'));
  if (!indexSourceFile) throw new Error(`platform-ports src/index.ts is missing under ${root}`);
  const checks = [
    ['tr05-named-boundary', () => {
      runTr05NamedBoundary({root, files: context.files});
      runTr05CheckerBoundary({
        root,
        files: context.files,
        program: context.program,
        checker: context.checker,
      });
    }],
    ['required-port-shape', () => runRequiredPortShape({...context, indexSourceFile})],
    ['default-import-allowlist', () => runDefaultImportAllowlist({root})],
    ['platform-identifier-boundary', () => runPlatformIdentifierBoundary({root, files: context.files})],
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
  console.log('Usage: node tools/terminal-platform-ports/check-static.mjs [--help]');
  console.log('Runs four platform-ports rule gates and one exact public-surface support check.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const report = runPlatformPortsStaticChecks();
  console.log(`PLATFORM_PORT_RULE_GATES=${PLATFORM_PORT_RULE_NAMES.length}`);
  console.log(`PLATFORM_PORT_SUPPORT_CHECKS=${PLATFORM_PORT_SUPPORT_CHECK_COUNT}`);
  for (const result of report.results) {
    console.log(`PLATFORM_PORT_RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`);
    if (result.error) console.error(`PLATFORM_PORT_FIRST_FAILURE:${result.name}:${result.error}`);
  }
  console.log(`PLATFORM_PORT_SUPPORT=${report.support.status}`);
  if (report.support.error) console.error(`PLATFORM_PORT_SUPPORT_FAILURE:${report.support.error}`);
  const failed = report.results.some(result => result.status !== 'PASS') || report.support.status !== 'PASS';
  if (failed) process.exit(1);
  console.log('TERMINAL_PLATFORM_PORTS_STATIC=PASS');
}
