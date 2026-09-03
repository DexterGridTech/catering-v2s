import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {roleHomeTestIds} from './roleHomeTestIds';

const selectorSource = readFileSync(new URL('./ui/DataScopeSelector.tsx', import.meta.url), 'utf8');
const helperSource = readFileSync(new URL('../../tests/l2/operationsL2.ts', import.meta.url), 'utf8');

describe('operations scope test-id vocabulary', () => {
  it('keeps every scope control under the shared source and binds confirm to the real Button', () => {
    const ids = Object.values(roleHomeTestIds.dataScope);
    expect(new Set(ids).size).toBe(ids.length);
    for (const key of Object.keys(roleHomeTestIds.dataScope)) {
      expect(selectorSource).toContain(`roleHomeTestIds.dataScope.${key}`);
      expect(helperSource).toContain(`roleHomeTestIds.dataScope.${key}`);
    }
    expect(selectorSource).toContain('onClick={() => void submit(candidate)}');
    expect(selectorSource).toContain('testId(roleHomeTestIds.dataScope.confirm)');
    expect(helperSource).not.toContain("getByRole('button', {name: '确认");
  });
});
