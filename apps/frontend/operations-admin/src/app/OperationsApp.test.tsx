import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsApp.tsx', import.meta.url), 'utf8');

describe('operations shell focused IA contract', () => {
  it('locks shell navigation and context switches on dirty drafts, not only overlay-open state', () => {
    expect(source).toContain('useShellInteractionLock');
    expect(source).toContain('const shellLock = useShellInteractionLock()');
    expect(source).toContain('const locked = shellLock.locked');
    expect(source).toContain("const dirtyDraftPrompt = '请先保存或放弃当前修改'");
    expect(source).toContain("shellLock.dirtyLocked && <Typography.Text type=\"warning\" {...testId('operations-shell-dirty-guard')}>{dirtyDraftPrompt}</Typography.Text>");
    expect(source).toContain('children.push({key: item.key, icon: menuIconByKey[item.key], label: item.page.menuLabel, disabled: locked})');
    expect(source).toContain('if (locked) return;');
    expect(source).toContain("disabled={locked} onSelected={onRoleSelected}");
    expect(source).toContain('disabled={locked}');
    expect(source).toContain('onChanged={onEntry}');
  });

  it('still keeps page and menu labels sourced from catalog metadata instead of raw shell strings', () => {
    expect(source).toContain('label: item.page.menuLabel');
    expect(source).toContain('selectedCatalogPage.pageTitle');
    expect(source).toContain('pageMeta.contentTabLabel');
  });
});
