package com.catering.v2s.businesschannel.api;

import java.util.UUID;
import java.util.List;

/** Read-only owner boundary. Management reads are bounded; candidate reads use the opaque cursor protocol. */
public interface BusinessChannelReadApi {
    BusinessChannelReadback.TemplatePage pageTemplates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String status,
            String operatorKind,
            String sortKey,
            String sortDirection);

    BusinessChannelReadback.TemplatePage pageStoreTemplateCandidates(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID projectRef,
            String storeRef,
            String cursor,
            int pageSize,
            String sortKey,
            String sortDirection);

    BusinessChannelReadback.ChannelPage pageChannels(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String ownerNodeType,
            String ownerNodeRef,
            String status,
            String sortKey,
            String sortDirection);

    BusinessChannelReadback.Template readTemplate(UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef);

    BusinessChannelReadback.Channel readChannel(UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef);

    /** Returns channels currently attached to a collaboration binding for an owner-side cascade. */
    List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef);

    /** Returns channels whose owner template uses a provider for an external stop cascade. */
    List<BusinessChannelReadback.Channel> findChannelsForProvider(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode);
}
