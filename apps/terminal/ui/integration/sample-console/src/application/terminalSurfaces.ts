import packageJson from '../../package.json'
import {
  getSurfaceDeclarations as getSharedSurfaceDeclarations,
  readTerminalSurfaces as readSharedTerminalSurfaces,
  surfaceFormForOrientation as sharedSurfaceFormForOrientation,
  type PortraitSurfaceDeclarations,
  type SurfaceCreationInput,
  type SurfaceDeclarations,
  type SurfaceForm,
  type SurfaceOrientation,
  type SurfaceSize,
  type TerminalSurfaces,
} from '@catering-v2s/ui-base-console-assembly'

export type {
  PortraitSurfaceDeclarations,
  SurfaceCreationInput,
  SurfaceDeclarations,
  SurfaceForm,
  SurfaceOrientation,
  SurfaceSize,
  TerminalSurfaces,
} from '@catering-v2s/ui-base-console-assembly'

const errorPrefix = 'sample-console'

export const readTerminalSurfaces = (value: unknown): TerminalSurfaces =>
  readSharedTerminalSurfaces(value, {errorPrefix})

export const getSurfaceDeclarations = (
  surfaces: TerminalSurfaces,
  surfaceForm: SurfaceForm,
): SurfaceDeclarations | PortraitSurfaceDeclarations =>
  getSharedSurfaceDeclarations(surfaces, surfaceForm, {errorPrefix})

export const surfaceFormForOrientation = sharedSurfaceFormForOrientation

export const terminalSurfaces = readTerminalSurfaces(
  (packageJson as {readonly terminalSurfaces?: unknown}).terminalSurfaces,
)
