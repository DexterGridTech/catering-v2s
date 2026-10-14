export type RuntimeLimits = Readonly<{
  maxCommandDepth: number;
  maxCommandsPerRequest: number;
  maxActorResultBytes: number;
  requestRetentionMs: number;
  requestMaxResidenceMs: number;
  maxJournalRecords: number;
}>;

