import {
  createContext,
  forwardRef,
  useContext,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type Ref,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  VirtualizedList,
  type StyleProp,
  type ViewStyle,
  type VirtualizedListProps,
} from 'react-native';
import Svg, {LinearGradient, Path, Rect, Stop, type SvgProps} from 'react-native-svg';
import {cn} from './cn';
import {cssInterop} from './cssInterop';
import type {PrimitiveMeasureLayoutHandle} from '../types/types';

type NativeWindClassName = Readonly<{readonly className?: string}>;
type RnrTextInputClickEvent = Readonly<{readonly stopPropagation: () => void}>;
type RnrTextInputContextMenuEvent = Readonly<{readonly preventDefault: () => void}>;

export type RnrViewProps = ComponentProps<typeof View> & NativeWindClassName;
export type RnrTextProps = ComponentProps<typeof Text> & NativeWindClassName;
export type RnrTextInputProps = Omit<ComponentPropsWithoutRef<typeof TextInput>, 'showSoftInputOnFocus'> &
  NativeWindClassName &
  Readonly<{
    readonly onClick?: (event: RnrTextInputClickEvent) => void;
    readonly onContextMenu?: (event: RnrTextInputContextMenuEvent) => void;
  }>;
export type RnrTextInputRef = ComponentRef<typeof TextInput>;
export type RnrPressableProps = ComponentPropsWithoutRef<typeof Pressable> & NativeWindClassName;
export type RnrPressableRef = PrimitiveMeasureLayoutHandle;
export type RnrScrollViewProps = ComponentPropsWithoutRef<typeof ScrollView> & NativeWindClassName;
export type RnrScrollViewRef = ComponentRef<typeof ScrollView>;
export type RnrActivityIndicatorProps = ComponentProps<typeof ActivityIndicator> & NativeWindClassName;
export type RnrImageProps = ComponentProps<typeof Image> & NativeWindClassName;
export type RnrVirtualizedListProps<ItemT> = VirtualizedListProps<ItemT> & NativeWindClassName;

/**
 * Local React Native presentation adapters used by the bounded primitives.
 * This is package-owned code, not a vendored upstream implementation.
 */
const RnrTextClassContext = createContext<string | undefined>(undefined);

export const RnrView = ({className, ...props}: RnrViewProps) => (
  <View {...props} {...({className} as {readonly className?: string})} />
);

export const RnrText = ({className, ...props}: RnrTextProps) => {
  const inheritedClassName = useContext(RnrTextClassContext);
  const text = (
    <Text
      {...props}
      allowFontScaling={false}
      {...({className: cn(inheritedClassName, className)} as {readonly className?: string})}
    />
  );
  return text;
};

export const RnrTextInput = forwardRef<RnrTextInputRef, RnrTextInputProps>(
  ({className, onClick, onContextMenu, onPressIn, ...props}, ref) => {
    const nativeProps = {
      ...props,
      onClick: typeof document === 'undefined' ? undefined : (onClick ?? onPressIn),
      onContextMenu:
        typeof document === 'undefined'
          ? undefined
          : (onContextMenu ?? ((event: RnrTextInputContextMenuEvent) => event.preventDefault())),
      contextMenuHidden: true,
      onPressIn,
      showSoftInputOnFocus: false,
      ...({className} as {readonly className?: string}),
    } as unknown as ComponentPropsWithoutRef<typeof TextInput>;
    return <TextInput {...nativeProps} ref={ref} allowFontScaling={false} />;
  },
);
RnrTextInput.displayName = 'RnrTextInput';

export const RnrScrollView = forwardRef<RnrScrollViewRef, RnrScrollViewProps>(({className, ...props}, ref) => (
  <ScrollView {...props} ref={ref} {...({className} as {readonly className?: string})} />
));
RnrScrollView.displayName = 'RnrScrollView';

