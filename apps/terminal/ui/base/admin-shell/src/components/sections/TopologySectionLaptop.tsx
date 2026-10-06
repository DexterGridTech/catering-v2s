import {useCallback, useState} from 'react';
import type {
  TopologyAdminCapability,
  TopologyAdminCommandResult,
  TopologyFacts,
  TopologyOperation,
  TopologyOperationEligibility,
} from '@catering-v2s/kernel-base-contracts';
import {areTopologyFactsEqual, topologyReasonMessages} from '@catering-v2s/kernel-base-topology';
import {
  PrimitiveButton,
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveFactGrid,
  PrimitiveFormField,
  PrimitiveHeading,
  PrimitiveIcon,
  PrimitiveIconBadge,
  PrimitiveInlineAlert,
  PrimitiveInput,
  PrimitiveStatusLine,
  PrimitiveText,
  testIdProps,
} from '@catering-v2s/ui-base-primitives';
import {InputScrollArea, useInputField} from '@catering-v2s/ui-base-input';
import {useRenderContext, useUiStateSelector} from '@catering-v2s/ui-base-render';
import type {AdminSectionProps} from '../../types/adminSection';
import {topologyFrameId, useReportAdminFrame} from '../../foundations/adminFrameRegistry';
import {adminTestIds} from '../../foundations/adminTestIds';
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../../foundations/adminIdentity';

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0});
const topologyIds = adminTestIds.topology;
// The bounded admin content viewport can end on the last control of a goal
// card. Keep enough presentation-only trailing space for the card action to
// scroll fully above the Android laptop taskbar's interaction edge; this does
// not change topology facts or command eligibility.
const topologyScrollContentPaddingBottom = 192;
// IA-19/22/26/29 are user-visible busy frames. An owner command may complete
// synchronously on a local transport, so keep the bounded busy state visible
// long enough for the user to perceive it and for the busy control contract to
// remain true. This does not delay the owner command itself or change its
// result/feedback semantics.
const topologyOperationMinimumBusyMs = 2_000;
const topologyOperationPreDispatchBusyMs = 800;
type TopologyPageAvailability = ReturnType<TopologyAdminCapability['getPageAvailability']>;

const waitForTopologyBusyWindow = async (startedAt: number): Promise<void> => {
  const remaining = topologyOperationMinimumBusyMs - (Date.now() - startedAt);
  if (remaining > 0) await new Promise<void>(resolve => setTimeout(resolve, remaining));
};

const unavailableEligibility = (operation: TopologyOperation): TopologyOperationEligibility =>
  Object.freeze({
    operation,
    allowed: false,
    reasonCode: 'TOPOLOGY_UNAVAILABLE' as const,
  });

const resultMessage = (operation: TopologyOperation, result: TopologyAdminCommandResult): string =>
  result.reasonCode === undefined
    ? result.status !== 'completed'
      ? `${operation === 'pair' ? '配对' : operation === 'unpair' ? '解绑' : '主机服务'}操作未完成，请重试`
      : ''
    : topologyReasonMessages[result.reasonCode] || '拓扑操作未完成，请重试';

const roleLabel = (facts: TopologyFacts | undefined): string =>
  facts?.instanceMode === 'SLAVE' ? '副机' : facts?.instanceMode === 'MASTER' ? '主机' : '角色未提供';

export const TopologySectionLaptop = ({context}: AdminSectionProps) => {
  const pageAvailability =
    context.topologyCapability?.getPageAvailability() ??
    Object.freeze({
      available: false,
      reasonCode: 'TOPOLOGY_UNAVAILABLE' as const,
    });
  return (
    <PrimitiveContainer
      testID={topologyIds.contentRoot}
      layout="content"
      appearance="admin-content"
      bounded
      style={sectionStyle}
    >
      <InputScrollArea
        testID={topologyIds.scroll}
        contentPaddingBottom={pageAvailability.available ? topologyScrollContentPaddingBottom : undefined}
      >
        <TopologySectionLaptopContent context={context} pageAvailability={pageAvailability} />
      </InputScrollArea>
    </PrimitiveContainer>
  );
};

