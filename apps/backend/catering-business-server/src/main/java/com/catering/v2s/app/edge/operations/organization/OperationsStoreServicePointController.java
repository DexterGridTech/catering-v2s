package com.catering.v2s.app.edge.operations.organization;

import com.catering.v2s.app.edge.extension.ExtensionSubmissionWireMapper;
import com.catering.v2s.app.edge.generated.wire.StoreQrChannelCandidate;
import com.catering.v2s.app.edge.generated.wire.StoreQrChannelCandidatePage;
import com.catering.v2s.app.edge.generated.wire.StoreQrConfigurationUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreQrConfigurationView;
import com.catering.v2s.app.edge.generated.wire.StoreServicePoint;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointArea;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaCreateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaOrderRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaPage;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaStatusRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaType;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAreaUpdateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetReleaseRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointAssetStageReadback;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointCreateRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointDetail;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointOrderDirection;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointOrderRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointPage;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointStatus;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointStatusRequest;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointType;
import com.catering.v2s.app.edge.generated.wire.StoreServicePointUpdateRequest;
import com.catering.v2s.app.edge.operations.session.OperationsSessionResolver;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.organization.api.QrChannelEligibilityLookup;
import com.catering.v2s.organization.api.StoreServicePointOwnerApi;
import com.catering.v2s.organization.application.BusinessEntityService;
import com.catering.v2s.organization.application.StoreServicePointService;
import com.catering.v2s.platform.asset.application.PlatformAssetService;
import com.catering.v2s.platform.foundation.contract.ServiceNodeTypes;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import com.catering.v2s.workspace.iam.application.WorkspaceCapabilityScopeResolver;
import com.catering.v2s.workspace.iam.application.WorkspaceCommandAuthorizationService;
import com.catering.v2s.workspace.iam.application.WorkspaceUserService;
import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Operations-admin edge for the store service-point and QR configuration surface. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}")
public class OperationsStoreServicePointController {
    private static final String CAPABILITY = "EDIT_STORE_SERVICE_POINT_QR";
    private static final String REQ_CREATE_AREA = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT_AREA";
    private static final String REQ_CREATE_POINT = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT";
    private static final String REQ_UPDATE_QR = "REQ_PATCH_OPERATIONS_STORE_QR_CONFIGURATION";
    private static final String REQ_UPDATE_POINT = "REQ_PATCH_OPERATIONS_STORE_SERVICE_POINT";
    private static final String REQ_UPDATE_AREA = "REQ_PATCH_OPERATIONS_STORE_SERVICE_POINT_AREA";
    private static final String REQ_AREA_STATUS = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT_AREA_STATUS";
    private static final String REQ_AREA_ORDER = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT_AREA_ORDER";
    private static final String REQ_POINT_STATUS = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT_STATUS";
    private static final String REQ_POINT_ORDER = "REQ_POST_OPERATIONS_STORE_SERVICE_POINT_ORDER";
    private static final String REQ_STAGE_ASSET = "REQ_STAGE_STORE_SERVICE_POINT_IMAGE";
    private static final String REQ_RELEASE_ASSET = "REQ_RELEASE_STAGED_STORE_SERVICE_POINT_IMAGE";
    private static final int PAGE_SIZE = 20;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final OperationsSessionResolver sessions;
    private final WorkspaceUserService user;
    private final WorkspaceCapabilityScopeResolver capabilityScopes;
    private final StoreServicePointOwnerApi owner;
    private final BusinessEntityService entities;
    private final PlatformAssetService assets;
    private final QrChannelEligibilityLookup channels;

    public OperationsStoreServicePointController(
            OperationsSessionResolver sessions,
            WorkspaceUserService user,
            WorkspaceCapabilityScopeResolver capabilityScopes,
            StoreServicePointOwnerApi owner,
            BusinessEntityService entities,
            PlatformAssetService assets,
            QrChannelEligibilityLookup channels) {
        this.sessions = sessions;
        this.user = user;
        this.capabilityScopes = capabilityScopes;
        this.owner = owner;
        this.entities = entities;
        this.assets = assets;
        this.channels = channels;
    }

