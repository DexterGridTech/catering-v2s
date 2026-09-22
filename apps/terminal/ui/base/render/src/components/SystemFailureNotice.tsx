import type {ReactNode} from 'react'
import type {StyleProp, ViewStyle} from 'react-native'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'

export type SystemFailureNoticePresentation = Readonly<{
  readonly rootStyle?: StyleProp<ViewStyle>
  readonly cardStyle?: StyleProp<ViewStyle>
  readonly actionsOrientation?: 'row' | 'column'
  readonly dismissButtonStyle?: StyleProp<ViewStyle>
}>

export type SystemFailureNoticeProps = Readonly<{
  readonly testIDPrefix: string
  readonly onDismiss: () => unknown
  readonly title?: string
  readonly message?: string
  readonly dismissLabel?: string
  readonly children?: ReactNode
  readonly presentation?: SystemFailureNoticePresentation
}>

export const SystemFailureNotice = ({
  testIDPrefix,
  onDismiss,
  title = '系统提示',
  message = '操作没有完成，请重试',
  dismissLabel = '知道了',
  children,
  presentation,
}: SystemFailureNoticeProps) => (
  <PrimitiveCenter testID={testIDPrefix} style={presentation?.rootStyle ?? {flex: 1, minHeight: 0, padding: 24}}>
    <PrimitiveContainer testID={`${testIDPrefix}:card`} layout="card" bounded style={presentation?.cardStyle}>
      <PrimitiveHeading testID={`${testIDPrefix}:title`}>{title}</PrimitiveHeading>
      <PrimitiveText testID={`${testIDPrefix}:message`} accessibilityRole="alert">
        {message}
      </PrimitiveText>
      {children}
      <PrimitiveActions testID={`${testIDPrefix}:actions`} orientation={presentation?.actionsOrientation}>
        <PrimitiveButton
          testID={`${testIDPrefix}:dismiss`}
          accessibilityLabel="关闭系统提示"
          onPress={onDismiss}
          style={presentation?.dismissButtonStyle}
        >
          {dismissLabel}
        </PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  </PrimitiveCenter>
)
