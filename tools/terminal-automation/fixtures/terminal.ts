import {readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';

export type TerminalAutomationShape = 'dual' | 'mobile';
export type TerminalSeedFixture = Readonly<{
  readonly seedKey: 'term-front' | 'term-handheld';
  readonly storeKey: string;
  readonly name: string;
  readonly deviceType: 'laptop' | 'mobile';
  readonly activationCode: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fail = (code: string): never => {
  throw new Error(code);
};

export const selectTerminalSeedFixture = (contract: unknown, shape: TerminalAutomationShape): TerminalSeedFixture => {
  if (!isRecord(contract) || contract.kind !== 'r5-full-dev-seed-fixture-contract') {
    return fail('TERMINAL_AUTOMATION_SEED_CONTRACT_INVALID');
  }
  const stable = contract.stableFixtures;
  const organization = isRecord(stable) ? stable.organization : undefined;
  const entries = isRecord(organization) ? organization.storeTerminals : undefined;
  if (!Array.isArray(entries)) return fail('TERMINAL_AUTOMATION_TERMINAL_FIXTURES_MISSING');
  const seedKey = shape === 'dual' ? 'term-front' : 'term-handheld';
  const expectedDeviceType = shape === 'dual' ? 'laptop' : 'mobile';
  const matches = entries.filter(entry => isRecord(entry) && entry.key === seedKey);
  if (matches.length !== 1 || !isRecord(matches[0])) return fail('TERMINAL_AUTOMATION_TERMINAL_FIXTURE_NOT_UNIQUE');
  const fixture = matches[0];
  if (
    fixture.store !== 'store-operating' ||
    fixture.status !== 'ENABLED' ||
    fixture.deviceType !== expectedDeviceType ||
    typeof fixture.name !== 'string' ||
    fixture.name.length === 0 ||
    typeof fixture.activationCode !== 'string' ||
    !/^\d{8}$/u.test(fixture.activationCode)
  ) {
    return fail('TERMINAL_AUTOMATION_TERMINAL_FIXTURE_INVALID');
  }
  return Object.freeze({
    seedKey,
    storeKey: fixture.store,
    name: fixture.name,
    deviceType: expectedDeviceType,
    activationCode: fixture.activationCode,
  });
};

export const readTerminalSeedFixture = (
  repositoryRoot: string,
  shape: TerminalAutomationShape,
): TerminalSeedFixture => {
  const root = realpathSync(repositoryRoot);
  const candidate = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
  const source = realpathSync(candidate);
  const relative = path.relative(root, source);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return fail('TERMINAL_AUTOMATION_SEED_CONTRACT_OUTSIDE_REPOSITORY');
  }
  let contract: unknown;
  try {
    contract = JSON.parse(readFileSync(source, 'utf8'));
  } catch {
    return fail('TERMINAL_AUTOMATION_SEED_CONTRACT_INVALID');
  }
  return selectTerminalSeedFixture(contract, shape);
};
