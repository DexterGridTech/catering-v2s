import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  computeFixtureExpectedCounts,
  validateFixtureContract,
  validateTerminalUpdateSeedFixture,
} from './r5-fixture-contract.mjs';

const fixture = JSON.parse(
  fs.readFileSync('doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', 'utf8'),
);

test('r5 fixture contract counts the terminal-update seed domain without folding it into assets', () => {
  const counts = computeFixtureExpectedCounts(fixture);
  assert.equal(counts.terminalUpdateArtifacts, 4);
  assert.equal(counts.terminalUpdateRules, 8);
  assert.equal(counts.activeAssets, fixture.expectedCounts.activeAssets);
  assert.deepEqual(validateTerminalUpdateSeedFixture(fixture), {artifacts: 4, rules: 8});
  assert.equal(validateFixtureContract(fixture).rules, 8);
});

test('r5 fixture contract rejects broken FULL/HOT pairing, wrong scope, and role write leakage', () => {
  const brokenPair = structuredClone(fixture);
  brokenPair.stableFixtures.terminalUpdate.artifacts.find(
    item => item.app === 'sample-terminal' && item.kind === 'HOT',
  ).minimumFullKey = 'update-wallpaper-full';
  assert.throws(() => validateTerminalUpdateSeedFixture(brokenPair), /R5_TERMINAL_UPDATE_ARTIFACT_PAIR_INVALID/);

  const wrongScope = structuredClone(fixture);
  wrongScope.stableFixtures.terminalUpdate.rules.find(item => item.targetMode === 'ALL').storeKeys = [
    'store-operating',
  ];
  assert.throws(() => validateTerminalUpdateSeedFixture(wrongScope), /R5_TERMINAL_UPDATE_RULE_FIXTURE_INVALID/);

  const roleLeak = structuredClone(fixture);
  roleLeak.stableFixtures.workspaceIam.roles
    .find(role => role.key === 'role-project')
    .actionCapabilityKeys.push('MANAGE_PROJECT_TERMINAL_VERSION');
  assert.throws(() => validateTerminalUpdateSeedFixture(roleLeak), /R5_TERMINAL_UPDATE_ROLE_BOUNDARY_INVALID/);

  const storeLeak = structuredClone(fixture);
  storeLeak.stableFixtures.workspaceIam.roles
    .find(role => role.key === 'role-store')
    .pageAccessKeys.push('PG-PROJECT-TERMINAL-VERSION-RULES');
  assert.throws(() => validateTerminalUpdateSeedFixture(storeLeak), /R5_TERMINAL_UPDATE_ROLE_BOUNDARY_INVALID/);
});

test('r5 FULL-only rules omit HOT strategy while HOT rules keep their strategy', () => {
  const fullOnly = fixture.stableFixtures.terminalUpdate.rules.find(rule => rule.key === 'update-console-full-all');
  assert.equal(fullOnly.hotStrategy, undefined);
  assert.equal(fullOnly.mSeconds, null);

  const invalidFullOnly = structuredClone(fixture);
  invalidFullOnly.stableFixtures.terminalUpdate.rules.find(rule => rule.key === 'update-console-full-all').hotStrategy =
    'IMMEDIATE';
  assert.throws(() => validateTerminalUpdateSeedFixture(invalidFullOnly), /R5_TERMINAL_UPDATE_RULE_FIXTURE_INVALID/);
});
