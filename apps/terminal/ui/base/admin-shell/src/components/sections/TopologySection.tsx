import {useCallback, useState} from 'react'
import type {
  TopologyAdminCommandResult,
  TopologyFacts,
  TopologyOperation,
  TopologyOperationEligibility,
} from '@catering-v2s/kernel-base-contracts'
import {areTopologyFactsEqual, topologyReasonMessages} from '@catering-v2s/kernel-base-topology'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveFormField,
  PrimitiveHeading,
  PrimitiveInlineAlert,
  PrimitiveInput,
  PrimitiveKeyValueRow,
  PrimitiveStatusRow,
  PrimitiveSwitch,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea, useInputField} from '@catering-v2s/ui-base-input'
import {useRenderContext, useUiStateSelector} from '@catering-v2s/ui-base-render'
import type {AdminSectionProps} from '../../types/adminSection'
import {adminTestIds} from '../../foundations/adminTestIds'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../../foundations/adminIdentity'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})
const topologyIds = adminTestIds.topology

const unavailableEligibility = (operation: TopologyOperation): TopologyOperationEligibility => Object.freeze({
  operation,
  allowed: false,
  reasonCode: 'TOPOLOGY_UNAVAILABLE' as const,
})

const messageFor = (result: TopologyOperationEligibility): string =>
  topologyReasonMessages[result.reasonCode] || '当前操作不可用'

const resultMessage = (_operation: TopologyOperation, result: TopologyAdminCommandResult): string =>
  result.reasonCode === undefined
    ? result.status !== 'completed' ? '拓扑操作未完成，请重试' : ''
    : topologyReasonMessages[result.reasonCode] || '拓扑操作未完成，请重试'

