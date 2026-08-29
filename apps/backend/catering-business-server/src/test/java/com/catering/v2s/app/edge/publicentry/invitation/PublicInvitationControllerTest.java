package com.catering.v2s.app.edge.publicentry.invitation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PublicInvitationControllerTest {
    @Test
    void viewPreservesTheOwnerCalculatedResumeStep() {
        WorkspaceInvitationService invitations = mock(WorkspaceInvitationService.class);
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        PublicInvitationController controller =
                new PublicInvitationController(invitations, workspaces, mock(PlatformAssetService.class));
        when(invitations.publicView("workspace", "token"))
                .thenReturn(new WorkspaceInvitationService.PublicInvitationView(
                        UUID.randomUUID(),
                        "workspace",
                        "STORE",
                        List.of(
                                // spotless:off
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "east", "华东", "REGION"),
                                new OrganizationTaskPathLookup.TaskPathNode(
                                        UUID.randomUUID(), "store", "门店", "STORE")),
                                // spotless:on
                        List.of("店长"),
                        "138****0000",
                        "ACTIVE",
                        "VERIFY_MOBILE",
                        123L));
        when(workspaces.require("workspace"))
                .thenReturn(new WorkspaceAdministrationReadback(
                        UUID.randomUUID(),
                        "workspace",
                        "演示工作区",
                        "运营管理",
                        null,
                        null,
                        "ACTIVE",
                        1L,
                        1L,
                        1L,
                        1L,
                        /* format-wrap */
                        true));

        var response = controller.view("workspace", "token");

        assertEquals("VERIFY_MOBILE", response.nextStep());
    }
}
