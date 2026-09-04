import type {ReactNode} from 'react'
import {Pressable, Text, TextInput, View} from 'react-native'

export type PrimitiveAddressableProps = Readonly<{
  readonly testID: string
}>

export type PrimitiveContainerProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
}>

type PrimitiveTextAccessibilityRole = 'alert' | 'status'

export type PrimitiveTextProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel?: string
  readonly accessibilityRole?: PrimitiveTextAccessibilityRole
  readonly children?: ReactNode
}>

export type PrimitiveHeadingProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
}>

export type PrimitiveLabelProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
  readonly nativeID?: string
}>

export type PrimitiveInputProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel?: string
  readonly editable?: boolean
  readonly onChangeText?: (value: string) => void
  readonly secureTextEntry?: boolean
  readonly value?: string
}>

export type PrimitiveButtonProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel?: string
  readonly children?: ReactNode
  readonly disabled?: boolean
  readonly onPress?: () => void
}>

export type PrimitiveStatusProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
}>

export type PrimitiveActionsProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
}>

const assertTestID = (testID: string): string => {
  if (testID.trim().length === 0) throw new Error('Primitive testID must be non-empty')
  return testID
}

export const PrimitiveContainer = ({testID, children}: PrimitiveContainerProps) => (
  <View testID={assertTestID(testID)}>
    {children}
  </View>
)

export const PrimitiveText = ({
  testID,
  accessibilityLabel,
  accessibilityRole,
  children,
}: PrimitiveTextProps) => (
  <Text
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    // RN 0.86.3's legacy `accessibilityRole` omits the approved `status` role;
    // its typed ARIA `role` prop supports both feedback roles without widening
    // the PrimitiveText public contract.
    role={accessibilityRole}
  >
    {children}
  </Text>
)

export const PrimitiveHeading = ({testID, children}: PrimitiveHeadingProps) => (
  <Text testID={assertTestID(testID)} accessibilityRole="header">
    {children}
  </Text>
)

export const PrimitiveLabel = ({testID, children, nativeID}: PrimitiveLabelProps) => (
  <Text testID={assertTestID(testID)} nativeID={nativeID}>
    {children}
  </Text>
)

export const PrimitiveInput = ({
  testID,
  accessibilityLabel,
  editable,
  onChangeText,
  secureTextEntry,
  value,
}: PrimitiveInputProps) => (
  <TextInput
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    editable={editable}
    onChangeText={onChangeText}
    secureTextEntry={secureTextEntry}
    value={value}
  />
)

export const PrimitiveButton = ({
  testID,
  accessibilityLabel,
  children,
  disabled,
  onPress,
}: PrimitiveButtonProps) => (
  <Pressable
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{disabled}}
    disabled={disabled}
    onPress={onPress}
  >
    <Text>{children}</Text>
  </Pressable>
)

export const PrimitiveStatus = ({testID, children}: PrimitiveStatusProps) => (
  <Text testID={assertTestID(testID)} accessibilityLiveRegion="polite">
    {children}
  </Text>
)

export const PrimitiveActions = ({testID, children}: PrimitiveActionsProps) => (
  <View testID={assertTestID(testID)}>
    {children}
  </View>
)
