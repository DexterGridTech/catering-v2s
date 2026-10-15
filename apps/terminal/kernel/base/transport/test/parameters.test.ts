import {describe, expect, it} from 'vitest';
import {transportParameters} from '../src/index';

describe('transport parameter definitions', () => {
  const definition = transportParameters.reconnectPolicy;

  it('accepts the declared default and a valid policy override', () => {
    expect(definition.validate?.(definition.defaultValue)).toBe(true);
    expect(
      definition.validate?.({
        ...definition.defaultValue,
        initialDelayMs: 5_000,
        maximumDelayMs: 60_000,
      }),
    ).toBe(true);
  });

  it('rejects invalid policy overrides', () => {
    expect(definition.validate?.({...definition.defaultValue, initialDelayMs: 0})).toBe(false);
    expect(definition.validate?.({...definition.defaultValue, maximumJitterRatio: -1})).toBe(false);
    expect(definition.validate?.({...definition.defaultValue, cappedDelayFloorRatio: 1.1})).toBe(false);
    expect(
      definition.validate?.({
        ...definition.defaultValue,
        initialDelayMs: definition.defaultValue.maximumDelayMs + 1,
      }),
    ).toBe(false);
  });
});
