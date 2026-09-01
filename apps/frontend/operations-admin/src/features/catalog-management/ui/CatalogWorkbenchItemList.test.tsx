import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {CatalogWorkbenchItemList} from './CatalogWorkbenchItemList';
import {catalogTestIds} from '../catalogTestIds';

describe('catalog workbench item list', () => {
  it('keeps the selection summary in the 商品列表 card header', () => {
    const markup = renderToStaticMarkup(
      <CatalogWorkbenchItemList
        resultLabel="全部商品"
        keyword=""
        statusOptions={[]}
        sourceOptions={[]}
        onKeywordChange={() => undefined}
        onKeywordSearch={() => undefined}
        onStatusChange={() => undefined}
        onSourceChange={() => undefined}
        onReset={() => undefined}
        onRefresh={() => undefined}
        selectedRows={['ITEM-001']}
        canWrite
        onBatchAction={() => undefined}
        onClearSelection={() => undefined}
        page={{items: [], cursor: ''}}
        cursorState={{page: 1, canPrevious: false, goToPage: () => undefined}}
        skuChildrenByItem={{}}
        skuCacheIdentity="catalog-workbench-test"
        expandedRows={[]}
        failed={false}
        scopeReady
        noAuthorizedBrand={false}
        loading={false}
        onSelectedRowsChange={() => undefined}
        onTableExpand={() => undefined}
        onOpenDetail={() => undefined}
        loadSkuPage={async () => undefined}
      />,
    );

    const cardHeadIndex = markup.indexOf('ant-card-head');
    const cardBodyIndex = markup.lastIndexOf('ant-card-body');
    const listTitleIndex = markup.indexOf('商品列表');
    const selectionSummaryIndex = markup.indexOf(`data-testid="${catalogTestIds.static.inventorySelectionSummary}"`);

    expect(cardHeadIndex).toBeGreaterThanOrEqual(0);
    expect(listTitleIndex).toBeGreaterThan(cardHeadIndex);
    expect(selectionSummaryIndex).toBeGreaterThan(listTitleIndex);
    expect(selectionSummaryIndex).toBeLessThan(cardBodyIndex);
  });
});
