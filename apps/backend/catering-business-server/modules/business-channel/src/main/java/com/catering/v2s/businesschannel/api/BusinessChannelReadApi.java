package com.catering.v2s.businesschannel.api;

import java.util.List;
import java.util.UUID;

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

    /** Reads only the server-owned target relation needed before an operations template command. */
    BusinessChannelReadback.TemplateCommandContext readTemplateCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID templateRef);

    /** Reads only server-owned channel/template command facts; the owner command still performs the locked readback. */
    BusinessChannelReadback.ChannelCommandContext readChannelCommandContext(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef);

    /** Reads a channel and its template provider in one owner query for the external binding command edge. */
    BusinessChannelReadback.ChannelWithTemplateProvider readChannelWithTemplateProvider(
            UUID workspaceUuid, String groupWorkspaceKey, UUID channelRef);

    /** Returns channels currently attached to a collaboration binding for an owner-side cascade. */
    List<BusinessChannelReadback.Channel> findChannelsForBinding(
            UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef);
}
