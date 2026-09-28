import {describe, expect, it} from 'vitest';
import {createInputRegistry} from '../src/foundations/snapshot';

describe('input snapshot registry', () => {
  it('captures current values synchronously as a frozen snapshot', () => {
    const registry = createInputRegistry();
    const token = registry.register({fieldId: 'first', value: 'Alice', selection: {start: 5}});
    registry.updateValue(token, 'Bob');

    const snapshot = registry.capture();

    expect(snapshot).toEqual({
      revision: 1,
      fields: {first: {value: 'Bob', selection: {start: 3, end: 3}}},
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.fields)).toBe(true);
    expect(Object.isFrozen(snapshot.fields.first)).toBe(true);
  });

  it('rejects duplicate live field ids and old cleanup cannot remove a replacement', () => {
    const registry = createInputRegistry();
    const first = registry.register({fieldId: 'field', value: 'A'});
    expect(() => registry.register({fieldId: 'field', value: 'B'})).toThrow('field');

    registry.unregister(first);
    const replacement = registry.register({fieldId: 'field', value: 'B'});
    registry.unregister(first);
    expect(registry.capture().fields).toEqual({field: {value: 'B', selection: {start: 1, end: 1}}});

    registry.unregister(replacement);
    expect(registry.capture().fields).toEqual({});
  });

  it('does not restore an unregistered field from a later React value', () => {
    const registry = createInputRegistry();
    const first = registry.register({fieldId: 'first', value: 'A'});
    const second = registry.register({fieldId: 'second', value: 'B'});
    registry.unregister(first);
    registry.updateValue(second, 'B2');

    expect(registry.capture().fields).toEqual({second: {value: 'B2', selection: {start: 1, end: 1}}});
  });
});
