package com.catering.v2s.organization.api;

import java.util.List;
import java.util.UUID;

public interface StoreContractLookup {
    StoreContractContext requireStoreContractContext(UUID workspaceUuid, String groupWorkspaceKey, UUID storeId);

    record StoreContractContext(UUID storeId, UUID tenantId, UUID projectId, String storeStatus, List<String> projectPhaseNames) {
    }
}
