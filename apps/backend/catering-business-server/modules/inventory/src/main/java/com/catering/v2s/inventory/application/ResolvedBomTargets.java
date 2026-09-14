package com.catering.v2s.inventory.application;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.Map;
import java.util.UUID;

/**
 * A command-local, bounded state judgment for the component targets of one BOM save. It deliberately contains no cache
 * and is not reusable after this invocation: the owning command still performs its version/CAS check.
 */
final class ResolvedBomTargets {
    private final Map<UUID, TargetFact> facts;

    private ResolvedBomTargets(Map<UUID, TargetFact> facts) {
        this.facts = Map.copyOf(facts);
    }

    static ResolvedBomTargets from(Map<UUID, TargetFact> facts) {
        return new ResolvedBomTargets(facts);
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
