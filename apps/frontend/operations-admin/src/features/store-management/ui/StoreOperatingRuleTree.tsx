import {Form, Input, InputNumber, Switch, Tree, Typography, type TreeDataNode} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, type CSSProperties, type ReactNode, type SyntheticEvent} from 'react';
import type {OrganizationStoreOperatingRuleValues} from '../../../app/api/generated/operations-edge';
import {
  STORE_OPERATING_RULE_DEFINITIONS,
  storeOperatingRuleApplicable,
  storeOperatingRuleDefaults,
  type StoreOperatingRuleDefinition,
  type StoreOperatingRuleKey,
  type StoreOperatingRuleValues,
} from '../../../app/api/generated/storeOperatingRuleCatalog';
import {storeManagementTestIds} from '../storeManagementTestIds';

type StoreOperatingRuleTreeNode = TreeDataNode & {children?: StoreOperatingRuleTreeNode[]};

const ruleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 40,
  width: '100%',
  minWidth: 0,
  padding: '4px 8px 4px 0',
};

const ruleInfoStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flex: '1 1 auto',
  minWidth: 0,
  flexWrap: 'wrap',
};

const ruleValueStyle = (definition: StoreOperatingRuleDefinition): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  flex: '0 0 auto',
  minWidth: definition.type === 'BOOLEAN' ? 88 : 220,
  maxWidth: definition.type === 'BOOLEAN' ? 132 : 280,
  minHeight: 32,
});

const stopTreeEvent = (event: SyntheticEvent) => event.stopPropagation();

export function completeStoreOperatingRuleValues(
  values: Partial<OrganizationStoreOperatingRuleValues> | undefined,
): OrganizationStoreOperatingRuleValues {
  const defaults = storeOperatingRuleDefaults();
  return Object.fromEntries(
    STORE_OPERATING_RULE_DEFINITIONS.map(definition => [
      definition.key,
      values?.[definition.key] ?? defaults[definition.key],
    ]),
  ) as OrganizationStoreOperatingRuleValues;
}

export function buildStoreOperatingRuleTreeData(
  renderTitle: (definition: StoreOperatingRuleDefinition) => ReactNode = definition => definition.label,
): StoreOperatingRuleTreeNode[] {
  const definitions = [...STORE_OPERATING_RULE_DEFINITIONS].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const nodes = new Map<StoreOperatingRuleKey, StoreOperatingRuleTreeNode>();
  definitions.forEach(definition => {
    nodes.set(definition.key, {key: definition.key, title: renderTitle(definition)});
  });

  const roots: StoreOperatingRuleTreeNode[] = [];
  definitions.forEach(definition => {
    const node = nodes.get(definition.key);
    if (!node) return;
    if (!definition.parentKey) {
      roots.push(node);
      return;
    }
    const parent = nodes.get(definition.parentKey);
    if (!parent) throw new Error('STORE_OPERATING_RULE_CATALOG_INVALID');
    (parent.children ??= []).push(node);
  });
  return roots;
}

function configuredValue(values: StoreOperatingRuleValues, definition: StoreOperatingRuleDefinition) {
  return values[definition.key] ?? definition.defaultValue;
}

export function storeOperatingRuleDetailValue(
  values: StoreOperatingRuleValues,
  definition: StoreOperatingRuleDefinition,
): string {
  const value = configuredValue(values, definition);
  const text =
    definition.type === 'BOOLEAN'
      ? value === true
        ? '是'
        : '否'
      : definition.type === 'STRING'
        ? value === ''
          ? '未填写'
          : String(value)
        : String(value);
  if (storeOperatingRuleApplicable(values, definition.key)) return text;
  return definition.type === 'BOOLEAN' && value === true ? `${text}（当前未生效）` : `${text}（上级未开启）`;
}

function StoreOperatingRuleRow({
  definition,
  mode,
  values,
}: {
  definition: StoreOperatingRuleDefinition;
  mode: 'detail' | 'edit';
  values: StoreOperatingRuleValues;
}) {
  const applicable = storeOperatingRuleApplicable(values, definition.key);
  const ruleTestId = storeManagementTestIds.operatingRule(definition.key);
  const helpId = storeManagementTestIds.operatingRuleHelp(definition.key);
  const controlId = `${ruleTestId}-control`;
  const controlProps = {
    id: controlId,
    'aria-label': definition.label,
    'aria-describedby': mode === 'edit' && !applicable ? helpId : undefined,
    ...testId(ruleTestId),
  };
  const control =
    definition.type === 'BOOLEAN' ? (
      <Switch disabled={!applicable} {...controlProps} />
    ) : definition.type === 'NUMBER' ? (
      <InputNumber disabled={!applicable} style={{width: '100%'}} {...controlProps} />
    ) : (
      <Input disabled={!applicable} style={{width: '100%'}} {...controlProps} />
    );

  return (
    <div
      aria-label={`${definition.label}：${
        mode === 'detail' ? storeOperatingRuleDetailValue(values, definition) : '可配置'
      }`}
      style={ruleRowStyle}
      {...testId(storeManagementTestIds.operatingRuleRow(definition.key, mode))}
    >
      <div style={ruleInfoStyle}>
        <Typography.Text strong={!definition.parentKey} style={{minWidth: 0, overflowWrap: 'anywhere'}}>
          {definition.label}
        </Typography.Text>
        {mode === 'edit' && !applicable ? (
          <Typography.Text
            id={helpId}
            type="secondary"
            style={{whiteSpace: 'nowrap'}}
            {...testId(storeManagementTestIds.operatingRuleHelp(definition.key))}
          >
            请先开启上级功能
          </Typography.Text>
        ) : null}
      </div>
      <div
        style={ruleValueStyle(definition)}
        onClick={stopTreeEvent}
        onDoubleClick={stopTreeEvent}
        onKeyDown={stopTreeEvent}
        onMouseDown={stopTreeEvent}
      >
        {mode === 'detail' ? (
          <Typography.Text
            type={!applicable ? 'secondary' : undefined}
            style={{maxWidth: '100%', textAlign: 'end', overflowWrap: 'anywhere'}}
            {...testId(storeManagementTestIds.detailOperatingRule(definition.key))}
          >
            {storeOperatingRuleDetailValue(values, definition)}
          </Typography.Text>
        ) : (
          <Form.Item
            noStyle
            name={['operatingRuleSwitches', definition.key]}
            valuePropName={definition.type === 'BOOLEAN' ? 'checked' : undefined}
          >
            {control}
          </Form.Item>
        )}
      </div>
    </div>
  );
}

export function StoreOperatingRuleTree({
  mode,
  values,
}: {
  mode: 'detail' | 'edit';
  values: OrganizationStoreOperatingRuleValues;
}) {
  const completeValues = useMemo(() => completeStoreOperatingRuleValues(values), [values]);
  const treeData = useMemo(
    () =>
      buildStoreOperatingRuleTreeData(definition => (
        <StoreOperatingRuleRow definition={definition} mode={mode} values={completeValues} />
      )),
    [completeValues, mode],
  );
  const treeTestId =
    mode === 'detail' ? storeManagementTestIds.detailOperatingRuleTree : storeManagementTestIds.editOperatingRuleTree;

  return (
    <div {...testId(treeTestId)}>
      <Tree aria-label="门店经营规则" blockNode defaultExpandAll selectable={false} showLine treeData={treeData} />
    </div>
  );
}
