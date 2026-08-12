# Final managed lifecycle adapter — independent DESIGN review, Round 1

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_ADAPTER_DESIGN_20260810`  
`REVIEW_ROUND=1` / `REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

## Independence and input readback

I performed this review as a fresh independent subagent.  Before reading the
author's conclusion, I reopened the declared design manifest and authority input, then the current
final runner/workload/admission and the three proposed reuse boundaries to try to construct a
measured-success path that is not owned by the final adapter.  I did not modify production sources,
the design, package authority, or any runtime resource; no dynamic command was run.

| input | SHA-256 / evidence read |
| --- | --- |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-granularity-manifest.json` | `784386cb6c03bb13f5499f8ce182d9f61122b40aeb2664f646079a3d1e3ef3a3` |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md` | `150e06e07a64e172d166ee0fa1eca8c8c07fa0add6d2e39c090c8afcb9a1b746` |
| `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-adapter-design-input.json` | `b4e8f684123821d4cdbea97b3938e3855960075c948bfd9c223c3155a9af6f06` |
| review input checklist | `acd2abf65e1f4a692546952e4450a9541d68a804f821cf49a2d9a2ba6caafd0d` |
| current final runner / workload / admission | `5da91721…dd1e9`, `45c1c49b…43bcec`, `616d72cd…24c7e9` |
| current RM1 runner / R5 DEV runner / remote Testcontainers runner | `bf2fb27e…60875f`, `557246e1…8dd5c`, `9c540968…752a85` |

The finite 396 denominator itself is real in the current workload: 78 task-read + 5 protocol +
79 numeric + 38 context-parity + 196 U07 routes.  The final server interceptor also derives the
operation/route from the actual matched route rather than trusting the assertion header.  Those are
useful existing constraints, but they do not close the following adapter-contract gaps.

## Verdict

**NO-GO — M=4 / S=0 / N=0.**

The design correctly identifies a single adapter family and rejects RM1/R5 workload reuse.  It is
not yet implementation-ready because three required trust boundaries are described but not made
executable enough to rule out a false final admission.

## Material findings

### M-00 — The implementation-facing design itself is not mechanically design-only

The manifest correctly says `implementationAuthority: false`, but the actual design intake does
not contain that required literal.  The existing gate therefore fails on the reviewed bytes:

```text
IMPLEMENTATION_DESIGN_GRANULARITY=FAIL
REASON=DESIGN_IMPLEMENTATION_AUTHORITY_NOT_FALSE
```

This is not a cosmetic declaration: the gate is the package's fail-closed mechanism for preventing
an implementation-facing design from being misrepresented as implementation authority.  The
intake's prose that runtime remains forbidden ([design:93-98](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md)) does not satisfy that separate
authority control.

**Minimal repair:** add a standalone `implementationAuthority: false` line to the design intake,
refresh its hash in the granularity manifest and Round-2 input binding, then rerun the existing
granularity check.  Do not broaden the package authority.

### M-01 — Dynamic authority is only a flag check, not a serial-admission proof

The proposed public entry checks only active-package identity plus
`runtimeAuthority=true`, `minimalFixtureAuthority=true`, and `resetAuthority=false`
([design:21-26](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md)).
It does not require the exact final static implementation package exit, its changed-source receipt,
the final implementation manifest digest, or the final Round-2 independent static-review verdict.
That is a real bypass: an active JSON claiming those four fields can reach the adapter although the
listed static implementation proof has not occurred.  The current runner already demonstrates the
same weak authority shape: `executeManagedFinalAcceptance` only tests two boolean fields
([runner:48-51](../../../scripts/dev/backend-performance-runtime-runner.mjs)).
There is also an immediate spelling/contract divergence: the already-recorded dynamic input uses
`minimalSeedAuthority`, while this design requires `minimalFixtureAuthority`; no canonical package
schema says which one the future runner must enforce.

**Minimal repair:** define one immutable dynamic-admission record, produced only after the static
adapter package exit and static Round-2 review.  Bind and validate: static package id, package-exit
digest, final implementation-manifest digest, receipt/exact-path status, review-cycle id/round/final
verdict, workload-policy digest, and the dynamic package id/authority fields (including one canonical
`minimalFixtureAuthority` name).  The public runner
must read that record itself and fail closed if any binding is absent or changes.  Add red tests for
a hand-authored dynamic active package with valid flags but missing/mismatched static exit or review
binding.  This preserves the existing separate dynamic package; it does not introduce a new
approval process.

