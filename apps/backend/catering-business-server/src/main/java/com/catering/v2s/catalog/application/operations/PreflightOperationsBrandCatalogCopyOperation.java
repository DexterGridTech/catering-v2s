package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.BrandCatalogCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.BrandCopyPreflightRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Named REQUIRED command entry for the three-owner brand-copy preflight. */
@Component
public class PreflightOperationsBrandCatalogCopyOperation {
    public static final String OPERATION_ID = "preflightOperationsBrandCatalogCopy";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator composition;
    private final ObjectMapper mapper;

    public PreflightOperationsBrandCatalogCopyOperation(
            CommandExecutionContextResolver contexts, CatalogInventoryCoordinator composition, ObjectMapper mapper) {
        this.contexts = contexts;
        this.composition = composition;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public BrandCatalogCopyPreflight execute(Invocation invocation) {
        var request = invocation.request();
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_BRAND_CATALOG_COPY,
                request.dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var readback = composition.preflightBrandCopy(
                context,
                new CatalogOwnerApi.BrandCopyPreflightCommand(
                        request.selectedItemCodes(), request.targetDataNodeRef().toString()));
        try {
            var envelope =
                    CopyPreflightWireShape.contractEnvelope(mapper, readback.canonicalJson(), context.requestId());
            return mapper.treeToValue(envelope.path("data"), BrandCatalogCopyPreflight.class);
        } catch (Exception failure) {
            throw CopyPreflightWireShape.invalidReadback("brand copy preflight", failure);
        }
    }

    public record Invocation(
            BrandCopyPreflightRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}
}
