# RM1 P6-1 implementation author intake

`REVIEW_CYCLE_ID=RM1-P6-U01-OBSERVABILITY-EXTENSION-IMPLEMENTATION-20260730`

`REVIEW_ROUND=2/2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

## Purpose and source

P6-1 implements the approved public authentication/recovery and diagnostic-observability unit:
account plus owned mobile plus OTP recovery, non-sensitive public error correlation, and a
bounded/reclaimable managed verification runner. The implementation source is
`doc/evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md`.

## Independent findings and disposition

| Finding | Disposition | Closure |
| --- | --- | --- |
| OTP debug code had an external `testCode` surface | CONFIRMED | Public field is `debugVerificationCode`; the capability invariant has an exact owner allowlist and red checks. |
| Controllers could reach raw servlet request facts through `EdgeRequestContext` | CONFIRMED | The context exposes only correlation and a non-reversible rate-limit fingerprint; session values are owner-local. |
| Correlation could reflect a caller value unsafely | CONFIRMED | The diagnostic request state sanitizes or generates correlation IDs. |
| Recorder fallback duplicated edge logging | CONFIRMED | Fallback is now the foundation-owned `SecurityDiagnosticRecorder#recordWriteFailure`. |
| Positive debug OTP serialization was missing | CONFIRMED | `OtpDispatchWireSerializationConfigurationTest` verifies the approved public field and absence of `testCode`. |

The dynamic full suite then exposed one same-root counterexample: `PlatformAuthenticationController`
still accepted `HttpServletRequest` in six controller-local exception handlers. The generic failure
mode is controller-local use of servlet primitives after a shared public-problem/diagnostic adapter
exists. The finite denominator is all `*Controller` production classes under
`apps/backend/catering-business-server/src/main/java`; the existing ArchUnit rule is the durable
prevention control. The minimal repair removed all six local handlers and completes their exception
mapping in `ContractProblemAdvice`, which is the approved servlet-owning adapter. A direct focused
boundary test and the managed full suite both passed after this repair.

No third independent subagent review was opened: this cycle has reached its mandatory two-round
limit. This document records the author-side evidence disposition only.

## Final evidence

- Focused local boundary/authentication/diagnostic tests: PASS.
- `node scripts/test/r5-remote-testcontainers.mjs --self-test`: PASS, including close-race,
  liveness, lifecycle, diagnostics and cleanup red checks.
- `node tools/capability-invariants/cli.mjs check`: PASS; typed-problem exact inventory is 83.
- `node tools/compliance-control/cli.mjs static-scan` and `validate-delta-receipts`: PASS.
- Managed full backend suite: `BUSINESS=PASS`, `CLEANUP=PASS` at
  `.runtime/r5/evidence/remote-testcontainers/r5-tc-1785349020357-8225`.

