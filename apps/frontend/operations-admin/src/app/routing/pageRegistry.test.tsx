import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./pageRegistry.tsx', import.meta.url), 'utf8');

describe('operations page registry focused contract', () => {
  it('maps only generated catalog keys to fixed physical consumers without deriving authority', () => {
    expect(source).toContain('adminCatalog.operationsPages');
    expect(source).toContain('operationsPageDesignKeys.PgOrgBrand');
    expect(source).toContain('operationsPageDesignKeys.PgOrgTenant');
    expect(source).toContain('Component: businessEntity(operationsPageDesignKeys.PgOrgBrand)');
    expect(source).toContain('Component: businessEntity(operationsPageDesignKeys.PgOrgTenant)');
    expect(source).toContain('Component: StoreProfilePage');
    expect(source).not.toMatch(/fetch\(|operationsClient\.|capabilit(?:y|ies)\s*\(/);
  });
});
