import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const source = readFileSync(new URL('./ProjectTerminalUpdatePage.tsx', import.meta.url), 'utf8');
const ruleDetailSource = readFileSync(new URL('../model/useTerminalUpdateRuleDetail.ts', import.meta.url), 'utf8');
const reportDetailSource = readFileSync(new URL('../model/useTerminalUpdateReportDetail.ts', import.meta.url), 'utf8');
const remoteLauncherSource = readFileSync(new URL('../../remote-control/model/useRemoteControlLauncher.ts', import.meta.url), 'utf8');

describe('terminal update detail pagination wiring', () => {
  it('shows the terminal-reported applicationId in the version list and detail', () => {
    expect(source).toContain("title: '实际 applicationId'");
    expect(source).toContain('latestActual.applicationId');
    expect(source).toContain('<Descriptions.Item label="实际 applicationId">{latestApplicationId}</Descriptions.Item>');
  });

  it('uses foundation cursor pagination for rule stores and report history without appending duplicate pages', () => {
    expect(ruleDetailSource).toContain('useCursorStack({resetKey: `${contextKey}:${ruleRef ?? \'\'}`})');
    expect(reportDetailSource).toContain('useCursorStack({resetKey: `${contextKey}:${terminalRef ?? \'\'}`})');
    expect(source).toContain('testIdPrefix={terminalUpdateTestIds.ruleStoresPagination}');
    expect(source).toContain('testIdPrefix={terminalUpdateTestIds.reportHistoryPagination}');
    expect(ruleDetailSource).toContain('setStores(page.items)');
    expect(reportDetailSource).toContain('setHistory(page.items)');
    expect(ruleDetailSource).not.toContain('setStores(current => [...current, ...page.items])');
    expect(reportDetailSource).not.toContain('setHistory(current => [...current, ...page.items])');
    expect(ruleDetailSource).toContain('storesLoadingRef.current');
    expect(reportDetailSource).toContain('historyLoadingRef.current');
    expect(ruleDetailSource).toContain('storePageGeneration.isCurrent(requestGeneration)');
    expect(reportDetailSource).toContain('historyPageGeneration.isCurrent(requestGeneration)');
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
    expect(remoteLauncherSource).toContain('operationsClient.startOperationsTerminalRemoteControl');
    expect(remoteLauncherSource).toContain('operationsClient.endOperationsTerminalRemoteControl');
    expect(source).toContain('contextCurrent={remoteWorkspace.target.contextKey === contextKey}');
    expect(source).toContain('onClose={(sessionId, result) => closeRemoteWorkspace(remoteWorkspace.target, sessionId, result)}');
    expect(source).toContain('<RemoteControlWorkspace');
  });

  it('uses synchronously updated detail identity after asynchronous start and status refreshes', () => {
    expect(source).toContain('selectedReadRefs.current = {...selectedReadRefs.current, ruleRef: row.ruleRef}');
    expect(source).toContain('selectedReadRefs.current = {...selectedReadRefs.current, ruleRef: undefined}');
    expect(source).toContain('selectedReadRefs.current = {...selectedReadRefs.current, terminalRef: row.terminalRef}');
    expect(source).toContain('selectedReadRefs.current = {...selectedReadRefs.current, terminalRef: undefined}');
    expect(source).toContain('selectedReadRefs.current.terminalRef === requestedTerminalRef');
    expect(source).toMatch(/selectedReadRefs\.current\.terminalRef === requestedTerminalRef\s*\)\s*\{/u);
    expect(source).toContain('selectedReadRefs.current.ruleRef === requestedRuleRef');
    expect(source).toContain('await ruleDetailRead.open(requestedRuleRef)');
  });
});
