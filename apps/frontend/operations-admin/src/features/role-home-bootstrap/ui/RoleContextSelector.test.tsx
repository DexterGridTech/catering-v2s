import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const source = await readFile(new URL('./RoleContextSelector.tsx', import.meta.url), 'utf8');

describe('operations role-context focused IA contract', () => {
  it('keeps first selection separate from shell switching while using one owner-confirmed command', () => {
    expect(source).toContain("variant: Variant");
    expect(source).toContain("if (variant === 'header')");
    expect(source).toContain('选择当前角色');
    expect(source).toContain('title="选择当前角色"');
    expect(source).toContain('label="可选角色"');
    expect(source).toContain('aria-label="可选角色"');
    expect(source).toContain('进入运营管理后台');
    expect(source).toContain('当前角色');
    expect(source).toContain('aria-label="当前角色"');
    expect(source).toContain('style={{width: 288}}');
    expect(source).not.toContain('orientation="vertical"');
    expect(source).toContain('if (!selectedRef || entry.candidates.length < 2) return <Space size={8}><Typography.Text>当前角色</Typography.Text>');
    expect(source).toContain('return <Space size={8} align="center"><Typography.Text>当前角色</Typography.Text><Select aria-label="当前角色" style={{width: 288}}');
    expect(source).toContain('暂时无法切换任职，请重试');
    expect(source).toContain(OPERATIONS_ADMIN_OPERATION_IDS.selectOperationsWorkspaceSessionContext);
  });

  it('accepts only owner candidates, keeps assignment protocol opaque, and guards repeated/stale switches', () => {
    expect(source).toContain('entry.candidates.map');
    expect(source).toContain('useAsyncGenerationGuard');
    expect(source).toContain('useSubmissionLifecycle');
    expect(source).toContain('useOverlayLock');
    expect(source).toContain('generation.isCurrent(request)');
    expect(source).toContain("testId('operations-role-context-header')");
    expect(source).toContain("testId('operations-role-context-enter')");
    expect(source).not.toContain('ApiFailure');
    expect(source).not.toContain('error.problem.detail');
  });
});
