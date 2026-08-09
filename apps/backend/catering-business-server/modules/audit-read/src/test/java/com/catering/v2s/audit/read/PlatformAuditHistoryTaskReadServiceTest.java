package com.catering.v2s.audit.read;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.catering.v2s.audit.contract.AuditHistoryPage;
import com.catering.v2s.audit.contract.AuditReadScope;
import com.catering.v2s.audit.contract.AuditTarget;
import com.catering.v2s.audit.read.PlatformAuditHistoryTaskReadService.PlatformAuditHistoryQuery;
import com.catering.v2s.contract.application.ContractAuditHistoryService;
import com.catering.v2s.extension.application.ExtensionAuditHistoryService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.iam.application.PlatformIamAuditHistoryService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAuditHistoryService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceIamAuditHistoryService;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

class PlatformAuditHistoryTaskReadServiceTest {
    private static final String WORKSPACE_KEY = "platform-audit-test";

    @Test
    void platformAdminUsesOnlyPlatformIamProjection() {
        Fixture fixture = fixture();
        String adminId = UUID.randomUUID().toString();
        when(fixture.platformIamAudit.readPlatformAdmin(adminId, 1, 20)).thenReturn(empty());
        fixture.reads.read(fixture.session, new PlatformAuditHistoryQuery.PlatformAdmin(new AuditTarget("PLATFORM_ADMIN", adminId), 1, 20));
        verify(fixture.platformIamAudit).readPlatformAdmin(adminId, 1, 20);
        verifyNoInteractions(fixture.workspaces, fixture.groupWorkspaceAudit, fixture.workspaceIamAudit, fixture.extensionAudit, fixture.contractAudit);
    }

    @ParameterizedTest
    @MethodSource("workspaceHostedQueries")
    void everyWorkspaceHostedVariantRequiresEnabledWorkspaceAndUsesExactlyItsNamedProjection(PlatformAuditHistoryQuery query) {
        Fixture fixture = fixture();
        AuditReadScope scope = fixture.scope();
        when(fixture.workspaces.requireEnabled(WORKSPACE_KEY)).thenReturn(fixture.workspace);
        stubWorkspaceHostedProjection(fixture, query, scope);
        fixture.reads.read(fixture.session, query);
        verify(fixture.workspaces).requireEnabled(WORKSPACE_KEY);
        verifyWorkspaceHostedProjection(fixture, query, scope);
    }

    @Test
    void disabledWorkspaceStopsBeforeWorkspaceHostedProjection() {
        Fixture fixture = fixture();
        when(fixture.workspaces.requireEnabled(WORKSPACE_KEY)).thenThrow(new WorkspaceAdministrationService.WorkspaceDisabledException());
        assertThrows(WorkspaceAdministrationService.WorkspaceDisabledException.class, () -> fixture.reads.read(fixture.session, new PlatformAuditHistoryQuery.WorkspaceInvitation(new AuditTarget("WORKSPACE_INVITATION", UUID.randomUUID().toString()), WORKSPACE_KEY, 1, 20)));
        verifyNoInteractions(fixture.workspaceIamAudit);
    }

    private static Stream<PlatformAuditHistoryQuery> workspaceHostedQueries() {
        String id = UUID.randomUUID().toString();
        return Stream.of(new PlatformAuditHistoryQuery.GroupWorkspace(new AuditTarget("GROUP_WORKSPACE", WORKSPACE_KEY), 1, 20), new PlatformAuditHistoryQuery.WorkspaceRole(new AuditTarget("WORKSPACE_ROLE", id), WORKSPACE_KEY, 1, 20), new PlatformAuditHistoryQuery.WorkspaceAccount(new AuditTarget("WORKSPACE_ACCOUNT", id), WORKSPACE_KEY, 1, 20), new PlatformAuditHistoryQuery.WorkspaceInvitation(new AuditTarget("WORKSPACE_INVITATION", id), WORKSPACE_KEY, 1, 20), new PlatformAuditHistoryQuery.ExtensionDefinition(new AuditTarget("EXTENSION_DEFINITION", "STORE"), WORKSPACE_KEY, 1, 20), new PlatformAuditHistoryQuery.StoreContract(new AuditTarget("STORE_CONTRACT", id), WORKSPACE_KEY, 1, 20));
    }

