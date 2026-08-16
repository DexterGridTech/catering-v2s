package com.catering.v2s.catalog.application.operations;

import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflight;
import com.catering.v2s.app.edge.generated.wire.TemporaryPromotionPreflightRequest;
import com.catering.v2s.catalog.api.CatalogOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for temporary catalog item promotion preflight. */
@Component
public class PreflightOperationsTemporaryCatalogItemPromotionOperation {
    public static final String OPERATION_ID = "preflightOperationsTemporaryCatalogItemPromotion";
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private final CommandExecutionContextResolver contexts;
    private final CatalogOwnerApi catalog;

    public PreflightOperationsTemporaryCatalogItemPromotionOperation(
            CommandExecutionContextResolver contexts, CatalogOwnerApi catalog) {
        this.contexts = contexts;
        this.catalog = catalog;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public TemporaryPromotionPreflight execute(Invocation invocation) {
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.PREFLIGHT_OPERATIONS_TEMPORARY_CATALOG_ITEM_PROMOTION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        var request = invocation.request();
        return response(
                context.requestId(),
                catalog.preflightTemporaryCatalogItemPromotion(
                        context,
                        new CatalogOwnerApi.TemporaryPromotionPreflightCommand(
                                invocation.itemCode(),
                                request.formalCode(),
                                request.shapeKey(),
                                request.name(),
                                request.shortName(),
                                request.materialRole(),
                                canonicalJson(request.attributes()),
                                requiredLong(request.expectedSourceVersion(), "expectedSourceVersion")),
                        invocation.idempotencyKey()));
    }

    public record Invocation(
            TemporaryPromotionPreflightRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String itemCode,
            String idempotencyKey) {}

    static TemporaryPromotionPreflight response(
            String requestId, CatalogOwnerApi.TemporaryPromotionPreflightReadback value) {
        var changes = value.changes().stream()
                .map(change -> new TemporaryPromotionPreflight.Data.ChangesItem(
                        change.field(), change.before(), change.after()))
                .toList();
        return new TemporaryPromotionPreflight(
                REVISION,
                requestId,
                new TemporaryPromotionPreflight.Data(
                        new TemporaryPromotionPreflight.Data.Item(
                                value.item().code(),
                                value.item().name(),
                                value.item().shapeKey()),
                        new TemporaryPromotionPreflight.Data.Proposed(
                                value.proposed().code(),
                                value.proposed().name(),
                                value.proposed().shapeKey(),
                                value.proposed().materialRole()),
                        value.source(),
                        value.sourceVersion(),
                        value.formalCodeAvailable(),
                        value.requiredFields(),
                        value.blockedReasons(),
                        changes,
                        value.preflightDigest(),
                        value.canPromote()));
    }

    private static String canonicalJson(com.catering.v2s.app.edge.generated.wire.CanonicalJsonDocument value) {
        return value == null ? null : value.canonicalJson();
    }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }
}
