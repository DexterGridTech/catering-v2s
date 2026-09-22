import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  repoRoot,
  runStaticChecks,
  validateRuleContracts,
  validateAllLRulesEnabled,
  checkRd12,
  checkDescriptorProtocol,
  PORT_DESCRIPTOR_ATTACHMENTS,
  validateResponsibilityMatrix,
  validateSurfacePair,
} from './check-static.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-readability-static-'));
const fixtureToolDirectory = path.join(fixtureRoot, 'tools/terminal-readability');
fs.mkdirSync(fixtureToolDirectory, {recursive: true});
fs.copyFileSync(
  path.join(repoRoot, 'tools/terminal-readability', 'rule-catalog.json'),
  path.join(fixtureToolDirectory, 'rule-catalog.json'),
);
const sourceManifest = JSON.parse(fs.readFileSync(
  path.join(repoRoot, 'tools/terminal-readability', 'checker-manifest.json'),
  'utf8',
));
fs.writeFileSync(
  path.join(fixtureToolDirectory, 'checker-manifest.json'),
  JSON.stringify(sourceManifest.map(row => ({...row, enabled: false})), null, 2),
);

function writeFile(relativePath, contents) {
  const filePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, contents);
}

function makePackage(modulePath = 'kernel/base/demo', files = {}) {
  const packageDirectory = `apps/terminal/${modulePath}`;
  writeFile(`${packageDirectory}/package.json`, JSON.stringify({
    name: `@catering-v2s/${modulePath.replaceAll('/', '-')}`,
  }));
  for (const [fileName, contents] of Object.entries(files)) {
    writeFile(`${packageDirectory}/src/${fileName}`, contents);
  }
}

function ruleStatus(ruleId) {
  const result = runStaticChecks({root: fixtureRoot, ruleId}).results[0];
  assert.ok(result, `${ruleId} must produce one result`);
  return result;
}

function replacePackages(entries) {
  fs.rmSync(path.join(fixtureRoot, 'apps/terminal'), {recursive: true, force: true});
  for (const entry of entries) makePackage(entry.modulePath, entry.files);
}

function replacePackage(files) {
  replacePackages([{modulePath: 'kernel/base/demo', files}]);
}

replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'local.ts': 'const localValue = 1\nexport {localValue}\n',
});
assert.equal(ruleStatus('TR-R02').status, 'FAIL', 'local export block must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\nexport {indexValue}\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'other.ts': 'export const reexported = 1\n',
  'reexport.ts': "export {reexported} from './other'\n",
});
assert.equal(ruleStatus('TR-R02').status, 'PASS', 'definition export must be green');
writeFile('apps/terminal/kernel/base/demo/test/ignored.ts', 'const ignored = 1\nexport {ignored}\n');
assert.equal(ruleStatus('TR-R02').status, 'PASS', 'package-external test files must not enter the source denominator');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'local.ts': 'const localValue = 1\nconst middleValue = 2\nexport {localValue}\nconst laterValue = 3\n',
});
assert.equal(ruleStatus('TR-R02').status, 'FAIL', 'a local export in the middle of a file must be red');
console.log('MODEL_TR_R02=PASS');

writeFile('node_modules/react/index.d.ts', 'export function createElement(type: unknown, props: unknown): unknown\n');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'component.ts': "import {createElement as makeElement} from 'react'\nexport const node = makeElement('div', {})\n",
});
assert.equal(ruleStatus('TR-R03').status, 'FAIL', 'React createElement must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'component.ts': "import * as React from 'react'\nexport const node = React.createElement('div', {})\n",
});
assert.equal(ruleStatus('TR-R03').status, 'FAIL', 'namespace React.createElement must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'component.ts': "import React from 'react'\nexport const node = React.createElement('div', {})\n",
});
assert.equal(ruleStatus('TR-R03').status, 'FAIL', 'default React.createElement must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'component.tsx': 'export const node = <div />\n',
});
assert.equal(ruleStatus('TR-R03').status, 'PASS', 'JSX must not be treated as createElement');
replacePackages([{
  modulePath: 'ui/base/render',
  files: {
    'index.ts': 'export const indexValue = 1\n',
    'moduleName.ts': 'export const moduleName = "ui.base.render" as const\n',
    'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
    'components/resolvePart.ts': "import {createElement as makeElement} from 'react'\nexport const node = makeElement('div', {})\n",
  },
}]);
assert.equal(ruleStatus('TR-R03').status, 'PASS', 'the registered renderer exception must be green');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'component.ts': 'export function ordinary() { return 1 }\n',
});
assert.equal(ruleStatus('TR-R03').status, 'PASS', 'JSX-free ordinary code must be green');
console.log('MODEL_TR_R03=PASS');

replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'functions.ts': 'export function tooMany(a: unknown, b: unknown, c: unknown, d: unknown) { return d }\n',
});
assert.equal(ruleStatus('TR-R04').status, 'FAIL', 'four parameters must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'functions.ts': 'export function allowed(a: unknown, b: unknown, c: unknown) { return c }\n',
});
assert.equal(ruleStatus('TR-R04').status, 'PASS', 'three parameters must be green');
console.log('MODEL_TR_R04=PASS');

replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'control.ts': [
    'export function tooDeep(value: number) {',
    '  if (value > 0) {',
    '    for (const item of [value]) {',
    '      while (item > 0) {',
    '        if (item === value) return item',
    '      }',
    '    }',
    '  }',
    '  return value',
    '}',
  ].join('\n'),
});
assert.equal(ruleStatus('TR-R05').status, 'FAIL', 'four control layers must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'control.ts': [
    'export function allowed(value: number) {',
    '  if (value > 0) {',
    '    for (const item of [value]) {',
    '      while (item > 0) {',
    '        do { return item } while (item < 0)',
    '      }',
    '    }',
    '  }',
    '  return value > 0 && value < 4 ? value : 0',
    '}',
  ].join('\n'),
});
assert.equal(ruleStatus('TR-R05').status, 'PASS', 'three control layers and expressions must be green');
console.log('MODEL_TR_R05=PASS');

replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'misc.ts': 'export const misplaced = 1\n',
});
assert.equal(ruleStatus('TR-R06').status, 'FAIL', 'an unlisted root file must be red');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'types/value.ts': 'export const value = 1\n',
  'features/actors/login.ts': 'export const login = 1\n',
});
assert.equal(ruleStatus('TR-R06').status, 'PASS', 'listed root and feature directories must be green');
replacePackage({
  'index.ts': 'export const indexValue = 1\n',
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'features/misc/login.ts': 'export const login = 1\n',
});
assert.equal(ruleStatus('TR-R06').status, 'FAIL', 'an unlisted features child must be red');
console.log('MODEL_TR_R06=PASS');

replacePackage({
  'index.ts': "import './testing/startupDiagnostics'\nexport const indexValue = 1\n",
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'testing/startupDiagnostics.ts': "export const category = ['startup', '.', 'ports'].join('')\n",
});
assert.equal(ruleStatus('TR-R07').status, 'FAIL', 'production reachability must not depend on a string search');
replacePackage({
  'index.ts': "import {type Diagnostic} from './testing/types'\nexport {type Diagnostic} from './testing/types'\nexport const indexValue = 1\n",
  'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
  'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  'foundations/registry.ts': 'export type Diagnostic = {message: string}\n',
  'testing/types.ts': 'export type Diagnostic = {message: string}\n',
});
assert.equal(ruleStatus('TR-R07').status, 'PASS', 'type-only testing edges must not be runtime edges');
console.log('MODEL_TR_R07=PASS');

replacePackages([
  {
    modulePath: 'kernel/base/source',
    files: {
      'index.ts': "import {uiValue} from '@catering-v2s/ui-base-target'\nexport const value = uiValue\n",
      'moduleName.ts': 'export const moduleName = "kernel.base.source" as const\n',
      'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
    },
  },
  {
    modulePath: 'ui/base/target',
    files: {
      'index.ts': 'export const uiValue = 1\n',
      'moduleName.ts': 'export const moduleName = "ui.base.target" as const\n',
      'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
    },
  },
  {
    modulePath: 'kernel/base/runtime',
    files: {
      'index.ts': 'export const runtimeValue = 1\n',
      'moduleName.ts': 'export const moduleName = "kernel.base.runtime" as const\n',
      'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
      'internal.ts': 'export const internalValue = 1\n',
    },
  },
  {
    modulePath: 'ui/integration/sample-console',
    files: {
      'index.ts': "export * from './assembly/assembly'\n",
      'moduleName.ts': 'export const moduleName = "ui.integration.sample-console" as const\n',
      'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
      'assembly/assembly.tsx': "import {internalValue} from '../../../../../kernel/base/runtime/src/internal'\nexport const value = internalValue\n",
    },
  },
]);
assert.equal(checkRd12(fixtureRoot).length, 2, 'both RD-12 red fixtures must be observed');
replacePackages([{
  modulePath: 'kernel/base/demo',
  files: {
    'index.ts': 'export const indexValue = 1\n',
    'moduleName.ts': 'export const moduleName = "kernel.base.demo" as const\n',
    'dependencies.ts': 'export const dependencyModuleNames = [] as const\n',
  },
}]);
assert.deepEqual(checkRd12(fixtureRoot), [], 'a single kernel package has no new cross-layer edge');
console.log('MODEL_RD12=PASS');

