import {useCallback, useState} from 'react';
import type {
  TopologyAdminCapability,
  TopologyAdminCommandResult,
  TopologyOperation,
  TopologyOperationEligibility,
} from '@catering-v2s/kernel-base-contracts';
import {topologyReasonMessages} from '@catering-v2s/kernel-base-topology';
import {useInputField} from '@catering-v2s/ui-base-input';
import {useRenderContext} from '@catering-v2s/ui-base-render';
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../foundations/adminIdentity';
import {adminTestIds} from '../foundations/adminTestIds';

const topologyOperationMinimumBusyMs = 2_000;
const topologyOperationPreDispatchBusyMs = 800;

const waitForTopologyBusyWindow = async (startedAt: number): Promise<void> => {
  const remaining = topologyOperationMinimumBusyMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise<void>(resolve => setTimeout(resolve, remaining));
};

const unavailableEligibility = (operation: TopologyOperation): TopologyOperationEligibility =>
  Object.freeze({operation, allowed: false, reasonCode: 'TOPOLOGY_UNAVAILABLE'});

const resultMessage = (operation: TopologyOperation, result: TopologyAdminCommandResult): string =>
  result.reasonCode === undefined
    ? result.status !== 'completed'
      ? `${operation === 'pair' ? '配对' : operation === 'unpair' ? '解绑' : '主机服务'}操作未完成，请重试`
      : ''
    : topologyReasonMessages[result.reasonCode] || '拓扑操作未完成，请重试';

export const useTopologyAdminForm = (capability: TopologyAdminCapability | undefined) => {
  const {logger} = useRenderContext();
  const [busy, setBusy] = useState<TopologyOperation | null>(null);
  const [feedback, setFeedback] = useState<Readonly<{readonly tone: 'ok' | 'warn'; readonly message: string}> | null>(
    null,
  );
  const [showTargetChoice, setShowTargetChoice] = useState(false);
  const hostField = useInputField({
    fieldId: adminTestIds.topology.host,
    testID: adminTestIds.topology.host,
    accessibilityLabel: '主机地址',
    editable: busy === null,
    keyboardKind: 'virtual',
    layout: 'financial',
    focusScopeId: ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  });
  const host = hostField.inputProps.value ?? '';

  const eligibility = useCallback(
    (operation: TopologyOperation): TopologyOperationEligibility =>
      capability?.getOperationEligibility(operation) ?? unavailableEligibility(operation),
    [capability],
  );

  const run = useCallback(
    async (operation: TopologyOperation, action: () => Promise<TopologyAdminCommandResult>): Promise<void> => {
      if (busy !== null || !eligibility(operation).allowed) return;
      const startedAt = Date.now();
      setBusy(operation);
      setFeedback(null);
      logger.info({
        category: 'admin.topology',
        event: 'admin.topology-operation-started',
        message: 'Topology admin operation started',
        data: {operation},
      });
      try {
        // Pair success can reset the runtime and unmount this admin layer before
        // the owner promise settles. Give the busy frame one bounded render
        // window before dispatch so IA-22 remains a real user-visible state.
        await new Promise<void>(resolve => setTimeout(resolve, topologyOperationPreDispatchBusyMs));
        const result = await action();
        const message = resultMessage(operation, result);
        setFeedback(
          message.length === 0
            ? {
                tone: 'ok',
                message:
                  operation === 'pair'
                    ? '配对提交完成，等待状态同步'
                    : operation === 'unpair'
                      ? '解绑提交完成，等待状态同步'
                      : '主机服务操作已提交',
              }
            : {tone: 'warn', message},
        );
        logger.info({
          category: 'admin.topology',
          event: 'admin.topology-operation-completed',
          message: 'Topology admin operation completed',
          data: {operation, status: result.status, reasonCode: result.reasonCode ?? null},
        });
      } catch {
        setFeedback({tone: 'warn', message: '拓扑操作未完成，请重试'});
        logger.error({
          category: 'admin.topology',
          event: 'admin.topology-operation-failed',
          message: 'Topology admin operation failed',
          data: {operation},
        });
      } finally {
        await waitForTopologyBusyWindow(startedAt);
        setBusy(null);
      }
    },
    [busy, eligibility, logger],
  );

  return {busy, feedback, setFeedback, showTargetChoice, setShowTargetChoice, hostField, host, eligibility, run};
};
