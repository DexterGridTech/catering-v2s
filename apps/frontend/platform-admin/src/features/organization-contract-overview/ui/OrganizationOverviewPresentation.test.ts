import {describe, expect, it} from 'vitest';
import {organizationOverviewExtensionItems} from './OrganizationOverviewPresentation';

describe('organization overview extension presentation', () => {
  it('uses the enabled definition order and owner values without inventing fields', () => {
    const items = organizationOverviewExtensionItems(
      {
        groupWorkspaceKey: 'aurora',
        entityType: 'COMMERCIAL_GROUP',
        revision: 1,
        updatedAt: 0,
        definitions: [
          {
            key: 'disabled',
            label: '禁用字段',
            type: 'TEXT',
            required: false,
            options: [],
            status: 'DISABLED',
            displayOrder: 0,
          },
          {
            key: 'enabled',
            label: '集团标签',
            type: 'TEXT',
            required: false,
            options: [],
            status: 'ENABLED',
            displayOrder: 2,
          },
          {
            key: 'flag',
            label: '是否直营',
            type: 'BOOLEAN',
            required: false,
            options: [],
            status: 'ENABLED',
            displayOrder: 1,
          },
        ],
      },
      {enabled: '极光', flag: true, unknown: '不得显示'},
    );
    expect(items).toEqual([
      {key: 'extension-flag', label: '是否直营', children: '是'},
      {key: 'extension-enabled', label: '集团标签', children: '极光'},
    ]);
  });
});
