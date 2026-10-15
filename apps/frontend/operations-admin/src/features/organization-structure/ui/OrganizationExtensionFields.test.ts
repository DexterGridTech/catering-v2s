import {Children, Fragment, isValidElement, type ReactElement, type ReactNode} from 'react';
import {DatePicker, Input, InputNumber, Select, Switch} from 'antd';
import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition} from '../../../app/api/generated/operations-edge';
import {OrganizationExtensionFields} from './OrganizationExtensionFields';

type FieldItemProps = {
  name: unknown;
  label: string;
  rules: Array<{required?: boolean; message?: string}>;
  valuePropName?: string;
  children: ReactElement<{['data-testid']?: string}>;
};

const definition: ExtensionDefinition = {
  groupWorkspaceKey: 'workspace-a',
  entityType: 'REGION',
  revision: 1,
  updatedAt: 0,
  workspaceStatus: 'ENABLED',
  blockers: [],
  definitions: [
    {key: 'name', label: '名称', type: 'TEXT', listDisplay: null, searchable: null, required: true, options: [], status: 'ENABLED', displayOrder: 1},
    {key: 'amount', label: '数量', type: 'NUMBER', listDisplay: null, searchable: null, required: false, options: [], status: 'ENABLED', displayOrder: 2},
    {key: 'active', label: '启用', type: 'BOOLEAN', listDisplay: null, searchable: null, required: false, options: [], status: 'ENABLED', displayOrder: 3},
    {key: 'date', label: '日期', type: 'DATE', listDisplay: null, searchable: null, required: false, options: [], status: 'ENABLED', displayOrder: 4},
    {key: 'choice', label: '选项', type: 'SELECT', listDisplay: null, searchable: null, required: false, options: ['A', 'B'], status: 'ENABLED', displayOrder: 5},
    {key: 'retired', label: '已停用', type: 'TEXT', listDisplay: null, searchable: null, required: false, options: [], status: 'DISABLED', displayOrder: 6},
  ],
};

function renderedItems(definitionValue: ExtensionDefinition | undefined) {
  const rendered = OrganizationExtensionFields({definition: definitionValue, testIdPrefix: 'region-extension'}) as ReactElement<{
    children?: ReactNode;
  }>;
  expect(rendered.type).toBe(Fragment);
  return Children.toArray(rendered.props.children).filter(isValidElement) as ReactElement<FieldItemProps>[];
}

describe('OrganizationExtensionFields', () => {
  it('binds enabled fields to the extension object and applies required and BOOLEAN form semantics', () => {
    const items = renderedItems(definition);

    expect(items.map(item => (item.props as FieldItemProps).name)).toEqual([
      ['extensionValues', 'name'],
      ['extensionValues', 'amount'],
      ['extensionValues', 'active'],
      ['extensionValues', 'date'],
      ['extensionValues', 'choice'],
    ]);

    const [name, amount, active, date, choice] = items.map(item => item.props as FieldItemProps);
    expect(name.rules).toEqual([{required: true, message: '请输入名称'}]);
    expect(amount.rules).toEqual([]);
    expect(active.valuePropName).toBe('checked');
    expect(name.valuePropName).toBeUndefined();

    expect(name.children.type).toBe(Input);
    expect(amount.children.type).toBe(InputNumber);
    expect(active.children.type).toBe(Switch);
    expect(date.children.type).toBe(DatePicker);
    expect(choice.children.type).toBe(Select);
    expect(items.map(item => (item.props as FieldItemProps).children.props['data-testid'])).toEqual([
      'region-extension-name',
      'region-extension-amount',
      'region-extension-active',
      'region-extension-date',
      'region-extension-choice',
    ]);
    expect(items.some(item => (item.props as FieldItemProps).label === '已停用')).toBe(false);
  });

  it('renders no fields before a definition is available', () => {
    expect(renderedItems(undefined)).toEqual([]);
  });
});