assert.deepEqual(validateResponsibilityMatrix([
  {
    ownerSource: 'apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts',
    symbolOrTransition: 'dispatch result',
    responsibilityFactFromSource: 'returns the actor result and updates lifecycle state',
    testFile: 'apps/terminal/kernel/base/runtime/test/dispatcher.test.ts',
    testNameOrOracle: 'asserts returned result and post-dispatch state snapshot',
    preObservation: 'runtime state is idle before dispatch',
    postObservation: 'result is returned and state snapshot is completed',
    gapAction: 'none',
  },
]), []);
assert.notDeepEqual(validateResponsibilityMatrix([
  {symbolOrTransition: 'dispatch result', testNameOrOracle: 'called once'},
]), []);
assert.notDeepEqual(validateResponsibilityMatrix([{
  ownerSource: 'runtime.ts',
  symbolOrTransition: 'dispatch result',
  responsibilityFactFromSource: 'returns a result',
  testFile: 'runtime.test.ts',
  testNameOrOracle: 'asserts the result',
  preObservation: 'called once',
  postObservation: 'called twice',
  gapAction: 'none',
}]), []);
console.log('MODEL_RD13=PASS');

assert.deepEqual(validateSurfacePair([
  {kind: 'declaredSurfaceSize', field: 'declaredSurfaceSize', owner: 'integration'},
  {kind: 'measuredSurfaceFrame', field: 'measuredSurfaceFrame', owner: 'measurement'},
]), []);
assert.notDeepEqual(validateSurfacePair([
  {kind: 'declaredSurfaceSize', field: 'declaredSurfaceSize', owner: 'integration'},
  {kind: 'measuredSurfaceFrame', field: 'measuredSurfaceFrame', owner: 'dev-host'},
]), []);
console.log('MODEL_RD14=PASS');

const contracts = validateRuleContracts(fixtureRoot);
assert.equal(contracts.catalog.length, 7);
assert.equal(contracts.manifest.length, 6);
assert.match(validateAllLRulesEnabled(fixtureRoot)[0], /disabled/);
const manifestPath = path.join(fixtureToolDirectory, 'checker-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.writeFileSync(manifestPath, JSON.stringify(manifest.map(row => ({...row, enabled: true})), null, 2));
assert.deepEqual(validateAllLRulesEnabled(fixtureRoot), [], 'all L rules enabled must be green');
fs.writeFileSync(manifestPath, JSON.stringify(manifest.slice(0, -1), null, 2));
assert.throws(() => validateRuleContracts(fixtureRoot), /exactly the six L rules|does not cover all L rules/);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.writeFileSync(manifestPath, JSON.stringify([
  ...manifest,
  {ruleId: 'TR-R01', checkerId: 'tr-r01-review', enabled: true},
], null, 2));
assert.throws(() => validateRuleContracts(fixtureRoot), /exactly the six L rules|mismatch/);
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('MODEL_RD09_RD11=PASS');

function writeDescriptorFixtures({wrongKeyPath = null, omitCapabilityPath = null} = {}) {
  fs.rmSync(path.join(fixtureRoot, 'apps/terminal'), {recursive: true, force: true});
  for (const attachment of PORT_DESCRIPTOR_ATTACHMENTS) {
    const capabilities = attachment.capabilities
      .filter(capability => attachment.path !== omitCapabilityPath || capability !== attachment.capabilities.at(-1))
      .map(({capability, state, source}) => `Object.freeze({capability: '${capability}', state: '${state}', source: '${source}'})`)
      .join(', ');
    const key = attachment.path === wrongKeyPath
      ? 'catering-v2s.platform-ports.wrong-descriptor'
      : 'catering-v2s.platform-ports.descriptor';
    writeFile(attachment.path, `const PORT_DESCRIPTOR_KEY = Symbol.for('${key}')
const target = {}
Object.defineProperty(target, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({port: '${attachment.port}', capabilities: Object.freeze([${capabilities}])}),
    enumerable: false,
    writable: false,
    configurable: false,
  })
`);
  }
}

assert.deepEqual(checkDescriptorProtocol(repoRoot), [], 'real descriptor attach sites must satisfy the protocol');
writeDescriptorFixtures();
assert.deepEqual(checkDescriptorProtocol(fixtureRoot), [], 'descriptor protocol fixture must be green');
const descriptorPath = PORT_DESCRIPTOR_ATTACHMENTS[0].path;
writeDescriptorFixtures({wrongKeyPath: descriptorPath});
assert.ok(checkDescriptorProtocol(fixtureRoot).some(finding => finding.file === descriptorPath && finding.message.includes('descriptor key')));
writeDescriptorFixtures({omitCapabilityPath: descriptorPath});
assert.ok(checkDescriptorProtocol(fixtureRoot).some(finding => finding.file === descriptorPath && finding.message.includes('missing capability')));
console.log('MODEL_RD06_DESCRIPTOR=PASS');

console.log('READABILITY_MODEL=PASS');
