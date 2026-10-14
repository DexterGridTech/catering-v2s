import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RenderLayerDismissal, RendererBinding} from '@catering-v2s/ui-base-render';
import type {UiCatalogEntry, UiVariableDeclaration} from '@catering-v2s/kernel-base-ui-state';
import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime';

export type UiDefinedPart = Readonly<{
  readonly catalogEntry: UiCatalogEntry;
  readonly rendererBinding: RendererBinding<any>;
}>;

export type UiPresentationContributions = Readonly<{
  readonly parts?: readonly UiDefinedPart[];
  readonly variables?: readonly UiVariableDeclaration<StateJsonValue>[];
  readonly layerDismissals?: Readonly<Record<string, RenderLayerDismissal>>;
}>;

export type UiRuntimeModule = RuntimeModule & Readonly<{presentationContributions: UiPresentationContributions}>;
