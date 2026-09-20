import {RnrPressable, RnrText, RnrView} from '../vendor/slots';
import {cn} from '../vendor/cn';
import {assertTestID} from '../foundations/assertTestID';
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName';
import {adminGeometry, baseTokens} from '../theme/tokens';
import {PrimitiveIcon} from './PrimitiveIcon';
import type {PrimitiveDisclosureProps, PrimitiveFactGridProps, PrimitiveRatioBarProps, PrimitiveRatioSegment, PrimitiveStatusLineProps, PrimitiveSurfaceMapProps} from '../types/types';

const ratioIsValid = ({total, segments}: PrimitiveRatioBarProps): boolean => {
  if (!Number.isFinite(total) || total <= 0) return false;
  if (segments.some(segment => !Number.isFinite(segment.value) || segment.value < 0)) return false;
  const sum = segments.reduce((result, segment) => result + segment.value, 0);
  return Math.abs(sum - total) < 0.000001;
};

const ratioSegmentClassName = (tone: PrimitiveRatioSegment['tone']): string =>
  tone === 'neutral'
    ? cn('h-full', baseTokens.adminRatioSegmentUndeclared)
    : toneClassName(tone, 'h-full');

export const PrimitiveRatioBar = ({testID, accessibilityLabel, total, segments}: PrimitiveRatioBarProps) => {
  const address = assertTestID(testID);
  const valid = ratioIsValid({testID, accessibilityLabel, total, segments});
  return (
    <RnrView
      testID={address}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={valid ? {min: 0, max: total, now: total} : undefined}
      className={baseTokens.adminRatioBar}
    >
      {valid ? segments.map(segment => (
        <RnrView
          key={segment.key}
          testID={`${address}:segment:${segment.key}`}
          accessibilityLabel={segment.label}
          className={ratioSegmentClassName(segment.tone)}
          style={{width: `${(segment.value / total) * 100}%`}}
        />
      )) : (
        <RnrText testID={`${address}:invalid`} className={toneForegroundClassName('warn', baseTokens.status)}>
          比例数据不可用
        </RnrText>
      )}
    </RnrView>
  );
};

export const PrimitiveStatusLine = ({testID, accessibilityLabel, tone = 'neutral', children}: PrimitiveStatusLineProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    className={baseTokens.adminStatusLine}
  >
    <RnrView testID={`${assertTestID(testID)}:dot`} className={toneClassName(tone, baseTokens.adminStatusLineDot)} />
    <RnrText className={toneForegroundClassName(tone, baseTokens.adminStatusLine)}>{children}</RnrText>
  </RnrView>
);

export const PrimitiveFactGrid = ({testID, items, columns = 3}: PrimitiveFactGridProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.adminFactGrid}>
    {items.map(item => (
      <RnrView key={item.key} testID={item.testID ?? `${assertTestID(testID)}:item:${item.key}`} className={baseTokens.adminFact} style={{flexBasis: `${100 / columns - 2}%`}}>
        <RnrText className={baseTokens.adminFactLabel}>{item.label}</RnrText>
        <RnrText className={toneForegroundClassName(item.tone ?? 'neutral', baseTokens.adminFactValue)}>{item.value}</RnrText>
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
    <RnrView testID={address} className={baseTokens.adminDisclosure}>
      <RnrPressable
        testID={triggerTestID ?? `${address}:trigger`}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{expanded}}
        className={baseTokens.adminDisclosureTrigger}
        onPress={() => onExpandedChange?.(!expanded)}
      >
        <RnrText className={baseTokens.adminDisclosureLabel}>{label}</RnrText>
        {status === undefined ? null : <RnrText testID={statusTestID} className={baseTokens.adminDisclosureSummary}>{status}</RnrText>}
        {summary === undefined ? null : <RnrText testID={summaryTestID} className={baseTokens.adminDisclosureSummary}>{summary}</RnrText>}
        <PrimitiveIcon
          testID={`${address}:icon`}
          accessibilityLabel={expanded ? '收起' : '展开'}
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
        />
      </RnrPressable>
      {expanded ? <RnrView testID={`${address}:content`} className={baseTokens.adminDisclosureContent}>{children}</RnrView> : null}
    </RnrView>
  );
};

