import packageJson from '../../package.json'
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context'

export type SurfaceSize = Readonly<{
  readonly width: number
  readonly height: number
}>

export type SurfaceOrientation = 'landscape' | 'portrait'
export type SurfaceForm = 'laptop' | 'mobile'

export type SurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1
  readonly displayMode: DisplayMode
  readonly surfaceForm: SurfaceForm
}>

export type SurfaceDeclarations = Readonly<Record<DisplayMode, SurfaceSize>>
export type PortraitSurfaceDeclarations = Readonly<Pick<SurfaceDeclarations, 'PRIMARY'>>

export type TerminalSurfaces = Readonly<{
  readonly orientations: Readonly<{
    readonly landscape: SurfaceDeclarations
    readonly portrait?: PortraitSurfaceDeclarations
  }>
}>

export const surfaceFormForOrientation = (orientation: SurfaceOrientation): SurfaceForm =>
  orientation === 'landscape' ? 'laptop' : 'mobile'

export const getSurfaceDeclarations = (
  surfaces: TerminalSurfaces,
  surfaceForm: SurfaceForm,
): SurfaceDeclarations | PortraitSurfaceDeclarations => {
  if (surfaceForm === 'laptop') return surfaces.orientations.landscape
  const portrait = surfaces.orientations.portrait
  if (portrait === undefined) throw new Error('[sample-console] mobile surface declarations are required')
  return portrait
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const positiveFinite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const readSurfaceSize = (value: unknown, label: string): SurfaceSize => {
  if (!isRecord(value) || !positiveFinite(value.width) || !positiveFinite(value.height)) {
    throw new Error(`[sample-console] ${label} must have positive width and height`)
  }
  return Object.freeze({width: value.width, height: value.height})
}

const readSurfaceDeclarations = (value: unknown, label: string): SurfaceDeclarations => {
  if (!isRecord(value)) throw new Error(`[sample-console] ${label} surfaces are required`)
  return Object.freeze({
    PRIMARY: readSurfaceSize(value.PRIMARY, `${label}.PRIMARY surface`),
    SECONDARY: readSurfaceSize(value.SECONDARY, `${label}.SECONDARY surface`),
  })
}

const readPortraitSurfaceDeclarations = (value: unknown, label: string): PortraitSurfaceDeclarations => {
  if (!isRecord(value)) throw new Error(`[sample-console] ${label} surfaces are required`)
  if (Object.prototype.hasOwnProperty.call(value, 'SECONDARY')) {
    throw new Error(`[sample-console] ${label}.SECONDARY is not allowed in portrait`)
  }
  return Object.freeze({
    PRIMARY: readSurfaceSize(value.PRIMARY, `${label}.PRIMARY surface`),
  })
}

export const readTerminalSurfaces = (value: unknown): TerminalSurfaces => {
  if (!isRecord(value) || !isRecord(value.orientations)) {
    throw new Error('[sample-console] terminalSurfaces has an invalid shape')
  }
  const portrait = value.orientations.portrait
  return Object.freeze({
    orientations: Object.freeze({
      landscape: readSurfaceDeclarations(value.orientations.landscape, 'landscape'),
      ...(portrait === undefined ? {} : {portrait: readPortraitSurfaceDeclarations(portrait, 'portrait')}),
    }),
  })
}

export const terminalSurfaces = readTerminalSurfaces(
  (packageJson as {readonly terminalSurfaces?: unknown}).terminalSurfaces,
)
