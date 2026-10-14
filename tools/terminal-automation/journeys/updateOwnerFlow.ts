type JsonRecord = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type UpdateOwnerFlowIdentity = Readonly<{
  applicationId: string;
  storeRef: string;
  ruleRef: string;
  fullArtifactRef: string;
  hotArtifactRef: string;
}>;

export const assertProjectUpdateCandidate = (
  value: unknown,
  expected: UpdateOwnerFlowIdentity,
): JsonRecord => {
  if (
    !isRecord(value) ||
    typeof value.collectionHash !== 'string' ||
    value.collectionHash.length === 0 ||
    typeof value.contextIdentity !== 'string' ||
    value.contextIdentity.length === 0 ||
    typeof value.selectedSpace !== 'string' ||
    value.selectedSpace.length === 0 ||
    value.storeRef !== expected.storeRef ||
    !isRecord(value.rule)
  ) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_CANDIDATE_INVALID');
  }
  const ruleValue = value.rule;
  if (!isRecord(ruleValue)) throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_CANDIDATE_INVALID');
  const rule = ruleValue;
  const full = rule.full;
  const hot = rule.hot;
  if (
    rule.ruleRef !== expected.ruleRef ||
    rule.applicationId !== expected.applicationId ||
    rule.targetMode !== 'STORE_REFS' ||
    !Array.isArray(rule.storeRefs) ||
    !rule.storeRefs.includes(expected.storeRef) ||
    !isRecord(full) ||
    full.artifactRef !== expected.fullArtifactRef ||
    !isRecord(hot) ||
    hot.artifactRef !== expected.hotArtifactRef
  ) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_CANDIDATE_IDENTITY_MISMATCH');
  }
  return value;
};

export const assertFixedUpdateTaskMatchesCandidate = (candidateValue: unknown, taskValue: unknown): JsonRecord => {
  if (!isRecord(candidateValue) || !isRecord(candidateValue.rule) || !isRecord(taskValue) || !isRecord(taskValue.target)) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_FIXED_TASK_INVALID');
  }
  const candidate = candidateValue;
  const ruleValue = candidate.rule;
  if (!isRecord(ruleValue)) throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_FIXED_TASK_INVALID');
  const rule = ruleValue;
  const target = taskValue.target;
  const full = rule.full;
  const hot = rule.hot;
  const selectionContext = target.selectionContext;
  const targetFull = target.full;
  const targetHot = target.hot;
  if (
    typeof taskValue.taskId !== 'string' ||
    taskValue.taskId.length === 0 ||
    target.ruleRef !== rule.ruleRef ||
    target.collectionHash !== candidate.collectionHash ||
    target.applicationId !== rule.applicationId ||
    !isRecord(selectionContext) ||
    selectionContext.contextIdentity !== candidate.contextIdentity ||
    selectionContext.selectedSpace !== candidate.selectedSpace ||
    selectionContext.ruleRef !== rule.ruleRef ||
    !isRecord(targetFull) ||
    !isRecord(full) ||
    targetFull.artifactRef !== full.artifactRef ||
    !isRecord(targetHot) ||
    !isRecord(hot) ||
    targetHot.artifactRef !== hot.artifactRef
  ) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_FIXED_TARGET_MISMATCH');
  }
  return taskValue;
};

export const assertOwnerFlowReportAccepted = (input: Readonly<{
  task: unknown;
  recentStatus: unknown;
  reportDelivery: unknown;
}>): string => {
  if (!isRecord(input.task) || typeof input.task.taskId !== 'string' || !isRecord(input.recentStatus)) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_REPORT_IDENTITY_INVALID');
  }
  if (
    input.recentStatus.taskId !== input.task.taskId ||
    input.recentStatus.state !== 'succeeded' ||
    !isRecord(input.reportDelivery) ||
    input.reportDelivery.pendingCount !== 0 ||
    input.reportDelivery.sendPaused !== false ||
    input.reportDelivery.latestDeliveryFailure !== null
  ) {
    throw new Error('TERMINAL_AUTOMATION_OWNER_FLOW_REPORT_NOT_ACCEPTED');
  }
  return input.task.taskId;
};
