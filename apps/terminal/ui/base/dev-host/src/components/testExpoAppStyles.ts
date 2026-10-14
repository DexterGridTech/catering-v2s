import {StyleSheet} from 'react-native';
import {SURFACE_PREVIEW_CONSTANTS} from '../foundations/surfacePreview';

export const CONTENT_MAX_WIDTH = 1600;
export const CONTENT_HORIZONTAL_PADDING = 28;
export const SURFACE_WIDTH_MIN_PERCENT = 30;
export const SURFACE_WIDTH_MAX_PERCENT = 100;
export const SURFACE_WIDTH_STEP_PERCENT = 1;
export const SURFACE_WIDTH_SLIDER_TRACK_WIDTH = 132;
export const DEFAULT_SURFACE_WIDTH_PERCENT = SURFACE_WIDTH_MAX_PERCENT;

const COLORS = {
  ink: '#EAF6FF',
  inkMuted: '#8CAEC5',
  canvas: '#061321',
  canvasRaised: '#0B1E30',
  white: '#F7FBFF',
  border: '#1B3D5A',
  borderStrong: '#2B6288',
  primary: '#32B7FF',
  primarySoft: '#102C47',
  secondary: '#23D3C2',
  secondarySoft: '#103D42',
  success: '#58E39B',
  successSoft: '#123C33',
  danger: '#FF6B6B',
  dangerSoft: '#4A1F2B',
  warning: '#F7C66A',
  warningSoft: '#43351A',
} as const;

export const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.canvas,
  },
  scroll: {
    flex: 1,
    width: '100%',
    overflow: 'scroll',
  },
  headerInfo: {
    flex: 1,
    minWidth: 280,
    gap: 4,
    alignItems: 'flex-end',
  },
  headerMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMetricDivider: {
    width: 1,
    height: 13,
    backgroundColor: COLORS.border,
  },
  headerMetricLabel: {
    color: COLORS.inkMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerMetricValue: {
    color: COLORS.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  headerSurfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerSurface: {
    minHeight: 22,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  headerPrimarySurface: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#2E81C4',
  },
  headerSecondarySurface: {
    backgroundColor: COLORS.secondarySoft,
    borderColor: '#27AFA4',
  },
  headerInactiveSurface: {
    backgroundColor: COLORS.canvasRaised,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  headerSurfaceText: {
    color: COLORS.ink,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  headerSurfaceState: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  toolbarActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  surfaceRadioGroup: {
    minHeight: 36,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  surfaceRadioGroupLabel: {
    paddingHorizontal: 7,
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceRadioOption: {
    minHeight: 28,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
  },
  surfaceRadioOptionSelected: {
    backgroundColor: COLORS.primarySoft,
  },
  surfaceRadioOptionPressed: {
    opacity: 0.78,
  },
  surfaceRadioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.inkMuted,
  },
  surfaceRadioCircleSelected: {
    borderColor: COLORS.primary,
  },
  surfaceRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  surfaceRadioText: {
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceRadioTextSelected: {
    color: COLORS.ink,
  },
  surfaceWidthControl: {
    minHeight: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  surfaceWidthControlLabel: {
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceWidthSlider: {
    width: 132,
    height: 24,
    justifyContent: 'center',
  },
  surfaceWidthSliderTrack: {
    width: SURFACE_WIDTH_SLIDER_TRACK_WIDTH,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
    position: 'relative',
  },
  surfaceWidthSliderFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  surfaceWidthSliderThumb: {
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -6,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 3,
  },
  surfaceWidthControlValue: {
    minWidth: 34,
    color: COLORS.ink,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusIndicatorSuccess: {
    backgroundColor: COLORS.success,
  },
  statusIndicatorWarning: {
    backgroundColor: COLORS.warning,
  },
  statusIndicatorInfo: {
    backgroundColor: COLORS.primary,
  },
  statusIndicatorMuted: {
    backgroundColor: COLORS.borderStrong,
  },
  sectionEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  surfaceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  primaryDot: {
    backgroundColor: COLORS.primary,
  },
  secondaryDot: {
    backgroundColor: COLORS.secondary,
  },
  inactiveDot: {
    backgroundColor: COLORS.borderStrong,
  },
  inactiveText: {
    color: COLORS.inkMuted,
  },
  stageHeader: {
    width: '100%',
    marginBottom: 14,
    gap: 14,
  },
  stageHeaderTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 24,
  },
  stageTitle: {
    marginTop: 3,
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  canvas: {
    width: '100%',
    minHeight: 96,
    borderRadius: 12,
    backgroundColor: '#0A2236',
    borderWidth: 2,
    borderColor: '#368DD0',
    boxShadow: '0px 0px 14px rgba(24, 152, 211, 0.22)',
  },
  measurePending: {
    height: 1,
    width: '100%',
    opacity: 0,
  },
  previewViewport: {
    alignSelf: 'stretch',
    margin: SURFACE_PREVIEW_CONSTANTS.stagePadding,
  },
  scaledStage: {
    position: 'relative',
    alignSelf: 'center',
  },
  logicalStage: {
    position: 'absolute',
  },
  surface: {
    position: 'relative',
    borderRadius: 2,
    overflow: 'hidden',
  },
  primarySurface: {
    backgroundColor: '#F7FBFF',
  },
  secondarySurface: {
    backgroundColor: '#E9FFFF',
  },
  surfaceDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 2,
  },
  primarySurfaceDecoration: {
    borderColor: '#3792F4',
  },
  secondarySurfaceDecoration: {
    borderColor: '#24B9AE',
  },
  stageFooter: {
    width: '100%',
    marginTop: 12,
    color: '#82A8BF',
    fontSize: 11,
    textAlign: 'center',
  },
  hostStateCard: {
    width: '100%',
    minHeight: 132,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  hostPendingCard: {
    backgroundColor: '#102C47',
    borderColor: '#2E81C4',
  },
  hostErrorCard: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: '#A94752',
  },
  stateGlyph: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  pendingGlyph: {
    backgroundColor: '#173A58',
  },
  pendingGlyphText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  errorGlyph: {
    backgroundColor: COLORS.danger,
  },
  errorGlyphText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
  hostStateCopy: {
    flex: 1,
  },
  hostStateTitle: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  hostStateDescription: {
    marginTop: 5,
    color: COLORS.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
