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
    boxShadow: '0px 8px 9px rgba(0, 0, 0, 0.28)',
    elevation: 8,
  },
});
