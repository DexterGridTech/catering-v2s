package com.catering.v2s.app.edge.operations.externalcollaboration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
        when(catalog.listEnabledProviderProfiles(WORKSPACE, KEY, null)).thenReturn(providers);
        OperationsExternalCollaborationController controller =
                new OperationsExternalCollaborationController(sessions, catalog);

        var first = controller.providerCandidates(request, KEY, null, null, 2);
        assertEquals(
                List.of("PROVIDER-A", "PROVIDER-B"),
                first.items().stream().map(value -> value.providerCode()).toList());
        assertEquals(3L, first.total());
        assertNotNull(first.nextCursor());

        var second = controller.providerCandidates(
                request, KEY, null, first.nextCursor().asText(), 2);
        assertEquals(
                List.of("PROVIDER-C"),
                second.items().stream().map(value -> value.providerCode()).toList());
        assertEquals(3L, second.total());
        verify(catalog, org.mockito.Mockito.times(2)).listEnabledProviderProfiles(WORKSPACE, KEY, null);
    }

    @Test
    void candidatesForwardTheApprovedCapabilityFilterAndKeepPlannedProfiles() {
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        WorkspaceSessionReadback session = session();
        when(sessions.requireWorkspaceRead(request, KEY)).thenReturn(session);
        when(catalog.listEnabledProviderProfiles(WORKSPACE, KEY, "GROUP_BUY"))
                .thenReturn(List.of(provider("PLANNED-PROVIDER", "PLANNED")));

        var result = new OperationsExternalCollaborationController(sessions, catalog)
                .providerCandidates(request, KEY, "GROUP_BUY", null, 10);

        assertEquals(
                List.of("PLANNED-PROVIDER"),
                result.items().stream().map(value -> value.providerCode()).toList());
        assertEquals("PLANNED", result.items().get(0).catalogStatus());
        verify(catalog).listEnabledProviderProfiles(WORKSPACE, KEY, "GROUP_BUY");
    }

    private static WorkspaceSessionReadback session() {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                WORKSPACE,
                KEY,
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
        return new CollaborationReadback.ProviderProfile(
                code,
                code,
                "SYSTEM-A",
                "System A",
                List.of("TAKEAWAY"),
                List.of("STORE"),
                "EXTERNAL_GRANT",
                "LOCAL_ONLY",
                catalogStatus,
                "ENABLED",
                1L);
    }
}
