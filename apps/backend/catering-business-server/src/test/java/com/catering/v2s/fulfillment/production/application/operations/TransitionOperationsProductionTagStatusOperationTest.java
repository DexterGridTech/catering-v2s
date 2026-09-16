package com.catering.v2s.fulfillment.production.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.app.edge.generated.wire.ProductionTagTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.fulfillment.production.api.ProductionTagOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TransitionOperationsProductionTagStatusOperationTest {
    @Test
    void voidIsBlockedWhenTheCatalogStillReferencesTheResolvedTag() {
        UUID dataNodeRef = UUID.randomUUID();
        UUID tagRef = UUID.randomUUID();
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = commandContext(dataNodeRef);
        CommandExecutionContextResolver contexts = mock(CommandExecutionContextResolver.class);
        ProductionTagOwnerApi productionTags = mock(ProductionTagOwnerApi.class);
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        when(contexts.resolveCatalog(any(), any(), any(), any(), any(), any())).thenReturn(context);
        when(productionTags.resolveProductionTagRef(context, "HOT")).thenReturn(tagRef);
        when(catalog.productionTagReferenced(dataNodeRef.toString(), "BRAND", tagRef.toString()))
                .thenReturn(true);
        var operation = new TransitionOperationsProductionTagStatusOperation(contexts, productionTags, catalog);
        var invocation = new TransitionOperationsProductionTagStatusOperation.Invocation(
                new ProductionTagTransitionRequest(
                        "HOT", 7L, CatalogInventoryWireEnums.DictionaryEntryStatus.VOIDED, dataNodeRef),
                "session",
                "BRAND",
                "correlation",
                "request",
                "HOT",
                "key");

        ProductionTagOwnerApi.Problem failure =
                assertThrows(ProductionTagOwnerApi.Problem.class, () -> operation.execute(invocation));

        assertEquals("REFERENCE_BLOCKS_VOID", failure.code());
        verify(productionTags).resolveProductionTagRef(context, "HOT");
        verify(catalog).productionTagReferenced(dataNodeRef.toString(), "BRAND", tagRef.toString());
        verify(productionTags, never()).transitionTagStatus(any(), any(), any());
    }

    private static WorkspaceExecutionContext<CatalogAuthorizationScope> commandContext(UUID dataNodeRef) {
        UUID workspaceId = UUID.randomUUID();
        var token = CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_PRODUCTION_TAG_STATUS;
        var session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                "production-tag-test",
                UUID.randomUUID(),
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(
                        null,
                        null,
                        new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                                "STORE", dataNodeRef, "test", "TEST", List.of(), null, null, dataNodeRef, null),
                        null),
                1L,
                1L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "test",
                "STORE",
                dataNodeRef);
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        when(sessions.commandAuthorizationFacts("session"))
                .thenReturn(new com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts(
                        session, UUID.randomUUID(), "STORE", dataNodeRef));
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        when(capabilities.resolveGeneratedCatalogOperation(any(), any(), any(), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        workspaceId,
                                        "production-tag-test",
                                        "STORE",
                                        dataNodeRef,
                                        "STORE",
                                        dataNodeRef,
                                        List.of(dataNodeRef))),
                        new CatalogScopeLookup.CatalogBrandJudgment("BRAND", "TEST", "REVISION"),
                        null));
        CatalogScopeLookup scopes = mock(CatalogScopeLookup.class);
        return new CommandExecutionContextResolver(
                        capabilities, scopes, sessions, (workspace, group, targetType, storeId) -> {})
                .resolveCatalog(
                        "session",
                        token,
                        dataNodeRef.toString(),
                        CatalogScopeLookup.CatalogBrandSelection.fromRequestValue("BRAND"),
                        "correlation",
                        "request");
    }
}
