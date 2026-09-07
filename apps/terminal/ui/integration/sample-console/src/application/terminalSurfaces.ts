import packageJson from '../../package.json'

export type SurfaceSize = Readonly<{
  readonly width: number
  readonly height: number
}>

export type TerminalSurfaces = Readonly<{
  readonly layout: 'row' | 'column'
  readonly scaleToFit: boolean
  readonly surfaces: Readonly<{
    readonly PRIMARY: SurfaceSize
    readonly SECONDARY: SurfaceSize
  }>
}>

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

const readTerminalSurfaces = (value: unknown): TerminalSurfaces => {
  if (!isRecord(value) || (value.layout !== 'row' && value.layout !== 'column') || typeof value.scaleToFit !== 'boolean') {
    throw new Error('[sample-console] terminalSurfaces has an invalid shape')
  }
  if (!isRecord(value.surfaces)) throw new Error('[sample-console] terminalSurfaces.surfaces is required')
  return Object.freeze({
    layout: value.layout,
    scaleToFit: value.scaleToFit,
    surfaces: Object.freeze({
      PRIMARY: readSurfaceSize(value.surfaces.PRIMARY, 'PRIMARY surface'),
      SECONDARY: readSurfaceSize(value.surfaces.SECONDARY, 'SECONDARY surface'),
    }),
  })
}

export const terminalSurfaces = readTerminalSurfaces(
  (packageJson as {readonly terminalSurfaces?: unknown}).terminalSurfaces,
)
