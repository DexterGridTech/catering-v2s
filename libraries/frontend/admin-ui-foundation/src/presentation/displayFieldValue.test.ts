import {describe, expect, it} from 'vitest';
import {displayFieldValue} from './displayFieldValue';

describe('displayFieldValue', () => {
  it('uses a dash only for field-level empty values', () => {
    expect(displayFieldValue(null)).toBe('—');
    expect(displayFieldValue(undefined)).toBe('—');
    expect(displayFieldValue('')).toBe('—');
    expect(displayFieldValue('  ')).toBe('—');
    expect(displayFieldValue(0)).toBe('0');
    expect(displayFieldValue(false)).toBe('false');
  });
});
