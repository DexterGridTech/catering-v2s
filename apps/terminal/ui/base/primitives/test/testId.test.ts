import {describe, expect, it} from 'vitest';
import {createTestId, testIdProps} from '../src/foundations/testId';

describe('createTestId', () => {
  it('keeps module ownership and encodes dynamic keys without adding a surface segment', () => {
    expect(createTestId('ui.feature.example', 'member', {element: 'row', key: 'store:one'})).toBe(
      'ui.feature.example:member:row:store%3Aone',
    );
  });

  it('rejects empty or delimiter-bearing fixed segments', () => {
    expect(() => createTestId('ui.feature.example', 'member:row')).toThrow('Invalid part segment for testID');
    expect(() => createTestId('ui.feature.example', 'member', {element: ''})).toThrow(
      'Invalid element segment for testID',
    );
  });

  it('omits an undefined optional ID and keeps a strongly typed ID as the testID property', () => {
    const id = createTestId('ui.feature.example', 'member', {element: 'row'});
    expect(testIdProps(undefined)).toEqual({});
    expect(testIdProps(id)).toEqual({testID: id});
  });
});
