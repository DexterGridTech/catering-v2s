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
const DOCK_PADDING_HORIZONTAL = 8;
const DOCK_PADDING_VERTICAL = 9;
const ROW_GAP = 3;
const DENSE_KEY_MIN_WIDTH = 32;
const DENSE_COLUMN_GAP = 2;
const STANDARD_COLUMN_GAP = 8;

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

const calculateVerticalRequired = (rowCount: number): number =>
  rowCount * KEY_CELL_HEIGHT + (rowCount - 1) * ROW_GAP + DOCK_PADDING_VERTICAL * 2;

const calculateCellWidth = (frameWidth: number, columnCount: number, horizontalMode: 'dense' | 'standard'): number => {
  const columnGap = horizontalMode === 'dense' ? DENSE_COLUMN_GAP : STANDARD_COLUMN_GAP;
  const available = frameWidth - DOCK_PADDING_HORIZONTAL * 2 - (columnCount - 1) * columnGap;
  return Math.floor(available / columnCount);
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
    rowCount: definition.rows.length,
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

  const availableDockHeight = calculateAvailableDockHeight(frame.height);
  const verticalRequired = calculateVerticalRequired(definition.rows.length);
  // The visible dock wraps the actual layout instead of reserving the five-row
  // height for every layout. This keeps alpha compact while preserving the
  // same measured surface/content boundary for every supported frame.
  const height = Math.min(availableDockHeight, verticalRequired);
  const contentHeight = Math.max(0, frame.height - height);
  const cellWidth = calculateCellWidth(frame.width, definition.maxColumns, definition.horizontalMode);
  const minimumCellWidth = definition.horizontalMode === 'dense' ? DENSE_KEY_MIN_WIDTH : KEY_CELL_HEIGHT;
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
    rowCount: definition.rows.length,
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
  DOCK_PADDING_HORIZONTAL,
  DOCK_PADDING_VERTICAL,
  ROW_GAP,
  DENSE_KEY_MIN_WIDTH,
  DENSE_COLUMN_GAP,
  STANDARD_COLUMN_GAP,
});
