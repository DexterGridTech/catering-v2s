import {createTestId, type TestId} from '@catering-v2s/ui-base-primitives';
import {moduleName} from '../moduleName';

const node = (element: string, key?: string): TestId =>
  createTestId(moduleName, 'test-expo', {element: element, key: key});

export const testExpoTestIds = Object.freeze({
  node,
  canvas: node('canvas'),
  previewViewport: node('canvas', 'preview-viewport'),
  measurePending: node('canvas', 'measure-pending'),
  scaledStage: node('canvas', 'scaled-stage'),
  logicalStage: node('canvas', 'logical-stage'),
  surface: (display: 'PRIMARY' | 'SECONDARY') => node('surface', display),
  surfaceDecoration: (display: 'PRIMARY' | 'SECONDARY') => node('surface-decoration', display),
  surfaceForm: (form: 'mobile' | 'laptop') => node('surface-form', form),
  surfaceMode: (mode: 'single' | 'dual') => node('surface-mode', mode),
  surfaceSummary: (display: 'PRIMARY' | 'SECONDARY') => node('surface-summary', display),
  surfaceToggle: node('surface-toggle'),
  toolbarActions: node('toolbar-actions'),
  headerStatus: node('header-status'),
  surfaceWidthSlider: node('surface-width-slider'),
  surfaceWidthControl: node('surface-width-control'),
  surfaceWidthValue: node('surface-width-value'),
});
