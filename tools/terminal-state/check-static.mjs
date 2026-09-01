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
export const stateRoot = path.join(repoRoot, 'apps/terminal/kernel/base/state');

export const STATE_RULE_NAMES = Object.freeze([
  'toolkit-zero-slice',
  'tr05-named-boundary',
  'storage-result-consumed',
  'no-storage-clear',
]);
export const STATE_SUPPORT_CHECK_COUNT = 1;

const storageMethods = new Set([
  'read',
  'write',
  'remove',
  'readMany',
  'writeMany',
  'removeMany',
  'listKeys',
  'clear',
]);

const expectedPublicExports = Object.freeze([
  'moduleName',
  'dependencyModuleNames',
  'devDependencyModuleNames',
  'StateJsonPrimitive',
  'StateJsonValue',
  'StateJsonObject',
  'PersistIntent',
  'SyncIntent',
  'PersistenceProtection',
  'PersistenceFlushMode',
  'PersistenceStorageKind',
  'PersistencePhase',
  'StateStorageTimeoutPolicy',
  'StateRuntimePersistenceFieldDescriptor',
  'StateRuntimePersistenceRecordDescriptor',
  'StateRuntimePersistenceDescriptor',
  'PersistenceFailureKind',
  'PersistenceFailure',
  'PersistenceHealth',
  'PersistenceHealthListener',
  'PersistenceOperationSucceeded',
  'PersistenceOperationFailed',
  'PersistenceOperationResult',
  'StateRuntimeSliceDescriptor',
  'StateRuntimeSliceRegistration',
  'defineStateRuntimeSlice',
  'SyncValueEnvelope',
  'SyncRecordState',
  'SyncStateSummaryEntry',
  'SyncStateSummary',
  'SyncStateDiffEntry',
  'SyncStateDiff',
  'SyncDiffOptions',
  'StateRuntimeSyncRecordDescriptor',
  'StateRuntimeSyncDescriptor',
  'createSliceSyncSummary',
  'createSliceSyncDiff',
  'createFullSliceSyncPayload',
  'applySliceSyncDiff',
  'createSyncTombstone',
  'StateResetActor',
  'StateSyncSkipReason',
  'StateSyncPayloadResult',
  'StateSyncApplyResult',
  'CreateStateRuntimeInput',
  'StateRoot',
  'StateRuntime',
  'createStateRuntime',
  'WorkspaceKey',
  'WorkspaceStateKeys',
  'WorkspaceRouteContext',
  'CreateWorkspaceActionDispatcherInput',
  'ToWorkspaceStateDescriptorsInput',
  'createWorkspaceStateKeys',
  'createWorkspaceActionDispatcher',
  'toWorkspaceStateDescriptors',
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
    baseUrl: repoRoot,
    paths: {
      '@catering-v2s/kernel-base-contracts': [
        'apps/terminal/kernel/base/contracts/src/index.ts',
      ],
      '@catering-v2s/kernel-base-platform-ports': [
        'apps/terminal/kernel/base/platform-ports/src/index.ts',
      ],
      '@reduxjs/toolkit': [
        'node_modules/@reduxjs/toolkit/dist/index.d.ts',
      ],
    },
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

function moduleSymbol(checker, sourceFile) {
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol) throw new Error('state src/index.ts has no module symbol');
  return symbol;
}

function isExported(node) {
  return Boolean(ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export);
}

function propertyName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (
    ts.isElementAccessExpression(node)
    && ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return node.argumentExpression.text;
  }
  return null;
}

function expressionText(node, sourceFile) {
  return node.getText(sourceFile);
}

function runToolkitZeroSlice({root, files}) {
  for (const filePath of files) {
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node)
        && (
          (ts.isIdentifier(node.expression) && node.expression.text === 'createSlice')
          || propertyName(node.expression) === 'createSlice'
        )
      ) {
        throwViolation('toolkit package must not call createSlice', node, sourceFile, root);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);

    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement) || !isExported(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const initializer = declaration.initializer;
        if (initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))) {
          continue;
        }
        const declarationText = declaration.getText(sourceFile);
        if (
          declarationText.includes('defineStateRuntimeSlice(')
          || declarationText.includes('StateRuntimeSliceRegistration')
          || declarationText.includes('StateRuntimeSliceDescriptor')
        ) {
          throwViolation('toolkit package must not export descriptor or registration values', declaration, sourceFile, root);
        }
      }
    }
  }
}

