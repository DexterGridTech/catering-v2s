// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationHierarchyTree(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupCode", required = true) String groupCode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupName", required = true) String groupName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "regions", required = true) java.util.List<OrganizationHierarchyTreeNode> regions
) {}
