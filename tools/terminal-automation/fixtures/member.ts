import {createHash} from 'node:crypto';

const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/u;

export type TerminalAutomationMemberFixture = Readonly<{name: string; phone: string}>;

export const terminalAutomationMemberFixture = (runId: string): TerminalAutomationMemberFixture => {
  if (!RUN_ID_RE.test(runId)) throw new Error('TERMINAL_AUTOMATION_MEMBER_FIXTURE_RUN_ID_INVALID');
  const digest = createHash('sha256').update(runId).digest('hex');
  const name = `ter${digest.slice(0, 10)}`;
  const phoneSuffix = String(Number(BigInt(`0x${digest.slice(10, 22)}`) % 100_000_000n)).padStart(8, '0');
  return Object.freeze({name, phone: `010${phoneSuffix}`});
};
