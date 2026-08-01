// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleUpdateRequest(
    String name,
    String description,
    java.util.List<String> capabilityKeys,
    java.util.List<String> pageAccessKeys,
    Long expectedVersion
) {}
