# Final catalog-contract design — independent Round 2 review

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=2`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`ROUND_FINAL_DECISION=SELF_DECIDED`

## Independent method and inputs

Fresh v2s-rooted, source-first review. I reopened `AGENTS.md`, `CLAUDE.md`,
`PLATFORM-BLUEPRINT.md`, the active `V2S_W0_W4_EXECUTION` Roadmap, all six
project-memory kernels, and the contract/evidence routes for
`review/backend/backend/backend/{contract,evidence}/review`. The bound manifest
(`33c3d9c69d8b722e8839ec326c5119a9ca5ad36f22d97f3a4df42371c296be00`),
design, authorization, catalog owner/controller, canonical OpenAPI and assertion
matrix were checked before the Round 1 report and author intake. The Round 2
checklist is
`doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-review-round2-input-checklist.md@e3472edf7b28051bf90505f4f91a1df97a4f74eb0e5f72aac88749a84aa74113`.

`scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE`
passed (alias `R5`). `scripts/check/implementation-design-granularity --self-test`
also passed all declared red controls. No runtime, DEV, Testcontainers, seed, reset
or dynamic evidence action was run.

## Round 1 recheck

- `FINAL-CATALOG-DAG-R1-M-000` — `CONFIRMED_FIXED`: both bound design and
  authorization now contain a raw standalone `implementationAuthority: false`.
  The validator proceeds past the prior authority check.
- `FINAL-CATALOG-DAG-R1-M-001` — `CONFIRMED_FIXED`: `FINAL-U02` declares
  exactly six future technical paths, and explicitly excludes catalog/checker/
  materializer/workload/adapter conversion pending a separately bounded design.
- `FINAL-CATALOG-DAG-R1-S-001` — `CONFIRMED_FIXED_AS_DESIGN`: the sixth-path
  set includes the new focused operations edge integration test. Its declared
  proof is bounded to explicit selected node, live capability, server grant,
  catalog-owner recheck and the one canonical envelope; it does not add an API
  or capability. The test does not yet exist, as expected for design-only work.
- Temporary external-order preparation remains the normal owner HTTP
  create -> save -> detail -> preflight -> execute path. The design prohibits
  terminal fixtures, direct SQL, RM1/R5 reuse, reset and seed. Dynamic authority
  remains false and no final runtime-evidence root exists.

## Findings

### M — FINAL-CATALOG-DAG-R2-M-002: manifest cannot bind its first approved source

`FINAL-U02.approvedSources[0].anchor` is
`## Finite executable-DAG contract`, but the hash-bound design contains only
`## Finite executable-DAG follow-on boundary`. The unique-anchor check therefore
fails before any review JSON is considered:

```text
IMPLEMENTATION_DESIGN_GRANULARITY=FAIL
REASON=UNIT_SOURCE_FINAL-U02_1_ANCHOR_NOT_UNIQUE:0
```

This is a real package-admission failure, not a semantic-validator gap: the
manifest is expected to bind the exact design source and cannot currently do so.
It prevents validation of the corrected design and means the claimed Round 2
admission cannot be established. The smallest repair is to make the manifest
anchor exactly match the unique heading in its already hash-bound design (or
make an explicitly reviewed design-heading correction and recompute bindings).
Do not broaden the six paths, alter OpenAPI/capabilities, or begin any static or
dynamic work to bypass this control.

## Solution reasonableness

The two response-shape corrections are appropriately smaller than attempting
the 592-binding fixture DAG now. Retaining owner-local authorization and adding
one focused HTTP handoff test is proportionate; a new API, capability, generic
dispatcher or runtime fixture would be needless scope expansion. However, a
design that cannot pass its own source-binding admission is not ready for the
next package.

## Verdict

**NO_GO — M=1, S=0, N=0.** `FINAL-U02` remains blocked solely by
`FINAL-CATALOG-DAG-R2-M-002`. This is Round 2's hard-stop decision;
`furtherCodexAdversarialRoundAllowed=false`.

Authorization boundary: this is DESIGN review only. It authorizes no source,
contract, generator, capability, migration, static implementation, runtime,
DEV, seed/reset, Testcontainers, browser L2, UAT, data operation or repository
control action. A corrected design/manifest still requires the prescribed Claude
recheck before implementation can be considered.
