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
    /** Opts a card into the elevated presentation recipe without changing the default card recipe. */
    readonly elevated?: boolean;
    /** Selects a shared presentation recipe; application colors remain theme-owned. */
    readonly appearance?: 'default' | 'login' | 'admin-root' | 'admin-shell' | 'admin-shell-mobile' | 'admin-content' | 'admin-nav' | 'admin-card' | 'admin-inset';
  }>;

export type PrimitivePinInputInteractionEvent = Readonly<{
  readonly stopPropagation: () => void;
}>;

export type PrimitiveKeyboardSurfaceInteractionEvent = Readonly<{
  readonly stopPropagation: () => void;
}>;

export type PrimitiveKeyboardSurfaceProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only native layout override for the keyboard dock. */
    readonly style?: StyleProp<ViewStyle>;
    /** Structural event seam; the caller owns the surface-dismiss policy. */
    readonly onClick?: (event: PrimitiveKeyboardSurfaceInteractionEvent) => void;
    readonly onTouchEnd?: (event: PrimitiveKeyboardSurfaceInteractionEvent) => void;
  }>;

export type PrimitiveKeyboardBackdropProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only native layout override for the keyboard backdrop. */
    readonly style?: StyleProp<ViewStyle>;
  }>;

export type PrimitivePinInputProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    /** Selects the shared PIN presentation recipe without owning input state. */
    readonly appearance?: 'default' | 'login';
    /** Stable prefix owned by the caller for the six (or caller-selected) digit test IDs. */
    readonly cellTestIDPrefix: string;
    readonly disabled?: boolean;
    readonly focusedIndex?: number;
    readonly invalid?: boolean;
    readonly length: number;
    readonly maskCharacter?: string;
    readonly onClick?: (event: PrimitivePinInputInteractionEvent) => void;
    readonly onPress?: () => void;
    readonly onTouchEnd?: (event: PrimitivePinInputInteractionEvent) => void;
    readonly value: string;
  }>;

export type PrimitiveScrollViewLayout = 'fill' | 'transparent';

export type PrimitiveScrollViewProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Presentation-only viewport background; the existing opaque default remains unchanged. */
    readonly layout?: PrimitiveScrollViewLayout;
    /** Presentation-only trailing inset for content that must scroll fully above a bounded viewport. */
    readonly contentPaddingBottom?: number;
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
    /** Selects a shared text recipe; application colors remain theme-owned. */
    readonly appearance?: 'default' | 'login' | 'login-muted' | 'admin' | 'admin-muted';
    /** Presentation-only text layout override for composite primitive composition. */
    readonly style?: StyleProp<TextStyle>;
  }>;

export type PrimitiveHeadingProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    /** Selects a shared heading recipe; application colors remain theme-owned. */
    readonly appearance?: 'default' | 'login' | 'admin-shell' | 'admin-page' | 'admin-section';
  }>;

export type PrimitiveLabelProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly nativeID?: string;
  }>;

export type PrimitiveInputProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly appearance?: 'default' | 'admin';
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
    /** Optional presentation icon rendered in the button content slot. */
    readonly icon?: PrimitiveIconName;
    readonly disabled?: boolean;
    readonly busy?: boolean;
    /** Selected presentation state for keyboard modifier keys only. */
    readonly selected?: boolean;
    /** Compact mobile presentation for the shared virtual keyboard. */
    readonly compact?: boolean;
    /** Selects a shared button recipe; application colors remain theme-owned. */
    readonly appearance?: 'default' | 'login-primary' | 'login-secondary' | 'admin-primary' | 'admin-secondary' | 'admin-icon';
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
    /** Selects a shared status recipe; application colors remain theme-owned. */
    readonly appearance?: 'default' | 'login' | 'admin';
    readonly tone?: PrimitiveTone;
    readonly onLayout?: (event: LayoutChangeEvent) => void;
    readonly onTextLayout?: (event: TextLayoutEvent) => void;
    /** Presentation-only text layout override for composite primitive composition. */
    readonly style?: StyleProp<TextStyle>;
  }>;

