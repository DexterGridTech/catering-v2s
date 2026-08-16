package com.catering.v2s.workspace.iam.api;

import java.util.Set;
import java.util.UUID;

public record WorkspaceSessionReadback(
        UUID sessionId,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        UUID accountId,
        UUID currentAssignmentId,
        WorkspaceSessionEntryReadback.ScopeContext scopeContext,
        long contextVersion,
        long authorizationRevision,
        Set<String> pageAccessKeys,
        Set<String> actionCapabilityKeys,
        String accountDisplayName,
        String assignmentNodeType,
        UUID assignmentNodeId) {
    /**
     * Legacy session and protocol callers do not carry command authorization facts. Keeping this constructor makes that
     * boundary explicit instead of allowing them to impersonate a freshly loaded command projection.
     */
    public WorkspaceSessionReadback(
            UUID sessionId,
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            UUID currentAssignmentId,
            WorkspaceSessionEntryReadback.ScopeContext scopeContext,
            long contextVersion,
            long authorizationRevision,
            Set<String> pageAccessKeys,
            Set<String> actionCapabilityKeys,
            String accountDisplayName) {
        this(
                sessionId,
                workspaceUuid,
                groupWorkspaceKey,
                accountId,
                currentAssignmentId,
                scopeContext,
                contextVersion,
                authorizationRevision,
                pageAccessKeys,
                actionCapabilityKeys,
                accountDisplayName,
                null,
                null);
    }
}
