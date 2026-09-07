import type {ReactNode} from 'react'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'

export type DialogSurfaceProps = Readonly<{
  readonly testID: string
  readonly title: string
  readonly children: ReactNode
}>

export const DialogSurface = ({testID, title, children}: DialogSurfaceProps) => (
  <PrimitiveContainer testID={testID} layout="card">
    <PrimitiveHeading testID={`${testID}:title`}>{title}</PrimitiveHeading>
    {children}
  </PrimitiveContainer>
)

export type DialogActionsProps = Readonly<{
  readonly testID: string
  readonly children: ReactNode
}>

export const DialogActions = ({testID, children}: DialogActionsProps) => (
  <PrimitiveActions testID={testID}>{children}</PrimitiveActions>
)

export type EmptyStateProps = Readonly<{
  readonly testID: string
  readonly message: string
  readonly actionLabel?: string
  readonly onAction?: () => void
}>

export const EmptyState = ({testID, message, actionLabel, onAction}: EmptyStateProps) => (
  <PrimitiveContainer testID={testID} layout="content">
    <PrimitiveText testID={`${testID}:message`}>{message}</PrimitiveText>
    {actionLabel !== undefined && onAction !== undefined ? (
      <PrimitiveButton testID={`${testID}:action`} accessibilityLabel={actionLabel} onPress={onAction}>
        {actionLabel}
      </PrimitiveButton>
    ) : null}
  </PrimitiveContainer>
)

export type ScrollAreaProps = Readonly<{
  readonly testID: string
  readonly children: ReactNode
}>

export const ScrollArea = ({testID, children}: ScrollAreaProps) => (
  <InputScrollArea testID={testID}>{children}</InputScrollArea>
)