export type PrimitiveActionsProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly orientation?: 'row' | 'column';
  }>;

export type PrimitiveIconName = 'admin' | 'blocked' | 'check' | 'chevron-down' | 'chevron-right' | 'close' | 'info' | 'keyboard-backspace' | 'keyboard-enter' | 'link' | 'monitor' | 'refresh' | 'server';

export type PrimitiveIconProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel: string;
    readonly appearance?: 'default' | 'login' | 'keyboard-action' | 'admin-shell' | 'admin-content';
  readonly icon: PrimitiveIconName;
  readonly size?: number;
  /** Presentation-only alignment override for composite primitive composition. */
  readonly style?: StyleProp<ViewStyle>;
}>;

export type PrimitiveIconBadgeProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel: string;
  readonly icon: PrimitiveIconName;
  readonly size?: number;
}>;

export type PrimitiveLayoutProps = PrimitiveAddressableProps &
  Readonly<{
    readonly children?: ReactNode;
    readonly appearance?: 'default' | 'admin' | 'admin-inset' | 'admin-header' | 'admin-nav' | 'admin-content';
    /** Presentation-only native layout override for composite primitive composition. */
    readonly style?: StyleProp<ViewStyle>;
  }>;

export type PrimitiveGridProps = PrimitiveLayoutProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly accessibilityRole?: 'none' | 'tablist';
    readonly appearance?: 'default' | 'admin-header' | 'admin-nav' | 'admin-content';
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
    readonly appearance?: 'default' | 'admin-status';
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

export type PrimitiveDropdownSelectProps = PrimitiveFormControlProps &
  Readonly<{
    readonly options: readonly PrimitiveOption[];
    readonly value: string;
    readonly open: boolean;
    readonly appearance?: 'default' | 'admin-mobile';
    readonly onOpenChange?: (open: boolean) => void;
    readonly onValueChange?: (value: string) => void;
  }>;

export type PrimitiveRatioSegment = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly value: number;
  readonly tone: PrimitiveTone;
}>;

export type PrimitiveRatioBarProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly total: number;
    readonly segments: readonly PrimitiveRatioSegment[];
  }>;

export type PrimitiveStatusLineProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel?: string;
    readonly tone?: PrimitiveTone;
    readonly children?: ReactNode;
  }>;

export type PrimitiveFactItem = Readonly<{
  readonly key: string;
  readonly testID?: string;
  readonly label: string;
  readonly value: string;
  readonly tone?: PrimitiveTone;
}>;

export type PrimitiveFactGridProps = PrimitiveAddressableProps &
  Readonly<{
    readonly items: readonly PrimitiveFactItem[];
    readonly columns?: 1 | 2 | 3;
  }>;

export type PrimitiveDisclosureProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly label: string;
    readonly summary?: string;
    readonly summaryTestID?: string;
    readonly status?: string;
    readonly statusTestID?: string;
    readonly triggerTestID?: string;
    readonly expanded: boolean;
    readonly onExpandedChange?: (expanded: boolean) => void;
    readonly children?: ReactNode;
  }>;

export type PrimitiveSurfaceMapSurface = Readonly<{
  readonly key: string;
  readonly label: string;
  readonly roleLabel: string;
  readonly current: boolean;
  readonly present: boolean;
  readonly aspectRatio: number;
  readonly insideLabels: readonly string[];
  readonly outsideLabels: readonly string[];
  readonly logicWidthLabel?: string;
  readonly logicHeightLabel?: string;
  readonly physicalWidthLabel?: string;
  readonly physicalHeightLabel?: string;
  readonly statusLabel?: string;
  readonly statusTone?: PrimitiveTone;
}>;

export type PrimitiveSurfaceMapProps = PrimitiveAddressableProps &
  Readonly<{
    readonly accessibilityLabel: string;
    readonly surfaces: readonly PrimitiveSurfaceMapSurface[];
    readonly direction?: 'row' | 'column';
    readonly compact?: boolean;
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
    readonly appearance?: 'default' | 'admin';
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
