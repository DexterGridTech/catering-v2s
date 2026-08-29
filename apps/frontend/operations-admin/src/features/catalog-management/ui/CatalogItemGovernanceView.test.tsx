import {describe, expect, it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import type {CatalogDetail} from '../model/catalogModel';
import {CatalogItemGovernanceView} from './CatalogItemGovernanceView';

function detailWithVoidReasons(
  blockingReasons: Array<{label: string; count: number; relatedItemNames: string[]}>,
): CatalogDetail {
  return {
    item: {shapeKey: 'SKU_MANAGED', lifecycle: {status: 'DISABLED'}},
    references: [],
    actionAvailability: {
      voidAvailability: {canVoid: false, blockingReferences: [], dependentFacts: [], blockingReasons},
    },
  } as unknown as CatalogDetail;
}

describe('CatalogItemGovernanceView', () => {
  it('shows the owner-provided reason for a SKU parent instead of a generic void warning', () => {
    const markup = renderToStaticMarkup(
      <CatalogItemGovernanceView
        detail={detailWithVoidReasons([{label: '包含规格', count: 3, relatedItemNames: []}])}
      />,
    );

    expect(markup).toContain('包含规格（3项）');
    expect(markup).not.toContain('当前商品暂不能作废。');
    expect(markup).toContain('没有与其他商品的关联');
  });

  it('does not turn a missing owner availability fact into a false void prohibition', () => {
    const detail = {
      item: {shapeKey: 'STANDARD_SALE', lifecycle: {status: 'DISABLED'}},
      references: [],
      actionAvailability: {},
    } as unknown as CatalogDetail;

    const markup = renderToStaticMarkup(<CatalogItemGovernanceView detail={detail} />);

    expect(markup).not.toContain('当前不可作废');
    expect(markup).not.toContain('当前商品暂不能作废。');
  });

  it('groups references by business location with a name-first, secondary-code identity', () => {
    const detail = {
      item: {shapeKey: 'STANDARD_SALE', lifecycle: {status: 'DISABLED'}},
      references: [
        {
          referenceRef: 'reference-1',
          direction: 'INBOUND',
          referenceKind: 'COMPOSITE_COMPONENT',
          code: 'MAIN-STEAK-001',
          name: '西冷牛排',
        },
      ],
      actionAvailability: {},
    } as unknown as CatalogDetail;
    const markup = renderToStaticMarkup(
      <CatalogItemGovernanceView detail={detail} onOpenReferencedItem={() => undefined} />,
    );

    expect(markup).toContain('被其他商品引用');
    expect(markup).toContain('西冷牛排');
    expect(markup).toContain('MAIN-STEAK-001');
  });
});
