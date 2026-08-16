package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogCategoryCreateRequest;
import com.catering.v2s.app.edge.generated.wire.CatalogCategoryReadback;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog category creation. */
@Component
public class CreateOperationsCatalogCategoryOperation {
    public static final String OPERATION_ID = "createOperationsCatalogCategory";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public CreateOperationsCatalogCategoryOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogCategoryReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_CATEGORY,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        CatalogCategoryCreateRequest request = invocation.request();
        var value = catalog.createCategory(
                context,
                new CatalogOwnerApi.CategoryCreateCommand(request.code(), request.name(), request.parentCategoryRef()),
                invocation.idempotencyKey());
        return response(context.requestId(), value);
    }

    public record Invocation(
            CatalogCategoryCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    static CatalogCategoryReadback response(String requestId, CatalogOwnerApi.CategoryReadback value) {
        return new CatalogCategoryReadback(
                REVISION,
                requestId,
                new CatalogCategoryReadback.Result(
                        value.categoryRef(),
                        value.code(),
                        value.name(),
                        value.parentCategoryRef(),
                        value.version(),
                        value.displayOrder(),
                        new CatalogCategoryReadback.Result.DeletionAvailability(
                                value.deletionAvailability().canDelete(),
                                value.deletionAvailability().subtreeSize(),
                                value.deletionAvailability().blockingReferenceCount(),
                                value.deletionAvailability().blockingReferenceLabels())),
                value.version());
    }

    static UUID requiredUuid(String value, String field) {
        try {
            if (value == null || value.isBlank()) throw new IllegalArgumentException();
            return UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be a UUID", invalid);
        }
    }

    static UUID optionalUuid(String value, String field) {
        return value == null || value.isBlank() ? null : requiredUuid(value, field);
    }

    static long requiredLong(Long value, String field) {
        if (value == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    static String string(UUID value) {
        return value == null ? null : value.toString();
    }
}
