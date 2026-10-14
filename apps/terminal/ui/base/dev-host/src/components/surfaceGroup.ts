import type {SurfaceForm, SurfaceSize, TerminalSurfaces} from '../types/testExpoApp';

export type SurfaceGroup = Readonly<{
  readonly primary: SurfaceSize;
  readonly secondary: SurfaceSize;
}>;

export const resolveSurfaceGroup = (terminalSurfaces: TerminalSurfaces, surfaceForm: SurfaceForm): SurfaceGroup => {
  if (surfaceForm === 'laptop') {
    return {
      primary: terminalSurfaces.orientations.landscape.PRIMARY,
      secondary: terminalSurfaces.orientations.landscape.SECONDARY,
    };
  }
  const portrait = terminalSurfaces.orientations.portrait;
  if (portrait === undefined) throw new Error('[ui-base-dev-host] mobile surface declarations are required');
  return {primary: portrait.PRIMARY, secondary: portrait.PRIMARY};
};