function callExpressionFromAwait(awaitExpression) {
  const expression = awaitExpression.expression;
  return ts.isCallExpression(expression) ? expression : null;
}

function isStorageCall(call, sourceFile) {
  const name = propertyName(call.expression);
  if (!name || !storageMethods.has(name)) return false;
  const text = expressionText(call.expression, sourceFile);
  return /(?:storage|Storage|port|Port)/.test(text);
}

function runStorageResultConsumed({root, files}) {
  for (const filePath of files) {
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (ts.isExpressionStatement(node) && ts.isAwaitExpression(node.expression)) {
        const call = callExpressionFromAwait(node.expression);
        if (call && isStorageCall(call, sourceFile)) {
          throwViolation('storage port result must be consumed', node, sourceFile, root);
        }
      }
      if (ts.isVoidExpression(node)) {
        const call = ts.isCallExpression(node.expression)
          ? node.expression
          : ts.isAwaitExpression(node.expression)
            ? callExpressionFromAwait(node.expression)
            : null;
        if (call && isStorageCall(call, sourceFile)) {
          throwViolation('storage port promise must not be voided', node, sourceFile, root);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
}

function runNoStorageClear({root, files}) {
  for (const filePath of files) {
    const sourceFile = ts.createSourceFile(
      filePath,
      fs.readFileSync(filePath, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node)
        && propertyName(node.expression) === 'clear'
        && /(?:storage|Storage|port|Port)/.test(expressionText(node.expression, sourceFile))
      ) {
        throwViolation('state runtime must not call StateStoragePort.clear', node, sourceFile, root);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
}

function runPublicSupport({checker, indexSourceFile, root}) {
  const actual = checker.getExportsOfModule(moduleSymbol(checker, indexSourceFile))
    .map(symbol => symbol.name)
    .sort();
  const expected = [...expectedPublicExports].sort();
  const missing = expected.filter(name => !actual.includes(name));
  const extra = actual.filter(name => !expected.includes(name));
  if (missing.length || extra.length || new Set(actual).size !== actual.length) {
    throw new Error(`state public export exact-set mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} actualCount=${actual.length}`);
  }
  for (const statement of indexSourceFile.statements) {
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && !statement.exportClause) {
      throwViolation('public index must not use export *', statement, indexSourceFile, root);
    }
  }
}

export function runStateStaticChecks({statePackageRoot: root = stateRoot} = {}) {
  const context = createProgram(root);
  const indexSourceFile = context.program.getSourceFile(path.join(root, 'src/index.ts'));
  if (!indexSourceFile) throw new Error(`state src/index.ts is missing under ${root}`);
  const checks = [
    ['toolkit-zero-slice', () => runToolkitZeroSlice({root, files: context.files})],
    ['tr05-named-boundary', () => {
      runTr05NamedBoundary({root, files: context.files});
      runTr05CheckerBoundary({
        root,
        files: context.files,
        program: context.program,
        checker: context.checker,
      });
    }],
    ['storage-result-consumed', () => runStorageResultConsumed({root, files: context.files})],
    ['no-storage-clear', () => runNoStorageClear({root, files: context.files})],
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
  console.log('Usage: node tools/terminal-state/check-static.mjs [--help]');
  console.log('Runs four state rule gates and one exact public-surface support check.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const report = runStateStaticChecks();
  console.log(`STATE_RULE_GATES=${STATE_RULE_NAMES.length}`);
  console.log(`STATE_SUPPORT_CHECKS=${STATE_SUPPORT_CHECK_COUNT}`);
  for (const result of report.results) {
    console.log(`STATE_RULE_${result.name.toUpperCase().replaceAll('-', '_')}=${result.status}`);
    if (result.error) console.error(`STATE_FIRST_FAILURE:${result.name}:${result.error}`);
  }
  console.log(`STATE_SUPPORT_EXPORTS=${report.support.status}`);
  if (report.support.error) console.error(`STATE_SUPPORT_FAILURE:${report.support.error}`);
  const failed = report.results.some(result => result.status !== 'PASS') || report.support.status !== 'PASS';
  if (failed) process.exit(1);
  console.log('TERMINAL_STATE_STATIC=PASS');
}
