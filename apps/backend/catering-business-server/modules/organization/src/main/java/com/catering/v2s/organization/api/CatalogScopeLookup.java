package com.catering.v2s.organization.api;

import java.util.UUID;

/** Organization-owned brand judgment for catalog and inventory task scopes. */
public interface CatalogScopeLookup {
    /**
     * Resolves the catalog brand from organization-owned facts. The optional selection is an untrusted disambiguator
     * for a multi-brand head company; it is never itself an authorization fact or a CatalogAuthorizationScope field.
     */
    CatalogBrandJudgment resolveCatalogBrand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            UUID dataNodeId,
            CatalogBrandSelection selection);

    /**
     * Returns the only brand allowed for a store, or validates a requested brand against a head-company authorization.
     * A null requested brand is only valid when the selected node has one persisted brand (a store).
     */
    default String requireCatalogBrand(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String dataNodeType,
            UUID dataNodeId,
            String requestedBrandRef) {
        return resolveCatalogBrand(
                        workspaceUuid,
                        groupWorkspaceKey,
                        dataNodeType,
                        dataNodeId,
                        CatalogBrandSelection.fromRequestValue(requestedBrandRef))
                .brandRef();
    }

    record CatalogBrandSelection(String value) {
        public static CatalogBrandSelection fromRequestValue(String value) {
            return new CatalogBrandSelection(value == null || value.isBlank() ? null : value.trim());
        }
    }

    record CatalogBrandJudgment(String brandRef, String judgmentSource, String judgmentRevision) {
        public CatalogBrandJudgment {
            if (brandRef == null
                    || brandRef.isBlank()
                    || judgmentSource == null
                    || judgmentSource.isBlank()
                    || judgmentRevision == null
                    || judgmentRevision.isBlank()) {
                throw new IllegalArgumentException("catalog brand judgment is incomplete");
            }
        }
    }

    /**
     * Validates the only legal brand-copy source for a target node. The source is an organization fact, never a client
     * supplied authority.
     */
    void requireCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            UUID sourceDataNodeId,
            String brandRef);

    /** Resolves the only organization-approved brand catalog source for a target store. */
    UUID resolveCatalogCopySource(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            String targetDataNodeType,
            UUID targetDataNodeId,
            String brandRef);
}
