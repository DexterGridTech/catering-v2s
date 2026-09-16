// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserAssignmentsItem(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "id", required = true) String id,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountId", required = true) String accountId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleId", required = true) String roleId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleName", required = true) String roleName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "serviceNodeType", required = true) ServiceNodeType serviceNodeType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "organizationPathNodes", required = true) java.util.List<OrganizationPathNode> organizationPathNodes,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "status", required = true) String status,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "source", required = true) String source,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "revision", required = true) Long revision,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "createdAt", required = true) Long createdAt,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "updatedAt", required = true) Long updatedAt
) {}
