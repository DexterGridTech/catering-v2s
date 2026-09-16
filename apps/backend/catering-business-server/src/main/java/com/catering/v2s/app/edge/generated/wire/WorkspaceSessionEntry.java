// Generated from accepted R5 OpenAPI components; do not edit.
package com.catering.v2s.app.edge.generated.wire;

public record WorkspaceSessionEntry(
    @com.fasterxml.jackson.annotation.JsonProperty(value = "groupWorkspaceKey", required = true) String groupWorkspaceKey,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "accountId", required = true) String accountId,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "displayName", required = true) String displayName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "contextVersion", required = true) Long contextVersion,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "mode", required = true) String mode,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "outcome", required = true) String outcome,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "candidates", required = true) java.util.List<WorkspaceSessionEntryCandidatesItem> candidates,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "actionGrants", required = true) java.util.List<String> actionGrants,
    java.util.List<WorkspaceScopeNode> dataNodeCandidates,
    WorkspaceSessionEntrySelected selected,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "scopeContext", required = true) WorkspaceScopeContext scopeContext,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "workspaceName", required = true) String workspaceName,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "operationsTitle", required = true) String operationsTitle,
    @com.fasterxml.jackson.annotation.JsonProperty(value = "logoUrl", required = true) String logoUrl
) {}
