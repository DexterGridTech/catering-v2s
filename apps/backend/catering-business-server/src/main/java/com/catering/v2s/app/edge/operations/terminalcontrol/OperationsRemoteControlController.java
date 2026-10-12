package com.catering.v2s.app.edge.operations.terminalcontrol;

import com.catering.v2s.app.edge.diagnostic.RequestCompletionDiagnosticState;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlEndResponse;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStartRequest;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlStartResponse;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlControllerGrant;
import com.catering.v2s.app.edge.generated.wire.TerminalRemoteControlSessionRead;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.terminalcontrol.TerminalRemoteControlWire;
import com.catering.v2s.organization.api.OrganizationTaskPathLookup;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.ControllerGrantQuery;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.EndCommand;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.SessionQuery;
import com.catering.v2s.terminalcontrol.api.TerminalRemoteControlOwnerApi.StartCommand;
import com.catering.v2s.terminalcontrol.application.TerminalRemoteControlEndCoordinator;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Thin operations edge: resolve session/scope, then call the remote-control owner. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/projects/{projectRef}/terminals/{terminalRef}/remote-control-sessions")
public final class OperationsRemoteControlController {
    private static final Logger log = LoggerFactory.getLogger(OperationsRemoteControlController.class);
    private static final String PAGE = WorkspaceAuthorizationCatalog.PageDesignKeys.PG_PROJECT_TERMINAL_VERSION_RULES;
    private static final String START = "REQ_START_OPERATIONS_TERMINAL_REMOTE_CONTROL";
    private static final String GRANT = "REQ_ISSUE_OPERATIONS_REMOTE_CONTROL_GRANT";
    private static final String END = "REQ_END_OPERATIONS_TERMINAL_REMOTE_CONTROL";

    private final OperationsSessionResolver sessions;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final OrganizationTaskPathLookup organization;
    private final TerminalRemoteControlOwnerApi owner;
    private final TerminalRemoteControlEndCoordinator endCoordinator;

    public OperationsRemoteControlController(OperationsSessionResolver sessions,
            WorkspaceCapabilityScopeResolver capabilityScopes, OrganizationTaskPathLookup organization,
            TerminalRemoteControlOwnerApi owner, TerminalRemoteControlEndCoordinator endCoordinator) {
        this.sessions = sessions;
        this.capabilityScopes = capabilityScopes;
        this.organization = organization;
        this.owner = owner;
        this.endCoordinator = endCoordinator;
    }

    @PostMapping
    ResponseEntity<TerminalRemoteControlStartResponse> start(EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey, @PathVariable UUID projectRef,
            @PathVariable UUID terminalRef, @RequestParam long expectedContextVersion,
            @RequestBody TerminalRemoteControlStartRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommandAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        var scope = commandScope(session, groupWorkspaceKey, projectRef, START);
        var result = owner.start(new StartCommand(session.workspaceUuid(), groupWorkspaceKey, projectRef,
                terminalRef, body.requestId(), session.contextVersion(), session.accountId(), session.sessionId(),
                sessions.actor(session), scope));
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_START_ACCEPTED")
                .addKeyValue("operationId", "startOperationsTerminalRemoteControl")
                .addKeyValue("requestId", requestId(request)).addKeyValue("correlationId", request.correlationId())
                .addKeyValue("projectRef", projectRef).addKeyValue("terminalRef", terminalRef)
                .addKeyValue("sessionId", result.sessionId()).addKeyValue("state", result.state())
                .log("event=TERMINAL_REMOTE_CONTROL_START_ACCEPTED");
        return ResponseEntity.status(HttpStatus.CREATED).body(TerminalRemoteControlWire.start(result));
    }

