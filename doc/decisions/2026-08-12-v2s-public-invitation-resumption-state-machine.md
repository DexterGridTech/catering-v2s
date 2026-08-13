---
title: Public invitation resumption state machine
status: DEXTER_AUTHORIZED_ROOT_CAUSE_REPAIR
---

# Public invitation resumption state machine

## Problem and owning sources

The public invitation screen must rebuild safely after a refresh or a user returning from a later step.  The approved interaction source says "刷新从 get view 重建" and keeps the user journey as invitation detail → accept → mobile verification → account readiness → completion (`doc/decisions/2026-07-28-v2s-rm1-ia-01-platform-otp-and-invitation-interaction.md`, IA01-PUBLIC-INVITATION through COMPLETE).  The owner is `workspace-iam`; the public edge and operations-admin only consume its readback.

The failure was a projection mismatch: owner `ACCEPT_INTENT_RECORDED` was flattened to public `ACTIVE`, so the client presented a second accept action.  The correct owner rejection on that repeated state was then discarded by a generic frontend catch block.

## State projection

Internal status is not a public management-status enum.  `PublicInvitationView.nextStep` is the explicit, closed resume projection:

| Owner state / expiration | `nextStep` | User-visible action | Mutation rule |
| --- | --- | --- | --- |
| `PENDING`, unexpired | `ACCEPT` | 同意邀请 | `acceptPublic` records consent once and returns `VERIFY_MOBILE`. |
| `ACCEPT_INTENT_RECORDED`, unexpired | `VERIFY_MOBILE` | 继续验证手机号 | OTP send and verification are allowed. |
| `MOBILE_VERIFIED`, unexpired | `VERIFY_MOBILE` | 继续验证手机号 | A fresh OTP verification rotates the short-lived grant; no grant is persisted into the browser. |
| `CREDENTIAL_READY`, unexpired | `FINALIZE` | 继续完成加入 | Only completion is exposed. |
| `COMPLETED`, `CANCELLED`, `EXPIRED`, or elapsed expiry | `TERMINAL` | terminal result | No public mutation is exposed. |

`WorkspaceInvitationStatus` remains the existing management/public display enum and continues to map non-terminal owner states to `ACTIVE`; it is not used to choose the resume action.

## Invariants and recovery

1. Repeated accept is convergent for the unexpired resumable states: `PENDING` performs the single CAS/audit transition; `ACCEPT_INTENT_RECORDED`/`MOBILE_VERIFIED` return `VERIFY_MOBILE`; `CREDENTIAL_READY` returns `FINALIZE`. Terminal or expired records still receive the typed terminal rejection.
2. A resumed mobile verification can issue and consume a new OTP from `MOBILE_VERIFIED`, replacing the old opaque verification grant. This never creates an account or assignment.
3. Credentials still require the current grant, and only `completePublic` creates assignments. Completion retains its existing replay behavior.
4. The frontend uses `nextStep` for its CTA and uses `operationsProblemOf(error).detail` for typed public Problem feedback. It must never render contract diagnostics or turn a known typed Problem into the generic fallback.

## Contract and test matrix

| Surface | Required proof |
| --- | --- |
| OpenAPI → generated Java/TypeScript | `PublicInvitationView.nextStep` is required and closed; accept response permits `VERIFY_MOBILE` or `FINALIZE`; generated outputs only come from controlled edge-codegen. |
| owner state machine | Testcontainers proves initial `ACCEPT`, duplicate accept convergence with exactly one accept audit, reload after acceptance and after mobile verification, grant rotation, `FINALIZE`, `TERMINAL`, and exactly one final assignment. |
| frontend consumer | Architecture test proves the public entry consumes `view.nextStep` and normalizes failures through `operationsProblemOf`. |
| red discriminators | Removing the view projection, returning an accept CTA after a resumable state, rejecting `MOBILE_VERIFIED` OTP renewal, or replacing typed-error normalization with a bare catch makes the focused proof or contract/typecheck fail. |

This repair does not authorize L2, reset, seed, UAT, deployment, manual SQL, or any BPF result.
