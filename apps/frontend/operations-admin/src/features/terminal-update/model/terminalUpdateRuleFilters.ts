import type {Dayjs} from 'dayjs';

export type TerminalUpdateRuleFilterForm = {
  status?: 'ENABLED' | 'DISABLED';
  applicationId?: string;
  createdRange?: [Dayjs, Dayjs];
};

export type TerminalUpdateRuleFilters = {
  status?: 'ENABLED' | 'DISABLED';
  applicationId?: string;
  createdFromEpochMillis?: number;
  createdToEpochMillis?: number;
};

export function terminalUpdateRuleFilters(values: TerminalUpdateRuleFilterForm): TerminalUpdateRuleFilters {
  const applicationId = values.applicationId?.trim();
  return {
    ...(values.status ? {status: values.status} : {}),
    ...(applicationId ? {applicationId} : {}),
    ...(values.createdRange
      ? {
          createdFromEpochMillis: values.createdRange[0].startOf('day').valueOf(),
          createdToEpochMillis: values.createdRange[1].endOf('day').valueOf(),
        }
      : {}),
  };
}
