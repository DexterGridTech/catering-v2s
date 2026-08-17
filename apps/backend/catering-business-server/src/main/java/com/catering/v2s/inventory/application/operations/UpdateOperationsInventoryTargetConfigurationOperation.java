package com.catering.v2s.inventory.application.operations;

import com.catering.v2s.app.edge.generated.wire.InventoryTargetConfigurationRequest;
import com.catering.v2s.app.edge.generated.wire.InventoryTargetCurrentView;
import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.CatalogScopeLookup;
import com.catering.v2s.platform.command.CatalogInventoryWorkspaceCommandTokens;
import com.catering.v2s.workspace.iam.application.CommandExecutionContextResolver;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** One-operation M1 composition entry for an inventory target configuration update. */
@Component
public class UpdateOperationsInventoryTargetConfigurationOperation {
    public static final String OPERATION_ID = "updateOperationsInventoryTargetConfiguration";

    private final CommandExecutionContextResolver contexts;
    private final InventoryOwnerApi inventory;

    public UpdateOperationsInventoryTargetConfigurationOperation(
            CommandExecutionContextResolver contexts, InventoryOwnerApi inventory) {
        this.contexts = contexts;
        this.inventory = inventory;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public InventoryTargetCurrentView execute(Invocation invocation) {
        InventoryTargetConfigurationRequest request = invocation.request();
        UUID targetRef = InventoryTargetRefConsistency.requireSame(invocation.targetRef(), request.targetRef());
        var context = contexts.resolveCatalog(
                invocation.sessionCredential(),
                CatalogInventoryWorkspaceCommandTokens.UPDATE_OPERATIONS_INVENTORY_TARGET_CONFIGURATION,
                invocation.request().dataNodeRef().toString(),
                CatalogScopeLookup.CatalogBrandSelection.fromRequestValue(invocation.requestedBrandRef()),
                invocation.correlationId(),
                invocation.requestId());
        InventoryTargetConfigurationRequest.Configuration configuration = request.configuration();
        InventoryOwnerApi.InventoryTargetCurrentReadback readback = inventory.updateTargetConfiguration(
                context,
                new InventoryOwnerApi.UpdateTargetConfigurationCommand(
                        targetRef,
                        requiredLong(request.expectedVersion(), "expectedVersion"),
                        new InventoryOwnerApi.InventoryConfiguration(
                                requiredBoolean(
                                        configuration == null ? null : configuration.allowNegative(),
                                        "configuration.allowNegative"),
                                requiredDecimal(
                                        configuration == null ? null : configuration.lowStockThreshold(),
                                        "configuration.lowStockThreshold"),
                                requiredText(
                                        configuration == null ? null : configuration.countingUnit(),
                                        "configuration.countingUnit"),
                                requiredDecimal(
                                        configuration == null ? null : configuration.conversionFactor(),
                                        "configuration.conversionFactor"))),
                invocation.idempotencyKey());
        return response(readback);
    }

    public record Invocation(
            InventoryTargetConfigurationRequest request,
            String sessionCredential,
            String requestedBrandRef,
            String correlationId,
            String requestId,
            String targetRef,
            String idempotencyKey) {}

    private static InventoryTargetCurrentView response(InventoryOwnerApi.InventoryTargetCurrentReadback value) {
        InventoryOwnerApi.InventoryTargetReadback target = value.target();
        InventoryOwnerApi.InventoryConfiguration configuration = value.configuration();
        InventoryOwnerApi.InventoryChangeSummaryReadback summary = value.changeSummary();
        return new InventoryTargetCurrentView(
                value.version(),
                new InventoryTargetCurrentView.Target(
                        target.targetRef(),
                        target.targetType(),
                        target.productCode(),
                        target.itemRef(),
                        target.productSkuRef(),
                        target.productName(),
                        target.productShape(),
                        target.skuCode(),
                        target.skuName(),
                        target.consumptionUnit(),
                        target.countingUnit(),
                        target.conversionSummary(),
                        target.authorityType()),
                decimal(value.balance()),
                new InventoryTargetCurrentView.Configuration(
                        configuration.allowNegative(),
                        decimal(configuration.lowStockThreshold()),
                        configuration.countingUnit(),
                        decimal(configuration.conversionFactor())),
                value.stockState(),
                value.stale(),
                value.unknown(),
                decimal(value.threshold()),
                decimal(value.gap()),
                new InventoryTargetCurrentView.ChangeSummary(
                        periodToday(summary.today()),
                        periodSevenDays(summary.sevenDays()),
                        periodThirtyDays(summary.thirtyDays())),
                recentChanges(value.recentChanges()),
                new InventoryTargetCurrentView.DiagnosticsAvailability(
                        value.diagnosticsAvailability().canRead(),
                        value.diagnosticsAvailability().reason()));
    }

    private static InventoryTargetCurrentView.ChangeSummary.Today periodToday(
            InventoryOwnerApi.InventoryChangePeriodReadback value) {
        return new InventoryTargetCurrentView.ChangeSummary.Today(
                decimal(value.increase()), decimal(value.decrease()), decimal(value.netChange()), value.entryCount());
    }

    private static InventoryTargetCurrentView.ChangeSummary.SevenDays periodSevenDays(
            InventoryOwnerApi.InventoryChangePeriodReadback value) {
        return new InventoryTargetCurrentView.ChangeSummary.SevenDays(
                decimal(value.increase()), decimal(value.decrease()), decimal(value.netChange()), value.entryCount());
    }

    private static InventoryTargetCurrentView.ChangeSummary.ThirtyDays periodThirtyDays(
            InventoryOwnerApi.InventoryChangePeriodReadback value) {
        return new InventoryTargetCurrentView.ChangeSummary.ThirtyDays(
                decimal(value.increase()), decimal(value.decrease()), decimal(value.netChange()), value.entryCount());
    }

    private static List<InventoryTargetCurrentView.RecentChangesItem> recentChanges(
            List<InventoryOwnerApi.InventoryRecentChangeReadback> values) {
        return values.stream()
                .map(value -> new InventoryTargetCurrentView.RecentChangesItem(
                        value.occurredAt(), value.changeType(), decimal(value.quantity()), value.source()))
                .toList();
    }

    private static long requiredLong(Long value, String field) {
        if (value == null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static boolean requiredBoolean(Boolean value, String field) {
        if (value == null) throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static BigDecimal requiredDecimal(String value, String field) {
        try {
            if (value == null || value.isBlank()) throw new NumberFormatException();
            return new BigDecimal(value);
        } catch (NumberFormatException invalid) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be decimal", invalid);
        }
    }

    private static String requiredText(String value, String field) {
        if (value == null || value.isBlank())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is required");
        return value;
    }

    private static String decimal(BigDecimal value) {
        return value == null ? null : value.stripTrailingZeros().toPlainString();
    }

    private static String string(UUID value) {
        return value == null ? null : value.toString();
    }
}
