package com.catering.v2s.app.edge.publicentry.passwordrecovery;

import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperation;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryCompleteRequest;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryCompletion;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryStartRequest;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryStartResponse;
import com.catering.v2s.app.edge.generated.wire.OperationsPasswordRecoveryVerification;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordRecoveryService;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public operations recovery keeps owner flow/grant secrets in bounded HttpOnly cookies. */
@RestController
@RequestMapping("/api/public/operations-workspaces/{groupWorkspaceKey}/password-recovery")
public final class OperationsPasswordRecoveryController {
    private static final String FLOW_COOKIE = "V2S_OPERATIONS_RECOVERY_FLOW";
    private static final String GRANT_COOKIE = "V2S_OPERATIONS_RECOVERY_GRANT";
    private final WorkspaceAdministrationService workspaces;
    private final WorkspacePasswordRecoveryService recovery;
    private final PlatformAssetService assets;
    private final EdgeSessionCookieWriter cookies;

    public OperationsPasswordRecoveryController(
            WorkspaceAdministrationService workspaces,
            WorkspacePasswordRecoveryService recovery,
            PlatformAssetService assets,
            EdgeSessionCookieWriter cookies) {
        this.workspaces = workspaces;
        this.recovery = recovery;
        this.assets = assets;
        this.cookies = cookies;
    }

    @PostMapping("/start")
    @PublicSecurityOperation(id = "startOperationsPasswordRecovery", owner = "workspace-iam")
    ResponseEntity<OperationsPasswordRecoveryStartResponse> start(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OperationsPasswordRecoveryStartRequest body) {
        key(idempotencyKey);
        var workspace = workspaces.require(groupWorkspaceKey);
        var result = recovery.start(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                body.loginName(),
                body.mobile(),
                request.rateLimitSourceFingerprint());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.issueSecureFlow(FLOW_COOKIE, result.rawFlow(), 30 * 60))
                .body(new OperationsPasswordRecoveryStartResponse(
                        workspace.name(), workspace.operationsTitle(), logoUrl(workspace.logoAssetRef())));
    }

    @PostMapping("/otp/send")
    @PublicSecurityOperation(id = "sendOperationsPasswordRecoveryOtp", owner = "workspace-iam")
    OperationsPasswordRecoveryOtpSendResponse sendOtp(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OperationsPasswordRecoveryOtpSendRequest ignored) {
        key(idempotencyKey);
        var workspace = workspaces.require(groupWorkspaceKey);
        var result = recovery.sendOtp(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                request.operationsRecoveryFlow(),
                request.rateLimitSourceFingerprint());
        return new OperationsPasswordRecoveryOtpSendResponse(result.expiresAt(), result.debugVerificationCode());
    }

    @PostMapping("/otp/verify")
    @PublicSecurityOperation(id = "verifyOperationsPasswordRecoveryOtp", owner = "workspace-iam")
    ResponseEntity<OperationsPasswordRecoveryVerification> verifyOtp(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OperationsPasswordRecoveryOtpVerifyRequest body) {
        key(idempotencyKey);
        var workspace = workspaces.require(groupWorkspaceKey);
        var result = recovery.verifyOtp(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                request.operationsRecoveryFlow(),
                body.code(),
                request.rateLimitSourceFingerprint());
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.SET_COOKIE,
                        cookies.issueSecureFlow(GRANT_COOKIE, result.rawCompletionGrant(), 15 * 60))
                .body(new OperationsPasswordRecoveryVerification("VERIFIED"));
    }

    @PostMapping("/complete")
    @PublicSecurityOperation(id = "completeOperationsPasswordRecovery", owner = "workspace-iam")
    ResponseEntity<OperationsPasswordRecoveryCompletion> complete(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OperationsPasswordRecoveryCompleteRequest body) {
        key(idempotencyKey);
        var workspace = workspaces.require(groupWorkspaceKey);
        var result = recovery.complete(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                request.operationsRecoveryFlow(),
                request.operationsRecoveryGrant(),
                body.newPassword() == null ? new char[0] : body.newPassword().toCharArray());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookies.clearSecureFlow(FLOW_COOKIE))
                .header(HttpHeaders.SET_COOKIE, cookies.clearSecureFlow(GRANT_COOKIE))
                .body(new OperationsPasswordRecoveryCompletion(result.status(), result.sessionsRevoked()));
    }

    private String logoUrl(String assetRef) {
        if (assetRef == null) return null;
        try {
            return assets.requireActivePublicReference(UUID.fromString(assetRef))
                    .publicUrl();
        } catch (PlatformAssetService.AssetNotFoundException | IllegalArgumentException ignored) {
            return null;
        }
    }

    private static void key(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key");
    }
}
