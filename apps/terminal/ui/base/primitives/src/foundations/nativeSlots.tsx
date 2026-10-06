import {testIdProps} from './testId';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  type ComponentType,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ComponentRef,
  type MutableRefObject,
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
  type GestureResponderEvent,
  type ViewStyle,
  type VirtualizedListProps,
} from 'react-native';
import Svg, {LinearGradient, Path, Rect, Stop, type SvgProps} from 'react-native-svg';
import {cn} from './cn';
import {cssInterop} from './cssInterop';
import type {PrimitiveMeasureLayoutHandle} from '../types/types';
import type {TestId} from './testId';
import {useAutomationNode} from '../hooks/useAutomationNode';

type NativeWindClassName = Readonly<{readonly className?: string}>;
type RnrTextInputClickEvent = Readonly<{readonly stopPropagation: () => void}>;
type RnrTextInputContextMenuEvent = Readonly<{readonly preventDefault: () => void}>;

export type RnrViewProps = Omit<ComponentProps<typeof View>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;
export type RnrTextProps = Omit<ComponentProps<typeof Text>, 'testID'> &
  NativeWindClassName &
  Readonly<{testID?: TestId}>;
export type RnrTextInputProps = Omit<ComponentPropsWithoutRef<typeof TextInput>, 'showSoftInputOnFocus' | 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}> &
  Readonly<{
    readonly onClick?: (event: RnrTextInputClickEvent) => void;
    readonly onContextMenu?: (event: RnrTextInputContextMenuEvent) => void;
  }>;
export type RnrTextInputRef = ComponentRef<typeof TextInput>;
export type RnrPressableProps = Omit<ComponentPropsWithoutRef<typeof Pressable>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;
export type RnrPressableRef = PrimitiveMeasureLayoutHandle;
export type RnrScrollViewProps = Omit<ComponentPropsWithoutRef<typeof ScrollView>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;
export type RnrScrollViewRef = ComponentRef<typeof ScrollView>;
export type RnrActivityIndicatorProps = Omit<ComponentProps<typeof ActivityIndicator>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;
export type RnrImageProps = Omit<ComponentProps<typeof Image>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;
export type RnrVirtualizedListProps<ItemT> = Omit<VirtualizedListProps<ItemT>, 'testID'> &
  NativeWindClassName &
  Readonly<{readonly testID?: TestId}>;

const useMergedRef = <T,>(external: Ref<T> | undefined, automationRef: ((node: unknown | null) => void) | undefined) =>
  useCallback(
    (node: T | null): void => {
      if (typeof external === 'function') external(node);
      else if (external !== null && external !== undefined) (external as MutableRefObject<T | null>).current = node;
      automationRef?.(node);
    },
    [automationRef, external],
  );

const useNodeHandlers = (
  input: Readonly<{
    readonly testID?: TestId;
    readonly role: string;
    readonly label?: string;
    readonly accessibilityState?: Readonly<Record<string, boolean | undefined>>;
    readonly semanticActions?: Readonly<{
      readonly press?: () => void;
      readonly changeText?: (value: string) => void;
    }>;
    readonly value?: string | number | boolean | null;
  }>,
) => useAutomationNode(input);

const automationStateOf = (value: unknown): Readonly<Record<string, boolean | undefined>> | undefined =>
  value as Readonly<Record<string, boolean | undefined>> | undefined;

const compose = <T,>(original: ((event: T) => void) | undefined, observed: ((event: T) => void) | undefined) => {
  if (observed === undefined) return original;
  return (event: T): void => {
    original?.(event);
    observed(event);
  };
};

/**
 * Local React Native presentation adapters used by the bounded primitives.
 * This is package-owned code, not a vendored upstream implementation.
 */
const RnrTextClassContext = createContext<string | undefined>(undefined);

