package com.catering.v2s.app.edge.operations.salesmenu;

import com.catering.v2s.app.edge.generated.backendperformancem1.BackendPerformanceM1CommandExecutionBindings;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetReleaseRequest;
import com.catering.v2s.app.edge.generated.wire.SalesMenuAssetStageReadback;
import com.catering.v2s.app.edge.problem.InvalidEdgeRequestException;
import com.catering.v2s.app.edge.session.EdgeRequestContext;
import com.catering.v2s.salesmenu.api.SalesMenuAssetCommandApi;
import com.catering.v2s.salesmenu.api.SalesMenuOwnerApi;
import com.catering.v2s.salesmenu.domain.SalesMenuAssetTargetMode;
import com.catering.v2s.salesmenu.domain.SalesMenuScope;
import com.catering.v2s.workspace.iam.api.WorkspaceSessionReadback;
import java.io.IOException;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Operations-admin edge for sales-menu image lifecycle commands. */
@RestController
@RequestMapping("/api/operations/group-workspaces/{groupWorkspaceKey}/stores/{storeRef}/sales-menus")
public final class OperationsSalesMenuAssetController {
    private static final String REQ_RELEASE = "REQ_RELEASE_OPERATIONS_SALES_MENU_STAGED_ASSET";
    private static final String REQ_STAGE = "REQ_STAGE_OPERATIONS_SALES_MENU_ASSET";

    private final SalesMenuEdgeSupport support;
    private final SalesMenuOwnerApi salesMenus;
    private final BackendPerformanceM1CommandExecutionBindings commandBindings;

    public OperationsSalesMenuAssetController(
            SalesMenuEdgeSupport support,
            SalesMenuOwnerApi salesMenus,
            BackendPerformanceM1CommandExecutionBindings commandBindings) {
        this.support = support;
        this.salesMenus = salesMenus;
        this.commandBindings = commandBindings;
    }

    @PostMapping(
            value = "/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<SalesMenuAssetStageReadback> stage(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @RequestPart("content") MultipartFile content,
            @RequestParam("expectedDraftVersion") Long expectedDraftVersion,
            @RequestParam("fileName") String fileName,
            @RequestParam("mediaType") String mediaType,
            @RequestParam("contentDigest") String contentDigest,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        if (content == null) {
            throw new SalesMenuOwnerApi.Problem("SALES_MENU_ASSET_INVALID", 422, "图片内容不能为空");
        }
        WorkspaceSessionReadback session = support.commandSession(request, groupWorkspaceKey);
        SalesMenuScope scope = support.scope(session, groupWorkspaceKey, storeRef);
        var target = support.assetTarget(
                scope, salesMenuRef, salesItemRef, support.expected(expectedDraftVersion, "expectedDraftVersion"));
        var grant = support.grant(session, REQ_STAGE, storeRef);
        var judged = salesMenus.requireSalesMenuItemAssetTarget(
                SalesMenuAssetTargetMode.STAGE, target, grant, session.contextVersion());
        String normalizedFileName = support.boundedText(fileName, "fileName", 240);
        String normalizedMediaType = support.boundedText(mediaType, "mediaType", 120);
        String normalizedDigest = support.boundedText(contentDigest, "contentDigest", 128);
        try (var stream = content.getInputStream()) {
            var readback = commandBindings.bindStageOperationsSalesMenuAsset(new SalesMenuAssetCommandApi.StageCommand(
                    judged.target(),
                    grant,
                    session.contextVersion(),
                    normalizedFileName,
                    normalizedMediaType,
                    normalizedDigest,
                    content.getSize(),
                    stream,
                    support.idempotencyKey(idempotencyKey)));
            return ResponseEntity.status(201).body(SalesMenuWireMapper.assetStage(readback));
        } catch (IOException failure) {
            throw new SalesMenuOwnerApi.Problem("RESULT_UNKNOWN", 500, "asset content could not be read", failure);
        }
    }

    @PostMapping("/{salesMenuRef}/draft/items/{salesItemRef}/assets/stage/{assetRef}/release")
    SalesMenuAssetReleaseReadback release(
            EdgeRequestContext request,
            @PathVariable String groupWorkspaceKey,
            @PathVariable UUID storeRef,
            @PathVariable UUID salesMenuRef,
            @PathVariable UUID salesItemRef,
            @PathVariable UUID assetRef,
            @RequestBody SalesMenuAssetReleaseRequest body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        if (body == null) throw new InvalidEdgeRequestException("request body is required");
        WorkspaceSessionReadback session = support.commandSession(request, groupWorkspaceKey);
        SalesMenuScope scope = support.scope(session, groupWorkspaceKey, storeRef);
        // The release body exposes only the asset lifecycle CAS. The draft version is an owner-local target fact and
        // is resolved by the asset owner from its staged target row; zero is never used for STAGE or CLAIM.
        var target = support.assetTarget(scope, salesMenuRef, salesItemRef, 0L);
        var grant = support.grant(session, REQ_RELEASE, storeRef);
        var judged = salesMenus.requireSalesMenuItemAssetTarget(
                SalesMenuAssetTargetMode.RELEASE_STAGED, target, grant, session.contextVersion());
        try {
            var readback = commandBindings.bindReleaseOperationsSalesMenuStagedAsset(
                    new SalesMenuAssetCommandApi.ReleaseCommand(
                            judged.target(),
                            grant,
                            session.contextVersion(),
                            assetRef,
                            support.expected(body.expectedAssetVersion(), "expectedAssetVersion"),
                            support.idempotencyKey(idempotencyKey)));
            return SalesMenuWireMapper.assetRelease(readback);
        } catch (SalesMenuAssetCommandApi.AssetTargetRejectedException failure) {
            String message = "图片资源目标不属于销售菜单商品";
            throw new SalesMenuOwnerApi.Problem("SALES_MENU_ASSET_TARGET_MISMATCH", 403, message, failure);
        } catch (SalesMenuAssetCommandApi.AssetClaimRejectedException failure) {
            String message = "图片状态已变化，请刷新后重试";
            throw new SalesMenuOwnerApi.Problem("SALES_MENU_ASSET_LIFECYCLE_CONFLICT", 409, message, failure);
        }
    }
}
