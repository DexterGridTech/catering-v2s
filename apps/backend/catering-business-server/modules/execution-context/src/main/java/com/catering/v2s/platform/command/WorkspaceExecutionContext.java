package com.catering.v2s.platform.command;

import java.util.UUID;

/** Read-only transaction-local command context. Concrete implementations stay in workspace-IAM. */
public abstract sealed class WorkspaceExecutionContext<S extends CatalogAuthorizationScope> permits WorkspaceCommandContextMint.ResolvedWorkspaceExecutionContext {
    WorkspaceExecutionContext() { }
    public abstract UUID workspaceUuid();
    public abstract String groupWorkspaceKey();
    public abstract UUID accountId();
    public abstract UUID assignmentId();
    public abstract String consumerFace();
    public abstract WorkspaceCommandOperationToken operationToken();
    public abstract long contextVersion();
    public abstract long authorizationRevision();
    public abstract String correlationId();
    public abstract String requestId();
    public abstract OwnerGrant ownerGrant();
    public abstract S ownerScope();
}
