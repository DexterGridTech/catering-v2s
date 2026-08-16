package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflight;
import com.catering.v2s.app.edge.generated.wire.LocalCopyPreflightRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.catalog.application.CatalogInventoryCoordinator;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PreflightOperationsLocalCatalogCopyOperation {
    public static final String OPERATION_ID = "preflightOperationsLocalCatalogCopy";
    private final CommandExecutionContextResolver contexts;
    private final CatalogInventoryCoordinator composition;
    private final ObjectMapper mapper;

    public PreflightOperationsLocalCatalogCopyOperation(
            CommandExecutionContextResolver contexts, CatalogInventoryCoordinator composition, ObjectMapper mapper) {
        this.contexts = contexts;
        this.composition = composition;
        this.mapper = mapper;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public LocalCopyPreflight execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_LOCAL_CATALOG_COPY,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var value = composition.preflightLocalCopy(
                context,
                new CatalogOwnerApi.LocalCopyPreflightCommand(
                        invocation.request().sourceItemCode(),
                        invocation.request().targetItemCode(),
                        invocation.request().selectedSections()));
        try {
            return mapper.treeToValue(
                    CopyPreflightWireShape.contractEnvelope(mapper, value.canonicalJson(), context.requestId()),
                    LocalCopyPreflight.class);
        } catch (Exception failure) {
            throw CopyPreflightWireShape.invalidReadback("local copy preflight", failure);
        }
    }

    public record Invocation(
            LocalCopyPreflightRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String idempotencyKey) {}
}
