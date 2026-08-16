package com.catering.v2s.inventory.application.operations;

import com.catering.v2s.inventory.api.InventoryOwnerApi;
import java.util.UUID;

/** Keeps the route target and the request target as one unambiguous command identity. */
final class InventoryTargetRefConsistency {
    private InventoryTargetRefConsistency() {}

    static UUID requireSame(String pathTargetRef, UUID bodyTargetRef) {
        UUID pathTarget = requiredUuid(pathTargetRef);
        if (bodyTargetRef == null || !pathTarget.equals(bodyTargetRef)) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "path targetRef must equal body targetRef");
        }
        return pathTarget;
    }

    private static UUID requiredUuid(String value) {
        try {
            if (value == null || value.isBlank()) throw new IllegalArgumentException();
            return UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            throw new InventoryOwnerApi.Problem("VALIDATION_ERROR", 422, "targetRef must be a UUID", invalid);
        }
    }
}
