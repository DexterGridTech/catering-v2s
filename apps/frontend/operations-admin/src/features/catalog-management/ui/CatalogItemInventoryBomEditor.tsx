import {Alert, Space} from 'antd';
import type {CatalogUnitList} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogDetail, CatalogInventoryRuleNode} from '../model/catalogModel';
import {CatalogInventoryBomWorkbench} from './CatalogInventoryBomWorkbench';

/** Owns the inventory/BOM fact family; it never constructs a consumption rule locally. */
export function CatalogItemInventoryBomEditor({
  shapeKey,
  locked,
  detail,
  nodes,
  scopeRef,
  brandRef,
  unitOptions,
  createDraftRowId,
  onChange,
  onDirty,
}: {
  shapeKey: string;
  locked: boolean;
  detail: CatalogDetail;
  nodes: CatalogInventoryRuleNode[];
  scopeRef?: string;
  brandRef?: string;
  unitOptions: CatalogUnitList['data']['units'];
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogInventoryRuleNode[]) => void;
  onDirty: () => void;
}) {
  return (
    <Space direction="vertical" style={{display: 'flex'}}>
      {locked && (
        <Alert type="info" showIcon title="库存与 BOM 由来源维护" description="当前只读；如需修改请在来源系统处理。" />
      )}
      <CatalogInventoryBomWorkbench
        shapeKey={shapeKey}
        detail={detail}
        nodes={nodes}
        editing={!locked}
        scopeRef={scopeRef}
        brandRef={brandRef}
        unitOptions={unitOptions}
        createDraftRowId={createDraftRowId}
        baseUnitForOwner={node =>
          node.owner.ownerType === 'ITEM'
            ? detail.item.baseMeasureUnit
            : node.owner.ownerType === 'SKU'
              ? (detail.item.skus.find(sku => sku.productSkuRef === node.owner.productSkuRef)?.baseMeasureUnit ?? null)
              : null
        }
        onChange={onChange}
        onDirty={onDirty}
      />
    </Space>
  );
}
