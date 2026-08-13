---
name: cs-managed-runtime-execution
description: Safely classify and run authorized reset, DEV, seed, Testcontainers, browser L2, and UAT work through the repository's managed execution boundaries.
---
# cs-managed-runtime-execution

Use this skill before any dynamic environment action or any proposal to change a runner. It
does not grant authority. `AGENTS.md`, the active package, the current Roadmap authorization,
the applicable plan, `scripts/README.md`, and routed project memory decide whether the action
is permitted.

## 0. Routine-command classification

Dexter's operational ruling is explicit: `backend-acceptance`, managed DEV start/restart,
managed reset, and explicit `r5-full` seed are routine managed runtime commands, not
implementation work. `backend-acceptance` is independently invokable: it has no active
implementation-package, numbered/static-predecessor, implementation-design,
implementation-review, or historical-report prerequisite. It derives its finite denominator
from the current semantic HTTP operation contract inside the run. Invoking any routine command
does not, by itself, require an implementation or source-change package.

This classification does not waive the execution boundary. Each command still uses its
existing managed entrypoint, explicit authorization and run-scoped manifest/logs, and still
reports separate `business` and `cleanup` status. A runtime failure is diagnosed from its
first-failure evidence; a confirmed runner or production-source defect is repaired in the
smallest authorized source scope, then the routine command may be rerun without acquiring an
implementation-package or historical-predecessor prerequisite. A timeout extension, retry,
fixture deletion, or status rewrite is never a routine-command fix.

The future public whole-suite entry is `scripts/test/backend-acceptance`; until the approved
implementation creates it, this paragraph is a design contract and must not be used to claim the
capability exists. Discovery starts from the current semantic OpenAPI route registry and
operation-handler bindings, verifies both identity-row exact equality and projection digest
freshness, then maps every operation to exactly one owning route-behavior unit. Java test classes,
annotations and a historical interface count are implementation details, never the denominator.

Before any container is initialized, admission requires every current operation to have non-empty
`identity`, `fixture`, `request`, `businessOracle`, `performanceCriterion`, and `cleanup` declarations.
`correctnessCases` may be empty only with a one-line reason. Contract shape is checked by one generic
OpenAPI/envelope/Problem validator. Missing or stale inputs fail with typed errors before expensive
initialization.

The runner has two modes: per-edit executes only the mechanically derived impacted operations;
package-exit executes the full current denominator. Impact calculation binds an immutable package-entry
production surface `P0` and anchor-covered set `W0`, then independently scans the same exit surface
`P1`. Any existence or full-file hash change in `P0 union P1` outside `W0` makes the impacted set
`ALL`; regenerating the inventory in the same package cannot self-admit a path. Lane count is
configurable rather than fixed. Each lane owns an independent container set, writable database or
schema, and object-storage namespace; a lane stops at its own first failure while other lanes finish
and retain their first failures. An idle lane may take only an unstarted unit whose fixture ownership
is independent. Each lane initializes its environment once.

Treat `ALL` as the normal per-edit capacity model, not a rare fallback: the accepted design found
128 anchored files among 571 checked-in production Java files. Derive the minimum isolated lane
count from the full current denominator's fresh scheduling weights and the per-edit target before
initialization. If the resource manifest cannot provide that many isolated lanes, fail closed with
`BACKEND_ACCEPTANCE_FULL_MODE_CAPACITY_INSUFFICIENT`; never meet time by reducing operations,
dimensions, fixtures, or cleanup. A future reduction in ALL frequency may come only from higher
source-derived anchor coverage, never path exemptions.

Before any operation batch, first baseline write, or baseline decrease, run the fixture-derived
known-cost measurement calibration for LOGICAL_SQL, QUERY, UPDATE, CONNECTION, TRANSACTION, and
BATCH. Expected values come from the immutable fixture definition, never measured output. A no-op
sink, a missing metric, a count mismatch, or correlation drift fails
`MEASUREMENT_SINK_INTEGRITY_FAILED`; a calibration failure forbids baseline creation or acceptance.

