package com.catering.v2s.app.edge.operations.cataloginventory;

import com.catering.v2s.contracts.generated.cataloginventory.CatalogInventoryEdgeWire;
import com.catering.v2s.catalog.api.CatalogOwnerApi;

/** Resolves edge requests only against the generated P1 operation registry. */
final class CatalogInventoryOperationRegistry {
    String resolve(String method, String requestUri) {
        String normalizedMethod = method == null ? "" : method.toUpperCase(java.util.Locale.ROOT);
        String path = requestUri == null ? "" : requestUri.split("\\?", 2)[0];
        if (path.startsWith("/api/")) path = path.substring("/api".length());
        for (CatalogInventoryEdgeWire.Operation operation : CatalogInventoryEdgeWire.OPERATIONS) {
            if (normalizedMethod.equals(operation.method()) && matches(operation.path(), path)) return operation.operationId();
        }
        throw new CatalogOwnerApi.Problem("VALIDATION_ERROR", 422, "route is not registered: " + normalizedMethod + " " + path);
    }

    private static boolean matches(String template, String path) {
        String[] expected = template.split("/", -1);
        String[] actual = path.split("/", -1);
        if (expected.length != actual.length) return false;
        for (int i = 0; i < expected.length; i++) {
            String segment = expected[i];
            if (segment.startsWith("{") && segment.endsWith("}")) {
                if (actual[i].isBlank()) return false;
            } else if (!segment.equals(actual[i])) return false;
        }
        return true;
    }
}
