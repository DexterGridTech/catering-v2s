import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./WorkspaceDetailDrawer.tsx', import.meta.url), 'utf8');
describe('workspace detail focused contract', () => it('places approved mutations behind the owner-backed detail rather than in a list column', () => {
  expect(source).toContain('useOverlayLock(Boolean(workspace))'); expect(source).toContain("testId('platform-workspace-edit')"); expect(source).toContain("testId('platform-workspace-status')"); expect(source).toContain("testId('platform-workspace-initialize')");
  expect(source).not.toContain('destroyOnHidden');
}));
