import type {DisplayFactsReadModel, DisplayFactsSurface} from '@catering-v2s/kernel-base-display-context';
import type {PrimitiveSurfaceMapSurface, PrimitiveTone} from '@catering-v2s/ui-base-primitives';

export type RuntimeDisplayProjection = Readonly<{
  readonly status: 'ready' | 'error';
  readonly reason: string | null;
  readonly surfaces: readonly PrimitiveSurfaceMapSurface[];
}>;

const roleLabel = (role: DisplayFactsSurface['role']): string => {
  if (role === 'primary') return '主屏';
  if (role === 'secondary') return '副屏';
  return '屏幕角色未提供';
};

const readinessLabel = (
  readiness: DisplayFactsSurface['readiness'],
): Readonly<{readonly label: string; readonly tone: PrimitiveTone}> => {
  if (readiness === 'ready') return {label: '已就绪', tone: 'ok'};
  if (readiness === 'loading') return {label: '正在准备', tone: 'warn'};
  if (readiness === 'unavailable') return {label: '不可用', tone: 'error'};
  return {label: '状态未提供', tone: 'neutral'};
};

const reasonLabel = (reasonCode: string | null): string => {
  if (reasonCode === 'DISPLAY_FACTS_NOT_PROVIDED') return '显示事实未提供';
  if (reasonCode === 'DISPLAY_FACTS_READ_TIMED_OUT') return '显示事实读取超时';
  if (reasonCode === 'DISPLAY_FACTS_SURFACE_COUNT_UNSUPPORTED') return '显示屏数量超出当前支持范围';
  if (reasonCode === 'DISPLAY_FACTS_SURFACE_MALFORMED') return '显示事实内容无效';
  if (reasonCode === 'DISPLAY_COUNT_MALFORMED') return '显示屏数量无效';
  if (reasonCode === 'DISPLAY_FACTS_LOGICAL_SIZE_NOT_PROVIDED') return '显示屏逻辑尺寸未提供';
  if (reasonCode === 'DISPLAY_FACTS_MOBILE_MULTISURFACE_UNSUPPORTED') return 'mobile 形态不支持多屏显示事实';
  return reasonCode === null ? '显示事实当前不可用' : '显示事实读取失败';
};

const currentSurfaceKeyOf = (
  facts: DisplayFactsReadModel,
  renderDisplayMode: 'PRIMARY' | 'SECONDARY',
): 'PRIMARY' | 'SECONDARY' | null =>
  facts.currentSurfaceKey ??
  (facts.surfaces.length === 1 ? (facts.surfaces[0]?.surfaceKey ?? null) : renderDisplayMode);

export const projectRuntimeDisplay = (
  input: Readonly<{
    readonly facts: DisplayFactsReadModel | undefined;
    readonly surfaceCanvasSizes: Readonly<{
      readonly PRIMARY?: Readonly<{readonly width: number; readonly height: number}>;
      readonly SECONDARY?: Readonly<{readonly width: number; readonly height: number}>;
    }>;
    readonly surfaceForm: 'laptop' | 'mobile';
    readonly renderDisplayMode: 'PRIMARY' | 'SECONDARY';
    readonly currentLogicalSize: Readonly<{readonly width: number; readonly height: number}> | null;
  }>,
): RuntimeDisplayProjection => {
  const facts = input.facts;
  if (facts === undefined)
    return Object.freeze({status: 'error', reason: '显示事实未提供', surfaces: Object.freeze([])});
  if (facts.status !== 'ready') {
    return Object.freeze({status: 'error', reason: reasonLabel(facts.reasonCode), surfaces: Object.freeze([])});
  }
  if (input.surfaceForm === 'mobile' && (facts.physicalDisplayCount !== 1 || facts.surfaces.length !== 1)) {
    return Object.freeze({
      status: 'error',
      reason: reasonLabel('DISPLAY_FACTS_MOBILE_MULTISURFACE_UNSUPPORTED'),
      surfaces: Object.freeze([]),
    });
  }
  if (facts.surfaces.length === 0 || facts.physicalDisplayCount !== facts.surfaces.length) {
    return Object.freeze({
      status: 'error',
      reason: reasonLabel('DISPLAY_FACTS_SURFACE_MALFORMED'),
      surfaces: Object.freeze([]),
    });
  }

  const currentSurfaceKey = currentSurfaceKeyOf(facts, input.renderDisplayMode);
  const projected = facts.surfaces.map((surface): PrimitiveSurfaceMapSurface | null => {
    const current = surface.surfaceKey === currentSurfaceKey;
    const canvasSize = input.surfaceCanvasSizes[surface.surfaceKey];
    const deviceLogicalSize = surface.logicalSize ?? (current ? input.currentLogicalSize : null);
    const physicalSize = surface.physicalSize;
    const aspectSize = deviceLogicalSize ?? physicalSize;
    if (aspectSize === null || aspectSize.width <= 0 || aspectSize.height <= 0) return null;
    const readiness = readinessLabel(surface.readiness);
    return Object.freeze({
      key: surface.surfaceKey,
      label: roleLabel(surface.role),
      roleLabel: current ? '当前 surface' : '非当前 surface',
      current,
      present: surface.present,
      aspectRatio: aspectSize.width / aspectSize.height,
      insideLabels: Object.freeze([
        readiness.label,
        `可用状态：${surface.readiness === 'ready' ? '正常' : readiness.label}`,
      ]),
      outsideLabels: Object.freeze([]),
      logicWidthLabel: `逻辑分辨率宽：${canvasSize?.width ?? '未声明'}`,
      logicHeightLabel: `逻辑分辨率高：${canvasSize?.height ?? '未声明'}`,
      physicalWidthLabel: `物理长：${physicalSize?.width ?? '未知'}`,
      physicalHeightLabel: `物理高：${physicalSize?.height ?? '未知'}`,
    });
  });
  if (projected.some(surface => surface === null)) {
    return Object.freeze({status: 'error', reason: '屏幕尺寸事实未提供', surfaces: Object.freeze([])});
  }
  return Object.freeze({
    status: 'ready',
    reason: null,
    surfaces: Object.freeze(projected as PrimitiveSurfaceMapSurface[]),
  });
};
