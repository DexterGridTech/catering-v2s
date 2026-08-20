import {platformClient} from '../../../app/api/PlatformTransport';
import type {OwnerBindingView} from '../../../app/api/generated/platform-edge';

export type PlatformOwnerBindingPageQuery = {
  bindingName: string;
  nodeQueryText: string;
  sortKey?: 'BINDING_NAME' | 'NODE' | 'BUSINESS' | 'EXTERNAL_OWNER_ID' | 'STATUS';
  sortDirection?: 'ASC' | 'DESC';
  page: number;
  pageSize: number;
};

export type PlatformOwnerBindingCollection = {items: OwnerBindingView[]; total: number};

export function readPlatformOwnerBindings(
  groupWorkspaceKey: string,
  providerCode: string,
  query: PlatformOwnerBindingPageQuery,
): Promise<PlatformOwnerBindingCollection> {
  return platformClient
    .getPlatformProviderProfileBindings(
      {groupWorkspaceKey, providerCode},
      {
        query: {
          bindingName: query.bindingName.trim() || undefined,
          nodeQueryText: query.nodeQueryText.trim() || undefined,
          sortKey: query.sortKey,
          sortDirection: query.sortDirection,
          page: query.page,
          pageSize: query.pageSize,
        },
      },
    )
    .then(page => ({items: page.items, total: page.metadata.total}));
}
