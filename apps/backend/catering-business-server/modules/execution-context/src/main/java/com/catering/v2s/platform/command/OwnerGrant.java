package com.catering.v2s.platform.command;

import java.util.UUID;

/**
 * Owner-visible verification capability.
 *
 * <p>The package-private constructor deliberately prevents another owner from implementing or minting a grant.
 * Workspace-IAM supplies the only concrete representation through its resolver-only minting bridge.
 */
public abstract sealed class OwnerGrant permits WorkspaceCommandContextMint.ResolvedOwnerGrant {
    OwnerGrant() {}

    /**
     * Resolver-owned verifier captured by the sole minting implementation. It is deliberately useful only to the
     * package-private concrete grant; callers cannot construct a grant from it.
     */
    @FunctionalInterface
    public interface Verifier {
        boolean verifyFor(String requirementId, String capabilityKey, String targetType, UUID targetId);
    }

    public abstract boolean verifyFor(String requirementId, String capabilityKey, String targetType, UUID targetId);
}
