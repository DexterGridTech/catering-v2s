import type {
  BusinessChannelSortKey,
  BusinessChannelTemplateSortKey,
  BusinessChannelTemplateView,
  BusinessChannelView,
  ExternalCapability,
  ExternalProviderCandidatePage,
  OwnerBindingView,
  SortDirection,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';

/** Candidate selectors keep the existing cursor protocol and request a stable page size. */
export const BUSINESS_CHANNEL_CANDIDATE_PAGE_SIZE = 50;

export type {
  BusinessChannelSortKey,
  BusinessChannelTemplateSortKey,
  BusinessChannelTemplateView,
  BusinessChannelView,
  ExternalCapability,
  ExternalProviderCandidatePage,
  OwnerBindingView,
  SortDirection,
};
export type {OperationsPageContext};
