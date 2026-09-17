import {Form, type TreeDataNode} from 'antd';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';
import {
  STORE_OPERATING_RULE_DEFINITIONS,
  type StoreOperatingRuleDefinition,
} from '../../../app/api/generated/storeOperatingRuleCatalog';
import {
  buildStoreOperatingRuleTreeData,
  completeStoreOperatingRuleValues,
  storeOperatingRuleDetailValue,
  StoreOperatingRuleTree,
} from './StoreOperatingRuleTree';

function findDefinition(key: string): StoreOperatingRuleDefinition {
  const definition = STORE_OPERATING_RULE_DEFINITIONS.find(item => item.key === key);
  if (!definition) throw new Error(`missing test definition: ${key}`);
  return definition;
}

function flattenTree(nodes: readonly TreeDataNode[]): string[] {
  return nodes.flatMap(node => [String(node.key), ...flattenTree(node.children ?? [])]);
}

describe('store operating rule tree', () => {
  it('builds two roots and all twelve nodes from the generated catalog order', () => {
    const tree = buildStoreOperatingRuleTreeData();

    expect(tree.map(node => node.key)).toEqual(['catalogManagementEnabled', 'receivableEnabled']);
    expect(flattenTree(tree)).toHaveLength(STORE_OPERATING_RULE_DEFINITIONS.length);
    expect(tree[0]?.children?.map(node => node.key)).toEqual([
      'externalCatalogSyncEnabled',
      'reservationEnabled',
      'queueCallEnabled',
      'tableManagementEnabled',
      'pickupCallEnabled',
    ]);
    expect(
      tree[0]?.children?.find(node => node.key === 'tableManagementEnabled')?.children?.map(node => node.key),
    ).toEqual(['tableStatusEnabled']);
  });

  it('fills only missing values from the catalog defaults', () => {
    const values = completeStoreOperatingRuleValues({
      catalogManagementEnabled: true,
      openPlatformDeveloperCode: 'ISV-001',
    });

    expect(values.catalogManagementEnabled).toBe(true);
    expect(values.openPlatformDeveloperCode).toBe('ISV-001');
    expect(values.reservationEnabled).toBe(false);
  });

  it('keeps configured facts visible while explaining inactive descendants', () => {
    const values = completeStoreOperatingRuleValues({
      catalogManagementEnabled: false,
      reservationEnabled: true,
      openPlatformDeveloperCode: 'ISV-001',
    });

    expect(storeOperatingRuleDetailValue(values, findDefinition('catalogManagementEnabled'))).toBe('否');
    expect(storeOperatingRuleDetailValue(values, findDefinition('reservationEnabled'))).toBe('是（当前未生效）');
    expect(storeOperatingRuleDetailValue(values, findDefinition('openPlatformDeveloperCode'))).toBe(
      'ISV-001（上级未开启）',
    );
  });

  it('renders detail as a readable tree without editable controls', () => {
    const values = completeStoreOperatingRuleValues({catalogManagementEnabled: true});
    const markup = renderToStaticMarkup(<StoreOperatingRuleTree mode="detail" values={values} />);

    expect(markup).toContain('data-testid="operations-store-detail-operating-rules-tree"');
    expect(markup).toContain('是否启用商品、库存和菜单管理');
    expect(markup).toContain('data-testid="operations-store-detail-operating-rule-catalogManagementEnabled"');
    expect(markup).not.toContain('data-testid="operations-store-edit-operating-rule-catalogManagementEnabled"');
    expect(markup).not.toContain('<input');
  });

  it('renders one real form control per rule and keeps disabled child guidance in the row', () => {
    const values = completeStoreOperatingRuleValues({catalogManagementEnabled: false});
    const markup = renderToStaticMarkup(
      <Form initialValues={{operatingRuleSwitches: values}}>
        <StoreOperatingRuleTree mode="edit" values={values} />
      </Form>,
    );

    expect(markup).toContain('data-testid="operations-store-edit-operating-rules-tree"');
    for (const definition of STORE_OPERATING_RULE_DEFINITIONS) {
      expect(markup).toContain(`data-testid="operations-store-edit-operating-rule-${definition.key}"`);
      expect(markup).toContain(`aria-label="${definition.label}"`);
    }
    const renderedControlCount = STORE_OPERATING_RULE_DEFINITIONS.filter(definition =>
      markup.includes(`data-testid="operations-store-edit-operating-rule-${definition.key}"`),
    ).length;
    expect(renderedControlCount).toBe(STORE_OPERATING_RULE_DEFINITIONS.length);
    expect(markup).toContain('请先开启上级功能');
    expect(markup).toContain('aria-describedby="operations-store-edit-operating-rule-help-externalCatalogSyncEnabled"');
  });
});
