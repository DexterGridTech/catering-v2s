package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class WorkspaceAuditAuthorizationServiceTest {
    private static final String WORKSPACE_KEY = "audit-scope-test";

    @Test
    void ignoresPageAccessAndAllowsHeadCompanyRoleToReadItsHeadCompanyAudit() {
        UUID headCompanyId = UUID.randomUUID();
        Fixture fixture = fixture("HEAD_COMPANY", headCompanyId, List.of(), true);

        assertDoesNotThrow(() -> fixture.service.requireScopedHost(fixture.session, "HEAD_COMPANY", headCompanyId));
    }

    @Test
    void rangeDenialIsAccessDeniedInsteadOfSessionInvalidation() {
        Fixture fixture = fixture("PROJECT", UUID.randomUUID(), List.of(), false);

        assertThrows(
                WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
                () -> fixture.service.requireScopedHost(fixture.session, "PROJECT", UUID.randomUUID()));
    }

    @Test
    void onlyMissingCurrentRoleIsSessionInvalidation() {
        Fixture fixture = fixture("GROUP", UUID.randomUUID(), List.of(), true);
        WorkspaceSessionReadback noRole = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                fixture.session.workspaceUuid(),
                WORKSPACE_KEY,
                fixture.session.accountId(),
                null,
                null,
                1L,
                1L,
                Set.of(),
                Set.of(),
                "tester");

        assertThrows(
                WorkspaceAuthenticationService.SessionInvalidException.class,
                () -> fixture.service.requireGroupHost(noRole));
    }

    @Test
    void accountAuditUsesTaskPathRangeRatherThanExactAssignmentNodeOrPageAccess() {
        UUID accountId = UUID.randomUUID();
        UUID regionId = UUID.randomUUID();
        Fixture fixture = fixture(
                "GROUP",
                UUID.randomUUID(),
                List.of(new WorkspaceAuditAuthorizationService.SubjectTarget("REGION", regionId)),
                true);

        assertDoesNotThrow(
                () -> fixture.service.requireWorkspaceSubject(fixture.session, "WORKSPACE_ACCOUNT", accountId));
    }

    @Test
    void invitationAuditRequiresEveryIntentToRemainWithinTheRoleNodeRange() {
        UUID allowedProject = UUID.randomUUID();
        UUID deniedProject = UUID.randomUUID();
        Fixture fixture = fixture(
                "REGION",
                UUID.randomUUID(),
                List.of(
                        new WorkspaceAuditAuthorizationService.SubjectTarget("PROJECT", allowedProject),
                        new WorkspaceAuditAuthorizationService.SubjectTarget("PROJECT", deniedProject)),
                true);
        when(fixture.taskPaths.isScopeAllowed(any(), anyString(), anyString(), any(), any()))
                .thenAnswer(invocation -> !deniedProject.equals(
                        ((OrganizationTaskPathLookup.TaskPath) invocation.getArgument(4)).targetId()));

        assertThrows(
                WorkspaceCommandAuthorizationService.AuthorizationDeniedException.class,
                () -> fixture.service.requireWorkspaceSubject(
                        fixture.session, "WORKSPACE_INVITATION", UUID.randomUUID()));
    }

    private static Fixture fixture(
            String assignmentType,
            UUID assignmentId,
            List<WorkspaceAuditAuthorizationService.SubjectTarget> subjectTargets,
            boolean defaultScopeAllowed) {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        UUID workspaceId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        WorkspaceSessionReadback session = new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspaceId,
                WORKSPACE_KEY,
                accountId,
                UUID.randomUUID(),
                null,
                1L,
                1L,
                Set.of(),
                Set.of(),
                "tester");
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0, String.class);
            if (sql.contains("FROM workspace_iam.role_assignment assignment")) {
                return List.of(new WorkspaceAuditAuthorizationService.Assignment(assignmentType, assignmentId));
            }
            return subjectTargets;
        });
        when(taskPaths.requireTaskPath(any(), anyString(), anyString(), any())).thenAnswer(invocation -> {
            String targetType = invocation.getArgument(2, String.class);
            UUID targetId = invocation.getArgument(3, UUID.class);
            return new OrganizationTaskPathLookup.TaskPath(
                    targetType, targetId, List.of(UUID.randomUUID(), targetId), targetType);
        });
        when(taskPaths.isScopeAllowed(any(), anyString(), anyString(), any(), any()))
                .thenReturn(defaultScopeAllowed);
        return new Fixture(new WorkspaceAuditAuthorizationService(jdbc, taskPaths), session, taskPaths);
    }

    private record Fixture(
            WorkspaceAuditAuthorizationService service,
            WorkspaceSessionReadback session,
            OrganizationTaskPathLookup taskPaths) {}
}
