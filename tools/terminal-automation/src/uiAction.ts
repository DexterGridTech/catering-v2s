import {requests} from './requests.js';
import type {AutomationDriverServer} from './server.js';

export type ObservedUiCommand = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly workspace: 'MAIN' | 'BRANCH';
  readonly displayMode: 'PRIMARY' | 'SECONDARY';
  readonly commandName: string;
  readonly action: () => Promise<void>;
  readonly timeoutMs?: number;
  readonly onRequestIdentified?: (requestId: string) => void;
  readonly onRequestFinished?: (requestId: string) => void;
  readonly onObserverStep?: (step: string) => void;
}>;

export const dispatchObservedUiCommand = async (input: ObservedUiCommand): Promise<void> => {
  const observed = await requests.observeUiAction(input);
  if (observed.view.status !== 'completed' || observed.requestId.length === 0) {
    throw new Error('TERMINAL_AUTOMATION_UI_ACTION_REQUEST_NOT_COMPLETED');
  }
};
