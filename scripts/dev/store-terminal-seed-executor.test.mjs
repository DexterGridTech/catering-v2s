import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  assertConfigurationReadback,
  buildStoreTerminalSeedPlan,
  dataNodeCandidate,
  expectedTerminalPageCount,
  mapAreaCandidateRefsByFixtureKey,
  resolveConfiguration,
  validateTerminalPageReadback,
} from './store-terminal-seed-executor.mjs';

const storeTerminalSeedSource = fs.readFileSync(path.resolve('scripts/dev/store-terminal-seed-executor.mjs'), 'utf8');

const areaRef = '11111111-1111-4111-8111-111111111111';
const tagRef = '22222222-2222-4222-8222-222222222222';
const printerRef = '33333333-3333-4333-8333-333333333333';
const functionRef = '44444444-4444-4444-8444-444444444444';

const fixtureConfiguration = {
  printers: [
    {
      clientKey: 'thermal',
      name: '前台热敏',
      brandKey: 'GENERIC',
      modelKey: 'GENERIC_THERMAL_58',
      paperSpecKey: 'THERMAL_58',
      connectionMethodKey: 'BUILT_IN',
    },
  ],
  functions: [
    {
      clientKey: 'ordering',
      functionKey: 'ORDERING_CASHIER',
      ranges: [
        {key: 'TABLE_AREA', all: false, referenceKeys: ['main-area']},
        {key: 'PRODUCTION_TAG', all: false, referenceKeys: ['HOT_KITCHEN']},
      ],
      scenes: [
        {
          sceneKey: 'CHECKOUT_TICKET',
          orderTypes: ['DINE_IN'],
          printers: [{printerClientKey: 'thermal'}],
        },
      ],
    },
  ],
};

test('store-terminal seed plan validates the complete eight-terminal fixture without network access', () => {
  const plan = buildStoreTerminalSeedPlan({stableFixtures: {organization: {storeTerminals: Array.from({length: 8}, (_, index) => ({
    key: `terminal-${index + 1}`,
    activationCode: `6200000${index + 1}`,
    configuration: index === 0 ? fixtureConfiguration : {printers: [], functions: []},
  }))}}});
  assert.equal(plan.status, 'PASS');
  assert.equal(plan.terminalCount, 8);
  assert.match(plan.planDigest, /^[0-9a-f]{64}$/);
});

test('store-terminal seed plan red mutation rejects a duplicate fixed activation code', () => {
  const fixture = {stableFixtures: {organization: {storeTerminals: Array.from({length: 8}, (_, index) => ({
    key: `terminal-${index + 1}`,
    activationCode: index === 7 ? '62000001' : `6200000${index + 1}`,
    configuration: {printers: [], functions: []},
  }))}}};
  assert.throws(() => buildStoreTerminalSeedPlan(fixture), /STORE_TERMINAL_SEED_PLAN_ACTIVATION_CODES_INVALID/);
});

test('store-terminal seed resolves candidate keys and verifies complete child readback', () => {
  const resolved = resolveConfiguration(
    fixtureConfiguration,
    new Map([['main-area', areaRef]]),
    new Map([['HOT_KITCHEN', tagRef]]),
    'terminal-test',
  );
  const readback = {
    configuration: {
      printers: [{...resolved.printers[0], ref: printerRef}],
      functions: [
        {
          ...resolved.functions[0],
          ref: functionRef,
          ranges: [
            {key: 'TABLE_AREA', all: false, refs: [areaRef]},
            {key: 'PRODUCTION_TAG', all: false, refs: [tagRef]},
          ],
          scenes: [{sceneKey: 'CHECKOUT_TICKET', orderTypes: ['DINE_IN'], printers: [{printerRef}]}],
        },
      ],
    },
  };
  const refs = assertConfigurationReadback(readback, resolved, 'terminal-test');
  assert.deepEqual(refs, {
    printerRefs: [printerRef],
    functionRefs: [functionRef],
    printerRefsByClientKey: {thermal: printerRef},
    functionRefsByClientKey: {ordering: functionRef},
  });
});

test('store-terminal seed rejects unresolved references and unknown scene printers', () => {
  assert.throws(
    () => resolveConfiguration(fixtureConfiguration, new Map(), new Map([['HOT_KITCHEN', tagRef]]), 'terminal-test'),
    /STORE_TERMINAL_SEED_REFERENCE_CANDIDATE_MISSING/,
  );
  const unknownPrinter = structuredClone(fixtureConfiguration);
  unknownPrinter.functions[0].scenes[0].printers = [{printerClientKey: 'missing'}];
  assert.throws(
    () => resolveConfiguration(unknownPrinter, new Map([['main-area', areaRef]]), new Map([['HOT_KITCHEN', tagRef]]), 'terminal-test'),
    /STORE_TERMINAL_SEED_SCENE_PRINTER_MISSING/,
  );
});

