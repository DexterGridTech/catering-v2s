// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntry(
    String groupWorkspaceKey,
    String accountId,
    String displayName,
    Long contextVersion,
    String mode,
    String outcome,
    java.util.List<WorkspaceSessionEntryCandidatesItem> candidates,
    java.util.List<String> actionGrants,
    java.util.List<WorkspaceScopeNode> dataNodeCandidates,
    WorkspaceSessionEntrySelected selected,
    WorkspaceScopeContext scopeContext,
    String workspaceName,
    String operationsTitle,
    String logoUrl
) {}
