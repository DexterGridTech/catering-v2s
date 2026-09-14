export type SurfacePreviewLayout = 'row' | 'column';
export type SurfacePreviewPolicy = 'width-selective-preserve-ratio';

export type SurfacePreviewSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type SurfacePreviewPoint = Readonly<{
  readonly x: number;
  readonly y: number;
}>;

export type SurfacePreviewOrigin = Readonly<{
  readonly left: number;
  readonly top: number;
}>;

export type SurfacePreviewGeometry = Readonly<{
  readonly stageWidth: number;
  readonly stageHeight: number;
  readonly scaleX: number;
  readonly scaleY: number;
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
  readonly showSecondary: boolean;
  /** Measured preview content rect, excluding canvas border and stage padding. */
  readonly viewport: SurfacePreviewSize;
  readonly primary: SurfacePreviewSize;
  readonly secondary: SurfacePreviewSize;
}>;

const finitePositive = (value: number): boolean => Number.isFinite(value) && value > 0;
const finite = (value: number): boolean => Number.isFinite(value);

/**
 * Converts a point in the logical stage into client coordinates for a real
 * browser hit-test. The caller supplies the current host scales, so this
 * helper remains valid for either a uniform or a future nonuniform policy.
 */
export const mapLogicalPointToPreviewClientPoint = ({
  logicalPoint,
  previewRect,
  scaleX,
  scaleY,
}: Readonly<{
  readonly logicalPoint: SurfacePreviewPoint;
  readonly previewRect: SurfacePreviewOrigin;
  readonly scaleX: number;
  readonly scaleY: number;
}>): SurfacePreviewPoint | null => {
  if (
    !finite(logicalPoint.x)
    || !finite(logicalPoint.y)
    || !finite(previewRect.left)
    || !finite(previewRect.top)
    || !finitePositive(scaleX)
    || !finitePositive(scaleY)
  ) return null;
  return {
    x: previewRect.left + logicalPoint.x * scaleX,
    y: previewRect.top + logicalPoint.y * scaleY,
  };
};

export const calculateSurfacePreviewGeometry = ({
  layout,
  showSecondary,
  viewport,
  primary,
  secondary,
}: CalculateSurfacePreviewGeometryInput): SurfacePreviewGeometry | null => {
  if (
    !finitePositive(viewport.width) ||
    !finitePositive(viewport.height) ||
    !finitePositive(primary.width) ||
    !finitePositive(primary.height)
  ) return null;
  if (showSecondary && (!finitePositive(secondary.width) || !finitePositive(secondary.height))) return null;

  const stageWidth =
    layout === 'row'
      ? primary.width + (showSecondary ? SURFACE_PREVIEW_CONSTANTS.surfaceGap + secondary.width : 0)
      : Math.max(primary.width, showSecondary ? secondary.width : 0);
  const stageHeight =
    layout === 'column'
      ? primary.height + (showSecondary ? SURFACE_PREVIEW_CONSTANTS.surfaceGap + secondary.height : 0)
      : Math.max(primary.height, showSecondary ? secondary.height : 0);
  // Web preview preserves the logical stage ratio and fills the selected content width.
  // The preview is allowed to upscale when the container is wider than the declaration.
  // A browser is a preview host, not a device surface. Width fills its
  // container; a single scale preserves the declared logical stage ratio and
  // lets short viewports scroll rather than crop or nonuniformly deform it.
  const scaleX = Math.max(0.01, viewport.width / stageWidth);
  const scaleY = scaleX;

  return Object.freeze({
    stageWidth,
    stageHeight,
    scaleX,
    scaleY,
    renderedWidth: stageWidth * scaleX,
    renderedHeight: stageHeight * scaleY,
  });
};
