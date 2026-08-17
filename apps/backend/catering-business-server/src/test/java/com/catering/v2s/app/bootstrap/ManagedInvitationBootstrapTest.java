package com.catering.v2s.app.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.catering.v2s.platform.foundation.runtime.RuntimeEnvironmentKeys;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class ManagedInvitationBootstrapTest {
    @Test
    void createsOneExplicitOwnerAssignmentAfterEnabledWorkspaceReadback() throws Exception {
        WorkspaceAdministrationService workspaces = mock(WorkspaceAdministrationService.class);
        WorkspaceInvitationService invitations = mock(WorkspaceInvitationService.class);
        UUID workspaceId = UUID.randomUUID();
        UUID roleId = UUID.randomUUID();
        UUID targetId = UUID.randomUUID();
        UUID invitationId = UUID.randomUUID();
        Path runtime = Files.createTempDirectory("managed-invitation-runtime");
        Path output = runtime.resolve("results/invitation.json");
        ManagedInvitationBootstrap.Input input = ManagedInvitationBootstrap.Input.from(Map.of(
                "V2S_MANAGED_INVITATION_WORKSPACE_KEY",
                "aurora",
                "V2S_MANAGED_INVITATION_MOBILE",
                "13800000001",
                "V2S_MANAGED_INVITATION_ROLE_ID",
                roleId.toString(),
                "V2S_MANAGED_INVITATION_TARGET_TYPE",
                "GROUP",
                "V2S_MANAGED_INVITATION_TARGET_REF",
                targetId.toString(),
                RuntimeEnvironmentKeys.V2S_RUNTIME_DIR,
                runtime.toString(),
                "V2S_MANAGED_INVITATION_OUTPUT",
                output.toString()));
        when(workspaces.requireEnabled("aurora"))
                .thenReturn(new WorkspaceAdministrationReadback(
                        workspaceId,
                        "aurora",
                        "Aurora",
                        "Aurora Operations",
                        null,
                        null,
                        "ENABLED",
                        1L,
                        1L,
                        1L,
                        1L,
                        true));
        when(invitations.create(eq(workspaceId), eq("aurora"), eq("13800000001"), any(), any(), any()))
                .thenReturn(new WorkspaceInvitationReadback(
                        invitationId,
                        workspaceId,
                        "aurora",
                        "13800000001",
                        "PENDING",
                        2L,
                        1L,
                        1L,
                        null,
                        null,
                        null,
                        "private-token"));

        ManagedInvitationBootstrap.Result result = ManagedInvitationBootstrap.create(workspaces, invitations, input);
        ManagedInvitationBootstrap.writePrivateOutput(output, result);

        ArgumentCaptor<java.util.List<WorkspaceInvitationService.AssignmentIntent>> intents =
                ArgumentCaptor.forClass(java.util.List.class);
        verify(invitations).create(eq(workspaceId), eq("aurora"), eq("13800000001"), intents.capture(), any(), any());
        assertEquals(
                java.util.List.of(new WorkspaceInvitationService.AssignmentIntent(roleId, "GROUP", targetId)),
                intents.getValue());
        assertEquals(
                "private-token",
                new com.fasterxml.jackson.databind.ObjectMapper()
                        .readTree(output.toFile())
                        .get("invitationToken")
                        .asText());
        assertEquals("rw-------", PosixFilePermissions.toString(Files.getPosixFilePermissions(output)));
        verify(workspaces).requireEnabled("aurora");
    }

    @Test
    void refusesATypeOutsideTheFixedOwnerBootstrapVocabulary() throws Exception {
        Path runtime = Files.createTempDirectory("managed-invitation-runtime");
        assertThrows(
                IllegalArgumentException.class,
                () -> ManagedInvitationBootstrap.Input.from(Map.of(
                        "V2S_MANAGED_INVITATION_WORKSPACE_KEY",
                        "aurora",
                        "V2S_MANAGED_INVITATION_MOBILE",
                        "13800000001",
                        "V2S_MANAGED_INVITATION_ROLE_ID",
                        UUID.randomUUID().toString(),
                        "V2S_MANAGED_INVITATION_TARGET_TYPE",
                        "TENANT",
                        "V2S_MANAGED_INVITATION_TARGET_REF",
                        UUID.randomUUID().toString(),
                        RuntimeEnvironmentKeys.V2S_RUNTIME_DIR,
                        runtime.toString(),
                        "V2S_MANAGED_INVITATION_OUTPUT",
                        runtime.resolve("results/invitation.json").toString())));
    }

    @Test
    void refusesToOverwriteAnExistingRunScopedPrivateOutput() throws Exception {
        Path runtime = Files.createTempDirectory("managed-invitation-runtime");
        Path output = runtime.resolve("results/invitation.json");
        Files.createDirectories(output.getParent());
        Files.writeString(output, "must-not-overwrite");

        assertThrows(
                IllegalArgumentException.class,
                () -> ManagedInvitationBootstrap.Input.from(Map.of(
                        "V2S_MANAGED_INVITATION_WORKSPACE_KEY",
                        "aurora",
                        "V2S_MANAGED_INVITATION_MOBILE",
                        "13800000001",
                        "V2S_MANAGED_INVITATION_ROLE_ID",
                        UUID.randomUUID().toString(),
                        "V2S_MANAGED_INVITATION_TARGET_TYPE",
                        "GROUP",
                        "V2S_MANAGED_INVITATION_TARGET_REF",
                        UUID.randomUUID().toString(),
                        RuntimeEnvironmentKeys.V2S_RUNTIME_DIR,
                        runtime.toString(),
                        "V2S_MANAGED_INVITATION_OUTPUT",
                        output.toString())));
    }

    @Test
    void writesRedactedOwnerOnlyFailureReceiptBesideThePrivateOutput() throws Exception {
        Path runtime = Files.createTempDirectory("managed-invitation-runtime");
        Path output = runtime.resolve("results/invitation.json");

        ManagedInvitationBootstrap.writePrivateFailure(output, new IllegalStateException("password=must-not-escape"));

        Path failure = ManagedInvitationBootstrap.failureOutputPath(output);
        var payload = new com.fasterxml.jackson.databind.ObjectMapper().readTree(failure.toFile());
        assertEquals(
                IllegalStateException.class.getName(),
                payload.get("failureType").asText());
        assertEquals("password=[REDACTED]", payload.get("failureMessage").asText());
        assertEquals("rw-------", PosixFilePermissions.toString(Files.getPosixFilePermissions(failure)));
    }
}
