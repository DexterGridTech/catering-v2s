package com.catering.v2s.app.edge.operations.access;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitation;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationPage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceInvitationStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationActionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceOperationsInvitationCreateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.workspaceiam.WorkspaceInvitationPageWireMapper;
import com.catering.v2s.app.edge.workspaceiam.WorkspaceInvitationWireMapper;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.application.WorkspaceAuthenticationService;
import com.catering.v2s.workspace.iam.application.WorkspaceInvitationService;
import com.catering.v2s.workspace.iam.application.WorkspaceTaskReadService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import com.catering.v2s.workspace.iam.application.operations.CancelOperationsWorkspaceInvitationOperation;
import com.catering.v2s.workspace.iam.application.operations.CreateOperationsWorkspaceInvitationOperation;
import com.catering.v2s.workspace.iam.application.operations.ReissueOperationsWorkspaceInvitationOperation;
import java.util.List;
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

@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/user-management")
public final class OperationsWorkspaceInvitationController {
    private final OperationsSessionResolver sessions;
    private final WorkspaceInvitationService invitations;
    private final WorkspaceUserService user;
    private final WorkspaceTaskReadService reads;
    private final CreateOperationsWorkspaceInvitationOperation invitationCreate;
    private final CancelOperationsWorkspaceInvitationOperation invitationCancel;
    private final ReissueOperationsWorkspaceInvitationOperation invitationReissue;
    private final BackendPerformanceM1CommandExecutionBindings m1Bindings;

