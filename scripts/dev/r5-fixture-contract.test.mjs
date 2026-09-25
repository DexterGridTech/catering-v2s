import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {computeFixtureExpectedCounts, validateFixtureContract, validateFixtureContractPhaseNames, validateFixtureExpectedCounts, validateFixtureSeedStages} from './r5-fixture-contract.mjs';

const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const profilePath = new URL('./profiles/r5-full.json', import.meta.url);
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

test('r5-full profile delegates counts to the fixture contract', () => {
  assert.equal(Object.hasOwn(profile, 'expectedCounts'), false);
  assert.equal(profile.fixtureContract, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
});

test('fixture contract expected counts are authoritative for every declared collection', () => {
  const counts = computeFixtureExpectedCounts(fixture);
  assert.deepEqual(counts, fixture.expectedCounts);
  assert.deepEqual(validateFixtureExpectedCounts(fixture).actual, fixture.expectedCounts);
  assert.deepEqual(validateFixtureContract(fixture).stageIds, fixture.seedStages.map((stage) => stage.id));
});

test('fixture contract rejects count drift and stage drift before seed execution', () => {
  const countDrift = structuredClone(fixture);
  countDrift.expectedCounts.passwordResetStateFixtures += 1;
  assert.throws(() => validateFixtureExpectedCounts(countDrift), /R5_SEED_FIXTURE_CONTRACT_COUNT_DRIFT:passwordResetStateFixtures/);

  const stageDrift = structuredClone(fixture);
  stageDrift.seedStages[2].id = 'organization';
  assert.throws(() => validateFixtureSeedStages(stageDrift), /R5_SEED_FIXTURE_STAGE_ORDER_INVALID/);

  const missingReadback = structuredClone(fixture);
  missingReadback.seedStages[0].readback = [];
  assert.throws(() => validateFixtureSeedStages(missingReadback), /R5_SEED_FIXTURE_STAGE_INVALID:bootstrap/);
});

test('fixture contract rejects missing or cross-project contract phase names before HTTP seed execution', () => {
  const missingPhaseName = structuredClone(fixture);
  delete missingPhaseName.stableFixtures.contracts[1].phaseNameSnapshot;
  assert.throws(() => validateFixtureContractPhaseNames(missingPhaseName), /R5_SEED_FIXTURE_CONTRACT_PHASE_NAME_MISSING:contract-current-b/);

  const invalidPhaseName = structuredClone(fixture);
  invalidPhaseName.stableFixtures.contracts[1].phaseNameSnapshot = '不存在的阶段';
  assert.throws(() => validateFixtureContractPhaseNames(invalidPhaseName), /R5_SEED_FIXTURE_CONTRACT_PHASE_NAME_INVALID:contract-current-b/);
});
