package com.catering.v2s.platform.command;

import java.util.UUID;

/** Immutable catalog authorization projection produced only by workspace-IAM resolution. */
public abstract sealed class CatalogAuthorizationScope
        permits WorkspaceCommandContextMint.ResolvedCatalogAuthorizationScope {
    CatalogAuthorizationScope() {}

    public enum CopyRole {
        NONE,
        COPY_SOURCE,
        COPY_TARGET
    }

    public abstract String dataNodeType();

    public abstract UUID dataNodeId();

    public abstract String brandRef();

    public abstract String judgmentSource();

    public abstract String judgmentRevision();

    public abstract CopyRole copyRole();

    public abstract WorkspaceCommandOperationToken.CopySourcePolicy copySourcePolicy();
    /** Present only when the static policy requires an organization judgment. */
    public abstract UUID copySourceDataNodeId();
}
