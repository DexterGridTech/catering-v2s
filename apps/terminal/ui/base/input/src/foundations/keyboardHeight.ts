import {getKeyboardLayout, type KeyboardLayout} from './keyboardLayout';

export type {KeyboardLayout} from './keyboardLayout';

export type LocalFrameMetrics = Readonly<{
  readonly width: number;
  readonly height: number;
  readonly ready: boolean;
  readonly orientation: 'landscape' | 'portrait';
}>;

type FrameMetricsInput = Readonly<{
  readonly width: number;
  readonly height: number;
  readonly ready?: boolean;
}>;

export type KeyboardCapacity =
  'unmeasured' | 'unsupported-width' | 'unsupported-height' | 'unsupported-horizontal' | 'supported';

export type VirtualKeyboardMetrics = Readonly<{
  readonly capacity: KeyboardCapacity;
  readonly height: number;
  readonly contentHeight: number;
  readonly visible: boolean;
  readonly contentTooSmall: boolean;
  readonly frameWidth: number;
  readonly horizontalMode: 'dense' | 'standard';
  readonly rowCount: number;
  readonly columnCount: number;
  readonly cellWidth: number;
}>;

const MIN_SUPPORTED_FRAME_WIDTH = 360;
const MIN_CONTENT_HEIGHT = 208;
const MAX_DOCK_HEIGHT = 320;
const MAX_DOCK_RATIO = 0.5;
const KEY_CELL_HEIGHT = 48;
const COMPACT_KEY_CELL_HEIGHT = 38;
const DOCK_PADDING_HORIZONTAL = 14;
const COMPACT_DOCK_PADDING_HORIZONTAL = 10;
const DOCK_PADDING_VERTICAL = 14;
const COMPACT_DOCK_PADDING_VERTICAL = 10;
const DOCK_BORDER_WIDTH = 1;
const ROW_GAP = 8;
const COMPACT_ROW_GAP = 5;
const DENSE_KEY_MIN_WIDTH = 30;
const COMPACT_COLUMN_GAP = 4;
const STANDARD_COLUMN_GAP = 8;
const DOCK_OUTER_HORIZONTAL_MARGIN = 16;
const COMPACT_NUMERIC_DOCK_WIDTH = 330;
const DOCK_MAX_WIDTH: Readonly<Record<KeyboardLayout, number>> = Object.freeze({
  full: 820,
  alpha: 820,
  numeric: 560,
  financial: 560,
});
const MOBILE_SYMBOL_MAX_FRAME_WIDTH = 480;

const isReady = (frame: FrameMetricsInput | null): frame is FrameMetricsInput =>
  frame !== null &&
  frame.ready !== false &&
  Number.isFinite(frame.width) &&
  Number.isFinite(frame.height) &&
  frame.width > 0 &&
  frame.height > 0;

const calculateAvailableDockHeight = (frameHeight: number): number => {
  const candidate = Math.min(
    MAX_DOCK_HEIGHT,
    Math.floor(frameHeight * MAX_DOCK_RATIO),
    frameHeight - MIN_CONTENT_HEIGHT,
  );
  return Math.max(0, candidate);
};

const isCompactFrameWidth = (frameWidth: number): boolean => frameWidth <= MOBILE_SYMBOL_MAX_FRAME_WIDTH;

const calculateVerticalRequired = (rowCount: number, compact: boolean): number =>
  rowCount * (compact ? COMPACT_KEY_CELL_HEIGHT : KEY_CELL_HEIGHT) +
  (rowCount - 1) * (compact ? COMPACT_ROW_GAP : ROW_GAP) +
  (compact ? COMPACT_DOCK_PADDING_VERTICAL : DOCK_PADDING_VERTICAL) * 2 +
  DOCK_BORDER_WIDTH * 2;

const calculateCellWidth = (
  frameWidth: number,
  columnCount: number,
  compact = isCompactFrameWidth(frameWidth),
): number => {
  const columnGap = compact ? COMPACT_COLUMN_GAP : STANDARD_COLUMN_GAP;
  const horizontalPadding = compact ? COMPACT_DOCK_PADDING_HORIZONTAL : DOCK_PADDING_HORIZONTAL;
  const available = frameWidth - horizontalPadding * 2 - (columnCount - 1) * columnGap;
  return Math.floor(available / columnCount);
};

/**
 * Keeps the keyboard as a floating card on wide surfaces while preserving the
 * minimum dense-key width on the 360 logical-unit mobile surface.
 */
