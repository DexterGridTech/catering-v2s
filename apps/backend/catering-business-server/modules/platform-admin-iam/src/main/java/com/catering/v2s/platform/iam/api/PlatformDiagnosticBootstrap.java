package com.catering.v2s.platform.iam.api;

import java.util.UUID;

/**
 * Narrow non-HTTP owner command used only to establish the first actor for an isolated diagnostic.
 * It deliberately has no normal-administration or session-management capability.
 */
public interface PlatformDiagnosticBootstrap {
    DiagnosticAdministrator bootstrapFirstAdministrator(String loginName, String displayName, char[] initialPassword);

    record DiagnosticAdministrator(UUID administratorId, String loginName) { }
}
