import {
  createContext,
  forwardRef,
  useContext,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type ReactNode,
} from 'react'
import {Pressable, ScrollView, Text, TextInput, View} from 'react-native'
import {cn} from './cn'

type NativeWindClassName = Readonly<{readonly className?: string}>
type RnrTextInputClickEvent = Readonly<{readonly stopPropagation: () => void}>

export type RnrViewProps = ComponentProps<typeof View> & NativeWindClassName
export type RnrTextProps = ComponentProps<typeof Text> & NativeWindClassName
export type RnrTextInputProps = ComponentPropsWithoutRef<typeof TextInput> & NativeWindClassName & Readonly<{
  readonly onClick?: (event: RnrTextInputClickEvent) => void
}>
export type RnrTextInputRef = ComponentRef<typeof TextInput>
export type RnrPressableProps = ComponentProps<typeof Pressable> & NativeWindClassName
export type RnrScrollViewProps = ComponentPropsWithoutRef<typeof ScrollView> & NativeWindClassName
export type RnrScrollViewRef = ComponentRef<typeof ScrollView>

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
  ({className, ...props}, ref) => (
    <TextInput
      {...props}
      ref={ref}
      allowFontScaling={false}
      {...({className} as {readonly className?: string})}
    />
  ),
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
