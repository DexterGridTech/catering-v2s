package com.catering.v2s.app.edge.platform.workspace;

import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceCreateRequest;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceCreateResult;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceDetail;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceDetailCommercialGroup;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceDetailCommercialGroupRoot;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceDisplayUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspacePage;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspacePageItemsItem;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspacePageItemsItemCommercialGroup;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceSortKey;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatus;
import com.catering.v2s.app.edge.generated.wire.GroupWorkspaceStatusTransitionRequest;
import com.catering.v2s.app.edge.generated.wire.SortDirection;
import com.catering.v2s.app.edge.platform.session.PlatformSessionResolver;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.platform.access.PlatformExecutionContext;
import com.catering.v2s.platform.iam.api.PlatformSessionReadback;
import com.catering.v2s.platform.workspace.api.GroupWorkspaceTaskQuery;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationPageRequest;
import com.catering.v2s.platform.workspace.api.WorkspaceAdministrationReadback;
import com.catering.v2s.platform.workspace.application.PlatformWorkspaceAdministrationTaskReadService;
import com.catering.v2s.platform.workspace.application.WorkspaceAdministrationService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import java.time.Instant;
import java.util.Map;
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

/** The platform-workspace edge owns generated-wire adaptation only; facts remain owner readbacks. */
@RestController
@RequestMapping("/api/platform/group-workspaces")
public final class PlatformWorkspaceAdministrationController {
    private static final tools.jackson.databind.ObjectMapper JSON = new tools.jackson.databind.ObjectMapper();
    private final PlatformSessionResolver sessions;
    private final WorkspaceAdministrationService workspaces;
    private final GroupWorkspaceTaskQuery initializationFacts;
    private final PlatformAssetService assets;
    private final PlatformWorkspaceAdministrationTaskReadService taskReads;

    public PlatformWorkspaceAdministrationController(PlatformSessionResolver sessions, WorkspaceAdministrationService workspaces, GroupWorkspaceTaskQuery initializationFacts, PlatformAssetService assets, PlatformWorkspaceAdministrationTaskReadService taskReads) {
        this.sessions = sessions;
        this.workspaces = workspaces;
        this.initializationFacts = initializationFacts;
        this.assets = assets;
        this.taskReads = taskReads;
    }

