import type {ComponentType} from 'react'
import type {
  UiCatalogEntry,
} from '@catering-v2s/kernel-base-ui-state'
import type {
  LayerGuard,
  LayerTier,
  RendererBinding,
} from '../types/catalog'

type RenderComponentProps = object

type DefinePartCatalogFields = Pick<
  UiCatalogEntry,
  | 'partKey'
  | 'rendererKey'
  | 'containerKeys'
  | 'displayModes'
  | 'workspaces'
  | 'instanceModes'
  | 'surfaceForm'
  | 'title'
  | 'description'
>

type DefinePartInput<TProps extends RenderComponentProps> = Readonly<DefinePartCatalogFields & {
  readonly component: ComponentType<TProps>
  readonly layerTier?: LayerTier
  readonly layerGuard?: LayerGuard
}>

type DefinedPart<TProps extends RenderComponentProps> = Readonly<{
  readonly catalogEntry: UiCatalogEntry
  readonly rendererBinding: RendererBinding<TProps>
}>

const hasOwn = (value: object, property: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, property)

const requireLayerTier = <TProps extends RenderComponentProps>(
  input: DefinePartInput<TProps>,
): LayerTier => {
  if (hasOwn(input, 'layerTier') && input.layerTier === undefined) {
    throw new Error('[ui-base-render] layerTier must not be explicitly undefined')
  }
  const layerTier = input.layerTier ?? 'standard'
  if (layerTier !== 'standard' && layerTier !== 'alert') {
    throw new Error('[ui-base-render] layerTier is invalid')
  }
  return layerTier
}

const requireLayerGuard = <TProps extends RenderComponentProps>(
  input: DefinePartInput<TProps>,
): LayerGuard => {
  if (hasOwn(input, 'layerGuard') && input.layerGuard === undefined) {
    throw new Error('[ui-base-render] layerGuard must not be explicitly undefined')
  }
  const layerGuard = input.layerGuard ?? 'dismissible'
  if (layerGuard !== 'dismissible' && layerGuard !== 'decisive') {
    throw new Error('[ui-base-render] layerGuard is invalid')
  }
  return layerGuard
}

export const definePart = <TProps extends RenderComponentProps>(
  input: DefinePartInput<TProps>,
): DefinedPart<TProps> => {
  const layerTier = requireLayerTier(input)
  const layerGuard = requireLayerGuard(input)
  const catalogEntry: UiCatalogEntry = Object.freeze({
    partKey: input.partKey,
    rendererKey: input.rendererKey,
    containerKeys: Object.freeze([...input.containerKeys]),
    displayModes: Object.freeze([...input.displayModes]),
    workspaces: Object.freeze([...input.workspaces]),
    instanceModes: Object.freeze([...input.instanceModes]),
    surfaceForm: Object.freeze([...input.surfaceForm]),
    title: input.title,
    description: input.description,
  })
  const rendererBinding: RendererBinding<TProps> = Object.freeze({
    rendererKey: input.rendererKey,
    component: input.component,
    layerTier,
    layerGuard,
  })
  return Object.freeze({catalogEntry, rendererBinding})
}
