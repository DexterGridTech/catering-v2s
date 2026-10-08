import {createVirtualKeyboardInput} from './virtualKeyboardInput.js';
import type {TerminalInputDisplay} from './virtualKeyboardInput.js';
import {clickRegisteredWebNode, focusRegisteredWebInput} from './webInput.js';
import type {AutomationDriverServer} from './server.js';
import type {Page} from 'playwright';
import type {AndroidAutomationConnection} from './androidAutomationConnection.js';
import type {AndroidSystemUiButton} from './androidSystemUi.js';
import {testExpoHostPrefix} from './journeySurface.js';

export type JourneyDisplay = TerminalInputDisplay;
export type PrimaryJourneyDisplay = Readonly<{readonly mode: 'PRIMARY'; readonly index: 0}>;

const webSurface = (display: JourneyDisplay): 'PRIMARY' | 'SECONDARY' => display.mode;
const safeFieldStepId = (testID: string, index: number): string =>
  /^[A-Za-z0-9._:-]{1,140}$/u.test(testID) ? testID : `field-${index + 1}`;

/** Joins device-specific focus/click wiring with the shared field-entry sequence. */
export const createJourneyUiPort = <TDisplay extends TerminalInputDisplay>(
  input: Readonly<{
    readonly click: (testID: string, display: TDisplay) => Promise<void>;
    readonly focusInput: (testID: string, display: TDisplay) => Promise<void>;
    readonly onStep?: (step: string) => void;
  }>,
) => {
  const keyboard = createVirtualKeyboardInput(input);
  return Object.freeze({
    click: async (testID: string, display: TDisplay): Promise<void> => {
      input.onStep?.(`ui.click:${testID}`);
      await input.click(testID, display);
    },
    enterText: async (testID: string, value: string, display: TDisplay): Promise<void> => {
      input.onStep?.(`ui.input:${testID}`);
      await keyboard.enterText(testID, value, display);
    },
    enterTextAndComplete: async (testID: string, value: string, display: TDisplay): Promise<void> => {
      input.onStep?.(`ui.input:${testID}`);
      await keyboard.enterTextAndComplete(testID, value, display);
    },
    enterFormValues: async (
      fields: readonly Readonly<{readonly testID: string; readonly value: string}>[],
      display: TDisplay,
    ): Promise<void> => {
      await keyboard.enterFormValues(fields, display, (testID, index) => {
        input.onStep?.(`ui.input:${safeFieldStepId(testID, index)}`);
      });
    },
    completeInput: async (display: TDisplay): Promise<void> => {
      input.onStep?.('ui.input.complete');
      await keyboard.completeInput(display);
    },
    completeInputSteps: async (count: number, display: TDisplay): Promise<void> => {
      input.onStep?.(`ui.input.complete-steps:${count}`);
      await keyboard.completeInputSteps(count, display);
    },
  });
};

/** Owns the Web registered-node bridge; the journey only names a control and display. */
export const createWebJourneyUiPort = (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly page: Page;
    readonly onStep?: (step: string) => void;
  }>,
) => {
  const surfaceRoot = (display: JourneyDisplay) =>
    input.page.getByTestId(`${testExpoHostPrefix}:surface:${webSurface(display)}`);
  return createJourneyUiPort({
    click: async (testID, display) => {
      await clickRegisteredWebNode({
        server: input.server,
        sessionId: input.sessionId,
        surfaceRoot: surfaceRoot(display),
        testID,
        surface: webSurface(display),
        displayIndex: display.index,
      });
    },
    focusInput: async (testID, display) => {
      await focusRegisteredWebInput({
        server: input.server,
        sessionId: input.sessionId,
        surfaceRoot: surfaceRoot(display),
        testID,
        surface: webSurface(display),
        displayIndex: display.index,
      });
    },
    onStep: input.onStep,
  });
};

/** Owns Android surface naming and registered tap wiring; journeys stay platform-neutral. */
export const createAndroidJourneyUiPort = (
  input: Readonly<{
    readonly connection: AndroidAutomationConnection;
    readonly sessionId: string;
    readonly onStep?: (step: string) => void;
  }>,
) => {
  const appUi = createJourneyUiPort({
    click: async (testID, display) => {
      await input.connection.tapRegisteredNode({
        sessionId: input.sessionId,
        testID,
        surface: display.mode === 'PRIMARY' ? 'primary' : 'secondary',
        displayIndex: display.index,
      });
    },
    focusInput: async (testID, display) => {
      await input.connection.tapRegisteredInput({
        sessionId: input.sessionId,
        testID,
        surface: display.mode === 'PRIMARY' ? 'primary' : 'secondary',
        displayIndex: display.index,
      });
    },
    onStep: input.onStep,
  });
  const systemStep = async <TValue,>(name: string, action: () => Promise<TValue>): Promise<TValue> => {
    input.onStep?.(`ui.system.${name}`);
    try {
      const value = await action();
      input.onStep?.(`ui.system.${name}.complete`);
      return value;
    } catch (error) {
      input.onStep?.(`ui.system.${name}.failed`);
      throw error;
    }
  };
  return Object.freeze({
    ...appUi,
    /** Waits for Android-owned controls without confusing them with TER TestIds. */
    waitForSystemButton: (options: Parameters<AndroidAutomationConnection['systemUi']['clickButton']>[0]) =>
      systemStep('wait-button', () => input.connection.systemUi.waitForButton(
        options.labels,
        options.timeoutMs,
        options.signal,
        options.allowedPackagePrefixes,
        options.expectedContext,
      )),
    /** Runs a package/context-scoped native action through the same journey driver. */
    clickSystemButton: (options: Parameters<AndroidAutomationConnection['systemUi']['clickButton']>[0]): Promise<AndroidSystemUiButton> =>
      systemStep('click', () => input.connection.systemUi.clickButton(options)),
    /** Changes a native checkable control only when needed and returns the read-back state. */
    setSystemChecked: (...args: Parameters<AndroidAutomationConnection['systemUi']['setChecked']>) =>
      systemStep('set-checked', () => input.connection.systemUi.setChecked(...args)),
    /** Returns from a system-owned screen to the app or pending system flow. */
    pressSystemBack: (): Promise<void> => systemStep('back', () => input.connection.systemUi.pressBack()),
    readSystemScreenSummary: (): Promise<string> =>
      systemStep('screen-summary', () => input.connection.systemUi.readScreenSummary()),
  });
};

/** One journey handle for both Runtime-owned app controls and Android-owned UI. */
export type AndroidJourneyUiPort = ReturnType<typeof createAndroidJourneyUiPort>;
