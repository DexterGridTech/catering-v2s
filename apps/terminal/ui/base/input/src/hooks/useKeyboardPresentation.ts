import {useCallback, useLayoutEffect, useRef, useState} from 'react';
import {Animated} from 'react-native';

/** Owns the one animation clock and serial used by a surface keyboard presentation. */
export const useKeyboardPresentation = () => {
  const [progress] = useState(() => new Animated.Value(0));
  const animationRef = useRef<ReturnType<typeof Animated.timing> | null>(null);
  const serialRef = useRef(0);
  const nextSerial = useCallback((): number => {
    serialRef.current += 1;
    return serialRef.current;
  }, []);

  useLayoutEffect(
    () => () => {
      animationRef.current?.stop();
      progress.stopAnimation();
    },
    [progress],
  );

  return {progress, animationRef, nextSerial};
};
