package com.catering.v2s.collaboration.api;

import java.util.List;
import java.util.UUID;

/** Workspace-scoped projections over checked-in catalogue definitions plus owner enablement facts. */
public interface CollaborationCatalogReadApi {
    CollaborationReadback.ExternalSystem readExternalSystem(
            UUID workspaceUuid, String groupWorkspaceKey, String externalSystemCode);

    CollaborationReadback.ProviderProfile readProviderProfile(
            UUID workspaceUuid, String groupWorkspaceKey, String providerCode);

    CollaborationReadback.Tree readTree(UUID workspaceUuid, String groupWorkspaceKey);

    default CollaborationReadback.Tree readCapabilityDictionary(UUID workspaceUuid, String groupWorkspaceKey) {
        return readTree(workspaceUuid, groupWorkspaceKey);
    }

    List<CollaborationReadback.ProviderProfile> listEnabledProviderProfiles(
            UUID workspaceUuid, String groupWorkspaceKey, String capabilityClass);
}
