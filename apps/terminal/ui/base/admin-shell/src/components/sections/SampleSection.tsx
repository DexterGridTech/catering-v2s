import {PrimitiveContainer, PrimitiveEmptyState, PrimitiveHeading} from '@catering-v2s/ui-base-primitives'
import type {AdminSectionProps} from '../../types/adminSection'

export const SampleSection = ({context}: AdminSectionProps) => (
  <PrimitiveContainer testID="sample.console.admin-test" layout="content" bounded>
    <PrimitiveHeading testID="sample.console.admin-test:title">{context.catalogEntry.title}</PrimitiveHeading>
    <PrimitiveEmptyState testID="sample.console.admin-test:empty" accessibilityLabel="示例诊断为空">暂无诊断内容</PrimitiveEmptyState>
  </PrimitiveContainer>
)
