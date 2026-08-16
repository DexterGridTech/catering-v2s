package com.catering.v2s.platform.command;

import java.util.Objects;
import java.util.UUID;

/**
 * The only minting seam for a workspace command context.
 *
 * <p>All concrete command-capability classes stay in the execution-context module. The resolver supplies only a
 * verifier closure; it cannot expose a legacy grant as part of the public cross-owner type. The generated token gate
 * keeps this package's source set closed, so no other module can add a sibling subtype with package construction
 * access.
 */
public final class WorkspaceCommandContextMint {
    private static final String RESOLVER = "com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver";

    private WorkspaceCommandContextMint() {}

    public static WorkspaceExecutionContext<CatalogAuthorizationScope> mintCatalog(
            UUID workspaceUuid,
            String groupWorkspaceKey,
            UUID accountId,
            UUID assignmentId,
            String consumerFace,
            WorkspaceCommandOperationToken token,
            long contextVersion,
            long authorizationRevision,
            String correlationId,
            String requestId,
            OwnerGrant.Verifier verifier,
            String dataNodeType,
            UUID dataNodeId,
            String brandRef,
            String judgmentSource,
            String judgmentRevision,
            CatalogAuthorizationScope.CopyRole copyRole,
            WorkspaceCommandOperationToken.CopySourcePolicy copySourcePolicy,
            UUID copySourceDataNodeId) {
        requireResolverCaller();
        return new ResolvedWorkspaceExecutionContext(
                Objects.requireNonNull(workspaceUuid, "workspaceUuid"),
                required(groupWorkspaceKey, "groupWorkspaceKey"),
                Objects.requireNonNull(accountId, "accountId"),
                Objects.requireNonNull(assignmentId, "assignmentId"),
                required(consumerFace, "consumerFace"),
                Objects.requireNonNull(token, "token"),
                contextVersion,
                authorizationRevision,
                required(correlationId, "correlationId"),
                required(requestId, "requestId"),
                new ResolvedOwnerGrant(Objects.requireNonNull(verifier, "verifier")),
                new ResolvedCatalogAuthorizationScope(
                        dataNodeType,
                        dataNodeId,
                        brandRef,
                        judgmentSource,
                        judgmentRevision,
                        copyRole,
                        copySourcePolicy,
                        copySourceDataNodeId));
    }

