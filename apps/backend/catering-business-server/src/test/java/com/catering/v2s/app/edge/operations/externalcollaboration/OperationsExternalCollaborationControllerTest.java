package com.catering.v2s.app.edge.operations.externalcollaboration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.generated.wire.ProviderProfileViewCatalogStatus;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsExternalCollaborationControllerTest {
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final String KEY = "operations-collaboration-test";

    @Test
    void dictionaryUsesTheOperationsReadSessionWithoutCapabilityResolution() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        WorkspaceSessionReadback session = session();
        when(sessions.requireRead(request)).thenReturn(session);
        when(catalog.readCapabilityDictionary(WORKSPACE, KEY))
                .thenReturn(new CollaborationReadback.Tree(List.of(), List.of(provider("PROVIDER-A"))));

        var result = new OperationsExternalCollaborationController(sessions, catalog).capabilityDictionary(request);

        assertEquals("PROVIDER-A", result.providerProfiles().get(0).providerCode());
        verify(catalog).readCapabilityDictionary(WORKSPACE, KEY);
    }

    @Test
    void candidatesConsumeCursorAndPageSizeWhileKeepingTheOwnerReadWorkspaceScoped() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        WorkspaceSessionReadback session = session();
        when(sessions.requireWorkspaceRead(request, KEY)).thenReturn(session);
        List<CollaborationReadback.ProviderProfile> providers =
                List.of(provider("PROVIDER-C"), provider("PROVIDER-A"), provider("PROVIDER-B"));
        when(catalog.listEnabledProviderProfiles(WORKSPACE, KEY, null, null)).thenReturn(providers);
        OperationsExternalCollaborationController controller =
                new OperationsExternalCollaborationController(sessions, catalog);

        var first = controller.providerCandidates(request, KEY, null, null, null, 2);
        assertEquals(
                List.of("PROVIDER-A", "PROVIDER-B"),
                first.items().stream().map(value -> value.providerCode()).toList());
        assertEquals(3L, first.total());
        assertNotNull(first.nextCursor());

        var second = controller.providerCandidates(
                request, KEY, null, null, first.nextCursor().asText(), 2);
        assertEquals(
                List.of("PROVIDER-C"),
                second.items().stream().map(value -> value.providerCode()).toList());
        assertEquals(3L, second.total());
        verify(catalog, org.mockito.Mockito.times(2)).listEnabledProviderProfiles(WORKSPACE, KEY, null, null);
    }

    @Test
    void candidatesForwardTheApprovedCapabilityFilterAndKeepPlannedProfiles() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        WorkspaceSessionReadback session = session();
        when(sessions.requireWorkspaceRead(request, KEY)).thenReturn(session);
        when(catalog.listEnabledProviderProfiles(WORKSPACE, KEY, "GROUP_BUY", null))
                .thenReturn(List.of(provider("PLANNED-PROVIDER", "PLANNED")));

        var result = new OperationsExternalCollaborationController(sessions, catalog)
                .providerCandidates(request, KEY, "GROUP_BUY", null, null, 10);

        assertEquals(
                List.of("PLANNED-PROVIDER"),
                result.items().stream().map(value -> value.providerCode()).toList());
        assertEquals(
                ProviderProfileViewCatalogStatus.PLANNED, result.items().get(0).catalogStatus());
        verify(catalog).listEnabledProviderProfiles(WORKSPACE, KEY, "GROUP_BUY", null);
    }

    @Test
    void candidatesForwardTheTargetNodeTypeSoStoreOnlyProvidersCannotLeakIntoProjectForms() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        when(sessions.requireWorkspaceRead(request, KEY)).thenReturn(session());
        when(catalog.listEnabledProviderProfiles(WORKSPACE, KEY, "DINE_IN", "STORE"))
                .thenReturn(List.of(provider("STORE-DINE-IN", "PLANNED", List.of("STORE"))));

        var result = new OperationsExternalCollaborationController(sessions, catalog)
                .providerCandidates(request, KEY, "DINE_IN", "STORE", null, 10);

        assertEquals(
                List.of("STORE-DINE-IN"),
                result.items().stream().map(value -> value.providerCode()).toList());
        verify(catalog).listEnabledProviderProfiles(WORKSPACE, KEY, "DINE_IN", "STORE");
    }

    @Test
    void cursorIdentityRejectsAQueryCollisionThatTheLegacyDelimiterCouldAccept() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        String firstGroupKey = "group\u001fA";
        String secondGroupKey = "group";
        String firstCapability = "B";
        String secondCapability = "A\u001fB";
        when(sessions.requireWorkspaceRead(request, firstGroupKey)).thenReturn(session(firstGroupKey));
        when(sessions.requireWorkspaceRead(request, secondGroupKey)).thenReturn(session(secondGroupKey));
        List<CollaborationReadback.ProviderProfile> providers =
                List.of(provider("PROVIDER-A"), provider("PROVIDER-B"));
        when(catalog.listEnabledProviderProfiles(WORKSPACE, firstGroupKey, firstCapability, "STORE"))
                .thenReturn(providers);
        when(catalog.listEnabledProviderProfiles(WORKSPACE, secondGroupKey, secondCapability, "STORE"))
                .thenReturn(providers);
        OperationsExternalCollaborationController controller =
                new OperationsExternalCollaborationController(sessions, catalog);

        var first = controller.providerCandidates(request, firstGroupKey, firstCapability, "STORE", null, 1);

        assertThrows(
                InvalidEdgeRequestException.class,
                () -> controller.providerCandidates(
                        request,
                        secondGroupKey,
                        secondCapability,
                        "STORE",
                        first.nextCursor().asText(),
                        1));
    }

    private static WorkspaceSessionReadback session() {
        return session(KEY);
    }

    private static WorkspaceSessionReadback session(String groupWorkspaceKey) {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                WORKSPACE,
                groupWorkspaceKey,
                UUID.randomUUID(),
                UUID.randomUUID(),
                null,
                7L,
                3L,
                Set.of("page.read"),
                Set.of("unrelated.write"),
                "Operations tester");
    }

    private static CollaborationReadback.ProviderProfile provider(String code) {
        return provider(code, "AVAILABLE");
    }

    private static CollaborationReadback.ProviderProfile provider(String code, String catalogStatus) {
        return provider(code, catalogStatus, List.of("STORE"));
    }

    private static CollaborationReadback.ProviderProfile provider(
            String code, String catalogStatus, List<String> bindableNodeTypes) {
        return new CollaborationReadback.ProviderProfile(
                code,
                code,
                "SYSTEM-A",
                "System A",
                List.of("TAKEAWAY"),
                bindableNodeTypes,
                "EXTERNAL_GRANT",
                "LOCAL_ONLY",
                catalogStatus,
                "ENABLED",
                1L);
    }
}
