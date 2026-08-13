# Backend acceptance design authorization

implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false

- authorityOwner: Dexter
- currentScope: requirements, norms, project memory, skills, landing points, and implementation-facing design only
- designReview: the external Claude DESIGN review cycle starts only after the complete design and plan are ready; finding remediation and recheck are allowed inside the cycle
- currentDynamicAuthority: none
- postDesignGoCondition: a Claude DESIGN GO permits a new implementation package to bind this design and execute BA-U01 through BA-U06 plus managed backend-acceptance Testcontainers only
- excludedAfterDesignGo: DEV, L2, reset, seed, browser, UAT, deployment, and manual SQL
- implementationReview: the external Claude IMPLEMENTATION review cycle starts only after final package exit; finding remediation and recheck are allowed inside the cycle
- internalSelfReview: every implementation node, at most two rounds; after a round-two finding, apply the fix, run focused mechanical proof, record it, and continue without a third review
- latestDexterHold: after the Round-2 DESIGN remediation, remain in the design-only package and do not activate implementation or managed runtime until Dexter gives a later explicit implementation instruction

This file records the authority boundary; it does not activate implementation or runtime for the current design package.
