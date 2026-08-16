package com.catering.v2s.workspace.iam.api;

import java.util.UUID;

public record WorkspaceAccountReadback(
        UUID id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String mobileNormalized,
        String loginNameNormalized,
        String displayName,
        String status,
        long version) {}
