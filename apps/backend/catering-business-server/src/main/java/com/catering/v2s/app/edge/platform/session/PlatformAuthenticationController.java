package com.catering.v2s.app.edge.platform.session;

import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperation;
import com.catering.v2s.app.edge.generated.wire.LoginRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformCurrentPasswordChangeRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformCurrentPasswordChangeResult;
import com.catering.v2s.app.edge.generated.wire.PlatformLoginOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformLoginOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformOtpDispatchResponse;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryCompleteRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryCompletion;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryStartRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryStartResponse;
import com.catering.v2s.app.edge.generated.wire.PlatformPasswordRecoveryVerification;
import com.catering.v2s.app.edge.generated.wire.PlatformSessionView;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Platform-facing product session adapter; no provider edge context is accepted for password login. */
@RestController
@RequestMapping("/api/platform/auth")
public final class PlatformAuthenticationController {
    private static final String RECOVERY_FLOW_COOKIE = "V2S_PLATFORM_PASSWORD_RECOVERY";
    private final PlatformAuthenticationService service;
    private final PlatformSessionResolver sessionResolver;
    private final EdgeSessionCookieWriter cookies;

    public PlatformAuthenticationController(PlatformAuthenticationService service, PlatformSessionResolver sessionResolver, EdgeSessionCookieWriter cookies) {
        this.service = service;
        this.sessionResolver = sessionResolver;
        this.cookies = cookies;
    }

    @PostMapping("/password-login")
    @PublicSecurityOperation(id = "platformPasswordLogin", owner = "platform-iam")
    ResponseEntity<PlatformSessionView> login(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody LoginRequest request) {
        key(idempotencyKey);
        PlatformAuthenticationService.LoginResult result = service.login(request.accountName(), request.password() == null ? new char[0] : request.password().toCharArray(), context.rateLimitSourceFingerprint());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.issue("V2S_PLATFORM_SESSION", result.rawSessionToken())).body(toResponse(result.session()));
    }

    @PostMapping("/login-otp/send")
    @PublicSecurityOperation(id = "sendPlatformLoginOtp", owner = "platform-iam")
    PlatformOtpDispatchResponse sendLoginOtp(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformLoginOtpSendRequest body) {
        key(idempotencyKey);
        var result = service.sendLoginOtp(body.mobile(), context.rateLimitSourceFingerprint());
        return new PlatformOtpDispatchResponse(result.expiresAt(), result.debugVerificationCode());
    }

    @PostMapping("/login-otp/verify")
    @PublicSecurityOperation(id = "verifyPlatformLoginOtp", owner = "platform-iam")
    ResponseEntity<PlatformSessionView> verifyLoginOtp(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformLoginOtpVerifyRequest body) {
        key(idempotencyKey);
        var result = service.verifyLoginOtp(body.mobile(), body.code(), context.rateLimitSourceFingerprint());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.issue("V2S_PLATFORM_SESSION", result.rawSessionToken())).body(toResponse(result.session()));
    }

    @PostMapping("/password-recovery/start")
    @PublicSecurityOperation(id = "startPlatformPasswordRecovery", owner = "platform-iam")
    ResponseEntity<PlatformPasswordRecoveryStartResponse> startPasswordRecovery(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformPasswordRecoveryStartRequest body) {
        key(idempotencyKey);
        var result = service.startPasswordRecovery(body.loginName(), body.mobile(), context.rateLimitSourceFingerprint());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.issueSecureFlow(RECOVERY_FLOW_COOKIE, result.rawFlowToken(), 30 * 60)).body(new PlatformPasswordRecoveryStartResponse("OTP_REQUIRED"));
    }

    @PostMapping("/password-recovery/otp/send")
    @PublicSecurityOperation(id = "sendPlatformPasswordRecoveryOtp", owner = "platform-iam")
    PlatformOtpDispatchResponse sendPasswordRecoveryOtp(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformPasswordRecoveryOtpSendRequest ignored) {
        key(idempotencyKey);
        var result = service.sendPasswordRecoveryOtp(context.platformRecoveryFlow(), context.rateLimitSourceFingerprint());
        return new PlatformOtpDispatchResponse(result.expiresAt(), result.debugVerificationCode());
    }

    @PostMapping("/password-recovery/otp/verify")
    @PublicSecurityOperation(id = "verifyPlatformPasswordRecoveryOtp", owner = "platform-iam")
    PlatformPasswordRecoveryVerification verifyPasswordRecoveryOtp(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformPasswordRecoveryOtpVerifyRequest body) {
        key(idempotencyKey);
        service.verifyPasswordRecoveryOtp(context.platformRecoveryFlow(), body.code(), context.rateLimitSourceFingerprint());
        return new PlatformPasswordRecoveryVerification("PASSWORD_REQUIRED");
    }

    @PostMapping("/password-recovery/complete")
    @PublicSecurityOperation(id = "completePlatformPasswordRecovery", owner = "platform-iam")
    ResponseEntity<PlatformPasswordRecoveryCompletion> completePasswordRecovery(EdgeRequestContext context, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformPasswordRecoveryCompleteRequest body) {
        key(idempotencyKey);
        var result = service.completePasswordRecovery(context.platformRecoveryFlow(), body.newPassword() == null ? new char[0] : body.newPassword().toCharArray());
        return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.clearSecureFlow(RECOVERY_FLOW_COOKIE)).body(new PlatformPasswordRecoveryCompletion(result.status(), result.sessionsRevoked(), result.reauthenticationRequired()));
    }

    @GetMapping("/session")
    PlatformSessionView session(EdgeRequestContext request) { return toResponse(sessionResolver.require(request)); }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(EdgeRequestContext request) {
        service.logout(sessionResolver.token(request));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear("V2S_PLATFORM_SESSION")).build();
    }

    @PostMapping("/password")
    PlatformCurrentPasswordChangeResult changePassword(EdgeRequestContext request, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PlatformCurrentPasswordChangeRequest body) {
        key(idempotencyKey);
        var result = service.changeCurrentPassword(sessionResolver.token(request), body.currentPassword() == null ? new char[0] : body.currentPassword().toCharArray(), body.newPassword() == null ? new char[0] : body.newPassword().toCharArray(), requireVersion(body.expectedSessionVersion()));
        return new PlatformCurrentPasswordChangeResult(result.status(), result.sessionsRevoked(), result.reauthenticationRequired());
    }

    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
    private static long requireVersion(Long value) { if (value == null) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("missing expected session version"); return value; }
    private static PlatformSessionView toResponse(PlatformSessionReadback value) { return new PlatformSessionView(value.sessionId().toString(), value.displayName(), java.util.List.of("platform.admin.access", "platform.workspace.initialize"), true, value.sessionVersion()); }
}
