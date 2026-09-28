import {memo, useMemo} from 'react';
import {View} from 'react-native';
import {PrimitiveButton, PrimitiveKeyboardSurface} from '@catering-v2s/ui-base-primitives';
import type {PrimitiveIconName} from '@catering-v2s/ui-base-primitives';
import type {KeyboardKey} from '../foundations/editText';
import {
  getKeyboardLayout,
  type KeyboardRow,
  type KeyboardKeyDefinition,
  type KeyboardLayout,
  type KeyboardRegion,
} from '../foundations/keyboardLayout';
import {INPUT_LAYOUT_CONSTANTS} from '../foundations/keyboardHeight';

export type VirtualKeyboardProps = Readonly<{
  readonly layout: KeyboardLayout;
  readonly height: number;
  /** Width of the rendered dock. InputKeyboard passes the host-derived dock width. */
  readonly frameWidth: number;
  readonly cellWidth: number;
  /** Compact mobile presentation; direct callers derive it from the rendered dock width when omitted. */
  readonly compact?: boolean;
  readonly shift: boolean;
  readonly hasNextField: boolean;
  readonly testIDSuffix?: string;
  readonly onKey: (key: KeyboardKey) => void;
}>;

type SurfaceInteractionEvent = Readonly<{readonly stopPropagation: () => void}>;

const stopSurfaceDismiss = (event: SurfaceInteractionEvent): void => {
  event.stopPropagation();
};

const keyIdOf = (definition: KeyboardKeyDefinition): string => definition.keyId;

const keyboardKeyOf = (definition: KeyboardKeyDefinition, hasNextField: boolean, shift: boolean): KeyboardKey =>
  definition.kind === 'text'
    ? {kind: 'text', text: shift ? (definition.shiftedText ?? definition.text) : definition.text}
    : definition.kind === 'complete'
      ? {kind: 'complete', hasNextField}
      : definition.kind === 'space'
        ? {kind: 'space'}
        : {kind: definition.kind};

const labelOf = (definition: KeyboardKeyDefinition, compact: boolean, shift: boolean): string => {
  if (definition.kind === 'text') {
    if (shift && definition.shiftedText !== undefined) return definition.shiftedText;
    if (definition.text === '-') return '−';
    if (definition.text === '.') return '·';
    return shift ? definition.text.toUpperCase() : definition.text.toLowerCase();
  }
  if (definition.kind === 'backspace') return 'BACKSPACE';
  if (definition.kind === 'shift') return compact ? '⇧' : 'SHIFT';
  if (definition.kind === 'space') return compact ? '␣' : 'SPACE';
  return 'COMPLETE';
};

const accessibilityLabelOf = (definition: KeyboardKeyDefinition, label: string): string => {
  if (definition.kind === 'backspace') return '删除';
  if (definition.kind === 'complete') return '回车';
  if (definition.kind === 'shift') return '大写';
  if (definition.kind === 'space') return '空格';
  return label;
};

const iconOf = (definition: KeyboardKeyDefinition): PrimitiveIconName | undefined =>
  definition.kind === 'backspace'
    ? 'keyboard-backspace'
    : definition.kind === 'complete'
      ? 'keyboard-enter'
      : undefined;

const selectedOf = (definition: KeyboardKeyDefinition, shift: boolean): boolean | undefined =>
  definition.kind === 'shift' ? shift : undefined;

const keyGroups = (definitions: readonly KeyboardKeyDefinition[]): readonly (readonly KeyboardKeyDefinition[])[] => {
  const groups: KeyboardKeyDefinition[][] = [];
  for (const definition of definitions) {
    const previous = groups[groups.length - 1];
    if (previous !== undefined && previous[0]?.zone === definition.zone) {
      previous.push(definition);
    } else {
      groups.push([definition]);
    }
  }
  return groups;
};

const groupWidth = (keyCount: number, cellWidth: number, columnGap: number): number =>
  keyCount * cellWidth + Math.max(0, keyCount - 1) * columnGap;

