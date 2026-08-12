# Final managed lifecycle adapter design intake

implementationAuthority: false

## Confirmed root cause and bounded reuse

The final dynamic workload is blocked because the current final runner only accepts seven caller
callbacks and rejects `--run`; `backend-performance-workload.mjs` likewise accepts an arbitrary
fixture materializer.  That is one missing lifecycle-adapter family, not seven independently
missing callbacks.  It cannot be repaired by treating static unit tests as runtime proof.

The finite sibling scan is as follows:

| existing boundary | disposition | reason |
| --- | --- | --- |
| `scripts/dev/http-diagnostic-runner.mjs` | refactor its identity/process/tunnel/remote-cleanup primitives only | its public plan, RM1 namespace, headers, bootstrap and four workloads are closed RM1 semantics and must not be called by the final runner. |
| `scripts/dev/r5-dev-runner.mjs` | no dependency | it owns persistent DEV plus `r5-full` seed and fixed R5 root; neither is an isolated final run. |
| `scripts/test/r5-remote-testcontainers.mjs` | invoke only as an existing nested focused-Testcontainers command | it remains a remote JVM/Docker technical proof, writes below this final run's nested technical-evidence directory, and is never the final HTTP runner, fixture producer, snapshot provenance or browser/L2 evidence. |
| `scripts/dev/managed-process-tree.mjs`, `scripts/dev/r5-remote-host-trust.mjs`, `scripts/env/check-runtime-resource-budget` | direct primitive dependencies | each already enforces exact local identity, allowlisted remote-host binding or resource preflight without importing RM1/R5 workload semantics. |

## Approved final-only adapter topology

`scripts/dev/backend-performance-runtime-runner.mjs --run` must be the only public entry.  It
loads the active dynamic package and refuses unless its package id is
`BACKEND-PERFORMANCE-FINAL-DYNAMIC-ACCEPTANCE-20260810`, `runtimeAuthority=true`,
`minimalFixtureAuthority=true` and `resetAuthority=false`.  It then constructs the existing
final plan and delegates to a new final-only adapter; it must not accept callbacks, an arbitrary
run root, a caller-selected namespace, a credential file or a snapshot path.

```text
backend-performance-runtime-runner --run
  -> backend-performance-final-managed-adapter
       -> resource-budget + exact remote namespace preflight
       -> existing remote Testcontainers command (nested technical proof)
       -> final isolated local backend + managed tunnel
       -> backend-performance-final-fixtures (private state and 396 requests)
       -> backend-performance-workload (final headers only)
       -> evidence-snapshot --create, then final-acceptance --check
       -> exact owned local/remote cleanup and readback
```

The adapter alone owns local `pid/pgid/startToken/commandSha256` records, the remote host
binding, final database role/database/object-prefix identities, phase/heartbeat/log inspection,
five evidence paths, first failure, last known good, broken boundary, and separate
`business`/`cleanup` fields.  It performs remote work only through its reviewed implementation,
after `r5-remote-host-trust` validation; no caller, workload or reviewer issues SSH, SQL,
process or object-storage commands.  Cleanup may terminate only process groups whose current
identity matches this manifest; it drops only this run's exact database/role and verifies that
database, role and object prefix are absent.  It never calls reset, starts a browser, deploys, or
uses an RM1/R5 runtime root.

## Exact implementation surfaces

| surface | disposition | required responsibility and red proof |
| --- | --- | --- |
| `scripts/dev/backend-performance-runtime-runner.mjs` and `.test.mjs` | update | Replace callback-only `--run` refusal with active-dynamic-package admission and the sole final adapter call.  Red: static package, reset authority, non-final active package, injected callback and historical root are all rejected. |
| `scripts/dev/backend-performance-final-managed-adapter.mjs` and `.test.mjs` | create | Own the seven ordered phases, local/remote identity manifests, nested Testcontainers result ingestion, log/heartbeat stall diagnosis, snapshot/admission order and idempotent exact cleanup.  Tests use injected child/process/remote seams only; production has no caller callback seam.  Red: stale remote identity, foreign local PID, skipped technical proof, snapshot-before-workload, missing or mismatched trim package-exit validation evidence, final-admission failure and cleanup readback failure. |
| `scripts/dev/managed-isolated-local-runtime.mjs` and `.test.mjs` | create | Extract only the reviewed host-trust, provision/tunnel/start/identity/cleanup mechanics currently private in `http-diagnostic-runner`; its closed profile allowlist is exactly `rm1-http-diagnostic` and `backend-performance-final-acceptance`.  It never receives arbitrary shell text, a host, an SQL string, a command, or an arbitrary root from its caller. |
| `scripts/dev/http-diagnostic-runner.mjs` and `.test.mjs` | update | Delegate existing RM1 lifecycle mechanics to the extracted primitive while preserving its current RM1 plan/root/headers/workload behavior.  Focused regression proves RM1 input cannot enter the final profile and final input cannot enter RM1. |
| `scripts/test/backend-performance-final-fixtures.mjs` and `.test.mjs` | create | Build the isolated owner-HTTP fixture state and materialize every final request from private typed state.  It writes the final run's redacted `seed-report.json` (fixture calls grouped by owner/operation/route and correlation join), never raw request/response/credentials.  No route/body/default-ID inference is permitted. |
| `contracts/policy/backend-performance-final-fixture-catalog.json` and `scripts/check/backend-performance-final-fixture-catalog` | create | The literal 396-row source-bound fixture denominator: `(area, fixtureId, operationId, method, routeTemplate, preparationProcedure, materializerId, success/readback expectation)`.  It has one matching row for each workload recipe and no other row.  The checker proves exact-set equality with `backend-performance-workload.mjs`; red: missing/duplicate row, generic materializer, route/method drift and unbound prerequisite. |
| `scripts/test/backend-performance-workload.mjs` and `.test.mjs` | update | Consume only the final fixture adapter/catalog rather than a caller callback; retain the final headers and reject materialized method/path/fixture drift. |
| `scripts/check/backend-performance-evidence-snapshot` | retain | The adapter invokes its existing `--create --run-dir <own-final-run>` command only after all 396 responses are complete.  No historical snapshot is an input. |
| `scripts/test/backend-performance-final-acceptance.mjs` and `.test.mjs` | update | Require final run manifest terminal business/cleanup evidence, final adapter kind and nested Testcontainers manifest digest in addition to the existing final kind/run/digest/HMAC/exact-set checks.  Red: a structurally valid `.runtime/r5` or RM1 snapshot, a correct HMAC from a wrong final manifest, or `cleanup!=PASS`. |
| `contracts/policy/backend-performance-final-workload.json` and `.test.mjs` | update | Bind final implementation manifest digest (not design manifest), fixture-catalog digest and adapter manifest contract; preserve all 396/78/5/79/38/196/M1–M6 denominators. |

