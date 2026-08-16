package com.catering.v2s.platform.workspace.api;

public record CommercialGroupSummary(
        long id,
        String commercialGroupCode,
        String commercialGroupName,
        String extensionValuesJson,
        long extensionRuleRevision,
        long version,
        long createdAtEpochMillis) {}
