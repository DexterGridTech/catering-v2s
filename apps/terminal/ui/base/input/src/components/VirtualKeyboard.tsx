import {memo, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {PrimitiveButton} from '@catering-v2s/ui-base-primitives';
import type {KeyboardKey} from '../model/editText';
import {getKeyboardLayout, type KeyboardKeyDefinition, type KeyboardLayout} from '../model/keyboardLayout';

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

export const VirtualKeyboard = memo(
  ({layout, height, frameWidth, cellWidth, shift, capsLock, hasNextField, onKey}: VirtualKeyboardProps) => {
    const definition = getKeyboardLayout(layout);
    const columnGap = definition.horizontalMode === 'dense' ? 2 : 8;
    const firstRegionRow = useMemo(() => {
      const firstRowByZone = new Map<string, number>();
      definition.rows.forEach((row, rowIndex) => {
        row.keys.forEach(key => {
          if (!firstRowByZone.has(key.zone)) firstRowByZone.set(key.zone, rowIndex);
        });
      });
      return firstRowByZone;
    }, [definition]);
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
          {definition.rows.map((row, rowIndex) => (
            <View
              key={`row-${rowIndex}`}
              style={[styles.row, {gap: columnGap, justifyContent: row.align === 'center' ? 'center' : 'flex-start'}]}
            >
              {keyGroups(row.keys).map((group, groupIndex) => {
                const zone = group[0]!.zone;
                const regionTestID =
                  firstRegionRow.get(zone) === rowIndex &&
                  keyGroups(row.keys).findIndex(candidate => candidate[0]!.zone === zone) === groupIndex
                    ? `ui.base.input:virtual-keyboard:region:${zone}`
                    : undefined;
                return (
                  <View
                    key={`${rowIndex}-${zone}-${groupIndex}`}
                    testID={regionTestID}
                    style={[styles.region, {width: groupWidth(group.length, cellWidth, columnGap), gap: columnGap}]}
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
              })}
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
  region: {
    height: '100%',
    flexDirection: 'row',
  },
});