const rowHeightOf = (row: KeyboardRow, compact: boolean): number => {
  const grid = row.grid;
  if (grid === undefined) {
    return compact ? INPUT_LAYOUT_CONSTANTS.COMPACT_KEY_CELL_HEIGHT : INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT;
  }
  return (
    grid.rowCount *
      (compact ? INPUT_LAYOUT_CONSTANTS.COMPACT_KEY_CELL_HEIGHT : INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT) +
    Math.max(0, grid.rowCount - 1) * (compact ? INPUT_LAYOUT_CONSTANTS.COMPACT_ROW_GAP : INPUT_LAYOUT_CONSTANTS.ROW_GAP)
  );
};

const gridColumnWidthOf = (span: number, cellWidth: number, columnGap: number): number =>
  span * cellWidth + Math.max(0, span - 1) * columnGap;

const rowCellWidthOf = (
  input: Readonly<{
    row: KeyboardRow;
    frameWidth: number;
    sharedCellWidth: number;
    columnGap: number;
    compact: boolean;
  }>,
): number => {
  if (input.row.sizing === 'shared') return input.sharedCellWidth;
  const horizontalPadding = input.compact
    ? INPUT_LAYOUT_CONSTANTS.COMPACT_DOCK_PADDING_HORIZONTAL
    : INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_HORIZONTAL;
  const availableWidth = input.frameWidth - horizontalPadding * 2;
  return Math.floor(
    (availableWidth - Math.max(0, input.row.keys.length - 1) * input.columnGap) / input.row.keys.length,
  );
};

type KeyboardRegionRows = {
  readonly region: KeyboardRegion;
  readonly rows: KeyboardRow[];
};

const groupRowsByRegion = (rows: readonly KeyboardRow[]): KeyboardRegionRows[] => {
  const regions: KeyboardRegionRows[] = [];
  for (const row of rows) {
    const previous = regions[regions.length - 1];
    if (previous?.region === row.region) {
      previous.rows.push(row);
    } else {
      regions.push({region: row.region, rows: [row]});
    }
  }
  return regions;
};

