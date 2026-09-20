import {describe, expect, it} from 'vitest';
import {formatCanonicalDateTime} from './formatCanonicalDateTime';

describe('formatCanonicalDateTime', () => {
  it('distinguishes empty field values from a valid timestamp', () => {
    expect(formatCanonicalDateTime(null)).toBe('—');
    expect(formatCanonicalDateTime(0)).toBe('—');
    expect(formatCanonicalDateTime('')).toBe('—');
    expect(formatCanonicalDateTime(Date.UTC(2026, 0, 2, 3, 4, 5))).toContain('2026年1月2日');
    expect(formatCanonicalDateTime(Date.UTC(2026, 0, 2, 3, 4, 5))).toContain('11:04:05');
  });

  it('uses the canonical Shanghai timezone independent of the host timezone', () => {
    const formatted = formatCanonicalDateTime(Date.UTC(2026, 0, 2, 0, 0, 0));

    expect(formatted).toContain('2026年1月2日');
    expect(formatted).toMatch(/(?:上午)?0?8:00:00/);
  });
});
