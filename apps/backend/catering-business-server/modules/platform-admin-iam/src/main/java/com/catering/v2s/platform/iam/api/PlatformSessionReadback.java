package com.catering.v2s.platform.iam.api;

import java.util.UUID;

public record PlatformSessionReadback(UUID sessionId, long sessionVersion, UUID platformAdminId, String displayName, long expiresAtEpochMillis) {
}
