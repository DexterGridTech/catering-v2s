import {StyleSheet} from 'react-native';
import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveKeyboardSurfaceProps} from '../types/types';

const interactionPropsOf = (
  onTouchEnd: PrimitiveKeyboardSurfaceProps['onTouchEnd'],
  onClick: PrimitiveKeyboardSurfaceProps['onClick'],
): Readonly<Record<string, unknown>> => typeof document === 'undefined'
  ? {onTouchEnd}
  : {onClick};

export const PrimitiveKeyboardSurface = ({
  testID,
  children,
  style,
  onTouchEnd,
  onClick,
}: PrimitiveKeyboardSurfaceProps) => (
  <RnrView
    testID={assertTestID(testID)}
    className={baseTokens.keyboardDock}
    style={[styles.shadow, StyleSheet.flatten(style)]}
    {...interactionPropsOf(onTouchEnd, onClick)}
  >
    {children}
  </RnrView>
);

const styles = StyleSheet.create({
  shadow: {
    shadowColor: 'black',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 9,
    elevation: 8,
  },
});
