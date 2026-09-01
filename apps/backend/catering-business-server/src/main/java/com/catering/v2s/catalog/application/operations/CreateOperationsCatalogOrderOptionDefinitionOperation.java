package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogInventoryWireEnums;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogOrderOptionDefinitionReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for a reusable ordering-option definition create. */
@Component
public class CreateOperationsCatalogOrderOptionDefinitionOperation {
    public static final String OPERATION_ID = "createOperationsCatalogOrderOptionDefinition";
    static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator coordinator;

    public CreateOperationsCatalogOrderOptionDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogInventoryCoordinator coordinator) {
        this.contexts = contexts;
        this.coordinator = coordinator;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogOrderOptionDefinitionReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_ORDER_OPTION_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return response(
                context.requestId(),
                coordinator.createOrderOptionDefinition(
                        context,
                        new CatalogOwnerApi.OrderOptionDefinitionCreateCommand(
                                request.code(), request.name(), request.selectionMode(), values(request.values())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogOrderOptionDefinitionCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    static List<CatalogOwnerApi.OrderOptionValueCommand> values(
            List<CatalogOrderOptionDefinitionCreateRequest.ValuesItem> values) {
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

    static List<CatalogOwnerApi.OrderOptionMaterialTemplate> materials(
            List<CatalogOrderOptionDefinitionCreateRequest.ValuesItem.MaterialsItem> values) {
        if (values == null) return List.of();
        return values.stream()
                // StockTarget is resolved by inventory at library definition save, not by the edge.
                .map(value -> new CatalogOwnerApi.OrderOptionMaterialTemplate(value.materialItemRef(), null, null))
                .toList();
    }

    static CatalogOrderOptionDefinitionReadback response(
            String requestId, CatalogOwnerApi.OrderOptionDefinitionReadback value) {
        return new CatalogOrderOptionDefinitionReadback(
                REVISION,
                requestId,
                new CatalogOrderOptionDefinitionReadback.Result(definition(value), List.of()),
                value.version());
    }

    static CatalogOrderOptionDefinitionReadback.Result.Definition definition(
            CatalogOwnerApi.OrderOptionDefinitionReadback value) {
        return new CatalogOrderOptionDefinitionReadback.Result.Definition(
                value.definitionRef(),
                value.code(),
                value.name(),
                CatalogInventoryWireEnums.DictionaryEntryStatus.valueOf(value.status()),
                value.selectionMode(),
                value.values().stream()
                        .map(option -> new CatalogOrderOptionDefinitionReadback.Result.Definition.ValuesItem(
                                option.valueRef(),
                                option.code(),
                                option.name(),
                                (long) option.displayOrder(),
                                option.materials().stream()
                                        .map(material ->
                                                new CatalogOrderOptionDefinitionReadback.Result.Definition.ValuesItem
                                                        .MaterialsItem(
                                                        material.materialRef(),
                                                        material.materialItemRef(),
                                                        material.materialItemName(),
                                                        material.stockTargetRef(),
                                                        consumptionUnitSnapshot(material.consumptionUnitSnapshot())))
                                        .toList()))
                        .toList(),
                value.version());
    }

    private static CatalogOrderOptionDefinitionReadback.Result.Definition.ValuesItem.MaterialsItem
                    .ConsumptionUnitSnapshot
            consumptionUnitSnapshot(com.catering.v2s.inventory.api.InventoryOwnerApi.UnitSnapshot value) {
        return value == null
                ? null
                : new CatalogOrderOptionDefinitionReadback.Result.Definition.ValuesItem.MaterialsItem
                        .ConsumptionUnitSnapshot(
                        value.unitRef(), value.code(), value.name(), value.unitDimension(), (long) value.precision());
    }
}