export const calculateVirtualKeyboardDockWidth = (frameWidth: number, layout: KeyboardLayout = 'full'): number => {
  if (frameWidth <= MIN_SUPPORTED_FRAME_WIDTH && (layout === 'numeric' || layout === 'financial')) {
    return Math.min(frameWidth - 30, COMPACT_NUMERIC_DOCK_WIDTH);
  }
  const insetWidth = frameWidth - DOCK_OUTER_HORIZONTAL_MARGIN * 2;
  const availableWidth = insetWidth >= MIN_SUPPORTED_FRAME_WIDTH ? insetWidth : frameWidth;
  return Math.min(availableWidth, DOCK_MAX_WIDTH[layout]);
};

export const calculateVirtualKeyboardCellWidth = (
  frameWidth: number,
  layout: KeyboardLayout,
  compact?: boolean,
): number => {
  const definition = getKeyboardLayout(layout);
  return calculateCellWidth(frameWidth, definition.maxColumns, compact);
};

const emptyMetrics = (layout: KeyboardLayout): VirtualKeyboardMetrics => {
  const definition = getKeyboardLayout(layout);
  return {
    capacity: 'unmeasured',
    height: 0,
    contentHeight: 0,
    visible: false,
    contentTooSmall: false,
    frameWidth: 0,
    horizontalMode: definition.horizontalMode,
    rowCount: definition.visualRowCount,
    columnCount: definition.maxColumns,
    cellWidth: 0,
  };
};

export const calculateVirtualKeyboardMetrics = (
  frame: FrameMetricsInput | null,
  layout: KeyboardLayout,
): VirtualKeyboardMetrics => {
  const definition = getKeyboardLayout(layout);
  if (!isReady(frame)) return emptyMetrics(layout);

  const compact = isCompactFrameWidth(frame.width);
  const availableDockHeight = calculateAvailableDockHeight(frame.height);
  const verticalRequired = calculateVerticalRequired(definition.visualRowCount, compact);
  // The visible dock wraps the actual layout instead of reserving the longest
  // layout height for every layout. This keeps alpha compact while preserving the
  // same measured surface/content boundary for every supported frame.
  const height = Math.min(availableDockHeight, verticalRequired);
  const contentHeight = Math.max(0, frame.height - height);
  const cellWidth = calculateVirtualKeyboardCellWidth(frame.width, layout);
  const minimumCellWidth = definition.horizontalMode === 'dense'
    ? DENSE_KEY_MIN_WIDTH
    : compact ? COMPACT_KEY_CELL_HEIGHT : KEY_CELL_HEIGHT;
  const horizontalFeasible = cellWidth >= minimumCellWidth;
  const verticalFeasible = availableDockHeight >= verticalRequired;
  const capacity: KeyboardCapacity =
    frame.width < MIN_SUPPORTED_FRAME_WIDTH
      ? 'unsupported-width'
      : !verticalFeasible
        ? 'unsupported-height'
        : !horizontalFeasible
          ? 'unsupported-horizontal'
          : 'supported';

  return {
    capacity,
    height,
    contentHeight,
    visible: capacity === 'supported',
    contentTooSmall: capacity === 'unsupported-height',
    frameWidth: frame.width,
    horizontalMode: definition.horizontalMode,
    rowCount: definition.visualRowCount,
    columnCount: definition.maxColumns,
    cellWidth,
  };
};

export const INPUT_LAYOUT_CONSTANTS = Object.freeze({
  MIN_SUPPORTED_FRAME_WIDTH,
  MIN_CONTENT_HEIGHT,
  MAX_DOCK_HEIGHT,
  MAX_DOCK_RATIO,
  KEY_CELL_HEIGHT,
  COMPACT_KEY_CELL_HEIGHT,
  DOCK_PADDING_HORIZONTAL,
  COMPACT_DOCK_PADDING_HORIZONTAL,
  DOCK_PADDING_VERTICAL,
  COMPACT_DOCK_PADDING_VERTICAL,
  DOCK_BORDER_WIDTH,
  ROW_GAP,
  COMPACT_ROW_GAP,
  DENSE_KEY_MIN_WIDTH,
  COMPACT_COLUMN_GAP,
  STANDARD_COLUMN_GAP,
  DOCK_OUTER_HORIZONTAL_MARGIN,
  COMPACT_NUMERIC_DOCK_WIDTH,
  DOCK_MAX_WIDTH,
  MOBILE_SYMBOL_MAX_FRAME_WIDTH,
});
