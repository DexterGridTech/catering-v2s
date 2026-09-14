package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.application.persistence.InventoryAvailabilityServiceSql;
import com.catering.v2s.inventory.application.persistence.InventoryAvailabilityPersistence;
import static com.catering.v2s.inventory.api.InventoryOwnerApi.*;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import com.catering.v2s.organization.api.OperationsOwnerScopeGrant;
import com.catering.v2s.platform.command.CatalogAuthorizationScope;
import com.catering.v2s.platform.command.CatalogTargetCapability;
import com.catering.v2s.platform.command.WorkspaceCommandOperationToken;
import com.catering.v2s.platform.command.WorkspaceExecutionContext;
import com.catering.v2s.platform.foundation.persistence.AdvisoryLock;
import com.catering.v2s.platform.foundation.persistence.OwnerOperationDiagnostics;
import com.catering.v2s.platform.foundation.security.Sha256Hex;
import com.catering.v2s.platform.foundation.time.TimeProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Light inventory owner. It never writes catalog or organization schemas. */

/** Concrete Inventory availability owner. */
@Service
public class InventoryAvailabilityService {
    private static final String REVISION = "CATALOG_INVENTORY_P1_20260806";
    private static final String CATALOG_ITEM_SAVE_REQUIREMENT =
            "CATALOG_INVENTORY_OPERATION_SAVE_OPERATIONS_CATALOG_ITEM";
    private static final String ITEM_BASE_UNIT_ARGS = "商品基础计量单位判断参数不完整";
    private static final String SKU_BASE_UNIT_ARGS = "SKU 基础计量单位判断参数不完整";
    private static final String INCOMPLETE_CONSUMPTION_UNIT_SNAPSHOT = "单位快照不完整";
    private static final String SALES_MENU_STATE_UNKNOWN = "库存状态无法转换为销售菜单可用事实";
    /** Mapping types consumed by inventory copy; catalog may carry other owner mappings in the same plan. */
    private static final Set<String> INVENTORY_COPY_MAPPING_TYPES = Set.of(
            "CATALOG_ITEM",
            "PRODUCT_SKU",
            "CATALOG_UNIT",
            "CATALOG_ORDER_OPTION_DEFINITION",
            "CATALOG_ORDER_OPTION_DEFINITION_VALUE",
            "STOCK_TARGET");

    private final InventoryAvailabilityPersistence persistence;
    private final ObjectMapper mapper;
    private final TimeProvider time;

