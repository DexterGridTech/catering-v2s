package com.catering.v2s.workspace.iam.application;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.command.WorkspaceCommandContextMint;
import com.catering.v2s.platform.command.OwnerGrant;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.platform.foundation.persistence.DatabaseOperationTracker;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Creates the only concrete command-context implementations.  Callers supply
 * a generated token and an untrusted brand selection; only organization-owned
 * judgment output is retained in the returned scope.
 */
@Service
public final class CommandExecutionContextResolver {
    private final WorkspaceCapabilityScopeResolver capabilities;
    private final CatalogScopeLookup catalogScopes;
    private final WorkspaceAuthenticationService sessions;

    public CommandExecutionContextResolver(WorkspaceCapabilityScopeResolver capabilities, CatalogScopeLookup catalogScopes) {
        this(capabilities, catalogScopes, null);
    }

    @org.springframework.beans.factory.annotation.Autowired
    public CommandExecutionContextResolver(
        WorkspaceCapabilityScopeResolver capabilities,
        CatalogScopeLookup catalogScopes,
        WorkspaceAuthenticationService sessions
    ) {
        this.capabilities = capabilities;
        this.catalogScopes = catalogScopes;
        this.sessions = sessions;
    }

    /**
     * Command entry point: the credential is decoded at the edge but its
     * session, selected node and authorization facts are read fresh inside the
     * caller's REQUIRED transaction.
     */
    public WorkspaceExecutionContext<CatalogAuthorizationScope> resolveCatalog(
        String sessionCredential,
        WorkspaceCommandOperationToken token,
        String requestedDataNodeRef,
        CatalogScopeLookup.CatalogBrandSelection selection,
        String correlationId,
        String requestId
    ) {
        if (sessions == null || sessionCredential == null || sessionCredential.isBlank()) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        WorkspaceSessionReadback session;
        try (var ignored = DatabaseOperationTracker.pushSection(DatabaseOperationTracker.Section.SESSION)) {
            session = sessions.session(sessionCredential);
        } finally {
            DatabaseOperationTracker.markPhase(DatabaseOperationTracker.Phase.SESSION_RESOLVED);
        }
        ResolvedDataNode target = resolveDataNode(session, token, requestedDataNodeRef);
        return resolveCatalogFromResolvedSession(session, token, target.dataNodeType(), target.dataNodeId(), selection, correlationId, requestId);
    }

    /**
     * Resolves a command context from a session already loaded by the current
     * transaction. Package visibility permits focused resolver tests without
     * giving production callers a way to bypass the fresh-credential entry point.
     */
    WorkspaceExecutionContext<CatalogAuthorizationScope> resolveCatalogFromResolvedSession(
        WorkspaceSessionReadback session,
        WorkspaceCommandOperationToken token,
        String dataNodeType,
        UUID dataNodeId,
        CatalogScopeLookup.CatalogBrandSelection selection,
        String correlationId,
        String requestId
    ) {
        if (session == null || token == null || dataNodeType == null || dataNodeId == null
            || !token.allowedDataNodeTypes().contains(dataNodeType)) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        String capability = token.capabilityFor(dataNodeType);
        WorkspaceCapabilityScopeResolver.ScopeResolution resolution = capabilities.resolveGeneratedOperation(
            session,
            token.requirementId(),
            capability,
            new WorkspaceCapabilityScopeResolver.ServerResolvedResource(dataNodeType, dataNodeId)
        );
        OperationsOwnerScopeGrant legacyGrant = resolution.ownerScopeGrant(token.requirementId());
        CatalogScopeLookup.CatalogBrandJudgment judgment = catalogScopes.resolveCatalogBrand(
            session.workspaceUuid(), session.groupWorkspaceKey(), dataNodeType, dataNodeId, selection
        );
        CatalogAuthorizationScope.CopyRole copyRole = CatalogAuthorizationScope.CopyRole.valueOf(token.copyRole());
        UUID copySourceDataNodeId = token.copySourcePolicy() == WorkspaceCommandOperationToken.CopySourcePolicy.ORGANIZATION_JUDGMENT
            ? catalogScopes.resolveCatalogCopySource(
                session.workspaceUuid(), session.groupWorkspaceKey(), dataNodeType, dataNodeId, judgment.brandRef()
            )
            : null;
        OwnerGrant.Verifier verifier = (requirementId, capabilityKey, targetType, targetId) ->
            legacyGrant.matchesRequirementAndCapability(
                legacyGrant.workspaceUuid(), legacyGrant.groupWorkspaceKey(), targetType, targetId, requirementId, capabilityKey
            );
        return WorkspaceCommandContextMint.mintCatalog(
            session.workspaceUuid(), session.groupWorkspaceKey(), session.accountId(), session.currentAssignmentId(),
            "operations-admin", token, session.contextVersion(), session.authorizationRevision(),
            required(correlationId, "correlationId"), required(requestId, "requestId"),
            verifier, dataNodeType, dataNodeId, judgment.brandRef(), judgment.judgmentSource(),
            judgment.judgmentRevision(), copyRole, token.copySourcePolicy(), copySourceDataNodeId
        );
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException(name + " must not be blank");
        return value;
    }

    private static ResolvedDataNode resolveDataNode(
        WorkspaceSessionReadback session,
        WorkspaceCommandOperationToken token,
        String requestedDataNodeRef
    ) {
        if (session == null || token == null || session.scopeContext() == null) {
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        List<ResolvedDataNode> candidates = new ArrayList<>();
        addCandidate(candidates, token, ServiceNodeTypes.STORE, session.scopeContext().store());
        addCandidate(candidates, token, ServiceNodeTypes.HEAD_COMPANY, session.scopeContext().headCompany());
        if (candidates.isEmpty()) throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        String selected = requestedDataNodeRef == null ? "" : requestedDataNodeRef.trim();
        if (selected.isBlank()) {
            if (candidates.size() == 1) return candidates.getFirst();
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        }
        return candidates.stream().filter(candidate -> selected.equals(candidate.dataNodeId().toString())).findFirst()
            .orElseThrow(WorkspaceCommandAuthorizationService.AuthorizationDeniedException::new);
    }

    private static void addCandidate(
        List<ResolvedDataNode> candidates,
        WorkspaceCommandOperationToken token,
        String dataNodeType,
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate candidate
    ) {
        if (candidate != null && candidate.dataNodeId() != null && token.allowedDataNodeTypes().contains(dataNodeType)) {
            candidates.add(new ResolvedDataNode(dataNodeType, candidate.dataNodeId()));
        }
    }

    private record ResolvedDataNode(String dataNodeType, UUID dataNodeId) { }

}
