import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition, JsonValue} from '../../../app/api/generated/operations-edge';
import {extensionListAndSearchColumns, extensionQueryValues, orderedExtensionFields} from './extensionList';

const definition = {
  groupWorkspaceKey: 'aurora',
  entityType: 'BRAND',
  revision: 4,
  updatedAt: 0,
  workspaceStatus: 'ENABLED',
  blockers: [],
  definitions: [
    {
      key: 'level',
      label: '品牌等级',
      type: 'NUMBER',
      listDisplay: true,
      searchable: true,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 0,
    },
    {
      key: 'origin',
      label: '品牌来源',
      type: 'SELECT',
      listDisplay: false,
      searchable: true,
      required: false,
      options: ['直营', '联营'],
      status: 'ENABLED',
      displayOrder: 1,
    },
    {
      key: 'disabled',
      label: '禁用字段',
      type: 'TEXT',
      listDisplay: true,
      searchable: true,
      required: false,
      options: [],
      status: 'DISABLED',
      displayOrder: 2,
    },
  ],
} satisfies ExtensionDefinition;

describe('operations extension list adapter', () => {
  it('creates fixed unsorted columns and type-matched search controls from the definition', () => {
    const columns = extensionListAndSearchColumns<{extensionValues?: Record<string, JsonValue>}>(
      definition,
      'brand-list',
    );
    expect(columns.map(column => [column.key, column.hideInTable, column.valueType, column.search])).toEqual([
      ['extension-level', false, 'digit', undefined],
      ['extension-origin', true, 'select', undefined],
    ]);
    expect(columns.map(column => column.dataIndex)).toEqual([
      ['extensionFilterValues', 'level'],
      ['extensionFilterValues', 'origin'],
    ]);
    expect(columns.map(column => (column as {name?: unknown}).name)).toEqual([
      ['extensionFilterValues', 'level'],
      ['extensionFilterValues', 'origin'],
    ]);
    expect((columns[0] as {sorter?: unknown}).sorter).toBeUndefined();
    expect(columns.map(column => [column.ellipsis, column.width])).toEqual([
      [{showTitle: false}, 180],
      [{showTitle: false}, 180],
    ]);
    expect(columns.map(column => column.order)).toEqual([-1, -1]);
    expect((columns[1].fieldProps as {options?: Array<{value: string}>}).options).toEqual([
      {value: '直营', label: '直营'},
      {value: '联营', label: '联营'},
    ]);
  });

  it('emits the generated logical filter wire shape and no revision for an empty draft', () => {
    const query = extensionQueryValues(definition, {level: 3, origin: '直营'});
    expect(JSON.parse(decodeURIComponent(query.extensionFilters ?? ''))).toEqual([
      {fieldKey: 'level', type: 'NUMBER', value: '3'},
      {fieldKey: 'origin', type: 'SELECT', value: '直营'},
    ]);
    expect(query.definitionRevision).toBe(4);
    expect(extensionQueryValues(definition, {})).toEqual({extensionFilters: undefined, definitionRevision: undefined});
  });

  it('uses field key as the deterministic tie-breaker for equal display order', () => {
    const fields = [
      {...definition.definitions[0], key: 'zeta', displayOrder: 0},
      {...definition.definitions[0], key: 'alpha', displayOrder: 0},
    ];
    expect(orderedExtensionFields({...definition, definitions: fields}).map(field => field.key)).toEqual([
      'alpha',
      'zeta',
    ]);
  });
});
