// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceInvitationCreateRequest(
    String mobile,
    ServiceNodeType targetOrganizationType,
    String targetOrganizationRef,
    java.util.List<String> roleIds
) {}
