# CP-U17 formal owner-command seed executor

## Authority and problem

Dexter directly authorized the formal `r5-full` seed implementation. The prior `scripts/dev/seed` correctly failed closed because it had no executor; the existing L2 fixture is a useful owner-command/reporting reference but is neither the formal entry point nor the full fixture denominator. It also consumes an L2-only debug OTP response. The root bootstrap remains `scripts/dev/r5-seed-bootstrap.mjs`; it creates only root identity, BCrypt credential, audit and receipt. The one additional direct-write exception is not a product command: `inv-expired` is a time-driven terminal fixture. It must begin as a normal owner-command-created `PENDING` invitation and may only be changed through the managed remote terminal adapter to `EXPIRED`, with its historical created/expired timestamps, exact existing role/node intent, SYSTEM audit and workspace-scoped receipt. It is deny-by-default outside r5-full/non-production/exact namespace and cannot create an HTTP, capability or UI surface.

## Design

- `scripts/dev/seed` validates profile and explicit confirmation, then invokes the capability-named owner-command executor.
- The executor validates the current managed DEV manifest, fresh database, identity-owned processes, 0600 credentials, `r5-full` runtime markers, generated operation registry and report path before it mutates. It invokes bootstrap, performs password login with `root/root`, calls `/api/platform/auth/session`, and verifies the generated owner readback identifies the enabled platform session.
- Every non-bootstrap fact is written through an OpenAPI-generated route and read back through the owner edge. The extracted common engine replaces duplicate mutation/report mechanics in the L2 fixture; formal data is not an L2 fixture and never requires debug-code exposure.
- The report is written as a 0600 machine JSON and Dexter-readable Markdown pair. Each API row retains owner, operation, route, call count, HTTP duration and backend database operation min/average/max; no credentials, OTP, cookie, login name, mobile, token, grant, raw payload or SQL is persisted.
- The existing fixed-OTP contract is made executable with an optional `DevFixedOtpIssuer`: a bean exists only when non-production, exact `r5-full`, valid dev namespace and a six-digit private seed value are all present. Issuance remains purpose-bound, hashes only the OTP in the existing owner grant table, and retains expiry, attempts and verification/grant state. No endpoint echoes the code.
- Invitation expiry is not simulated by advancing a global clock. The terminal adapter has a single contract allowlist, records why the owner command is unavailable, and uses the existing invitation read API after the remote owner-state update. Default profile, production marker, wrong namespace and any non-allowlisted key reject before remote execution.

## Verification and handoff

Focused tests must prove fixed issuer/clock absence in the default profile, rejection for each missing r5 condition, hash-only owner use, and formal executor refusal on an incomplete manifest or missing owner event. A fresh dynamic run is `reset --dry-run` → confirmed reset → `start` → confirmed `seed`; a failure preserves its first failure/report and requires the reset/start chain before another seed mutation. DEV is never called UAT or L2.
