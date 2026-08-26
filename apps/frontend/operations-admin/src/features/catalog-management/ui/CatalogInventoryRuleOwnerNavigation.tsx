import {Tag, theme, Typography} from 'antd';
import {useEffect, useMemo, useState} from 'react';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import type {CatalogDetail, CatalogInventoryRuleMode, CatalogInventoryRuleNode} from '../model/catalogModel';

const modeLabels: Record<CatalogInventoryRuleMode, string> = {
  NONE: '不参与库存',
  DIRECT: '直接扣当前商品或规格',
  BOM: '按 BOM 扣组件',
};

const ownerLabels: Record<CatalogInventoryRuleNode['owner']['ownerType'], string> = {
  ITEM: '商品',
  SKU: '规格',
  OPTION_VALUE: '点单选项',
};

export function inventoryRuleOwnerKey(node: Pick<CatalogInventoryRuleNode, 'owner'>): string {
  return [
    node.owner.ownerType,
    node.owner.itemRef,
    node.owner.productSkuRef ?? '',
    node.owner.optionValueRef ?? '',
  ].join(':');
}

export function inventoryRuleModeLabel(mode: CatalogInventoryRuleMode): string {
  return modeLabels[mode];
}

export function inventoryRuleOwnerTypeLabel(ownerType: CatalogInventoryRuleNode['owner']['ownerType']): string {
  return ownerLabels[ownerType];
}

export type InventoryRuleOwnerDisplay = {name: string; detail: string; indent: number};

/** Resolve display names from the already loaded detail; inventory nodes remain stable owner references. */
export function inventoryRuleOwnerDisplay(
  node: CatalogInventoryRuleNode,
  detail: Pick<CatalogDetail, 'item'>,
): InventoryRuleOwnerDisplay {
  if (node.owner.ownerType === 'SKU') {
    const sku = detail.item.skus.find(candidate => candidate.productSkuRef === node.owner.productSkuRef);
    // This is a task selector, not an identifier audit surface. Showing a SKU
    // code here made operators choose opaque strings even though the item read
    // already contains the display name. Missing names are a read failure at
    // the owner boundary, never a reason to promote the code as the label.
    return {
      name: sku?.skuName || '规格名称暂时无法读取',
      detail: [ownerLabels.SKU, modeLabels[node.mode]].join(' · '),
      indent: 18,
    };
  }
  if (node.owner.ownerType === 'OPTION_VALUE') {
    const option = detail.item.orderOptionConfigs
      .flatMap(config => config.values.map(value => ({groupName: config.name, value})))
      .find(candidate => candidate.value.definitionValueRef === node.owner.optionValueRef);
    return {
      name: option?.value.name || '点单选项',
      detail: [option?.groupName, ownerLabels.OPTION_VALUE, modeLabels[node.mode]].filter(Boolean).join(' · '),
      indent: 18,
    };
  }
  return {name: detail.item.name || node.itemName || '当前商品', detail: `${ownerLabels.ITEM} · ${modeLabels[node.mode]}`, indent: 0};
}

export function useInventoryRuleSelection(nodes: readonly CatalogInventoryRuleNode[]) {
  const [selectedKey, setSelectedKey] = useState<string>();
  const currentKey = useMemo(
    () => selectedKey && nodes.some(node => inventoryRuleOwnerKey(node) === selectedKey) ? selectedKey : nodes[0] && inventoryRuleOwnerKey(nodes[0]),
    [nodes, selectedKey],
  );
  const current = useMemo(() => nodes.find(node => inventoryRuleOwnerKey(node) === currentKey) ?? nodes[0], [currentKey, nodes]);
  useEffect(() => {
    if (!selectedKey || nodes.some(node => inventoryRuleOwnerKey(node) === selectedKey)) return;
    setSelectedKey(undefined);
  }, [nodes, selectedKey]);
  return {currentKey, current, setSelectedKey};
}

/** Same locator, naming, selection style and keyboard behavior in view and editor. */
export function CatalogInventoryRuleOwnerNavigation({
  nodes,
  detail,
  currentKey,
  onSelect,
}: {
  nodes: readonly CatalogInventoryRuleNode[];
  detail: Pick<CatalogDetail, 'item'>;
  currentKey: string | undefined;
  onSelect: (key: string) => void;
}) {
  const {token} = theme.useToken();
  const itemNodes = nodes.filter(node => node.owner.ownerType === 'ITEM');
  const variantNodes = nodes.filter(node => node.owner.ownerType !== 'ITEM');
  const renderOwner = (node: CatalogInventoryRuleNode) => {
    const key = inventoryRuleOwnerKey(node);
    const active = key === currentKey;
    const display = inventoryRuleOwnerDisplay(node, detail);
    return (
      <button
        key={key}
        type="button"
        aria-current={active ? 'page' : undefined}
        aria-label={`${display.name}，${display.detail}`}
        onClick={() => onSelect(key)}
        style={{
          appearance: 'none',
          width: '100%',
          minHeight: 64,
          padding: '10px 12px',
          border: `1px solid ${active ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
          borderInlineStart: `3px solid ${active ? token.colorPrimary : 'transparent'}`,
          borderRadius: token.borderRadius,
          background: active ? token.colorPrimaryBg : token.colorBgContainer,
          color: token.colorText,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
        {...testId(catalogTestIdControls.inventory.owner(key))}
      >
        <span style={{display: 'grid', gap: 5, minWidth: 0}}>
          <span style={{display: 'flex', alignItems: 'center', gap: 6, minWidth: 0}}>
            <Typography.Text strong ellipsis={{tooltip: display.name}} style={{minWidth: 0, flex: 1}}>
              {display.name}
            </Typography.Text>
            <Tag color={active ? 'blue' : undefined} style={{marginInlineEnd: 0}}>
              {inventoryRuleOwnerTypeLabel(node.owner.ownerType)}
            </Tag>
          </span>
          <Typography.Text type="secondary" ellipsis={{tooltip: inventoryRuleModeLabel(node.mode)}}>
            {inventoryRuleModeLabel(node.mode)}
          </Typography.Text>
        </span>
      </button>
    );
  };
  return (
    <section aria-labelledby="catalog-inventory-owner-navigation-heading" {...testId(catalogTestIds.static.inventoryOwnerTree)}>
      <Typography.Text id="catalog-inventory-owner-navigation-heading" strong>选择要配置的对象</Typography.Text>
      <Typography.Paragraph type="secondary" style={{margin: '4px 0 0', fontSize: 12}}>
        商品和每个规格可以分别设置库存扣减方式。
      </Typography.Paragraph>
      <nav aria-label="选择要配置的对象" style={{marginTop: 12}}>
        <div style={{display: 'grid', gap: 8}}>
          {itemNodes.map(renderOwner)}
          {variantNodes.length > 0 ? (
            <>
              <Typography.Text type="secondary" style={{fontSize: 12, marginTop: 4}}>
                规格
              </Typography.Text>
              {variantNodes.map(renderOwner)}
            </>
          ) : null}
        </div>
      </nav>
    </section>
  );
}
