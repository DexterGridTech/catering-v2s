package com.catering.v2s.app.edge.publicentry.passwordreset;

import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetCompleteRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetCompletion;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordResetReadiness;
import com.catering.v2s.workspace.iam.application.WorkspacePasswordResetService;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public recovery is purpose-bound to a reset generation and its account mobile. */
@RestController
@RequestMapping("/api/public/password-reset/{resetGenerationKey}")
public final class PublicWorkspacePasswordResetController {
    private final WorkspacePasswordResetService resets;
    public PublicWorkspacePasswordResetController(WorkspacePasswordResetService resets) { this.resets = resets; }

    @PostMapping("/otp/send") WorkspacePasswordResetOtpSendResponse sendOtp(@PathVariable String resetGenerationKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspacePasswordResetOtpSendRequest body) { key(idempotencyKey); var result = resets.sendOtp(resetGenerationKey, body.mobile()); return new WorkspacePasswordResetOtpSendResponse(result.expiresAt()); }
    @PostMapping("/otp/verify") WorkspacePasswordResetReadiness verifyOtp(@PathVariable String resetGenerationKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspacePasswordResetOtpVerifyRequest body) { key(idempotencyKey); var result = resets.verifyOtp(resetGenerationKey, body.mobile(), body.code()); return new WorkspacePasswordResetReadiness(result.passwordResetGrant(), result.loginName(), result.nextStep()); }
    @PostMapping("/complete") WorkspacePasswordResetCompletion complete(@PathVariable String resetGenerationKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspacePasswordResetCompleteRequest body) { key(idempotencyKey); var result = resets.complete(resetGenerationKey, body.passwordResetGrant(), body.password() == null ? new char[0] : body.password().toCharArray()); return new WorkspacePasswordResetCompletion(result.status(), result.loginName(), result.message(), result.loginPath(), result.sessionsRevoked()); }

    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
}
