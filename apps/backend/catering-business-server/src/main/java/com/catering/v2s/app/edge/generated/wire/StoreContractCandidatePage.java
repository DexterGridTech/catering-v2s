// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record StoreContractCandidatePage(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "project", required = true) StoreContractCandidatePageProject project,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "metadata", required = true) StoreContractCandidatePageMetadata metadata,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "stores", required = true) java.util.List<StoreContractStoreCandidate> stores,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phases", required = true) java.util.List<String> phases,
    tools.jackson.databind.JsonNode selectedStoreTenant
) {}
