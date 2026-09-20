import {describe, expect, it} from 'vitest';
import {
  canManageWorkspaceIam,
  canVoidWorkspaceIam,
  toggleWorkspaceIamStatus,
  workspaceIamLifecycleLabels,
} from './workspaceIamLifecycle';

describe('workspace IAM lifecycle presentation', () => {
  it('covers all three lifecycle labels', () => {
    expect(workspaceIamLifecycleLabels).toEqual({ENABLED: '启用', DISABLED: '停用', VOIDED: '作废'});
  });

  it.each([
    ['ENABLED', true, 'DISABLED'],
    ['DISABLED', true, 'ENABLED'],
    ['VOIDED', false, undefined],
  ] as const)('uses terminal semantics for %s', (status, manageable, next) => {
    expect(canManageWorkspaceIam(status)).toBe(manageable);
    expect(toggleWorkspaceIamStatus(status)).toBe(next);
    expect(canVoidWorkspaceIam(status)).toBe(status !== 'VOIDED');
  });
});
