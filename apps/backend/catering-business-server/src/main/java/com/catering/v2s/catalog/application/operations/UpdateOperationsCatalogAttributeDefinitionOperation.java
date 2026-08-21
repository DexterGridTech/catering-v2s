package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogAttributeDefinitionUpdateRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.List;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an operations attribute-library definition update. */
@Component
public class UpdateOperationsCatalogAttributeDefinitionOperation {
    public static final String OPERATION_ID = "updateOperationsCatalogAttributeDefinition";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public UpdateOperationsCatalogAttributeDefinitionOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogAttributeDefinitionReadback execute(Invocation invocation) {
        if (invocation.request().definitionRef() == null
                || !CreateOperationsCatalogCategoryOperation.requiredUuid(invocation.definitionRef(), "definitionRef")
                        .equals(invocation.request().definitionRef())) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "definitionRef must match the request path");
        }
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_CATALOG_ATTRIBUTE_DEFINITION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return CreateOperationsCatalogAttributeDefinitionOperation.response(
                context.requestId(),
                catalog.updateAttributeDefinition(
                        context,
                        new CatalogOwnerApi.AttributeDefinitionUpdateCommand(
                                CreateOperationsCatalogCategoryOperation.requiredUuid(
                                        invocation.definitionRef(), "definitionRef"),
                                requiredVersion(request.expectedVersion()),
                                request.code(),
                                request.name(),
                                options(request.options())),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogAttributeDefinitionUpdateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String definitionRef,
            String idempotencyKey) {}

    private static List<CatalogOwnerApi.AttributeDefinitionOption> options(
            List<CatalogAttributeDefinitionUpdateRequest.OptionsItem> values) {
        if (values == null) return List.of();
        return values.stream()
                .map(value -> new CatalogOwnerApi.AttributeDefinitionOption(
                        value.optionRef(),
                        value.name(),
                        CreateOperationsCatalogAttributeDefinitionOperation.displayOrder(
                                value.displayOrder(), "options.displayOrder")))
                .toList();
    }

    private static long requiredVersion(Long value) {
        return CreateOperationsCatalogCategoryOperation.requiredLong(value, "expectedVersion");
    }
}
