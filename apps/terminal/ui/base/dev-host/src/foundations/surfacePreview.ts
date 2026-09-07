export type SurfacePreviewLayout = 'row' | 'column';

export type SurfacePreviewSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type SurfacePreviewGeometry = Readonly<{
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly scale: number;
  readonly renderedWidth: number;
  readonly renderedHeight: number;
}>;

export const SURFACE_PREVIEW_CONSTANTS = Object.freeze({
  canvasBorder: 2,
  stagePadding: 10,
  surfaceGap: 12,
});

type CalculateSurfacePreviewGeometryInput = Readonly<{
  readonly layout: SurfacePreviewLayout;
  readonly scaleToFit: boolean;
  readonly showSecondary: boolean;
  readonly viewportWidth: number;
  readonly primary: SurfacePreviewSize;
  readonly secondary: SurfacePreviewSize;
}>;

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;

export const calculateSurfacePreviewGeometry = ({
  layout,
  scaleToFit,
  showSecondary,
  viewportWidth,
  primary,
  secondary,
}: CalculateSurfacePreviewGeometryInput): SurfacePreviewGeometry | null => {
  if (!finitePositive(viewportWidth) || !finitePositive(primary.width) || !finitePositive(primary.height)) return null;
  if (showSecondary && (!finitePositive(secondary.width) || !finitePositive(secondary.height))) return null;

  const stageWidth =
    layout === 'row'
      ? primary.width + (showSecondary ? SURFACE_PREVIEW_CONSTANTS.surfaceGap + secondary.width : 0)
      : Math.max(primary.width, showSecondary ? secondary.width : 0);
  const stageHeight =
    layout === 'column'
      ? primary.height + (showSecondary ? SURFACE_PREVIEW_CONSTANTS.surfaceGap + secondary.height : 0)
      : Math.max(primary.height, showSecondary ? secondary.height : 0);
  const availableWidth =
    viewportWidth - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder - 2 * SURFACE_PREVIEW_CONSTANTS.stagePadding;
  const scale = scaleToFit ? Math.min(1, Math.max(0.01, availableWidth / stageWidth)) : 1;

  return Object.freeze({
    stageWidth,
    stageHeight,
    scale,
    renderedWidth: stageWidth * scale,
    renderedHeight: stageHeight * scale,
  });
};
