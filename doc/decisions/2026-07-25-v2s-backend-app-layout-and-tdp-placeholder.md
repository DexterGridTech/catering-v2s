---
title: catering-v2s backend app layout and terminal-data-server placeholder
status: ACCEPTED
createdAt: 2026-07-25
acceptedBy: Dexter
scope: R3-U02
---
# Backend app layout and terminal-data-server placeholder

R3 keeps exactly one active business deployable, but the backend workspace is physically split into
parallel app directories:

- `apps/backend/catering-business-server/` is the current Spring Boot business deployable for R3-C01.
- `apps/backend/terminal-data-server/` is the approved independently managed single-node WebSocket transport runtime under `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`. It remains an auxiliary process, not a second business deployable or TDP; it has no business data owner, Flyway history, seed, or business write API.
- `libraries/backend/` remains the shared Gradle library area for bounded backend modules used by the
current business server; it does not make the auxiliary TDS runtime a second business deployable.

The Gradle root is the repository root, matching the all-v2 layout: `settings.gradle.kts` declares
`:apps:backend:catering-business-server`, `:apps:backend:terminal-data-server`, and
`:libraries:backend:*`. `apps/backend/` contains only the two parallel app directories and their
app-local build/source files; it is not a second Gradle root.

This is a physical app boundary, not a scope expansion: R3 still implements only C-01 and its approved
R3-TECH base, and does not design or implement TDP.
