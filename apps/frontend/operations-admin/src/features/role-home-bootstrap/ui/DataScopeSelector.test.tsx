import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const source = await readFile(new URL('./DataScopeSelector.tsx', import.meta.url), 'utf8');

describe('operations data-scope focused IA contract', () => {
  it('keeps the scope selector in a right-bottom sidebar Popover and hides it when the page has no scope requirement', () => {
    expect(source).toContain("if (requiredDataNodeType === 'NONE') return null");
    expect(source).toContain('placement="rightBottom"');
    expect(source).toContain('选择可查看范围');
    expect(source).toContain('请选择本次需要查看的机构');
    expect(source).toContain("page?.noDataNodePrompt ?? '请选择可查看范围'");
    expect(source).toContain("page?.noCandidatePrompt ?? '当前任职没有可查看范围'");
    expect(source).toContain("testId('operations-data-scope-trigger')");
    expect(source).toContain('collapsed = false');
    expect(source).toContain('icon={collapsed ? <ApartmentOutlined/> : undefined}');
    expect(source).toContain('aria-label={collapsed ? `可查看范围：${selectedName}` : undefined}');
  });

  it('derives the region-project-store cascade only from owner candidates and submits the final owner candidate immediately', () => {
    expect(source).toContain('entry.dataNodeCandidates ?? []');
    expect(source).toContain("page?.cascadeLevelLabels ?? []");
    expect(source).toContain('setRegionRef(value); setProjectRef(undefined)');
    expect(source).toContain("candidate.dataNodeType === requiredDataNodeType");
    expect(source).toContain(OPERATIONS_ADMIN_OPERATION_IDS.selectOperationsWorkspaceSessionDataNode);
    expect(source).toContain('setOpen(false)');
    expect(source).toContain('暂时无法设置可查看范围，请重试');
    expect(source).toContain('useAsyncGenerationGuard');
    expect(source).toContain('useSubmissionLifecycle');
    expect(source).toContain('useOverlayLock');
    expect(source).not.toContain('ApiFailure');
    expect(source).not.toContain('error.problem.detail');
  });
});
