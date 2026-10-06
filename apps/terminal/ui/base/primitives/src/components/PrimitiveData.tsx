import {useMemo, useState} from 'react';
import {RnrPressable, RnrText, RnrView, RnrVirtualizedList} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import {deriveTestId, testIdProps} from '../foundations/testId';
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName';
import type {
  PrimitiveBadgeProps,
  PrimitiveKeyValueRowProps,
  PrimitiveListProps,
  PrimitiveSegmentedControlProps,
  PrimitiveStatusRowProps,
  PrimitivePortItemProps,
  PrimitiveTableProps,
  PrimitiveTabsProps,
} from '../types/types';

export const LIST_VISIBLE_WINDOW = 16 as const;
export const LIST_OVERSCAN_BEFORE = 4 as const;
export const LIST_OVERSCAN_AFTER = 4 as const;
export const LIST_MAX_MOUNTED = 24 as const;

export const PrimitiveKeyValueRow = ({testID, label, value, appearance = 'default'}: PrimitiveKeyValueRowProps) => (
  <RnrView
    {...testIdProps(assertTestID(testID))}
    className={appearance === 'admin' ? baseTokens.adminDataRow : baseTokens.dataRow}
  >
    <RnrText className={appearance === 'admin' ? baseTokens.adminDataLabel : baseTokens.dataLabel}>{label}</RnrText>
    <RnrText className={appearance === 'admin' ? baseTokens.adminDataValue : baseTokens.dataValue}>{value}</RnrText>
  </RnrView>
);

export const PrimitiveStatusRow = ({
  testID,
  label,
  value,
  appearance = 'default',
  tone = 'neutral',
}: PrimitiveStatusRowProps) => (
  <RnrView
    {...testIdProps(assertTestID(testID))}
    className={appearance === 'admin' ? baseTokens.adminDataRow : baseTokens.dataRow}
  >
    <RnrText className={appearance === 'admin' ? baseTokens.adminDataLabel : baseTokens.dataLabel}>{label}</RnrText>
    <RnrText
      className={toneForegroundClassName(
        tone,
        appearance === 'admin' ? baseTokens.adminDataValue : baseTokens.dataValue,
      )}
    >
      {value}
    </RnrText>
  </RnrView>
);

export const PrimitivePortItem = ({testID, name, status, reason, source, tone}: PrimitivePortItemProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView {...testIdProps(address)} className={baseTokens.adminPortItem}>
      <RnrView
        {...testIdProps(deriveTestId(testID, 'indicator'))}
        className={toneClassName(tone, baseTokens.adminPortItemDot)}
      />
      <RnrText {...testIdProps(deriveTestId(testID, 'name'))} className={baseTokens.adminPortItemName}>
        {name}
      </RnrText>
      <RnrText
        {...testIdProps(deriveTestId(testID, 'status'))}
        className={toneForegroundClassName(tone, baseTokens.adminPortItemStatus)}
      >
        {status}
      </RnrText>
      <RnrText {...testIdProps(deriveTestId(testID, 'reason'))} className={baseTokens.adminPortItemMeta}>
        原因：{reason}
      </RnrText>
      <RnrText {...testIdProps(deriveTestId(testID, 'source'))} className={baseTokens.adminPortItemMeta}>
        来源：{source}
      </RnrText>
    </RnrView>
  );
};

