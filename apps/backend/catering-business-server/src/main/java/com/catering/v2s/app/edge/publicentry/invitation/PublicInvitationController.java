package com.catering.v2s.app.edge.publicentry.invitation;

import com.catering.v2s.app.edge.generated.wire.PublicInvitationAcceptIntent;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationCompletion;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationCredentialRequest;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationCredentialResponse;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationOtpSendRequest;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationOtpSendResponse;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationOtpVerifyRequest;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationReadiness;
import com.catering.v2s.app.edge.generated.wire.PublicInvitationView;
import com.catering.v2s.app.edge.diagnostic.PublicSecurityOperation;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public invitation progress is purpose-bound; no early endpoint creates an assignment. */
@RestController
@RequestMapping("/api/public/invitations/{groupWorkspaceKey}/{invitationToken}")
public final class PublicInvitationController {
    private final WorkspaceInvitationService invitations;
    private final WorkspaceAdministrationService workspaces;
    private final PlatformAssetService assets;
    public PublicInvitationController(WorkspaceInvitationService invitations, WorkspaceAdministrationService workspaces, PlatformAssetService assets) { this.invitations = invitations; this.workspaces = workspaces; this.assets = assets; }

    @GetMapping @PublicSecurityOperation(id = "getPublicInvitationView", owner = "workspace-iam") PublicInvitationView view(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken) { return view(invitations.publicView(groupWorkspaceKey, invitationToken), workspaces.require(groupWorkspaceKey)); }
    @PostMapping @PublicSecurityOperation(id = "acceptPublicInvitation", owner = "workspace-iam") PublicInvitationAcceptIntent accept(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken, @RequestHeader("Idempotency-Key") String idempotencyKey) { requiredIdempotencyKey(idempotencyKey); return new PublicInvitationAcceptIntent(invitations.acceptPublic(groupWorkspaceKey, invitationToken).nextStep()); }
    @PostMapping("/otp/send") @PublicSecurityOperation(id = "sendPublicInvitationOtp", owner = "workspace-iam") ResponseEntity<PublicInvitationOtpSendResponse> sendOtp(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PublicInvitationOtpSendRequest body) { requiredIdempotencyKey(idempotencyKey); var delivery = invitations.sendPublicOtp(groupWorkspaceKey, invitationToken, body.mobile()); return ResponseEntity.ok(new PublicInvitationOtpSendResponse(delivery.verificationId(), delivery.expiresAt(), delivery.debugVerificationCode())); }
    @PostMapping("/otp/verify") @PublicSecurityOperation(id = "verifyPublicInvitationOtp", owner = "workspace-iam") PublicInvitationReadiness verifyOtp(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PublicInvitationOtpVerifyRequest body) { requiredIdempotencyKey(idempotencyKey); return readiness(invitations.verifyPublicOtp(groupWorkspaceKey, invitationToken, body.mobile(), body.code())); }
    @PostMapping("/credentials") @PublicSecurityOperation(id = "savePublicInvitationCredentials", owner = "workspace-iam") PublicInvitationCredentialResponse credentials(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken, @RequestHeader("Idempotency-Key") String idempotencyKey, @RequestBody PublicInvitationCredentialRequest body) { requiredIdempotencyKey(idempotencyKey); return credentialResponse(invitations.savePublicCredentials(groupWorkspaceKey, invitationToken, body.verificationGrant(), body.userName(), body.loginName(), body.password() == null ? new char[0] : body.password().toCharArray())); }
    @PostMapping("/complete") @PublicSecurityOperation(id = "completePublicInvitation", owner = "workspace-iam") PublicInvitationCompletion complete(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken, @RequestHeader("Idempotency-Key") String idempotencyKey) { requiredIdempotencyKey(idempotencyKey); return completion(invitations.completePublic(groupWorkspaceKey, invitationToken)); }
    @GetMapping("/completion") @PublicSecurityOperation(id = "getPublicInvitationCompletion", owner = "workspace-iam") PublicInvitationCompletion completion(@PathVariable String groupWorkspaceKey, @PathVariable String invitationToken) { return completion(invitations.publicCompletion(groupWorkspaceKey, invitationToken)); }

    private PublicInvitationView view(WorkspaceInvitationService.PublicInvitationView value, com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback workspace) { return new PublicInvitationView(value.invitationId().toString(), value.groupWorkspaceKey(), workspace.operationsTitle(), value.targetOrganizationType(), value.targetOrganizationPath(), value.roleNames(), value.maskedMobile(), invitationStatus(value.status()), value.nextStep(), value.expiresAt(), workspace.name(), logoUrl(workspace.logoAssetRef())); }
    private static PublicInvitationCompletion completion(WorkspaceInvitationService.PublicCompletion value) { return new PublicInvitationCompletion(value.invitationId().toString(), value.status(), value.message(), value.loginPath()); }
    private static PublicInvitationReadiness readiness(WorkspaceInvitationService.PublicReadiness value) { return new PublicInvitationReadiness(value.verificationGrant(), value.accountExists(), value.userNameReady(), value.loginNameReady(), value.passwordReady(), value.nextStep()); }
    private static PublicInvitationCredentialResponse credentialResponse(WorkspaceInvitationService.PublicReadiness value) { return new PublicInvitationCredentialResponse(value.verificationGrant(), value.accountExists(), value.userNameReady(), value.loginNameReady(), value.passwordReady(), value.nextStep()); }
    private static WorkspaceInvitationStatus invitationStatus(String value) { return "COMPLETED".equals(value) ? WorkspaceInvitationStatus.COMPLETED : "CANCELLED".equals(value) ? WorkspaceInvitationStatus.CANCELLED : "EXPIRED".equals(value) ? WorkspaceInvitationStatus.EXPIRED : WorkspaceInvitationStatus.ACTIVE; }
    private static void requiredIdempotencyKey(String value) { if (value == null || value.length() < 16 || value.length() > 128) throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key"); }
    private String logoUrl(String assetRef) { if (assetRef == null) return null; try { return assets.requireActivePublicReference(UUID.fromString(assetRef)).publicUrl(); } catch (PlatformAssetService.AssetNotFoundException | IllegalArgumentException ignored) { return null; } }
}
