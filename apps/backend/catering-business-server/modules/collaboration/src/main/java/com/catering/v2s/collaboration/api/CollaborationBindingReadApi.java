package com.catering.v2s.collaboration.api;

import java.util.List;
import java.util.UUID;

/** Owner-held binding projections. The node facts are returned as separate fields; no polymorphic value is implied. */
public interface CollaborationBindingReadApi {
    CollaborationReadback.OwnerBinding readBinding(UUID workspaceUuid, String groupWorkspaceKey, UUID bindingRef);

    CollaborationReadback.OwnerBindingPage pageBindings(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String providerCode,
            String bindingName,
            String nodeQueryText,
            String sortKey,
            String sortDirection,
            int page,
            int pageSize);

    List<CollaborationReadback.OwnerBinding> findBindingsForNode(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode, String nodeType, String nodeRef);

    default List<CollaborationReadback.OwnerBinding> findBindingsForChannelReference(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode, String nodeType, String nodeRef) {
        return findBindingsForNode(workspaceUuid, groupWorkspaceKey, providerCode, nodeType, nodeRef);
    }
}
