package com.catering.v2s.platform.workspace.api;

import java.util.UUID;

public record WorkspaceAdministrationReadback(
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String name,
        String operationsTitle,
        String logoAssetRef,
        String notes,
        String status,
        long statusChangedAtEpochMillis,
        long version,
        long createdAtEpochMillis,
        long updatedAtEpochMillis,
        boolean commercialGroupInitialized) {}
