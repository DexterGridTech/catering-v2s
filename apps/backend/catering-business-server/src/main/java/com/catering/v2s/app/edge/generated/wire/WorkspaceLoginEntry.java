// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceLoginEntry(
    String groupWorkspaceKey,
    String workspaceName,
    String operationsTitle,
    GroupWorkspaceStatus status,
    String sessionState,
    String logoUrl
) {}
