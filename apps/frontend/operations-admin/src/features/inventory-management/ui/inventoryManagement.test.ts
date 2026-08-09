import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {envelopeData, shouldRequestInventoryDiagnostics} from './inventoryManagementModel';

const page = await readFile(new URL('./InventoryManagementPage.tsx', import.meta.url), 'utf8');
const detail = await readFile(new URL('./InventoryDetailDrawer.tsx', import.meta.url), 'utf8');
const action = await readFile(new URL('./InventoryActionModal.tsx', import.meta.url), 'utf8');

describe('inventory management focused contract', () => {
  it('renders the approved compact inventory workbench without an independent create action', () => {
    expect(page).toContain('<ProTable<InventoryTargetSummary>');
    expect(page).toContain('size="small"');
    expect(page).toContain('NameCodeText');
    expect(page).toContain('全部');
    expect(page).toContain('需处理');
    expect(page).toContain('低库存');
    expect(page).toContain('无库存');
    expect(page).toContain('负库存');
    expect(page).toContain('未知');
    expect(page).toContain('今日 / 7天 / 30天');
    expect(page).not.toContain('新建库存对象');
    expect(page).not.toContain('导出');
  });

  it('uses server-owned stock views and full-scope counts instead of current-page filtering', () => {
    expect(page).toContain('stockView: view');
    expect(page).toContain('page?.counts');
    expect(page).not.toContain('matchesStockView(row, view)');
    expect(page).not.toContain('filter((row) => matchesStockView');
  });

  it('keeps all six detail zones distinct and diagnostics as a scoped read', () => {
    for (const title of ['当前状态', '库存变化', '盘点与库存增加历史', '关联商品与扣减规则', '全部变化记录', '高级诊断']) {
      expect(detail).toContain(title);
    }
    expect(detail).toContain('adminWideDrawerSurfaceProps');
    expect(detail).toContain('adminWideDetailDescriptionsProps');
    expect(detail).toContain('useGetOperationsInventoryTargetDiagnosticsQuery');
    expect(detail).toContain('skip: !shouldRequestInventoryDiagnostics');
    expect(detail).not.toContain('diagnosticsAvailability');
    expect(shouldRequestInventoryDiagnostics(true)).toBe(true);
    expect(shouldRequestInventoryDiagnostics(false)).toBe(false);
  });

  it('gates inventory mutations with the store-inventory capability only', () => {
    expect(page).toContain('EDIT_STORE_INVENTORY');
    expect(page).not.toContain('EDIT_CATALOG_LIBRARY');
  });

  it('keeps cursor pagination independent for each pageable detail zone', () => {
    expect(detail).toContain('historyCursors');
    expect(detail).toContain('referenceCursors');
    expect(detail).toContain('ledgerCursors');
    expect(detail).toContain('cursor: historyCursor');
    expect(detail).toContain('cursor: referenceCursor');
    expect(detail).toContain('cursor: ledgerCursor');
    expect(detail).toContain('current: historyCursors.length');
    expect(detail).toContain('current: referenceCursors.length');
    expect(detail).toContain('current: ledgerCursors.length');
  });

  it('keeps four generated write operations behind one reusable result surface', () => {
    expect(action).toContain('useCountOperationsInventoryTargetMutation');
    expect(action).toContain('useIncreaseOperationsInventoryTargetMutation');
    expect(action).toContain('useAdjustOperationsInventoryTargetMutation');
    expect(action).toContain('useUpdateOperationsInventoryTargetConfigurationMutation');
    expect(action).toContain('adminDrawerSurfaceProps');
    expect(action).toContain('<Drawer');
    expect(action).toContain('操作结果');
    expect(action).toContain('变更前');
    expect(action).toContain('变更量');
    expect(action).toContain('变更后');
    expect(action).toContain('流水号');
    expect(action).toContain('unit');
    expect(action).toContain('note');
    expect(action).not.toContain('remark');
    expect(action).toContain('zeroConfirmation');
    expect(action).toContain('reasonOptions');
    expect(action).toContain('countingUnit');
    expect(action).toContain('conversionFactor');
    expect(action).toContain('negativeBlocked');
    expect(action).not.toContain('contractGap');
    expect(action).not.toContain('当前生成契约尚未提供快捷配置业务字段');
  });

  it('threads the selected scope through each inventory mutation without an unsafe cast', () => {
    expect(page).toContain('queryContext={queryContext}');
    expect(detail).toContain('queryContext={queryContext}');
    expect(action).toContain('const common = {dataNodeRef: requireOperationsScopeRef(queryContext)');
    expect(action).not.toContain('as Inventory');
  });

  it('decodes both enveloped pages and raw detail read models', () => {
    expect(envelopeData<{items: string[]}>({data: {items: ['page']}} as never)).toEqual({items: ['page']});
    expect(envelopeData<{target: {productCode: string}}>({target: {productCode: 'LATTE-001'}} as never)).toEqual({target: {productCode: 'LATTE-001'}});
  });
});
