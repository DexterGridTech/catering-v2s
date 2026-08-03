import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./ExtensionDefinitionEditDrawer.tsx', import.meta.url), 'utf8');
describe('extension definition edit focused contract', () => it('keeps existing type fixed, clears no-longer-applicable options, and replaces the complete owner set atomically', () => {
  expect(source).toContain('isExisting ? <Input'); expect(source).toContain('readOnly'); expect(source).toContain("type === 'SELECT' && next !== 'SELECT'"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.replaceExtensionDefinition); expect(source).toContain('expectedVersion: definition.revision'); expect(source).toContain("testId('extension-definition-save')");
  expect(source).toContain("extra={<Button type=\"primary\" onClick={addField}");
  expect(source).toContain("testId('extension-definition-add')");
  expect(source).toContain('label="字段 key"'); expect(source).toContain("name={[field.name, 'key']}"); expect(source).toContain('请填写字段 key'); expect(source).toContain('label="字段名称"');
  expect(source).toContain('extension-definition-key-${index}'); expect(source).toContain('extension-definition-key-display-${index}'); expect(source).toContain('已固定'); expect(source).toContain('hidden><Input /></Form.Item>'); expect(source).toContain('key: field.key.trim()');
  expect(source).toContain('draggable'); expect(source).toContain('move(dragIndex, target)');
  expect(source).not.toContain('extension-definition-move-up-'); expect(source).not.toContain('extension-definition-move-down-');
}));
