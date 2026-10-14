package com.catering.v2s.platform.iam.api;

import java.util.UUID;

/** Narrow non-HTTP owner command used by the one-shot UAT initializer on an empty UAT database. */
public interface PlatformUatRootBootstrap {
    BootstrapReadback bootstrapUatRootAdministrator(
            UUID administratorId,
            String loginName,
            String displayName,
            char[] initialPassword,
            String idempotencyKey);

    record BootstrapReadback(
            UUID administratorId,
            String loginName,
            String displayName,
            String status,
            boolean builtIn,
            String auditAction) {}
}
