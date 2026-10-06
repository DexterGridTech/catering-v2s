import {createTestId, deriveTestId} from '../src/foundations/testId';

export const primitiveTestId = (fixtureKey: string) =>
  createTestId('test.ui.base.primitives', 'fixture', {element: 'node', key: fixtureKey});

export const derivedPrimitiveTestId = (parentKey: string, element: string, key?: string) =>
  deriveTestId(primitiveTestId(parentKey), element, key);
