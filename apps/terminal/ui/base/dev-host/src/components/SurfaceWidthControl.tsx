import {type ComponentProps} from 'react';
import {Pressable, Text, View, type GestureResponderEvent} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import {DEFAULT_SURFACE_WIDTH_PERCENT, SURFACE_WIDTH_MAX_PERCENT, SURFACE_WIDTH_MIN_PERCENT, SURFACE_WIDTH_SLIDER_TRACK_WIDTH, SURFACE_WIDTH_STEP_PERCENT, styles} from './testExpoAppStyles';

const clampSurfaceWidthPercent = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_SURFACE_WIDTH_PERCENT;
  return Math.min(SURFACE_WIDTH_MAX_PERCENT, Math.max(SURFACE_WIDTH_MIN_PERCENT, Math.round(value)));
};

type SurfaceWidthControlProps = Readonly<{
  readonly surfaceWidthPercent: number;
  readonly onChange: (value: number) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

type SurfaceWidthKeyDownEvent = Readonly<{
  readonly nativeEvent: Readonly<{readonly key: string}>;
  readonly preventDefault: () => void;
}>;

const surfaceWidthPercentFromLocation = (locationX: number): number =>
  clampSurfaceWidthPercent(
    SURFACE_WIDTH_MIN_PERCENT +
      (locationX / SURFACE_WIDTH_SLIDER_TRACK_WIDTH) * (SURFACE_WIDTH_MAX_PERCENT - SURFACE_WIDTH_MIN_PERCENT),
  );

const SurfaceWidthSlider = ({surfaceWidthPercent, onChange, makeTestId}: SurfaceWidthControlProps) => {
  const handleLocation = (event: GestureResponderEvent): void => {
    const locationX = event.nativeEvent.locationX;
    if (Number.isFinite(locationX)) onChange(surfaceWidthPercentFromLocation(locationX));
  };
  const handleKeyDown = (event: SurfaceWidthKeyDownEvent): void => {
    const key = event.nativeEvent.key;
    const delta =
      key === 'ArrowLeft' || key === 'ArrowDown'
        ? -SURFACE_WIDTH_STEP_PERCENT
        : key === 'ArrowRight' || key === 'ArrowUp'
          ? SURFACE_WIDTH_STEP_PERCENT
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    onChange(clampSurfaceWidthPercent(surfaceWidthPercent + delta));
  };
  const fillPercent =
    ((surfaceWidthPercent - SURFACE_WIDTH_MIN_PERCENT) / (SURFACE_WIDTH_MAX_PERCENT - SURFACE_WIDTH_MIN_PERCENT)) * 100;
  const pressableProps: ComponentProps<typeof Pressable> &
    Readonly<{
      readonly onKeyDown: (event: SurfaceWidthKeyDownEvent) => void;
    }> = {
    accessibilityLabel: 'surface 宽度比例',
    accessibilityRole: 'adjustable',
    accessibilityValue: {
      min: SURFACE_WIDTH_MIN_PERCENT,
      max: SURFACE_WIDTH_MAX_PERCENT,
      now: surfaceWidthPercent,
      text: `${surfaceWidthPercent}%`,
    },
    onKeyDown: handleKeyDown,
    onPressIn: handleLocation,
    onPressMove: handleLocation,
    style: styles.surfaceWidthSlider,
    testID: makeTestId('surface-width-slider'),
  };
  return (
    <Pressable {...pressableProps}>
      <View style={styles.surfaceWidthSliderTrack}>
        <View style={[styles.surfaceWidthSliderFill, {width: `${fillPercent}%`}]} />
        <View style={[styles.surfaceWidthSliderThumb, {left: `${fillPercent}%`}]} />
      </View>
    </Pressable>
  );
};

export const SurfaceWidthControl = ({surfaceWidthPercent, onChange, makeTestId}: SurfaceWidthControlProps) => (
  <View
    style={styles.surfaceWidthControl}
    testID={makeTestId('surface-width-control')}
    accessibilityLabel="surface 宽度"
  >
    <Text style={styles.surfaceWidthControlLabel}>surface 宽度</Text>
    <SurfaceWidthSlider surfaceWidthPercent={surfaceWidthPercent} onChange={onChange} makeTestId={makeTestId} />
    <Text style={styles.surfaceWidthControlValue} testID={makeTestId('surface-width-value')}>
      {surfaceWidthPercent}%
    </Text>
  </View>
);

