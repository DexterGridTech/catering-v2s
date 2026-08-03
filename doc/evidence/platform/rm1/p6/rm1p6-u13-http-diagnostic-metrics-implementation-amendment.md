---
title: RM1 U13 generic HTTP request metric instrumentation amendment
status: IMPLEMENTATION_AUTHORIZED
packageId: RM1P6-HTTP-DIAGNOSTIC-METRICS-U13
sourceDesign: doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md
---

# Purpose and root repair

`SeedRequestMetricsInterceptor` currently supplies correct server-canonical request/DB completion facts,
but is structurally locked to `r5-full` and `V2S_SEED_*`. Copying it for U13 would create two observation
implementations with divergent privacy, registry and completion rules. Replace it with one explicitly
profiled generic interceptor. The R5 Seed report remains a distinct consumer and retains its existing
headers/report wording; the new diagnostic report remains distinct and cannot be called Seed.

# Required behavior

- Default off. Activation requires `non-production`, one known profile, a bounded run id, a 24+ byte
  per-run secret, a valid run namespace and one run-scoped event path.
- Support exactly two isolated modes: existing `r5-full` seed observation and future
  `rm1-http-diagnostic` observation. Each accepts only its own run-id/secret/metadata headers.
- Server registry, not client metadata, remains canonical. A method/path/operation-id mismatch emits a
  safe observation error and causes the future client report to fail closed.
- Events retain only operation metadata, opaque correlation/request IDs, status, elapsed milliseconds and
  database operation/count duration. They retain no credentials, OTP, cookie, authorization, identity,
  raw payload, SQL or bind values.
- Preserve current R5 Seed activation behavior and its server completion evidence; replace only the
  implementation name and shared activation shape.

# Focused proof

Prove default-off, valid Seed activation, valid U13 diagnostic activation, secret/profile rejection,
server metadata mismatch and safe event output. This is static/focused instrumentation proof only.
