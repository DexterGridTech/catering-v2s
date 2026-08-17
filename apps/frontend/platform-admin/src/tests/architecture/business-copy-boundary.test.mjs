import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = name => fs.readFileSync(new URL(`../../features/${name}`, import.meta.url), 'utf8');

test('platform business surfaces hide owner implementation terms and extension field identities', () => {
  const extensionDrawer = source('extension-management/ui/ExtensionDefinitionEditDrawer.tsx');
  const extensionsPage = source('extension-management/ui/ExtensionsPage.tsx');
  const invitations = source('workspace-iam/ui/PlatformInvitationPanel.tsx');
  const roles = source('workspace-iam/ui/RolesPage.tsx');
  const accounts = source('workspace-iam/ui/AccountsPage.tsx');
  assert.match(extensionDrawer, /<Form\.Item name=\{\[field\.name, 'key'\]\} hidden>/);
  assert.doesNotMatch(extensionDrawer + extensionsPage, /字段 key|请填写字段 key|extension-definition-key-display/);
  assert.doesNotMatch(invitations + roles + accounts, /owner 读回|owner 最终校验|最新 owner/);
  assert.match(invitations, /可发出、取消或重发邀请/);
});
