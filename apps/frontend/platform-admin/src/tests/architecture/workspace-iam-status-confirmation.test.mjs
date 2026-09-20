import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../features/workspace-iam/ui/WorkspaceAccountActionModal.tsx', import.meta.url),
  'utf8',
);

test('workspace account status actions use the shared verb-aware confirmation primitive', () => {
  const start = source.indexOf("if (action.kind === 'STATUS')");
  const end = source.indexOf('const content = copy(action, account);', start);
  assert.ok(start >= 0 && end > start, 'status action branch must remain explicit');
  const statusBranch = source.slice(start, end);
  assert.match(statusBranch, /StatusChangeConfirm/);
  assert.match(statusBranch, /actionLabel/);
  assert.match(statusBranch, /confirmTestId/);
  assert.doesNotMatch(statusBranch, /<Modal\b/);
  assert.doesNotMatch(statusBranch, /okText\s*=\s*["']确认["']/);
});