export const RnrView = forwardRef<ComponentRef<typeof View>, RnrViewProps>(
  (
    {className, testID, accessibilityRole, accessibilityLabel, accessibilityState, onLayout, ...props},
    forwardedRef,
  ) => {
    const node = useNodeHandlers({
      testID,
      role: accessibilityRole ?? 'container',
      label: accessibilityLabel,
      accessibilityState: automationStateOf(accessibilityState),
    });
    const hostRef = useMergedRef(forwardedRef, node?.attachHostNode);
    return (
      <View
        {...props}
        {...testIdProps(testID)}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        ref={hostRef}
        onLayout={compose(onLayout, node?.onLayout)}
        {...({className} as {readonly className?: string})}
      />
    );
  },
);
RnrView.displayName = 'RnrView';

export const RnrText = forwardRef<ComponentRef<typeof Text>, RnrTextProps>(
  (
    {className, testID, accessibilityRole, accessibilityLabel, accessibilityState, children, onLayout, ...props},
    forwardedRef,
  ) => {
    const inheritedClassName = useContext(RnrTextClassContext);
    const node = useNodeHandlers({
      testID,
      role: accessibilityRole ?? 'text',
      label: accessibilityLabel,
      accessibilityState: automationStateOf(accessibilityState),
      value: typeof children === 'string' || typeof children === 'number' ? children : null,
    });
    const hostRef = useMergedRef(forwardedRef, node?.attachHostNode);
    return (
      <Text
        {...props}
        {...testIdProps(testID)}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityState={accessibilityState}
        ref={hostRef}
        onLayout={compose(onLayout, node?.onLayout)}
        allowFontScaling={false}
        {...({className: cn(inheritedClassName, className)} as {readonly className?: string})}
      >
        {children}
      </Text>
    );
  },
);
RnrText.displayName = 'RnrText';

export const RnrTextInput = forwardRef<RnrTextInputRef, RnrTextInputProps>(
  ({className, onClick, onContextMenu, onPressIn, ...props}, forwardedRef) => {
    const node = useNodeHandlers({
      testID: props.testID,
      role: props.accessibilityRole ?? 'textbox',
      label: props.accessibilityLabel,
      accessibilityState: automationStateOf(props.accessibilityState),
      value: props.value,
      semanticActions: {changeText: props.onChangeText},
    });
    const hostRef = useMergedRef(forwardedRef, node?.attachHostNode);
    const nativeProps = {
      ...props,
      onClick: typeof document === 'undefined' ? undefined : (onClick ?? onPressIn),
      onContextMenu:
        typeof document === 'undefined'
          ? undefined
          : (onContextMenu ?? ((event: RnrTextInputContextMenuEvent) => event.preventDefault())),
      contextMenuHidden: true,
      onPressIn: compose(onPressIn ?? undefined, node?.onPressIn),
      ref: hostRef,
      onLayout: compose(props.onLayout, node?.onLayout),
      onPressOut: compose(props.onPressOut, node?.onPressOut),
      showSoftInputOnFocus: false,
      ...({className} as {readonly className?: string}),
    } as unknown as ComponentPropsWithoutRef<typeof TextInput>;
    return <TextInput {...nativeProps} allowFontScaling={false} />;
  },
);
RnrTextInput.displayName = 'RnrTextInput';

export const RnrScrollView = forwardRef<RnrScrollViewRef, RnrScrollViewProps>(({className, ...props}, forwardedRef) => {
  const node = useNodeHandlers({
    testID: props.testID,
    role: props.accessibilityRole ?? 'scrollview',
    label: props.accessibilityLabel,
    accessibilityState: automationStateOf(props.accessibilityState),
  });
  const hostRef = useMergedRef(forwardedRef, node?.attachHostNode);
  return (
    <ScrollView
      {...props}
      ref={hostRef}
      onLayout={compose(props.onLayout, node?.onLayout)}
      onScroll={compose(props.onScroll, node === null ? undefined : () => node.onScroll())}
      {...({className} as {readonly className?: string})}
    />
  );
});
RnrScrollView.displayName = 'RnrScrollView';

