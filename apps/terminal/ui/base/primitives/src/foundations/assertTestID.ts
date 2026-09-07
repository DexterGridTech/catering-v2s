export const assertTestID = (testID: string): string => {
  if (testID.trim().length === 0) throw new Error('Primitive testID must be non-empty');
  return testID;
};
