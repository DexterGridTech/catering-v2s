export {createAndroidAdbClient, requireReadyAndroidDevice} from './androidAdb.js';
export {androidAutomationBuildIdentity, androidAutomationGradleArguments} from './androidBuild.js';
export {createAndroidDeviceSession, managedDevServiceReverses} from './androidDevice.js';
export type {AndroidDeviceSession, ManagedDevServiceUrls, ManagedServiceReverse} from './androidDevice.js';
export {createAndroidAutomationConnection} from './androidAutomationConnection.js';
export type {AndroidAutomationConnection} from './androidAutomationConnection.js';
export {buildAndroidTapArguments, createAndroidInput} from './androidInput.js';
export type {AndroidInput, AndroidSurface} from './androidInput.js';
export {tapRegisteredAndroidInput, tapRegisteredAndroidNode} from './androidRegisteredInput.js';
export {buildAndroidCaptureArguments, createAndroidDisplayCapture} from './androidCapture.js';
export type {AndroidDisplayCapture} from './androidCapture.js';
export {resolveDisplayMapping} from './displayMapping.js';
export type {AndroidDisplayMapping, AndroidDisplayShape, AndroidDisplayTarget} from './displayMapping.js';
export {androidTapPoint, mapAndroidLogicalBoundsToPhysical, resolveSurfaceWindow} from './androidWindow.js';
export type {
  AndroidLogicalBounds,
  AndroidPhysicalBounds,
  AndroidSurfaceWindow,
  AndroidTapPosition,
} from './androidWindow.js';
export {createManagedRun} from './managedRun.js';
export {createAutomationDriverServer} from './server.js';
export {createJourneyFailureDiagnostics} from './journeyFailureDiagnostics.js';
export {waitForAutomationSession} from './session.js';
export {readApplicationDeviceId} from './runtimeInfo.js';
export {createTerminalAutomationDriver} from './driver.js';
export type {TerminalAutomationDriver} from './driver.js';
export {
  mainSampleAppName,
  mainSampleSeedKey,
  parseMainSample,
  parseMainSampleJourneyConfig,
} from './mainSampleJourneyConfig.js';
export type {MainSample, MainSampleCase, MainSampleJourneyConfig, MainSampleShape} from './mainSampleJourneyConfig.js';
export {ensureMainSampleActivated} from './mainSampleActivation.js';
export {mainSampleTestIds} from './mainSampleTestIds.js';
export {clickRegisteredWebNode, focusRegisteredWebInput} from './webInput.js';
export {createVirtualKeyboardInput} from './virtualKeyboardInput.js';
export type {JourneyFieldValue, TerminalInputDisplay} from './virtualKeyboardInput.js';
export {createAndroidJourneyUiPort, createJourneyUiPort, createWebJourneyUiPort} from './journeyUiPort.js';
export type {JourneyDisplay, PrimaryJourneyDisplay} from './journeyUiPort.js';
export {prepareAndroidJourneySurface, prepareWebJourneySurface} from './journeySurface.js';
export type {MainJourneyShape} from './journeySurface.js';
export {requests} from './requests.js';
export {readSelector, subscribeSelector, waitForSelector} from './selectorObservation.js';
export {dispatchObservedUiCommand} from './uiAction.js';
export type {ObservedUiCommand} from './uiAction.js';