    @GetMapping
    GroupWorkspacePage list(
        EdgeRequestContext request,
        @RequestParam(required = false) String name,
        @RequestParam(required = false) String groupWorkspaceKey,
        @RequestParam(required = false) String operationsTitle,
        @RequestParam(required = false) GroupWorkspaceStatus status,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "50") int pageSize,
        @RequestParam(defaultValue = "NAME") GroupWorkspaceSortKey sortKey,
        @RequestParam(defaultValue = "ASC") SortDirection sortDirection
    ) {
        sessions.requireRead(request);
        var readback = taskReads.page(ownerPage(name, groupWorkspaceKey, operationsTitle, status, page, pageSize, sortKey, sortDirection));
        var ownerPage = readback.workspacePage();
        var items = ownerPage.items().stream().map(value -> listItem(value, readback.initializationFacts(), readback.logoReferences())).toList();
        return new GroupWorkspacePage(items, ownerPage.page(), ownerPage.pageSize(), ownerPage.total(), sortKey, sortDirection);
    }

    @PostMapping
    ResponseEntity<GroupWorkspaceCreateResult> create(
        EdgeRequestContext request,
        @RequestHeader("Idempotency-Key") String headerIdempotencyKey,
        @RequestBody GroupWorkspaceCreateRequest body
    ) {
        PlatformSessionReadback session = sessions.require(request);
        requireMatchingKey(headerIdempotencyKey, body.idempotencyKey());
        WorkspaceAdministrationReadback created = workspaces.create(body.groupWorkspaceKey(), body.name(), body.operationsTitle(), body.logoAssetRef(), body.logoBindGrant(), body.notes(), body.idempotencyKey(), sessions.actor(session));
        return ResponseEntity.status(HttpStatus.CREATED).body(toCreateResult(created));
    }

    @GetMapping("/{groupWorkspaceKey}")
    GroupWorkspaceDetail detail(EdgeRequestContext request, @PathVariable String groupWorkspaceKey) {
        sessions.requireRead(request);
        return toDetail(taskReads.detail(groupWorkspaceKey));
    }

    @PatchMapping("/{groupWorkspaceKey}")
    GroupWorkspaceDetail update(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestHeader("Idempotency-Key") String headerIdempotencyKey,
        @RequestBody GroupWorkspaceDisplayUpdateRequest body
    ) {
        PlatformSessionReadback session = sessions.require(request);
        PlatformExecutionContext context = context(session, request);
        requireMatchingKey(headerIdempotencyKey, body.idempotencyKey());
        if (body.expectedVersion() == null) throw new InvalidEdgeRequestException("expected version is required");
        return toLegacyDetail(context, workspaces.updateDisplay(groupWorkspaceKey, body.name(), body.operationsTitle(), body.notes(), body.logoIntent(), body.logoAssetRef(), body.logoBindGrant(), body.expectedVersion(), body.idempotencyKey(), sessions.actor(session)));
    }

    @PostMapping("/{groupWorkspaceKey}/status")
    GroupWorkspaceDetail status(
        EdgeRequestContext request,
        @PathVariable String groupWorkspaceKey,
        @RequestHeader("Idempotency-Key") String headerIdempotencyKey,
        @RequestBody GroupWorkspaceStatusTransitionRequest body
    ) {
        PlatformSessionReadback session = sessions.require(request);
        PlatformExecutionContext context = context(session, request);
        requireMatchingKey(headerIdempotencyKey, body.idempotencyKey());
        if (body.targetStatus() == null || body.expectedVersion() == null) throw new InvalidEdgeRequestException("status and expected version are required");
        return toLegacyDetail(context, workspaces.transitionStatus(groupWorkspaceKey, body.targetStatus().wire(), body.expectedVersion(), body.idempotencyKey(), sessions.actor(session)));
    }

    private GroupWorkspaceDetail toLegacyDetail(PlatformExecutionContext context, WorkspaceAdministrationReadback value) {
        var legacy = initializationFacts.detail(context, value.groupWorkspaceKey()).orElse(null);
        GroupWorkspaceDetailCommercialGroupRoot root = legacy == null || legacy.commercialGroup() == null ? null : new GroupWorkspaceDetailCommercialGroupRoot(String.valueOf(legacy.commercialGroup().id()), value.groupWorkspaceKey(), legacy.commercialGroup().commercialGroupCode(), legacy.commercialGroup().commercialGroupName(), legacy.commercialGroup().version(), legacy.commercialGroup().createdAtEpochMillis(), legacy.commercialGroup().createdAtEpochMillis(), extensionValues(legacy.commercialGroup().extensionValuesJson()), legacy.commercialGroup().extensionRuleRevision());
        GroupWorkspaceDetailCommercialGroup commercialGroup = new GroupWorkspaceDetailCommercialGroup(root != null, root);
        return new GroupWorkspaceDetail(value.groupWorkspaceKey(), value.name(), value.operationsTitle(), nullableUuid(value.logoAssetRef()), logoUrl(value.logoAssetRef()), value.notes(), GroupWorkspaceStatus.valueOf(value.status()), value.statusChangedAtEpochMillis(), value.version(), value.createdAtEpochMillis(), value.updatedAtEpochMillis(), commercialGroup, "AVAILABLE", value.updatedAtEpochMillis(), null, "AVAILABLE", value.updatedAtEpochMillis(), null, "AVAILABLE", value.updatedAtEpochMillis(), null, workspaces.accountCount(value.workspaceUuid()), workspaces.roleCount(value.workspaceUuid()));
    }

    private GroupWorkspaceDetail toDetail(PlatformWorkspaceAdministrationTaskReadService.DetailReadback value) {
        var workspace = value.workspace();
        var commercial = value.commercialGroup().orElse(null);
        GroupWorkspaceDetailCommercialGroupRoot root = commercial == null ? null : new GroupWorkspaceDetailCommercialGroupRoot(String.valueOf(commercial.id()), workspace.groupWorkspaceKey(), commercial.commercialGroupCode(), commercial.commercialGroupName(), commercial.revision(), commercial.createdAtEpochMillis(), commercial.updatedAtEpochMillis(), JSON.valueToTree(commercial.extensionValues()), commercial.extensionRuleRevision());
        GroupWorkspaceDetailCommercialGroup commercialGroup = new GroupWorkspaceDetailCommercialGroup(root != null, root);
        String logoUrl = value.logoReference() == null ? null : value.logoReference().publicUrl();
        return new GroupWorkspaceDetail(workspace.groupWorkspaceKey(), workspace.name(), workspace.operationsTitle(), nullableUuid(workspace.logoAssetRef()), logoUrl, workspace.notes(), GroupWorkspaceStatus.valueOf(workspace.status()), workspace.statusChangedAtEpochMillis(), workspace.version(), workspace.createdAtEpochMillis(), workspace.updatedAtEpochMillis(), commercialGroup, "AVAILABLE", workspace.updatedAtEpochMillis(), null, "AVAILABLE", workspace.updatedAtEpochMillis(), null, "AVAILABLE", workspace.updatedAtEpochMillis(), null, value.accountAndRoleSummary().accountCount(), value.accountAndRoleSummary().roleCount());
    }

    private GroupWorkspacePageItemsItem listItem(WorkspaceAdministrationReadback value, java.util.Map<String, com.catering.v2s.organization.api.OrganizationGroupWorkspaceInitializationLookup.InitializationState> initialization, java.util.Map<UUID, PlatformAssetService.PublicAssetReference> logoUrls) {
        var initialized = initialization.get(value.groupWorkspaceKey());
        GroupWorkspacePageItemsItemCommercialGroup commercialGroup = new GroupWorkspacePageItemsItemCommercialGroup(initialized != null && initialized.commercialGroupInitialized(), null);
        String logoUrl = value.logoAssetRef() == null ? null : logoUrls.get(UUID.fromString(value.logoAssetRef())).publicUrl();
        return new GroupWorkspacePageItemsItem(value.groupWorkspaceKey(), value.name(), value.operationsTitle(), nullableUuid(value.logoAssetRef()), logoUrl, commercialGroup, GroupWorkspaceStatus.valueOf(value.status()), value.updatedAtEpochMillis());
    }

    private String logoUrl(String value) { return value == null ? null : assets.requireActivePublicReference(UUID.fromString(value)).publicUrl(); }
    private static tools.jackson.databind.JsonNode extensionValues(String values) { try { tools.jackson.databind.JsonNode value = JSON.readTree(values); if (!value.isObject()) throw new IllegalStateException("organization owner emitted invalid extension JSON"); return value; } catch (Exception exception) { throw new IllegalStateException("organization owner emitted invalid extension JSON", exception); } }
    private PlatformExecutionContext context(EdgeRequestContext request) { return context(sessions.requireRead(request).session(), request); }
    private PlatformExecutionContext context(PlatformSessionReadback session, EdgeRequestContext request) { return new PlatformExecutionContext(session.platformAdminId().toString(), "platform-admin", Instant.ofEpochMilli(session.expiresAtEpochMillis()), request.correlationId() == null ? "platform-session" : request.correlationId()); }
    private static WorkspaceAdministrationPageRequest ownerPage(String name, String groupWorkspaceKey, String operationsTitle, GroupWorkspaceStatus status, int page, int pageSize, GroupWorkspaceSortKey sortKey, SortDirection sortDirection) {
        try { return new WorkspaceAdministrationPageRequest(name, groupWorkspaceKey, operationsTitle, status == null ? null : status.wire(), page, pageSize, sortKey.name(), sortDirection.name()); }
        catch (IllegalArgumentException failure) { throw new InvalidEdgeRequestException("invalid workspace list request"); }
    }
    private static void requireMatchingKey(String header, String body) { if (header == null || body == null || !header.equals(body) || header.length() < 16 || header.length() > 128) throw new InvalidEdgeRequestException("invalid idempotency key"); }
    private static UUID uuid(String value) { try { return UUID.fromString(value); } catch (RuntimeException exception) { throw new InvalidEdgeRequestException("invalid asset ref"); } }
    private static UUID nullableUuid(String value) { return value == null ? null : uuid(value); }
    private static GroupWorkspaceCreateResult toCreateResult(WorkspaceAdministrationReadback value) { return new GroupWorkspaceCreateResult(value.groupWorkspaceKey(), value.name(), value.operationsTitle(), nullableUuid(value.logoAssetRef()), value.notes(), GroupWorkspaceStatus.valueOf(value.status()), value.statusChangedAtEpochMillis(), value.version(), value.createdAtEpochMillis(), value.updatedAtEpochMillis()); }
}
