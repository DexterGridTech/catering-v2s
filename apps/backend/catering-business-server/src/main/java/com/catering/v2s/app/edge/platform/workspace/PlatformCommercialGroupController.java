package com.catering.v2s.app.edge.platform.workspace;

import com.catering.v2s.app.edge.generated.CommercialGroupProblemCode;
import com.catering.v2s.app.edge.generated.wire.CommercialGroupInitializeRequest;
import com.catering.v2s.app.edge.generated.wire.CommercialGroupRoot;
import com.catering.v2s.app.edge.problem.ContractProblemAdvice;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.CommercialGroupReadback;
import com.catering.v2s.organization.application.OrganizationCommandService.OrganizationCommandException;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.foundation.diagnostic.RequestDiagnosticContext;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticEvent;
import com.catering.v2s.platform.foundation.diagnostic.SecurityDiagnosticRecorder;
import com.catering.v2s.platform.iam.application.PlatformAuthenticationService;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.workspace.api.PlatformWorkspaceCoordinator;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceService.GroupWorkspaceNotEligibleException;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceService.GroupWorkspaceNotFoundException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** R3 initialization stays an organization public command; this edge contains no workspace fact ownership. */
@RestController
@RequestMapping("/api/platform/group-workspaces")
public final class PlatformCommercialGroupController {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();
    private final PlatformWorkspaceCoordinator coordinator;
    private final PlatformSessionResolver sessions;
    private final SecurityDiagnosticRecorder diagnostics;

    public PlatformCommercialGroupController(PlatformWorkspaceCoordinator coordinator, PlatformSessionResolver sessions, SecurityDiagnosticRecorder diagnostics) {
        this.coordinator = coordinator;
        this.sessions = sessions;
        this.diagnostics = diagnostics;
    }

    @PostMapping("/{groupWorkspaceKey}/commercial-group")
    ResponseEntity<CommercialGroupRoot> initialize(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestHeader("Idempotency-Key") String headerIdempotencyKey,
        @RequestBody CommercialGroupInitializeRequest body
    ) {
        long startedAtNanos = System.nanoTime();
        try {
            if (headerIdempotencyKey == null || !headerIdempotencyKey.equals(body.idempotencyKey()) || headerIdempotencyKey.length() < 16 || headerIdempotencyKey.length() > 128) throw new InvalidRequestException();
            PlatformSessionReadback session = sessions.require(request);
            CommercialGroupReadback readback = coordinator.initializeCommercialGroup(context(request, session), groupWorkspaceKey, headerIdempotencyKey, body.groupCode(), body.groupName(), extensionValues(body.extensionValues()), new com.catering.v2s.audit.contract.AuditActor("PLATFORM_ADMIN", session.platformAdminId(), session.displayName()));
            recordDiagnostic(diagnostics, request, startedAtNanos, HttpStatus.CREATED.value(), null);
            return ResponseEntity.status(HttpStatus.CREATED).body(new CommercialGroupRoot(String.valueOf(readback.id()), readback.groupWorkspaceKey(), readback.commercialGroupCode(), readback.commercialGroupName(), extensionValues(readback.extensionValues()), readback.extensionRuleRevision(), readback.revision(), readback.createdAtEpochMillis(), readback.updatedAtEpochMillis()));
        } catch (RuntimeException exception) {
            DiagnosticFailure failure = diagnosticFailure(exception);
            recordDiagnostic(diagnostics, request, startedAtNanos, failure.status(), failure.errorCode());
            throw exception;
        }
    }

    private PlatformExecutionContext context(EdgeRequestContext request, PlatformSessionReadback session) {
        return new PlatformExecutionContext(session.platformAdminId().toString(), "platform-admin", Instant.ofEpochMilli(session.expiresAtEpochMillis()), request.correlationId() == null ? "platform-session" : request.correlationId());
    }
    private static Map<String, String> extensionValues(tools.jackson.databind.JsonNode values) {
        if (values == null || values.isNull()) return Map.of();
        if (!values.isObject()) throw new InvalidRequestException();
        Map<String, String> result = new LinkedHashMap<>();
        values.properties().forEach(entry -> {
            try { result.put(entry.getKey(), JSON.writeValueAsString(entry.getValue())); }
            catch (Exception exception) { throw new InvalidRequestException(); }
        });
        return Map.copyOf(result);
    }
    private static tools.jackson.databind.JsonNode extensionValues(Map<String, String> values) {
        tools.jackson.databind.node.ObjectNode result = JSON.createObjectNode();
        values.forEach((key, raw) -> {
            try { result.set(key, JSON.readTree(raw)); }
            catch (Exception exception) { throw new IllegalStateException("organization owner emitted invalid extension JSON", exception); }
        });
        return result;
    }

