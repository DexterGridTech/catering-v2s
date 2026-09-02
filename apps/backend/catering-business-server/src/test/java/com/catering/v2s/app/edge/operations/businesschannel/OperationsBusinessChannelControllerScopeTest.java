package com.catering.v2s.app.edge.operations.businesschannel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.app.edge.externalcollaboration.ExternalCollaborationBusinessChannelCoordinator;
import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.operations.session.OperationsSessionCookie;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadApi;
import com.catering.v2s.businesschannel.api.BusinessChannelReadback;
import com.catering.v2s.collaboration.api.CollaborationBindingReadApi;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.organization.application.OrganizationOverviewTaskReadService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class OperationsBusinessChannelControllerScopeTest {
    private static final String KEY = "operations-business-channel-scope-test";

    @Test
    void storeChannelListReadsTheRealStoreProjectBeforeRejectingAnotherSelectedStore() {
        Fixture fixture = fixture();
        UUID foreignStore = UUID.randomUUID();
        OrganizationOverviewTaskReadService.Item store = mock(OrganizationOverviewTaskReadService.Item.class);
        when(store.project())
                .thenReturn(new OrganizationOverviewTaskReadService.Reference(
                        fixture.projectId, "PROJECT-01", "Project 01", true));
        when(fixture.organizationReads.store(fixture.workspaceId, KEY, foreignStore))
                .thenReturn(store);
        when(fixture.authorization.resolveSelectedProjectScope(fixture.session, fixture.projectId))
                .thenReturn(mock(com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPath.class));

        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> fixture.controller.storeChannels(
                        fixture.request, KEY, foreignStore, "SALES_MENU", null, null, null, null));

        verify(fixture.organizationReads).store(fixture.workspaceId, KEY, foreignStore);
        verify(fixture.salesMenuChannels, never())
                .listSalesMenuEligibleChannels(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void salesMenuChannelListUsesTheEligibleOwnerAndFixedProductPageSize() {
        Fixture fixture = fixture();
        OrganizationOverviewTaskReadService.Item store = mock(OrganizationOverviewTaskReadService.Item.class);
        when(store.project())
                .thenReturn(new OrganizationOverviewTaskReadService.Reference(
                        fixture.projectId, "PROJECT-01", "Project 01", true));
        when(fixture.organizationReads.store(fixture.workspaceId, KEY, fixture.selectedStoreId))
                .thenReturn(store);
        UUID channelRef = UUID.randomUUID();
        UUID templateRef = UUID.randomUUID();
        when(fixture.salesMenuChannels.listSalesMenuEligibleChannels(
                        fixture.workspaceId,
                        KEY,
                        fixture.selectedStoreId.toString(),
                        "cursor-1",
                        20,
                        "CHANNEL_NAME",
                        "ASC"))
                .thenReturn(new BusinessChannelOwnerApi.SalesMenuEligibleChannelPage(
                        List.of(new BusinessChannelOwnerApi.SalesMenuEligibleChannel(
                                channelRef,
                                templateRef,
                                fixture.selectedStoreId.toString(),
                                "DINE-IN-01",
                                "堂食入口",
                                "INTERNAL",
                                "STORE",
                                "DINE_IN",
                                "NOT_REQUIRED",
                                "ENABLED",
                                List.of(),
                                List.of(),
                                4L)),
                        "cursor-1",
                        "cursor-2"));

        var result = fixture.controller.storeChannels(
                fixture.request, KEY, fixture.selectedStoreId, "SALES_MENU", "cursor-1", null, "CHANNEL_NAME", "ASC");

        assertEquals(1, result.items().size());
        assertEquals(channelRef, result.items().getFirst().channelRef());
        assertEquals("STORE", result.items().getFirst().ownerNodeType().name());
        assertEquals("cursor-2", result.nextCursor());
        verify(fixture.salesMenuChannels)
                .listSalesMenuEligibleChannels(
                        fixture.workspaceId,
                        KEY,
                        fixture.selectedStoreId.toString(),
                        "cursor-1",
                        20,
                        "CHANNEL_NAME",
                        "ASC");
    }

    @Test
    void salesMenuChannelListRejectsWrongUsageOrNonProductPageSizeBeforeOwnerRead() {
        Fixture fixture = fixture();

        assertThrows(
                InvalidEdgeRequestException.class,
                () -> fixture.controller.storeChannels(
                        fixture.request, KEY, fixture.selectedStoreId, "BUSINESS_CHANNEL", null, null, null, null));
        assertThrows(
                InvalidEdgeRequestException.class,
                () -> fixture.controller.storeChannels(
                        fixture.request, KEY, fixture.selectedStoreId, "SALES_MENU", null, 10, null, null));

        verify(fixture.salesMenuChannels, never())
                .listSalesMenuEligibleChannels(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void channelBindingReadsChannelOwnerAndStoreBeforeReadingTheBinding() {
        Fixture fixture = fixture();
        UUID channelRef = UUID.randomUUID();
        UUID foreignStore = UUID.randomUUID();
        UUID bindingRef = UUID.randomUUID();
        BusinessChannelReadback.Channel channel = new BusinessChannelReadback.Channel(
                channelRef,
                UUID.randomUUID(),
                ServiceNodeTypes.STORE,
                foreignStore.toString(),
                null,
                "foreign channel",
                bindingRef,
                "BOUND",
                "ENABLED",
                List.of(),
                List.of(),
                1L);
        OrganizationOverviewTaskReadService.Item store = mock(OrganizationOverviewTaskReadService.Item.class);
        when(store.project())
                .thenReturn(new OrganizationOverviewTaskReadService.Reference(
                        fixture.projectId, "PROJECT-01", "Project 01", true));
        when(fixture.channels.readChannel(fixture.workspaceId, KEY, channelRef)).thenReturn(channel);
        when(fixture.organizationReads.store(fixture.workspaceId, KEY, foreignStore))
                .thenReturn(store);
        when(fixture.authorization.resolveSelectedProjectScope(fixture.session, fixture.projectId))
                .thenThrow(new WorkspaceUserService.TaskScopeDeniedException());

        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> fixture.controller.channelBinding(fixture.request, KEY, channelRef));

        verify(fixture.channels).readChannel(fixture.workspaceId, KEY, channelRef);
        verify(fixture.organizationReads).store(fixture.workspaceId, KEY, foreignStore);
        verify(fixture.bindings, never()).readBinding(fixture.workspaceId, KEY, bindingRef);
    }

    @Test
    void templateListPassesTheSessionSelectedProjectToTheOwnerRead() {
        Fixture fixture = fixture();
        when(fixture.authorization.resolveSelectedProjectScope(fixture.session, null))
                .thenReturn(new com.catering.v2s.organization.api.OrganizationTaskPathLookup.TaskPath(
                        ServiceNodeTypes.PROJECT, fixture.projectId, List.of(), "Project 01"));
        when(fixture.channels.pageTemplates(fixture.workspaceId, KEY, fixture.projectId, null, null, null, null))
                .thenReturn(new BusinessChannelReadback.TemplatePage(List.of(), null, 0L));

        fixture.controller.templates(fixture.request, KEY, null, null, null);

        verify(fixture.channels).pageTemplates(fixture.workspaceId, KEY, fixture.projectId, null, null, null, null);
    }

    @Test
    void selectedStoreCanReadItsProjectTemplateCandidatesWithoutProjectScopeResolution() {
        Fixture fixture = fixture();
        OrganizationOverviewTaskReadService.Item store = mock(OrganizationOverviewTaskReadService.Item.class);
        when(store.project())
                .thenReturn(new OrganizationOverviewTaskReadService.Reference(
                        fixture.projectId, "PROJECT-01", "Project 01", true));
        when(fixture.organizationReads.store(fixture.workspaceId, KEY, fixture.selectedStoreId))
                .thenReturn(store);
        when(fixture.channels.pageStoreTemplateCandidates(
                        fixture.workspaceId,
                        KEY,
                        fixture.projectId,
                        fixture.selectedStoreId.toString(),
                        null,
                        50,
                        null,
                        null))
                .thenReturn(new BusinessChannelReadback.TemplatePage(List.of(), null, 0L));

        var result = fixture.controller.storeTemplateCandidates(
                fixture.request, KEY, fixture.projectId, fixture.selectedStoreId, null, null, null, null);

        assertEquals(0, result.items().size());
        verify(fixture.channels)
                .pageStoreTemplateCandidates(
                        fixture.workspaceId,
                        KEY,
                        fixture.projectId,
                        fixture.selectedStoreId.toString(),
                        null,
                        50,
                        null,
                        null);
        verify(fixture.authorization, never()).resolveSelectedProjectScope(any(), any());
    }

    private static Fixture fixture() {
        UUID workspaceId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID selectedStoreId = UUID.randomUUID();
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate project =
                new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        ServiceNodeTypes.PROJECT,
                        projectId,
                        "Project 01",
                        "PROJECT-01",
                        List.of("Group", "Project 01"),
                        null,
                        projectId,
                        null,
                        null);
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate store =
                new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        ServiceNodeTypes.STORE,
                        selectedStoreId,
                        "Store 01",
                        "STORE-01",
                        List.of("Group", "Project 01", "Store 01"),
                        null,
                        projectId,
                        selectedStoreId,
                        null);
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                KEY,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(null, project, store, null),
                7L,
                3L,
                Set.of(),
                Set.of(),
                "Operations tester",
                ServiceNodeTypes.STORE,
                selectedStoreId);
        OperationsSessionResolver sessions = mock(OperationsSessionResolver.class);
        BusinessChannelReadApi channels = mock(BusinessChannelReadApi.class);
        BusinessChannelOwnerApi salesMenuChannels = mock(BusinessChannelOwnerApi.class);
        BackendPerformanceM1CommandExecutionBindings commands =
                mock(BackendPerformanceM1CommandExecutionBindings.class);
        WorkspaceCapabilityScopeResolver capabilities = mock(WorkspaceCapabilityScopeResolver.class);
        CollaborationBindingReadApi bindings = mock(CollaborationBindingReadApi.class);
        OperationsOrganizationTaskReadService organizationReads = mock(OperationsOrganizationTaskReadService.class);
        WorkspaceUserService authorization = mock(WorkspaceUserService.class);
        ExternalCollaborationBusinessChannelCoordinator coordinator =
                mock(ExternalCollaborationBusinessChannelCoordinator.class);
        when(sessions.requireWorkspaceRead(any(), eq(KEY))).thenReturn(session);
        OperationsBusinessChannelController controller = new OperationsBusinessChannelController(
                sessions,
                channels,
                salesMenuChannels,
                commands,
                capabilities,
                bindings,
                organizationReads,
                authorization,
                coordinator);
        return new Fixture(
                workspaceId,
                projectId,
                selectedStoreId,
                session,
                new EdgeRequestContext(
                        "test-rate-limit-fingerprint",
                        "test-correlation",
                        null,
                        OperationsSessionCookie.fromCookie("operations-session"),
                        null,
                        null,
                        null),
                controller,
                channels,
                salesMenuChannels,
                bindings,
                organizationReads,
                authorization);
    }

    private record Fixture(
            UUID workspaceId,
            UUID projectId,
            UUID selectedStoreId,
            WorkspaceSessionReadback session,
            EdgeRequestContext request,
            OperationsBusinessChannelController controller,
            BusinessChannelReadApi channels,
            BusinessChannelOwnerApi salesMenuChannels,
            CollaborationBindingReadApi bindings,
            OperationsOrganizationTaskReadService organizationReads,
            WorkspaceUserService authorization) {}
}
