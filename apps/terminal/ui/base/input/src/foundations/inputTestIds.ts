import {createTestId, type TestId} from '@catering-v2s/ui-base-primitives';
import {moduleName} from '../moduleName';

const node = (key: string): TestId => {
  const [part, element, ...tail] = key.split(':');
  if (part === undefined || part.length === 0) throw new Error('TERMINAL_INPUT_TEST_ID_PART_REQUIRED');
  if (element === undefined) return createTestId(moduleName, part);
  if (element.length === 0) throw new Error('TERMINAL_INPUT_TEST_ID_ELEMENT_INVALID');
  return tail.length === 0
    ? createTestId(moduleName, part, {element: element})
    : createTestId(moduleName, part, {element: element, key: tail.join(':')});
};

export const inputTestIds = Object.freeze({
  node,
  surfaceFrame: node('surface-frame'),
  surfaceContent: node('surface-content'),
  keyboardOverlay: node('keyboard-overlay'),
  keyboardHitShield: node('keyboard-hit-shield'),
  backdrop: node('virtual-keyboard:backdrop'),
  keyboardSurface: node('virtual-keyboard'),
  keyboardContent: node('virtual-keyboard:content'),
  keyboardLayer: (interactive: boolean, suffix?: string): TestId =>
    node(`keyboard-layer:${interactive ? 'interactive' : 'inactive'}${suffix === undefined ? '' : `:${suffix}`}`),
  keyboardLayerPosition: (suffix?: string): TestId => node(`keyboard-layer-position:${suffix ?? 'active'}`),
});
