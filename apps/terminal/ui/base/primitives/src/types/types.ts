import type {ReactNode, Ref} from 'react';
import type {HostInstance, ImageResizeMode, ImageSourcePropType, ImageStyle, LayoutChangeEvent, StyleProp, TextLayoutEvent, TextStyle, ViewStyle} from 'react-native';

export type PrimitiveTone = 'neutral' | 'ok' | 'warn' | 'error' | 'info';

export type PrimitiveOption = Readonly<{
  readonly value: string;
  readonly label: string;
}>;

export type PrimitiveAddressableProps = Readonly<{
  readonly testID: string;
}>;

export type PrimitiveContainerProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only native layout override for composite primitive composition. */
    readonly style?: StyleProp<ViewStyle>;
    /** Presentation-only layout; defaults to the existing surface-filling behavior. */
    readonly layout?: PrimitiveContainerLayout;
    /** Constrains card/content descendants to the available parent height. */
    readonly bounded?: boolean;
  }>;

export type PrimitiveScrollViewLayout = 'fill' | 'transparent';

export type PrimitiveScrollViewProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only viewport background; the existing opaque default remains unchanged. */
    readonly layout?: PrimitiveScrollViewLayout;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    readonly onScrollOffsetChange?: (offsetY: number) => void;
  }>;

type PrimitiveTextAccessibilityRole = 'alert' | 'status';

type PrimitiveContainerLayout = 'fill' | 'content' | 'card' | 'centered' | 'transparent';

export type PrimitiveImageProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly layout?: 'thumbnail' | 'background';
    readonly resizeMode?: ImageResizeMode;
    readonly source?: ImageSourcePropType;
    readonly style?: StyleProp<ImageStyle>;
  }>;

export type PrimitiveTextProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly accessibilityRole?: PrimitiveTextAccessibilityRole;
    readonly children?: ReactNode;
    /** Presentation-only text layout override for composite primitive composition. */
    readonly style?: StyleProp<TextStyle>;
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
    readonly multiline?: boolean;
    readonly numberOfLines?: number;
    readonly onBlur?: () => void;
    readonly onChangeText?: (value: string) => void;
    readonly onFocus?: () => void;
    readonly onPressIn?: (event: PrimitiveInputPressEvent) => void;
    readonly onTouchEnd?: (event: PrimitiveInputTouchEvent) => void;
    readonly onSelectionChange?: (event: PrimitiveInputSelectionChangeEvent) => void;
    readonly inputRef?: Ref<PrimitiveInputHandle>;
    readonly selection?: PrimitiveInputSelection;
    readonly secureTextEntry?: boolean;
    readonly value?: string;
  }>;

type PrimitiveInputPressEvent = Readonly<{
  readonly stopPropagation: () => void;
}>;

type PrimitiveInputTouchEvent = Readonly<{
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

/**
 * A native component reference accepted by Fabric's ref.measureLayout.
 * Numeric node handles are intentionally excluded: RN 0.86's Fabric
 * implementation rejects them at the ref method boundary.
 */
export type PrimitiveNativeNode = HostInstance;

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
    readonly busy?: boolean;
    readonly tone?: PrimitiveTone;
    readonly onPress?: () => void;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    /** Presentation-only native layout override for composite primitive composition. */
    readonly style?: StyleProp<ViewStyle>;
    /** Presentation-only cell sizing for composite controls such as a keyboard. */
    readonly variant?: 'default' | 'key' | 'key-action';
  }>;

export type PrimitiveStatusProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly tone?: PrimitiveTone;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    readonly onTextLayout?: (event: TextLayoutEvent) => void;
    /** Presentation-only text layout override for composite primitive composition. */
    readonly style?: StyleProp<TextStyle>;
  }>;

export type PrimitiveActionsProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
  }>;

export type PrimitiveLayoutProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only native layout override for composite primitive composition. */
    readonly style?: StyleProp<ViewStyle>;
  }>;

export type PrimitiveGridProps = PrimitiveLayoutProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly accessibilityRole?: 'none' | 'tablist';
  }>;

export type PrimitiveCodeBlockProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly accessibilityLabel?: string;
  }>;

export type PrimitiveFeedbackProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly children?: ReactNode;
    readonly tone?: PrimitiveTone;
  }>;

export type PrimitiveProgressProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly value: number;
  }>;

export type PrimitiveFormControlProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly disabled?: boolean;
    readonly busy?: boolean;
  }>;

export type PrimitiveCheckboxProps = PrimitiveFormControlProps &
  Readonly<{
    readonly checked: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
  }>;

export type PrimitiveRadioProps = PrimitiveFormControlProps &
  Readonly<{
    readonly selected: boolean;
    readonly onSelectedChange?: () => void;
  }>;

export type PrimitiveSwitchProps = PrimitiveFormControlProps &
  Readonly<{
    readonly checked: boolean;
    readonly onCheckedChange?: (checked: boolean) => void;
  }>;

export type PrimitiveSelectProps = PrimitiveFormControlProps &
  Readonly<{
    readonly options: readonly PrimitiveOption[];
    readonly value: string;
    readonly onValueChange?: (value: string) => void;
  }>;

export type PrimitiveTextareaProps = PrimitiveInputProps &
  Readonly<{
    readonly numberOfLines?: number;
  }>;

export type PrimitiveFormFieldProps = PrimitiveAddressableProps &
  Readonly<{
    readonly label: string;
    readonly children?: ReactNode;
    readonly error?: string;
  }>;

export type PrimitiveBadgeProps = PrimitiveFeedbackProps;

export type PrimitiveKeyValueRowProps = PrimitiveAddressableProps &
  Readonly<{
    readonly label: string;
    readonly value: string;
  }>;

export type PrimitiveStatusRowProps = PrimitiveKeyValueRowProps &
  Readonly<{
    readonly tone?: PrimitiveTone;
  }>;

export type PrimitiveListRenderItem<ItemT> = (item: ItemT, index: number) => ReactNode;

export type PrimitiveListProps<ItemT> = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly data: readonly ItemT[];
    readonly getItemKey?: (item: ItemT, index: number) => string;
    readonly onScrollOffsetChange?: (offsetY: number) => void;
    readonly renderItem: PrimitiveListRenderItem<ItemT>;
    readonly rowHeight: number;
  }>;

export type PrimitiveTableColumn<ItemT> = Readonly<{
  readonly key: string;
  readonly header: string;
  readonly render: (row: ItemT) => ReactNode;
}>;

export type PrimitiveTableProps<ItemT> = PrimitiveAddressableProps &
  Readonly<{
    readonly columns: readonly PrimitiveTableColumn<ItemT>[];
    readonly rows: readonly ItemT[];
  }>;

export type PrimitiveTabItem = PrimitiveOption;

export type PrimitiveSegmentedControlProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly items: readonly PrimitiveTabItem[];
    readonly selectedValue: string;
    readonly onValueChange?: (value: string) => void;
    readonly disabled?: boolean;
    readonly busy?: boolean;
  }>;

export type PrimitiveTabsProps = PrimitiveSegmentedControlProps;