const TopologySectionLaptopContent = ({
  context,
  pageAvailability,
}: AdminSectionProps & Readonly<{readonly pageAvailability: TopologyPageAvailability}>) => {
  const {logger} = useRenderContext();
  const capability = context.topologyCapability;
  const facts = useUiStateSelector<TopologyFacts | undefined>(() => capability?.getSnapshot(), areTopologyFactsEqual);
  const [busy, setBusy] = useState<TopologyOperation | null>(null);
  const [feedback, setFeedback] = useState<Readonly<{readonly tone: 'ok' | 'warn'; readonly message: string}> | null>(
    null,
  );
  const [showTargetChoice, setShowTargetChoice] = useState(false);
  const hostField = useInputField({
    fieldId: topologyIds.host,
    testID: topologyIds.host,
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
        const nextFeedback =
          message.length === 0
            ? {
                tone: 'ok' as const,
                message:
                  operation === 'pair'
                    ? '配对提交完成，等待状态同步'
                    : operation === 'unpair'
                      ? '解绑提交完成，等待状态同步'
                      : '主机服务操作已提交',
              }
            : {tone: 'warn' as const, message};
        setFeedback(nextFeedback);
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

  const pairEligibility = pageAvailability.available ? eligibility('pair') : unavailableEligibility('pair');
  const unpairEligibility = pageAvailability.available ? eligibility('unpair') : unavailableEligibility('unpair');
  const hostEligibility = pageAvailability.available
    ? eligibility('enable-host')
    : unavailableEligibility('enable-host');
  const isMaster = facts?.instanceMode === 'MASTER';
  const isPaired = facts?.paired === true;
  const isPairing = busy === 'pair';
  const isUnpairing = busy === 'unpair';
  const isHostBusy = busy === 'enable-host' || facts?.hostActual === 'starting' || facts?.hostActual === 'stopping';
  const isHostError = facts?.hostActual === 'error' && !showTargetChoice && busy === null;
  const isPairError = feedback?.tone === 'warn' && !isPaired && !isHostError && !showTargetChoice && busy === null;
  // A pair failure owns its own recovery frame. Do not render the unpaired
  // goal-choice cards beneath it; IA-23 keeps only the IP field, error reason,
  // direct retry, and return-to-choice action visible.
  const showGoalChoice =
    !isPaired && busy === null && !isPairError && (facts?.hostActual === 'stopped' || showTargetChoice);
  const showHostStarting =
    busy === 'enable-host' || facts?.hostActual === 'starting' || facts?.hostActual === 'stopping';
  const showHostReady = facts?.hostActual === 'running' && !isPaired && !showTargetChoice;
  const showPairing = isPairing;
  const showPaired = isPaired;
  const hostErrorMessage =
    facts?.hostErrorCode === null || facts?.hostErrorCode === undefined
      ? ''
      : topologyReasonMessages[facts.hostErrorCode as keyof typeof topologyReasonMessages] ||
        '主机服务未能按当前设置启动';
  const payloadFailureMessage =
    facts?.payloadFailure === null || facts?.payloadFailure === undefined
      ? ''
      : topologyReasonMessages[facts.payloadFailure.code] || '拓扑状态同步失败，请等待下一次同步';
  const pairErrorMessage =
    feedback?.message ?? (payloadFailureMessage || '无法连接到该主机或地址不可用，请修改地址后直接重试');
  const frameId = topologyFrameId({
    surfaceForm: 'laptop',
    pageAvailable: pageAvailability.available,
    facts,
    busy,
    feedbackTone: feedback?.tone ?? null,
    forceRoleChoice: showTargetChoice,
  });
  useReportAdminFrame(frameId);

  if (!pageAvailability.available) {
    return (
      <>
        <PrimitiveHeading appearance="admin-page" testID={topologyIds.title}>
          {context.catalogEntry.title}
        </PrimitiveHeading>
        <PrimitiveCard
          appearance="admin"
          {...testIdProps(adminTestIds.child(topologyIds.pageGate, 'card'))}
          style={{minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 18}}
        >
          <PrimitiveIconBadge
            {...testIdProps(adminTestIds.child(topologyIds.pageGate, 'icon'))}
            accessibilityLabel="功能不可用"
            icon="blocked"
            size={28}
            tone="warn"
          />
          <PrimitiveStatusLine
            testID={topologyIds.pageGate}
            tone="warn"
            style={{justifyContent: 'center', marginTop: 11}}
          >
            当前功能不可用
          </PrimitiveStatusLine>
          <PrimitiveText
            appearance="admin-muted"
            testID={topologyIds.pageGateReason}
            style={{maxWidth: 360, marginTop: 6, textAlign: 'center'}}
          >
            {pageAvailability.reasonCode === 'TOPOLOGY_REQUIRES_SINGLE_SCREEN'
              ? '双机拓扑要求本机只有一个物理屏'
              : topologyReasonMessages[pageAvailability.reasonCode] || '拓扑能力当前不可用'}
          </PrimitiveText>
        </PrimitiveCard>
      </>
    );
  }

  const renderActionRow = (children: React.ReactNode) => (
    <PrimitiveContainer
      testID={topologyIds.actionGroup}
      layout="transparent"
      appearance="admin-content"
      style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}
    >
      {children}
    </PrimitiveContainer>
  );

  const renderTargetChoice = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.goalChoice}>
      <PrimitiveStatusLine testID={topologyIds.pairResult} tone="warn">
        尚未配对 · 请选择当前机器的用途
      </PrimitiveStatusLine>
      <PrimitiveContainer
        {...testIdProps(adminTestIds.child(topologyIds.goalChoice, 'grid'))}
        layout="transparent"
        appearance="admin-content"
        style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 0}}
      >
        <PrimitiveCard appearance="admin" testID={topologyIds.goalHost} style={{flex: 1, minWidth: 280}}>
          <PrimitiveIcon
            {...testIdProps(adminTestIds.child(topologyIds.goalHost, 'icon'))}
            accessibilityLabel="主机"
            appearance="admin-content"
            icon="server"
            size={24}
          />
          <PrimitiveHeading
            appearance="admin-section"
            testID={adminTestIds.node('terminal.admin:topology:goal:host:title')}
          >
            作为主机
          </PrimitiveHeading>
          <PrimitiveText
            appearance="admin-muted"
            testID={adminTestIds.node('terminal.admin:topology:goal:host:description')}
          >
            开启主机服务，等待副机输入地址后配对。
          </PrimitiveText>
          <PrimitiveButton
            appearance="admin-primary"
            testID={topologyIds.action('host-enable')}
            accessibilityLabel="开启主机服务"
            disabled={!isMaster || busy !== null || !hostEligibility.allowed}
            busy={isHostBusy}
            onPress={() => {
              if (capability === undefined) return;
              setShowTargetChoice(false);
              void run('enable-host', () => capability.setHostEnabled(true));
            }}
          >
            开启主机服务
          </PrimitiveButton>
        </PrimitiveCard>
        <PrimitiveCard appearance="admin" testID={topologyIds.goalSlave} style={{flex: 1, minWidth: 280}}>
          <PrimitiveIcon
            {...testIdProps(adminTestIds.child(topologyIds.goalSlave, 'icon'))}
            accessibilityLabel="副机"
            appearance="admin-content"
            icon="link"
            size={24}
          />
          <PrimitiveHeading
            appearance="admin-section"
            testID={adminTestIds.node('terminal.admin:topology:goal:slave:title')}
          >
            作为副机
          </PrimitiveHeading>
          <PrimitiveText
            appearance="admin-muted"
            testID={adminTestIds.node('terminal.admin:topology:goal:slave:description')}
          >
            输入主机 IP，提交后直接发起配对。无需先查询身份。
          </PrimitiveText>
          <PrimitiveFormField testID={topologyIds.hostIp} label="主机 IP 地址">
            <PrimitiveInput {...hostField.inputProps} appearance="admin" />
          </PrimitiveFormField>
          <PrimitiveButton
            appearance="admin-primary"
            testID={topologyIds.pair}
            accessibilityLabel="直接配对副机"
            disabled={busy !== null || !pairEligibility.allowed || host.trim().length === 0}
            busy={isPairing}
            onPress={() => {
              if (capability === undefined) return;
              setShowTargetChoice(false);
              void run('pair', () => capability.pairByHost({host: host.trim()}));
            }}
          >
            直接配对
          </PrimitiveButton>
        </PrimitiveCard>
      </PrimitiveContainer>
      {feedback !== null ? (
        <PrimitiveStatusLine testID={topologyIds.operationFeedback} tone={feedback.tone}>
          {feedback.message}
        </PrimitiveStatusLine>
      ) : null}
    </PrimitiveCard>
  );

  const renderHostStarting = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.hostService}>
      <PrimitiveStatusLine testID={topologyIds.pairResult} tone="info">
        正在开启主机服务…
      </PrimitiveStatusLine>
      <PrimitiveText appearance="admin-muted" testID={topologyIds.hostServiceState}>
        当前机器将作为主机，服务准备完成后等待副机配对。
      </PrimitiveText>
      {renderActionRow(
        <PrimitiveButton
          appearance="admin-primary"
          testID={topologyIds.enable}
          accessibilityLabel="开启中"
          disabled
          busy
        >
          开启中…
        </PrimitiveButton>,
      )}
    </PrimitiveCard>
  );

  const renderHostReady = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.hostService}>
      <PrimitiveStatusLine testID={topologyIds.pairResult} tone="ok">
        主机服务已开启 · 等待副机配对
      </PrimitiveStatusLine>
      <PrimitiveFactGrid
        {...testIdProps(adminTestIds.child(topologyIds.hostService, 'facts'))}
        items={[
          {key: 'role', testID: topologyIds.role, label: '当前角色', value: '主机'},
          {key: 'service', testID: topologyIds.hostServiceState, label: '服务状态', value: '运行中', tone: 'ok'},
          {
            key: 'host',
            testID: topologyIds.hostIp,
            label: '本机 IP 地址',
            value: facts?.hostAddress?.host ?? '本机地址未提供',
          },
        ]}
      />
      <PrimitiveCard appearance="admin-inset" {...testIdProps(adminTestIds.child(topologyIds.hostService, 'hint'))}>
        <PrimitiveText testID={adminTestIds.node(`${topologyIds.hostService}:hint:text`)} appearance="admin-muted">
          请在副机上输入这台主机的 IP 地址并直接配对。
        </PrimitiveText>
      </PrimitiveCard>
      {renderActionRow(
        <PrimitiveButton
          appearance="admin-primary"
          testID={topologyIds.enable}
          accessibilityLabel="关闭主机服务"
          disabled={busy !== null || !hostEligibility.allowed}
          busy={isHostBusy}
          onPress={() => {
            if (capability === undefined) return;
            void run('enable-host', () => capability.setHostEnabled(false));
          }}
        >
          关闭主机服务
        </PrimitiveButton>,
      )}
      <PrimitiveText
        appearance="admin-muted"
        {...testIdProps(adminTestIds.child(topologyIds.hostService, 'close-hint'))}
      >
        关闭服务后回到未配对目标选择。
      </PrimitiveText>
      {feedback !== null ? (
        <PrimitiveStatusLine testID={topologyIds.operationFeedback} tone={feedback.tone}>
          {feedback.message}
        </PrimitiveStatusLine>
      ) : null}
    </PrimitiveCard>
  );

  const renderHostError = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.hostService}>
      <PrimitiveStatusLine testID={topologyIds.pairResult} tone="error">
        主机服务未能开启
      </PrimitiveStatusLine>
      <PrimitiveContainer
        testID={topologyIds.failureReason}
        layout="transparent"
        appearance="admin-content"
        style={{padding: 0}}
      >
        <PrimitiveInlineAlert testID={topologyIds.alert} accessibilityLabel="主机服务失败" tone="error">
          原因：{hostErrorMessage || '主机服务暂时不可用'}
          {'\n'}下一步：检查平台端口后重试。
        </PrimitiveInlineAlert>
      </PrimitiveContainer>
      {renderActionRow(
        <>
          <PrimitiveButton
            appearance="admin-primary"
            testID={topologyIds.retry}
            accessibilityLabel="重试开启主机服务"
            disabled={busy !== null || !hostEligibility.allowed}
            busy={isHostBusy}
            onPress={() => {
              if (capability === undefined) return;
              setShowTargetChoice(false);
              void run('enable-host', () => capability.setHostEnabled(true));
            }}
          >
            重试开启主机服务
          </PrimitiveButton>
          <PrimitiveButton
            appearance="admin-secondary"
            testID={topologyIds.action('return-choice')}
            accessibilityLabel="返回目标选择"
            onPress={() => {
              setFeedback(null);
              setShowTargetChoice(true);
            }}
          >
            返回目标选择
          </PrimitiveButton>
        </>,
      )}
    </PrimitiveCard>
  );

  const renderPairing = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.pairing}>
      <PrimitiveStatusLine testID={topologyIds.pairState} tone="info">
        正在与主机配对…
      </PrimitiveStatusLine>
      <PrimitiveFactGrid
        {...testIdProps(adminTestIds.child(topologyIds.pairing, 'facts'))}
        items={[
          {
            key: 'host',
            testID: topologyIds.hostIp,
            label: '主机 IP',
            value: host.trim().length === 0 ? '地址未提供' : host.trim(),
          },
          {key: 'target', testID: topologyIds.role, label: '当前目标', value: '作为副机'},
        ]}
      />
      <PrimitiveText appearance="admin-muted" {...testIdProps(adminTestIds.child(topologyIds.pairing, 'hint'))}>
        正在建立连接并确认配对结果，请勿重复提交。
      </PrimitiveText>
    </PrimitiveCard>
  );

  const renderPairError = () => (
    <PrimitiveCard appearance="admin" testID={topologyIds.pairing}>
      <PrimitiveStatusLine testID={topologyIds.pairResult} tone="error">
        配对未完成
      </PrimitiveStatusLine>
      <PrimitiveFormField testID={topologyIds.hostIp} label="主机 IP 地址">
        <PrimitiveInput {...hostField.inputProps} appearance="admin" />
      </PrimitiveFormField>
      <PrimitiveContainer
        testID={topologyIds.failureReason}
        layout="transparent"
        appearance="admin-content"
        style={{padding: 0}}
      >
        <PrimitiveInlineAlert testID={topologyIds.alert} accessibilityLabel="直接配对失败" tone="error">
          原因：{pairErrorMessage}
          {'\n'}请修改地址后直接重试。
        </PrimitiveInlineAlert>
      </PrimitiveContainer>
      {renderActionRow(
        <>
          <PrimitiveButton
            appearance="admin-primary"
            testID={topologyIds.retry}
            accessibilityLabel="直接重试配对"
            disabled={busy !== null || host.trim().length === 0 || !pairEligibility.allowed}
            onPress={() => {
              if (capability === undefined) return;
              setShowTargetChoice(false);
              void run('pair', () => capability.pairByHost({host: host.trim()}));
            }}
          >
            直接重试配对
          </PrimitiveButton>
          <PrimitiveButton
            appearance="admin-secondary"
            testID={topologyIds.action('return-choice')}
            accessibilityLabel="返回目标选择"
            onPress={() => {
              setFeedback(null);
              setShowTargetChoice(true);
            }}
          >
            返回目标选择
          </PrimitiveButton>
        </>,
      )}
    </PrimitiveCard>
  );

  const renderPaired = () => {
    const reconnecting = facts?.peerReachable !== true;
    const stateLabel = isUnpairing ? '正在解除配对' : reconnecting ? '已配对 · 正在重连' : '已配对 · 对端可达';
    const stateTone = isUnpairing || reconnecting ? ('warn' as const) : ('ok' as const);
    return (
      <PrimitiveCard appearance="admin" testID={topologyIds.pairing}>
        <PrimitiveStatusLine
          testID={topologyIds.pairResult}
          tone={stateTone}
        >{`${roleLabel(facts)} · ${stateLabel}`}</PrimitiveStatusLine>
        <PrimitiveFactGrid
          {...testIdProps(adminTestIds.child(topologyIds.pairing, 'facts'))}
          items={[
            {
              key: 'paired',
              testID: topologyIds.pairState,
              label: '配对状态',
              value: isUnpairing ? '处理中' : '已配对',
              tone: isUnpairing ? 'warn' : 'ok',
            },
            {
              key: 'reachability',
              testID: topologyIds.reachability,
              label: '对端连接',
              value: reconnecting ? '重连中' : '可达',
              tone: reconnecting ? 'warn' : 'ok',
            },
            {key: 'role', testID: topologyIds.role, label: '当前角色', value: roleLabel(facts)},
            {
              key: 'counterparty',
              testID: topologyIds.counterparty,
              label: '对端',
              value: facts?.peerIdentity?.displayName ?? '已配对设备',
            },
          ]}
        />
        <PrimitiveCard appearance="admin-inset" {...testIdProps(adminTestIds.child(topologyIds.pairing, 'result'))}>
          <PrimitiveText testID={adminTestIds.node(`${topologyIds.pairing}:result:text`)} appearance="admin-muted">
            {isUnpairing
              ? '正在解除配对，完成后将回到可选择目标的状态。'
              : isMaster
                ? '当前机器负责主机服务；副机内容由配对链路同步。'
                : '当前机器作为副机；可主动解除配对，解除后恢复为主机候选。'}
          </PrimitiveText>
        </PrimitiveCard>
        {feedback !== null ? (
          <PrimitiveStatusLine testID={topologyIds.operationFeedback} tone={feedback.tone}>
            {feedback.message}
          </PrimitiveStatusLine>
        ) : null}
        {isMaster ? (
          <PrimitiveButton
            appearance="admin-secondary"
            testID={topologyIds.enable}
            accessibilityLabel={facts?.hostActual === 'running' ? '关闭主机服务' : '开启主机服务'}
            disabled={busy !== null || !hostEligibility.allowed}
            busy={isHostBusy}
            onPress={() => {
              if (capability === undefined) return;
              void run('enable-host', () => capability.setHostEnabled(facts?.hostActual !== 'running'));
            }}
          >
            {facts?.hostActual === 'running' ? '关闭主机服务' : '开启主机服务'}
          </PrimitiveButton>
        ) : null}
        <PrimitiveButton
          appearance="admin-primary"
          testID={topologyIds.unpair}
          accessibilityLabel="解除配对"
          disabled={busy !== null || !unpairEligibility.allowed}
          busy={isUnpairing}
          onPress={() => {
            if (capability === undefined) return;
            void run('unpair', () => capability.unpair());
          }}
        >
          解除配对
        </PrimitiveButton>
      </PrimitiveCard>
    );
  };

  return (
    <>
      <PrimitiveHeading appearance="admin-page" testID={topologyIds.title}>
        {context.catalogEntry.title}
      </PrimitiveHeading>
      {showHostStarting ? renderHostStarting() : null}
      {showHostReady ? renderHostReady() : null}
      {isHostError ? renderHostError() : null}
      {showPairing ? renderPairing() : null}
      {isPairError ? renderPairError() : null}
      {showPaired ? renderPaired() : null}
      {showGoalChoice ? renderTargetChoice() : null}
    </>
  );
};