export const RnrPressable = forwardRef<
  RnrPressableRef,
  RnrPressableProps &
    Readonly<{
      readonly children?: ReactNode;
    }>
>(({className, children, ...props}, forwardedRef) => {
  const node = useNodeHandlers({
    testID: props.testID,
    role: props.accessibilityRole ?? 'button',
    label: props.accessibilityLabel,
    accessibilityState: automationStateOf(
      props.disabled === true ? {...props.accessibilityState, disabled: true} : props.accessibilityState,
    ),
    semanticActions: {
      press: props.onPress === undefined ? undefined : () => props.onPress?.({} as GestureResponderEvent),
    },
  });
  const hostRef = useMergedRef(forwardedRef as unknown as Ref<ComponentRef<typeof Pressable>>, node?.attachHostNode);
  const control = (
    <RnrTextClassContext.Provider value={undefined}>
      <Pressable
        {...props}
        ref={hostRef}
        onLayout={compose(props.onLayout, node?.onLayout)}
        onPressIn={compose(props.onPressIn ?? undefined, node?.onPressIn)}
        onPressOut={compose(props.onPressOut ?? undefined, node?.onPressOut)}
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

export const RnrActivityIndicator = ({className, ...props}: RnrActivityIndicatorProps) => {
  const node = useNodeHandlers({
    testID: props.testID,
    role: props.accessibilityRole ?? 'progressbar',
    label: props.accessibilityLabel,
    accessibilityState: automationStateOf(props.accessibilityState),
  });
  return (
    <ActivityIndicatorSlot
      {...props}
      ref={node?.attachHostNode}
      onLayout={compose(props.onLayout, node?.onLayout)}
      {...({className} as {readonly className?: string})}
    />
  );
};

export const RnrImage = ({className, ...props}: RnrImageProps) => {
  const node = useNodeHandlers({
    testID: props.testID,
    role: props.accessibilityRole ?? 'image',
    label: props.accessibilityLabel,
    accessibilityState: automationStateOf(props.accessibilityState),
  });
  return (
    <Image
      {...props}
      ref={node?.attachHostNode}
      onLayout={compose(props.onLayout, node?.onLayout)}
      {...({className} as {readonly className?: string})}
    />
  );
};

export const RnrVirtualizedList = <ItemT,>({className, ...props}: RnrVirtualizedListProps<ItemT>) => {
  const node = useNodeHandlers({
    testID: props.testID,
    role: props.accessibilityRole ?? 'list',
    label: props.accessibilityLabel,
    accessibilityState: automationStateOf(props.accessibilityState),
  });
  return (
    <VirtualizedList
      {...props}
      ref={node?.attachHostNode}
      onLayout={compose(props.onLayout, node?.onLayout)}
      {...({className} as {readonly className?: string})}
    />
  );
};

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
    readonly testID?: TestId;
  }>;

// react-native-svg is not one of NativeWind's built-in interoperable hosts.
// Register the local slot once so semantic text-* tokens reach the SVG color
// prop through the same theme boundary used by the other primitive slots.
const RnrSvg = cssInterop(Svg, {className: 'style'}) as ComponentType<
  SvgProps & NativeWindClassName & Readonly<{readonly ref?: Ref<Svg>}>
>;

export const RnrSvgIcon = ({accessibilityLabel, className, path, size = 20, style, testID}: RnrSvgIconProps) => {
  const node = useNodeHandlers({testID, role: 'image', label: accessibilityLabel});
  const icon = (
    <RnrSvg
      {...testIdProps(testID)}
      ref={node?.attachHostNode as Ref<Svg> | undefined}
      onLayout={node?.onLayout}
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
  readonly testID?: TestId;
}>;

export const RnrGradientBackground = ({
  endColor,
  gradientId = 'primitive-action-gradient',
  startColor,
  testID,
}: RnrGradientBackgroundProps) => (
  <RnrView
    {...testIdProps(testID)}
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
