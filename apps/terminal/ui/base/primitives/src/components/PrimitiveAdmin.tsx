import {RnrPressable, RnrText, RnrView} from '../vendor/slots';
import {assertTestID} from '../foundations/assertTestID';
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName';
import {baseTokens} from '../theme/tokens';
import {PrimitiveIcon} from './PrimitiveIcon';
import type {PrimitiveDisclosureProps, PrimitiveRatioBarProps, PrimitiveSurfaceMapProps} from '../types/types';

const ratioIsValid = ({total, segments}: PrimitiveRatioBarProps): boolean => {
  if (!Number.isFinite(total) || total <= 0) return false;
  if (segments.some(segment => !Number.isFinite(segment.value) || segment.value < 0)) return false;
  const sum = segments.reduce((result, segment) => result + segment.value, 0);
  return Math.abs(sum - total) < 0.000001;
};

export const PrimitiveRatioBar = ({testID, accessibilityLabel, total, segments}: PrimitiveRatioBarProps) => {
  const address = assertTestID(testID);
  const valid = ratioIsValid({testID, accessibilityLabel, total, segments});
  return (
    <RnrView
      testID={address}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={valid ? {min: 0, max: total, now: total} : undefined}
      className={baseTokens.ratioBar}
    >
      {valid ? segments.map(segment => (
        <RnrView
          key={segment.key}
          testID={`${address}:segment:${segment.key}`}
          accessibilityLabel={segment.label}
          className={toneClassName(segment.tone, 'h-full')}
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

export const PrimitiveDisclosure = ({
  testID,
  accessibilityLabel,
  label,
  summary,
  expanded,
  onExpandedChange,
  children,
}: PrimitiveDisclosureProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView testID={address} className={baseTokens.disclosure}>
      <RnrPressable
        testID={`${address}:trigger`}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{expanded}}
        onPress={() => onExpandedChange?.(!expanded)}
      >
        <RnrText className={baseTokens.disclosureLabel}>{label}</RnrText>
        {summary === undefined ? null : <RnrText className={baseTokens.disclosureSummary}>{summary}</RnrText>}
        <PrimitiveIcon
          testID={`${address}:icon`}
          accessibilityLabel={expanded ? '收起' : '展开'}
          icon={expanded ? 'chevron-down' : 'chevron-right'}
          size={18}
        />
      </RnrPressable>
      {expanded ? <RnrView testID={`${address}:content`} className={baseTokens.disclosureContent}>{children}</RnrView> : null}
    </RnrView>
  );
};

export const PrimitiveSurfaceMap = ({testID, accessibilityLabel, surfaces, direction = 'row'}: PrimitiveSurfaceMapProps) => {
  const address = assertTestID(testID);
  return (
    <RnrView
      testID={address}
      accessibilityRole="none"
      accessibilityLabel={accessibilityLabel}
      className={direction === 'row' ? baseTokens.surfaceMapRow : baseTokens.surfaceMapColumn}
    >
      {surfaces.map(surface => (
        <RnrView
          key={surface.key}
          testID={`${address}:surface:${surface.key}`}
          accessibilityLabel={surface.label}
          className={surface.current ? baseTokens.surfaceMapCurrent : baseTokens.surfaceMapNonCurrent}
          style={{aspectRatio: surface.aspectRatio}}
        >
          <RnrText testID={`${address}:surface:${surface.key}:label`} className={baseTokens.surfaceMapLabel}>{surface.label}</RnrText>
          <RnrText testID={`${address}:surface:${surface.key}:role`} className={baseTokens.surfaceMapRole}>{surface.roleLabel}</RnrText>
          {surface.present ? surface.insideLabels.map((label, index) => (
            <RnrText key={`${surface.key}:inside:${index}`} testID={`${address}:surface:${surface.key}:inside:${index}`} className={baseTokens.surfaceMapInside}>
              {label}
            </RnrText>
          )) : <RnrText testID={`${address}:surface:${surface.key}:absent`} className={baseTokens.surfaceMapInside}>未检测到</RnrText>}
          {surface.statusLabel === undefined ? null : (
            <RnrText
              testID={`${address}:surface:${surface.key}:status`}
              className={toneForegroundClassName(surface.statusTone ?? 'neutral', baseTokens.surfaceMapStatus)}
            >
              {surface.statusLabel}
            </RnrText>
          )}
          {surface.outsideLabels.map((label, index) => (
            <RnrText key={`${surface.key}:outside:${index}`} testID={`${address}:surface:${surface.key}:outside:${index}`} className={baseTokens.surfaceMapOutside}>
              {label}
            </RnrText>
          ))}
        </RnrView>
      ))}
    </RnrView>
  );
};
