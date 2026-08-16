package com.catering.v2s.app.edge.platform.workspaceiam;

import com.catering.v2s.app.edge.generated.wire.ServiceNodeType;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRole;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleCreateRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRolePage;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRolePageCapabilityCatalogItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRolePagePageAccessCatalogItem;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleSortKey;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleStatus;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.WorkspaceRoleUpdateRequest;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.workspace.iam.api.WorkspaceAuthorizationCatalog;
import com.catering.v2s.workspace.iam.api.WorkspaceRoleReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceRoleService;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/platform/group-workspaces/{groupWorkspaceKey}/roles")
public final class PlatformWorkspaceRoleController {
    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final WorkspaceRoleService roles;

    public PlatformWorkspaceRoleController(
            PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, WorkspaceRoleService roles) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.roles = roles;
    }

    @GetMapping
    WorkspaceRolePage list(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) ServiceNodeType organizationType,
            @RequestParam(required = false) WorkspaceRoleStatus status,
            @RequestParam(required = false) Long page,
            @RequestParam(required = false) Long pageSize,
            @RequestParam(defaultValue = "NAME") WorkspaceRoleSortKey sort,
            @RequestParam(defaultValue = "ASC") SortDirection direction) {
        var workspace = workspace(request, groupWorkspaceKey);
        var result = roles.platformTaskPage(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                name,
                organizationType == null ? null : organizationType.name(),
                status == null ? null : status.name(),
                page == null ? 1 : Math.toIntExact(page),
                pageSize == null ? 100 : Math.toIntExact(pageSize),
                sort.name(),
                direction.name());
        return new WorkspaceRolePage(
                result.items().stream()
                        .map(PlatformWorkspaceRoleController::wire)
                        .toList(),
                (long) result.page(),
                (long) result.pageSize(),
                result.total(),
                WorkspaceAuthorizationCatalog.capabilityCatalog().stream()
                        .map(PlatformWorkspaceRoleController::capabilityCatalogWire)
                        .toList(),
                WorkspaceAuthorizationCatalog.managedPageCatalog().stream()
                        .map(PlatformWorkspaceRoleController::pageAccessCatalogWire)
                        .toList());
    }

    @PostMapping
    ResponseEntity<WorkspaceRole> create(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody WorkspaceRoleCreateRequest body) {
        requiredIdempotencyKey(idempotencyKey);
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(wire(roles.createForPlatform(
                        workspace.workspaceUuid(),
                        groupWorkspaceKey,
                        body.name(),
                        body.serviceNodeType(),
                        body.description(),
                        keys(body.pageAccessKeys()),
                        keys(body.capabilityKeys()),
                        idempotencyKey,
                        sessions.actor(session))));
    }

    @GetMapping("/{roleId}")
    WorkspaceRole detail(
            EdgeRequestContext request, @PathVariable String groupWorkspaceKey, @PathVariable UUID roleId) {
        var workspace = workspace(request, groupWorkspaceKey);
        return wire(roles.platformTaskDetail(workspace.workspaceUuid(), groupWorkspaceKey, roleId));
    }

    @PatchMapping("/{roleId}")
    WorkspaceRole update(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID roleId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody WorkspaceRoleUpdateRequest body) {
        requiredIdempotencyKey(idempotencyKey);
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        return wire(roles.updateForPlatform(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                roleId,
                body.expectedVersion(),
                body.name(),
                body.description(),
                keys(body.pageAccessKeys()),
                keys(body.capabilityKeys()),
                idempotencyKey,
                sessions.actor(session)));
    }

    @PostMapping("/{roleId}/status")
    WorkspaceRole status(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID roleId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody WorkspaceRoleStatusTransitionRequest body) {
        requiredIdempotencyKey(idempotencyKey);
        var session = sessions.require(request);
        var workspace = workspaces.requireEnabled(groupWorkspaceKey);
        return wire(roles.transitionStatusForPlatform(
                workspace.workspaceUuid(),
                groupWorkspaceKey,
                roleId,
                body.targetStatus().name(),
                body.expectedVersion(),
                idempotencyKey,
                sessions.actor(session)));
    }

    private PlatformSessionResolver.EnabledSelectedWorkspaceFact workspace(
            EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireRead(request).requireEnabledSelectedWorkspace(workspaces, groupWorkspaceKey);
    }

    private static Set<String> keys(List<String> values) {
        return values == null ? Set.of() : Set.copyOf(values);
    }

    private static WorkspaceRole wire(WorkspaceRoleReadback value) {
        return new WorkspaceRole(
                value.id().toString(),
                value.groupWorkspaceKey(),
                value.name(),
                value.description(),
                value.serviceNodeType(),
                value.actionCapabilityKeys().stream().sorted().toList(),
                value.pageAccessKeys().stream().sorted().toList(),
                WorkspaceRoleStatus.valueOf(value.status()),
                value.version(),
                value.createdAtEpochMillis(),
                value.updatedAtEpochMillis());
    }

    private static WorkspaceRolePageCapabilityCatalogItem capabilityCatalogWire(
            WorkspaceAuthorizationCatalog.CapabilityCatalogEntry value) {
        return new WorkspaceRolePageCapabilityCatalogItem(
                value.key(),
                value.actionGroupKey(),
                value.actionGroupLabel(),
                (long) value.actionGroupOrder(),
                value.label(),
                value.description(),
                value.organizationTypes());
    }

    private static WorkspaceRolePagePageAccessCatalogItem pageAccessCatalogWire(
            WorkspaceAuthorizationCatalog.PageAccessCatalogEntry value) {
        return new WorkspaceRolePagePageAccessCatalogItem(
                value.pageDesignKey(),
                value.title(),
                value.menuGroup(),
                (long) value.menuOrder(),
                value.requiredDataNodeType(),
                value.eligibleOrganizationTypes());
    }

    private static void requiredIdempotencyKey(String value) {
        if (value == null || value.length() < 16 || value.length() > 128)
            throw new com.catering.v2s.app.edge.problem.InvalidEdgeRequestException("invalid idempotency key");
    }
}