    public OperationsWorkspaceInvitationController(
            OperationsSessionResolver sessions,
            WorkspaceInvitationService invitations,
            WorkspaceUserService user,
            WorkspaceTaskReadService reads,
            CancelOperationsWorkspaceInvitationOperation invitationCancel,
            CreateOperationsWorkspaceInvitationOperation invitationCreate,
            ReissueOperationsWorkspaceInvitationOperation invitationReissue) {
        this(
                sessions,
                invitations,
                user,
                reads,
                invitationCancel,
                invitationCreate,
                invitationReissue,
                BackendPerformanceM1CommandExecutionBindings.forWorkspaceInvitation(
                        invitationCancel, invitationCreate, invitationReissue));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public OperationsWorkspaceInvitationController(
            OperationsSessionResolver sessions,
            WorkspaceInvitationService invitations,
            WorkspaceUserService user,
            WorkspaceTaskReadService reads,
            CancelOperationsWorkspaceInvitationOperation invitationCancel,
            CreateOperationsWorkspaceInvitationOperation invitationCreate,
            ReissueOperationsWorkspaceInvitationOperation invitationReissue,
            BackendPerformanceM1CommandExecutionBindings m1Bindings) {
        this.sessions = sessions;
        this.invitations = invitations;
        this.user = user;
        this.reads = reads;
        this.invitationCancel = invitationCancel;
        this.invitationCreate = invitationCreate;
        this.invitationReissue = invitationReissue;
        this.m1Bindings = m1Bindings;
    }

    @GetMapping("/group/invitations")
    WorkspaceInvitationPage groupList(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String scopeRef,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) UUID organizationRef,
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) WorkspaceInvitationStatus status,
            @RequestParam(required = false) Long expiresFrom,
            @RequestParam(required = false) Long expiresTo,
            @RequestParam(required = false) WorkspaceInvitationSortKey sort,
            @RequestParam(required = false) SortDirection direction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam long expectedContextVersion) {
        return list(
                request,
                groupWorkspaceKey,
                ServiceNodeTypes.GROUP,
                scopeRef,
                mobile,
                organizationRef,
                roleId,
                status,
                expiresFrom,
                expiresTo,
                sort,
                direction,
                page,
                pageSize,
                expectedContextVersion);
    }

    @GetMapping("/region/invitations")
    WorkspaceInvitationPage regionList(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String scopeRef,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) UUID organizationRef,
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) WorkspaceInvitationStatus status,
            @RequestParam(required = false) Long expiresFrom,
            @RequestParam(required = false) Long expiresTo,
            @RequestParam(required = false) WorkspaceInvitationSortKey sort,
            @RequestParam(required = false) SortDirection direction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam long expectedContextVersion) {
        return list(
                request,
                groupWorkspaceKey,
                ServiceNodeTypes.REGION,
                scopeRef,
                mobile,
                organizationRef,
                roleId,
                status,
                expiresFrom,
                expiresTo,
                sort,
                direction,
                page,
                pageSize,
                expectedContextVersion);
    }

    @GetMapping("/project/invitations")
    WorkspaceInvitationPage projectList(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String scopeRef,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) UUID organizationRef,
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) WorkspaceInvitationStatus status,
            @RequestParam(required = false) Long expiresFrom,
            @RequestParam(required = false) Long expiresTo,
            @RequestParam(required = false) WorkspaceInvitationSortKey sort,
            @RequestParam(required = false) SortDirection direction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam long expectedContextVersion) {
        return list(
                request,
                groupWorkspaceKey,
                ServiceNodeTypes.PROJECT,
                scopeRef,
                mobile,
                organizationRef,
                roleId,
                status,
                expiresFrom,
                expiresTo,
                sort,
                direction,
                page,
                pageSize,
                expectedContextVersion);
    }

    @GetMapping("/head-company/invitations")
    WorkspaceInvitationPage headCompanyList(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String scopeRef,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) UUID organizationRef,
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) WorkspaceInvitationStatus status,
            @RequestParam(required = false) Long expiresFrom,
            @RequestParam(required = false) Long expiresTo,
            @RequestParam(required = false) WorkspaceInvitationSortKey sort,
            @RequestParam(required = false) SortDirection direction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam long expectedContextVersion) {
        return list(
                request,
                groupWorkspaceKey,
                ServiceNodeTypes.HEAD_COMPANY,
                scopeRef,
                mobile,
                organizationRef,
                roleId,
                status,
                expiresFrom,
                expiresTo,
                sort,
                direction,
                page,
                pageSize,
                expectedContextVersion);
    }

    @GetMapping("/store/invitations")
    WorkspaceInvitationPage storeList(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String scopeRef,
            @RequestParam(required = false) String mobile,
            @RequestParam(required = false) UUID organizationRef,
            @RequestParam(required = false) UUID roleId,
            @RequestParam(required = false) WorkspaceInvitationStatus status,
            @RequestParam(required = false) Long expiresFrom,
            @RequestParam(required = false) Long expiresTo,
            @RequestParam(required = false) WorkspaceInvitationSortKey sort,
            @RequestParam(required = false) SortDirection direction,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam long expectedContextVersion) {
        return list(
                request,
                groupWorkspaceKey,
                ServiceNodeTypes.STORE,
                scopeRef,
                mobile,
                organizationRef,
                roleId,
                status,
                expiresFrom,
                expiresTo,
                sort,
                direction,
                page,
                pageSize,
                expectedContextVersion);
    }

    @PostMapping("/group/invitations")
    ResponseEntity<WorkspaceInvitation> groupCreate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationCreateRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(WorkspaceInvitationWireMapper.wire(m1Bindings.bindCreateOperationsWorkspaceGroupInvitation(
                        facts, body, sessions.actor(facts.sessionReadback()))));
    }

    @PostMapping("/region/invitations")
    ResponseEntity<WorkspaceInvitation> regionCreate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationCreateRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(WorkspaceInvitationWireMapper.wire(m1Bindings.bindCreateOperationsWorkspaceRegionInvitation(
                        facts, body, sessions.actor(facts.sessionReadback()))));
    }

    @PostMapping("/project/invitations")
    ResponseEntity<WorkspaceInvitation> projectCreate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationCreateRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(WorkspaceInvitationWireMapper.wire(m1Bindings.bindCreateOperationsWorkspaceProjectInvitation(
                        facts, body, sessions.actor(facts.sessionReadback()))));
    }

    @PostMapping("/head-company/invitations")
    ResponseEntity<WorkspaceInvitation> headCompanyCreate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationCreateRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(WorkspaceInvitationWireMapper.wire(m1Bindings.bindCreateOperationsWorkspaceHeadCompanyInvitation(
                        facts, body, sessions.actor(facts.sessionReadback()))));
    }

    @PostMapping("/store/invitations")
    ResponseEntity<WorkspaceInvitation> storeCreate(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationCreateRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(WorkspaceInvitationWireMapper.wire(m1Bindings.bindCreateOperationsWorkspaceStoreInvitation(
                        facts, body, sessions.actor(facts.sessionReadback()))));
    }

    @PostMapping("/group/invitations/{invitationId}/cancel")
    WorkspaceInvitation groupCancel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindCancelOperationsWorkspaceGroupInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/region/invitations/{invitationId}/cancel")
    WorkspaceInvitation regionCancel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindCancelOperationsWorkspaceRegionInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/project/invitations/{invitationId}/cancel")
    WorkspaceInvitation projectCancel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindCancelOperationsWorkspaceProjectInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/head-company/invitations/{invitationId}/cancel")
    WorkspaceInvitation headCompanyCancel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindCancelOperationsWorkspaceHeadCompanyInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/store/invitations/{invitationId}/cancel")
    WorkspaceInvitation storeCancel(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindCancelOperationsWorkspaceStoreInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/group/invitations/{invitationId}/reissue")
    WorkspaceInvitation groupReissue(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindReissueOperationsWorkspaceGroupInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/region/invitations/{invitationId}/reissue")
    WorkspaceInvitation regionReissue(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindReissueOperationsWorkspaceRegionInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/project/invitations/{invitationId}/reissue")
    WorkspaceInvitation projectReissue(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindReissueOperationsWorkspaceProjectInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/head-company/invitations/{invitationId}/reissue")
    WorkspaceInvitation headCompanyReissue(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindReissueOperationsWorkspaceHeadCompanyInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    @PostMapping("/store/invitations/{invitationId}/reissue")
    WorkspaceInvitation storeReissue(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID invitationId,
            @RequestHeader("Idempotency-Key") String headerKey,
            @RequestBody WorkspaceOperationsInvitationActionRequest body) {
        matchingKey(headerKey, body.idempotencyKey());
        var facts = commandFacts(request, groupWorkspaceKey, body);
        return WorkspaceInvitationWireMapper.wire(m1Bindings.bindReissueOperationsWorkspaceStoreInvitation(
                facts, invitationId, body, sessions.actor(facts.sessionReadback())));
    }

    private WorkspaceInvitationPage list(
            EdgeRequestContext request,
            String groupWorkspaceKey,
            String expectedTargetType,
            String scopeRef,
            String mobile,
            UUID organizationRef,
            UUID roleId,
            WorkspaceInvitationStatus status,
            Long expiresFrom,
            Long expiresTo,
            WorkspaceInvitationSortKey sort,
            SortDirection direction,
            int page,
            int pageSize,
            long expectedContextVersion) {
        var session = readSession(request, groupWorkspaceKey, expectedContextVersion);
        return WorkspaceInvitationPageWireMapper.page(reads.invitations(
                session,
                expectedTargetType,
                optionalUuid(scopeRef),
                pageRequest(
                        mobile,
                        expectedTargetType,
                        organizationRef,
                        roleId,
                        status,
                        expiresFrom,
                        expiresTo,
                        sort,
                        direction,
                        page,
                        pageSize)));
    }

    private com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationFacts commandFacts(
            EdgeRequestContext request, String groupWorkspaceKey, WorkspaceOperationsInvitationActionRequest body) {
        var facts = sessions.requireWorkspaceCommandFacts(request, groupWorkspaceKey);
        if (facts.sessionReadback().contextVersion() != required(body.expectedContextVersion()))
            throw new WorkspaceAuthenticationService.SessionConflictException();
        required(body.expectedVersion());
        return facts;
    }

    private com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback readSession(
            EdgeRequestContext request, String key, long expectedContextVersion) {
        return sessions.requireWorkspaceReadAtContextVersion(request, key, expectedContextVersion);
    }

    private static List<WorkspaceInvitationService.AssignmentIntent> intents(
            List<String> roleIds, String type, UUID target) {
        if (roleIds == null || roleIds.isEmpty())
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("role ids are required");
        return roleIds.stream()
                .map(OperationsWorkspaceInvitationController::uuid)
                .map(role -> new WorkspaceInvitationService.AssignmentIntent(role, type, target))
                .toList();
    }

    private static UUID uuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (RuntimeException exception) {
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("identifier is invalid", exception);
        }
    }

    private static UUID optionalUuid(String value) {
        return value == null || value.isBlank() ? null : uuid(value);
    }

    private static WorkspaceInvitationService.ManagementInvitationPageRequest pageRequest(
            String mobile,
            String targetOrganizationType,
            UUID organizationRef,
            UUID roleId,
            WorkspaceInvitationStatus status,
            Long expiresFrom,
            Long expiresTo,
            WorkspaceInvitationSortKey sort,
            SortDirection direction,
            int page,
            int pageSize) {
        return new WorkspaceInvitationService.ManagementInvitationPageRequest(
                mobile,
                targetOrganizationType,
                organizationRef,
                roleId,
                status == null ? null : status.name(),
                expiresFrom,
                expiresTo,
                sort == null ? WorkspaceInvitationSortKey.CREATED_AT.name() : sort.name(),
                direction == null ? SortDirection.DESC.name() : direction.name(),
                page,
                pageSize);
    }

    private static long required(Long value) {
        if (value == null)
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("expected version is required");
        return value;
    }

    private static void matchingKey(String header, String body) {
        if (header == null || body == null || !header.equals(body) || header.length() < 16 || header.length() > 128)
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key");
    }
}
