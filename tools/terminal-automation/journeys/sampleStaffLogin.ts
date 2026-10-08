import {waitForSelector} from '../src/selectorObservation.js';
import type {JourneyDisplay} from '../src/journeyUiPort.js';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import type {AutomationDriverServer} from '../src/server.js';
import {clickObservedJourneyCommand} from './journeyActions.js';
import type {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

type JourneyDiagnostics = ReturnType<typeof createJourneyFailureDiagnostics>;

export type SampleStaffLoginPort = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly diagnostics?: JourneyDiagnostics;
  readonly onRequestObserverStep?: (step: string) => void;
  readonly click: (testID: string, display: JourneyDisplay) => Promise<void>;
  readonly enterTextAndComplete: (testID: string, value: string, display: JourneyDisplay) => Promise<void>;
  /** Rebuilds session-bound controls after Android replaces the Runtime socket. */
  readonly refreshSession?: () => Promise<SampleStaffLoginPort>;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Shared real-input login used by both main sample application journeys. */
export const loginSampleStaff = async (
  port: SampleStaffLoginPort,
  input: Readonly<{
    readonly operatorName: string;
    readonly passcode: string;
    readonly expectedScreen: string;
  }>,
): Promise<SampleStaffLoginPort> => {
  const display: JourneyDisplay = Object.freeze({mode: 'PRIMARY', index: 0});
  let activePort = port;
  const refreshSession = async (): Promise<void> => {
    if (activePort.refreshSession !== undefined) activePort = await activePort.refreshSession();
  };
  await refreshSession();
  await waitForSelector(
    activePort.server,
    activePort.sessionId,
    'kernel.base.ui-state.selectScreen',
    [display.mode, 'main'],
    value => isRecord(value) && value.partKey === 'sample.auth.login',
  );
  await refreshSession();
  await activePort.enterTextAndComplete(mainSampleTestIds.staffOperatorName, input.operatorName, display);
  await refreshSession();
  await activePort.enterTextAndComplete(mainSampleTestIds.staffPasscode, input.passcode, display);
  await refreshSession();
  let retriedDisconnectedSession = false;
  while (true) {
    try {
      await clickObservedJourneyCommand(activePort, {
        commandName: 'kernel.feature.sample-staff-session.login',
        testID: mainSampleTestIds.staffLoginSubmit,
        display,
      });
      break;
    } catch (error) {
      if (
        retriedDisconnectedSession ||
        activePort.refreshSession === undefined ||
        !(error instanceof Error) ||
        error.message !== 'TERMINAL_AUTOMATION_SESSION_NOT_CONNECTED_BEFORE_ACTION'
      ) {
        throw error;
      }
      // The request observer failed before invoking the click, so rebinding
      // and retrying cannot submit the business command twice.
      retriedDisconnectedSession = true;
      await refreshSession();
    }
  }

  await refreshSession();
  const qualification = await waitForSelector(
    activePort.server,
    activePort.sessionId,
    'kernel.feature.sample-staff-session.selectHostStaffQualification',
    [],
    value => isRecord(value) && value.status === 'authenticated' && value.operatorName === input.operatorName,
  );
  if (
    !isRecord(qualification) ||
    qualification.status !== 'authenticated' ||
    qualification.operatorName !== input.operatorName
  ) {
    throw new Error('TERMINAL_AUTOMATION_STAFF_LOGIN_READBACK_MISMATCH');
  }
  await waitForSelector(
    activePort.server,
    activePort.sessionId,
    'kernel.base.ui-state.selectScreen',
    [display.mode, 'main'],
    value => isRecord(value) && value.partKey === input.expectedScreen,
  );
  return activePort;
};
