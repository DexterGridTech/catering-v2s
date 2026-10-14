export {moduleName} from './moduleName';
export {PairReadinessInterlock} from './components/PairReadinessInterlock';
export {pairReadinessInterlockTestIds} from './foundations/integrationAssemblyTestIds';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {createStartupDiagnosticsWriter} from './foundations/startupDiagnosticsWriter';
export type {StartupDiagnosticsWriter, StartupDiagnosticsWriterInput} from './foundations/startupDiagnosticsWriter';
export {getSurfaceDeclarations, readTerminalSurfaces, surfaceFormForOrientation} from './foundations/terminalSurfaces';
export type {
  PortraitSurfaceDeclarations,
  SurfaceCreationInput,
  SurfaceDeclarations,
  SurfaceForm,
  SurfaceOrientation,
  SurfaceSize,
  TerminalSurfaceErrorOptions,
  TerminalSurfaces,
} from './foundations/terminalSurfaces';
export {createStartupReadyActor, createStartupReadyPayload} from './foundations/startupReady';
export type {StartupReadyActorInput, StartupReadyPayload} from './foundations/startupReady';
export {createBrowserTransportNetworkAdapter} from './foundations/createBrowserTransportNetworkAdapter';
export {
  createIntegrationAssembly,
  createDispatchCommand,
  createStateSource,
  createSurfaceForDisplayIndex,
} from './application/integrationAssembly';
export type {AutomationAgentConfig} from '@catering-v2s/ui-base-automation-agent';
export type {
  IntegrationAssembly,
  IntegrationAssemblyInput,
  IntegrationSurfaceCreationInput,
  IntegrationSurfaceDeclarations,
} from './application/integrationAssembly';
