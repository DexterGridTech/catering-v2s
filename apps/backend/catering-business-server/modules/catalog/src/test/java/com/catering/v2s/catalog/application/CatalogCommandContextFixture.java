package com.catering.v2s.catalog.application;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import java.util.List;
import java.util.Set;
import java.util.UUID;

final class CatalogCommandContextFixture {
    private CatalogCommandContextFixture() {}

    static WorkspaceExecutionContext<CatalogAuthorizationScope> context(
            UUID workspaceId,
            String groupWorkspaceKey,
            UUID targetScope,
            String brandRef,
            WorkspaceCommandOperationToken token,
            UUID copySourceScope,
            String requestId) {
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        var session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                groupWorkspaceKey,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(
                        null,
                        null,
                        new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                                "STORE", targetScope, "test", "TEST", List.of(), null, null, targetScope, null),
                        null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "test",
                "STORE",
                targetScope);
        when(sessions.commandAuthorizationFacts("test-session"))
                .thenReturn(new com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts(
                        session, UUID.randomUUID(), "STORE", targetScope));
        WorkspaceCapabilityScopeResolver.ScopeResolution scopeResolution =
                new WorkspaceCapabilityScopeResolver.ScopeResolution(
                        WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                        token.capabilityFor("STORE"),
                        new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                workspaceId,
                                groupWorkspaceKey,
                                "STORE",
                                targetScope,
                                "STORE",
                                targetScope,
                                List.of(targetScope)));
        CatalogScopeLookup.CatalogBrandJudgment brandJudgment =
                new CatalogScopeLookup.CatalogBrandJudgment(brandRef, "TEST", "REVISION");
        when(capabilities.resolveGeneratedCatalogOperation(any(), any(), any(), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        scopeResolution, brandJudgment, null));
        if (copySourceScope != null) {
            when(catalogScopes.resolveCatalogCopySource(any(), any(), any(), any(), any()))
                    .thenReturn(copySourceScope);
        }
        return new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "test-session",
                        token,
                        targetScope.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(brandRef),
                        "correlation",
                        requestId);
    }
}
