package com.catering.v2s.workspace.iam.api;

import java.util.Set;
import java.util.UUID;

public record WorkspaceSessionReadback(UUID sessionId, UUID workspaceUuid, String groupWorkspaceKey, UUID accountId, UUID currentAssignmentId, WorkspaceSessionEntryReadback.ScopeContext scopeContext, long contextVersion, long authorizationRevision, Set<String> pageAccessKeys, Set<String> actionCapabilityKeys, String accountDisplayName) {
}
