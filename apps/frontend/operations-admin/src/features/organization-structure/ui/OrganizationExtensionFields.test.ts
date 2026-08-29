import dayjs from 'dayjs';
import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition} from '../../../app/api/generated/operations-edge';
import {
  hydrateOrganizationExtensionValues,
  organizationExtensionDetailItems,
  serializeOrganizationExtensionValues,
} from './OrganizationExtensionFields';

const definition: ExtensionDefinition = {
  groupWorkspaceKey: 'workspace-a',
  entityType: 'REGION',
  revision: 1,
  updatedAt: 0,
  workspaceStatus: 'ENABLED',
  blockers: [],
  definitions: [
    {key: 'hidden', label: '停用字段', type: 'TEXT', required: false, options: [], status: 'DISABLED', displayOrder: 0},
    {key: 'startsOn', label: '开始日期', type: 'DATE', required: true, options: [], status: 'ENABLED', displayOrder: 1},
    {
      key: 'enabled',
      label: '启用标记',
      type: 'BOOLEAN',
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 2,
    },
    {
      key: 'area',
      label: '面积',
      type: 'NUMBER',
      required: false,
      options: [],
      status: 'ENABLED',
      displayOrder: 3,
      displaySuffix: '㎡',
    },
  ],
};

describe('organization extension fields', () => {
  it('hydrates form dates and serializes only explicit SET submissions as canonical JSON text', () => {
    const hydrated = hydrateOrganizationExtensionValues(definition, {startsOn: '2026-08-03', enabled: false, area: 12});
    expect(dayjs.isDayjs(hydrated.startsOn)).toBe(true);
    expect(serializeOrganizationExtensionValues(definition, hydrated)).toEqual([
      {fieldKey: 'startsOn', valueJson: '"2026-08-03"', mode: 'SET'},
      {fieldKey: 'enabled', valueJson: 'false', mode: 'SET'},
      {fieldKey: 'area', valueJson: '12', mode: 'SET'},
    ]);
  });

  it('makes omit, SET and CLEAR distinct without null-shaped intent inference', () => {
    expect(
      serializeOrganizationExtensionValues(
        definition,
        {startsOn: undefined, enabled: false},
        {startsOn: '2026-08-03', enabled: false, area: 12},
      ),
    ).toEqual([
      {fieldKey: 'startsOn', valueJson: '', mode: 'CLEAR'},
      {fieldKey: 'area', valueJson: '', mode: 'CLEAR'},
    ]);
    expect(serializeOrganizationExtensionValues(definition, {}, {})).toEqual([]);
  });

  it('uses enabled definition labels, ordered values and display suffixes for details', () => {
    expect(organizationExtensionDetailItems(definition, {startsOn: '2026-08-03', enabled: false, area: 12})).toEqual([
      {key: 'extension-startsOn', label: '开始日期', children: '2026-08-03'},
      {key: 'extension-enabled', label: '启用标记', children: '否'},
      {key: 'extension-area', label: '面积', children: '12㎡'},
    ]);
  });
});