`HttpRequestMetricsInterceptor` is an already-present final-only server boundary, not a lifecycle
adapter change: the final adapter supplies its declared final profile, run id, HMAC key, event
paths and `v2s-backend-performance-*` namespace.  The adapter must not add a second client-side
event writer or post-process JSONL.

## Fixture and evidence invariants

The fixture catalog is the indispensable finite design input: the current policy and generated
route registries supply operation/method/path, but deliberately do not supply valid entity ids,
typed request bodies, sessions, replay/CAS predecessors, asset grants or owner readbacks.  A
generic replacement therefore cannot deliver the claimed 396 dynamic observations.  The new
catalog binds those exact materialization facts to named source procedures and keeps secrets,
cookies, raw bodies and raw responses in private in-memory state.  All fixture creation uses the
normal owner HTTP command/readback path in the same isolated namespace; no direct SQL seed and no
new production HTTP capability are permitted.

The only final evidence root is
`.runtime/backend-performance/<final-run-id>/`.  Its manifest records final implementation and
workload-policy digests, nested Testcontainers manifest digest, five snapshot input locations,
fixture report digest, resource observations and cleanup readbacks.  Only after the workload has
all 396 successful source-bound observations may the adapter create the content-addressed
snapshot and immediately invoke final admission with the in-memory HMAC key.  Admission failure
sets `business=FAIL`; it never publishes a measured-success status.  `business=PASS` requires
the exact U05/U04/U07 sets and existing HMAC/cap/component/unclassified rules; completion still
requires independent post-evidence implementation review and Claude review.  `cleanup=PASS`
requires all owned local tree, remote database/role/object-prefix and nested Testcontainers
cleanup readbacks.

## Design conclusion

This is implementable with a single final-only adapter plus the closed fixture catalog; no
external authority or manual operation is missing.  Runtime remains forbidden in this design
package.  The next package must be a static adapter-implementation package, run the listed unit
and source controls, then obtain fresh static implementation review before activating the already
separate dynamic acceptance package.

## Mechanical dynamic-admission and fixture contracts

The static adapter package writes one immutable `final-dynamic-admission.json` beside its package exit.
The public `--run` rejects every active dynamic package unless this record binds the static package id,
exit digest, a static-package-time successful `validate-package-exit` trim-observation result and its
stdout/log digest, final implementation-manifest digest, implementation review cycle id/Round
2/`SELF_DECIDED`/`GO`, workload-policy digest, dynamic package id, `runtimeAuthority=true`,
`minimalFixtureAuthority=true`, and `resetAuthority=false`. The admitted static exit must have
`staticProofStatus=PASS`, `exitMode=TRIM_OBSERVATION_PATH_LIST_ONLY`, and nonempty unique
`changedPaths` each within that static package's approved surface. The derived admission predicate is
`changedPathsWithinApprovedSurface=PASS`; it is valid only when bound to that successful CLI evidence.
It proves an approved-surface subset, **not** after-hash equality or receipt-set equality; the admission
record must not contain or claim `afterSha256AndReceiptExactSet=PASS`. `minimalSeedAuthority` is not an
alias. Missing validation evidence/exit, altered review binding or stale policy digest are red cases.

The catalog has exactly 396 rows. Every row binds `sourceAnchor` (`path#exportedProcedure` plus source
hash), a closed `materializerKind`, typed `pathParameters`, and named `prerequisiteReadback`. The adapter
rejects generic materializers, anchor/hash mismatch, missing CAS/replay/readback prerequisite, and an
actual path not produced from the row template. Secrets and raw request/response bytes remain private.

Nested Testcontainers proof is adapter-owned: fixed allowlisted focused Gradle task, adapter-owned nested
runtime path, parent final-run id and verified remote-host fingerprint. Its child manifest must bind those
fields, phase/heartbeat/log evidence and `business=PASS` plus `cleanup=PASS`; final admission parses it.
Default `.runtime/r5`, foreign parent, alternate task and child cleanup failure are red cases.
