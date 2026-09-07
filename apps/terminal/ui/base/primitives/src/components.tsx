import {forwardRef, useImperativeHandle, useRef, type ReactNode, type Ref} from 'react'
import {cn} from './rnr/cn'
import {
  RnrPressable,
  RnrScrollView,
  RnrText,
  RnrTextInput,
  RnrView,
  type RnrScrollViewRef,
  type RnrTextInputRef,
} from './rnr/slots'
import {baseTokens} from './theme/tokens'

export type PrimitiveAddressableProps = Readonly<{
  readonly testID: string
}>

export type PrimitiveContainerProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
  /** Presentation-only layout; defaults to the existing surface-filling behavior. */
  readonly layout?: PrimitiveContainerLayout
}>

export type PrimitiveScrollViewProps = PrimitiveAddressableProps & Readonly<{
  readonly children?: ReactNode
  readonly onScrollOffsetChange?: (offsetY: number) => void
}>

type PrimitiveTextAccessibilityRole = 'alert' | 'status'

type PrimitiveContainerLayout = 'fill' | 'content' | 'card' | 'centered'

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
  readonly maxLength?: number
  readonly onBlur?: () => void
  readonly onChangeText?: (value: string) => void
  readonly onFocus?: () => void
  readonly onPressIn?: (event: PrimitiveInputPressEvent) => void
  readonly onSelectionChange?: (event: PrimitiveInputSelectionChangeEvent) => void
  readonly inputRef?: Ref<PrimitiveInputHandle>
  readonly selection?: PrimitiveInputSelection
  readonly secureTextEntry?: boolean
  readonly showSoftInputOnFocus?: boolean
  readonly value?: string
}>

type PrimitiveInputPressEvent = Readonly<{
  readonly stopPropagation: () => void
}>

export type PrimitiveInputHandle = Readonly<{
  readonly focus: () => void
  readonly blur: () => void
  readonly measureInWindow: (callback: PrimitiveMeasureInWindowCallback) => void
}>

export type PrimitiveScrollViewHandle = Readonly<{
  readonly measureInWindow: (callback: PrimitiveMeasureInWindowCallback) => void
  readonly scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void
}>

export type PrimitiveMeasureInWindowCallback = (x: number, y: number, width: number, height: number) => void

export type PrimitiveInputSelection = Readonly<{
  readonly start: number
  readonly end?: number
}>

export type PrimitiveInputSelectionChangeEvent = Readonly<{
  readonly nativeEvent: Readonly<{
    readonly selection: Readonly<{
      readonly start: number
      readonly end: number
    }>
  }>
}>

export type PrimitiveButtonProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel?: string
  readonly children?: ReactNode
  readonly disabled?: boolean
  readonly onPress?: () => void
  /** Presentation-only cell sizing for composite controls such as a keyboard. */
  readonly variant?: 'default' | 'key' | 'key-action'
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

export const PrimitiveContainer = ({testID, children, layout = 'fill'}: PrimitiveContainerProps) => (
  <RnrView
    testID={assertTestID(testID)}
    className={
      layout === 'content'
        ? baseTokens.containerContent
        : layout === 'card'
          ? baseTokens.containerCard
          : layout === 'centered'
            ? baseTokens.containerCentered
            : baseTokens.container
    }
  >
    {children}
  </RnrView>
)

