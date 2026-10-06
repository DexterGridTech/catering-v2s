import {waitForSelector} from '../src/selectorObservation.js';
import type {JourneyDisplay} from '../src/journeyUiPort.js';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import type {AutomationDriverServer} from '../src/server.js';
import {clickObservedJourneyCommand} from './journeyActions.js';
import type {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

type JourneyDiagnostics = ReturnType<typeof createJourneyFailureDiagnostics>;

type SampleStaffLoginPort = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly diagnostics?: JourneyDiagnostics;
  readonly click: (testID: string, display: JourneyDisplay) => Promise<void>;
  readonly enterTextAndComplete: (testID: string, value: string, display: JourneyDisplay) => Promise<void>;
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
): Promise<void> => {
  const display: JourneyDisplay = Object.freeze({mode: 'PRIMARY', index: 0});
  await waitForSelector(
    port.server,
    port.sessionId,
    'kernel.base.ui-state.selectScreen',
    [display.mode, 'main'],
    value => isRecord(value) && value.partKey === 'sample.auth.login',
  );
  await port.enterTextAndComplete(mainSampleTestIds.staffOperatorName, input.operatorName, display);
  await port.enterTextAndComplete(mainSampleTestIds.staffPasscode, input.passcode, display);
  await clickObservedJourneyCommand(port, {
    commandName: 'kernel.feature.sample-staff-session.login',
    testID: mainSampleTestIds.staffLoginSubmit,
    display,
  });

  const qualification = await waitForSelector(
    port.server,
    port.sessionId,
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
    port.server,
    port.sessionId,
    'kernel.base.ui-state.selectScreen',
    [display.mode, 'main'],
    value => isRecord(value) && value.partKey === input.expectedScreen,
  );
};
