import {describe, expect, it} from 'vitest';
import {
  assertFixedUpdateTaskMatchesCandidate,
  assertOwnerFlowReportAccepted,
  assertProjectUpdateCandidate,
} from '../journeys/updateOwnerFlow.ts';

const candidate = Object.freeze({
  collectionHash: 'rules-hash',
  contextIdentity: 'binding-context',
  selectedSpace: 'aurora',
  projectRef: 'project-1',
  storeRef: 'store-1',
  rule: Object.freeze({
    ruleRef: 'rule-1',
    applicationId: 'com.example.console',
    targetMode: 'STORE_REFS',
    storeRefs: Object.freeze(['store-1']),
    full: Object.freeze({artifactRef: 'full-1'}),
    hot: Object.freeze({artifactRef: 'hot-1'}),
  }),
});
const expected = Object.freeze({
  applicationId: 'com.example.console',
  storeRef: 'store-1',
  ruleRef: 'rule-1',
  fullArtifactRef: 'full-1',
  hotArtifactRef: 'hot-1',
});
const task = Object.freeze({
  taskId: 'task-1',
  target: Object.freeze({
    ruleRef: 'rule-1',
    collectionHash: 'rules-hash',
    applicationId: 'com.example.console',
    selectionContext: Object.freeze({contextIdentity: 'binding-context', selectedSpace: 'aurora', ruleRef: 'rule-1'}),
    full: Object.freeze({artifactRef: 'full-1'}),
    hot: Object.freeze({artifactRef: 'hot-1'}),
  }),
});

describe('update owner-flow identity assertions', () => {
  it('accepts the actual project candidate and identical fixed target', () => {
    const checkedCandidate = assertProjectUpdateCandidate(candidate, expected);
    expect(assertFixedUpdateTaskMatchesCandidate(checkedCandidate, task)).toEqual(task);
  });

  it('rejects a candidate from another app or store', () => {
    expect(() => assertProjectUpdateCandidate(candidate, {...expected, applicationId: 'com.example.wallpaper'})).toThrow(
      'TERMINAL_AUTOMATION_OWNER_FLOW_CANDIDATE_IDENTITY_MISMATCH',
    );
    expect(() => assertProjectUpdateCandidate(candidate, {...expected, storeRef: 'store-2'})).toThrow(
      'TERMINAL_AUTOMATION_OWNER_FLOW_CANDIDATE_INVALID',
    );
  });

  it('rejects a fixed target that changed the collection or artifact identity', () => {
    expect(() =>
      assertFixedUpdateTaskMatchesCandidate(candidate, {
        ...task,
        target: {...task.target, collectionHash: 'newer-rules-hash'},
      }),
    ).toThrow('TERMINAL_AUTOMATION_OWNER_FLOW_FIXED_TARGET_MISMATCH');
    expect(() =>
      assertFixedUpdateTaskMatchesCandidate(candidate, {
        ...task,
        target: {...task.target, hot: {artifactRef: 'other-hot'}},
      }),
    ).toThrow('TERMINAL_AUTOMATION_OWNER_FLOW_FIXED_TARGET_MISMATCH');
  });

  it('requires an accepted report for the exact completed task', () => {
    expect(
      assertOwnerFlowReportAccepted({
        task,
        recentStatus: {taskId: 'task-1', state: 'succeeded'},
        reportDelivery: {pendingCount: 0, sendPaused: false, latestDeliveryFailure: null},
      }),
    ).toBe('task-1');
    expect(() =>
      assertOwnerFlowReportAccepted({
        task,
        recentStatus: {taskId: 'old-task', state: 'succeeded'},
        reportDelivery: {pendingCount: 0, sendPaused: false, latestDeliveryFailure: null},
      }),
    ).toThrow('TERMINAL_AUTOMATION_OWNER_FLOW_REPORT_NOT_ACCEPTED');
  });

  it.each([
    ['report still pending', {pendingCount: 1, sendPaused: false, latestDeliveryFailure: null}],
    ['report delivery paused', {pendingCount: 1, sendPaused: true, latestDeliveryFailure: null}],
    ['report delivery failed', {pendingCount: 1, sendPaused: false, latestDeliveryFailure: 'HTTP_UNAVAILABLE'}],
  ])('does not accept a completed task when %s', (_reason, reportDelivery) => {
    expect(() =>
      assertOwnerFlowReportAccepted({
        task,
        recentStatus: {taskId: 'task-1', state: 'succeeded'},
        reportDelivery,
      }),
    ).toThrow('TERMINAL_AUTOMATION_OWNER_FLOW_REPORT_NOT_ACCEPTED');
  });
});
