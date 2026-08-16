package com.catering.v2s.organization.api;

import java.util.Map;
import java.util.UUID;

public record CommercialGroupReadback(
        UUID id,
        String groupWorkspaceKey,
        String commercialGroupCode,
        String commercialGroupName,
        long revision,
        String createdByPlatformSubject,
        long createdAtEpochMillis,
        long updatedAtEpochMillis,
        Map<String, String> extensionValues,
        long extensionRuleRevision) {
    public CommercialGroupReadback(
            UUID id,
            String groupWorkspaceKey,
            String commercialGroupCode,
            String commercialGroupName,
            long revision,
            String createdByPlatformSubject,
            long createdAtEpochMillis,
            long updatedAtEpochMillis) {
        this(
                id,
                groupWorkspaceKey,
                commercialGroupCode,
                commercialGroupName,
                revision,
                createdByPlatformSubject,
                createdAtEpochMillis,
                updatedAtEpochMillis,
                Map.of(),
                0L);
    }
}
