import {moduleName} from '../moduleName';

const testIdTypeMarker: unique symbol = Symbol('TestId');

export type TestId = string & Readonly<{[testIdTypeMarker]: true}>;

const segmentPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const requireSegment = (name: string, value: string): string => {
  if (!segmentPattern.test(value)) throw new Error(`Invalid ${name} segment for testID`);
  return value;
};

/** Builds the only strongly typed automation ID format used by TER-owned UI. */
export const createTestId = (
  module: string,
  part: string,
  input: Readonly<{element?: string; key?: string}> = {},
): TestId => {
  const segments = [requireSegment('module', module), requireSegment('part', part)];
  if (input.element !== undefined) segments.push(requireSegment('element', input.element));
  if (input.key !== undefined) {
    if (input.key.trim().length === 0) throw new Error('Invalid key segment for testID');
    segments.push(encodeURIComponent(input.key));
  }
  return segments.join(':') as TestId;
};

export const deriveTestId = (parent: TestId | undefined, element: string, key?: string): TestId | undefined => {
  if (parent === undefined) return undefined;
  const ownerModule = parent.slice(0, parent.indexOf(':')) || moduleName;
  return createTestId(ownerModule, 'derived', {element: element, key: key === undefined ? parent : `${parent}:${key}`});
};

/** Omits optional testID props instead of passing an explicit undefined through JSX. */
export const testIdProps = (testID: TestId | undefined): Readonly<{readonly testID?: TestId}> =>
  testID === undefined ? Object.freeze({}) : Object.freeze({testID});
