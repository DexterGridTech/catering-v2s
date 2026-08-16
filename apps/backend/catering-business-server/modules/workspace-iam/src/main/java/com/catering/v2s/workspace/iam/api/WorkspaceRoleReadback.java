package com.catering.v2s.workspace.iam.api;

import java.util.Set;
import java.util.UUID;

public record WorkspaceRoleReadback(
        UUID id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String name,
        String description,
        String serviceNodeType,
        String status,
        long version,
        long createdAtEpochMillis,
        long updatedAtEpochMillis,
        Set<String> pageAccessKeys,
        Set<String> actionCapabilityKeys) {}
