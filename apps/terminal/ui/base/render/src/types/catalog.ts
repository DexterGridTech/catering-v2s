import type {ComponentType} from 'react';

export type LayerTier = 'standard' | 'alert' | 'admin';
export type LayerGuard = 'dismissible' | 'decisive';
export type RendererPlacementScope = 'workspace' | 'local-primary';

type RenderComponentProps = object;

type RenderComponent<TProps extends RenderComponentProps> = ComponentType<TProps>;

export type RendererBinding<TProps extends RenderComponentProps = RenderComponentProps> = Readonly<{
  readonly rendererKey: string;
  readonly component: RenderComponent<TProps>;
  readonly layerTier: LayerTier;
  readonly layerGuard: LayerGuard;
  readonly placementScope: RendererPlacementScope;
}>;

export type RendererCatalog = Readonly<{
  readonly resolve: (rendererKey: string) => RendererBinding | undefined;
  readonly tierOf: (rendererKey: string) => LayerTier | undefined;
  readonly guardOf: (rendererKey: string) => LayerGuard | undefined;
  readonly placementScopeOf: (rendererKey: string) => RendererPlacementScope | undefined;
}>;
