package com.catering.v2s.contract.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record StoreContractReadback(
        UUID id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String contractNo,
        UUID storeId,
        UUID tenantId,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String phaseNameSnapshot,
        String notes,
        String status,
        long version,
        List<Item> items) {
    public record Item(int lineNo, String itemCode, String itemName) {}
}