    @ExceptionHandler(GroupWorkspaceNotFoundException.class)
    ResponseEntity<ContractProblemAdvice.Problem> workspaceNotFound(EdgeRequestContext request) { return problem(HttpStatus.NOT_FOUND, CommercialGroupProblemCode.GROUP_WORKSPACE_NOT_FOUND, "请求的集团空间不存在", request); }
    @ExceptionHandler(PlatformAuthenticationService.SessionExpiredException.class)
    ResponseEntity<ContractProblemAdvice.Problem> sessionExpired(EdgeRequestContext request) { return ContractProblemAdvice.problem(HttpStatus.UNAUTHORIZED, "PLATFORM_IAM_SESSION_EXPIRED", "平台会话不可用或已过期", request); }
    @ExceptionHandler(GroupWorkspaceNotEligibleException.class)
    ResponseEntity<ContractProblemAdvice.Problem> workspaceAlreadyInitialized(EdgeRequestContext request) { return problem(HttpStatus.CONFLICT, CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED, "当前集团空间已存在商业集团或不可初始化", request); }
    @ExceptionHandler({OrganizationCommandException.class, InvalidRequestException.class})
    ResponseEntity<ContractProblemAdvice.Problem> validation(Exception exception, EdgeRequestContext request) {
        CommercialGroupProblemCode code = exception instanceof OrganizationCommandException organizationException ? problemCode(organizationException) : CommercialGroupProblemCode.VALIDATION_FAILED;
        HttpStatus status = code == CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED || code == CommercialGroupProblemCode.IDEMPOTENCY_CONFLICT ? HttpStatus.CONFLICT : HttpStatus.UNPROCESSABLE_ENTITY;
        return problem(status, code, code == CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED ? "当前集团空间已存在商业集团" : code == CommercialGroupProblemCode.IDEMPOTENCY_CONFLICT ? "幂等键与本次请求不匹配" : "请求不满足 owner 约束", request);
    }
    private static CommercialGroupProblemCode problemCode(OrganizationCommandException exception) {
        return switch (exception.problem()) {
            case COMMERCIAL_GROUP_ALREADY_INITIALIZED -> CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED;
            case IDEMPOTENCY_CONFLICT -> CommercialGroupProblemCode.IDEMPOTENCY_CONFLICT;
            case COMMERCIAL_GROUP_NOT_INITIALIZED, COMMERCIAL_GROUP_REQUIRED, VALIDATION_FAILED -> CommercialGroupProblemCode.VALIDATION_FAILED;
        };
    }
    static void recordDiagnostic(SecurityDiagnosticRecorder diagnostics, EdgeRequestContext request, long startedAtNanos, int status, String errorCode) {
        String correlationId = request.correlationId() != null && request.correlationId().matches("[A-Za-z0-9._:-]{1,128}") ? request.correlationId() : "corr-" + UUID.randomUUID();
        SecurityDiagnosticEvent event = new SecurityDiagnosticEvent(
            new RequestDiagnosticContext(correlationId, "cmd-" + UUID.randomUUID(), "INITIALIZE_COMMERCIAL_GROUP", "/api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group", "organization"),
            errorCode == null ? "OWNER_COMMAND_SUCCEEDED" : "OWNER_COMMAND_FAILED",
            "OWNER_COMMAND",
            errorCode == null ? "SUCCEEDED" : "FAILED",
            Math.max(0, (System.nanoTime() - startedAtNanos) / 1_000_000),
            status,
            errorCode
        );
        try {
            diagnostics.record(event);
        } catch (RuntimeException ignored) {
            try { diagnostics.recordWriteFailure(event); } catch (RuntimeException ignoredAgain) { }
        }
    }
    private static DiagnosticFailure diagnosticFailure(RuntimeException exception) {
        if (exception instanceof PlatformAuthenticationService.SessionExpiredException) return new DiagnosticFailure(HttpStatus.UNAUTHORIZED.value(), "PLATFORM_IAM_SESSION_EXPIRED");
        if (exception instanceof GroupWorkspaceNotFoundException) return new DiagnosticFailure(HttpStatus.NOT_FOUND.value(), CommercialGroupProblemCode.GROUP_WORKSPACE_NOT_FOUND.wireValue());
        if (exception instanceof GroupWorkspaceNotEligibleException) return new DiagnosticFailure(HttpStatus.CONFLICT.value(), CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED.wireValue());
        if (exception instanceof OrganizationCommandException organizationException) {
            CommercialGroupProblemCode code = problemCode(organizationException);
            int status = code == CommercialGroupProblemCode.COMMERCIAL_GROUP_ALREADY_INITIALIZED || code == CommercialGroupProblemCode.IDEMPOTENCY_CONFLICT ? HttpStatus.CONFLICT.value() : HttpStatus.UNPROCESSABLE_ENTITY.value();
            return new DiagnosticFailure(status, code.wireValue());
        }
        if (exception instanceof InvalidRequestException) return new DiagnosticFailure(HttpStatus.UNPROCESSABLE_ENTITY.value(), CommercialGroupProblemCode.VALIDATION_FAILED.wireValue());
        return new DiagnosticFailure(HttpStatus.INTERNAL_SERVER_ERROR.value(), "PLATFORM_COMMON_RESULT_UNKNOWN");
    }
    private static ResponseEntity<ContractProblemAdvice.Problem> problem(HttpStatus status, CommercialGroupProblemCode code, String detail, EdgeRequestContext request) { return ContractProblemAdvice.problem(status, code.wireValue(), detail, request); }
    private record DiagnosticFailure(int status, String errorCode) { }
    private static final class InvalidRequestException extends RuntimeException { }
}
