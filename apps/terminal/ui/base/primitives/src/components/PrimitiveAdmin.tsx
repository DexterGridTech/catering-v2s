import {RnrPressable, RnrText, RnrView} from '../foundations/nativeSlots';
import {cn} from '../foundations/cn';
import {assertTestID} from '../foundations/assertTestID';
import {deriveTestId, testIdProps} from '../foundations/testId';
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName';
import {adminGeometry, baseTokens} from '../theme/tokens';
import {PrimitiveIcon} from './PrimitiveIcon';
import type {
  PrimitiveDisclosureProps,
  PrimitiveFactGridProps,
  PrimitiveRatioBarProps,
  PrimitiveRatioSegment,
  PrimitiveStatusLineProps,
  PrimitiveSurfaceMapProps,
} from '../types/types';

const ratioIsValid = ({total, segments}: PrimitiveRatioBarProps): boolean => {
  if (!Number.isFinite(total) || total <= 0) return false;
  if (segments.some(segment => !Number.isFinite(segment.value) || segment.value < 0)) return false;
  const sum = segments.reduce((result, segment) => result + segment.value, 0);
  return Math.abs(sum - total) < 0.000001;
};

const ratioSegmentClassName = (tone: PrimitiveRatioSegment['tone']): string =>
  tone === 'neutral' ? cn('h-full', baseTokens.adminRatioSegmentUndeclared) : toneClassName(tone, 'h-full');

export const PrimitiveRatioBar = ({testID, accessibilityLabel, total, segments}: PrimitiveRatioBarProps) => {
  const address = assertTestID(testID);
  const valid = ratioIsValid({testID, accessibilityLabel, total, segments});
  return (
    <RnrView
      {...testIdProps(address)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={valid ? {min: 0, max: total, now: total} : undefined}
      className={baseTokens.adminRatioBar}
    >
      {valid ? (
        segments.map(segment => (
          <RnrView
            key={segment.key}
            {...testIdProps(deriveTestId(testID, 'segment', segment.key))}
            accessibilityLabel={segment.label}
            className={ratioSegmentClassName(segment.tone)}
            style={{width: `${(segment.value / total) * 100}%`}}
          />
        ))
      ) : (
        <RnrText
          {...testIdProps(deriveTestId(testID, 'invalid'))}
          className={toneForegroundClassName('warn', baseTokens.status)}
        >
          比例数据不可用
        </RnrText>
      )}
    </RnrView>
  );
};

export const PrimitiveStatusLine = ({
  testID,
  accessibilityLabel,
  tone = 'neutral',
  children,
  style,
}: PrimitiveStatusLineProps) => (
  <RnrView
    {...testIdProps(assertTestID(testID))}
    accessibilityLabel={accessibilityLabel}
    className={baseTokens.adminStatusLine}
    style={style}
  >
    <RnrView
      {...testIdProps(deriveTestId(testID, 'dot'))}
      className={toneClassName(tone, baseTokens.adminStatusLineDot)}
    />
    <RnrText className={toneForegroundClassName(tone, baseTokens.adminStatusLine)}>{children}</RnrText>
  </RnrView>
);

export const PrimitiveFactGrid = ({testID, items, columns = 3}: PrimitiveFactGridProps) => (
  <RnrView {...testIdProps(assertTestID(testID))} className={baseTokens.adminFactGrid}>
    {items.map(item => (
      <RnrView
        key={item.key}
        {...testIdProps(item.testID ?? deriveTestId(testID, 'item', item.key))}
        className={baseTokens.adminFact}
        style={{flexBasis: `${100 / columns - 2}%`}}
      >
        <RnrText className={baseTokens.adminFactLabel}>{item.label}</RnrText>
        <RnrText
          {...testIdProps(item.valueTestID)}
          className={toneForegroundClassName(item.tone ?? 'neutral', baseTokens.adminFactValue)}
        >
          {item.value}
        </RnrText>
      </RnrView>
    ))}
  </RnrView>
);

export const PrimitiveDisclosure = ({
  testID,
  accessibilityLabel,
  label,
  summary,
  summaryTestID,
  status,
  statusTestID,
  triggerTestID,
  expanded,
  onExpandedChange,
  children,
}: PrimitiveDisclosureProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView {...testIdProps(address)} className={baseTokens.adminDisclosure}>
      <RnrPressable
        {...testIdProps(triggerTestID ?? deriveTestId(testID, 'trigger'))}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{expanded}}
        className={baseTokens.adminDisclosureTrigger}
        onPress={() => onExpandedChange?.(!expanded)}
      >
        <RnrText className={baseTokens.adminDisclosureLabel}>{label}</RnrText>
        {status === undefined ? null : (
          <RnrText {...testIdProps(statusTestID)} className={baseTokens.adminDisclosureSummary}>
            {status}
          </RnrText>
        )}
        {summary === undefined ? null : (
          <RnrText {...testIdProps(summaryTestID)} className={baseTokens.adminDisclosureSummary}>
            {summary}
          </RnrText>
        )}
        <PrimitiveIcon
          {...testIdProps(deriveTestId(testID, 'icon'))}
          accessibilityLabel={expanded ? '收起' : '展开'}
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
        />
      </RnrPressable>
      {expanded ? (
        <RnrView {...testIdProps(deriveTestId(testID, 'content'))} className={baseTokens.adminDisclosureContent}>
          {children}
        </RnrView>
      ) : null}
    </RnrView>
  );
};

