import dayjs from 'dayjs';
import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition} from '../../../app/api/generated/operations-edge';
import {
  enabledExtensionFields,
  extensionDetailItems,
  hydrateExtensionFormValues,
  serializeExtensionFormValues,
} from './extensionFormValues';

const definition: ExtensionDefinition = {
  groupWorkspaceKey: 'workspace-a',
  entityType: 'REGION',
  revision: 1,
  updatedAt: 0,
  workspaceStatus: 'ENABLED',
  blockers: [],
  definitions: [
    {
      key: 'zeta',
      label: '先录字段',
      type: 'TEXT',
      listDisplay: null,
      searchable: null,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 1,
    },
    {
      key: 'alpha',
      label: '同序字段',
      type: 'TEXT',
      listDisplay: null,
      searchable: null,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 1,
    },
    {
      key: 'startsOn',
      label: '开始日期',
      type: 'DATE',
      listDisplay: null,
      searchable: null,
      required: true,
      options: [],
      status: 'ENABLED',
      displayOrder: 2,
    },
    {
      key: 'enabled',
      label: '启用标记',
      type: 'BOOLEAN',
      listDisplay: null,
      searchable: null,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 3,
    },
    {
      key: 'area',
      label: '面积',
      type: 'NUMBER',
      listDisplay: null,
      searchable: null,
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 4,
      displaySuffix: '㎡',
    },
    {
      key: 'disabled',
      label: '停用字段',
      type: 'TEXT',
      listDisplay: null,
      searchable: null,
      required: false,
      options: [],
      status: 'DISABLED',
      displayOrder: 0,
    },
  ],
};

describe('extension form values', () => {
  it('filters disabled definitions and keeps input order for equal form display order', () => {
    expect(enabledExtensionFields(definition).map(field => field.key)).toEqual([
      'zeta',
      'alpha',
      'startsOn',
      'enabled',
      'area',
    ]);
  });

  it('hydrates dates and submits a JSON object with canonical date, false, and zero values', () => {
    const hydrated = hydrateExtensionFormValues(definition, {
      startsOn: '2026-08-03',
      enabled: false,
      area: 0,
    });
    expect(dayjs.isDayjs(hydrated.startsOn)).toBe(true);
    expect(serializeExtensionFormValues(definition, hydrated)).toEqual({
      startsOn: '2026-08-03',
      enabled: false,
      area: 0,
    });
  });

  it('uses null only to clear existing values and omits unchanged or new empty values', () => {
    expect(
      serializeExtensionFormValues(
        definition,
        {startsOn: undefined, enabled: false, area: '', newField: ''},
        {startsOn: '2026-08-03', enabled: false, area: 12, disabled: '保留'},
      ),
    ).toEqual({startsOn: null, area: null});
    expect(serializeExtensionFormValues(definition, {}, {})).toEqual({});
  });

  it('renders enabled typed detail fields with false, zero, and display suffix intact', () => {
    expect(
      extensionDetailItems(definition, {
        startsOn: '2026-08-03',
        enabled: false,
        area: 0,
        disabled: '不显示',
      }),
    ).toEqual([
      {key: 'extension-zeta', label: '先录字段', children: '—'},
      {key: 'extension-alpha', label: '同序字段', children: '—'},
      {key: 'extension-startsOn', label: '开始日期', children: '2026-08-03'},
      {key: 'extension-enabled', label: '启用标记', children: '否'},
      {key: 'extension-area', label: '面积', children: '0㎡'},
    ]);
  });
});
