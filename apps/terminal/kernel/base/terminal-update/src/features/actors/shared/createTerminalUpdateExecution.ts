import type {UpdatePresentation} from '@catering-v2s/kernel-base-platform-ports';

export type TerminalUpdateExecution = {
  targetCommitPending: Promise<void> | null;
  reportSendInFlight: Readonly<{attemptId: number; expiresAt: number}> | null;
  nextReportSendAttemptId: number;
  currentPresentation: UpdatePresentation;
};

export const createTerminalUpdateExecution = (): TerminalUpdateExecution => ({
  targetCommitPending: null,
  reportSendInFlight: null,
  nextReportSendAttemptId: 0,
  currentPresentation: 'unknown',
});
