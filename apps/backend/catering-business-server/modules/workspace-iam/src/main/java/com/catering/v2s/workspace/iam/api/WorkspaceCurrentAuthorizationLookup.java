package com.catering.v2s.workspace.iam.api;

import java.util.Objects;
import java.util.UUID;

/** Rechecks a persisted workspace session against current IAM facts and the current target scope. */
public interface WorkspaceCurrentAuthorizationLookup {
    boolean isCurrentlyAuthorized(CurrentAuthorizationQuery query);

    record CurrentAuthorizationQuery(
            UUID sessionId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            String requirementId,
            String targetType,
            UUID targetId) {
        public CurrentAuthorizationQuery {
            Objects.requireNonNull(sessionId, "sessionId");
            Objects.requireNonNull(workspaceUuid, "workspaceUuid");
            Objects.requireNonNull(accountId, "accountId");
            Objects.requireNonNull(targetId, "targetId");
            if (groupWorkspaceKey == null || groupWorkspaceKey.isBlank()
                    || requirementId == null || requirementId.isBlank()
                    || targetType == null || targetType.isBlank()) {
                throw new IllegalArgumentException("authorization query identity is required");
            }
        }
    }
}
