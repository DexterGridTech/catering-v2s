import type {TestId} from './testId';

export const assertTestID = (testID: TestId | undefined): TestId | undefined => {
  if (testID !== undefined && testID.trim().length === 0) throw new Error('Primitive testID must be non-empty');
  return testID;
};
