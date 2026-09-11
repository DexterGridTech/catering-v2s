import {operationsClient} from '../../../app/api/OperationsTransport';
import {wireUuid} from '../../../app/api/wireUuid';
import {collectCursorPages} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelSortKey,
  BusinessChannelTemplateView,
  BusinessChannelTemplateSortKey,
  BusinessChannelTemplateVisibleStore,
  BusinessChannelTemplateVisibleStorePage,
  BusinessChannelView,
  ExternalCapability,
  ExternalProviderCandidatePage,
  OwnerBindingView,
  OperationsPageContext,
  SortDirection,
} from './types';
import {BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE} from './types';

export type BusinessChannelCollection = {items: BusinessChannelView[]};
export type BusinessChannelTemplateCollection = {items: BusinessChannelTemplateView[]};

export type BusinessChannelTemplateSort = {
  sortKey?: BusinessChannelTemplateSortKey;
  sortDirection?: SortDirection;
};

export type BusinessChannelSort = {
  sortKey?: BusinessChannelSortKey;
  sortDirection?: SortDirection;
};

export function readProjectBusinessChannels(
  queryContext: OperationsPageContext,
  projectRef: string,
  sort: BusinessChannelSort = {},
): Promise<BusinessChannelCollection> {
  return operationsClient
    .getOperationsProjectBusinessChannels(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef)},
      {query: {sortKey: sort.sortKey, sortDirection: sort.sortDirection}},
    )
    .then(page => ({items: page.items}));
}

export function readStoreBusinessChannels(
  queryContext: OperationsPageContext,
  storeRef: string,
  sort: BusinessChannelSort = {},
): Promise<BusinessChannelCollection> {
  return operationsClient
    .getOperationsStoreBusinessChannels(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: wireUuid(storeRef)},
      {query: {usage: 'BUSINESS_CHANNEL', sortKey: sort.sortKey, sortDirection: sort.sortDirection}},
    )
    .then(page => ({items: page.items}));
}

export function readBusinessChannelTemplates(
  queryContext: OperationsPageContext,
  projectRef?: string,
  sort: BusinessChannelTemplateSort = {},
): Promise<BusinessChannelTemplateCollection> {
  return operationsClient
    .getOperationsBusinessChannelTemplates(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: {
          projectRef: projectRef ? wireUuid(projectRef) : undefined,
          sortKey: sort.sortKey,
          sortDirection: sort.sortDirection,
        },
      },
    )
    .then(page => ({items: page.items}));
}

export function readStoreBusinessChannelTemplateCandidates(
  queryContext: OperationsPageContext,
  projectRef: string,
  storeRef: string,
  sort: BusinessChannelTemplateSort = {},
): Promise<BusinessChannelTemplateCollection> {
  return collectCursorPages({
    readPage: (cursor, pageSize) =>
      operationsClient.getOperationsStoreBusinessChannelTemplateCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {
          query: {
            projectRef: wireUuid(projectRef),
            storeRef: wireUuid(storeRef),
            cursor,
            pageSize,
            sortKey: sort.sortKey,
            sortDirection: sort.sortDirection,
          },
        },
      ),
    pageSize: BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE,
    keyOf: item => item.templateRef,
  }).then(result => ({items: result.items}));
}

export function readBusinessChannelTemplateVisibleStores(
  queryContext: OperationsPageContext,
  templateRef: string,
  storeStatusFilter: 'NON_VOIDED' | 'ALL',
  cursor?: string,
  pageSize = BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE,
): Promise<BusinessChannelTemplateVisibleStorePage> {
  return operationsClient.getOperationsBusinessChannelTemplateVisibleStores(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey, templateRef: wireUuid(templateRef)},
    {query: {storeStatusFilter, cursor, pageSize}},
  );
}

export async function readAllBusinessChannelTemplateVisibleStores(
  queryContext: OperationsPageContext,
  templateRef: string,
): Promise<BusinessChannelTemplateVisibleStore[]> {
  const result = await collectCursorPages({
    readPage: (cursor, pageSize) =>
      readBusinessChannelTemplateVisibleStores(queryContext, templateRef, 'ALL', cursor, pageSize),
    pageSize: BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE,
    keyOf: item => item.storeRef,
  });
  return result.items;
}

export async function readExternalProviderCandidates(
  queryContext: OperationsPageContext,
  capabilityClass?: ExternalCapability['capabilityClass'],
  nodeType?: OwnerBindingView['nodeType'],
): Promise<ExternalProviderCandidatePage['items']> {
  const result = await collectCursorPages({
    readPage: (cursor, pageSize) =>
      operationsClient.getOperationsExternalProviderCandidates(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {
          query: {
            capabilityClass,
            nodeType: nodeType === 'PROJECT' || nodeType === 'STORE' ? nodeType : undefined,
            cursor,
            pageSize,
          },
        },
      ),
    pageSize: BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE,
    keyOf: item => item.providerCode,
  });
  return result.items;
}

export async function readOperationsOwnerBinding(
  queryContext: OperationsPageContext,
  channelRef: string,
): Promise<OwnerBindingView> {
  return operationsClient.getOperationsOwnerBindingDetail(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: wireUuid(channelRef)},
    {},
  );
}
