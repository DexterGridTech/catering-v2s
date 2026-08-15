package com.catering.v2s.app.edge.operations.session;

import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;

import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService;
import com.catering.v2s.app.edge.generated.wire.WorkspaceCurrentPasswordChangeRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceCurrentPasswordChangeResult;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspacePasswordLoginRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSelectContextRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSelectDataNodeRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceSessionEntry;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperation;
import com.catering.v2s.app.edge.session.EdgeSessionCookieWriter;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Exact catalog routes; this is intentionally separate from the browser convenience auth facade. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}")
public final class OperationsCatalogAuthenticationController {
    private static final String COOKIE = "V2S_OPERATIONS_SESSION";
    private final WorkspaceAuthenticationService sessions;
    private final WorkspaceTaskReadService reads;
    private final OperationsSessionResolver sessionResolver;
    private final EdgeSessionCookieWriter cookies;
    private final PlatformAssetService assets;
    public OperationsCatalogAuthenticationController(WorkspaceAuthenticationService sessions, WorkspaceTaskReadService reads, OperationsSessionResolver sessionResolver, EdgeSessionCookieWriter cookies, PlatformAssetService assets) { this.sessions = sessions; this.reads = reads; this.sessionResolver = sessionResolver; this.cookies = cookies; this.assets = assets; }
    @PostMapping("/password-login") @PublicSecurityOperation(id = "operationsWorkspacePasswordLogin", owner = "workspace-iam") ResponseEntity<WorkspaceSessionEntry> login(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestBody WorkspacePasswordLoginRequest body) { var login = sessions.loginWithSessionEntry(groupWorkspaceKey, body.loginName(), body.password() == null ? new char[0] : body.password().toCharArray(), request.rateLimitSourceFingerprint()); return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.issue(COOKIE, login.rawSessionToken())).body(WorkspaceSessionWireMapper.wire(login.sessionEntry(), assets)); }
    @PostMapping("/otp/send") @PublicSecurityOperation(id = "sendOperationsWorkspaceOtp", owner = "workspace-iam") WorkspaceOtpSendResponse sendOtp(@PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceOtpSendRequest body) { key(idempotencyKey); var delivery = sessions.sendLoginOtp(groupWorkspaceKey, body.mobile()); return new WorkspaceOtpSendResponse(delivery.expiresAt(), delivery.debugVerificationCode()); }
    @PostMapping("/otp/verify") @PublicSecurityOperation(id = "verifyOperationsWorkspaceOtp", owner = "workspace-iam") ResponseEntity<WorkspaceSessionEntry> verifyOtp(@PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceOtpVerifyRequest body) { key(idempotencyKey); var login = sessions.verifyLoginOtpWithSessionEntry(groupWorkspaceKey, body.mobile(), body.code()); return ResponseEntity.ok().header(HttpHeaders.SET_COOKIE, cookies.issue(COOKIE, login.rawSessionToken())).body(WorkspaceSessionWireMapper.wire(login.sessionEntry(), assets)); }
    @GetMapping("/session/entry") WorkspaceSessionEntry entry(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) { return WorkspaceSessionWireMapper.wire(reads.sessionEntry(sessionResolver.token(request), groupWorkspaceKey), assets); }
    @PostMapping("/session/context") WorkspaceSessionEntry selectContext(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceSelectContextRequest body) { String token = sessionResolver.token(request); sessionResolver.requireWorkspace(request, groupWorkspaceKey); key(idempotencyKey); return WorkspaceSessionWireMapper.wire(sessions.selectContext(token, body.roleAssignmentRef(), requiredVersion(body.requiredContextVersion())), assets); }
    @PostMapping("/session/data-node") WorkspaceSessionEntry selectDataNode(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceSelectDataNodeRequest body) { String token = sessionResolver.token(request); sessionResolver.requireWorkspace(request, groupWorkspaceKey); key(idempotencyKey); if (body.dataNodeType() == null) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("missing data node type"); return WorkspaceSessionWireMapper.wire(sessions.selectDataNode(token, body.dataNodeType(), body.dataNodeRef(), requiredVersion(body.requiredContextVersion())), assets); }
    @PostMapping("/session/password") WorkspaceCurrentPasswordChangeResult changePassword(EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody WorkspaceCurrentPasswordChangeRequest body) { String token = sessionResolver.token(request); sessionResolver.requireWorkspaceForPasswordChange(request, groupWorkspaceKey); key(idempotencyKey); var result = sessions.changeCurrentPassword(token, body.currentPassword() == null ? new char[0] : body.currentPassword().toCharArray(), body.newPassword() == null ? new char[0] : body.newPassword().toCharArray(), requiredVersion(body.expectedSessionVersion())); return new WorkspaceCurrentPasswordChangeResult(result.status(), result.sessionsRevoked(), result.reauthenticationRequired()); }
    @PostMapping("/logout") ResponseEntity<Void> logout(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) { sessions.logout(sessionResolver.token(request)); return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookies.clear(COOKIE)).build(); }
    private static void key(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
    private static UUID uuid(String value) { try { return UUID.fromString(value); } catch (RuntimeException invalid) { throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid session reference"); } }
    private static long requiredVersion(Long value) { if (value == null || value < 0) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid context version"); return value; }
}