export const RnrPressable = forwardRef<
  RnrPressableRef,
  RnrPressableProps &
    Readonly<{
      readonly children?: ReactNode;
    }>
>(({className, children, ...props}, ref) => {
  const control = (
    <RnrTextClassContext.Provider value={undefined}>
      <Pressable
        {...props}
        ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
        {...({className} as {readonly className?: string})}
      >
        {children}
      </Pressable>
    </RnrTextClassContext.Provider>
  );
  return control;
});
RnrPressable.displayName = 'RnrPressable';

const ActivityIndicatorSlot = ActivityIndicator ?? View;

export const RnrActivityIndicator = ({className, ...props}: RnrActivityIndicatorProps) => (
  <ActivityIndicatorSlot {...props} {...({className} as {readonly className?: string})} />
);

export const RnrImage = ({className, ...props}: RnrImageProps) => (
  <Image {...props} {...({className} as {readonly className?: string})} />
);

export const RnrVirtualizedList = <ItemT,>({className, ...props}: RnrVirtualizedListProps<ItemT>) => (
  <VirtualizedList {...props} {...({className} as {readonly className?: string})} />
);

export const primitiveIconPaths = Object.freeze({
  admin: 'M6 9V5h12v4M4 9h16v10H4zM8 13h8M8 16h5',
  blocked: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18M5.64 5.64l12.72 12.72',
  check: 'M5 12.5 9.5 17 19 7.5',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  close: 'M6 6 18 18M18 6 6 18',
  info: 'M12 10v7M12 7.5v.1',
  'keyboard-backspace':
    'M20 5H9.8c-.7 0-1.35.35-1.74.93L4 12l4.06 6.07c.39.58 1.04.93 1.74.93H20c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2ZM12 9l5 6m0-6-5 6',
  'keyboard-enter': 'M19 5v7a4 4 0 0 1-4 4H5m4-4-4 4 4 4',
  link: 'M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15',
  monitor: 'M4 5h16v11H4zM8 20h8M12 16v4',
  refresh: 'M20 11a8 8 0 1 0 1 4M20 5v6h-6',
  server: 'M4 5h16v5H4zM4 14h16v5H4zM7 7.5h.1M7 16.5h.1',
} as const);

export type RnrSvgIconProps = NativeWindClassName &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly path: string;
    readonly size?: number;
    readonly style?: StyleProp<ViewStyle>;
    readonly testID: string;
  }>;

// react-native-svg is not one of NativeWind's built-in interoperable hosts.
// Register the local slot once so semantic text-* tokens reach the SVG color
// prop through the same theme boundary used by the other primitive slots.
const RnrSvg = cssInterop(Svg, {className: 'style'});

export const RnrSvgIcon = ({accessibilityLabel, className, path, size = 20, style, testID}: RnrSvgIconProps) => {
  const icon = (
    <RnrSvg
      testID={testID}
      {...(Platform.OS === 'web' ? {} : {accessible: true})}
      accessibilityLabel={accessibilityLabel}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={style}
      {...({className} as Partial<SvgProps>)}
    >
      <Path d={path} fill="none" strokeWidth={2} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </RnrSvg>
  );
  return icon;
};

export type RnrGradientBackgroundProps = Readonly<{
  readonly endColor: string;
  readonly gradientId?: string;
  readonly startColor: string;
  readonly testID?: string;
}>;

export const RnrGradientBackground = ({
  endColor,
  gradientId = 'primitive-action-gradient',
  startColor,
  testID,
}: RnrGradientBackgroundProps) => (
  <RnrView
    testID={testID}
    className="absolute inset-0 w-full h-full"
    style={[StyleSheet.absoluteFill, {pointerEvents: 'none'}]}
  >
    <Svg
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      style={[StyleSheet.absoluteFill, {pointerEvents: 'none'}]}
    >
      <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={startColor} />
        <Stop offset="1" stopColor={endColor} />
      </LinearGradient>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </Svg>
  </RnrView>
);
