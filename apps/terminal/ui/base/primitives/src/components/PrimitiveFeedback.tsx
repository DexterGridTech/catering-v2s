import {RnrActivityIndicator, RnrView, RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName';
import type {
  PrimitiveBadgeProps,
  PrimitiveFeedbackProps,
  PrimitiveProgressProps,
} from '../types/types';

export const PrimitiveSpinner = ({testID, accessibilityLabel = '正在加载'}: PrimitiveFeedbackProps) => (
  <RnrActivityIndicator
    testID={assertTestID(testID)}
    accessibilityRole="progressbar"
    accessibilityLabel={accessibilityLabel}
  />
);

export const PrimitiveInlineAlert = ({
  testID,
  accessibilityLabel,
  children,
  tone = 'error',
}: PrimitiveFeedbackProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole="alert"
    accessibilityLabel={accessibilityLabel}
    className={toneClassName(tone, 'w-full rounded-md border px-3 py-3')}
  >
    <RnrText className={toneForegroundClassName(tone, baseTokens.text)}>{children}</RnrText>
  </RnrView>
);

export const PrimitiveEmptyState = ({
  testID,
  accessibilityLabel,
  children,
  tone = 'neutral',
}: PrimitiveFeedbackProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole="text"
    accessibilityLabel={accessibilityLabel}
    className={toneClassName(tone, 'w-full items-center justify-center gap-3 rounded-md border px-4 py-6')}
  >
    <RnrText className={toneForegroundClassName(tone, baseTokens.text)}>{children}</RnrText>
  </RnrView>
);

export const PrimitiveProgress = ({testID, accessibilityLabel, value}: PrimitiveProgressProps) => {
  const boundedValue = Math.max(0, Math.min(1, value));
  return (
    <RnrView
      testID={assertTestID(testID)}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{min: 0, max: 1, now: boundedValue}}
      className="w-full h-3 overflow-hidden rounded-full bg-surface"
    >
      <RnrView
        testID={`${assertTestID(testID)}:value`}
        className="h-full bg-action"
        style={{width: `${boundedValue * 100}%`}}
      />
    </RnrView>
  );
};

export const PrimitiveSkeleton = ({testID, accessibilityLabel = '内容加载中'}: PrimitiveFeedbackProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole="progressbar"
    accessibilityLabel={accessibilityLabel}
    className="w-full h-6 rounded-md bg-surface"
  />
);

export const PrimitiveBadge = ({testID, accessibilityLabel, children, appearance = 'default', tone = 'neutral'}: PrimitiveBadgeProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole="text"
    accessibilityLabel={accessibilityLabel}
    className={toneClassName(tone, appearance === 'admin-status' ? baseTokens.adminStatus : 'self-start rounded-full border px-2 py-1')}
  >
    {appearance === 'admin-status' ? <RnrView className={toneClassName(tone, baseTokens.adminStatusDot)} /> : null}
    <RnrText className={toneForegroundClassName(tone, appearance === 'admin-status' ? 'text-xs leading-[18px] font-semibold' : 'text-xs leading-4 font-medium')}>{children}</RnrText>
  </RnrView>
);
