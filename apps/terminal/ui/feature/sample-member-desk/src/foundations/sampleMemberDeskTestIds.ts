import {createTestId, deriveTestId, type TestId} from '@catering-v2s/ui-base-primitives/test-id';
import {moduleName} from '../moduleName';

/** Keeps raw keys under this feature identity and canonical IDs stable when test helpers pass them back. */
export const sampleMemberDeskTestId = (key: string): TestId => {
  const prefix = `${moduleName}:automation:node:`;
  return key.startsWith(prefix)
    ? createTestId(moduleName, 'automation', {element: 'node', key: decodeURIComponent(key.slice(prefix.length))})
    : createTestId(moduleName, 'automation', {element: 'node', key: key});
};

export const deriveSampleMemberDeskTestId = (parentKey: string, element: string, key?: string): TestId =>
  deriveTestId(sampleMemberDeskTestId(parentKey), element, key)!;
