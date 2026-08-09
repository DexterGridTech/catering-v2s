package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * A command-local, bounded existence judgment for the component targets of one
 * BOM save.  It deliberately contains no cache and is not reusable after this
 * invocation: the owning command still performs its version/CAS check.
 */
final class ResolvedBomTargets {
    static final String STATEMENT_TEMPLATE = "SELECT target_ref FROM inventory.stock_target "
        + "WHERE data_node_ref=? AND brand_ref=? AND target_ref = ANY(?::uuid[])";

    private final Set<UUID> resolvedRefs;

    private ResolvedBomTargets(Set<UUID> resolvedRefs) {
        this.resolvedRefs = Set.copyOf(resolvedRefs);
    }

    static ResolvedBomTargets load(JdbcTemplate jdbc, String scope, String brand, List<UUID> targetRefs) {
        LinkedHashSet<UUID> distinctRefs = new LinkedHashSet<>(targetRefs);
        if (distinctRefs.isEmpty()) return new ResolvedBomTargets(Set.of());
        UUID[] values = distinctRefs.toArray(UUID[]::new);
        List<UUID> resolved = jdbc.query(STATEMENT_TEMPLATE, statement -> {
            statement.setString(1, scope);
            statement.setString(2, brand);
            statement.setArray(3, statement.getConnection().createArrayOf("uuid", values));
        }, (row, index) -> row.getObject(1, UUID.class));
        return new ResolvedBomTargets(new LinkedHashSet<>(resolved));
    }

    void requireResolved(UUID targetRef) {
        if (!resolvedRefs.contains(targetRef)) {
            throw new InventoryOwnerApi.Problem("REFERENCE_MAPPING_UNRESOLVED", 422, "BOM 组件库存对象不存在");
        }
    }
}
