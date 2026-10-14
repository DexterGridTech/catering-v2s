import {useContext} from 'react';
import {InputFieldKeyboardStateContext} from '../contexts/context';
import type {InputFieldKeyboardState} from '../types/types';

export const useInputFieldKeyboardState = (): InputFieldKeyboardState => {
  const state = useContext(InputFieldKeyboardStateContext);
  if (state === null) throw new Error('[ui-base-input] InputProvider is required');
  return state;
};
