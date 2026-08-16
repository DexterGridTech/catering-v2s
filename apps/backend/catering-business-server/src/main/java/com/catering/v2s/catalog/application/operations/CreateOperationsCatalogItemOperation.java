package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.CatalogItemCommandReadback;
import com.catering.v2s.app.edge.generated.wire.CatalogItemCreateRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for catalog item creation. */
@Component
public class CreateOperationsCatalogItemOperation {
    public static final String OPERATION_ID = "createOperationsCatalogItem";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public CreateOperationsCatalogItemOperation(CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public CatalogItemCommandReadback execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.CREATE_OPERATIONS_CATALOG_ITEM,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return response(
                context.requestId(),
                catalog.createCatalogItem(
                        context,
                        new CatalogOwnerApi.CatalogItemCreateCommand(
                                request.name(),
                                request.code(),
                                request.shapeKey(),
                                request.attributes().canonicalJson()),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            CatalogItemCreateRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}

    static CatalogItemCommandReadback response(String requestId, CatalogOwnerApi.CatalogItemCommandReadback value) {
        var owners = value.ownerReadbacks().stream()
                .map(owner -> new CatalogItemCommandReadback.Result.OwnerReadbacksItem(
                        owner.owner(), owner.status(), owner.version()))
                .toList();
        return new CatalogItemCommandReadback(
                REVISION,
                requestId,
                new CatalogItemCommandReadback.Result(
                        value.operation(),
                        UUID.fromString(value.resourceRef()),
                        value.status(),
                        value.version(),
                        owners,
                        new CatalogItemCommandReadback.Result.ActionAvailability(
                                value.actionAvailability().canEdit(),
                                value.actionAvailability().canEnable(),
                                value.actionAvailability().canDisable())),
                value.version());
    }
}
