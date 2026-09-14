import {
  createContext,
  forwardRef,
  useContext,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react'
import {ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View, VirtualizedList, type VirtualizedListProps} from 'react-native'
import Svg, {Path, type SvgProps} from 'react-native-svg'
import {cn} from './cn'

type NativeWindClassName = Readonly<{readonly className?: string}>
type RnrTextInputClickEvent = Readonly<{readonly stopPropagation: () => void}>

export type RnrViewProps = ComponentProps<typeof View> & NativeWindClassName
export type RnrTextProps = ComponentProps<typeof Text> & NativeWindClassName
export type RnrTextInputProps = Omit<ComponentPropsWithoutRef<typeof TextInput>, 'showSoftInputOnFocus'> & NativeWindClassName & Readonly<{
  readonly onClick?: (event: RnrTextInputClickEvent) => void
}>
export type RnrTextInputRef = ComponentRef<typeof TextInput>
export type RnrPressableProps = ComponentProps<typeof Pressable> & NativeWindClassName
export type RnrScrollViewProps = ComponentPropsWithoutRef<typeof ScrollView> & NativeWindClassName
export type RnrScrollViewRef = ComponentRef<typeof ScrollView>
export type RnrActivityIndicatorProps = ComponentProps<typeof ActivityIndicator> & NativeWindClassName
export type RnrImageProps = ComponentProps<typeof Image> & NativeWindClassName
export type RnrVirtualizedListProps<ItemT> = VirtualizedListProps<ItemT> & NativeWindClassName

/**
 * Adapted local copy-in of the RNR NativeWind Text/Button pattern. RNR's
 * manual-install form keeps styling in local components and lets a button
 * provide text styling through context. This package keeps only the needed
 * slots, because the public contracts are intentionally narrow.
 */
const RnrTextClassContext = createContext<string | undefined>(undefined)

export const RnrView = ({className, ...props}: RnrViewProps) => (
  <View {...props} {...({className} as {readonly className?: string})} />
)

export const RnrText = ({className, ...props}: RnrTextProps) => {
  const inheritedClassName = useContext(RnrTextClassContext)
  return (
    <Text
      {...props}
      allowFontScaling={false}
      {...({className: cn(inheritedClassName, className)} as {readonly className?: string})}
    />
  )
}

export const RnrTextInput = forwardRef<RnrTextInputRef, RnrTextInputProps>(
  ({className, onClick, onPressIn, ...props}, ref) => {
    const nativeProps = {
      ...props,
      onClick: typeof document === 'undefined' ? undefined : onClick ?? onPressIn,
      onPressIn,
      showSoftInputOnFocus: false,
      ...({className} as {readonly className?: string}),
    } as unknown as ComponentPropsWithoutRef<typeof TextInput>
    return <TextInput {...nativeProps} ref={ref} allowFontScaling={false} />
  },
)
RnrTextInput.displayName = 'RnrTextInput'

export const RnrScrollView = forwardRef<RnrScrollViewRef, RnrScrollViewProps>(
  ({className, ...props}, ref) => (
    <ScrollView {...props} ref={ref} {...({className} as {readonly className?: string})} />
  ),
)
RnrScrollView.displayName = 'RnrScrollView'

export const RnrPressable = ({className, children, ...props}: RnrPressableProps & Readonly<{
  readonly children?: ReactNode
}>) => (
  <RnrTextClassContext.Provider value={undefined}>
    <Pressable {...props} {...({className} as {readonly className?: string})}>
      {children}
    </Pressable>
  </RnrTextClassContext.Provider>
)

const ActivityIndicatorSlot = ActivityIndicator ?? View

export const RnrActivityIndicator = ({className, ...props}: RnrActivityIndicatorProps) => (
  <ActivityIndicatorSlot {...props} {...({className} as {readonly className?: string})} />
)

export const RnrImage = ({className, ...props}: RnrImageProps) => (
  <Image {...props} {...({className} as {readonly className?: string})} />
)

export const RnrVirtualizedList = <ItemT,>({className, ...props}: RnrVirtualizedListProps<ItemT>) => (
  <VirtualizedList {...props} {...({className} as {readonly className?: string})} />
)

export const primitiveIconPaths = Object.freeze({
  check: 'M5 12.5 9.5 17 19 7.5',
  close: 'M6 6 18 18M18 6 6 18',
  info: 'M12 10v7M12 7.5v.1',
} as const)

export type RnrSvgIconProps = NativeWindClassName & Readonly<{
  readonly accessibilityLabel: string
  readonly path: string
  readonly testID: string
}>

export const RnrSvgIcon = ({accessibilityLabel, className, path, testID}: RnrSvgIconProps) => (
  <Svg
    testID={testID}
    accessible
    accessibilityLabel={accessibilityLabel}
    width={20}
    height={20}
    viewBox="0 0 24 24"
    {...({className} as Partial<SvgProps>)}
  >
    <Path d={path} fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
)
