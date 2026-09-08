import type {ReactNode, Ref} from 'react';
import type {HostInstance, LayoutChangeEvent, TextLayoutEvent} from 'react-native';

export type PrimitiveAddressableProps = Readonly<{
  readonly testID: string;
}>;

export type PrimitiveContainerProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only layout; defaults to the existing surface-filling behavior. */
    readonly layout?: PrimitiveContainerLayout;
  }>;

export type PrimitiveScrollViewProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    readonly onScrollOffsetChange?: (offsetY: number) => void;
  }>;

type PrimitiveTextAccessibilityRole = 'alert' | 'status';

type PrimitiveContainerLayout = 'fill' | 'content' | 'card' | 'centered';

export type PrimitiveTextProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly accessibilityRole?: PrimitiveTextAccessibilityRole;
    readonly children?: ReactNode;
  }>;

export type PrimitiveHeadingProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
  }>;

export type PrimitiveLabelProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly nativeID?: string;
  }>;

export type PrimitiveInputProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly editable?: boolean;
    readonly maxLength?: number;
    readonly onBlur?: () => void;
    readonly onChangeText?: (value: string) => void;
    readonly onFocus?: () => void;
    readonly onPressIn?: (event: PrimitiveInputPressEvent) => void;
    readonly onSelectionChange?: (event: PrimitiveInputSelectionChangeEvent) => void;
    readonly inputRef?: Ref<PrimitiveInputHandle>;
    readonly selection?: PrimitiveInputSelection;
    readonly secureTextEntry?: boolean;
    readonly showSoftInputOnFocus?: boolean;
    readonly value?: string;
  }>;

type PrimitiveInputPressEvent = Readonly<{
  readonly stopPropagation: () => void;
}>;

export type PrimitiveInputHandle = Readonly<{
  readonly focus: () => void;
  readonly blur: () => void;
  readonly measureLayout: (
    relativeToNativeNode: PrimitiveNativeNode,
    callback: PrimitiveMeasureLayoutCallback,
    onFail?: () => void,
  ) => void;
  readonly measureInWindow: (callback: PrimitiveMeasureInWindowCallback) => void;
}>;

export type PrimitiveScrollViewHandle = Readonly<{
  /** The native content node is the coordinate-system anchor for scroll measurements. */
  readonly getContentNativeNode: () => PrimitiveNativeNode | null;
  readonly measureInWindow: (callback: PrimitiveMeasureInWindowCallback) => void;
  readonly scrollTo: (options: Readonly<{readonly y: number; readonly animated?: boolean}>) => void;
}>;

export type PrimitiveNativeNode = number | HostInstance;

export type PrimitiveMeasureLayoutCallback = (left: number, top: number, width: number, height: number) => void;

export type PrimitiveMeasureInWindowCallback = (x: number, y: number, width: number, height: number) => void;

export type PrimitiveInputSelection = Readonly<{
  readonly start: number;
  readonly end?: number;
}>;

export type PrimitiveInputSelectionChangeEvent = Readonly<{
  readonly nativeEvent: Readonly<{
    readonly selection: Readonly<{
      readonly start: number;
      readonly end: number;
    }>;
  }>;
}>;

export type PrimitiveButtonProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly children?: ReactNode;
    readonly disabled?: boolean;
    readonly onPress?: () => void;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    /** Presentation-only cell sizing for composite controls such as a keyboard. */
    readonly variant?: 'default' | 'key' | 'key-action';
  }>;

export type PrimitiveStatusProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    readonly onTextLayout?: (event: TextLayoutEvent) => void;
  }>;

export type PrimitiveActionsProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
  }>;
