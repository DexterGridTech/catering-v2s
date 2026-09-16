package com.catering.v2s.catalog.application.operations;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.app.edge.generated.wire.CatalogItemTransitionRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
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

/** M-02: only the catalog owner may turn a business item code into the inventory opaque ref. */
class TransitionOperationsCatalogItemStatusOperationTest {
    @Test
    void commonBusinessCodeWithInventoryFactsIsBlocked() {
        Fixture fixture = fixture("API-LATTE-001", true);

        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class, () -> fixture.operation().execute(fixture.invocation()));

        assertEquals("REFERENCE_BLOCKS_VOID", failure.code());
        verify(fixture.catalog())
                .transitionCatalogItemStatus(
                        eq(fixture.context()),
                        eq(new CatalogOwnerApi.CatalogItemStatusTransitionCommand("API-LATTE-001", 7L, "VOIDED")),
                        eq("void-key"));
    }

    @Test
    void noInventoryFactsAllowsTheResolvedCatalogItemToVoid() {
        Fixture fixture = fixture("API-LATTE-001", false);

        var response = fixture.operation().execute(fixture.invocation());

        assertEquals(
                CatalogInventoryWireEnums.CatalogItemStatus.VOIDED,
                response.result().status());
        verify(fixture.catalog())
                .transitionCatalogItemStatus(
                        eq(fixture.context()),
                        eq(new CatalogOwnerApi.CatalogItemStatusTransitionCommand("API-LATTE-001", 7L, "VOIDED")),
                        eq("void-key"));
    }

    @Test
    void uuidShapedBusinessCodeStillUsesItsCatalogOwnedRefAndCannotBypassDependencies() {
        String uuidShapedCode = UUID.randomUUID().toString();
        Fixture fixture = fixture(uuidShapedCode, true);

        CatalogOwnerApi.Problem failure = assertThrows(
                CatalogOwnerApi.Problem.class, () -> fixture.operation().execute(fixture.invocation()));

        assertEquals("REFERENCE_BLOCKS_VOID", failure.code());
        verify(fixture.catalog())
                .transitionCatalogItemStatus(
                        eq(fixture.context()),
                        eq(new CatalogOwnerApi.CatalogItemStatusTransitionCommand(uuidShapedCode, 7L, "VOIDED")),
                        eq("void-key"));
    }

    private static Fixture fixture(String itemCode, boolean hasDependentFacts) {
        CatalogOwnerApi catalog = mock(CatalogOwnerApi.class);
        UUID catalogItemRef = UUID.randomUUID();
        UUID dataNodeRef = UUID.randomUUID();
        WorkspaceCommandOperationFixture command = commandContext(dataNodeRef);
        CommandExecutionContextResolver contexts = mock(CommandExecutionContextResolver.class);
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = command.context();
        when(contexts.resolveCatalog(any(), any(), any(), any(), any(), any())).thenReturn(context);
        var readback = new CatalogOwnerApi.CatalogItemCommandReadback(
                "CATALOG_ITEM",
                catalogItemRef.toString(),
                "VOIDED",
                8L,
                List.of(new CatalogOwnerApi.CatalogItemOwnerReadback("catalog", "COMMITTED", 8L)),
                new CatalogOwnerApi.CatalogItemActionAvailability(false, false, false));
        if (hasDependentFacts) {
            when(catalog.transitionCatalogItemStatus(any(), any(), any()))
                    .thenThrow(new CatalogOwnerApi.Problem(
                            "REFERENCE_BLOCKS_VOID",
                            422,
                            /* format-wrap */
                            "商品仍被库存事实引用：库存对象 x1"));
        } else {
            when(catalog.transitionCatalogItemStatus(any(), any(), any())).thenReturn(readback);
        }
        CatalogItemTransitionRequest request = new CatalogItemTransitionRequest(
                itemCode, 7L, CatalogInventoryWireEnums.CatalogItemStatus.VOIDED, dataNodeRef);
        TransitionOperationsCatalogItemStatusOperation.Invocation invocation =
                new TransitionOperationsCatalogItemStatusOperation.Invocation(
                        request, "session", "BRAND", "correlation", "void-request", itemCode, "void-key");
        return new Fixture(
                new TransitionOperationsCatalogItemStatusOperation(contexts, catalog),
                catalog,
                context,
                catalogItemRef,
                invocation);
    }

    private static WorkspaceCommandOperationFixture commandContext(UUID dataNodeRef) {
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        UUID assignmentId = UUID.randomUUID();
        var token = CatalogInventoryWorkspaceCommandTokens.TRANSITION_OPERATIONS_CATALOG_ITEM_STATUS;
        var selectedStore = new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                "STORE",
                dataNodeRef,
                "Transition test store",
                "TRANSITION-TEST-STORE",
                List.of(),
                null,
                null,
                dataNodeRef,
                null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                "transition-operation-test",
                accountId,
                assignmentId,
                new WorkspaceSessionEntryReadback.ScopeContext(null, null, selectedStore, null),
                7L,
                11L,
                Set.of(),
                Set.of(token.capabilityFor("STORE")),
                "transition test",
                "STORE",
                dataNodeRef);
        WorkspaceAuthenticationService sessions = mock(WorkspaceAuthenticationService.class);
        when(sessions.commandAuthorizationFacts("session"))
                .thenReturn(new com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts(
                        session, UUID.randomUUID(), "STORE", dataNodeRef));
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        when(capabilities.resolveGeneratedCatalogOperation(
                        any(), eq(token.requirementId()), eq(token.capabilityFor("STORE")), any(), any()))
                .thenReturn(new WorkspaceCapabilityScopeResolver.CatalogScopeResolution(
                        new WorkspaceCapabilityScopeResolver.ScopeResolution(
                                WorkspaceCapabilityScopeResolver.Decision.ALLOW,
                                token.capabilityFor("STORE"),
                                new WorkspaceCapabilityScopeResolver.FirstOwnerQueryPredicate(
                                        workspaceId,
                                        "transition-operation-test",
                                        "STORE",
                                        dataNodeRef,
                                        "STORE",
                                        dataNodeRef,
                                        List.of(dataNodeRef))),
                        new CatalogScopeLookup.CatalogBrandJudgment(
                                "BRAND", "TEST_ORGANIZATION_JUDGMENT", "TEST_REVISION"),
                        null));
        CatalogScopeLookup catalogScopes = mock(CatalogScopeLookup.class);
        CommandExecutionContextResolver resolver =
                new CommandExecutionContextResolver(
                        capabilities, catalogScopes, sessions, (workspace, group, targetType, storeId) -> {});
        WorkspaceExecutionContext<CatalogAuthorizationScope> context = resolver.resolveCatalog(
                "session",
                token,
                dataNodeRef.toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue("BRAND"),
                "correlation",
                "void-request");
        return new WorkspaceCommandOperationFixture(resolver, context);
    }

    private record WorkspaceCommandOperationFixture(
            CommandExecutionContextResolver resolver, WorkspaceExecutionContext<CatalogAuthorizationScope> context) {}

    private record Fixture(
            TransitionOperationsCatalogItemStatusOperation operation,
            CatalogOwnerApi catalog,
            WorkspaceExecutionContext<CatalogAuthorizationScope> context,
            UUID catalogItemRef,
            TransitionOperationsCatalogItemStatusOperation.Invocation invocation) {}
}
