package com.catering.v2s.organization.api;

import java.util.UUID;

/** Organization-owned brand judgment for catalog and inventory task scopes. */
public interface CatalogScopeLookup {
    /**
     * Returns the only brand allowed for a store, or validates a requested brand
     * against a head-company authorization. A null requested brand is only valid
     * when the selected node has one persisted brand (a store).
     */
    String requireCatalogBrand(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String dataNodeType,
        UUID dataNodeId,
        String requestedBrandRef
    );

    /**
     * Validates the only legal brand-copy source for a target node.  The
     * source is an organization fact, never a client supplied authority.
     */
    void requireCatalogCopySource(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String targetDataNodeType,
        UUID targetDataNodeId,
        UUID sourceDataNodeId,
        String brandRef
    );

    /** Resolves the only organization-approved brand catalog source for a target store. */
    UUID resolveCatalogCopySource(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String targetDataNodeType,
        UUID targetDataNodeId,
        String brandRef
    );
}
