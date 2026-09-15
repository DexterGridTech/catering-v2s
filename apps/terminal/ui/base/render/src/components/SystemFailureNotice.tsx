import type {ReactNode} from 'react'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'

export type SystemFailureNoticeProps = Readonly<{
  readonly testIDPrefix: string
  readonly onDismiss: () => unknown
  readonly title?: string
  readonly message?: string
  readonly dismissLabel?: string
  readonly children?: ReactNode
}>

export const SystemFailureNotice = ({
  testIDPrefix,
  onDismiss,
  title = '系统提示',
  message = '操作没有完成，请重试',
  dismissLabel = '知道了',
  children,
}: SystemFailureNoticeProps) => (
  <PrimitiveContainer testID={testIDPrefix} layout="card">
    <PrimitiveHeading testID={`${testIDPrefix}:title`}>{title}</PrimitiveHeading>
    <PrimitiveText testID={`${testIDPrefix}:message`} accessibilityRole="alert">
      {message}
    </PrimitiveText>
    {children}
    <PrimitiveActions testID={`${testIDPrefix}:actions`}>
      <PrimitiveButton
        testID={`${testIDPrefix}:dismiss`}
        accessibilityLabel="关闭系统提示"
        onPress={onDismiss}
      >
        {dismissLabel}
      </PrimitiveButton>
    </PrimitiveActions>
  </PrimitiveContainer>
)
