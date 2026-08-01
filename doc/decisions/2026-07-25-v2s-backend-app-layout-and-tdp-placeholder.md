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
- `apps/backend/terminal-data-server/` is a reserved placeholder for a future TDP app. It has no runtime,
  endpoint, database, migration, generated wire, seed, or business source in R3.
- `libraries/backend/` remains the shared Gradle library area for bounded backend modules used by the
  current business server; it does not turn the placeholder into a current deployable.

The Gradle root is the repository root, matching the all-v2 layout: `settings.gradle.kts` declares
`:apps:backend:catering-business-server`, `:apps:backend:terminal-data-server`, and
`:libraries:backend:*`. `apps/backend/` contains only the two parallel app directories and their
app-local build/source files; it is not a second Gradle root.

This is a physical app boundary, not a scope expansion: R3 still implements only C-01 and its approved
R3-TECH base, and does not design or implement TDP.
