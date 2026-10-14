import {Text, View} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import type {SurfaceForm} from '../types/testExpoApp';
import {styles} from './testExpoAppStyles';
import {SurfaceRadioOption} from './SurfaceRadioOption';

type SurfaceFormSwitcherProps = Readonly<{
  readonly surfaceForm: SurfaceForm;
  readonly supportsMobile: boolean;
  readonly onSelect: (surfaceForm: SurfaceForm) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

export const SurfaceFormSwitcher = ({surfaceForm, supportsMobile, onSelect, makeTestId}: SurfaceFormSwitcherProps) => (
  <View style={styles.surfaceRadioGroup} testID={makeTestId('surface-form-switcher')} accessibilityLabel="终端视角">
    <Text style={styles.surfaceRadioGroupLabel}>视角</Text>
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-form', 'laptop')}
      label="laptop 视角"
      selected={surfaceForm === 'laptop'}
      onPress={() => onSelect('laptop')}
    />
    {supportsMobile ? (
      <SurfaceRadioOption
        optionTestID={makeTestId('surface-form', 'mobile')}
        label="mobile 视角"
        selected={surfaceForm === 'mobile'}
        onPress={() => onSelect('mobile')}
      />
    ) : null}
  </View>
);

