import assert from 'node:assert/strict';
import test from 'node:test';
import {plan, validate} from './sales-menu-seed-plan.mjs';

test('sales-menu seed plan owns only menu facts and declares the required r5 prerequisites', () => {
  const result = validate();
  assert.equal(result.stageId, 'sales-menu');
  assert.deepEqual(result.prerequisiteStages, ['owner-command', 'external-collaboration-business-channel', 'catalog-inventory']);
  assert.equal(result.menuDefinitions.length, 21);
  assert.equal(result.selectors.businessChannel.accessKind, 'INTERNAL');
  assert.equal(result.selectors.businessChannel.requiredCount, 2);
  assert.equal(new Set(result.menuDefinitions.filter((entry) => entry.activation === 'ENABLED').map((entry) => entry.channelSelectorIndex)).size, 1);
  assert.equal(result.selectors.catalog.ownerReadback, 'getOperationsCatalogItem');
  assert.equal(result.salesMenuReadbacks.candidateReadback, 'getOperationsSalesMenuItemCandidates');
  assert.equal(result.primaryDefinition.items.length, 21);
  assert.equal(new Set(result.primaryDefinition.items.map((entry) => entry.catalogSelectorIndex)).size, 20);
  assert.equal(result.primaryDefinition.items.find((entry) => entry.duplicateOf)?.catalogSelectorIndex, 0);
  assert.equal(result.primaryDefinition.items.find((entry) => entry.code === 'R5-SALES-ITEM-19')?.listedPriceCents, 5200);
  assert.equal(result.primaryDefinition.items.find((entry) => entry.code === 'R5-SALES-ITEM-20')?.listedPriceCents, 200);
  assert.deepEqual(result.secondaryDefinition.schedule, {kind: 'DAILY_TIME_RANGE', startLocalTime: '11:00', endLocalTime: '14:00'});
  assert.deepEqual(result.availabilityDefinition, {menuCode: 'R5-SALES-MENU-06', sectionName: '库存状态', sourceReceiptStage: 'catalog-inventory', expectedItemCount: 6});
  assert.ok(result.exclusions.includes('l2-fixture-reference'));
  assert.ok(result.exclusions.includes('direct-database-write'));
});

test('sales-menu seed plan rejects prerequisite, channel, pagination and L2-reuse drift', () => {
  const rejected = (mutate, expected) => {
    const next = structuredClone(plan);
    mutate(next);
    assert.throws(() => validate(next), new RegExp(expected));
  };
  rejected((next) => { next.prerequisiteStages.reverse(); }, 'SALES_MENU_SEED_PLAN_STAGE_ORDER_INVALID');
  rejected((next) => { next.selectors.businessChannel.accessKind = 'EXTERNAL'; }, 'SALES_MENU_SEED_CHANNEL_SELECTOR_INVALID');
  rejected((next) => { next.primaryDefinition.items.pop(); }, 'SALES_MENU_SEED_DEFINITION_DENOMINATOR_INVALID');
  rejected((next) => { next.menuOwnedStateMatrix.saleDefinitions.pop(); }, 'SALES_MENU_SEED_STATE_MATRIX_INVALID');
  rejected((next) => { next.menuDefinitions[1].channelSelectorIndex = 1; }, 'SALES_MENU_SEED_ACTIVATION_DENOMINATOR_INVALID');
  rejected((next) => { next.secondaryDefinition.schedule.kind = 'ALL_DAY'; }, 'SALES_MENU_SEED_SECONDARY_SHAPE_INVALID');
  rejected((next) => { next.menuOwnedStateMatrix.inventoryAvailability = ['NORMAL']; }, 'SALES_MENU_SEED_CROSS_OWNER_MATRIX_INVALID');
  rejected((next) => { next.availabilityDefinition.expectedItemCount = 5; }, 'SALES_MENU_SEED_AVAILABILITY_DEFINITION_INVALID');
  rejected((next) => { next.exclusions = next.exclusions.filter((entry) => entry !== 'l2-fixture-reference'); }, 'SALES_MENU_SEED_EXCLUSION_INVALID');
});
