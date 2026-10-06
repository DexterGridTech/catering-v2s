import {StyleSheet, Text, View} from 'react-native';
import {pairReadinessInterlockTestIds} from '../foundations/integrationAssemblyTestIds';

export const PairReadinessInterlock = () => (
  <View
    testID={pairReadinessInterlockTestIds.status}
    pointerEvents="auto"
    accessible
    importantForAccessibility="yes"
    style={styles.root}
  >
    <Text testID={pairReadinessInterlockTestIds.message} accessibilityRole="alert" style={styles.message}>
      配对连接中，请稍后
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  message: {
    color: '#334155',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
});
