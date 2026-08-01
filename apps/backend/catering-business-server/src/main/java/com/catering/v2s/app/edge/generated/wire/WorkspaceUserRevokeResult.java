// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceUserRevokeResult(
    String revokedAssignmentId,
    Boolean accountRetained,
    WorkspaceUser user,
    Long contextVersion,
    Boolean sessionEntryRequired,
    WorkspaceSessionEntry sessionEntry
) {}
