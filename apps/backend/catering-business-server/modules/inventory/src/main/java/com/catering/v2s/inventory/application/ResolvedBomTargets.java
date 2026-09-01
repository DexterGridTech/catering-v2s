package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A command-local, bounded state judgment for the component targets of one BOM save. It deliberately contains no cache
 * and is not reusable after this invocation: the owning command still performs its version/CAS check.
 */
final class ResolvedBomTargets {
    static final String STATEMENT_TEMPLATE = "SELECT target_ref,definition_status,component_eligible,"
            + "consumption_unit_ref FROM inventory.stock_target "
            + "WHERE data_node_ref=? AND brand_ref=? AND target_ref = ANY(?::uuid[])";

    private final Map<UUID, TargetFact> facts;

    private ResolvedBomTargets(Map<UUID, TargetFact> facts) {
        this.facts = Map.copyOf(facts);
    }

    static ResolvedBomTargets load(JdbcTemplate jdbc, String scope, String brand, List<UUID> targetRefs) {
        LinkedHashSet<UUID> distinctRefs = new LinkedHashSet<>(targetRefs);
        if (distinctRefs.isEmpty()) return new ResolvedBomTargets(Map.of());
        UUID[] values = distinctRefs.toArray(UUID[]::new);
        Map<UUID, TargetFact> resolved = jdbc.query(
                STATEMENT_TEMPLATE,
                statement -> {
                    statement.setString(1, scope);
                    statement.setString(2, brand);
                    statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
                },
                result -> {
                    Map<UUID, TargetFact> facts = new java.util.LinkedHashMap<>();
                    while (result.next()) {
                        UUID ref = result.getObject(1, UUID.class);
                        TargetFact previous = facts.putIfAbsent(
                                ref,
                                new TargetFact(
                                        result.getString(2), result.getBoolean(3), result.getObject(4, UUID.class)));
                        if (previous != null) {
                            throw new InventoryOwnerApi.Problem(
                                    "REFERENCE_MAPPING_UNRESOLVED",
                                    422,
                                    /* format-wrap */
                                    "目标库存对象引用不唯一");
                        }
                    }
                    return facts;
                });
        return new ResolvedBomTargets(resolved);
    }

    void requireResolved(UUID targetRef) {
        if (!facts.containsKey(targetRef)) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件库存对象不存在");
        }
    }

    void requireNewAdmission(UUID targetRef) {
        TargetFact fact = facts.get(targetRef);
        if (fact == null) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件库存对象不存在");
        }
        if (!fact.enabled() || !fact.componentEligible() || fact.consumptionUnitRef() == null)
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件库存对象不可用");
    }

    boolean contains(UUID targetRef) {
        return facts.containsKey(targetRef);
    }

    record TargetFact(String definitionStatus, boolean componentEligible, UUID consumptionUnitRef) {
        boolean enabled() {
            return "ENABLED".equals(definitionStatus);
        }
    }
}
