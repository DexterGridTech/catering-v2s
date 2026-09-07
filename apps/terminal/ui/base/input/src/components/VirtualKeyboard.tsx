import {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {PrimitiveButton} from '@catering-v2s/ui-base-primitives';
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
  readonly frameWidth: number;
  readonly cellWidth: number;
  readonly shift: boolean;
  readonly capsLock: boolean;
  readonly hasNextField: boolean;
  readonly onKey: (key: KeyboardKey) => void;
}>;

const keyIdOf = (definition: KeyboardKeyDefinition): string => definition.keyId;

const keyboardKeyOf = (definition: KeyboardKeyDefinition, hasNextField: boolean): KeyboardKey =>
  definition.kind === 'text'
    ? {kind: 'text', text: definition.text}
    : definition.kind === 'complete'
      ? {kind: 'complete', hasNextField}
      : {kind: definition.kind};

const labelOf = (definition: KeyboardKeyDefinition, shift: boolean, capsLock: boolean): string => {
  if (definition.kind === 'text') return shift || capsLock ? definition.text.toUpperCase() : definition.text;
  if (definition.kind === 'backspace') return '⌫';
  if (definition.kind === 'shift') return shift ? '⇧' : '↑';
  if (definition.kind === 'caps') return capsLock ? '⇪' : '⇧⇧';
  return '完成';
};

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

const rowHeightOf = (row: KeyboardRow): number => {
  const grid = row.grid;
  if (grid === undefined) return INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT;
  return (
    grid.rowCount * INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT +
    Math.max(0, grid.rowCount - 1) * INPUT_LAYOUT_CONSTANTS.ROW_GAP
  );
};

const gridColumnWidthOf = (span: number, cellWidth: number, columnGap: number): number =>
  span * cellWidth + Math.max(0, span - 1) * columnGap;

const rowCellWidthOf = (input: Readonly<{
  row: KeyboardRow;
  frameWidth: number;
  sharedCellWidth: number;
  columnGap: number;
}>): number => {
  if (input.row.sizing === 'shared') return input.sharedCellWidth;
  const availableWidth = input.frameWidth - INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_HORIZONTAL * 2;
  return Math.floor((availableWidth - Math.max(0, input.row.keys.length - 1) * input.columnGap) / input.row.keys.length);
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
  ({layout, height, frameWidth, cellWidth, shift, capsLock, hasNextField, onKey}: VirtualKeyboardProps) => {
    const definition = getKeyboardLayout(layout);
    const columnGap = definition.horizontalMode === 'dense' ? 2 : 8;
    const regions = useMemo(() => groupRowsByRegion(definition.rows), [definition]);
    const handlers = useMemo(
      () =>
        new Map(
          definition.rows
            .flatMap(row => row.keys)
            .map(key => [keyIdOf(key), () => onKey(keyboardKeyOf(key, hasNextField))] as const),
        ),
      [definition, hasNextField, onKey],
    );

    return (
      <View testID="ui.base.input:virtual-keyboard" style={[styles.dock, {height, width: frameWidth}]}>
        <View testID="ui.base.input:virtual-keyboard:content" style={styles.content}>
          {regions.map(region => (
            <View
              key={`region-${region.region}`}
              testID={`ui.base.input:virtual-keyboard:region:${region.region}`}
              style={styles.region}
            >
              {region.rows.map((row, rowIndex) => (
                <View
                  key={`row-${region.region}-${rowIndex}`}
                  style={[
                    row.grid === undefined ? styles.row : styles.gridRow,
                    {
                      gap: columnGap,
                      height: rowHeightOf(row),
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
                        });
                        return (
                          <View
                            key={`${rowIndex}-${zone}-${groupIndex}`}
                            testID={`ui.base.input:virtual-keyboard:segment:${zone}:${groupIndex}`}
                            style={[
                              styles.keyGroup,
                              {width: groupWidth(group.length, rowCellWidth, columnGap), gap: columnGap},
                            ]}
                          >
                            {group.map(key => {
                              const keyId = keyIdOf(key);
                              const label = labelOf(key, shift, capsLock);
                              return (
                                <PrimitiveButton
                                  key={keyId}
                                  testID={`ui.base.input:virtual-keyboard:${keyId}`}
                                  accessibilityLabel={label}
                                  variant={key.zone === 'actions' ? 'key-action' : 'key'}
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
                          testID={`ui.base.input:virtual-keyboard:segment:grid:${columnIndex}`}
                          style={[
                            styles.gridColumn,
                            {
                              width: gridColumnWidthOf(column.span, cellWidth, columnGap),
                              flexDirection: column.direction,
                              gap: column.direction === 'row' ? columnGap : INPUT_LAYOUT_CONSTANTS.ROW_GAP,
                            },
                          ]}
                        >
                          {column.keys.map(key => {
                            const keyId = keyIdOf(key);
                            const label = labelOf(key, shift, capsLock);
                            return (
                              <PrimitiveButton
                                key={keyId}
                                testID={`ui.base.input:virtual-keyboard:${keyId}`}
                                accessibilityLabel={label}
                                variant={key.zone === 'actions' ? 'key-action' : 'key'}
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
      </View>
    );
  },
);

VirtualKeyboard.displayName = 'VirtualKeyboard';

const styles = StyleSheet.create({
  dock: {
    overflow: 'hidden',
  },
  content: {
    width: '100%',
    paddingTop: 9,
    paddingHorizontal: 8,
    paddingBottom: 9,
    gap: 3,
  },
  row: {
    width: '100%',
    height: 48,
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
    gap: 3,
  },
  keyGroup: {
    height: '100%',
    flexDirection: 'row',
  },
  gridColumn: {
    height: '100%',
    flexDirection: 'column',
  },
});