    @GetMapping("/service-point-areas")
    @Transactional(readOnly = true)
    public StoreServicePointAreaPage listAreas(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return areaPage(owner.listAreas(session.workspaceUuid(), groupWorkspaceKey, storeRef, cursor, pageSize));
    }

    @PostMapping("/service-point-areas")
    public ResponseEntity<StoreServicePointArea> createArea(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointAreaCreateRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreServicePointAreaCreateRequest input = bodyRequired(body);
        OperationsOwnerScopeGrant grant = grant(session, REQ_CREATE_AREA, storeRef);
        var result = owner.createArea(new StoreServicePointOwnerApi.AreaCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, null, input.name(), input.code(),
                input.areaType().wire(), StoreServicePointStatus.ENABLED.wire(), null, idempotencyKey, sessions.actor(session), grant));
        return ResponseEntity.status(HttpStatus.CREATED).body(area(result));
    }

    @PatchMapping("/service-point-areas/{areaRef}")
    public StoreServicePointArea updateArea(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID areaRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointAreaUpdateRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        var value = owner.updateArea(new StoreServicePointOwnerApi.AreaCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, areaRef, bodyRequired(body).name(), body.code(),
                body.areaType().wire(), body.status().wire(), body.expectedVersion(), idempotencyKey, sessions.actor(session),
                grant(session, REQ_UPDATE_AREA, storeRef)));
        return area(value);
    }

    @PostMapping("/service-point-areas/{areaRef}/status")
    public StoreServicePointArea updateAreaStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID areaRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointAreaStatusRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        var value = owner.transitionArea(new StoreServicePointOwnerApi.StatusCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, areaRef, "AREA", bodyRequired(body).status().wire(),
                required(body.expectedVersion(), "expectedVersion"), idempotencyKey, sessions.actor(session),
                grant(session, REQ_AREA_STATUS, storeRef)));
        return area(value);
    }

    @PostMapping("/service-point-areas/{areaRef}/order")
    public StoreServicePointArea moveArea(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID areaRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointAreaOrderRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        var value = owner.moveArea(new StoreServicePointOwnerApi.OrderCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, areaRef, "AREA", bodyRequired(body).direction().wire(),
                required(body.expectedVersion(), "expectedVersion"), idempotencyKey, sessions.actor(session),
                grant(session, REQ_AREA_ORDER, storeRef)));
        return area(value);
    }

    @GetMapping("/service-point-areas/{areaRef}/service-points")
    @Transactional(readOnly = true)
    public StoreServicePointPage listPoints(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID areaRef,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false, defaultValue = "20") int pageSize) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return pointPage(owner.listPoints(session.workspaceUuid(), groupWorkspaceKey, storeRef, areaRef, cursor, pageSize));
    }

    @PostMapping("/service-point-areas/{areaRef}/service-points")
    public ResponseEntity<StoreServicePoint> createPoint(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID areaRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointCreateRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreServicePointCreateRequest input = bodyRequired(body);
        var result = owner.createPoint(new StoreServicePointOwnerApi.PointCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, null, areaRef, input.name(), input.code(),
                input.pointType().wire(), StoreServicePointStatus.ENABLED.wire(), longValue(input.seatCapacity()),
                textValue(input.tableShape()), booleanValue(input.reservable()), input.imageAssetRef(),
                textValue(input.imageBindGrant()), ExtensionSubmissionWireMapper.toSubmission(input.extensionValues()),
                longValue(input.extensionRuleRevision()),
                null, idempotencyKey, sessions.actor(session), grant(session, REQ_CREATE_POINT, storeRef)));
        return ResponseEntity.status(HttpStatus.CREATED).body(point(result));
    }

    @GetMapping("/service-points/{servicePointRef}")
    @Transactional(readOnly = true)
    public StoreServicePointDetail readPoint(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID servicePointRef) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return detail(owner.readPoint(session.workspaceUuid(), groupWorkspaceKey, storeRef, servicePointRef));
    }

    @PatchMapping("/service-points/{servicePointRef}")
    public StoreServicePoint updatePoint(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID servicePointRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointUpdateRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreServicePointUpdateRequest input = bodyRequired(body);
        var result = owner.updatePoint(new StoreServicePointOwnerApi.PointCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, servicePointRef, null, input.name(), input.code(),
                input.pointType().wire(), input.status().wire(), longValue(input.seatCapacity()), textValue(input.tableShape()),
                booleanValue(input.reservable()), input.imageAssetRef(), textValue(input.imageBindGrant()),
                ExtensionSubmissionWireMapper.toSubmission(input.extensionValues()), longValue(input.extensionRuleRevision()),
                required(input.expectedVersion(), "expectedVersion"),
                idempotencyKey, sessions.actor(session), grant(session, REQ_UPDATE_POINT, storeRef)));
        return point(result);
    }

    @PostMapping("/service-points/{servicePointRef}/status")
    public StoreServicePoint updatePointStatus(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID servicePointRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointStatusRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        var value = owner.transitionPoint(new StoreServicePointOwnerApi.StatusCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, servicePointRef, "POINT", bodyRequired(body).status().wire(),
                required(body.expectedVersion(), "expectedVersion"), idempotencyKey, sessions.actor(session),
                grant(session, REQ_POINT_STATUS, storeRef)));
        return point(value);
    }

    @PostMapping("/service-points/{servicePointRef}/order")
    public StoreServicePoint movePoint(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID servicePointRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreServicePointOrderRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        var value = owner.movePoint(new StoreServicePointOwnerApi.OrderCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, servicePointRef, "POINT", bodyRequired(body).direction().wire(),
                required(body.expectedVersion(), "expectedVersion"), idempotencyKey, sessions.actor(session),
                grant(session, REQ_POINT_ORDER, storeRef)));
        return point(value);
    }

    @GetMapping("/qr-configuration")
    @Transactional(readOnly = true)
    public StoreQrConfigurationView readQr(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        return qr(owner.readQrConfiguration(session.workspaceUuid(), groupWorkspaceKey, storeRef));
    }

    @PatchMapping("/qr-configuration")
    public StoreQrConfigurationView updateQr(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody StoreQrConfigurationUpdateRequest body) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        StoreQrConfigurationUpdateRequest input = bodyRequired(body);
        var value = owner.updateQrConfiguration(new StoreServicePointOwnerApi.QrConfigurationCommand(
                session.workspaceUuid(), groupWorkspaceKey, storeRef, Boolean.TRUE.equals(input.enabled()), input.channelRef(),
                required(input.expectedVersion(), "expectedVersion"), idempotencyKey, sessions.actor(session),
                grant(session, REQ_UPDATE_QR, storeRef)));
        return qr(value);
    }

    @GetMapping("/qr-channel-candidates")
    @Transactional(readOnly = true)
    public StoreQrChannelCandidatePage qrCandidates(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef) {
        WorkspaceSessionReadback session = readSession(request, groupWorkspaceKey, storeRef);
        List<QrChannelEligibilityLookup.Candidate> values = channels.listCandidates(
                session.workspaceUuid(), groupWorkspaceKey, storeRef);
        return new StoreQrChannelCandidatePage(values.stream().map(OperationsStoreServicePointController::candidate).toList(), null, (long) values.size());
    }

    @PostMapping(value = "/service-point-assets/stage", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<StoreServicePointAssetStageReadback> stageAsset(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @RequestPart("content") MultipartFile content,
            @RequestParam("fileName") String fileName,
            @RequestParam("mediaType") String mediaType,
            @RequestParam("contentDigest") String contentDigest,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        if (content == null) throw new InvalidEdgeRequestException("图片内容不能为空");
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        grant(session, REQ_STAGE_ASSET, storeRef);
        requireOperatingRule(session, groupWorkspaceKey, storeRef);
        bounded(fileName, "fileName", 240);
        String normalizedMediaType = bounded(mediaType, "mediaType", 120);
        String normalizedDigest = bounded(contentDigest, "contentDigest", 128);
        try (var stream = content.getInputStream()) {
            var staged = assets.stageStoreServicePointImage(
                    session.workspaceUuid(), groupWorkspaceKey, normalizedMediaType, content.getSize(), stream,
                    idempotencyKey, normalizedDigest);
            long version = assets.require(staged.assetRef()).version();
            return ResponseEntity.status(HttpStatus.CREATED).body(new StoreServicePointAssetStageReadback(
                    staged.assetRef(), staged.bindGrant(), "STAGED", version));
        } catch (IOException failure) {
            throw new InvalidEdgeRequestException("图片内容读取失败", failure);
        }
    }

    @PostMapping("/service-point-assets/stage/{assetRef}/release")
    public StoreServicePointAssetReleaseReadback releaseAsset(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID assetRef,
            @RequestBody StoreServicePointAssetReleaseRequest body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        WorkspaceSessionReadback session = commandSession(request, groupWorkspaceKey);
        grant(session, REQ_RELEASE_ASSET, storeRef);
        requireOperatingRule(session, groupWorkspaceKey, storeRef);
        StoreServicePointAssetReleaseRequest input = bodyRequired(body);
        var released = assets.releaseStagedStoreServicePointImage(
                session.workspaceUuid(), groupWorkspaceKey, assetRef, required(input.expectedAssetVersion(), "expectedAssetVersion"));
        return new StoreServicePointAssetReleaseReadback(released.assetRef(), "RELEASED", released.version());
    }

    private WorkspaceSessionReadback readSession(EdgeRequestContext request, String groupWorkspaceKey, UUID storeRef) {
        WorkspaceSessionReadback session = sessions.requireWorkspaceRead(request, groupWorkspaceKey);
        user.resolveTaskScope(session, ServiceNodeTypes.STORE, storeRef);
        return session;
    }

    private WorkspaceSessionReadback commandSession(EdgeRequestContext request, String groupWorkspaceKey) {
        return sessions.requireWorkspaceCommand(request, groupWorkspaceKey);
    }

    private OperationsOwnerScopeGrant grant(WorkspaceSessionReadback session, String requirementId, UUID storeRef) {
        var resolution = capabilityScopes.resolveGeneratedOperation(
                session,
                requirementId,
                CAPABILITY,
                new WorkspaceCapabilityScopeResolver.ServerResolvedResource(ServiceNodeTypes.STORE, storeRef));
        if (resolution.decision() != WorkspaceCapabilityScopeResolver.Decision.ALLOW)
            throw new WorkspaceCommandAuthorizationService.AuthorizationDeniedException();
        return resolution.ownerScopeGrant(requirementId);
    }

    private void requireOperatingRule(WorkspaceSessionReadback session, String groupWorkspaceKey, UUID storeRef) {
        entities.requireStoreOperatingRuleForStoreTarget(
                session.workspaceUuid(), groupWorkspaceKey, ServiceNodeTypes.STORE, storeRef, StoreServicePointService.OPERATING_RULE_KEY);
    }

    private static StoreServicePointAreaPage areaPage(StoreServicePointOwnerApi.AreaPage value) {
        return new StoreServicePointAreaPage(value.items().stream().map(OperationsStoreServicePointController::area).toList(),
                json(value.nextCursor()), value.total());
    }

    private static StoreServicePointPage pointPage(StoreServicePointOwnerApi.PointPage value) {
        return new StoreServicePointPage(value.items().stream().map(OperationsStoreServicePointController::point).toList(),
                json(value.nextCursor()), value.total());
    }

    private static StoreServicePointArea area(StoreServicePointOwnerApi.Area value) {
        return new StoreServicePointArea(
                value.areaRef(), value.storeRef(), value.name(), value.code(), enumValue(StoreServicePointAreaType.class, value.areaType()),
                enumValue(StoreServicePointStatus.class, value.status()), value.displayOrder(), value.version(), value.createdAt(),
                value.updatedAt(), value.canMoveUp(), value.canMoveDown());
    }

    private static StoreServicePoint point(StoreServicePointOwnerApi.Point value) {
        return new StoreServicePoint(
                value.pointRef(), value.storeRef(), value.areaRef(), value.name(), value.code(), enumValue(StoreServicePointType.class, value.pointType()),
                enumValue(StoreServicePointStatus.class, value.status()), value.displayOrder(), json(value.seatCapacity()), json(value.tableShape()),
                json(value.reservable()), value.imageAssetRef(), jsonNode(value.extensionValuesJson()), json(value.extensionRuleRevision()),
                value.effectiveAvailable(), json(value.qrUrl()), value.version(), value.createdAt(), value.updatedAt(), value.canMoveUp(), value.canMoveDown());
    }

    private static StoreServicePointDetail detail(StoreServicePointOwnerApi.Point value) {
        return new StoreServicePointDetail(
                value.pointRef(), value.storeRef(), value.areaRef(), value.name(), value.code(), enumValue(StoreServicePointType.class, value.pointType()),
                enumValue(StoreServicePointStatus.class, value.status()), value.displayOrder(), json(value.seatCapacity()), json(value.tableShape()),
                json(value.reservable()), value.imageAssetRef(), jsonNode(value.extensionValuesJson()), json(value.extensionRuleRevision()),
                value.effectiveAvailable(), json(value.qrUrl()), value.version(), value.createdAt(), value.updatedAt(), value.canMoveUp(), value.canMoveDown());
    }

    private static StoreQrConfigurationView qr(StoreServicePointOwnerApi.QrConfiguration value) {
        return new StoreQrConfigurationView(value.storeRef(), value.enabled(), value.channelRef(), json(value.channelName()), value.version(), value.updatedAt());
    }

    private static StoreQrChannelCandidate candidate(QrChannelEligibilityLookup.Candidate value) {
        return new StoreQrChannelCandidate(value.channelRef(), value.templateRef(), json(value.channelCode()), value.channelName(), value.templateName(),
                value.status(), value.bindingStatus(), json(value.urlRule()));
    }

    private static <E extends Enum<E>> E enumValue(Class<E> type, String value) {
        try {
            return Enum.valueOf(type, value);
        } catch (RuntimeException failure) {
            throw new IllegalStateException("owner returned unsupported enum value", failure);
        }
    }

    private static Long longValue(JsonNode value) {
        return value == null || value.isNull() ? null : value.longValue();
    }

    private static Boolean booleanValue(JsonNode value) {
        return value == null || value.isNull() ? null : value.booleanValue();
    }

    private static String textValue(JsonNode value) {
        return value == null || value.isNull() ? null : value.textValue();
    }

    private static String jsonText(JsonNode value) {
        return value == null || value.isNull() ? null : value.toString();
    }

    private static JsonNode jsonNode(String value) {
        if (value == null || value.isBlank()) return JSON.createObjectNode();
        try {
            return JSON.readTree(value);
        } catch (RuntimeException failure) {
            throw new IllegalStateException("owner returned invalid extension values", failure);
        }
    }

    private static JsonNode json(String value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static JsonNode json(Long value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static JsonNode json(Boolean value) {
        return value == null ? null : JSON.valueToTree(value);
    }

    private static long required(Long value, String field) {
        if (value == null) throw new InvalidEdgeRequestException(field + " is required");
        return value;
    }

    private static String bounded(String value, String field, int maxLength) {
        if (value == null || value.isBlank() || value.length() > maxLength)
            throw new InvalidEdgeRequestException(field + " is invalid");
        return value;
    }

    private static <T> T bodyRequired(T body) {
        if (body == null) throw new InvalidEdgeRequestException("request body is required");
        return body;
    }
}
