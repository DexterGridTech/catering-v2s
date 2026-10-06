import type {AutomationDriverServer} from '../src/server.js';
import {dispatchObservedUiCommand} from '../src/uiAction.js';
import {readSelector, waitForSelector} from '../src/selectorObservation.js';
import type {JourneyDisplay} from '../src/journeyUiPort.js';
import type {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

type JourneyDiagnostics = ReturnType<typeof createJourneyFailureDiagnostics>;

export type JourneyActionPort = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly click: (testID: string, display: JourneyDisplay) => Promise<void>;
  readonly diagnostics?: JourneyDiagnostics;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Waits for the business screen projection and confirms it with an exact readback. */
export const waitForJourneyScreen = async (
  server: AutomationDriverServer,
  sessionId: string,
  display: JourneyDisplay,
  expectedPartKey: string,
): Promise<void> => {
  await waitForSelector(
    server,
    sessionId,
    'kernel.base.ui-state.selectScreen',
    [display.mode, 'main'],
    value => isRecord(value) && value.partKey === expectedPartKey,
  );
  const current = await readSelector(server, sessionId, 'kernel.base.ui-state.selectScreen', [display.mode, 'main']);
  if (!isRecord(current) || current.partKey !== expectedPartKey) {
    throw new Error('TERMINAL_AUTOMATION_SCREEN_READBACK_MISMATCH');
  }
};

/** Correlates a real UI action with its Runtime command outcome. */
export const dispatchObservedJourneyCommand = async (
  port: JourneyActionPort,
  input: Readonly<{
    readonly commandName: string;
    readonly display: JourneyDisplay;
    readonly action: () => Promise<void>;
  }>,
): Promise<void> => {
  await dispatchObservedUiCommand({
    server: port.server,
    sessionId: port.sessionId,
    workspace: 'MAIN',
    displayMode: input.display.mode,
    commandName: input.commandName,
    action: input.action,
    timeoutMs: 30_000,
    onRequestIdentified: port.diagnostics?.requestStarted,
    onRequestFinished: port.diagnostics?.requestFinished,
  });
};

/** Combines a registered-node click with the Runtime command it must produce. */
export const clickObservedJourneyCommand = async (
  port: JourneyActionPort,
  input: Readonly<{
    readonly commandName: string;
    readonly testID: string;
    readonly display: JourneyDisplay;
  }>,
): Promise<void> =>
  dispatchObservedJourneyCommand(port, {
    commandName: input.commandName,
    display: input.display,
    action: async () => {
      port.diagnostics?.markStep(input.commandName);
      await port.click(input.testID, input.display);
    },
  });