### M-02 — “396 source-bound fixtures” lacks a machine-readable source and materialization contract

The proposed catalog row has only `(area, fixtureId, operationId, method, routeTemplate,
preparationProcedure, materializerId, success/readback expectation)` and the proposed checker is
required to prove only exact-set equality with workload recipes ([design:58-60](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md)).
Neither field identifies a checked source anchor, typed input/output contract, prerequisite
readback, nor actual path-template binding.  The current workload accepts any callback and checks
only `/api/` plus the HTTP method ([workload:50-57](../../../scripts/test/backend-performance-workload.mjs)).
Thus a 396-row literal catalog can have exact route/method/fixture keys yet map every row to a
generic/default-ID materializer, omit a CAS/replay predecessor or owner readback, and still satisfy
the described exact-set checker.  It can even supply a different same-method `/api/` path; the
server correctly marks the request failed on route metadata mismatch, but the design has not made
that an adapter-side source-bound invariant or a pre-request rejection.

This is material because the design itself identifies session, typed body, CAS/replay, asset grant
and owner readback as facts the registries do not supply ([design:72-79](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md)).

**Minimal repair:** make every catalog row bind a finite `sourceAnchor` (`path#exportedProcedure`,
with the approved source hash or registry entry), a closed typed materializer discriminator, a
named prerequisite/readback assertion and a path-template parameter contract.  The fixture adapter
must reject a materializer not in that closed table, reject an actual path not matching the row's
template, and require the row's prerequisite/readback result before it returns the request.  Extend
the catalog checker and focused reds for: generic/shared materializer substitution, missing source
anchor, missing CAS/replay/readback prerequisite and actual-path/template drift.  Keep secrets and
raw bodies in memory as the design already requires.

### M-03 — Nested Testcontainers proof is not bound to the final run or an exact focused task

The topology says to invoke the existing remote Testcontainers command and later records only its
manifest digest ([design:29-37](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md),
[design:61-63](../../review/platform/2026-08-10-v2s-backend-performance-final-adapter-design-intake.md)).
But the existing command accepts caller process arguments, defaults its output root to
`.runtime/r5`, labels its run `r5-tc-*`, and has a fixed R5 remote cache
([r5-remote-testcontainers:13-26](../../../scripts/test/r5-remote-testcontainers.mjs)).  A digest
alone proves only bytes, not that its manifest was produced under this final run, from an approved
focused task, after this run's resource preflight, or that its cleanup was read back before local
workload execution.  The current final admission does not inspect such a nested manifest at all;
it only reads the final run manifest's kind and two digests
([final-acceptance:104-113](../../../scripts/test/backend-performance-final-acceptance.mjs)).

**Minimal repair:** specify a final adapter-owned invocation contract for the nested technical
proof: fixed task allowlist, adapter-set final nested runtime directory, parent final-run id,
host-fingerprint binding and a required terminal child manifest schema.  Require final admission
to parse that child manifest and assert parent-run binding, exact task, host binding, ordered
technical phase/heartbeat/log evidence, and both child business and cleanup PASS—not merely its
digest.  Add red fixtures for default `.runtime/r5`, foreign parent run, alternate Gradle task,
and a child `cleanup=FAIL`.  This uses the existing runner as a nested technical command, rather
than reusing its R5 root or turning it into the HTTP workload.

## Positive checks / non-findings

- The plan keeps `backend-performance-runtime-runner --run` as the sole public entry and explicitly
  forbids caller callback injection, arbitrary roots, namespaces, credentials and snapshot paths.
- The seven-phase ordering places snapshot after workload and cleanup after admission, and the
  current interceptor records server-canonical matched operation/route plus HMAC-bound evidence.
- Existing RM1/R5 public workload roots are excluded in the design; no runtime was executed here,
  and the design package remains `implementationAuthority=false`, `runtimeAuthority=false`.

## Required Round 2 scope

Round 2 must only verify the four repairs above against the changed design/manifest/checklist:

1. design-only authority literal and refreshed binding;
2. immutable static-to-dynamic admission binding;
3. finite per-row source/materialization/readback and actual-path contract for all 396 fixtures;
4. final-parent-bound nested Testcontainers invocation/admission.

No third independent round is permitted for this cycle.  A GO in Round 2 would mean only that the
adapter design is ready for its separate static implementation package; it would not authorize or
claim a dynamic measurement.
