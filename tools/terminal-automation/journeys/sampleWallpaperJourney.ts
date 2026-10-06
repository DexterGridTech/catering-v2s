import type {AutomationDriverServer} from '../src/server.js';
import {readSelector} from '../src/selectorObservation.js';
import {mainSampleTestIds} from '../src/mainSampleTestIds.js';
import type {JourneyDisplay} from '../src/journeyUiPort.js';
import {loginSampleStaff} from './sampleStaffLogin.js';
import {clickObservedJourneyCommand, waitForJourneyScreen} from './journeyActions.js';
import type {createJourneyFailureDiagnostics} from '../src/journeyFailureDiagnostics.js';

type JourneyDiagnostics = ReturnType<typeof createJourneyFailureDiagnostics>;

type Display = JourneyDisplay;
export type SampleWallpaperJourneyPort = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly diagnostics?: JourneyDiagnostics;
  readonly click: (testID: string, display: Display) => Promise<void>;
  readonly enterTextAndComplete: (testID: string, value: string, display: Display) => Promise<void>;
}>;

const fail = (code: string): never => {
  throw new Error(code);
};

const waitForScreen = (port: SampleWallpaperJourneyPort, expectedPartKey: string): Promise<void> =>
  waitForJourneyScreen(port.server, port.sessionId, {mode: 'PRIMARY', index: 0}, expectedPartKey);

export const runSampleWallpaperJourney = async (port: SampleWallpaperJourneyPort): Promise<void> => {
  const display: Display = {mode: 'PRIMARY', index: 0};
  await loginSampleStaff(port, {
    operatorName: 'A001',
    passcode: '1111',
    expectedScreen: 'sample.wallpaper.picker',
  });

  await clickObservedJourneyCommand(port, {
    commandName: 'ui.feature.sample-wallpaper-picker.wallpaper-option-selected',
    testID: mainSampleTestIds.wallpaperOptionW2,
    display,
  });
  const pending = await readSelector(port.server, port.sessionId, 'kernel.feature.sample-wallpaper.selectPendingWallpaperId', []);
  if (pending !== 'w2') fail('TERMINAL_AUTOMATION_WALLPAPER_PENDING_READBACK_MISMATCH');

  await clickObservedJourneyCommand(port, {
    commandName: 'ui.feature.sample-wallpaper-picker.wallpaper-confirm-requested',
    testID: mainSampleTestIds.wallpaperConfirm,
    display,
  });
  const confirmed = await readSelector(port.server, port.sessionId, 'kernel.feature.sample-wallpaper.selectWallpaperId', []);
  if (confirmed !== 'w2') fail('TERMINAL_AUTOMATION_WALLPAPER_CONFIRM_READBACK_MISMATCH');
  // Mobile has no wallpaper-home part; confirmation keeps the operator on the picker.
  await waitForScreen(port, 'sample.wallpaper.picker');
};
