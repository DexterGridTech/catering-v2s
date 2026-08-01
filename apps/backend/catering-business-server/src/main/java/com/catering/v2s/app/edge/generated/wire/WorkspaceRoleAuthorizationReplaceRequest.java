// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleAuthorizationReplaceRequest(
    java.util.List<String> pageAccessKeys,
    java.util.List<String> actionCapabilityKeys,
    Long expectedVersion
) {}
