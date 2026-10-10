import dayjs from 'dayjs';
import {describe, expect, it} from 'vitest';
import {terminalUpdateRuleFilters} from './terminalUpdateRuleFilters';

describe('terminalUpdateRuleFilters', () => {
  it('maps the selected app and inclusive calendar-day range to the server query', () => {
    expect(terminalUpdateRuleFilters({
      status: 'ENABLED',
      applicationId: '  com.example.console  ',
      createdRange: [dayjs('2026-10-01'), dayjs('2026-10-03')],
    })).toEqual({
      status: 'ENABLED',
      applicationId: 'com.example.console',
      createdFromEpochMillis: dayjs('2026-10-01').startOf('day').valueOf(),
      createdToEpochMillis: dayjs('2026-10-03').endOf('day').valueOf(),
    });
  });

  it('omits empty application filters and the date range', () => {
    expect(terminalUpdateRuleFilters({applicationId: '  '})).toEqual({});
  });
});
