import {describe, expect, it} from 'vitest';
import {terminalAutomationMemberFixture} from '../fixtures/member.ts';

describe('terminal automation member fixture', () => {
  it('is deterministic and run-scoped', () => {
    const first = terminalAutomationMemberFixture('driver-run-0001');
    expect(terminalAutomationMemberFixture('driver-run-0001')).toEqual(first);
    expect(terminalAutomationMemberFixture('driver-run-0002')).not.toEqual(first);
    expect(first.name).toMatch(/^ter[a-f0-9]{10}$/u);
    expect(first.phone).toMatch(/^010\d{8}$/u);
  });

  it.each(['', '../outside', 'x'.repeat(81), 'bad space'])('rejects invalid run id %j', runId => {
    expect(() => terminalAutomationMemberFixture(runId)).toThrow('TERMINAL_AUTOMATION_MEMBER_FIXTURE_RUN_ID_INVALID');
  });
});