During the first unified migration, do not infer the historical replay scope from chat or from a
generic phrase. Read
`doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json` and close its
exact 6 structural-performance rows, 15 HTTP failure families, and 8 seed/client/fixture failure
families by `findingId`. The six structural regressions require route regression cases and jointly
enforce per-call QUERY, CONNECTION, and TRANSACTION at or below each row's DBCR-pre baseline;
connection-only recovery is not closure. Each of the six also requires `QUERY_REDUCED_TO_<n>` with
merge evidence or `QUERY_ALREADY_MINIMAL` with a per-statement necessity account. Restoring a
read-only transaction is allowed only for connection economy, never as a stable-snapshot claim under
default READ COMMITTED, and never closes the finding by itself. A seed-only
disposition for any other row still requires the owning source, affected-route exact set, and fresh
contract/business/cleanup route proof; non-route rows also require the source-derived affected-route
derivation method and its owning source. Historical seed reports are inputs, never current PASS.

Module-owned scenario providers use the reviewed execution contract's closed owner-to-Gradle-module
and test-fixtures-root mapping. Do not derive module paths from owner spelling or centralize providers
in the app suite. Unknown owners and provider path collisions fail before writes. Consumer-face
dispositions also use the contract's closed enum and required evidence; free text, pending work, or
"later" is not a disposition.

The fresh report root is `.runtime/backend-acceptance/<runId>/` and includes a run manifest,
structured logs, operation receipts, four-dimensional verdict and cleanup evidence. The invocation
must print run/lane IDs, denominator, current operation, passed/failed/remaining counts, heartbeat,
elapsed time, first failure and a focused rerun command. `CONTRACT`, `BUSINESS`, deterministic
structural `PERFORMANCE`, and `CLEANUP` share one operation identity and correlation; any failed or
missing dimension prevents `OVERALL=PASS`. Container latency, percentile sampling and seed timing are
not hard performance budgets.

During migration, existing numbered or split Testcontainers runners are predecessor assets only.
They are retired after their route assertions and structural budgets are represented in
`backend-acceptance`; they never remain as an independent functional or performance contract.

## 1. Recover the execution truth before touching an environment

Read the governing source and classify the requested action exactly. Do not infer the execution
plane from a loopback URL, an absent local tool, a historical runner, or an old package title.

| Requested action | Correct boundary | Never substitute |
| --- | --- | --- |
| `reset` | Explicit destructive action through its managed runner. Validate the prior manifest, exact non-production namespace and remote host binding; stop only a runner-owned DEV tree; terminate connections, drop the exact database, then read back absence. | Bare local `psql`, local Docker, a self-made tunnel, guessed database names, or a manual SQL sequence. |
| DEV `start` / `restart` | Local Spring Boot, `platform-admin`, and `operations-admin`; managed tunnel to remote non-production middleware; additive Flyway is allowed only when the approved runner does it. | Remote app/Vite/browser execution, treating `127.0.0.1` tunnel ingress as local middleware, or implicit seed. |
| `seed --profile r5-full` | Separate, explicitly authorized destructive action after the required reset/start readiness. Use owner HTTP commands and owner readbacks; only the explicitly approved bootstrap/terminal-fixture exception may use the managed control plane. | Seed-on-start, generic SQL data writes, invented default accounts, or declaring fixture completion without per-scenario readback. |
| `backend-acceptance` | The repository's single managed remote JVM/Docker backend acceptance runner after implementation, with operation-derived units and fresh four-dimensional evidence. | Local Docker/Colima probing, a local Docker fallback, class-count discovery, a split performance lane, or describing it as browser L2/UAT. |
| Managed browser L2 | Local app processes and local Playwright, one isolated remote database/asset namespace per run, run-scoped manifest/logs and both-side cleanup. | Persistent DEV data, a remote browser, a static/type result, or Testcontainers technical proof. |
| UAT | Fully remote application and browser execution, and only under separate Dexter authorization. | Local DEV, local browser L2, or an unapproved deployment. |

