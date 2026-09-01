import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../features/inventory-management/ui/InventoryDetailDrawer.tsx', import.meta.url),
  'utf8',
);
const pageSource = fs.readFileSync(
  new URL('../../features/inventory-management/ui/InventoryManagementPage.tsx', import.meta.url),
  'utf8',
);
const actionSource = fs.readFileSync(
  new URL('../../features/inventory-management/ui/InventoryActionModal.tsx', import.meta.url),
  'utf8',
);

test('inventory detail reuses current change summary and renders every zone directly', () => {
  assert.doesNotMatch(source, /useGetOperationsInventoryTargetChangeSummaryQuery/);
  assert.doesNotMatch(source, /getOperationsInventoryTargetChangeSummary/);
  assert.doesNotMatch(source, /changesToday|changes7d|changes30d/);
  assert.match(source, /const currentView = envelopeData<InventoryCurrentView>\(current\.currentData\)/);
  assert.match(source, /currentView\.changeSummary\.today/);
  assert.match(source, /currentView\.changeSummary\.sevenDays/);
  assert.match(source, /currentView\.changeSummary\.thirtyDays/);

  for (const [operation, zone, variable] of [
    ['BusinessHistory', 'history', 'history'],
    ['ConsumptionReferences', 'references', 'references'],
    ['Ledger', 'ledger', 'ledger'],
  ]) {
    assert.match(source, new RegExp(`getOperationsInventoryTarget${operation}`));
    assert.match(source, /\{skip: !open\}/);
    assert.match(source, new RegExp(`${variable}\\.currentData`));
    assert.match(source, new RegExp(`onRetry=\\{\\(\\) => void ${variable}\\.refetch\\(\\)\\}`));
  }

  assert.match(source, /const path = targetRef \? \{targetRef: wireUuid\(targetRef\)\} : undefined/);
  assert.doesNotMatch(source, /envelopeData<InventoryCurrentView>\(current\.data\)/);
  assert.doesNotMatch(source, /refreshAll|onListChanged|onCompleted/);
  assert.match(source, /maskClosable=\{!action\}/);
  assert.match(source, /keyboard=\{!action\}/);
  assert.doesNotMatch(source, /Collapse/);
  assert.doesNotMatch(source, /expandedZones|zoneLoaded|handleZoneChange/);
  assert.match(source, /zoneItems\.map\(item =>/);
});

test('inventory content tab refresh re-reads every open read model without resetting action state', () => {
  assert.match(pageSource, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.match(pageSource, /void refetchNavigation\(\)/);
  assert.match(pageSource, /void refetchList\(\)/);
  assert.match(source, /useRefreshVersion\(operationsContentTabRefreshSignal\)/);
  assert.match(source, /void refetchCurrent\(\)/);
  assert.match(source, /void refetchHistory\(\)/);
  assert.match(source, /void refetchReferences\(\)/);
  assert.match(source, /void refetchLedger\(\)/);
  assert.doesNotMatch(source, /if \(historyLoaded\)|if \(referencesLoaded\)|if \(ledgerLoaded\)/);
  assert.doesNotMatch(
    source,
    /diagnosticsLoaded|refetchDiagnostics|useGetOperationsInventoryTargetDiagnosticsQuery|getOperationsInventoryTargetDiagnostics/,
  );
  assert.match(source, /action-modal form state/);
});

test('inventory action drawer uses the shared close and draft lifecycle', () => {
  assert.match(actionSource, /useDrawerFormLifecycle/);
  assert.match(actionSource, /onClose=\{lifecycle\.requestClose\}/);
  assert.match(actionSource, /afterOpenChange=\{handleAfterOpenChange\}/);
  assert.match(actionSource, /maskClosable=\{!lifecycle\.submitting\}/);
  assert.match(actionSource, /keyboard=\{!lifecycle\.submitting\}/);
  assert.match(actionSource, /lifecycle\.setDirty\(true\)/);
  assert.match(actionSource, /lifecycle\.closeAfterSuccess/);
  assert.doesNotMatch(actionSource, /useSubmissionLifecycle|useOverlayLock/);
});
