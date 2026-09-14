package com.catering.v2s.inventory.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ResolvedBomTargetsTest {
    @Test
    void tenBomRowsKeepTheFirstMissingDiagnostic() {
        List<UUID> submitted = new ArrayList<>();
        for (int index = 0; index < 10; index++) submitted.add(UUID.randomUUID());
        UUID missing = submitted.get(7);
        Map<UUID, ResolvedBomTargets.TargetFact> resolved = new LinkedHashMap<>();
        submitted.stream()
                .filter(ref -> !ref.equals(missing))
                .forEach(ref ->
                        resolved.put(ref, new ResolvedBomTargets.TargetFact("ENABLED", true, UUID.randomUUID())));
        ResolvedBomTargets targets = ResolvedBomTargets.from(resolved);

        for (int index = 0; index < 7; index++) targets.requireResolved(submitted.get(index));
        InventoryOwnerApi.Problem failure =
        assertThrows(InventoryOwnerApi.Problem.class, () -> targets.requireResolved(missing));
        assertEquals("REFERENCE_MAPPING_UNRESOLVED", failure.code());
    }
}