    private static void requireResolverCaller() {
        String caller = StackWalker.getInstance(StackWalker.Option.RETAIN_CLASS_REFERENCE)
                .walk(frames -> frames.map(frame -> frame.getDeclaringClass().getName())
                        .filter(name -> !name.equals(WorkspaceCommandContextMint.class.getName()))
                        .findFirst()
                        .orElse(""));
        if (!RESOLVER.equals(caller)) throw new IllegalStateException("WORKSPACE_COMMAND_CONTEXT_MINT_FORBIDDEN");
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " must not be blank");
        return value;
    }

    static final class ResolvedOwnerGrant extends OwnerGrant {
        private final Verifier verifier;

        private ResolvedOwnerGrant(Verifier verifier) {
            this.verifier = verifier;
        }

        @Override
        public boolean verifyFor(String requirementId, String capabilityKey, String targetType, UUID targetId) {
            return verifier.verifyFor(requirementId, capabilityKey, targetType, targetId);
        }
    }

    static final class ResolvedCatalogAuthorizationScope extends CatalogAuthorizationScope {
        private final String dataNodeType;
        private final UUID dataNodeId;
        private final String brandRef;
        private final String judgmentSource;
        private final String judgmentRevision;
        private final CopyRole copyRole;
        private final WorkspaceCommandOperationToken.CopySourcePolicy copySourcePolicy;
        private final UUID copySourceDataNodeId;

        private ResolvedCatalogAuthorizationScope(
                String dataNodeType,
                UUID dataNodeId,
                String brandRef,
                String judgmentSource,
                String judgmentRevision,
                CopyRole copyRole,
                WorkspaceCommandOperationToken.CopySourcePolicy copySourcePolicy,
                UUID copySourceDataNodeId) {
            this.dataNodeType = required(dataNodeType, "dataNodeType");
            this.dataNodeId = Objects.requireNonNull(dataNodeId, "dataNodeId");
            this.brandRef = required(brandRef, "brandRef");
            this.judgmentSource = required(judgmentSource, "judgmentSource");
            this.judgmentRevision = required(judgmentRevision, "judgmentRevision");
            this.copyRole = Objects.requireNonNull(copyRole, "copyRole");
            this.copySourcePolicy = Objects.requireNonNull(copySourcePolicy, "copySourcePolicy");
            this.copySourceDataNodeId = copySourceDataNodeId;
            if (copyRole == CopyRole.COPY_TARGET
                    && copySourcePolicy == WorkspaceCommandOperationToken.CopySourcePolicy.NONE)
                throw new IllegalArgumentException("copy target requires a source policy");
            if (copyRole != CopyRole.COPY_TARGET
                    && copySourcePolicy != WorkspaceCommandOperationToken.CopySourcePolicy.NONE)
                throw new IllegalArgumentException("non-copy target cannot carry a source policy");
            if (copySourcePolicy == WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
                    && copySourceDataNodeId == null)
                throw new IllegalArgumentException("organization source policy requires a source judgment");
            if (copySourcePolicy != WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
                    && copySourceDataNodeId != null)
                throw new IllegalArgumentException("only organization source policy can carry a source judgment");
        }

        @Override
        public String dataNodeType() {
            return dataNodeType;
        }

        @Override
        public UUID dataNodeId() {
            return dataNodeId;
        }

        @Override
        public String brandRef() {
            return brandRef;
        }

        @Override
        public String judgmentSource() {
            return judgmentSource;
        }

        @Override
        public String judgmentRevision() {
            return judgmentRevision;
        }

        @Override
        public CopyRole copyRole() {
            return copyRole;
        }

        @Override
        public WorkspaceCommandOperationToken.CopySourcePolicy copySourcePolicy() {
            return copySourcePolicy;
        }

        @Override
        public UUID copySourceDataNodeId() {
            return copySourceDataNodeId;
        }
    }

    static final class ResolvedWorkspaceExecutionContext extends WorkspaceExecutionContext<CatalogAuthorizationScope> {
        private final UUID workspaceUuid;
        private final String groupWorkspaceKey;
        private final UUID accountId;
        private final UUID assignmentId;
        private final String consumerFace;
        private final WorkspaceCommandOperationToken operationToken;
        private final long contextVersion;
        private final long authorizationRevision;
        private final String correlationId;
        private final String requestId;
        private final OwnerGrant ownerGrant;
        private final CatalogAuthorizationScope ownerScope;

        private ResolvedWorkspaceExecutionContext(
                UUID workspaceUuid,
                String groupWorkspaceKey,
                UUID accountId,
                UUID assignmentId,
                String consumerFace,
                WorkspaceCommandOperationToken operationToken,
                long contextVersion,
                long authorizationRevision,
                String correlationId,
                String requestId,
                OwnerGrant ownerGrant,
                CatalogAuthorizationScope ownerScope) {
            this.workspaceUuid = workspaceUuid;
            this.groupWorkspaceKey = groupWorkspaceKey;
            this.accountId = accountId;
            this.assignmentId = assignmentId;
            this.consumerFace = consumerFace;
            this.operationToken = operationToken;
            this.contextVersion = contextVersion;
            this.authorizationRevision = authorizationRevision;
            this.correlationId = correlationId;
            this.requestId = requestId;
            this.ownerGrant = ownerGrant;
            this.ownerScope = ownerScope;
        }

        @Override
        public UUID workspaceUuid() {
            return workspaceUuid;
        }

        @Override
        public String groupWorkspaceKey() {
            return groupWorkspaceKey;
        }

        @Override
        public UUID accountId() {
            return accountId;
        }

        @Override
        public UUID assignmentId() {
            return assignmentId;
        }

        @Override
        public String consumerFace() {
            return consumerFace;
        }

        @Override
        public WorkspaceCommandOperationToken operationToken() {
            return operationToken;
        }

        @Override
        public long contextVersion() {
            return contextVersion;
        }

        @Override
        public long authorizationRevision() {
            return authorizationRevision;
        }

        @Override
        public String correlationId() {
            return correlationId;
        }

        @Override
        public String requestId() {
            return requestId;
        }

        @Override
        public OwnerGrant ownerGrant() {
            return ownerGrant;
        }

        @Override
        public CatalogAuthorizationScope ownerScope() {
            return ownerScope;
        }
    }
}
