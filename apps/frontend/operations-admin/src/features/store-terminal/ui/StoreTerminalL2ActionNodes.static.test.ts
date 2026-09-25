import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const pageSource = readFileSync(new URL('./StoreTerminalPage.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('./StoreTerminalDetail.tsx', import.meta.url), 'utf8');
const drawerSource = readFileSync(new URL('./StoreTerminalFormDrawer.tsx', import.meta.url), 'utf8');
const printerSource = readFileSync(new URL('./TerminalPrinterEditor.tsx', import.meta.url), 'utf8');
const functionSource = readFileSync(new URL('./TerminalFunctionEditor.tsx', import.meta.url), 'utf8');
const sceneSource = readFileSync(new URL('./TerminalSceneEditor.tsx', import.meta.url), 'utf8');
const testIdsSource = readFileSync(new URL('../storeTerminalTestIds.ts', import.meta.url), 'utf8');
const l2Source = readFileSync(new URL('../../../tests/l2/store-terminal.spec.ts', import.meta.url), 'utf8');

function requireMarker(source: string, marker: string) {
  expect(source, `STORE_TERMINAL_L2_STATIC_MARKER_MISSING:${marker}`).toContain(marker);
}

function requireRealActionNode(source: string, marker: string, node: string) {
  requireMarker(source, marker);
  requireMarker(source, node);
}

describe('store terminal L2 real action-node bindings', () => {
  it('binds status actions to the menu label anchor, not an inner replacement button', () => {
    requireRealActionNode(
      detailSource,
      '<AdminDetailActionLabel',
      'testIdValue={storeTerminalTestIds.statusAction(status)}',
    );
    const mutated = detailSource.replace('<AdminDetailActionLabel', '<span');
    expect(mutated).not.toContain('<AdminDetailActionLabel');
    expect(() =>
      requireRealActionNode(
        mutated,
        '<AdminDetailActionLabel',
        'testIdValue={storeTerminalTestIds.statusAction(status)}',
      ),
    ).toThrow();
  });

  it('binds device type actions to each Radio and scene actions to each Checkbox', () => {
    requireRealActionNode(drawerSource, '<Radio', 'storeTerminalTestIds.deviceTypeOption(value.key)');
    requireRealActionNode(functionSource, '<Checkbox', 'storeTerminalTestIds.sceneToggle(functionIdentity, scene.key)');
    const radioMutation = drawerSource.split('{...testId(storeTerminalTestIds.deviceTypeOption(value.key))}').join('');
    const sceneMutation = functionSource.replace(
      '{...testId(storeTerminalTestIds.sceneToggle(functionIdentity, scene.key))}',
      '',
    );
    expect(() =>
      requireRealActionNode(radioMutation, '<Radio', 'storeTerminalTestIds.deviceTypeOption(value.key)'),
    ).toThrow();
    expect(() =>
      requireRealActionNode(
        sceneMutation,
        '<Checkbox',
        'storeTerminalTestIds.sceneToggle(functionIdentity, scene.key)',
      ),
    ).toThrow();
  });

  it('keeps printer, function, range, scene, retry and recovery controls on app-owned ids', () => {
    for (const marker of [
      'storeTerminalTestIds.listRetry',
      'storeTerminalTestIds.detailRetry',
      'storeTerminalTestIds.pagination',
      'storeTerminalTestIds.formTab(\'basic\')',
      'storeTerminalTestIds.formTab(\'functions\')',
      'storeTerminalTestIds.activationCode',
      'storeTerminalTestIds.activationCodeClear',
      'storeTerminalTestIds.printerAdd',
      'storeTerminalTestIds.printerName(identity)',
      'storeTerminalTestIds.printerBrand(identity)',
      'storeTerminalTestIds.printerModel(identity)',
      'storeTerminalTestIds.printerPaperSpec(identity)',
      'storeTerminalTestIds.printerConnection(identity)',
      'storeTerminalTestIds.printerParameter(identity)',
      'storeTerminalTestIds.printerRemove(identity)',
    ]) {
      requireMarker(pageSource + drawerSource + printerSource, marker);
    }
    for (const marker of [
      'storeTerminalTestIds.functionList',
      'storeTerminalTestIds.functionNav(entry.identity)',
      'storeTerminalTestIds.functionAdd',
      'storeTerminalTestIds.function(functionIdentity)',
      'storeTerminalTestIds.functionRemove(functionIdentity)',
      'storeTerminalTestIds.functionType(functionIdentity)',
      'storeTerminalTestIds.rangeGroup(functionIdentity)',
      'storeTerminalTestIds.rangeOption(functionIdentity, key)',
      'storeTerminalTestIds.areaCandidates(functionIdentity)',
      'storeTerminalTestIds.areaCandidatesRetry(functionIdentity)',
      'storeTerminalTestIds.tagCandidates(functionIdentity)',
      'storeTerminalTestIds.tagCandidatesRetry(functionIdentity)',
      'storeTerminalTestIds.scenePicker(functionIdentity)',
      'storeTerminalTestIds.scene(functionIdentity, scene.key)',
      'storeTerminalTestIds.sceneOrderTypes(functionIdentity, scene.key)',
      'storeTerminalTestIds.sceneOrderType(functionIdentity, scene.key, value.key)',
      'storeTerminalTestIds.scenePrinters(functionIdentity, scene.key)',
    ]) {
      requireMarker(drawerSource + functionSource + sceneSource, marker);
    }
    requireMarker(testIdsSource, 'formTab');
    requireMarker(testIdsSource, 'sceneToggle');
  });

  it('binds candidate read recovery to identity-specific retry buttons', () => {
    requireRealActionNode(
      functionSource,
      'onRetryAreaCandidates',
      'storeTerminalTestIds.areaCandidatesRetry(functionIdentity)',
    );
    requireRealActionNode(
      functionSource,
      'onRetryTagCandidates',
      'storeTerminalTestIds.tagCandidatesRetry(functionIdentity)',
    );
    const areaMutation = functionSource.replace(
      '{...testId(storeTerminalTestIds.areaCandidatesRetry(functionIdentity))}',
      '',
    );
    const tagMutation = functionSource.replace(
      '{...testId(storeTerminalTestIds.tagCandidatesRetry(functionIdentity))}',
      '',
    );
    expect(() =>
      requireRealActionNode(
        areaMutation,
        'onRetryAreaCandidates',
        'storeTerminalTestIds.areaCandidatesRetry(functionIdentity)',
      ),
    ).toThrow();
    expect(() =>
      requireRealActionNode(
        tagMutation,
        'onRetryTagCandidates',
        'storeTerminalTestIds.tagCandidatesRetry(functionIdentity)',
      ),
    ).toThrow();
  });

  it('proves the multi-function create request and detail readback as one aggregate', () => {
    requireMarker(l2Source, 'function assertCreateConfigurationRequest');
    requireMarker(l2Source, 'function assertCreatedConfigurationReadback');
    requireMarker(l2Source, 'const createdTerminalRef = assertCreateConfigurationRequest(runtime, createActionId);');
    requireMarker(l2Source, 'assertCreatedConfigurationReadback(runtime, createdTerminalRef, createActionId);');
    requireMarker(l2Source, "entry.operationId === 'postOperationsStoreTerminal'");
    requireMarker(l2Source, "entry.operationId === 'getOperationsStoreTerminal'");
    const requestAssertionMutation = l2Source.replace(
      'const createdTerminalRef = assertCreateConfigurationRequest(runtime, createActionId);',
      'const createdTerminalRef = String(runtime.facts.terminalRef);',
    );
    expect(requestAssertionMutation).not.toContain('assertCreateConfigurationRequest(runtime, createActionId)');
  });
});
