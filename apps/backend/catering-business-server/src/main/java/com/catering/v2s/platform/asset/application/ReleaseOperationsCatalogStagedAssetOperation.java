package com.catering.v2s.platform.asset.application;

import com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAssetReleaseRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.asset.api.CatalogAssetReferenceLock;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for releasing an unreferenced catalog staged asset. */
@Component
public class ReleaseOperationsCatalogStagedAssetOperation {
    public static final String OPERATION_ID = "releaseOperationsCatalogStagedAsset";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogAssetReferenceLock locks;
    private final CatalogOwnerApi catalog;
    private final CatalogAssetCommandApi assets;

    public ReleaseOperationsCatalogStagedAssetOperation(CommandExecutionContextResolver contexts,
                                                        CatalogAssetReferenceLock locks, CatalogOwnerApi catalog,
                                                        CatalogAssetCommandApi assets) {
        this.contexts = contexts;
        this.locks = locks;
        this.catalog = catalog;
        this.assets = assets;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogAssetReleaseReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(invocation.sessionCredential(),
            CatalogInventoryWorkspaceCommandTokens.RELEASE_OPERATIONS_CATALOG_STAGED_ASSET, invocation.request().dataNodeRef().toString(),
            CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
            invocation.correlationId(), invocation.requestId());
        UUID assetRef = requiredUuid(invocation.assetRef());
        // Lifecycle correctness requires this exact order: lock -> catalog judgment -> asset receipt/mutation.
        locks.lockCatalogReference(assetRef);
        catalog.requireAssetUnreferencedAnywhere(assetRef);
        Long expectedVersion = invocation.request().expectedVersion();
        if (expectedVersion == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "expectedVersion is required");
        CatalogAssetCommandApi.ReleaseReadback readback = assets.releaseStagedCatalogAsset(context,
            new CatalogAssetCommandApi.ReleaseCommand(assetRef, expectedVersion, invocation.idempotencyKey()));
        return new CatalogAssetReleaseReadback(REVISION, context.requestId(),
            new CatalogAssetReleaseReadback.Result(readback.assetRef(), "RELEASED", readback.releasedAt(), readback.version()),
            readback.version());
    }

    public record Invocation(CatalogAssetReleaseRequest request, String assetRef, String sessionCredential,
                             String requestedBrandRef, String correlationId, String requestId, String idempotencyKey) { }

    private static UUID requiredUuid(String value) {
        try {
            if (value == null || value.isBlank()) throw new IllegalArgumentException();
            return UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "assetRef must be a UUID");
        }
    }
}
