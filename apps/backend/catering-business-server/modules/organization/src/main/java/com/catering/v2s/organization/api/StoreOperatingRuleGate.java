package com.catering.v2s.organization.api;

import java.util.UUID;

/**
 * Organization-owned capability gate for mutations whose resolved target is a Store.
 *
 * <p>The caller must first resolve the target through its own authorization boundary. This API only re-reads the
 * Store-owned operating-rule fact; it does not replace capability, scope, lifecycle, idempotency, or owner checks.
 */
public interface StoreOperatingRuleGate {
    String CATALOG_MANAGEMENT_DISABLED_CODE = "ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED";

    void requireCatalogManagementForStoreTarget(
            UUID workspaceUuid, String groupWorkspaceKey, String targetType, UUID storeId);

    /** A closed, fail-closed result for a Store operating-rule capability read. */
    final class CatalogManagementDisabledException extends RuntimeException {
        public enum Reason {
            DISABLED,
            STORE_READ_FAILED,
            TARGET_NOT_STORE
        }

        private final Reason reason;
        private final String storeRefHash;

        public CatalogManagementDisabledException(Reason reason) {
            this(reason, null, null);
        }

        public CatalogManagementDisabledException(Reason reason, Throwable cause) {
            this(reason, null, cause);
        }

        public CatalogManagementDisabledException(Reason reason, String storeRefHash, Throwable cause) {
            super(cause);
            this.reason = reason == null ? Reason.STORE_READ_FAILED : reason;
            this.storeRefHash = storeRefHash == null || storeRefHash.isBlank() ? "unavailable" : storeRefHash;
        }

        public Reason reason() {
            return reason;
        }

        public String storeRefHash() {
            return storeRefHash;
        }
    }
}
