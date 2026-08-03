import dayjs from 'dayjs';
import {describe, expect, it} from 'vitest';
import type {ExtensionDefinition} from '../../../app/api/generated/operations-edge';
import {hydrateOrganizationExtensionValues, organizationExtensionDetailItems, serializeOrganizationExtensionValues} from './OrganizationExtensionFields';

const definition: ExtensionDefinition = {
  groupWorkspaceKey: 'workspace-a',
  entityType: 'REGION',
  revision: 1,
  updatedAt: 0,
  definitions: [
    {key: 'hidden', label: '停用字段', type: 'TEXT', required: false, options: [], status: 'DISABLED', displayOrder: 0},
    {key: 'startsOn', label: '开始日期', type: 'DATE', required: true, options: [], displayOrder: 1},
    {key: 'enabled', label: '启用标记', type: 'BOOLEAN', required: false, options: [], displayOrder: 2},
    {key: 'area', label: '面积', type: 'NUMBER', required: false, options: [], displayOrder: 3, displaySuffix: '㎡'},
  ],
};

describe('organization extension fields', () => {
  it('hydrates and serializes Date values without changing other owner readback values', () => {
    const hydrated = hydrateOrganizationExtensionValues(definition, {startsOn: '2026-08-03', enabled: false, area: 12});
    expect(dayjs.isDayjs(hydrated.startsOn)).toBe(true);
    expect(serializeOrganizationExtensionValues(definition, hydrated)).toEqual({startsOn: '2026-08-03', enabled: false, area: 12});
  });

  it('uses enabled definition labels, ordered values and display suffixes for details', () => {
    expect(organizationExtensionDetailItems(definition, {startsOn: '2026-08-03', enabled: false, area: 12})).toEqual([
      {key: 'extension-startsOn', label: '开始日期', children: '2026-08-03'},
      {key: 'extension-enabled', label: '启用标记', children: '否'},
      {key: 'extension-area', label: '面积', children: '12㎡'},
    ]);
  });
});
