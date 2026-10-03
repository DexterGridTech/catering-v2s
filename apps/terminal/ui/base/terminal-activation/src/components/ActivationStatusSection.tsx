import {cancelTerminaActivationCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {AdminSectionProps} from '@catering-v2s/ui-base-admin-shell';
import {useTrackedCommand, useUiStateSelector} from '@catering-v2s/ui-base-render';
import {
  PrimitiveButton,
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveScrollView,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useState} from 'react';
import type {CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import {selectActivationStatusView} from '../selectors/selectActivationStatusView';

const readableActivation = (status: string): string =>
  status === 'active' ? '已激活' : status === 'activating' ? '激活中' : status === 'cancelling' ? '正在取消' : '未激活';
const readableConnection = (status: string): string =>
  status === 'connected'
    ? '已连接'
    : status === 'connecting' || status === 'awaiting-ready'
      ? '连接中'
      : status === 'backoff'
        ? '等待重连'
        : '已断开';

const cancellationWasAccepted = (result: CommandDispatchResult): boolean =>
  result.status === 'completed' &&
  result.actorResults.some(actor => {
    if (
      actor.status !== 'completed' ||
      typeof actor.result !== 'object' ||
      actor.result === null ||
      Array.isArray(actor.result)
    ) {
      return false;
    }
    const outcome = (actor.result as Readonly<Record<string, unknown>>).status;
    return outcome === 'CANCELLED' || outcome === 'ALREADY_CANCELLED';
  });

export const ActivationStatusSection = (_context: AdminSectionProps) => {
  const hostStatus = useUiStateSelector(selectActivationStatusView);
  const tracked = useTrackedCommand();
  const instanceMode = useUiStateSelector(selectRuntimeInstanceMode);
  const [message, setMessage] = useState('');
  const activation = hostStatus?.activation ?? null;
  const connection = hostStatus?.connection ?? null;
  const hostCanManage =
    instanceMode === 'MASTER' && (activation?.status === 'active' || activation?.status === 'cancelling');
  return (
    <PrimitiveContainer testID="terminal.activation.admin.status" layout="content" appearance="admin-content" bounded>
      <PrimitiveScrollView testID="terminal.activation.admin:scroll" contentPaddingBottom={48}>
        <PrimitiveHeading appearance="admin-page" testID="terminal.activation.admin:title">
          设备激活状态
        </PrimitiveHeading>
        <PrimitiveCard appearance="admin" testID="terminal.activation.admin:card">
          <PrimitiveStatus testID="terminal.activation.admin:state">
            激活状态：{activation === null ? '主机状态待同步' : readableActivation(activation.status)}
          </PrimitiveStatus>
          {hostStatus !== null && hostStatus !== undefined && !hostStatus.currentPeerValue ? (
            <PrimitiveStatus testID="terminal.activation.admin:projection-status" tone="warn">
              上次主机状态（待同步）
            </PrimitiveStatus>
          ) : null}
          <PrimitiveText testID="terminal.activation.admin:terminal">
            终端：
            {activation?.terminalRef ?? (hostStatus === null || hostStatus === undefined ? '等待主机状态' : '暂无')}
          </PrimitiveText>
          <PrimitiveText testID="terminal.activation.admin:store">
            门店：{activation?.storeRef ?? (hostStatus === null || hostStatus === undefined ? '等待主机状态' : '暂无')}
          </PrimitiveText>
          <PrimitiveText testID="terminal.activation.admin:workspace">
            集团空间：
            {activation?.groupWorkspaceKey ??
              (hostStatus === null || hostStatus === undefined ? '等待主机状态' : '暂无')}
          </PrimitiveText>
          <PrimitiveText testID="terminal.activation.admin:connection">
            连接状态：{connection === null ? '主机状态待同步' : readableConnection(connection.status)}
          </PrimitiveText>
          <PrimitiveText testID="terminal.activation.admin:latency">
            连接延时：{hostStatus?.lastRttMs ?? '等待主机状态'}
            {hostStatus === null || hostStatus === undefined ? '' : ' ms'}
          </PrimitiveText>
          {connection?.lastCloseReason === null || connection?.lastCloseReason === undefined ? null : (
            <PrimitiveStatus testID="terminal.activation.admin:last-error" tone="warn">
              最近连接结果：{connection.lastCloseReason}
            </PrimitiveStatus>
          )}
          {hostCanManage ? (
            <PrimitiveButton
              testID="terminal.activation.admin.cancel"
              appearance="admin-secondary"
              disabled={tracked.requestInFlight || activation?.status === 'cancelling'}
              onPress={() => {
                setMessage('');
                void tracked.run({
                  definition: cancelTerminaActivationCommand,
                  payload: Object.freeze({}),
                  rejectionPolicy: 'CONSUME',
                  onOutcome: result => {
                    setMessage(
                      cancellationWasAccepted(result)
                        ? '终端已取消激活。'
                        : '取消激活未完成，请检查当前服务空间与终端状态。',
                    );
                  },
                  onRejected: () => setMessage('取消激活未完成，请检查连接与服务空间。'),
                });
              }}
            >
              {tracked.requestInFlight || activation?.status === 'cancelling' ? '取消中' : '取消激活'}
            </PrimitiveButton>
          ) : null}
          {message.length === 0 ? null : (
            <PrimitiveStatus testID="terminal.activation.admin.result">{message}</PrimitiveStatus>
          )}
        </PrimitiveCard>
      </PrimitiveScrollView>
    </PrimitiveContainer>
  );
};