test('store-terminal seed selects a unique project-scope store candidate by code', () => {
  const selected = dataNodeCandidate(
    {
      dataNodeCandidates: [
        {dataNodeType: 'STORE', dataNodeCode: 'S-OTHER', dataNodeRef: 'other'},
        {dataNodeType: 'STORE', dataNodeCode: 'S-OP', dataNodeRef: 'target'},
      ],
    },
    'STORE',
    'S-OP',
  );
  assert.equal(selected.dataNodeRef, 'target');
});

test('store-terminal seed resolves area references by fixture key through the candidate code', () => {
  const resolved = mapAreaCandidateRefsByFixtureKey(
    [{code: 'TABLE-MAIN', areaRef}],
    [{key: 'area-table-main', code: 'TABLE-MAIN'}, {key: 'area-table-legacy', code: 'TABLE-LEGACY'}],
    new Set(['area-table-main']),
    'term-front',
  );
  assert.deepEqual(resolved, new Map([['area-table-main', areaRef]]));
  assert.throws(
    () => mapAreaCandidateRefsByFixtureKey([{code: 'TABLE-OTHER', areaRef}], [{key: 'area-table-main', code: 'TABLE-MAIN'}], new Set(['area-table-main']), 'term-front'),
    /STORE_TERMINAL_SEED_REFERENCE_CANDIDATE_MISSING:term-front:TABLE_AREA:area-table-main/,
  );
});

test('store-terminal list readback excludes voided terminals while detail readback keeps them in the denominator', () => {
  const terminals = [
    {key: 'enabled', status: 'ENABLED'},
    {key: 'disabled', status: 'DISABLED'},
    {key: 'voided', status: 'VOIDED'},
  ];
  assert.equal(expectedTerminalPageCount(terminals), 2);
  assert.equal(terminals.length, 3);
});

test('store-terminal list readback is a visible projection of detail readback and rejects identity drift', () => {
  const detailReadback = [
    {key: 'enabled', terminalRef: '11111111-1111-4111-8111-111111111111', name: '启用', status: 'ENABLED'},
    {key: 'voided', terminalRef: '22222222-2222-4222-8222-222222222222', name: '作废', status: 'VOIDED'},
  ];
  assert.deepEqual(validateTerminalPageReadback([
    {terminalRef: detailReadback[0].terminalRef, name: '启用', status: 'ENABLED'},
  ], detailReadback), [{key: 'enabled', terminalRef: detailReadback[0].terminalRef, name: '启用', status: 'ENABLED'}]);
  assert.throws(
    () => validateTerminalPageReadback([
      {terminalRef: detailReadback[1].terminalRef, name: '作废', status: 'VOIDED'},
    ], detailReadback),
    /STORE_TERMINAL_SEED_PAGE_READBACK_IDENTITY_INVALID/,
  );
});

test('store-terminal post-step selects the group role before resolving project candidates', () => {
  assert.match(storeTerminalSeedSource, /sessionIdentity\(session\.json, "GROUP"\)/);
  assert.match(storeTerminalSeedSource, /selectOperationsWorkspaceSessionContext/);
  assert.match(storeTerminalSeedSource, /dataNodeCandidate\(groupContext\.json, "PROJECT", projectFixture\.code\)/);
  assert.match(storeTerminalSeedSource, /"group-store-select"[\s\S]{0,500}requiredContextVersion: projectSelection\.json\?\.contextVersion/);
});

test('store-terminal post-step replaces the edited terminal readback with the post-edit version and refs', () => {
  assert.match(storeTerminalSeedSource, /const projectChildRefs = assertConfigurationReadback\(projectAfter, projectTerminal\.configuration, "term-front"\)/);
  assert.match(storeTerminalSeedSource, /const projectReadback = readback\.find\(\(entry\) => entry\.key === "term-front"\)/);
  assert.match(storeTerminalSeedSource, /projectReadback\.version = Number\(projectAfter\.version\)/);
  assert.match(storeTerminalSeedSource, /projectReadback\.printerRefsByClientKey = projectChildRefs\.printerRefsByClientKey/);
});
