// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractCandidatePage(
    String groupWorkspaceKey,
    StoreContractCandidatePageProject project,
    StoreContractCandidatePageMetadata metadata,
    java.util.List<StoreContractStoreCandidate> stores,
    java.util.List<String> phases,
    StoreContractSelectedTenant selectedStoreTenant
) {}
