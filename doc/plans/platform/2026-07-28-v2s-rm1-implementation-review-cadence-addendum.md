# RM1 implementation review cadence addendum

## Status and binding

This is a Dexter-authorized execution addendum to
`doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md`.
It does not alter that immutable design's bytes, historical review status, Roadmap `CURRENT_*`, approved
scope, user journeys, or delivery-unit source denominators.

## Required cadence

After every serial RM1 delivery package reaches its own package-exit `PASS`, Codex must stop before
activating the successor package and provide Dexter with a copyable Claude implementation-review brief.
The stop applies to the execution topology exactly as written in the approved plan:

`P0 → P3-A → P3-B → P3-C → P1 → P2 → P4 → P5 → P6 → P3-D → P7 → P8`.

`P3-A`, `P3-B`, `P3-C`, and `P3-D` are independently stopped review packages; they are not merged into
one deferred P3 review. A Claude `GO` does not change Roadmap state or expand authorization. A Claude
`NO-GO`, M, or S finding is only a hypothesis until Codex performs the required owning-source/code/evidence
reopen, same-root scan, counterexample search, and disposition.

## Successor activation rule

For each package, successor activation requires all of the following:

1. The predecessor package's actual-file receipts, six-denominator source disposition, static/full-scan,
   business result, and cleanup have its own package-exit `PASS`.
2. The predecessor's independent `REVIEW_TARGET=IMPLEMENTATION` subagent review is recorded under the
   existing two-round cap.
3. Codex has delivered the Claude review brief and is paused for Dexter/Claude review. No code, contract,
   migration, test, runtime, DEV, seed, reset, or successor-package baseline action may begin while that
   review is pending.
4. Dexter explicitly resumes the next package after considering Claude's result. This addendum changes
   review cadence only; it does not permit changes to business scope or interaction decisions.

## Current checkpoint

`P0` has package-exit `PASS` at
`doc/evidence/platform/rm1/p0/rm1-u01-package-exit.json`. Its Claude implementation review is now pending.
Accordingly, `P3-A` remains unactivated until Dexter resumes after that review.