export const VirtualKeyboard = memo(
  ({
    layout,
    height,
    frameWidth,
    cellWidth,
    compact: compactOverride,
    shift,
    hasNextField,
    testIDSuffix,
    onKey,
  }: VirtualKeyboardProps) => {
    const definition = getKeyboardLayout(layout);
    const compact = compactOverride ?? frameWidth <= INPUT_LAYOUT_CONSTANTS.MOBILE_SYMBOL_MAX_FRAME_WIDTH;
    const columnGap = compact ? INPUT_LAYOUT_CONSTANTS.COMPACT_COLUMN_GAP : INPUT_LAYOUT_CONSTANTS.STANDARD_COLUMN_GAP;
    const rowGap = compact ? INPUT_LAYOUT_CONSTANTS.COMPACT_ROW_GAP : INPUT_LAYOUT_CONSTANTS.ROW_GAP;
    const horizontalPadding = compact
      ? INPUT_LAYOUT_CONSTANTS.COMPACT_DOCK_PADDING_HORIZONTAL
      : INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_HORIZONTAL;
    const verticalPadding = compact
      ? INPUT_LAYOUT_CONSTANTS.COMPACT_DOCK_PADDING_VERTICAL
      : INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_VERTICAL;
    const regions = useMemo(() => groupRowsByRegion(definition.rows), [definition]);
    const testIDOf = (testID: string): string => (testIDSuffix === undefined ? testID : `${testID}:${testIDSuffix}`);
    const handlers = useMemo(
      () =>
        new Map(
          definition.rows
            .flatMap(row => row.keys)
            .map(key => [keyIdOf(key), () => onKey(keyboardKeyOf(key, hasNextField, shift))] as const),
        ),
      [definition, hasNextField, onKey, shift],
    );

    return (
      <PrimitiveKeyboardSurface
        testID={testIDOf('ui.base.input:virtual-keyboard')}
        style={[{height, width: frameWidth, borderRadius: 0}]}
        onTouchEnd={stopSurfaceDismiss}
        onClick={stopSurfaceDismiss}
      >
        <View
          testID={testIDOf('ui.base.input:virtual-keyboard:content')}
          style={[
            styles.content,
            {
              paddingTop: verticalPadding,
              paddingHorizontal: horizontalPadding,
              paddingBottom: verticalPadding,
              gap: rowGap,
            },
          ]}
        >
          {regions.map(region => (
            <View
              key={`region-${region.region}`}
              testID={testIDOf(`ui.base.input:virtual-keyboard:region:${region.region}`)}
              style={[styles.region, {gap: rowGap}]}
            >
              {region.rows.map((row, rowIndex) => (
                <View
                  key={`row-${region.region}-${rowIndex}`}
                  style={[
                    row.grid === undefined ? styles.row : styles.gridRow,
                    {
                      gap: columnGap,
                      height: rowHeightOf(row, compact),
                      justifyContent: row.align === 'center' ? 'center' : 'flex-start',
                    },
                  ]}
                >
                  {row.grid === undefined
                    ? keyGroups(row.keys).map((group, groupIndex) => {
                        const zone = group[0]!.zone;
                        const rowCellWidth = rowCellWidthOf({
                          row,
                          frameWidth,
                          sharedCellWidth: cellWidth,
                          columnGap,
                          compact,
                        });
                        return (
                          <View
                            key={`${rowIndex}-${zone}-${groupIndex}`}
                            testID={testIDOf(`ui.base.input:virtual-keyboard:segment:${zone}:${groupIndex}`)}
                            style={[
                              styles.keyGroup,
                              {width: groupWidth(group.length, rowCellWidth, columnGap), gap: columnGap},
                            ]}
                          >
                            {group.map(key => {
                              const keyId = keyIdOf(key);
                              const label = labelOf(key, compact, shift);
                              return (
                                <PrimitiveButton
                                  key={keyId}
                                  testID={testIDOf(`ui.base.input:virtual-keyboard:${keyId}`)}
                                  accessibilityLabel={accessibilityLabelOf(key, label)}
                                  icon={iconOf(key)}
                                  variant={key.zone === 'actions' ? 'key-action' : 'key'}
                                  compact={compact}
                                  selected={selectedOf(key, shift)}
                                  onPress={handlers.get(keyId)}
                                >
                                  {label}
                                </PrimitiveButton>
                              );
                            })}
                          </View>
                        );
                      })
                    : row.grid.columns.map((column, columnIndex) => (
                        <View
                          key={`${rowIndex}-grid-column-${columnIndex}`}
                          testID={testIDOf(`ui.base.input:virtual-keyboard:segment:grid:${columnIndex}`)}
                          style={[
                            styles.gridColumn,
                            {
                              width: gridColumnWidthOf(column.span, cellWidth, columnGap),
                              flexDirection: column.direction,
                              gap: column.direction === 'row' ? columnGap : rowGap,
                            },
                          ]}
                        >
                          {column.keys.map(key => {
                            const keyId = keyIdOf(key);
                            const label = labelOf(key, compact, shift);
                            return (
                              <PrimitiveButton
                                key={keyId}
                                testID={testIDOf(`ui.base.input:virtual-keyboard:${keyId}`)}
                                accessibilityLabel={accessibilityLabelOf(key, label)}
                                icon={iconOf(key)}
                                variant={key.zone === 'actions' ? 'key-action' : 'key'}
                                compact={compact}
                                selected={selectedOf(key, shift)}
                                onPress={handlers.get(keyId)}
                              >
                                {label}
                              </PrimitiveButton>
                            );
                          })}
                        </View>
                      ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      </PrimitiveKeyboardSurface>
    );
  },
);

VirtualKeyboard.displayName = 'VirtualKeyboard';

const styles = {
  content: {
    width: '100%',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  gridRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  region: {
    width: '100%',
  },
  keyGroup: {
    height: '100%',
    flexDirection: 'row',
  },
  gridColumn: {
    height: '100%',
    flexDirection: 'column',
  },
} as const;
