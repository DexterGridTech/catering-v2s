package com.catering.v2s.app.edge.platform.externalcollaboration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.externalcollaboration.ExternalCollaborationBusinessChannelCoordinator;
import com.catering.v2s.app.edge.generated.wire.ExternalCollaborationTree;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingCreateRequest;
import com.catering.v2s.app.edge.generated.wire.OwnerBindingUpdateRequest;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogReadApi;
import com.catering.v2s.collaboration.api.CollaborationCatalogSource;
import com.catering.v2s.collaboration.api.CollaborationCommandApi;
import com.catering.v2s.collaboration.api.CollaborationReadback;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class PlatformExternalCollaborationControllerTest {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final com.fasterxml.jackson.databind.ObjectMapper OWNER_JSON =
            new com.fasterxml.jackson.databind.ObjectMapper();
    private static final String KEY = "platform-collaboration-test";
    private static final UUID WORKSPACE = UUID.randomUUID();
    private static final UUID STORE_REF = UUID.randomUUID();

    @Test
    void treeUsesPlatformWorkspaceOwnerResolutionBeforeCollaborationRead() {
        Fixture fixture = fixture();
        CollaborationReadback.ProviderProfile provider = provider("PROVIDER-A", "ENABLED");
        when(fixture.catalog.readTree(WORKSPACE, KEY))
                .thenReturn(new CollaborationReadback.Tree(List.of(), List.of(provider)));

        ExternalCollaborationTree result = fixture.controller.tree(fixture.request, KEY);

        assertEquals("PROVIDER-A", result.providerProfiles().get(0).providerCode());
        verify(fixture.facts).requireEnabledSelectedWorkspace(fixture.workspaces, KEY);
        verify(fixture.catalog).readTree(WORKSPACE, KEY);
    }

    @Test
    void createMapsGeneratedNullableJsonStringsAndPassesPlatformActorToOwnerCommand() {
        Fixture fixture = fixture();
        UUID bindingRef = UUID.randomUUID();
        when(fixture.commands.createPlatformBinding(any()))
                .thenReturn(new CollaborationReadback.OwnerBinding(
                        bindingRef,
                        "PROVIDER-A",
                        "Provider A",
                        "TAKEAWAY",
                        "Takeaway",
                        List.of("Takeaway"),
                        "STORE",
                        "Store",
                        STORE_REF.toString(),
                        "Store binding",
                        null,
                        101L,
                        102L,
                        "PENDING_AUTHORIZATION",
                        "Pending authorization",
                        3L));

        var result = fixture.controller.createBinding(
                fixture.request,
                KEY,
                "platform-collaboration-idempotency",
                new OwnerBindingCreateRequest(
                        "PROVIDER-A",
                        JSON.valueToTree("TAKEAWAY"),
                        "STORE",
                        STORE_REF,
                        JSON.valueToTree("Store binding"),
                        JSON.nullNode()));

        assertEquals(bindingRef, result.bindingRef());
        assertEquals(101L, result.boundAt());
        assertEquals(102L, result.statusChangedAt());
        var command = org.mockito.ArgumentCaptor.forClass(CollaborationCommandApi.CreatePlatformBindingCommand.class);
        verify(fixture.commands).createPlatformBinding(command.capture());
        assertEquals(WORKSPACE, command.getValue().workspaceUuid());
        assertEquals(KEY, command.getValue().groupWorkspaceKey());
        assertEquals("TAKEAWAY", command.getValue().capabilityClass());
        assertEquals("STORE", command.getValue().nodeType());
        assertEquals(STORE_REF.toString(), command.getValue().nodeRef());
        assertEquals("platform-collaboration-idempotency", command.getValue().idempotencyKey());
        assertEquals(fixture.actor, command.getValue().actor());
        assertNull(command.getValue().externalOwnerId());
    }

    @Test
    void updateRequiresExpectedVersionAndUsesThePlatformUpdateCommand() {
        Fixture fixture = fixture();
        UUID bindingRef = UUID.randomUUID();
        when(fixture.commands.updatePlatformBinding(any()))
                .thenReturn(new CollaborationReadback.OwnerBinding(
                        bindingRef,
                        "PROVIDER-A",
                        "Provider A",
                        null,
                        null,
                        List.of(),
                        "STORE",
                        "Store",
                        STORE_REF.toString(),
                        "Updated",
                        "owner-1",
                        201L,
                        202L,
                        "EFFECTIVE",
                        "Effective",
                        4L));

        var result = fixture.controller.updateBinding(
                fixture.request,
                KEY,
                bindingRef,
                "platform-collaboration-update-idempotency",
                new OwnerBindingUpdateRequest(JSON.valueToTree("Updated"), JSON.valueToTree("owner-1"), 3L));

        assertEquals(4L, result.version());
        var command = org.mockito.ArgumentCaptor.forClass(CollaborationCommandApi.UpdatePlatformBindingCommand.class);
        verify(fixture.commands).updatePlatformBinding(command.capture());
        assertEquals(bindingRef, command.getValue().bindingRef());
        assertEquals("Updated", command.getValue().bindingDisplayName());
        assertEquals("owner-1", command.getValue().externalOwnerId());
        assertEquals(3L, command.getValue().expectedVersion());
        assertEquals(fixture.actor, command.getValue().actor());
    }

    @Test
    void globalPlatformDictionaryReadsTheCheckedInCatalogWithoutInventingWorkspaceState() {
        Fixture fixture = fixture();
        CollaborationCatalogSource.ExternalSystemDefinition system =
                new CollaborationCatalogSource.ExternalSystemDefinition(
                        "SYSTEM-A",
                        "System A",
                        "AVAILABLE",
                        "Available",
                        List.of(),
                        List.of(new CollaborationCatalogSource.CapabilityDefinition(
                                "TAKEAWAY", "Takeaway", OWNER_JSON.createObjectNode(), Map.of())));
        CollaborationCatalogSource.ProviderProfileDefinition provider =
                new CollaborationCatalogSource.ProviderProfileDefinition(
                        "PROVIDER-A",
                        "Provider A",
                        "SYSTEM-A",
                        List.of("TAKEAWAY"),
                        List.of("TAKEAWAY"),
                        List.of("STORE"),
                        List.of("STORE"),
                        "EXTERNAL_GRANT",
                        "External grant",
                        "LOCAL_ONLY",
                        "Local only",
                        "AVAILABLE",
                        "Available");
        when(fixture.catalogSource.externalSystems()).thenReturn(List.of(system));
        when(fixture.catalogSource.providerProfiles()).thenReturn(List.of(provider));

        var result = fixture.controller.capabilityDictionary(fixture.request);

        assertEquals("SYSTEM-A", result.externalSystems().get(0).externalSystemCode());
        assertEquals("PROVIDER-A", result.providerProfiles().get(0).providerCode());
        assertEquals("DISABLED", result.providerProfiles().get(0).enablementStatus());
        verify(fixture.sessions).requireRead(fixture.request);
    }

    private static Fixture fixture() {
        PlatformSessionResolver sessions = mock(PlatformSessionResolver.class);
        PlatformSessionResolver.PlatformReadSessionFacts facts =
                mock(PlatformSessionResolver.PlatformReadSessionFacts.class);
        PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace =
                mock(PlatformSessionResolver.EnabledSelectedWorkspaceFact.class);
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        WorkspaceAdministrationReadback enabledWorkspace = new WorkspaceAdministrationReadback(
                WORKSPACE, KEY, "Test workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, true);
        CollaborationCatalogReadApi catalog = mock(CollaborationCatalogReadApi.class);
        CollaborationCatalogSource catalogSource = mock(CollaborationCatalogSource.class);
        CollaborationBindingReadApi bindings = mock(CollaborationBindingReadApi.class);
        CollaborationCommandApi commands = mock(CollaborationCommandApi.class);
        ExternalCollaborationBusinessChannelCoordinator coordinator =
                mock(ExternalCollaborationBusinessChannelCoordinator.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        EdgeRequestContext request = mock(EdgeRequestContext.class);
        PlatformSessionReadback session = new PlatformSessionReadback(
                UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE);
        AuditActor actor = new AuditActor("PLATFORM_ADMIN", session.platformAdminId(), session.displayName());
        when(sessions.requireRead(request)).thenReturn(facts);
        when(sessions.require(request)).thenReturn(session);
        when(facts.requireEnabledSelectedWorkspace(workspaces, KEY)).thenReturn(workspace);
        when(facts.session()).thenReturn(session);
        when(workspaces.requireEnabled(KEY)).thenReturn(enabledWorkspace);
        when(workspace.workspaceUuid()).thenReturn(WORKSPACE);
        when(workspace.groupWorkspaceKey()).thenReturn(KEY);
        when(sessions.actor(session)).thenReturn(actor);
        when(taskPaths.describePersistedTaskPaths(any(), any(), any())).thenReturn(Map.of());
        return new Fixture(
                new PlatformExternalCollaborationController(
                        sessions, workspaces, catalog, catalogSource, bindings, commands, coordinator, taskPaths),
                sessions,
                facts,
                workspaces,
                catalog,
                catalogSource,
                commands,
                request,
                actor);
    }

    private static CollaborationReadback.ProviderProfile provider(String code, String enablementStatus) {
        return new CollaborationReadback.ProviderProfile(
                code,
                code,
                "SYSTEM-A",
                "System A",
                List.of("TAKEAWAY"),
                List.of("TAKEAWAY"),
                List.of("STORE"),
                List.of("STORE"),
                "EXTERNAL_GRANT",
                "External grant",
                "LOCAL_ONLY",
                "Local only",
                "AVAILABLE",
                "Available",
                enablementStatus,
                1L);
    }

    private record Fixture(
            PlatformExternalCollaborationController controller,
            PlatformSessionResolver sessions,
            PlatformSessionResolver.PlatformReadSessionFacts facts,
            WorkspaceAdministrationService workspaces,
            CollaborationCatalogReadApi catalog,
            CollaborationCatalogSource catalogSource,
            CollaborationCommandApi commands,
            EdgeRequestContext request,
            AuditActor actor) {}
}
