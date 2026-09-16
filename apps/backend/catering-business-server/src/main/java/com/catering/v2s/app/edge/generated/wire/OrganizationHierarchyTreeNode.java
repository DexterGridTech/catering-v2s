// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record OrganizationHierarchyTreeNode(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) java.util.UUID id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "type", required = true) String type,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "code", required = true) String code,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "name", required = true) String name,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) OrganizationOverviewStatus status,
    String notes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "children", required = true) java.util.List<OrganizationHierarchyTreeNode> children,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "phases", required = true) java.util.List<String> phases
) {}
