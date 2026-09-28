import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';

export type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';

export type SurfaceSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type SurfaceOrientation = 'landscape' | 'portrait';

export type SurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1;
  readonly displayMode: DisplayMode;
  readonly surfaceForm: SurfaceForm;
}>;

export type SurfaceDeclarations = Readonly<Record<DisplayMode, SurfaceSize>>;
export type PortraitSurfaceDeclarations = Readonly<Pick<SurfaceDeclarations, 'PRIMARY'>>;

export type TerminalSurfaces = Readonly<{
  readonly orientations: Readonly<{
    readonly landscape: SurfaceDeclarations;
    readonly portrait?: PortraitSurfaceDeclarations;
  }>;
}>;

export type TerminalSurfaceErrorOptions = Readonly<{
  readonly errorPrefix: string;
}>;

export const surfaceFormForOrientation = (orientation: SurfaceOrientation): SurfaceForm =>
  orientation === 'landscape' ? 'laptop' : 'mobile';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const positiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const readSurfaceSize = (value: unknown, label: string, errorPrefix: string): SurfaceSize => {
  if (!isRecord(value) || !positiveFinite(value.width) || !positiveFinite(value.height)) {
    throw new Error(`[${errorPrefix}] ${label} must have positive width and height`);
  }
  return Object.freeze({width: value.width, height: value.height});
};

const readSurfaceDeclarations = (value: unknown, label: string, errorPrefix: string): SurfaceDeclarations => {
  if (!isRecord(value)) throw new Error(`[${errorPrefix}] ${label} surfaces are required`);
  return Object.freeze({
    PRIMARY: readSurfaceSize(value.PRIMARY, `${label}.PRIMARY surface`, errorPrefix),
    SECONDARY: readSurfaceSize(value.SECONDARY, `${label}.SECONDARY surface`, errorPrefix),
  });
};

const readPortraitSurfaceDeclarations = (
  value: unknown,
  label: string,
  errorPrefix: string,
): PortraitSurfaceDeclarations => {
  if (!isRecord(value)) throw new Error(`[${errorPrefix}] ${label} surfaces are required`);
  if (Object.prototype.hasOwnProperty.call(value, 'SECONDARY')) {
    throw new Error(`[${errorPrefix}] ${label}.SECONDARY is not allowed in portrait`);
  }
  return Object.freeze({
    PRIMARY: readSurfaceSize(value.PRIMARY, `${label}.PRIMARY surface`, errorPrefix),
  });
};

export const readTerminalSurfaces = (value: unknown, {errorPrefix}: TerminalSurfaceErrorOptions): TerminalSurfaces => {
  if (!isRecord(value) || !isRecord(value.orientations)) {
    throw new Error(`[${errorPrefix}] terminalSurfaces has an invalid shape`);
  }
  const portrait = value.orientations.portrait;
  return Object.freeze({
    orientations: Object.freeze({
      landscape: readSurfaceDeclarations(value.orientations.landscape, 'landscape', errorPrefix),
      ...(portrait === undefined ? {} : {portrait: readPortraitSurfaceDeclarations(portrait, 'portrait', errorPrefix)}),
    }),
  });
};

export const getSurfaceDeclarations = (
  surfaces: TerminalSurfaces,
  surfaceForm: SurfaceForm,
  {errorPrefix}: TerminalSurfaceErrorOptions,
): SurfaceDeclarations | PortraitSurfaceDeclarations => {
  if (surfaceForm === 'laptop') return surfaces.orientations.landscape;
  const portrait = surfaces.orientations.portrait;
  if (portrait === undefined) {
    throw new Error(`[${errorPrefix}] mobile surface declarations are required`);
  }
  return portrait;
};
