// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceRoleCreateRequest(
    String name,
    String description,
    String serviceNodeType,
    java.util.List<String> capabilityKeys,
    java.util.List<String> pageAccessKeys
) {}
