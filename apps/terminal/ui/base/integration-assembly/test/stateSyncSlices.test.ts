import {describe, expect, it} from 'vitest';
import {selectStateSyncSlices} from '../src';

describe('explicit topology state-sync selection', () => {
  it('filters isolated slices without sorting or deduplicating the supplied list', () => {
    const selected = selectStateSyncSlices([
      {name: 'ui-a', syncIntent: 'master-to-slave'},
      {name: 'private', syncIntent: 'isolated'},
      {name: 'ui-a', syncIntent: 'slave-to-master'},
    ]);
    expect(selected).toEqual([
      {name: 'ui-a', syncIntent: 'master-to-slave'},
      {name: 'ui-a', syncIntent: 'slave-to-master'},
    ]);
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.isFrozen(selected[0])).toBe(true);
  });
});
