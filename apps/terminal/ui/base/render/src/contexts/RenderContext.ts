import {createContext, useContext} from 'react';
import type {LoggerPort, NativeLoadingCapability} from '@catering-v2s/kernel-base-platform-ports';
import type {UiCatalog} from '@catering-v2s/kernel-base-ui-state';
import type {RenderSnapshotReader} from '../foundations/createRenderSnapshotReader';
import type {RendererCatalog} from '../types/catalog';
import type {RenderProviderProps} from '../types/props';
import type {RenderPartDiagnosticReporter} from '../foundations/diagnostics';

export type RenderContextValue = Readonly<{
  readonly uiCatalog: UiCatalog;
  readonly rendererCatalog: RendererCatalog;
  readonly logger: LoggerPort;
  readonly nativeLoadingCapability: NativeLoadingCapability;
  readonly onPrimarySurfaceReady?: RenderProviderProps['onPrimarySurfaceReady'];
  readonly hasPrimarySurfaceReady: boolean;
  readonly runtimeFacts: RenderProviderProps['runtimeFacts'];
  readonly onRuntimeRetry?: RenderProviderProps['onRuntimeRetry'];
  readonly topologyCapability?: RenderProviderProps['topologyCapability'];
  readonly dispatchCommand: RenderProviderProps['dispatchCommand'];
  readonly createRouteContext?: RenderProviderProps['createRouteContext'];
  readonly layerDismissals: RenderProviderProps['layerDismissals'];
  readonly selectUiVariable: RenderProviderProps['selectUiVariable'];
  readonly selectSurfaceForm: NonNullable<RenderProviderProps['selectSurfaceForm']>;
  readonly reportPartDiagnostic: RenderPartDiagnosticReporter['report'];
  readonly clearPartDiagnostic: RenderPartDiagnosticReporter['clearForPart'];
  readonly selectBusinessInterlockActive?: RenderProviderProps['selectBusinessInterlockActive'];
  readonly renderBusinessInterlock?: RenderProviderProps['renderBusinessInterlock'];
}>;

export type RenderSubscriptionContextValue = Readonly<{
  readonly stateSource: RenderProviderProps['stateSource'];
  readonly snapshotReader: RenderSnapshotReader;
}>;

export const RenderContext = createContext<RenderContextValue | undefined>(undefined);
export const RenderSubscriptionContext = createContext<RenderSubscriptionContextValue | undefined>(undefined);

export const useRenderContext = (): RenderContextValue => {
  const value = useContext(RenderContext);
  if (value === undefined) throw new Error('[ui-base-render] RenderProvider is required');
  return value;
};

export const useRenderSubscriptionContext = (): RenderSubscriptionContextValue => {
  const value = useContext(RenderSubscriptionContext);
  if (value === undefined) throw new Error('[ui-base-render] RenderProvider is required');
  return value;
};
