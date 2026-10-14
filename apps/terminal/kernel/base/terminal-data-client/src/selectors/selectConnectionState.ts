import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {TerminalConnectionView} from '../types/client';
import {readTerminalDataClientState} from './readTerminalDataClientState';

const selectConnectionStateImplementation = (state: StateRoot): TerminalConnectionView =>
  readTerminalDataClientState(state).connection;

export const selectConnectionState = defineStateSelector(moduleName, 'selectConnectionState', {
  parameters: [],
  selector: selectConnectionStateImplementation,
});
