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

  it('uses the terminal update testId source for report reset and pagination controls', () => {
    const ids = readFileSync(new URL('../../../app/automation/terminalUpdateTestIds.ts', import.meta.url), 'utf8');
    expect(ids).toContain("reportQueryReset: 'terminal-update-report-filter-reset'");
    expect(ids).toContain("reportPagination: 'terminal-update-report-pagination'");
    expect(source).toContain('testId(terminalUpdateTestIds.reportQueryReset)');
    expect(source).toContain('testIdPrefix={terminalUpdateTestIds.reportPagination}');
    expect(source).not.toContain("testId('terminal-update-report-filter-reset')");
    expect(source).not.toContain('testIdPrefix="terminal-update-report-pagination"');
  });
});

describe('remote control entry wiring', () => {
  it('shows the remote action only with its capability and current online state', () => {
    expect(source).toContain("actionCapabilityKeys.includes('CONTROL_PROJECT_TERMINAL')");
    expect(source).toContain("actionCapabilityKeys.includes('MANAGE_PROJECT_TERMINAL_VERSION')");
    expect(source).toContain("versionDetail.connectionStatus !== 'ONLINE'");
    expect(source).toContain('AdminDetailActionMenu');
    expect(source).toContain('remoteControlTestIds.detailActions(versionDetail.terminalRef)');
    expect(source).toContain("'data-testid': remoteControlTestIds.start(versionDetail.terminalRef)");
    expect(source).not.toContain('AdminDetailActionLabel testIdValue={remoteControlTestIds.start');
  });

  it('starts through the generated owner API and mounts the workspace with context-bound cleanup', () => {
    expect(source).toContain('operationsClient.startOperationsTerminalRemoteControl');
    expect(source).toContain('operationsClient.endOperationsTerminalRemoteControl');
    expect(source).toContain('contextCurrent={remoteWorkspace.target.contextKey === contextKey}');
    expect(source).toContain('onClose={result => closeRemoteWorkspace(remoteWorkspace, result)}');
    expect(source).toContain('<RemoteControlWorkspace');
  });
});
