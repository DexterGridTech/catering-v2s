import type {ComponentType} from 'react'
import type {
  UiCatalog,
  UiCatalogEntry,
} from '@catering-v2s/kernel-base-ui-state'

export type LayerTier = 'standard' | 'alert'
export type LayerGuard = 'dismissible' | 'decisive'

type RenderComponentProps = object

type RenderComponent<TProps extends RenderComponentProps> = ComponentType<TProps>

export type RendererBinding<
  TProps extends RenderComponentProps = RenderComponentProps,
> = Readonly<{
  readonly rendererKey: string
  readonly component: RenderComponent<TProps>
  readonly layerTier: LayerTier
  readonly layerGuard: LayerGuard
}>

export type RendererCatalog = Readonly<{
  readonly resolve: (rendererKey: string) => RendererBinding | undefined
  readonly tierOf: (rendererKey: string) => LayerTier | undefined
  readonly guardOf: (rendererKey: string) => LayerGuard | undefined
}>

export type {UiCatalog, UiCatalogEntry}
