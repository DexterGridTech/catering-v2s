import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./ExtensionsPage.tsx', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('./ExtensionDefinitionEditDrawer.tsx', import.meta.url), 'utf8');
describe('extension definitions page focused contract', () => it('uses catalog title, fixed owner object rail, scoped reads and no operation column', () => {
  expect(source).toContain('adminCatalog.platformPages.find'); expect(source).toContain('contextScopedQueryArgs'); expect(source).toContain("testId('extension-category-selector')"); expect(source).toContain('ExtensionDefinitionSaveModal'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  expect(source).toContain('<Card size="small" title="业务对象"'); expect(source).toContain("选择一个对象，查看并维护其完整字段配置。"); expect(source).toContain('字段配置按对象分别维护，不会混用。'); expect(source).toContain('正在读取字段配置'); expect(source).toContain('编辑字段');
  expect(source).toContain("testId('extension-catalog-retry')"); expect(source).toContain("testId('extension-definition-retry')"); expect(source).toContain('(!definition && !definitionProblem)'); expect(source).toContain('暂时无法获取${selected.displayName}字段配置');
  expect(source).toContain("{title: '字段 key', dataIndex: 'key'}"); expect(source).toContain("{title: '字段名称', dataIndex: 'label'}");
  expect(editorSource).toContain("extra={<Button type=\"primary\" onClick={addField}");
  expect(editorSource).toContain('draggable'); expect(editorSource).toContain('onDrop={() => onDrop(index)}');
  expect(editorSource).not.toContain('extension-definition-move-up-'); expect(editorSource).not.toContain('extension-definition-move-down-');
}));
