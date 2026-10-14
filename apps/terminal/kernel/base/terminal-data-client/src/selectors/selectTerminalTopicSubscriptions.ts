import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {TerminalTopicSubscription} from '../types/client';
import {readTerminalDataClientState} from './readTerminalDataClientState';

const selectTerminalTopicSubscriptionsImplementation = (state: StateRoot): readonly TerminalTopicSubscription[] =>
  Object.freeze(Object.values(readTerminalDataClientState(state).topicSubscriptions));

export const selectTerminalTopicSubscriptions = defineStateSelector(moduleName, 'selectTerminalTopicSubscriptions', {
  parameters: [],
  selector: selectTerminalTopicSubscriptionsImplementation,
});
