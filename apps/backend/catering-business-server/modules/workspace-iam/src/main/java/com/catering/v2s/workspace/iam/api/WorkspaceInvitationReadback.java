package com.catering.v2s.workspace.iam.api;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.UUID;

/** rawInvitationToken is delivery-adapter-only and must never enter an HTTP or receipt payload. */
public record WorkspaceInvitationReadback(
        UUID id,
        UUID workspaceUuid,
        String groupWorkspaceKey,
        String mobileNormalized,
        String status,
        long expiresAtEpochMillis,
        long version,
        long createdAtEpochMillis,
        Long consentedAtEpochMillis,
        Long completedAtEpochMillis,
        Long cancelledAtEpochMillis,
        @JsonIgnore String rawInvitationToken) {}
