package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionUpdateRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a reusable ordering-option definition update. */
@Component
public class UpdateOperationsCatalogOrderOptionDefinitionOperation {
    public static final String OPERATION_ID = "updateOperationsCatalogOrderOptionDefinition";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator coordinator;

    public UpdateOperationsCatalogOrderOptionDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogInventoryCoordinator coordinator) {
        this.contexts = contexts;
        this.coordinator = coordinator;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogOrderOptionDefinitionReadback execute(Invocation invocation) {
        if (invocation.request().definitionRef() == null
                || !CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.definitionRef(), "definitionRef")
                        .equals(invocation.request().definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        var result = coordinator.updateOrderOptionDefinition(
                context,
                new CatalogOwnerApi.OrderOptionDefinitionUpdateCommand(
                        CreateOperationsCatalogCategoryOperation.requiredUuid(
                                invocation.definitionRef(), "definitionRef"),
                        CreateOperationsCatalogCategoryOperation.requiredLong(
                                request.expectedVersion(), "expectedVersion"),
                        request.code(),
                        request.name(),
                        request.selectionMode(),
                        values(request.values())),
                invocation.idempotencyKey());
        return new CatalogOrderOptionDefinitionReadback(
                CreateOperationsCatalogOrderOptionDefinitionOperation.REVISION,
                context.requestId(),
                new CatalogOrderOptionDefinitionReadback.Result(
                        CreateOperationsCatalogOrderOptionDefinitionOperation.definition(result.definition()),
                        result.deletedDefinitionValueRefs()),
                result.definition().version());
    }

    public record Invocation(
            CatalogOrderOptionDefinitionUpdateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}

    private static List<CatalogOwnerApi.OrderOptionValueCommand> values(
            List<CatalogOrderOptionDefinitionUpdateRequest.ValuesItem> values) {
        if (values == null) return List.of();
        return values.stream()
                .map(value -> new CatalogOwnerApi.OrderOptionValueCommand(
                        value.valueRef(),
                        value.code(),
                        value.name(),
                        CreateOperationsCatalogAttributeDefinitionOperation.displayOrder(
                                value.displayOrder(), "values.displayOrder"),
                        materials(value.materials())))
                .toList();
    }

    private static List<CatalogOwnerApi.OrderOptionMaterialTemplate> materials(
            List<CatalogOrderOptionDefinitionUpdateRequest.ValuesItem.MaterialsItem> values) {
        if (values == null) return List.of();
        return values.stream()
                .map(value -> new CatalogOwnerApi.OrderOptionMaterialTemplate(value.materialItemRef(), null, null))
                .toList();
    }
}