export const PrimitiveList = <ItemT,>({
  testID,
  accessibilityLabel,
  data,
  getItemKey = (_item, index) => String(index),
  onScrollOffsetChange,
  renderItem,
  rowHeight,
}: PrimitiveListProps<ItemT>) => {
  const [offsetY, setOffsetY] = useState(0);
  const firstVisibleIndex = Math.max(0, Math.floor(offsetY / rowHeight));
  const windowStart = Math.max(0, firstVisibleIndex - LIST_OVERSCAN_BEFORE);
  const windowEnd = Math.min(
    data.length,
    windowStart + LIST_VISIBLE_WINDOW + LIST_OVERSCAN_BEFORE + LIST_OVERSCAN_AFTER,
  );
  const renderWindow = useMemo(() => ({start: windowStart, end: windowEnd}), [windowEnd, windowStart]);
  const onScroll = (event: {readonly nativeEvent: {readonly contentOffset: {readonly y: number}}}) => {
    const nextOffset = Math.max(0, event.nativeEvent.contentOffset.y);
    setOffsetY(nextOffset);
    onScrollOffsetChange?.(nextOffset);
  };

  return (
    <RnrVirtualizedList
      {...testIdProps(assertTestID(testID))}
      className={baseTokens.list}
      accessibilityRole="list"
      accessibilityLabel={accessibilityLabel}
      data={data}
      getItem={(items, index) => items[index]}
      getItemCount={items => items.length}
      getItemLayout={(_items, index) => ({length: rowHeight, offset: rowHeight * index, index})}
      keyExtractor={(item, index) => getItemKey(item, index)}
      initialNumToRender={Math.min(LIST_VISIBLE_WINDOW, data.length)}
      maxToRenderPerBatch={LIST_MAX_MOUNTED}
      windowSize={1}
      removeClippedSubviews
      onScroll={onScroll}
      scrollEventThrottle={16}
      renderItem={({item, index}) => {
        const isInRenderWindow = index >= renderWindow.start && index < renderWindow.end;
        const key = getItemKey(item, index);
        return (
          <RnrView
            {...testIdProps(isInRenderWindow ? deriveTestId(testID, 'row', key) : undefined)}
            style={{height: rowHeight}}
          >
            {isInRenderWindow ? renderItem(item, index) : null}
          </RnrView>
        );
      }}
    />
  );
};

export const PrimitiveTable = <ItemT,>({testID, columns, rows}: PrimitiveTableProps<ItemT>) => (
  <RnrView {...testIdProps(assertTestID(testID))} accessibilityRole="none" className={baseTokens.table}>
    <RnrView {...testIdProps(deriveTestId(testID, 'header'))} className={baseTokens.tableRow}>
      {columns.map(column => (
        <RnrText key={column.key} className={baseTokens.tableCell}>
          {column.header}
        </RnrText>
      ))}
    </RnrView>
    {rows.map((row, rowIndex) => (
      <RnrView
        key={String(rowIndex)}
        {...testIdProps(deriveTestId(testID, 'row', String(rowIndex)))}
        className={baseTokens.tableRow}
      >
        {columns.map(column => (
          <RnrText key={column.key} className={baseTokens.tableCell}>
            {column.render(row)}
          </RnrText>
        ))}
      </RnrView>
    ))}
  </RnrView>
);

export const PrimitiveSegmentedControl = ({
  testID,
  accessibilityLabel,
  items,
  selectedValue,
  onValueChange,
  disabled,
  busy,
}: PrimitiveSegmentedControlProps) => (
  <RnrView
    {...testIdProps(assertTestID(testID))}
    accessibilityRole="tablist"
    accessibilityLabel={accessibilityLabel}
    className={baseTokens.tabRow}
  >
    {items.map(item => {
      const selected = item.value === selectedValue;
      return (
        <RnrPressable
          key={item.value}
          {...testIdProps(deriveTestId(testID, 'item', item.value))}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{selected, disabled: disabled === true, busy: busy === true}}
          disabled={disabled === true || busy === true}
          onPress={() => {
            if (disabled !== true && busy !== true && !selected) onValueChange?.(item.value);
          }}
        >
          <RnrText className={selected ? baseTokens.tabSelected : baseTokens.tab}>{item.label}</RnrText>
        </RnrPressable>
      );
    })}
  </RnrView>
);

export const PrimitiveTabs = (props: PrimitiveTabsProps) => <PrimitiveSegmentedControl {...props} />;

export type PrimitiveBadgeDisplayProps = PrimitiveBadgeProps;
