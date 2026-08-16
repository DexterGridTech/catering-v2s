package com.catering.v2s.organization.api;

import java.util.UUID;

/** Consumer-owned authorization port implemented by workspace-IAM. */
public interface WorkspaceAssignmentScopeLookup {
    AssignmentScope requireActiveScope(UUID workspaceUuid, String groupWorkspaceKey, UUID assignmentId);

    record AssignmentScope(String serviceNodeType, UUID serviceNodeId) {}
}
