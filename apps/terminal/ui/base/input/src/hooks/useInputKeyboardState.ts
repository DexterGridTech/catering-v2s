import {useContext} from 'react';
import {InputKeyboardStateContext} from '../contexts/context';
import type {InputKeyboardState} from '../types/types';

export const useInputKeyboardState = (): InputKeyboardState => {
  const state = useContext(InputKeyboardStateContext);
  if (state === null) throw new Error('[ui-base-input] InputProvider is required');
  return state;
};
