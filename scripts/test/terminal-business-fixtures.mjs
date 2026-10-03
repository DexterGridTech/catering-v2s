import {createHash} from 'node:crypto';

const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/u;

export function terminalBusinessMemberFixture(runId) {
  if (!RUN_ID_RE.test(runId ?? '')) throw new Error('TERMINAL_BUSINESS_FIXTURE_RUN_ID_INVALID');
  const digest = createHash('sha256').update(runId).digest('hex');
  const name = `ter${digest.slice(0, 10)}`;
  const phoneSuffix = String(Number(BigInt(`0x${digest.slice(10, 22)}`) % 100_000_000n)).padStart(8, '0');
  return Object.freeze({name, phone: `010${phoneSuffix}`});
}
