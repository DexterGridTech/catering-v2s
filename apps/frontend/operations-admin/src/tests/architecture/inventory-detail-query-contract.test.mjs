import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(
  new URL('../../features/inventory-management/ui/InventoryDetailDrawer.tsx', import.meta.url),
  'utf8',
);

test('inventory detail reuses current change summary and keeps paged zones lazy', () => {
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
    assert.match(source, new RegExp(`skip: !zoneLoaded\\('${zone}'\\)`));
    assert.match(source, new RegExp(`${variable}\\.currentData`));
    assert.match(source, new RegExp(`onRetry=\\{\\(\\) => void ${variable}\\.refetch\\(\\)\\}`));
  }

  assert.match(source, /const path = targetRef \? \{targetRef: wireUuid\(targetRef\)\} : undefined/);
  assert.doesNotMatch(source, /envelopeData<InventoryCurrentView>\(current\.data\)/);
  assert.doesNotMatch(source, /refreshAll|onListChanged|onCompleted/);
});
