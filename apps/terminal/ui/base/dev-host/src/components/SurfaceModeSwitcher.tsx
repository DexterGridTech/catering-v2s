import {Text, View} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import type {SurfaceMode} from '../implementations/webPlatform';
import {styles} from './testExpoAppStyles';
import {SurfaceRadioOption} from './SurfaceRadioOption';

type SurfaceModeRadioProps = Readonly<{
  readonly surfaceMode: SurfaceMode;
  readonly onSelect: (surfaceMode: SurfaceMode) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

export const SurfaceModeSwitcher = ({surfaceMode, onSelect, makeTestId}: SurfaceModeRadioProps) => (
  <View style={styles.surfaceRadioGroup} testID={makeTestId('surface-toggle')} accessibilityLabel="屏幕模式">
    <Text style={styles.surfaceRadioGroupLabel}>屏幕</Text>
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-mode', 'single')}
      label="单屏模式"
      selected={surfaceMode === 'single'}
      onPress={() => onSelect('single')}
    />
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-mode', 'dual')}
      label="双屏模式"
      selected={surfaceMode === 'dual'}
      onPress={() => onSelect('dual')}
    />
  </View>
);

