import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('extension definition uses the approved page-to-edit path and no unapproved detail surface', async () => {
  const [page, drawer, modal] = await Promise.all([
    read('./ExtensionsPage.tsx'), read('./ExtensionDefinitionEditDrawer.tsx'), read('./ExtensionDefinitionSaveModal.tsx'),
  ]);
  assert.match(page, /setEditingDefinition\(definition\)/);
  assert.match(page, /extension-definition-edit/);
  assert.doesNotMatch(page, /useDetailDrawer/);
  assert.doesNotMatch(page, /字段配置详情|查看详情|<Drawer/);
  assert.doesNotMatch(page, /onRow=/);
  assert.doesNotMatch(page, /title:\s*['"]操作['"]/);
  assert.match(drawer, /useDrawerFormLifecycle/);
  assert.match(drawer, /useSubmissionLifecycle/);
  assert.match(drawer, /replaceExtensionDefinition/);
  assert.match(drawer, /headers: \{'Idempotency-Key': getIdempotencyKey\(\)\}/);
  assert.match(drawer, /key: field\.key\.trim\(\)/);
  assert.doesNotMatch(drawer, /randomUUID|crypto\.random/);
  assert.match(drawer, /type === 'SELECT' &&/);
  assert.match(drawer, /清除单选选项/);
  assert.match(drawer, /isExisting \? <Input/);
  assert.doesNotMatch(drawer, /显示后缀/);
  assert.doesNotMatch(drawer, /extension-definition-move-up-/);
  assert.match(modal, /useOverlayLock/);
  assert.match(modal, /字段配置已更新。/);
  assert.match(modal, /查看最新配置/);
});
