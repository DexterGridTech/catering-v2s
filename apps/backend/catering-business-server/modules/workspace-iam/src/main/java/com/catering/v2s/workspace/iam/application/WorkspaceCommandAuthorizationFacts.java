package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable workspace-iam projection minted once at an operations command boundary.
 *
 * <p>It intentionally contains only workspace-iam facts.  Organization scope, target-path
 * judgment and owner state remain owned and rechecked by their respective modules.</p>
 */
public record WorkspaceCommandAuthorizationFacts(
    WorkspaceSessionReadback sessionReadback,
    UUID roleId,
    String assignmentNodeType,
    UUID assignmentNodeId
) {
    public WorkspaceCommandAuthorizationFacts {
        Objects.requireNonNull(sessionReadback, "sessionReadback");
        Objects.requireNonNull(roleId, "roleId");
        Objects.requireNonNull(assignmentNodeType, "assignmentNodeType");
        Objects.requireNonNull(assignmentNodeId, "assignmentNodeId");
        if (!assignmentNodeType.equals(sessionReadback.assignmentNodeType())
            || !assignmentNodeId.equals(sessionReadback.assignmentNodeId())) {
            throw new IllegalArgumentException("command assignment projection mismatch");
        }
    }
}