    @GetMapping("/{sessionId}")
    TerminalRemoteControlSessionRead read(EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey, @PathVariable UUID projectRef,
            @PathVariable UUID terminalRef, @PathVariable UUID sessionId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceReadAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        readScope(session, groupWorkspaceKey, projectRef);
        return TerminalRemoteControlWire.session(owner.read(new SessionQuery(session.workspaceUuid(),
                groupWorkspaceKey, projectRef, terminalRef, sessionId, session.contextVersion(),
                session.accountId(), session.sessionId())));
    }

    @PostMapping("/{sessionId}/controller-grant")
    TerminalRemoteControlControllerGrant controllerGrant(EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey, @PathVariable UUID projectRef,
            @PathVariable UUID terminalRef, @PathVariable UUID sessionId,
            @RequestParam long expectedContextVersion) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommandAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        var scope = commandScope(session, groupWorkspaceKey, projectRef, GRANT);
        var result = owner.controllerGrant(new ControllerGrantQuery(session.workspaceUuid(), groupWorkspaceKey,
                projectRef, terminalRef, sessionId, session.contextVersion(), session.accountId(), session.sessionId(), scope));
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_CONTROLLER_GRANT_ISSUED")
                .addKeyValue("operationId", "issueOperationsRemoteControlGrant")
                .addKeyValue("requestId", requestId(request)).addKeyValue("correlationId", request.correlationId())
                .addKeyValue("terminalRef", terminalRef).addKeyValue("sessionId", sessionId)
                .log("event=TERMINAL_REMOTE_CONTROL_CONTROLLER_GRANT_ISSUED");
        return TerminalRemoteControlWire.grant(result);
    }

    @PostMapping("/{sessionId}/end")
    TerminalRemoteControlEndResponse end(EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey, @PathVariable UUID projectRef,
            @PathVariable UUID terminalRef, @PathVariable UUID sessionId,
            @RequestParam long expectedContextVersion, @RequestBody TerminalRemoteControlEndRequest body) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceCommandAtContextVersion(
                request, groupWorkspaceKey, expectedContextVersion);
        var scope = commandScope(session, groupWorkspaceKey, projectRef, END);
        var result = endCoordinator.end(new EndCommand(session.workspaceUuid(), groupWorkspaceKey, projectRef,
                terminalRef, sessionId, session.contextVersion(), session.accountId(), session.sessionId(),
                body.reason(), sessions.actor(session), scope));
        log.atInfo().addKeyValue("event", "TERMINAL_REMOTE_CONTROL_END_COMMITTED")
                .addKeyValue("operationId", "endOperationsTerminalRemoteControl")
                .addKeyValue("requestId", requestId(request)).addKeyValue("correlationId", request.correlationId())
                .addKeyValue("terminalRef", terminalRef).addKeyValue("sessionId", sessionId)
                .addKeyValue("reason", result.reason()).log("event=TERMINAL_REMOTE_CONTROL_END_COMMITTED");
        return TerminalRemoteControlWire.end(result);
    }

    private com.catering.v2s.organization.api.OperationsOwnerScopeGrant commandScope(
            WorkspaceSessionReadback session, String groupWorkspaceKey, UUID projectRef, String requirementId) {
        OrganizationTaskPathLookup.TaskPath path = readScope(session, groupWorkspaceKey, projectRef);
        var resolution = capabilityScopes.resolveUsingResolvedTaskPath(session, requirementId,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.PROJECT, projectRef), path);
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private OrganizationTaskPathLookup.TaskPath readScope(
            WorkspaceSessionReadback session, String groupWorkspaceKey, UUID projectRef) {
        if (!session.pageAccessKeys().contains(PAGE))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        OrganizationTaskPathLookup.TaskPath path = organization.requireTaskPath(
                session.workspaceUuid(), groupWorkspaceKey, ServiceNodeTypes.PROJECT, projectRef);
        if (!organization.isScopeAllowed(session.workspaceUuid(), groupWorkspaceKey,
                session.assignmentNodeType(), session.assignmentNodeId(), path))
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return path;
    }

    private static String requestId(EdgeRequestContext request) {
        return request.requestId() == null ? "unavailable" : request.requestId();
    }
}
