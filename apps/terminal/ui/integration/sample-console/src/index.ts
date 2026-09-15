export {moduleName, moduleKind} from './moduleName';
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies';
export {createSampleAssembly, createSampleDefinedParts, createSurfaceForDisplayIndex} from './assembly/assembly';
export {createSampleConsoleModule} from './application/module';
export type {SampleAssembly} from './assembly/assembly';
export {terminalSurfaces} from './application/terminalSurfaces';
export type {
  PortraitSurfaceDeclarations,
  SurfaceCreationInput,
  SurfaceDeclarations,
  SurfaceForm,
  SurfaceOrientation,
  SurfaceSize,
  TerminalSurfaces,
} from './application/terminalSurfaces';
