// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationCreateRequest(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mobile", required = true) String mobile,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationType", required = true) String targetOrganizationType,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "targetOrganizationRef", required = true) java.util.UUID targetOrganizationRef,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "roleIds", required = true) java.util.List<String> roleIds
) {}
