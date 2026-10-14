import {useContext} from 'react';
import {InputControllerContext} from '../contexts/context';
import type {InputController} from '../types/types';

export const useInputController = (): InputController => {
  const controller = useContext(InputControllerContext);
  if (controller === null) throw new Error('[ui-base-input] InputProvider is required');
  return controller;
};
