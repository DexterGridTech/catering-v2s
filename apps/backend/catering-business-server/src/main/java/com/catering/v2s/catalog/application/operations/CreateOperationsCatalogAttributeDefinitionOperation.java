package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an operations attribute-library definition create. */
@Component
public class CreateOperationsCatalogAttributeDefinitionOperation {
    public static final String OPERATION_ID = "createOperationsCatalogAttributeDefinition";
    static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public CreateOperationsCatalogAttributeDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogAttributeDefinitionReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return response(
                context.requestId(),
                catalog.createAttributeDefinition(
                        context,
                        new CatalogOwnerApi.AttributeDefinitionCreateCommand(
                                request.code(), request.name(), request.valueType(), options(request.options())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogAttributeDefinitionCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    static List<CatalogOwnerApi.AttributeDefinitionOption> options(
            List<CatalogAttributeDefinitionCreateRequest.OptionsItem> values) {
        if (values == null) return List.of();
        return values.stream()
                .map(value -> new CatalogOwnerApi.AttributeDefinitionOption(
                        value.optionRef(), value.name(), displayOrder(value.displayOrder(), "options.displayOrder")))
                .toList();
    }

    static int displayOrder(Long value, String field) {
        if (value == null || value < 0 || value > Integer.MAX_VALUE) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be a non-negative integer");
        }
        return value.intValue();
    }

    static CatalogAttributeDefinitionReadback response(
            String requestId, CatalogOwnerApi.AttributeDefinitionReadback value) {
        return new CatalogAttributeDefinitionReadback(
                REVISION,
                requestId,
                new CatalogAttributeDefinitionReadback.Result(new CatalogAttributeDefinitionReadback.Result.Definition(
                        value.definitionRef(),
                        value.code(),
                        value.name(),
                        value.status(),
                        value.valueType(),
                        value.options().stream()
                                .map(option -> new CatalogAttributeDefinitionReadback.Result.Definition.OptionsItem(
                                        option.optionRef(), option.name(), (long) option.displayOrder()))
                                .toList(),
                        value.version())),
                value.version());
    }
}
