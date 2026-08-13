import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

test('platform invitation links defer validity to the owner-projected ACTIVE status', () => {
  const panel = readFileSync(new URL('../../features/workspace-iam/ui/PlatformInvitationPanel.tsx', import.meta.url), 'utf8');
  assert.match(panel, /activeInvitationPageUrl\(row\)/);
  assert.match(panel, /operationsInvitationUrl\(activeInvitationPageUrl\(row\)\)/);
  assert.match(panel, /title: '邀请链接'/);
});
