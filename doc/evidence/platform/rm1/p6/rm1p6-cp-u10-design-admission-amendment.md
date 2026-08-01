---
title: RM1 P6-1 observability extension design-admission interlude
packageId: RM1P6-CP-U10
status: ACTIVE_CONTROL_PLANE
---

# RM1 P6-1 observability extension design-admission interlude

## 1. Why this interlude exists

P6-1 lets an unauthenticated person authenticate or recover access.  Dexter's accepted observability
standard requires that its remote verification and public security boundaries be diagnosable without exposing
passwords, OTPs, tokens, cookies, mobile numbers, login names, raw IPs or payloads.  The confirmed 500
finding further shows that the runner lifecycle and foundation-owned diagnostic boundary need a detailed
design before code.  An agent-discovered edge-root projection defect is also an input: an edge must not be
treated as the source of owner truth merely because it projects a public result.

Dexter explicitly authorized the P6-1 observability extension and this design-admission interlude.  The
authority is the direct 2026-07-29 instruction plus
`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` and the confirmed
`P6_SCRIPT_AND_CODE_DIAGNOSTIC_OBSERVABILITY_GAP` discovery.  This document records only the admission
boundary; it is not an author implementation design.

## 2. Exact permitted design work

Only the exact document paths enumerated by `rm1p6-cp-u10-control-plane-manifest.json` may be written.
Those future documents may define an implementation-facing extension amendment, exact source denominators,
granularity manifest, and up to two fresh independent-design review rounds.  Before any implementation is
considered, the design must reopen the business requirement, the observability standard, all 500 S01/C01
denominator sources, and the edge-root projection defect's owning sources; it must specify owner truth,
safe immutable fields/redaction, trusted correlation authority, runner liveness/cleanup semantics, tests and
real red mutations.

## 3. Prohibitions and handback

This interlude authorizes no runtime or generated change.  In particular it excludes runner, foundation,
backend, OpenAPI, generated, migration, frontend, DEV, seed, reset and Roadmap-state paths.  It cannot make
the observability extension implementation-ready, claim business/dynamic PASS, or alter U01's business
baseline, receipts, input or evidence.

`RM1P6-U01` remains unfinished and therefore is not CP-U10's serial predecessor.  CP-U10 binds the existing
PASS `RM1-U08` exit and, once its control-plane exit passes, restores U01's active pointer with exact
SHA-256 `f319e1974205ea5316ef64c1e56d1df2935fece982a140365e2e8077cd7cd91e`.
