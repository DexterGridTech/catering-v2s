---
title: RM1 P6-1 credential-ingress and face-isolation remediation design
status: DEXTER_AUTHORIZED_IMPLEMENTATION_REMEDIATION
scope: P6-1 only
---

# RM1 P6-1 credential-ingress and face-isolation remediation

## 1. Business problem and bounded intent

This corrective slice serves the P6-1 user task: an unauthenticated platform or operations user can recover a
password with account, own mobile number and OTP, while the browser-held recovery flow/grant is a short-lived,
owner-bound opaque credential.  The original P6-1 requirement is
`rm1-u09-implementation-facing-design-and-three-phase-plan.md#3.1` and the approved operations interaction
requirement is `2026-07-29-v2s-rm1-ia-05-operations-users-recovery-and-home-interaction.md#8.1`:
flow/grant must not be visible in a URL, page, log-visible copy or brand readback.  The observability design also
requires Edge request facts to limit raw cookie visibility to the narrow owner-local boundary
(`2026-07-29-v2s-rm1-p6-observability-extension-implementation-design.md#2`).

Claude's P6-1 implementation review was independently reopened.  Its M1 is rejected: current D1 source hashes
are equal and the existing granularity checker passes.  Its S1/S2 reveal one shared boundary defect family:
seven inbound recovery credential bindings enter two controllers as raw `String`, while two face-local session
resolvers rely on a false shared package solely to read raw session cookies.  No current response/log leak or
cross-face read was found; the required work is preventive structural closure, not a behavior change.

The smaller alternative is to remove only the three platform `@CookieValue` parameters or to move both session
resolvers into one honest shared directory.  The first leaves four operations flow/grant bindings uncovered; the
second preserves cross-face raw access.  The selected design closes the finite seven-binding family and makes
each resolver's raw session extraction face-local at compile time.

## 2. Exact design

1. `EdgeRequestContextArgumentResolver` remains the sole servlet/cookie adapter.  It reads the two session
   cookies and three recovery-cookie names there, constructs typed opaque ingress values, and keeps the existing
   rate-limit fingerprint and correlation behavior unchanged.
2. `EdgeRequestContext` carries only non-sensitive String facts plus opaque typed values.  Its public accessors
   may return an opaque value but never a raw token.  Opaque values expose neither a raw getter nor raw
   `toString`; null/blank values retain the prior owner-invalid outcome.
3. `PlatformSessionResolver` and `OperationsSessionResolver` declare the package matching their face-local
   directories.  Each consumes only its own `PlatformSessionCookie` / `OperationsSessionCookie`; all affected
   imports are mechanically rewired.  The shared `edge.session` package retains only context and servlet ingress.
4. The platform-IAM owner defines `PasswordRecoveryFlowCredential`; workspace-IAM defines
   `RecoveryFlowCredential` and `RecoveryGrantCredential`.  Their public `fromEdgeCookie` factory admits ingress;
   the raw value is package-private to the owning service, redacted from `toString`, and never returned to an edge
   controller.  The six owner recovery command signatures accept these opaque owner values.
5. The two recovery controllers remove all seven `@CookieValue` parameters.  They receive
   `EdgeRequestContext` and forward only the appropriate typed owner credential to the already-approved owner
   command.  Routes, owner transaction behavior, cookies written after start/verify, HTTP mapping, OTP semantics,
   branding readback and session revocation are retained.

## 3. Proof, red controls and completion

The finite production denominator is exactly seven `@CookieValue` recovery bindings: platform flow ×3;
operations flow ×3; operations grant ×1.  The counterexample boundary is an outbound cookie issued from a
fresh owner result: this slice does not broaden into response-cookie protocol redesign, and it must not log or
serialize that value.

Two mechanical controls are warranted because the failure is repeatable, the predicates are structural and the
cost is minute-scale:

- `security-boundaries` rejects any `@CookieValue` in an edge controller and its production-path self-test
  injects one into a real controller source.
- `code-layout` verifies package declaration/path equality for all **398** final Java sources under all **11** backend
  `src/main/java` roots (the pre-change audit had 396; this slice adds the two face-local cookie types), not only
  the 287 app sources; its self-test creates a mismatched production package path.

Focused owner tests prove platform and workspace flow/grant credentials preserve existing invalid, OTP and
one-time-complete semantics.  Architecture tests add two explicit ArchUnit rules: platform edge classes may not
depend on `..app.edge.operations.session..`, and operations edge classes may not depend on
`..app.edge.platform.session..`; they permit only the shared non-secret `..app.edge.session.EdgeRequestContext`
and prove both directions red with dedicated import fixtures.  Compile/test evidence is required before package exit; business evidence is
`REQUIRED_CURRENT_SOURCE_AND_FOCUSED_OWNER_TEST_PROOF`, cleanup is `PASS`, and no DEV/seed/reset is used.

## 4. Exclusions

- Do not add a generic token service, a new session protocol, an owner-to-edge raw-token accessor, or controller
  logging.
- Do not treat the stale M1 report as an instruction to alter the P6 historical review binding or re-label its
  `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` state.
- Do not move face-local resolvers into a common `edge.session` package, restore raw controller parameters, or
  weaken owner revalidation/anti-enumeration behavior.
