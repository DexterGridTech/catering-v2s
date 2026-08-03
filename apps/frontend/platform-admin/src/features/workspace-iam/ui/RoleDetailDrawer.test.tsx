import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./RoleDetailDrawer.tsx', import.meta.url), 'utf8');
describe('workspace role detail focused contract', () => it('provides owner-readback details before the separate edit and status surfaces', () => {
  expect(source).toContain("testId('workspace-role-detail-drawer')"); expect(source).toContain("testId('workspace-role-edit')"); expect(source).toContain("testId('workspace-role-transition-status')"); expect(source).toContain('useOverlayLock(open)'); expect(source).not.toContain('destroyOnHidden'); expect(source).not.toContain('destroyOnClose');
}));
