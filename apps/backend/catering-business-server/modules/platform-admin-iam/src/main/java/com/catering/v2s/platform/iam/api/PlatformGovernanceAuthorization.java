package com.catering.v2s.platform.iam.api;

import com.catering.v2s.audit.contract.AuditActor;

/** Public owner authorization boundary for platform-governance commands owned by other modules. */
public interface PlatformGovernanceAuthorization {
    void requireEnabledPlatformAdministrator(AuditActor actor);
}
