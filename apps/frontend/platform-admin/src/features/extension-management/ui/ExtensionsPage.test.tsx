import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./ExtensionsPage.tsx', import.meta.url), 'utf8');
describe('extension definitions page focused contract', () => it('uses catalog title, fixed owner object rail, scoped reads and no operation column', () => {
  expect(source).toContain('adminCatalog.platformPages.find'); expect(source).toContain('contextScopedQueryArgs'); expect(source).toContain("testId('extension-category-selector')"); expect(source).toContain('ExtensionDefinitionSaveModal'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
}));
