import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition, JsonValue} from '../../../app/api/generated/platform-edge';
import {extensionListAndSearchColumns, extensionQueryValues} from './extensionList';

const definition = {
  groupWorkspaceKey: 'aurora',
  entityType: 'STORE',
  revision: 9,
  updatedAt: 0,
  workspaceStatus: 'ENABLED',
  blockers: [],
  definitions: [
    {
      key: 'floor',
      label: '楼层',
      type: 'TEXT',
      listDisplay: true,
      searchable: false,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 0,
    },
    {
      key: 'open',
      label: '是否营业',
      type: 'BOOLEAN',
      listDisplay: false,
      searchable: true,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 1,
    },
  ],
} satisfies ExtensionDefinition;

describe('platform extension list adapter', () => {
  it('keeps list-only fields out of search and maps boolean filters to select controls', () => {
    const columns = extensionListAndSearchColumns<{extensionValues?: Record<string, JsonValue>}>(
      definition,
      'store-list',
    );
    expect(columns.map(column => [column.key, column.hideInTable, column.search, column.valueType])).toEqual([
      ['extension-floor', false, false, undefined],
      ['extension-open', true, undefined, 'select'],
    ]);
    expect(columns.map(column => column.dataIndex)).toEqual([
      ['extensionFilterValues', 'floor'],
      ['extensionFilterValues', 'open'],
    ]);
    expect(columns.map(column => (column as {name?: unknown}).name)).toEqual([
      ['extensionFilterValues', 'floor'],
      ['extensionFilterValues', 'open'],
    ]);
    expect(columns.map(column => [column.ellipsis, column.width])).toEqual([
      [{showTitle: false}, 180],
      [{showTitle: false}, 180],
    ]);
    expect(columns.map(column => column.order)).toEqual([-1, -1]);
    expect((columns[1].fieldProps as {options?: Array<{value: boolean}>}).options).toEqual([
      {value: true, label: '是'},
      {value: false, label: '否'},
    ]);
  });

  it('uses raw page values and current definition revision for the query adapter', () => {
    const query = extensionQueryValues(definition, {open: true});
    expect(JSON.parse(decodeURIComponent(query.extensionFilters ?? ''))).toEqual([
      {fieldKey: 'open', type: 'BOOLEAN', value: 'true'},
    ]);
    expect(query.definitionRevision).toBe(9);
  });
});
