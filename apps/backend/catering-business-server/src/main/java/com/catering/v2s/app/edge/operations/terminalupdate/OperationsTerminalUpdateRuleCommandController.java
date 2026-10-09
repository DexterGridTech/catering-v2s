package com.catering.v2s.app.edge.operations.terminalupdate;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleCreateRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleDetail;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleStatusRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRulePage;
import com.catering.v2s.app.edge.generated.wire.TerminalUpdateRuleStorePage;
import com.catering.v2s.app.application.terminalupdate.TerminalUpdateRuleWire;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi;
import com.catering.v2s.terminalupdate.api.TerminalUpdateRuleOwnerApi.RulePageQuery;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Edge adapter for the two project-rule owner commands. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminal-update-rules")
public final class OperationsTerminalUpdateRuleCommandController {
    private final OperationsSessionResolver sessions;
    private final BackendPerformanceM1CommandExecutionBindings bindings;
    private final TerminalUpdateRuleOwnerApi rules;
    private final OrganizationTaskPathLookup organization;

    public OperationsTerminalUpdateRuleCommandController(
            OperationsSessionResolver sessions, BackendPerformanceM1CommandExecutionBindings bindings,
            TerminalUpdateRuleOwnerApi rules, OrganizationTaskPathLookup organization) {
        this.sessions = sessions;
        this.bindings = bindings;
        this.rules = rules;
        this.organization = organization;
    }

    @GetMapping
    ResponseEntity<TerminalUpdateRulePage> page(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String applicationId,
            @RequestParam(required = false) Long createdFromEpochMillis,
            @RequestParam(required = false) Long createdToEpochMillis,
            @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        return ResponseEntity.ok(TerminalUpdateRuleWire.from(rules.page(session.workspaceUuid(), groupWorkspaceKey,
                projectRef, new RulePageQuery(status, applicationId, createdFromEpochMillis,
                        createdToEpochMillis, cursor, limit))));
    }

    @GetMapping("/{ruleRef}")
    ResponseEntity<TerminalUpdateRuleDetail> detail(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @PathVariable UUID ruleRef,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        return ResponseEntity.ok(TerminalUpdateRuleWire.from(rules.read(
                session.workspaceUuid(), groupWorkspaceKey, projectRef, ruleRef)));
    }

    @GetMapping("/{ruleRef}/stores")
    ResponseEntity<TerminalUpdateRuleStorePage> stores(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @PathVariable UUID ruleRef,
            @RequestParam long expectedContextVersion,
            @RequestParam(required = false) String cursor,
            @RequestParam int limit) {
        WorkspaceSessionReadback session = projectReadSession(request, groupWorkspaceKey, projectRef, expectedContextVersion);
        return ResponseEntity.ok(TerminalUpdateRuleWire.from(rules.stores(
                session.workspaceUuid(), groupWorkspaceKey, projectRef, ruleRef, cursor, limit)));
    }

    @PostMapping
    ResponseEntity<TerminalUpdateRuleDetail> create(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @RequestParam long expectedContextVersion,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody TerminalUpdateRuleCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(bindings.bindCreateOperationsProjectTerminalUpdateRule(
                body, sessions.token(request), groupWorkspaceKey, projectRef, expectedContextVersion, request.correlationId(),
                request.requestId(), idempotencyKey));
    }

    @PostMapping("/{ruleRef}/status")
    ResponseEntity<TerminalUpdateRuleDetail> changeStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID projectRef,
            @PathVariable UUID ruleRef,
            @RequestParam long expectedContextVersion,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody TerminalUpdateRuleStatusRequest body) {
        return ResponseEntity.ok(bindings.bindChangeOperationsProjectTerminalUpdateRuleStatus(
                body, sessions.token(request), groupWorkspaceKey, projectRef, ruleRef, expectedContextVersion, request.correlationId(),
                request.requestId(), idempotencyKey));
    }

    private WorkspaceSessionReadback projectReadSession(
            EdgeRequestContext request, String groupWorkspaceKey, UUID projectRef, long expectedContextVersion) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceReadAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        if (!session.pageAccessKeys().contains(WorkspaceAuthorizationCatalog.PageDesignKeys.PG_PROJECT_TERMINAL_VERSION_RULES))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        var path = organization.requireTaskPath(session.workspaceUuid(), groupWorkspaceKey, "PROJECT", projectRef);
        if (!organization.isScopeAllowed(session.workspaceUuid(), groupWorkspaceKey,
                session.assignmentNodeType(), session.assignmentNodeId(), path))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return session;
    }
}