export const PrimitiveSurfaceMap = ({testID, accessibilityLabel, surfaces, direction = 'row', compact = false}: PrimitiveSurfaceMapProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView
      testID={address}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel}
      className={direction === 'row' ? baseTokens.adminSurfaceMapRow : baseTokens.adminSurfaceMapColumn}
    >
      {surfaces.map(surface => (
        <RnrView
          key={surface.key}
          testID={`${address}:surface:${surface.key}:card`}
          accessibilityLabel={surface.label}
          className={direction === 'row'
            ? surface.current ? baseTokens.adminSurfaceMapCardCurrent : baseTokens.adminSurfaceMapCard
            : surface.current ? baseTokens.adminSurfaceMapCardCurrentColumn : baseTokens.adminSurfaceMapCardColumn}
        >
          <RnrText testID={`${address}:surface:${surface.key}:label`} className={baseTokens.adminSurfaceMapLabel}>{surface.label}</RnrText>
          <RnrText testID={`${address}:surface:${surface.key}:role`} className={baseTokens.adminSurfaceMapRole}>{surface.roleLabel}</RnrText>
          <RnrView testID={`${address}:surface:${surface.key}:wrap`} className={baseTokens.adminSurfaceMapWrap}>
            {surface.current ? (
              <>
                {surface.physicalWidthLabel === undefined ? null : <RnrText testID={`${address}:surface:${surface.key}:outside:0`} className={baseTokens.adminSurfaceMapPhysicalWidth}>{surface.physicalWidthLabel}</RnrText>}
                {surface.logicWidthLabel === undefined ? null : <RnrText testID={`${address}:surface:${surface.key}:logic-width`} className={baseTokens.adminSurfaceMapLogicWidth}>{surface.logicWidthLabel}</RnrText>}
                <RnrView
                  testID={`${address}:surface:${surface.key}`}
                  accessibilityRole="none"
                  className={baseTokens.adminSurfaceMapRectCurrent}
                  style={{...(compact ? adminGeometry.surfaceRectMobile : adminGeometry.surfaceRectLaptop), aspectRatio: surface.aspectRatio}}
                >
                  {surface.logicHeightLabel === undefined ? null : <RnrText testID={`${address}:surface:${surface.key}:logic-height`} className={baseTokens.adminSurfaceMapLogicHeight}>{surface.logicHeightLabel}</RnrText>}
                  {surface.present ? surface.insideLabels.map((label, index) => (
                    <RnrText key={`${surface.key}:inside:${index}`} testID={`${address}:surface:${surface.key}:inside:${index}`} className={baseTokens.adminSurfaceMapInside}>
                      {label}
                    </RnrText>
                  )) : <RnrText testID={`${address}:surface:${surface.key}:absent`} className={baseTokens.adminSurfaceMapInside}>未检测到</RnrText>}
                  {surface.statusLabel === undefined ? null : (
                    <RnrText
                      testID={`${address}:surface:${surface.key}:status`}
                      className={toneForegroundClassName(surface.statusTone ?? 'neutral', baseTokens.adminSurfaceMapStatus)}
                    >
                      {surface.statusLabel}
                    </RnrText>
                  )}
                </RnrView>
                {surface.physicalHeightLabel === undefined ? null : <RnrText testID={`${address}:surface:${surface.key}:outside:1`} className={baseTokens.adminSurfaceMapPhysicalHeight}>{surface.physicalHeightLabel}</RnrText>}
                {surface.physicalWidthLabel !== undefined ? null : surface.outsideLabels.map((label, index) => (
                  <RnrText key={`${surface.key}:outside:${index}`} testID={`${address}:surface:${surface.key}:outside:${index}`} className={baseTokens.adminSurfaceMapOutside}>
                    {label}
                  </RnrText>
                ))}
              </>
            ) : (
              <RnrView testID={`${address}:surface:${surface.key}`} accessibilityRole="none" className={baseTokens.adminSurfaceMapLimited}>
                {surface.present ? surface.insideLabels.map((label, index) => (
                  <RnrText key={`${surface.key}:inside:${index}`} testID={`${address}:surface:${surface.key}:inside:${index}`} className={baseTokens.adminSurfaceMapOutside}>
                    {label}
                  </RnrText>
                )) : <RnrText testID={`${address}:surface:${surface.key}:absent`} className={baseTokens.adminSurfaceMapOutside}>未检测到</RnrText>}
              </RnrView>
            )}
          </RnrView>
        </RnrView>
      ))}
    </RnrView>
  );
};
