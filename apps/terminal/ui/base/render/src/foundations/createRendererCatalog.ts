import type {ComponentType} from 'react';
import type {LayerGuard, LayerTier, RendererBinding, RendererCatalog} from '../types/catalog';

const isRenderComponent = (value: unknown): value is ComponentType<object> => typeof value === 'function';

const APPROVED_RENDERER_BINDING_KEYS = Object.freeze(['rendererKey', 'component', 'layerTier', 'layerGuard'] as const);

const hasExactRendererBindingKeys = (binding: object): boolean => {
  const actual = Reflect.ownKeys(binding);
  return (
    actual.length === APPROVED_RENDERER_BINDING_KEYS.length &&
    APPROVED_RENDERER_BINDING_KEYS.every(key => actual.includes(key))
  );
};

const canonicalBinding = (binding: RendererBinding): RendererBinding => {
  if (
    typeof binding !== 'object' ||
    binding === null ||
    Array.isArray(binding) ||
    !hasExactRendererBindingKeys(binding)
  ) {
    throw new Error(
      '[ui-base-render] renderer binding fields must equal rendererKey, component, layerTier, layerGuard',
    );
  }
  if (typeof binding.rendererKey !== 'string' || binding.rendererKey.trim().length === 0) {
    throw new Error('[ui-base-render] rendererKey must be non-empty');
  }
  if (!isRenderComponent(binding.component)) {
    throw new Error('[ui-base-render] renderer component must be callable');
  }
  if (binding.layerTier !== 'standard' && binding.layerTier !== 'alert' && binding.layerTier !== 'admin') {
    throw new Error('[ui-base-render] renderer layerTier is invalid');
  }
  if (binding.layerGuard !== 'dismissible' && binding.layerGuard !== 'decisive') {
    throw new Error('[ui-base-render] renderer layerGuard is invalid');
  }
  return Object.freeze({
    rendererKey: binding.rendererKey,
    component: binding.component,
    layerTier: binding.layerTier,
    layerGuard: binding.layerGuard,
  });
};

type RendererBindingInput = Readonly<{
  readonly rendererKey: string;
  readonly component: unknown;
  readonly layerTier: LayerTier;
  readonly layerGuard: LayerGuard;
}>;

type ValidRendererBinding<TValue> =
  TValue extends RendererBinding<infer _TProps> ? TValue & RendererBindingInput : never;

export const createRendererCatalog = <TValue>(bindings: readonly ValidRendererBinding<TValue>[]): RendererCatalog => {
  if (!Array.isArray(bindings)) throw new Error('[ui-base-render] renderer bindings must be an array');
  const byRendererKey = new Map<string, RendererBinding>();
  for (const binding of bindings) {
    const canonical = canonicalBinding(binding);
    if (byRendererKey.has(canonical.rendererKey)) {
      throw new Error(`[ui-base-render] duplicate rendererKey: ${canonical.rendererKey}`);
    }
    byRendererKey.set(canonical.rendererKey, canonical);
  }
  const resolve = (rendererKey: string): RendererBinding | undefined => byRendererKey.get(rendererKey);
  const tierOf = (rendererKey: string): LayerTier | undefined => byRendererKey.get(rendererKey)?.layerTier;
  const guardOf = (rendererKey: string): LayerGuard | undefined => byRendererKey.get(rendererKey)?.layerGuard;
  return Object.freeze({resolve, tierOf, guardOf});
};
