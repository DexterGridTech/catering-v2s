package com.catering.v2s.organization.api;

import java.util.Objects;
import java.util.UUID;

/** Organization-owned target facts required by the sales-menu owner. */
public interface OrganizationOwnerApi {
    /**
     * Re-reads one store in the requested workspace/group scope. {@code timezone} is nullable because the current
     * organization.store bytes have no independent timezone column or approved timezone extension fact; callers must
     * not replace the absent fact with a product default.
     */
    SalesMenuStoreJudgment requireSalesMenuStore(UUID workspaceUuid, String groupWorkspaceKey, UUID storeRef);

    record SalesMenuStoreJudgment(UUID storeRef, String status, String timezone, String dataNodeRef, String brandRef) {
        public SalesMenuStoreJudgment {
            Objects.requireNonNull(storeRef, "storeRef");
            status = required(status, "status");
            dataNodeRef = required(dataNodeRef, "dataNodeRef");
            brandRef = required(brandRef, "brandRef");
        }

        private static String required(String value, String field) {
            if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required");
            return value;
        }
    }
}