Record the expected topology before starting. For current DEV it must be:

```text
TOPOLOGY=LOCAL_APPLICATIONS_REMOTE_NON_PRODUCTION_MIDDLEWARE
APPLICATIONS=LOCAL_HOST
MIDDLEWARE=REMOTE_NON_PRODUCTION
TRANSPORT=MANAGED_SSH_TUNNEL
```

## 2. Preflight and launch discipline

1. Confirm the authorization and exact managed CLI entry. A script with top-level execution is
   syntax-checked with `node --check`; never dynamically import it as a smoke check.
2. Reopen the current run manifest. Run the repository resource-budget preflight. PID ownership
   requires the manifest identity and OS start token; remote ownership also requires host, boot id
   and start ticks. Do not identify or kill work by port, process name, or command substring.
3. For remote `backend-acceptance`, require zero prior runner-owned Testcontainers resources in the selected isolated namespaces and reject writable-namespace sharing between lanes.
   For DEV/L2, preserve manifest, process identities, tunnel identity, log paths and resource
   observations.
4. Start only through the approved runner. Preserve the first failure, run ID, structured logs,
   phase/heartbeat and runner manifest. Do not extend timeouts or retry the same failure blind.
5. During a dynamic run, report concrete progress at least every 30 seconds. If a heartbeat stalls,
   inspect logs, PID tree, container/runner state after one interval; after a second equivalent
   interval, diagnose the broken boundary before another attempt.

## 3. Seed and fixture fact discipline

- A seed report is required for each explicit `r5-full` seed. It must distinguish the narrow
  bootstrap stage from owner API calls and group every API call by owner, operation id, method and
  normalized route. It reports call count plus HTTP and database-operation average/min/max, has a
  correlation/request-id join to backend completion events, and contains no SQL, raw payload,
  credentials, OTP, token, cookie, Authorization value, phone number or login name.
- The report is evidence only. It does not turn a missing owner readback, business assertion, or
  cleanup result into PASS.
- A fixture fact must first use the normal owner lifecycle. An unreachable terminal state can use a
  private managed terminal-fixture adapter only when an approved contract names its exact profile,
  non-production namespace, predecessor state, mutation set, audit/receipt, and readback. It must
  not add HTTP, capability, UI, a generic direct-write channel, or advance a global clock.

## 4. Result claims and cleanup

Always publish separate statuses:

```text
business: PASS | FAIL | NOT_APPLICABLE | NOT_RUN
cleanup: PASS | FAIL | NOT_APPLICABLE | NOT_RUN
```

Process exit, a passing static test, a successful remote test report, or a finished UI action is
not cleanup PASS. If remote work cleaned up but the local runner did not write a terminal manifest,
the dynamic run remains incomplete until the runner boundary is repaired and proved. Cleanup FAIL
never upgrades business evidence, and business PASS never waives cleanup.

## 5. Repeated-error prevention

When an action is blocked, first reopen the source for the environment matrix, the owned runner,
the active package, the manifest and the first-failure log. Diagnose whether the fault is
authorization, execution-plane selection, runner wiring, resource ownership, owner business
behavior, fixture contract, or missing evidence. Scan the finite sibling denominator before a fix;
do not repair only the named command. Feed a confirmed generic failure to project memory and an
existing mechanical control only when it has a real mechanical red case.

Primary sources: `AGENTS.md`, `scripts/README.md`,
`project-memory/operations/dev-command-separation.md`,
`project-memory/operations/phase-retrospective-and-systemic-repair.md`, and the current package
input/manifest. Use `cs-semantic-source-reconciliation` for a purported missing owner command,
capability, API, fixture state, or account lifecycle.
