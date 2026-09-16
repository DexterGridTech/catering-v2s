// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationHierarchySnapshot(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "commercialGroup", required = true) CommercialGroupRoot commercialGroup,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "items", required = true) java.util.List<OrganizationNode> items
) {}
