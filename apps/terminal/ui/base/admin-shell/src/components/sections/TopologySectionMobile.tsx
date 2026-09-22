import {
  PrimitiveCard,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveIconBadge,
  PrimitiveStatusLine,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {topologyReasonMessages} from '@catering-v2s/kernel-base-topology'
import type {AdminSectionProps} from '../../types/adminSection'
import {topologyFrameId, useReportAdminFrame} from '../../foundations/adminFrameRegistry'
import {adminTestIds} from '../../foundations/adminTestIds'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})
const topologyIds = adminTestIds.topology

/** Mobile has a distinct topology page: a single fail-closed gate with no actions. */
export const TopologySectionMobile = ({context}: AdminSectionProps) => {
  useReportAdminFrame(topologyFrameId({
    surfaceForm: 'mobile',
    pageAvailable: false,
    facts: undefined,
    busy: null,
    feedbackTone: null,
  }))

  return (
    <PrimitiveContainer testID={topologyIds.section} layout="content" appearance="admin-content" bounded style={sectionStyle}>
      <InputScrollArea testID={topologyIds.scroll}>
        <PrimitiveHeading appearance="admin-page" testID={topologyIds.title}>{context.catalogEntry.title}</PrimitiveHeading>
        <PrimitiveCard testID={`${topologyIds.pageGate}:card`} appearance="admin" style={{minHeight: 230, alignItems: 'center', justifyContent: 'center', padding: 18}}>
          <PrimitiveIconBadge testID={`${topologyIds.pageGate}:icon`} accessibilityLabel="功能不可用" icon="blocked" size={28} tone="warn" />
          <PrimitiveStatusLine testID={topologyIds.pageGate} tone="warn" style={{justifyContent: 'center', marginTop: 11}}>当前功能不可用</PrimitiveStatusLine>
          <PrimitiveText appearance="admin-muted" testID={topologyIds.pageGateReason} style={{maxWidth: 360, marginTop: 6, textAlign: 'center'}}>
            {topologyReasonMessages.TOPOLOGY_UNSUPPORTED_FORM}
          </PrimitiveText>
        </PrimitiveCard>
      </InputScrollArea>
    </PrimitiveContainer>
  )
}