export const PrimitiveSurfaceMap = ({
  testID,
  accessibilityLabel,
  surfaces,
  direction = 'row',
  compact = false,
}: PrimitiveSurfaceMapProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView
      {...testIdProps(address)}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel}
      className={direction === 'row' ? baseTokens.adminSurfaceMapRow : baseTokens.adminSurfaceMapColumn}
    >
      {surfaces.map(surface => (
        <RnrView
          key={surface.key}
          {...testIdProps(deriveTestId(testID, 'surface-card', surface.key))}
          accessibilityLabel={surface.label}
          className={
            direction === 'row'
              ? surface.current
                ? baseTokens.adminSurfaceMapCardCurrent
                : baseTokens.adminSurfaceMapCard
              : surface.current
                ? baseTokens.adminSurfaceMapCardCurrentColumn
                : baseTokens.adminSurfaceMapCardColumn
          }
        >
          <RnrText
            {...testIdProps(deriveTestId(testID, 'surface-label', surface.key))}
            className={baseTokens.adminSurfaceMapLabel}
          >
            {surface.label}
          </RnrText>
          <RnrText
            {...testIdProps(deriveTestId(testID, 'surface-role', surface.key))}
            className={baseTokens.adminSurfaceMapRole}
          >
            {surface.roleLabel}
          </RnrText>
          <RnrView
            {...testIdProps(deriveTestId(testID, 'surface-wrap', surface.key))}
            className={baseTokens.adminSurfaceMapWrap}
          >
            {surface.physicalWidthLabel === undefined ? null : (
              <RnrText
                {...testIdProps(deriveTestId(testID, 'surface-outside', `${surface.key}:0`))}
                className={baseTokens.adminSurfaceMapPhysicalWidth}
              >
                {surface.physicalWidthLabel}
              </RnrText>
            )}
            <RnrView
              {...testIdProps(deriveTestId(testID, 'surface-frame', surface.key))}
              className={baseTokens.adminSurfaceMapFrame}
              style={{
                width: '100%',
                ...(direction === 'row'
                  ? {
                      maxWidth: adminGeometry.surfaceRectLaptop.maxWidth,
                      alignSelf: 'center' as const,
                    }
                  : {}),
              }}
            >
              <RnrView
                {...testIdProps(deriveTestId(testID, 'surface', surface.key))}
                accessibilityRole="none"
                className={surface.current ? baseTokens.adminSurfaceMapRectCurrent : baseTokens.adminSurfaceMapRect}
                style={{
                  ...(compact ? adminGeometry.surfaceRectMobile : adminGeometry.surfaceRectLaptop),
                  width: '100%',
                  ...(direction === 'row'
                    ? {
                        maxWidth: adminGeometry.surfaceRectLaptop.maxWidth,
                        height: adminGeometry.surfaceRectLaptop.maxWidth / surface.aspectRatio,
                        alignSelf: 'center' as const,
                      }
                    : {}),
                  aspectRatio: surface.aspectRatio,
                }}
              >
                {surface.logicWidthLabel === undefined ? null : (
                  <RnrText
                    {...testIdProps(deriveTestId(testID, 'surface-logic-width', surface.key))}
                    className={baseTokens.adminSurfaceMapLogicWidth}
                  >
                    {surface.logicWidthLabel}
                  </RnrText>
                )}
                {surface.logicHeightLabel === undefined ? null : (
                  <RnrText
                    {...testIdProps(deriveTestId(testID, 'surface-logic-height', surface.key))}
                    className={baseTokens.adminSurfaceMapLogicHeight}
                  >
                    {surface.logicHeightLabel}
                  </RnrText>
                )}
                {surface.present ? (
                  surface.insideLabels.map((label, index) => (
                    <RnrText
                      key={`${surface.key}:inside:${index}`}
                      {...testIdProps(deriveTestId(testID, 'surface-inside', `${surface.key}:${index}`))}
                      className={baseTokens.adminSurfaceMapInside}
                    >
                      {label}
                    </RnrText>
                  ))
                ) : (
                  <RnrText
                    {...testIdProps(deriveTestId(testID, 'surface-absent', surface.key))}
                    className={baseTokens.adminSurfaceMapInside}
                  >
                    未检测到
                  </RnrText>
                )}
                {surface.statusLabel === undefined ? null : (
                  <RnrText
                    {...testIdProps(deriveTestId(testID, 'surface-status', surface.key))}
                    className={toneForegroundClassName(
                      surface.statusTone ?? 'neutral',
                      baseTokens.adminSurfaceMapStatus,
                    )}
                  >
                    {surface.statusLabel}
                  </RnrText>
                )}
              </RnrView>
              {surface.physicalHeightLabel === undefined ? null : (
                <RnrText
                  {...testIdProps(deriveTestId(testID, 'surface-outside', `${surface.key}:1`))}
                  className={baseTokens.adminSurfaceMapPhysicalHeight}
                >
                  {surface.physicalHeightLabel}
                </RnrText>
              )}
            </RnrView>
            {surface.physicalWidthLabel !== undefined
              ? null
              : surface.outsideLabels.map((label, index) => (
                  <RnrText
                    key={`${surface.key}:outside:${index}`}
                    {...testIdProps(deriveTestId(testID, 'surface-outside', `${surface.key}:${index}`))}
                    className={baseTokens.adminSurfaceMapOutside}
                  >
                    {label}
                  </RnrText>
                ))}
          </RnrView>
        </RnrView>
      ))}
    </RnrView>
  );
};