    private static void stubWorkspaceHostedProjection(Fixture fixture, PlatformAuditHistoryQuery query, AuditReadScope scope) {
        String id = query.target().entityRef();
        switch (query) {
            case PlatformAuditHistoryQuery.GroupWorkspace ignored -> when(fixture.groupWorkspaceAudit.readGroupWorkspace(scope, id, 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.WorkspaceRole ignored -> when(fixture.workspaceIamAudit.readPlatformAuditProjection(scope, query.target(), 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.WorkspaceAccount ignored -> when(fixture.workspaceIamAudit.readPlatformAuditProjection(scope, query.target(), 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.WorkspaceInvitation ignored -> when(fixture.workspaceIamAudit.readPlatformAuditProjection(scope, query.target(), 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.ExtensionDefinition ignored -> when(fixture.extensionAudit.readExtensionDefinition(scope, id, 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.StoreContract ignored -> when(fixture.contractAudit.readStoreContract(scope, id, 1, 20)).thenReturn(empty());
            case PlatformAuditHistoryQuery.PlatformAdmin ignored -> throw new AssertionError("not workspace hosted");
        }
    }

    private static void verifyWorkspaceHostedProjection(Fixture fixture, PlatformAuditHistoryQuery query, AuditReadScope scope) {
        String id = query.target().entityRef();
        switch (query) {
            case PlatformAuditHistoryQuery.GroupWorkspace ignored -> verify(fixture.groupWorkspaceAudit).readGroupWorkspace(scope, id, 1, 20);
            case PlatformAuditHistoryQuery.WorkspaceRole ignored -> verify(fixture.workspaceIamAudit).readPlatformAuditProjection(scope, query.target(), 1, 20);
            case PlatformAuditHistoryQuery.WorkspaceAccount ignored -> verify(fixture.workspaceIamAudit).readPlatformAuditProjection(scope, query.target(), 1, 20);
            case PlatformAuditHistoryQuery.WorkspaceInvitation ignored -> verify(fixture.workspaceIamAudit).readPlatformAuditProjection(scope, query.target(), 1, 20);
            case PlatformAuditHistoryQuery.ExtensionDefinition ignored -> verify(fixture.extensionAudit).readExtensionDefinition(scope, id, 1, 20);
            case PlatformAuditHistoryQuery.StoreContract ignored -> verify(fixture.contractAudit).readStoreContract(scope, id, 1, 20);
            case PlatformAuditHistoryQuery.PlatformAdmin ignored -> throw new AssertionError("not workspace hosted");
        }
    }

    private static AuditHistoryPage empty() { return new AuditHistoryPage(List.of(), 1, 20, 0); }

    private static Fixture fixture() {
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        PlatformWorkspaceAuditHistoryService groupWorkspaceAudit = mock(PlatformWorkspaceAuditHistoryService.class);
        PlatformIamAuditHistoryService platformIamAudit = mock(PlatformIamAuditHistoryService.class);
        WorkspaceIamAuditHistoryService workspaceIamAudit = mock(WorkspaceIamAuditHistoryService.class);
        ExtensionAuditHistoryService extensionAudit = mock(ExtensionAuditHistoryService.class);
        ContractAuditHistoryService contractAudit = mock(ContractAuditHistoryService.class);
        WorkspaceAdministrationReadback workspace = new WorkspaceAdministrationReadback(UUID.randomUUID(), WORKSPACE_KEY, "Test workspace", "Operations", null, null, "ENABLED", 1L, 1L, 1L, 1L, true);
        PlatformSessionReadback session = new PlatformSessionReadback(UUID.randomUUID(), 1L, UUID.randomUUID(), "Platform tester", Long.MAX_VALUE);
        return new Fixture(new PlatformAuditHistoryTaskReadService(groupWorkspaceAudit, workspaces, platformIamAudit, workspaceIamAudit, extensionAudit, contractAudit), session, workspaces, groupWorkspaceAudit, platformIamAudit, workspaceIamAudit, extensionAudit, contractAudit, workspace);
    }

    private record Fixture(PlatformAuditHistoryTaskReadService reads, PlatformSessionReadback session, WorkspaceAdministrationService workspaces, PlatformWorkspaceAuditHistoryService groupWorkspaceAudit, PlatformIamAuditHistoryService platformIamAudit, WorkspaceIamAuditHistoryService workspaceIamAudit, ExtensionAuditHistoryService extensionAudit, ContractAuditHistoryService contractAudit, WorkspaceAdministrationReadback workspace) {
        AuditReadScope scope() { return new AuditReadScope(workspace.workspaceUuid(), workspace.groupWorkspaceKey()); }
    }
}
