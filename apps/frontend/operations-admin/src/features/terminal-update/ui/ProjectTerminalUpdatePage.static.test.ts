import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const source = readFileSync(new URL('./ProjectTerminalUpdatePage.tsx', import.meta.url), 'utf8');

describe('terminal update detail pagination wiring', () => {
  it('uses foundation cursor pagination for rule stores and report history without appending duplicate pages', () => {
    expect(source).toContain('useCursorStack({resetKey: `${contextKey}:${detail?.ruleRef ?? \'\'}`})');
    expect(source).toContain('useCursorStack({resetKey: `${contextKey}:${versionDetail?.terminalRef ?? \'\'}`})');
    expect(source).toContain('testIdPrefix={terminalUpdateTestIds.ruleStoresPagination}');
    expect(source).toContain('testIdPrefix={terminalUpdateTestIds.reportHistoryPagination}');
    expect(source).toContain('setRuleStores(page.items)');
    expect(source).toContain('setHistory(page.items)');
    expect(source).not.toContain('setRuleStores(current => [...current, ...page.items])');
    expect(source).not.toContain('setHistory(current => [...current, ...page.items])');
    expect(source).toContain('ruleStorePageLoadingRef.current');
    expect(source).toContain('historyPageLoadingRef.current');
    expect(source).toContain('ruleStorePageRequestId.current !== requestId');
    expect(source).toContain('historyPageRequestId.current !== requestId');
    expect(source).not.toContain('loadMoreRuleStores');
    expect(source).not.toContain('loadMoreHistory');
  });
});
