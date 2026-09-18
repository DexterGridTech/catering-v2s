import {useCallback, useMemo, useState} from 'react'
import type {
  TopologyAdminCapability,
  TopologyAdminCommandResult,
  TopologyFacts,
  TopologyIdentity,
  TopologyOperation,
  TopologyOperationEligibility,
} from '@catering-v2s/kernel-base-contracts'
import {topologyTransportConfig} from '@catering-v2s/kernel-base-contracts'
import {areTopologyFactsEqual, topologyReasonMessages} from '@catering-v2s/kernel-base-topology'
import {type StateRoot} from '@catering-v2s/kernel-base-state'
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

const resultMessage = (operation: TopologyOperation, result: TopologyAdminCommandResult): string =>
  result.reasonCode === undefined
    ? result.status !== 'completed'
      ? '拓扑操作未完成，请重试'
      : operation === 'query-host' && result.identity === undefined
        ? topologyReasonMessages.TOPOLOGY_IDENTITY_FAILED
        : ''
    : topologyReasonMessages[result.reasonCode] || '拓扑操作未完成，请重试'

const identityLabel = (identity: TopologyIdentity): string =>
  `${identity.displayName} / ${identity.nodeId} / ${identity.instanceMode} / ${identity.displayRole}`

export const TopologySection = ({context}: AdminSectionProps) => {
  const {logger} = useRenderContext()
  const capability = context.topologyCapability
  const factsSelector = useMemo(
    () => (_root: StateRoot) => capability?.getSnapshot(),
    [capability],
  )
  const facts = useUiStateSelector<TopologyFacts | undefined>(factsSelector, areTopologyFactsEqual)
  const [identity, setIdentity] = useState<TopologyIdentity | undefined>()
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

  const queryEligibility = eligibility('query-host')
  const pairEligibility = eligibility('pair')
  const unpairEligibility = eligibility('unpair')
  const hostEligibility = eligibility('enable-host')
  const queryDisabledReason = host.trim().length === 0 ? '请输入主机地址' : messageFor(queryEligibility)
  const pairDisabledReason = identity === undefined ? '请先查询并确认主机身份' : messageFor(pairEligibility)
  const hostDisabledReason = messageFor(hostEligibility)

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
        <PrimitiveFormField testID={topologyIds.formField} label="主机地址">
          <PrimitiveInput {...hostField.inputProps} />
        </PrimitiveFormField>
        <PrimitiveButton
          testID={topologyIds.query}
          accessibilityLabel="查询主机身份"
          disabled={busy !== null || !queryEligibility.allowed || host.trim().length === 0}
          busy={busy === 'query-host'}
          onPress={() => {
            if (capability === undefined) return
            void run('query-host', () => capability.queryMasterIdentity({host: host.trim()}), result => {
              if (result.status === 'completed' && result.identity !== undefined) setIdentity(result.identity)
              else setIdentity(undefined)
            })
          }}
        >
          查询主机身份
        </PrimitiveButton>
        {identity === undefined ? null : (
          <PrimitiveKeyValueRow
            testID={topologyIds.identity}
            label="主机身份"
            value={identityLabel(identity)}
          />
        )}
        <PrimitiveButton
          testID={topologyIds.pair}
          accessibilityLabel="配对副机"
          disabled={busy !== null || !pairEligibility.allowed || identity === undefined}
          busy={busy === 'pair'}
          onPress={() => {
            if (capability === undefined || identity === undefined) return
            void run('pair', () => capability.pair({
              locator: {
                host: host.trim(),
                port: topologyTransportConfig.port,
                basePath: topologyTransportConfig.basePath,
                identity,
              },
            }))
          }}
        >
          配对副机
        </PrimitiveButton>
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
        <PrimitiveSwitch
          testID={topologyIds.enable}
          accessibilityLabel="开启主机服务"
          checked={facts?.hostDesired ?? false}
          disabled={busy !== null || !hostEligibility.allowed}
          busy={busy === 'enable-host'}
          onCheckedChange={enabled => {
            if (capability === undefined) return
            void run('enable-host', () => capability.setHostEnabled(enabled))
          }}
        />
        <PrimitiveStatusRow
          testID={topologyIds.reason}
          label="操作说明"
          value={error || (facts?.hostErrorCode ?? hostDisabledReason)}
          tone={error.length > 0 || facts?.hostErrorCode !== null ? 'warn' : 'neutral'}
        />
        {error.length === 0 ? null : (
          <PrimitiveInlineAlert testID={topologyIds.alert} accessibilityLabel="拓扑操作提示">
            {error}
          </PrimitiveInlineAlert>
        )}
        <PrimitiveStatusRow
          testID={topologyIds.queryReason}
          label="查询可用性"
          value={queryEligibility.allowed ? '可用' : queryDisabledReason}
          tone={queryEligibility.allowed ? 'ok' : 'warn'}
        />
        <PrimitiveStatusRow
          testID={topologyIds.pairReason}
          label="配对可用性"
          value={pairEligibility.allowed && identity !== undefined ? '可用' : pairDisabledReason}
          tone={pairEligibility.allowed && identity !== undefined ? 'ok' : 'warn'}
        />
      </InputScrollArea>
    </PrimitiveContainer>
  )
}
