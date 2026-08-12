# Independent fixture-assembler design review — Round 1

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_FIXTURE_ASSEMBLER_DESIGN_20260810`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`VERDICT=NO-GO`  
`M=2 / S=0 / N=0`

## Independence and input record

I performed this as a fresh independent adversarial review. Before reading the
author amendment or catalog, I reopened the mandated rules, routed memory,
workload denominator, generated registries and contract sources, and attempted
to falsify the fixture-plan design. I did not read an earlier reviewer verdict
before producing this verdict, and I did not edit a production or design source.

The reviewed checklist was:

| input | SHA-256 at review | purpose |
| --- | --- | --- |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-fixture-assembler-design-review-input-checklist.md` | `58b333ef251da278327808dab0c39a367b9795c29eab0c370054fae68ac4e270` | mandatory Round 1 input list |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-design-amendment.md` | `45e7732459bf3a2dba270b48d71527914ae60b6fe26e4835b39eedeae2fbb093` | author design amendment originally reviewed |
| `contracts/policy/backend-performance-final-fixture-catalog.json` | `6cdf737218df5f50539496e43453c0d8ce932aecda39aca2d3fbf2df85e723b5` | literal 396-row fixture-plan oracle originally reviewed |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-granularity-manifest.json` | `e05e32518d3b6bad3b844e7eed9e02f69b9d1e692b7b0c3f300b66a71ae4268c` | implementation-admission boundary originally reviewed |

At artifact creation, the amendment/catalog/manifest bytes have changed to
`a72367dcdfde59de9c296157848794f2e95b08f03e21aefdc59e87cd73e4b6db`,
`5e63aadba8fe363d2f117c5cc59404e6080f55385b11ce14a2c9723f57c72682`, and
`f31f9fafabc416cd12fee913282cfe7e2c7bcb1864e53cc8a6f8d60a138fcebe`
respectively. This Round 1 verdict therefore applies only to the immutable
reviewed bytes above; it is not a verdict on those later bytes.

## Checks that passed for the reviewed bytes

- The exact workload denominator was 396 rows / 196 operations: 166 GET rows;
  230 command rows split into 216 JSON, 12 no-body and 2 multipart rows.
- The catalog contained 462 path-binding occurrences and 46 query operations /
  92 query rows, partitioned 113 command operations into 13 command families,
  with 103 reusable algorithms and 10 new builders.
- An independent parser comparison to the generated route registries and
  OpenAPI shards found zero current method/path/required-query/success-status/
  transport mismatches for the 396 rows.
- `scripts/check/backend-performance-final-fixture-catalog --check` and
  `--self-test` passed. The static runner CLI rejected missing dynamic admission.

## Findings

### M-01 — predecessor, readback and status declarations are not source-bound

The amendment says every declared ID must name allowed operation/fixture set,
input readbacks and source anchor/hash, and says the checker recomputes OpenAPI
parameter and transport requirements. In the reviewed catalog,
`predecessorPlanId` was only a `PREDECESSOR_<family>` naming convention: there
was no predecessor declaration with ordered owner HTTP calls, producing
readback keys, input readbacks, response selectors or an owning source anchor.
Family, preparation-procedure and session declarations were instead anchored to
`createFinalWorkloadRecipes`, which supplies the workload denominator rather
than these owner-HTTP algorithms.

The production checker accepted all three no-write mutations:

1. replace a procedure `ownerHttpSequence` with `UNDECLARED_HTTP_SEQUENCE`;
2. replace a session source-anchor selector with a nonexistent selector; and
3. replace `getExtensionDefinition`'s expected success status from `200` to
   `201`.

This leaves the actual typed predecessor/readback and success-status facts
underdetermined, permitting an implementation to reintroduce the generic
selection the design intends to prohibit.

Evidence: `scripts/check/backend-performance-final-fixture-catalog` lines
25–55 validate a hash and nonempty selector but do not resolve selectors,
declare predecessors or compare a row status with OpenAPI; the stated
requirement is in the amendment lines 207–243.

Minimum repair: add a finite predecessor declaration per sequence, with every
owner HTTP call's operation/method/template/transport/success status/source
hash and produced readback keys; make families, procedures, sessions, builders
and readbacks reference that declaration; make the checker resolve the owning
OpenAPI/registry source and add the three proven red mutations.

### M-02 — exported execution path accepts forged dynamic authority before admission

The static package claims that runtime is forbidden before independent static
implementation review closes. However, the exported
`executeManagedFinalAcceptance({authority, plan})` accepts a caller-supplied
`runtimeAuthority=true`, `minimalFixtureAuthority=true` and
`resetAuthority=false`, imports the managed adapter, and the adapter accepts
the same tuple before starting preflight/Testcontainers/local runtime phases.
The active-package and dynamic-admission verification occurs only in the CLI
`--run` branch, not in that exported execution path.

Evidence: `scripts/dev/backend-performance-runtime-runner.mjs` lines 50–80
and 87–93; `scripts/dev/backend-performance-final-managed-adapter.mjs` lines
64–75; the implementation manifest's forbidden list at lines 66–71.

Minimum repair: make the sole execution entry obtain and validate authority,
active package, dynamic admission and implementation review itself. Expose only
pure/static test helpers, or require an internally-created validated admission
token that cannot be supplied by a static caller. Add a direct-import forged-
authority red proof.

## Authorization boundary

This is a static DESIGN verdict only. It does not authorize fixture-assembler
implementation, dynamic resources, DEV, reset, seed, Testcontainers, browser
L2 or UAT. The reviewed package remains blocked pending a corrected bounded
design and the next permitted review action.
