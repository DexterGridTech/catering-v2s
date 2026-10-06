import {createTestId, deriveTestId, type TestId} from '@catering-v2s/ui-base-primitives';
import {moduleName} from '../moduleName';

const node = (key: string): TestId => createTestId(moduleName, 'automation', {element: 'node', key: key});

export const renderTestIds = Object.freeze({
  node,
  layerPrefix: createTestId(moduleName, 'layer'),
  layerStack: createTestId(moduleName, 'layer-stack'),
  layerBackdrop: createTestId(moduleName, 'layer-backdrop'),
  layer: (layerId: string): TestId => createTestId(moduleName, 'layer', {key: layerId}),
  screenContainer: createTestId(moduleName, 'screen-container'),
  screenReadyBoundary: createTestId(moduleName, 'screen-ready-boundary'),
  surfaceRoot: createTestId(moduleName, 'surface-root'),
  surfaceHostFailure: createTestId(moduleName, 'surface-host-failure'),
  surfaceHostViewport: createTestId(moduleName, 'surface-host-viewport'),
  surfaceHostCanvas: createTestId(moduleName, 'surface-host-canvas'),
  startupFailure: createTestId(moduleName, 'startup-failure'),
  startupFailureTitle: createTestId(moduleName, 'startup-failure', {element: 'title'}),
  startupFailureMessage: createTestId(moduleName, 'startup-failure', {element: 'message'}),
  startupFailureCode: createTestId(moduleName, 'startup-failure', {element: 'code'}),
  runtimeFailure: createTestId(moduleName, 'runtime-failure'),
  runtimeFailureTitle: createTestId(moduleName, 'runtime-failure', {element: 'title'}),
  runtimeFailureMessage: createTestId(moduleName, 'runtime-failure', {element: 'message'}),
  runtimeFailureCode: createTestId(moduleName, 'runtime-failure', {element: 'code'}),
  fallbackPrefix: createTestId(moduleName, 'fallback'),
  fallback: (reason: string): TestId => createTestId(moduleName, 'fallback', {key: reason}),
  businessInterlock: createTestId(moduleName, 'business-interlock'),
  systemFailure: (ownerId: string): TestId => node(`system-failure:${ownerId}`),
  child: (parent: TestId, element: string): TestId => deriveTestId(parent, element)!,
});
