package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.StoreOperatingRuleGate;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.OwnerGrant;
import com.catering.v2s.platform.command.WorkspaceCommandContextMint;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Creates the only concrete command-context implementations. Callers supply a generated token and an untrusted brand
 * selection; only organization-owned judgment output is retained in the returned scope.
 */
@Service
public final class CommandExecutionContextResolver {
    private final WorkspaceCapabilityScopeResolver capabilities;
    private final CatalogScopeLookup catalogScopes;
    private final WorkspaceAuthenticationService sessions;
    private final StoreOperatingRuleGate storeOperatingRuleGate;

    @org.springframework.beans.factory.annotation.Autowired
    public CommandExecutionContextResolver(
            WorkspaceCapabilityScopeResolver capabilities,
            CatalogScopeLookup catalogScopes,
            WorkspaceAuthenticationService sessions,
            StoreOperatingRuleGate storeOperatingRuleGate) {
        this.capabilities = capabilities;
        this.catalogScopes = catalogScopes;
        this.sessions = sessions;
        this.storeOperatingRuleGate = storeOperatingRuleGate;
    }

    /**
     * Loads the one immutable workspace-IAM command projection required by a non-catalog operations command. Target,
     * scope and owner judgment remain with that command's declared owner; this entry deliberately accepts no operation
     * identifier, request bag or callback.
     */
    public WorkspaceCommandAuthorizationFacts resolveOperations(String sessionCredential, String groupWorkspaceKey) {
        WorkspaceCommandAuthorizationFacts facts = resolveOperationsFacts(sessionCredential);
        requireGroupWorkspaceKey(facts.sessionReadback(), groupWorkspaceKey);
        return facts;
    }

    /**
     * Same one-load command projection for operations whose approved request contract carries an optimistic
     * workspace-context version.
     */
    public WorkspaceCommandAuthorizationFacts resolveOperationsAtContextVersion(
            String sessionCredential, String groupWorkspaceKey, long expectedContextVersion) {
        WorkspaceCommandAuthorizationFacts facts = resolveOperations(sessionCredential, groupWorkspaceKey);
        if (facts.sessionReadback().contextVersion() != expectedContextVersion) {
            throw new WorkspaceAuthenticationService.SessionConflictException();
        }
        return facts;
    }

    /**
     * Command entry point: the credential is decoded at the edge but its session, selected node and authorization facts
     * are read fresh inside the caller's REQUIRED transaction.
     */
    public WorkspaceExecutionContext<CatalogAuthorizationScope> resolveCatalog(
            String sessionCredential,
            WorkspaceCommandOperationToken token,
            String requestedDataNodeRef,
            CatalogScopeLookup.CatalogBrandSelection selection,
            String correlationId,
            String requestId) {
        if (sessions == null || sessionCredential == null || sessionCredential.isBlank()) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        WorkspaceSessionReadback session;
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            session = sessions.commandAuthorizationFacts(sessionCredential).sessionReadback();
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
        try {
            ResolvedDataNode target = resolveDataNode(session, token, requestedDataNodeRef);
            return resolveCatalogFromResolvedSession(
                    session, token, target.dataNodeType(), target.dataNodeId(), selection, correlationId, requestId);
        } catch (WorkspaceCommandAuthorizationService.AuthorizationDeniedException denied) {
            throw new CatalogScopeForbiddenException(denied);
        }
    }

