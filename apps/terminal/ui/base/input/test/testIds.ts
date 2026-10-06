import {createTestId, type TestId} from '@catering-v2s/ui-base-primitives';

export const testId = (value: string): TestId => {
  const [module, part, element, ...tail] = value.split(':');
  if (module === undefined || part === undefined) throw new Error('TERMINAL_INPUT_TEST_FIXTURE_ID_INVALID');
  if (element === undefined) return createTestId(module, part);
  return tail.length === 0
    ? createTestId(module, part, {element: element})
    : createTestId(module, part, {element: element, key: tail.join(':')});
};
