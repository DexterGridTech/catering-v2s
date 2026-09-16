import {PrimitiveContainer, PrimitiveEmptyState, PrimitiveHeading} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'

const sectionStyle = Object.freeze({flex: 1, minHeight: 0, minWidth: 0})

export const SampleSection = ({context}: AdminSectionProps) => (
  <PrimitiveContainer testID="sample.console.admin-test" layout="content" bounded style={sectionStyle}>
    <PrimitiveHeading testID="sample.console.admin-test:title">{context.catalogEntry.title}</PrimitiveHeading>
    <PrimitiveEmptyState testID="sample.console.admin-test:empty" accessibilityLabel="示例诊断为空">暂无诊断内容</PrimitiveEmptyState>
  </PrimitiveContainer>
)
