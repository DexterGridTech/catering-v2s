package com.catering.v2s.workspace.iam.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.AssignmentCandidate;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.InvitationTargetType;
import com.catering.v2s.organization.api.OrganizationAssignmentCandidateLookup.PlatformInvitationCandidatePage;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlatformInvitationCandidatesTaskReadServiceTest {
    @Test
    void organizationCandidateUsesExactlyTheTypedOrganizationProjection() {
        RecordingCandidates organizations = new RecordingCandidates();
        WorkspaceRoleService roles = new WorkspaceRoleService(null, null);
        UUID workspace = UUID.randomUUID();
        UUID target = UUID.randomUUID();
        organizations.page = new PlatformInvitationCandidatePage(
                List.of(new AssignmentCandidate("STORE", target, "Group / Store")), 1L, 1, 20);

        var result = new PlatformInvitationCandidatesTaskReadService(organizations, roles)
                .candidates(WorkspaceUserService.CandidateQuery.forPlatform(
                        workspace, "workspace-a", "STORE", "ORGANIZATION", "LIST_FILTER", "store", 1, 20, null));

        assertEquals(1L, result.metadata().total());
        assertEquals(target, result.organizations().getFirst().organizationRef());
        assertEquals(
                new OrganizationAssignmentCandidateLookup.PlatformInvitationCandidateQuery(
                        InvitationTargetType.STORE, "store", 1, 20),
                organizations.query);
    }

    private static final class RecordingCandidates implements OrganizationAssignmentCandidateLookup {
        private PlatformInvitationCandidatePage page;
        private PlatformInvitationCandidateQuery query;

        @Override
        public List<AssignmentCandidate> listEnabled(
                UUID workspaceUuid, String groupWorkspaceKey, String serviceNodeType) {
            return List.of();
        }

        @Override
        public PlatformInvitationCandidatePage platformInvitationCandidates(
                UUID workspaceUuid, String groupWorkspaceKey, PlatformInvitationCandidateQuery value) {
            query = value;
            return page;
        }
    }
}
