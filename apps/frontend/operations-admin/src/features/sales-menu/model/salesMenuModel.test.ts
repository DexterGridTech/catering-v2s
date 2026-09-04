import {describe, expect, it} from 'vitest';
import {createContentIdempotencyKey} from '@catering-v2s/admin-ui-foundation';
import {
  SALES_MENU_PAGE_SIZE,
  SALES_MENU_OPERATION_COLUMN_TITLE,
  mergeSalesMenuCandidateSelection,
  salesMenuCandidateSelection,
  salesMenuCommandIdempotencyPayload,
  salesMenuManualSaleStatusLabel,
  salesMenuOperationLabel,
  salesMenuProductShapeLabel,
  salesMenuQueryIdentity,
} from './salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';

describe('sales menu frontend model', () => {
  it('keeps the cursor page size fixed and translates the closed product-shape set', () => {
    expect(SALES_MENU_PAGE_SIZE).toBe(20);
    expect((['ORDINARY', 'SKU', 'WEIGHTED', 'COMPOSITE', 'SERVICE'] as const).map(salesMenuProductShapeLabel)).toEqual([
      '普通销售商品',
      '按规格管理商品',
      '称重销售商品',
      '商品型套餐',
      '服务、费用商品',
    ]);
  });

  it('makes every collection identity explicit instead of sharing a cursor', () => {
    const base = salesMenuQueryIdentity({
      scopeRef: 'store-1',
      channelRef: 'channel-1',
      menuRef: 'menu-1',
      mode: 'DRAFT',
      sectionRef: 'section-1',
      query: '拿铁',
      categoryRef: 'category-1',
      publication: 'published-1',
    });
    expect(base).toContain('store-1');
    expect(base).toContain('channel-1');
    expect(base).toContain('menu-1');
    expect(base).toContain('DRAFT');
    expect(base).toContain('section-1');
    expect(base).toContain('拿铁');
    expect(base).toContain('category-1');
    expect(base).toContain('published-1');
    expect(salesMenuQueryIdentity({scopeRef: 'store-1', channelRef: 'channel-1', mode: 'PUBLISHED'})).not.toBe(base);
  });

  it('binds content idempotency to the full sales-menu command target', async () => {
    const body = {status: 'DISABLED', expectedVersion: 2};
    const primary = {
      groupWorkspaceKey: 'workspace-1',
      storeRef: 'store-1',
      salesMenuRef: 'menu-1',
      channelRef: 'channel-1',
    };
    const sameTarget = await createContentIdempotencyKey(
      'setOperationsSalesMenuActivation',
      salesMenuCommandIdempotencyPayload(primary, body),
    );
    const replay = await createContentIdempotencyKey(
      'setOperationsSalesMenuActivation',
      salesMenuCommandIdempotencyPayload({...primary}, {...body}),
    );
    const anotherMenu = await createContentIdempotencyKey(
      'setOperationsSalesMenuActivation',
      salesMenuCommandIdempotencyPayload({...primary, salesMenuRef: 'menu-2'}, body),
    );
    const anotherChannel = await createContentIdempotencyKey(
      'setOperationsSalesMenuActivation',
      salesMenuCommandIdempotencyPayload({...primary, channelRef: 'channel-2'}, body),
    );

    expect(sameTarget).toBe(replay);
    expect(sameTarget).not.toBe(anotherMenu);
    expect(sameTarget).not.toBe(anotherChannel);
  });

  it('keeps page controls and visible copy under one stable test-id source', () => {
    expect(salesMenuTestIds.page).toBe('sales-menu-page');
    expect(salesMenuTestIds.channelCard('channel-1')).toBe('sales-menu-channel-channel-1');
    expect(salesMenuTestIds.mode('DRAFT')).toBe('sales-menu-mode-draft');
    expect(salesMenuTestIds.menuSelector).toBe('sales-menu-selector');
    expect(salesMenuTestIds.menuOption('menu-1')).toBe('sales-menu-option-menu-1');
    expect(salesMenuTestIds.candidateCategoryTree).toBe('sales-menu-candidate-category-tree');
  });

  it('keeps user-facing operation and status dictionaries closed', () => {
    expect(
      salesMenuManualSaleStatusLabel({
        state: 'MANUAL_SOLD_OUT',
        reason: '售罄',
        changedAt: 1,
        changedByDisplayName: '操作员',
      }),
    ).toBe('已沽清');
    expect(salesMenuOperationLabel('publishOperationsSalesMenu')).toBe('更新到前台');
    expect(salesMenuOperationLabel('unregistered-operation')).toBe('菜单操作');
  });

  it('keeps operation-column copy centralized and preserves selected candidate identity across cursor pages', () => {
    expect(SALES_MENU_OPERATION_COLUMN_TITLE).toBe('操作');
    expect(salesMenuCandidateSelection(['candidate-1', 'candidate-2'], ['candidate-2'])).toEqual({
      hiddenSelectedCount: 1,
      visibleSelected: ['candidate-2'],
      canSubmit: true,
    });
    expect(salesMenuCandidateSelection(['candidate-2'], ['candidate-2'])).toEqual({
      hiddenSelectedCount: 0,
      visibleSelected: ['candidate-2'],
      canSubmit: true,
    });
    expect(mergeSalesMenuCandidateSelection(['candidate-1'], ['candidate-2'], ['candidate-2'])).toEqual([
      'candidate-1',
      'candidate-2',
    ]);
    expect(mergeSalesMenuCandidateSelection(['candidate-1', 'candidate-2'], ['candidate-2'], [])).toEqual([
      'candidate-1',
    ]);
  });
});
