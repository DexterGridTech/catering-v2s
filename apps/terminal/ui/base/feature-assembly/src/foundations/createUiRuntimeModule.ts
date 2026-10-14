import {createRuntimeModule, type RuntimeModule} from '@catering-v2s/kernel-base-runtime';
import type {UiPresentationContributions, UiRuntimeModule} from '../types/uiRuntimeModule';

export const createUiRuntimeModule = (
  module: RuntimeModule,
  presentationContributions: UiPresentationContributions = {},
): UiRuntimeModule => {
  const declaredPartKeys = new Set(
    (presentationContributions.parts ?? []).map(part => part.catalogEntry.partKey),
  );
  for (const partKey of Object.keys(presentationContributions.layerDismissals ?? {})) {
    if (!declaredPartKeys.has(partKey)) {
      throw new Error(`[ui.base.feature-assembly] layer dismissal has no package-owned part: ${partKey}`);
    }
  }

  return Object.freeze({
    ...createRuntimeModule(module),
    presentationContributions: Object.freeze({
      ...(presentationContributions.parts === undefined
        ? {}
        : {parts: Object.freeze([...presentationContributions.parts])}),
      ...(presentationContributions.variables === undefined
        ? {}
        : {variables: Object.freeze([...presentationContributions.variables])}),
      ...(presentationContributions.layerDismissals === undefined
        ? {}
        : {layerDismissals: Object.freeze({...presentationContributions.layerDismissals})}),
    }),
  });
};
