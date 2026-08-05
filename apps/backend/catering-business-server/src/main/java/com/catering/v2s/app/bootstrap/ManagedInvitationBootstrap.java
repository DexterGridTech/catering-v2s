package com.catering.v2s.app.bootstrap;

import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;

import com.catering.v2s.audit.contract.AuditActor;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.api.WorkspaceInvitationReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Explicit, non-web isolated-fixture bootstrap for invitation acceptance verification.
 * It supplements, and never replaces, the permanent platform-admin invitation centre;
 * it is not a component or controller and may only invoke the two owner APIs below.
 */
public final class ManagedInvitationBootstrap {
    private static final Logger LOG = LoggerFactory.getLogger(ManagedInvitationBootstrap.class);
    private static final Set<String> TARGET_TYPES = Set.of(ServiceNodeTypes.GROUP, ServiceNodeTypes.REGION, ServiceNodeTypes.PROJECT, ServiceNodeTypes.HEAD_COMPANY, ServiceNodeTypes.STORE);
    private static final Set<PosixFilePermission> OWNER_ONLY = EnumSet.of(
        PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE
    );

    private ManagedInvitationBootstrap() { }

    public static void main(String[] args) throws Exception {
        Input input = Input.from(System.getenv());
        try {
            try (ConfigurableApplicationContext context = new SpringApplicationBuilder(CateringV2sApplication.class)
                .web(WebApplicationType.NONE)
                .logStartupInfo(false)
                .properties("spring.main.banner-mode=off", "spring.main.lazy-initialization=true")
                .run(args)) {
                WorkspaceAdministrationService workspaces = context.getBean(WorkspaceAdministrationService.class);
                WorkspaceInvitationService invitations = context.getBean(WorkspaceInvitationService.class);
                Result result = create(workspaces, invitations, input);
                writePrivateOutput(input.outputPath(), result);
                LOG.info("managed-invitation-bootstrap outcome=SUCCEEDED status={}", result.status());
            }
        } catch (Exception failure) {
            writePrivateFailure(input.outputPath(), failure);
            Throwable root = failure;
            while (root.getCause() != null && root.getCause() != root) root = root.getCause();
            LOG.error("managed-invitation-bootstrap outcome=FAILED failureType={} failureMessagePresent={}", root.getClass().getName(), root.getMessage() != null && !root.getMessage().isBlank());
            throw failure;
        }
    }

    static Result create(WorkspaceAdministrationService workspaces, WorkspaceInvitationService invitations, Input input) {
        WorkspaceAdministrationReadback workspace = workspaces.requireEnabled(input.groupWorkspaceKey());
        WorkspaceInvitationReadback invitation = invitations.create(
            workspace.workspaceUuid(), workspace.groupWorkspaceKey(), input.mobile(),
            List.of(new WorkspaceInvitationService.AssignmentIntent(input.roleId(), input.targetType(), input.targetRef())),
            UUID.randomUUID().toString(), AuditActor.system()
        );
        if (invitation.rawInvitationToken() == null || invitation.rawInvitationToken().isBlank()) {
            throw new IllegalStateException("MANAGED_INVITATION_TOKEN_MISSING");
        }
        return new Result(invitation.id(), invitation.status(), invitation.rawInvitationToken());
    }

    static void writePrivateOutput(Path outputPath, Result result) throws IOException {
        writePrivateJson(outputPath, Map.of(
            "invitationId", result.invitationId().toString(), "status", result.status(), "invitationToken", result.invitationToken()
        ));
    }

    static void writePrivateFailure(Path outputPath, Throwable failure) throws IOException {
        Throwable root = failure;
        while (root.getCause() != null && root.getCause() != root) root = root.getCause();
        writePrivateJson(failureOutputPath(outputPath), Map.of(
            "failureType", root.getClass().getName(), "failureMessage", safeFailureMessage(root.getMessage())
        ));
    }

    static Path failureOutputPath(Path outputPath) {
        return outputPath.resolveSibling(outputPath.getFileName() + ".failure.json");
    }

    private static String safeFailureMessage(String message) {
        if (message == null || message.isBlank()) return "UNSPECIFIED";
        String safe = message.replaceAll("(?i)(password|secret|token|authorization|cookie)=[^\\s]+", "$1=[REDACTED]");
        return safe.substring(0, Math.min(safe.length(), 240));
    }

    private static void writePrivateJson(Path outputPath, Map<String, String> payload) throws IOException {
        Path parent = outputPath.getParent();
        if (parent == null) throw new IllegalArgumentException("MANAGED_INVITATION_OUTPUT_PARENT_REQUIRED");
        Files.createDirectories(parent);
        Path temporary = Files.createTempFile(parent, ".managed-invitation-", ".tmp", PosixFilePermissions.asFileAttribute(OWNER_ONLY));
        try {
            Files.writeString(temporary, new ObjectMapper().writeValueAsString(payload) + "\n");
            try {
                Files.setPosixFilePermissions(temporary, OWNER_ONLY);
            } catch (UnsupportedOperationException ignored) {
                temporary.toFile().setReadable(false, false);
                temporary.toFile().setWritable(false, false);
                temporary.toFile().setReadable(true, true);
                temporary.toFile().setWritable(true, true);
            }
            try {
                Files.move(temporary, outputPath, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temporary, outputPath);
            }
        } finally {
            Files.deleteIfExists(temporary);
        }
    }

    record Input(String groupWorkspaceKey, String mobile, UUID roleId, String targetType, UUID targetRef, Path outputPath) {
        static Input from(Map<String, String> environment) {
            String workspaceKey = required(environment, "V2S_MANAGED_INVITATION_WORKSPACE_KEY");
            String mobile = required(environment, "V2S_MANAGED_INVITATION_MOBILE");
            UUID roleId = uuid(required(environment, "V2S_MANAGED_INVITATION_ROLE_ID"));
            String targetType = required(environment, "V2S_MANAGED_INVITATION_TARGET_TYPE");
            if (!TARGET_TYPES.contains(targetType)) throw new IllegalArgumentException("MANAGED_INVITATION_TARGET_TYPE_INVALID");
            UUID targetRef = uuid(required(environment, "V2S_MANAGED_INVITATION_TARGET_REF"));
            Path runtime = Path.of(required(environment, "V2S_RUNTIME_DIR")).toAbsolutePath().normalize();
            Path output = Path.of(required(environment, "V2S_MANAGED_INVITATION_OUTPUT")).toAbsolutePath().normalize();
            Path resultDirectory = runtime.resolve("results");
            if (!output.startsWith(resultDirectory) || Files.exists(output)) throw new IllegalArgumentException("MANAGED_INVITATION_OUTPUT_INVALID");
            return new Input(workspaceKey, mobile, roleId, targetType, targetRef, output);
        }

        private static String required(Map<String, String> environment, String name) {
            String value = environment.get(name);
            if (value == null || value.isBlank()) throw new IllegalArgumentException(name + "_REQUIRED");
            return value.trim();
        }

        private static UUID uuid(String value) {
            try { return UUID.fromString(value); }
            catch (IllegalArgumentException error) { throw new IllegalArgumentException("MANAGED_INVITATION_UUID_INVALID", error); }
        }
    }

    record Result(UUID invitationId, String status, String invitationToken) { }
}
