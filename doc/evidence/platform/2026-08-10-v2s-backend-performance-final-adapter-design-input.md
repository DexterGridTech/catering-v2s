---
schemaVersion: 1
implementationAuthority: false
packageId: BACKEND-PERFORMANCE-FINAL-ADAPTER-DESIGN-20260810
kind: final-managed-lifecycle-adapter-design
scope: design-only
---

# Final managed lifecycle adapter design authority

The final runner was callback-only and is deliberately fail-closed. Existing RM1, R5 and
Testcontainers runners cannot be reused without violating topology or scope. This package may
define, but may not implement or run, the single final-only adapter.

## Required owned capabilities

- resource identity preflight;
- remote Testcontainers technical proof;
- local application plus managed tunnel lifecycle;
- isolated remote namespace and object prefix;
- minimal fixture materialization for the 396 source-bound recipes;
- server-origin evidence collection;
- immutable snapshot; and
- separate business and cleanup evidence.

## Exclusions

Manual SSH or SQL orchestration, RM1 workload reuse, the R5 persistent DEV adapter, unowned
process termination, reset, browser L2 and UAT are excluded. A Claude GO is required before any
separate static implementation package may be created.
