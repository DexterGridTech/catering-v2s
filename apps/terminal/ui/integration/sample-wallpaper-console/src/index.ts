export {moduleName, moduleKind} from './moduleName'
export {dependencyModuleNames, devDependencyModuleNames} from './dependencies'
export {createSampleWallpaperConsoleAssembly, createSurfaceForDisplayIndex} from './assembly/assembly'
export type {WallpaperConsoleAssembly} from './assembly/assembly'
export {createSampleWallpaperConsoleModule} from './application/module'
export {createBaseModuleDescriptors} from './application/baseModuleDescriptors'
export {parts, waitingPart, welcomePart} from './parts/parts'
export {terminalSurfaces, getSurfaceDeclarations, readTerminalSurfaces, surfaceFormForOrientation} from './application/terminalSurfaces'
export type {
  PortraitSurfaceDeclarations,
  SurfaceCreationInput,
  SurfaceDeclarations,
  SurfaceForm,
  SurfaceOrientation,
  SurfaceSize,
  TerminalSurfaces,
} from './application/terminalSurfaces'
