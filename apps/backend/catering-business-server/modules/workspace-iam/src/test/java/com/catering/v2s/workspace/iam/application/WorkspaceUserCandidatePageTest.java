package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.CommercialGroupLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.AssignmentCandidate;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.OperationsInvitationCandidatePage;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.OperationsInvitationCandidateQuery;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.organization.api.WorkspaceAssignmentScopeLookup;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionEntryReadback;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class WorkspaceUserCandidatePageTest {
    @Test
    void operationsOrganizationCandidatesUseOwnerPageAndPreserveScopeIdentity() {
        UUID workspace = UUID.randomUUID();
        UUID group = UUID.randomUUID();
        UUID candidate = UUID.randomUUID();
        OrganizationAssignmentCandidateLookup organizations = mock(OrganizationAssignmentCandidateLookup.class);
        WorkspaceRoleService roles = mock(WorkspaceRoleService.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        when(taskPaths.requireTaskPath(workspace, "group-key", "GROUP", group))
                .thenReturn(new OrganizationTaskPathLookup.TaskPath("GROUP", group, List.of(group), "Group"));
        when(organizations.operationsInvitationCandidates(
                        eq(workspace), eq("group-key"), any(OperationsInvitationCandidateQuery.class)))
                .thenReturn(new OperationsInvitationCandidatePage(
                        List.of(new AssignmentCandidate("GROUP", candidate, "Group / candidate")), 21, 2, 1));

        WorkspaceUserService service = service(workspace, group, organizations, roles, taskPaths);
        WorkspaceUserService.CandidatePage page = service.candidates(WorkspaceUserService.CandidateQuery.forOperations(
                session(workspace, group), "GROUP", null, "ORGANIZATION", "LIST_FILTER", "candidate", 2, 1, null));

        assertEquals(21, page.metadata().total());
        assertEquals(
                List.of(candidate),
                page.organizations().stream()
                        .map(WorkspaceUserService.CandidateOrganization::organizationRef)
                        .toList());
        ArgumentCaptor<OperationsInvitationCandidateQuery> query =
                ArgumentCaptor.forClass(OperationsInvitationCandidateQuery.class);
        verify(organizations).operationsInvitationCandidates(eq(workspace), eq("group-key"), query.capture());
        assertEquals("GROUP", query.getValue().scopeTargetType());
        assertEquals(group, query.getValue().scopeTargetId());
        assertEquals(2, query.getValue().page());
        assertEquals(1, query.getValue().pageSize());
        verify(organizations, never()).listEnabled(any(), any(), any());
    }

    @Test
    void operationsRoleCandidatesUseOwnerPageAndDoNotMaterializeAllRoles() {
        UUID workspace = UUID.randomUUID();
        UUID group = UUID.randomUUID();
        OrganizationAssignmentCandidateLookup organizations = mock(OrganizationAssignmentCandidateLookup.class);
        WorkspaceRoleService roles = mock(WorkspaceRoleService.class);
        OrganizationTaskPathLookup taskPaths = mock(OrganizationTaskPathLookup.class);
        when(taskPaths.requireTaskPath(workspace, "group-key", "GROUP", group))
                .thenReturn(new OrganizationTaskPathLookup.TaskPath("GROUP", group, List.of(group), "Group"));
        when(roles.page(workspace, "group-key", "operator", "GROUP", "ENABLED", 2, 10, "NAME", "ASC"))
                .thenReturn(new WorkspaceRoleService.Page(List.of(), 2, 10, 25, "NAME", "ASC"));

        WorkspaceUserService service = service(workspace, group, organizations, roles, taskPaths);
        WorkspaceUserService.CandidatePage page = service.candidates(WorkspaceUserService.CandidateQuery.forOperations(
                session(workspace, group), "GROUP", null, "ROLE", "LIST_FILTER", "operator", 2, 10, null));

        assertEquals(25, page.metadata().total());
        assertEquals(List.of(), page.roles());
        verify(roles).page(workspace, "group-key", "operator", "GROUP", "ENABLED", 2, 10, "NAME", "ASC");
        verify(roles, never()).list(any(), any());
    }

    private static WorkspaceUserService service(
            UUID workspace,
            UUID group,
            OrganizationAssignmentCandidateLookup organizations,
            WorkspaceRoleService roles,
            OrganizationTaskPathLookup taskPaths) {
        WorkspaceAssignmentScopeLookup assignments = mock(WorkspaceAssignmentScopeLookup.class);
        CommercialGroupLookup groups = mock(CommercialGroupLookup.class);
        return new WorkspaceUserService(null, null, null, roles, groups, organizations, assignments, taskPaths);
    }

    private static WorkspaceSessionReadback session(UUID workspace, UUID group) {
        return new WorkspaceSessionReadback(
                UUID.randomUUID(),
                workspace,
                "group-key",
                UUID.randomUUID(),
                UUID.randomUUID(),
                WorkspaceSessionEntryReadback.ScopeContext.empty(),
                1,
                1,
                Set.of(),
                Set.of(),
                "operator",
                "GROUP",
                group);
    }
}
