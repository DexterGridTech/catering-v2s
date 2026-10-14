import {Pressable, Text, View} from 'react-native';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import {styles} from './testExpoAppStyles';

export type SurfaceRadioOptionProps = Readonly<{
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly optionTestID: TestId;
}>;


export const SurfaceRadioOption = ({label, selected, onPress, optionTestID}: SurfaceRadioOptionProps) => (
  <Pressable
    testID={optionTestID}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{selected}}
    aria-checked={selected}
    onPress={onPress}
    style={({pressed}) => [
      styles.surfaceRadioOption,
      selected && styles.surfaceRadioOptionSelected,
      pressed && styles.surfaceRadioOptionPressed,
    ]}
  >
    <View style={[styles.surfaceRadioCircle, selected && styles.surfaceRadioCircleSelected]}>
      {selected ? <View style={styles.surfaceRadioDot} /> : null}
    </View>
    <Text style={[styles.surfaceRadioText, selected && styles.surfaceRadioTextSelected]}>{label}</Text>
  </Pressable>
);

