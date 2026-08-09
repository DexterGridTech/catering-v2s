package com.catering.v2s.app.edge.platform.session;

import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;

import com.catering.v2s.app.edge.generated.wire.PlatformAdminCreateRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminCredentialResetRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminDetail;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminPage;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminPageItemsItem;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminProfileUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminSortKey;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminStatus;
import com.catering.v2s.app.edge.generated.wire.PlatformAdminStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/admin-users")
public final class PlatformAdminGovernanceController {
    private final PlatformAuthenticationService service;
    private final PlatformSessionResolver sessionResolver;
    public PlatformAdminGovernanceController(PlatformAuthenticationService service, PlatformSessionResolver sessionResolver) { this.service = service; this.sessionResolver = sessionResolver; }

    @GetMapping
    PlatformAdminPage list(EdgeRequestContext request, @RequestParam(required = false) String userName, @RequestParam(required = false) String loginName, @RequestParam(required = false) PlatformAdminStatus status, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "50") int pageSize, @RequestParam(defaultValue = "USER_NAME") PlatformAdminSortKey sortKey, @RequestParam(defaultValue = "ASC") SortDirection sortDirection) {
        sessionResolver.requireRead(request);
        PlatformAuthenticationService.PlatformAdminPage ownerPage = service.platformAdministratorPage(userName, loginName, status == null ? null : dbStatus(status), page, pageSize, sortKey.name(), sortDirection.name());
        return new PlatformAdminPage(ownerPage.items().stream().map(PlatformAdminGovernanceController::pageItem).toList(), (long) ownerPage.page(), (long) ownerPage.pageSize(), ownerPage.total(), PlatformAdminSortKey.valueOf(ownerPage.sortKey()), SortDirection.valueOf(ownerPage.sortDirection()));
    }
    @GetMapping("/{platformAdminId}") PlatformAdminDetail detail(EdgeRequestContext request, @PathVariable UUID platformAdminId) { sessionResolver.requireRead(request); return wire(service.platformAdministratorDetail(platformAdminId)); }
    @PostMapping("/{platformAdminId}/status") PlatformAdminDetail transition(EdgeRequestContext request, @PathVariable UUID platformAdminId, @RequestHeader("Idempotency-Key") String headerKey, @RequestBody PlatformAdminStatusTransitionRequest body) { var actor = sessionResolver.requireActor(request); key(headerKey, body.idempotencyKey()); if (body.targetStatus() == null || body.expectedVersion() == null) throw new InvalidEdgeRequestException("status and expected version required"); return wire(service.transitionAdministratorStatus(platformAdminId, dbStatus(body.targetStatus()), body.expectedVersion(), body.idempotencyKey(), actor)); }
    @PostMapping ResponseEntity<PlatformAdminDetail> create(EdgeRequestContext request, @RequestHeader("Idempotency-Key") String headerKey, @RequestBody PlatformAdminCreateRequest body) { var actor = sessionResolver.requireActor(request); key(headerKey, body.idempotencyKey()); return ResponseEntity.status(HttpStatus.CREATED).body(wire(service.createAdministrator(body.loginName(), body.userName(), body.mobile(), chars(body.password()), body.idempotencyKey(), actor))); }
    @PatchMapping("/{platformAdminId}/profile") PlatformAdminDetail updateProfile(EdgeRequestContext request, @PathVariable UUID platformAdminId, @RequestHeader("Idempotency-Key") String headerKey, @RequestBody PlatformAdminProfileUpdateRequest body) { var actor = sessionResolver.requireActor(request); key(headerKey, body.idempotencyKey()); if (body.expectedVersion() == null) throw new InvalidEdgeRequestException("expected version required"); return wire(service.updateAdministratorProfile(platformAdminId, body.userName(), body.mobile(), body.expectedVersion(), body.idempotencyKey(), actor)); }
    @PostMapping("/{platformAdminId}/credential-reset") PlatformAdminDetail resetCredential(EdgeRequestContext request, @PathVariable UUID platformAdminId, @RequestHeader("Idempotency-Key") String headerKey, @RequestBody PlatformAdminCredentialResetRequest body) { var actor = sessionResolver.requireActor(request); key(headerKey, body.idempotencyKey()); if (body.expectedVersion() == null) throw new InvalidEdgeRequestException("expected version required"); return wire(service.resetAdministratorCredential(platformAdminId, chars(body.password()), body.expectedVersion(), body.idempotencyKey(), actor)); }
    private static PlatformAdminDetail wire(PlatformAuthenticationService.PlatformAdminReadback value) { return new PlatformAdminDetail(value.id().toString(), value.displayName(), value.loginName(), value.builtIn(), value.mobile(), masked(value.mobile()), statusOf(value.status()), "SET", value.lastLoginAtEpochMillis(), value.createdAtEpochMillis(), value.updatedAtEpochMillis(), value.version(), value.auditSummary()); }
    private static PlatformAdminPageItemsItem pageItem(PlatformAuthenticationService.PlatformAdminReadback value) { return new PlatformAdminPageItemsItem(value.id().toString(), value.displayName(), value.loginName(), value.builtIn(), statusOf(value.status()), value.lastLoginAtEpochMillis(), value.updatedAtEpochMillis(), value.version()); }
    private static PlatformAdminStatus statusOf(String value) { return "ENABLED".equals(value) ? PlatformAdminStatus.ACTIVE : PlatformAdminStatus.DISABLED; }
    private static String dbStatus(PlatformAdminStatus value) { return value == PlatformAdminStatus.ACTIVE ? "ENABLED" : "DISABLED"; }
    private static String masked(String value) { if (value == null || value.length() < 5) return value == null ? null : "***"; return value.substring(0, 3) + "****" + value.substring(value.length() - 4); }
    private static void key(String header, String body) { if (header == null || body == null || !header.equals(body) || header.length() < 16 || header.length() > 128) throw new InvalidEdgeRequestException("invalid idempotency key"); }
    private static char[] chars(String value) { return value == null ? new char[0] : value.toCharArray(); }
}
