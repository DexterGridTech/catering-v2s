import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {describe, expect, it} from 'vitest';
import {readTerminalSeedFixture, selectTerminalSeedFixture} from '../fixtures/terminal.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('terminal automation seed fixture', () => {
  const contract = JSON.parse(
    readFileSync(path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json'), 'utf8'),
  ) as unknown;

  it('selects the laptop and mobile fixtures from the canonical r5-full contract', () => {
    expect(readTerminalSeedFixture(root, 'dual')).toMatchObject({seedKey: 'term-front', storeKey: 'store-operating', deviceType: 'laptop'});
    expect(readTerminalSeedFixture(root, 'mobile')).toMatchObject({seedKey: 'term-handheld', storeKey: 'store-operating', deviceType: 'mobile'});
  });

  it('rejects duplicate, wrong-shape, disabled, and non-eight-digit fixtures', () => {
    const base = contract as {kind: string; stableFixtures: {organization: {storeTerminals: Record<string, unknown>[]}}};
    const one = base.stableFixtures.organization.storeTerminals.find(value => value.key === 'term-front');
    if (one === undefined) throw new Error('TERMINAL_AUTOMATION_FIXTURE_TEST_SOURCE_MISSING');
    expect(() => selectTerminalSeedFixture({kind: 'wrong', stableFixtures: base.stableFixtures}, 'dual')).toThrow(
      'TERMINAL_AUTOMATION_SEED_CONTRACT_INVALID',
    );
    expect(() =>
      selectTerminalSeedFixture(
        {kind: base.kind, stableFixtures: {organization: {storeTerminals: [one, one]}}},
        'dual',
      ),
    ).toThrow('TERMINAL_AUTOMATION_TERMINAL_FIXTURE_NOT_UNIQUE');
    expect(() =>
      selectTerminalSeedFixture(
        {kind: base.kind, stableFixtures: {organization: {storeTerminals: [{...one, status: 'DISABLED'}]}}},
        'dual',
      ),
    ).toThrow('TERMINAL_AUTOMATION_TERMINAL_FIXTURE_INVALID');
  });
});
