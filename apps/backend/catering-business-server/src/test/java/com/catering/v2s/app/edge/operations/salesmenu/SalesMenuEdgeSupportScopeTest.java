package com.catering.v2s.app.edge.operations.salesmenu;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.catering.v2s.businesschannel.api.BusinessChannelOwnerApi;
import com.catering.v2s.organization.application.OperationsOrganizationTaskReadService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class SalesMenuEdgeSupportScopeTest {
    private static final String GROUP = "sales-menu-scope-test";

    @Test
    void projectScopedSessionCannotReadOrWriteStoreSalesMenu() {
        UUID workspace = UUID.randomUUID();
        UUID project = UUID.randomUUID();
        UUID store = UUID.randomUUID();
        Fixture fixture = fixture();

        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> fixture.support.scope(session(workspace, project, null), GROUP, store));

        verify(fixture.organizationReads, never()).store(any(), any(), any());
    }

    @Test
    void selectedStoreMustMatchTheSalesMenuPath() {
        UUID workspace = UUID.randomUUID();
        UUID project = UUID.randomUUID();
        UUID selectedStore = UUID.randomUUID();
        UUID requestedStore = UUID.randomUUID();
        Fixture fixture = fixture();

        assertThrows(
                WorkspaceUserService.TaskScopeDeniedException.class,
                () -> fixture.support.scope(session(workspace, project, selectedStore), GROUP, requestedStore));

        verify(fixture.organizationReads, never()).store(any(), any(), any());
    }

    private static Fixture fixture() {
        OperationsOrganizationTaskReadService organizationReads = mock(OperationsOrganizationTaskReadService.class);
        return new Fixture(
                new SalesMenuEdgeSupport(
                        mock(com.catering.v2s.app.edge.operations.session.OperationsSessionResolver.class),
                        mock(BusinessChannelOwnerApi.class),
                        mock(WorkspaceCapabilityScopeResolver.class),
                        organizationReads,
                        new ObjectMapper()),
                organizationReads);
    }

    private static WorkspaceSessionReadback session(UUID workspace, UUID project, UUID store) {
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate projectNode =
                new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        ServiceNodeTypes.PROJECT,
                        project,
                        "Project",
                        "PROJECT-01",
                        List.of("Project"),
                        null,
                        project,
                        null,
                        null);
        WorkspaceSessionEntryReadback.VisibleDataNodeCandidate storeNode = store == null
                ? null
                : new WorkspaceSessionEntryReadback.VisibleDataNodeCandidate(
                        ServiceNodeTypes.STORE,
                        store,
                        "Store",
                        "STORE-01",
                        List.of("Project", "Store"),
                        null,
                        project,
                        store,
                        null);
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspace,
                GROUP,
                UUID.randomUUID(),
                UUID.randomUUID(),
                new WorkspaceSessionEntryReadback.ScopeContext(null, projectNode, storeNode, null),
                1L,
                1L,
                Set.of(),
                Set.of(),
                "Sales menu tester",
                ServiceNodeTypes.STORE,
                store);
    }

    private record Fixture(SalesMenuEdgeSupport support, OperationsOrganizationTaskReadService organizationReads) {}
}
