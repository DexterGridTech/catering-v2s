package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogItemSaveReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemSaveRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.asset.api.CatalogAssetCommandApi;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog save across catalog, inventory and asset owners. */
@Component
public class SaveOperationsCatalogItemOperation {
    public static final String OPERATION_ID = "saveOperationsCatalogItem";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator coordinator;
    private final tools.jackson.databind.ObjectMapper mapper;

    public SaveOperationsCatalogItemOperation(
            CommandExecutionContextResolver contexts,
            CatalogInventoryCoordinator coordinator,
            tools.jackson.databind.ObjectMapper mapper) {
        this.contexts = contexts;
        this.coordinator = coordinator;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogItemSaveReadback execute(Invocation invocation) {
        CatalogItemSaveRequest request = invocation.request();
        if (request == null || request.itemCode() == null || !request.itemCode().equals(invocation.itemCode())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "itemCode must match the save request");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.SAVE_OPERATIONS_CATALOG_ITEM,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        try {
            String canonicalRequestJson = mapper.writeValueAsString(request);
            CatalogOwnerApi.CatalogItemSaveReadback readback = coordinator.saveCatalogItem(
                    context,
                    new CatalogOwnerApi.CatalogItemSaveCommand(invocation.itemCode(), canonicalRequestJson),
                    invocation.assetBindings(),
                    invocation.idempotencyKey());
            return mapper.readValue(readback.canonicalJson(), CatalogItemSaveReadback.class);
        } catch (CatalogOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception failure) {
            throw new CatalogOwnerApi.Problem("RESULT_UNKNOWN", 500, "catalog save readback is invalid", failure);
        }
    }

    public record Invocation(
            CatalogItemSaveRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String itemCode,
            String idempotencyKey,
            List<CatalogAssetCommandApi.AssetBinding> assetBindings) {
        public Invocation {
            assetBindings = assetBindings == null ? List.of() : List.copyOf(assetBindings);
        }
    }
}
