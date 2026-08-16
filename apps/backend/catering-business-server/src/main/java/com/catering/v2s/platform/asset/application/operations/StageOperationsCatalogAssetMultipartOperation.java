package com.catering.v2s.platform.asset.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogAssetStageRequest;
import com.catering.v2s.app.edge.generated.wire.StagedCatalogAsset;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;

/** One-operation M1 composition entry for catalog multipart asset staging. */
@Component
public class StageOperationsCatalogAssetMultipartOperation {
    public static final String OPERATION_ID = "stageOperationsCatalogAsset";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String TEST_FAULTS_ENV = "V2S_CATALOG_TEST_FAULTS";
    private final CommandExecutionContextResolver contexts;
    private final CatalogAssetCommandApi assets;

    public StageOperationsCatalogAssetMultipartOperation(
            CommandExecutionContextResolver contexts, CatalogAssetCommandApi assets) {
        this.contexts = contexts;
        this.assets = assets;
    }

    public StagedCatalogAsset execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.STAGE_OPERATIONS_CATALOG_ASSET,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        CatalogAssetStageRequest request = invocation.request();
        if ("asset-processing".equals(invocation.testFailurePoint())
                && "true".equalsIgnoreCase(System.getenv(TEST_FAULTS_ENV))) {
            throw new CatalogOwnerApi.Problem("ASSET_PROCESSING_FAILED", 422, "资产处理失败");
        }
        CatalogAssetCommandApi.StageReadback readback = assets.stageCatalogAsset(
                context,
                new CatalogAssetCommandApi.StageCommand(
                        request.fileName(),
                        request.mediaType(),
                        request.contentDigest(),
                        invocation.contentLength(),
                        request.content(),
                        invocation.idempotencyKey()));
        return new StagedCatalogAsset(
                REVISION,
                context.requestId(),
                new StagedCatalogAsset.Result(
                        readback.assetRef(),
                        readback.bindGrant(),
                        readback.status(),
                        readback.mediaType(),
                        readback.contentDigest(),
                        null,
                        readback.version()),
                readback.version());
    }

    public record Invocation(
            CatalogAssetStageRequest request,
            long contentLength,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String testFailurePoint,
            String idempotencyKey) {}
}
