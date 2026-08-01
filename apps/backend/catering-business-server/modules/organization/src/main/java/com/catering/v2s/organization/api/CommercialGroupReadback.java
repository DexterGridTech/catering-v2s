package com.catering.v2s.organization.api;

import java.util.UUID;

public record CommercialGroupReadback(
    UUID id,
    String groupWorkspaceKey,
    String commercialGroupCode,
    String commercialGroupName,
    long revision,
    String createdByPlatformSubject,
    long createdAtEpochMillis,
    long updatedAtEpochMillis
) {
}
