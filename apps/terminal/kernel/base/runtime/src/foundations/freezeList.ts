export const freezeList = <T>(values: readonly T[]): readonly T[] => Object.freeze([...values]);