export const TopologySection = ({context}: AdminSectionProps) => {
  const {logger} = useRenderContext()
  const capability = context.topologyCapability
  const facts = useUiStateSelector<TopologyFacts | undefined>(() => capability?.getSnapshot(), areTopologyFactsEqual)
  const [busy, setBusy] = useState<TopologyOperation | null>(null)
  const [error, setError] = useState('')
  const hostField = useInputField({
    fieldId: topologyIds.host,
    testID: topologyIds.host,
    accessibilityLabel: '主机地址',
    editable: busy === null,
    keyboardKind: 'virtual',
    layout: 'financial',
    keyboardPlacement: 'surface',
    focusScopeId: ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  })
  const host = hostField.inputProps.value ?? ''

  const eligibility = useCallback((operation: TopologyOperation): TopologyOperationEligibility =>
    capability?.getOperationEligibility(operation) ?? unavailableEligibility(operation), [capability])

  const run = useCallback(async (
    operation: TopologyOperation,
    action: () => Promise<TopologyAdminCommandResult>,
    onCompleted?: (result: TopologyAdminCommandResult) => void,
  ): Promise<void> => {
    if (busy !== null || !eligibility(operation).allowed) return
    setBusy(operation)
    setError('')
    logger.info({
      category: 'admin.topology',
      event: 'admin.topology-operation-started',
      message: 'Topology admin operation started',
      data: {operation},
    })
    try {
      const result = await action()
      onCompleted?.(result)
      logger.info({
        category: 'admin.topology',
        event: 'admin.topology-operation-completed',
        message: 'Topology admin operation completed',
        data: {operation, status: result.status, reasonCode: result.reasonCode ?? null},
      })
      const message = resultMessage(operation, result)
      if (message.length > 0) setError(message)
    } catch {
      logger.error({
        category: 'admin.topology',
        event: 'admin.topology-operation-failed',
        message: 'Topology admin operation failed',
        data: {operation},
      })
      setError('拓扑操作未完成，请重试')
    } finally {
      setBusy(null)
    }
  }, [busy, eligibility, logger])

  const pairEligibility = eligibility('pair')
  const unpairEligibility = eligibility('unpair')
  const hostEligibility = eligibility('enable-host')
  const pageAvailability = capability?.getPageAvailability() ?? Object.freeze({
    available: false,
    reasonCode: 'TOPOLOGY_UNAVAILABLE' as const,
  })
  const isMaster = facts?.instanceMode === 'MASTER'
  const isPaired = facts?.paired === true
  const showHostAction = isMaster
  const showPairAction = isMaster && !isPaired && facts?.hostActual === 'stopped'
  const showUnpairAction = isPaired
  const pairDisabledReason = host.trim().length === 0 ? '请输入主机地址' : messageFor(pairEligibility)
  const hostDisabledReason = messageFor(hostEligibility)
  const payloadFailureMessage = facts?.payloadFailure === null || facts?.payloadFailure === undefined
    ? ''
    : topologyReasonMessages[facts.payloadFailure.code] || '拓扑状态同步失败，请等待下一次同步'

  if (!pageAvailability.available) {
    return (
      <PrimitiveContainer testID={topologyIds.section} layout="content" bounded style={sectionStyle}>
        <InputScrollArea testID={topologyIds.scroll}>
          <PrimitiveHeading testID={topologyIds.title}>{context.catalogEntry.title}</PrimitiveHeading>
          <PrimitiveStatusRow
            testID={topologyIds.pageGate}
            label="当前功能"
            value="当前功能不可用"
            tone="warn"
          />
          <PrimitiveStatusRow
            testID={topologyIds.pageGateReason}
            label="原因"
            value={topologyReasonMessages[pageAvailability.reasonCode] || '拓扑能力当前不可用'}
            tone="warn"
          />
        </InputScrollArea>
      </PrimitiveContainer>
    )
  }

  return (
    <PrimitiveContainer testID={topologyIds.section} layout="content" bounded style={sectionStyle}>
      <InputScrollArea testID={topologyIds.scroll}>
        <PrimitiveHeading testID={topologyIds.title}>{context.catalogEntry.title}</PrimitiveHeading>
        <PrimitiveKeyValueRow
          testID={topologyIds.form}
          label="形态"
          value={facts?.surfaceForm ?? 'unknown'}
        />
        <PrimitiveKeyValueRow
          testID={topologyIds.displayCount}
          label="物理屏幕"
          value={facts?.displayCount === null || facts?.displayCount === undefined ? '未就绪' : String(facts.displayCount)}
        />
        <PrimitiveStatusRow
          testID={topologyIds.paired}
          label="配对状态"
          value={facts?.paired ? '已配对' : '未配对'}
          tone={facts?.paired ? 'ok' : 'neutral'}
        />
        <PrimitiveStatusRow
          testID={topologyIds.reachable}
          label="副机连接"
          value={facts?.peerReachable ? '可达' : facts?.paired ? '重连中' : '未配对'}
          tone={facts?.peerReachable ? 'ok' : 'warn'}
        />
        <PrimitiveKeyValueRow
          testID={topologyIds.status}
          label="主机服务"
          value={`${facts?.hostActual ?? 'stopped'} / ${facts?.hostDesired ? '期望开启' : '期望关闭'}`}
        />
        {showPairAction ? (
          <PrimitiveFormField testID={topologyIds.formField} label="主机地址">
            <PrimitiveInput {...hostField.inputProps} />
          </PrimitiveFormField>
        ) : null}
        {showPairAction ? (
          <PrimitiveButton
            testID={topologyIds.pair}
            accessibilityLabel="直接配对副机"
            disabled={busy !== null || !pairEligibility.allowed || host.trim().length === 0}
            busy={busy === 'pair'}
            onPress={() => {
              if (capability === undefined) return
              void run('pair', () => capability.pairByHost({host: host.trim()}))
            }}
          >
            直接配对副机
          </PrimitiveButton>
        ) : null}
        {showUnpairAction ? (
          <PrimitiveButton
            testID={topologyIds.unpair}
            accessibilityLabel="解除配对"
            disabled={busy !== null || !unpairEligibility.allowed}
            busy={busy === 'unpair'}
            onPress={() => {
              if (capability === undefined) return
              void run('unpair', () => capability.unpair())
            }}
          >
            解除配对
          </PrimitiveButton>
        ) : null}
        {showHostAction ? (
          <PrimitiveSwitch
            testID={topologyIds.enable}
            accessibilityLabel={facts?.hostDesired ? '关闭主机服务' : '开启主机服务'}
            checked={facts?.hostDesired ?? false}
            disabled={busy !== null || !hostEligibility.allowed}
            busy={busy === 'enable-host'}
            onCheckedChange={enabled => {
              if (capability === undefined) return
              void run('enable-host', () => capability.setHostEnabled(enabled))
            }}
          />
        ) : null}
        <PrimitiveStatusRow
          testID={topologyIds.reason}
          label="操作说明"
          value={error || payloadFailureMessage || (facts?.hostErrorCode ?? hostDisabledReason)}
          tone={error.length > 0 || payloadFailureMessage.length > 0 || facts?.hostErrorCode !== null ? 'warn' : 'neutral'}
        />
        {error.length === 0 ? null : (
          <PrimitiveInlineAlert testID={topologyIds.alert} accessibilityLabel="拓扑操作提示">
            {error}
          </PrimitiveInlineAlert>
        )}
        <PrimitiveStatusRow
          testID={topologyIds.pairReason}
          label="配对可用性"
          value={showPairAction && pairEligibility.allowed && host.trim().length > 0 ? '可用' : showPairAction ? pairDisabledReason : '当前状态无需直接配对'}
          tone={showPairAction && pairEligibility.allowed && host.trim().length > 0 ? 'ok' : 'warn'}
        />
      </InputScrollArea>
    </PrimitiveContainer>
  )
}
