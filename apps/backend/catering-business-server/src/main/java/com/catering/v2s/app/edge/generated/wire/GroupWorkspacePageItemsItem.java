// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record GroupWorkspacePageItemsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    String operationsTitle,
    java.util.UUID logoAssetRef,
    String logoUrl,
    GroupWorkspacePageItemsItemCommercialGroup commercialGroup,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) GroupWorkspaceStatus status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
