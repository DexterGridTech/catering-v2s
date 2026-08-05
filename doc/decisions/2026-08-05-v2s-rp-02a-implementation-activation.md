---
title: RP-02a implementation activation
status: ACTIVE
packageId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
implementationAuthority: true
runtimeAuthority: false
seedResetAuthority: false
reviewTarget: IMPLEMENTATION
reviewCycleId: WHOLE-ENGINEERING-RP-02A-IMPLEMENTATION-20260805
---

Dexter has authorized static implementation after the accepted design and Claude's independent
design review `GO — M=0 / S=0 / N=2` in
`doc/review/platform/2026-08-05-v2s-whole-engineering-rp-02a-design-review-claude.md`.

The implementation authority is limited to the exact surfaces in
`.runtime/compliance-control/active-package.json`. RP-02a-U01 may materialize the edge operation
catalog and projection identity, add the narrow `scripts/check/r5-edge-materialize` wrapper, repair
the source-bound scenario/payload/query/recovery consumers, and create static evidence/review
artifacts. It may not modify contracts/OpenAPI/generated wire, backend/frontend runtime code,
database/migrations, DEV/UAT, HTTP/L2, remote Testcontainers, seed/reset, roadmap, or Git.

Claude's N1 is closed by creating the catalog crosswalk artifact; N2 is closed by the wrapper at
`scripts/check/r5-edge-materialize`. The wrapper is deliberately not wired into `scripts/verify`;
that remains RP-00b scope. No business or cleanup PASS is claimed in this static package.