    /**
     * Resolves a command context from a session already loaded by the current transaction. Package visibility permits
     * focused resolver tests without giving production callers a way to bypass the fresh-credential entry point.
     */
    WorkspaceExecutionContext<CatalogAuthorizationScope> resolveCatalogFromResolvedSession(
            WorkspaceSessionReadback session,
            WorkspaceCommandOperationToken token,
            String dataNodeType,
            UUID dataNodeId,
            CatalogScopeLookup.CatalogBrandSelection selection,
            String correlationId,
            String requestId) {
        if (session == null || token == null) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        try {
            if (dataNodeType == null
                    || dataNodeId == null
                    || !token.allowedDataNodeTypes().contains(dataNodeType)) {
                throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
            }
            String capability = token.capabilityFor(dataNodeType);
            WorkspaceCapabilityScopeResolver.CatalogScopeResolution catalogResolution =
                    capabilities.resolveGeneratedCatalogOperation(
                            session,
                            token.requirementId(),
                            capability,
                            new WorkspaceCapabilityScopeResolver.ServerResolvedResource(dataNodeType, dataNodeId),
                            selection);
            WorkspaceCapabilityScopeResolver.ScopeResolution resolution = catalogResolution.scopeResolution();
            if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW) {
                throw new CatalogScopeForbiddenException(catalogResolution.denialReason());
            }
            if (token.storeOperatingRuleKey() != null
                    && ServiceNodeTypes.STORE.equals(dataNodeType)) {
                if (storeOperatingRuleGate == null) {
                    throw new IllegalStateException("store operating-rule gate is not wired");
                }
                storeOperatingRuleGate.requireStoreOperatingRuleForStoreTarget(
                        session.workspaceUuid(),
                        session.groupWorkspaceKey(),
                        dataNodeType,
                        dataNodeId,
                        token.storeOperatingRuleKey());
            }
            OperationsOwnerScopeGrant legacyGrant = resolution.ownerScopeGrant(token.requirementId());
            CatalogScopeLookup.CatalogBrandJudgment judgment = catalogResolution.brandJudgment();
            CatalogAuthorizationScope.CopyRole copyRole = CatalogAuthorizationScope.CopyRole.valueOf(token.copyRole());
            UUID copySourceDataNodeId =
                    token.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
                            ? catalogScopes.resolveCatalogCopySource(
                                    session.workspaceUuid(),
                                    session.groupWorkspaceKey(),
                                    dataNodeType,
                                    dataNodeId,
                                    judgment.brandRef())
                            : null;
            OwnerGrant.Verifier verifier =
                    (requirementId, capabilityKey, targetType, targetId) -> legacyGrant.matchesRequirementAndCapability(
                            legacyGrant.workspaceUuid(),
                            legacyGrant.groupWorkspaceKey(),
                            targetType,
                            targetId,
                            requirementId,
                            capabilityKey);
            return WorkspaceCommandContextMint.mintCatalog(
                    session.workspaceUuid(),
                    session.groupWorkspaceKey(),
                    session.accountId(),
                    session.currentAssignmentId(),
                    "operations-admin",
                    token,
                    session.contextVersion(),
                    session.authorizationRevision(),
                    required(correlationId, "correlationId"),
                    required(requestId, "requestId"),
                    verifier,
                    dataNodeType,
                    dataNodeId,
                    judgment.brandRef(),
                    judgment.judgmentSource(),
                    judgment.judgmentRevision(),
                    copyRole,
                    token.copySourcePolicy(),
                    copySourceDataNodeId);
        } catch (WorkspaceCommandAuthorizationService.AuthorizationDeniedException denied) {
            throw new CatalogScopeForbiddenException(denied);
        }
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " must not be blank");
        return value;
    }

    private WorkspaceCommandAuthorizationFacts resolveOperationsFacts(String sessionCredential) {
        if (sessions == null || sessionCredential == null || sessionCredential.isBlank()) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            return sessions.commandAuthorizationFacts(sessionCredential);
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
    }

    private static void requireGroupWorkspaceKey(WorkspaceSessionReadback session, String groupWorkspaceKey) {
        if (session == null || groupWorkspaceKey == null || !groupWorkspaceKey.equals(session.groupWorkspaceKey())) {
            throw new WorkspaceAuthenticationService.SessionInvalidException();
        }
    }

    private static ResolvedDataNode resolveDataNode(
            WorkspaceSessionReadback session, WorkspaceCommandOperationToken token, String requestedDataNodeRef) {
        if (session == null || token == null || session.scopeContext() == null) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        List<ResolvedDataNode> candidates = new ArrayList<>();
        addCandidate(
                candidates,
                token,
                ServiceNodeTypes.STORE,
                session.scopeContext().store());
        addCandidate(
                candidates,
                token,
                ServiceNodeTypes.HEAD_COMPANY,
                session.scopeContext().headCompany());
        if (candidates.isEmpty()) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        String selected = requestedDataNodeRef == null ? "" : requestedDataNodeRef.trim();
        if (selected.isBlank()) {
            if (candidates.size() == 1) return candidates.getFirst();
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        return candidates.stream()
                .filter(candidate -> selected.equals(candidate.dataNodeId().toString()))
                .findFirst()
                .orElseThrow(WorkspaceCommandAuthorizationService.AuthorizationDeniedException::new);
    }

    private static void addCandidate(
            List<ResolvedDataNode> candidates,
            WorkspaceCommandOperationToken token,
            String dataNodeType,
            WorkspaceSessionEntryReadback.VisibleDataNodeCandidate candidate) {
        if (candidate != null
                && candidate.dataNodeId() != null
                && token.allowedDataNodeTypes().contains(dataNodeType)) {
            candidates.add(new ResolvedDataNode(dataNodeType, candidate.dataNodeId()));
        }
    }

    private record ResolvedDataNode(String dataNodeType, UUID dataNodeId) {}

    /** A session was authenticated, but its catalog command scope is not admissible. */
    public static final class CatalogScopeForbiddenException extends RuntimeException {
        private final WorkspaceCapabilityScopeResolver.CatalogScopeDenialReason denialReason;

        public CatalogScopeForbiddenException(Throwable cause) {
            super(cause);
            this.denialReason =
                    WorkspaceCapabilityScopeResolver.CatalogScopeDenialReason.EDGE_SESSION_OR_TARGET_REJECTED;
        }

        public CatalogScopeForbiddenException(WorkspaceCapabilityScopeResolver.CatalogScopeDenialReason denialReason) {
            this.denialReason = denialReason == null
                    ? WorkspaceCapabilityScopeResolver.CatalogScopeDenialReason.EDGE_SESSION_OR_TARGET_REJECTED
                    : denialReason;
        }

        public WorkspaceCapabilityScopeResolver.CatalogScopeDenialReason denialReason() {
            return denialReason;
        }
    }
}