export const PrimitiveScrollView = forwardRef<PrimitiveScrollViewHandle, PrimitiveScrollViewProps>(
  ({testID, children, onScrollOffsetChange}, ref) => {
    const nativeScrollViewRef = useRef<RnrScrollViewRef>(null)
    useImperativeHandle(ref, () => ({
      measureInWindow: callback => {
        const nativeScrollView = nativeScrollViewRef.current as (RnrScrollViewRef & Readonly<{
          measureInWindow?: (measurementCallback: PrimitiveMeasureInWindowCallback) => void
        }>) | null
        nativeScrollView?.measureInWindow?.(callback)
      },
      scrollTo: options => nativeScrollViewRef.current?.scrollTo(options),
    }), [])
    return (
      <RnrScrollView
        ref={nativeScrollViewRef}
        testID={assertTestID(testID)}
        className={baseTokens.scroll}
        onScroll={onScrollOffsetChange === undefined
          ? undefined
          : event => onScrollOffsetChange(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {children}
      </RnrScrollView>
    )
  },
)
PrimitiveScrollView.displayName = 'PrimitiveScrollView'

export const PrimitiveText = ({
  testID,
  accessibilityLabel,
  accessibilityRole,
  children,
}: PrimitiveTextProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    className={baseTokens.text}
    // RN 0.86.3's legacy `accessibilityRole` omits the approved `status` role;
    // its typed ARIA `role` prop supports both feedback roles without widening
    // the PrimitiveText public contract.
    role={accessibilityRole}
  >
    {children}
  </RnrText>
)

export const PrimitiveHeading = ({testID, children}: PrimitiveHeadingProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityRole="header"
    className={baseTokens.heading}
  >
    {children}
  </RnrText>
)

export const PrimitiveLabel = ({testID, children, nativeID}: PrimitiveLabelProps) => (
  <RnrText
    testID={assertTestID(testID)}
    nativeID={nativeID}
    className={baseTokens.label}
  >
    {children}
  </RnrText>
)

export const PrimitiveInput = ({
  testID,
  accessibilityLabel,
  editable,
  inputRef,
  maxLength,
  onBlur,
  onChangeText,
  onFocus,
  onPressIn,
  onSelectionChange,
  selection,
  secureTextEntry,
  showSoftInputOnFocus,
  value,
}: PrimitiveInputProps) => {
  const nativeInputRef = useRef<RnrTextInputRef>(null)
  useImperativeHandle(inputRef, () => ({
    focus: () => nativeInputRef.current?.focus(),
    blur: () => nativeInputRef.current?.blur(),
    measureInWindow: callback => nativeInputRef.current?.measureInWindow(callback),
  }), [])
  return (
    <RnrTextInput
      ref={nativeInputRef}
      testID={assertTestID(testID)}
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      maxLength={maxLength}
      onBlur={onBlur === undefined ? undefined : () => onBlur()}
      onChangeText={onChangeText}
      onFocus={onFocus === undefined ? undefined : () => onFocus()}
      onClick={typeof document === 'undefined' ? undefined : onPressIn}
      onPressIn={onPressIn}
      onSelectionChange={onSelectionChange === undefined ? undefined : event => onSelectionChange({
        nativeEvent: {
          selection: {
            start: event.nativeEvent.selection.start,
            end: event.nativeEvent.selection.end,
          },
        },
      })}
      selection={selection === undefined
        ? undefined
        : {start: selection.start, end: selection.end ?? selection.start}}
      secureTextEntry={secureTextEntry}
      showSoftInputOnFocus={showSoftInputOnFocus}
      value={value}
      className={baseTokens.input}
    />
  )
}

export const PrimitiveButton = ({
  testID,
  accessibilityLabel,
  children,
  disabled,
  onPress,
  variant = 'default',
}: PrimitiveButtonProps) => (
  <RnrPressable
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    accessibilityState={{disabled}}
    className={cn(
      variant === 'key'
        ? baseTokens.keyboardKey
        : variant === 'key-action'
          ? baseTokens.keyboardAction
          : baseTokens.button,
      disabled && 'opacity-50',
    )}
    disabled={disabled}
    onPress={onPress}
  >
    <RnrText className={variant === 'key-action'
      ? baseTokens.keyboardActionText
      : variant === 'key'
        ? baseTokens.keyboardButtonText
        : baseTokens.buttonText}>{children}</RnrText>
  </RnrPressable>
)

export const PrimitiveStatus = ({testID, children}: PrimitiveStatusProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityLiveRegion="polite"
    className={baseTokens.status}
  >
    {children}
  </RnrText>
)

export const PrimitiveActions = ({testID, children}: PrimitiveActionsProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.actions}>
    {children}
  </RnrView>
)