    public InventoryAvailabilityService(JdbcTemplate jdbc, ObjectMapper mapper, TimeProvider time) {
        this.persistence = new InventoryAvailabilityPersistence(jdbc);
        this.mapper = mapper;
        this.time = time;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public InventoryAvailabilityService(
            InventoryAvailabilityPersistence persistence, ObjectMapper mapper, TimeProvider time) {
        this.persistence = persistence;
        this.mapper = mapper;
        this.time = time;
    }

    @Transactional(readOnly = true)
    public List<InventoryOwnerApi.InventoryAvailabilityFact> readSalesMenuAvailability(
            String dataNodeRef, String brandRef, Set<InventoryOwnerApi.InventoryTargetRef> targetRefs) {
        requireSalesMenuAvailabilityScope(dataNodeRef, brandRef);
        Set<InventoryOwnerApi.InventoryTargetRef> requestedIdentities = normalizedInventoryTargetRefs(targetRefs);
        Map<InventoryAvailabilityPersistence.TargetIdentity, InventoryAvailabilityPersistence.TargetRow> targets =
                persistence.readTargets(
                dataNodeRef,
                brandRef,
                requestedIdentities.stream()
                        .map(identity -> new InventoryAvailabilityPersistence.TargetIdentity(
                                identity.itemRef(), identity.productSkuRef()))
                        .toList(),
                false);
        return requestedIdentities.stream()
                .map(identity -> salesMenuAvailabilityFact(
                        identity,
                        targets.get(new InventoryAvailabilityPersistence.TargetIdentity(
                                identity.itemRef(), identity.productSkuRef()))))
                .toList();
    }

    private InventoryOwnerApi.UnitSnapshot requiredUnitSnapshot(JsonNode node, String field) {
        if (node == null || !node.isObject())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " must be an object");
        UUID ref;
        try {
            ref = UUID.fromString(node.path("unitRef").asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + ".unitRef is required", failure);
        }
        String code = node.path("code").asText();
        String name = node.path("name").asText();
        String dimension = node.path("unitDimension").asText();
        if (code.isBlank()
                || name.isBlank()
                || !Set.of("COUNT", "WEIGHT", "VOLUME", "SERVICE_DURATION", "PACKAGE")
                        .contains(dimension)
                || !node.has("precision")
                || !node.path("precision").canConvertToInt()
                || node.path("precision").asInt() < 0)
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, field + " is incomplete");
        return new InventoryOwnerApi.UnitSnapshot(
                ref, code, name, dimension, node.path("precision").asInt());
    }

    private InventoryConfiguration configurationReadback(JsonNode configuration) {
        BigDecimal factor = decimalNode(configuration, "conversionFactor");
        InventoryOwnerApi.UnitSnapshot counting = configuration.hasNonNull("countingUnitSnapshot")
                ? requiredUnitSnapshot(configuration.path("countingUnitSnapshot"), "configuration.countingUnitSnapshot")
                : null;
        UUID countingRef = configuration.hasNonNull("countingUnitRef")
                ? requiredUuid(configuration, "countingUnitRef")
                : counting == null ? null : counting.unitRef();
        if (countingRef != null && counting == null)
            throw new InventoryOwnerApi.Problem("UNIT_SNAPSHOT_REQUIRED", 422, "盘点单位快照缺失");
        return new InventoryConfiguration(
                configuration.path("allowNegative").asBoolean(false),
                configuration.hasNonNull("lowStockThreshold") ? decimalNode(configuration, "lowStockThreshold") : null,
                countingRef,
                factor.signum() <= 0 ? BigDecimal.ONE : factor,
                counting);
    }

    private JsonNode json(String text) {
        if (text == null || text.isBlank())
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is missing");
        try {
            JsonNode parsed = mapper.readTree(text);
            if (parsed == null || parsed.isNull())
                throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is null");
            return parsed;
        } catch (InventoryOwnerApi.Problem failure) {
            throw failure;
        } catch (Exception ex) {
            throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, "库存 JSON fact is invalid", ex);
        }
    }

    private InventoryOwnerApi.InventoryAvailabilityFact salesMenuAvailabilityFact(
            InventoryOwnerApi.InventoryTargetRef identity, InventoryAvailabilityPersistence.TargetRow target) {
        if (target == null) return InventoryOwnerApi.InventoryAvailabilityFact.notApplicable(identity);

        JsonNode configuration = json(target.configuration());
        String stockState = state(target.balance(), configuration);
        return switch (stockState) {
            case "OK", "LOW" -> InventoryOwnerApi.InventoryAvailabilityFact.available(identity, target.ref());
            case "OUT" -> InventoryOwnerApi.InventoryAvailabilityFact.autoUnavailable(
                    identity, target.ref(), InventoryOwnerApi.InventoryAvailabilityReason.OUT_OF_STOCK);
            case "NEGATIVE" -> configurationReadback(configuration).allowNegative()
                    ? InventoryOwnerApi.InventoryAvailabilityFact.available(identity, target.ref())
                    : InventoryOwnerApi.InventoryAvailabilityFact.autoUnavailable(
                            identity, target.ref(), InventoryOwnerApi.InventoryAvailabilityReason.NEGATIVE_NOT_ALLOWED);
            case "UNKNOWN" -> InventoryOwnerApi.InventoryAvailabilityFact.unknown(identity, target.ref());
            default -> throw new InventoryOwnerApi.Problem("RESULT_UNKNOWN", 500, SALES_MENU_STATE_UNKNOWN);
        };
    }

    private BigDecimal decimalNode(JsonNode node, String key) {
        JsonNode value = node.path(key);
        return value.isNumber()
                ? value.decimalValue()
                : value.isTextual() ? new BigDecimal(value.asText()) : BigDecimal.ZERO;
    }

    private static BigDecimal decimalValue(ObjectNode req, String key) {
        JsonNode v = req.get(key);
        if (v == null || (!v.isNumber() && !v.isTextual()))
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal");
        try {
            return new BigDecimal(v.asText());
        } catch (NumberFormatException ex) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " must be decimal", ex);
        }
    }

    private static UUID requiredUuid(JsonNode node, String key) {
        if (node == null || !node.hasNonNull(key) || !node.path(key).isTextual())
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, key + " is required");
        try {
            return UUID.fromString(node.path(key).asText());
        } catch (IllegalArgumentException failure) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, key + " must be a UUID", failure);
        }
    }

    private static void requireSalesMenuAvailabilityScope(String dataNodeRef, String brandRef) {
        // This task API has no caller-supplied data-node type: its owner contract is STORE-only by construction.
        requireStoreDataNodeType("STORE");
        requireScope(dataNodeRef, brandRef);
    }

    private static Set<InventoryOwnerApi.InventoryTargetRef> normalizedInventoryTargetRefs(
            Set<InventoryOwnerApi.InventoryTargetRef> targetRefs) {
        if (targetRefs == null || targetRefs.isEmpty()) return Set.of();
        LinkedHashSet<InventoryOwnerApi.InventoryTargetRef> normalized = new LinkedHashSet<>();
        for (InventoryOwnerApi.InventoryTargetRef identity : targetRefs) {
            if (identity == null)
                throw new InventoryOwnerApi.Problem(
                        "VALIDATION_ERROR", 422, "targetRefs must contain itemRef/productSkuRef identities");
            normalized.add(identity);
        }
        return normalized;
    }

    static void requireStoreDataNodeType(String dataNodeType) {
        if (!"STORE".equals(dataNodeType)) {
            throw new InventoryOwnerApi.Problem(
                    ("SCOPE_FORBIDDEN"),
                    (403),
                    /* format-wrap */
                    ("库存余额、流水与库存动作仅支持门店数据节点"));
        }
    }

    private static void requireScope(String scope, String brand) {
        if (scope == null || scope.isBlank() || brand == null || brand.isBlank())
            throw new InventoryOwnerApi.Problem("SCOPE_FORBIDDEN", 403, "owner scope is required");
    }

    static String state(BigDecimal balance, JsonNode config) {
        if (config.path("unknown").asBoolean(false)) return "UNKNOWN";
        if (balance.signum() < 0) return "NEGATIVE";
        if (balance.signum() == 0) return "OUT";
        JsonNode thresholdNode =
                config.has("lowStockThreshold") ? config.path("lowStockThreshold") : config.path("threshold");
        BigDecimal threshold;
        try {
            threshold = thresholdNode.isNumber()
                    ? thresholdNode.decimalValue()
                    : thresholdNode.isTextual() ? new BigDecimal(thresholdNode.asText()) : BigDecimal.ZERO;
        } catch (NumberFormatException ignored) {
            threshold = BigDecimal.ZERO;
        }
        return threshold.signum() > 0 && balance.compareTo(threshold) < 0 ? "LOW" : "OK";
    }




}
