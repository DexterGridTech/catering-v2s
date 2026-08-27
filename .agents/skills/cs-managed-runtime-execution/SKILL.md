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
implementation-review, or historical-report prerequisite. Its finite denominator is the current
explicit Java scenario catalog, selected by scenario ID or operation name. Invoking any routine command
does not, by itself, require an implementation or source-change package.

This classification does not waive the execution boundary. Each command still uses its
existing managed entrypoint, explicit authorization and run-scoped manifest/logs, and still
reports separate `business` and `cleanup` status. A runtime failure is diagnosed from its
first-failure evidence; a confirmed runner or production-source defect is repaired in the
smallest authorized source scope, then the routine command may be rerun without acquiring an
implementation-package or historical-predecessor prerequisite. A timeout extension, retry,
fixture deletion, or status rewrite is never a routine-command fix.

The public whole-suite entry is `scripts/test/backend-acceptance`; it is active and may be invoked
independently. Discovery is the explicit Java catalog in
`BackendAcceptanceScenarioCatalog`: it owns the four domain groups
`IamAcceptanceScenarios`, `OrganizationAcceptanceScenarios`, `CommercialContractAcceptanceScenarios`,
and `AssetAcceptanceScenarios`, then discovers their `@AcceptanceScenario` methods. The old
provider/registry and historical interface-count denominator are retired.

Before a scenario is added, its design and code must have non-empty `identity`, `fixture`, `request`,
and `businessOracle` intent. The oracle names real business fields or side effects and covers the
applicable permission, isolation, state, masking, write/readback, no-write, or idempotency fact.
`performanceCriterion`, scenario-level `cleanup`, `correctnessCases`, accepted baselines and the
old scenario performance gates are retired and must not be added. Dexter's 2026-08-22 ruling restores
a separate generated-operation run-level budget verifier over production HTTP completion events;
it must not become a scenario field or affect scenario CONTRACT/BUSINESS. A status-only, `response.ok`, no-exception, or
path-string declaration is not a business oracle.

Each business run selects one catalog-discovered scenario or `all` and executes serially in the managed
remote Testcontainers environment. There is no package-exit, P0/W0/P1, lane, scenario exact-set or
accepted-baseline admission step. The independent operation-budget verifier may join run-scoped
events to the generated operation registry only under its approved performance design. There is no scenario count cap (Dexter 2026-08-27 removed the former 80 limit); never reduce business assertions
to meet a runtime target.

Each scenario reports two business dimensions, `CONTRACT` and `BUSINESS`, plus informational
`DB_OPERATIONS` from the production interceptor. `BUSINESS` must be a hand-written real assertion;
stub-only output is invalid. Runner resource cleanup remains a separate safety condition for the
JVM, Testcontainers containers, volumes and temporary workspace, but it is not a scenario-level
business dimension or cleanup oracle.

The initial backend-acceptance migration and its historical performance/seed finding replay are
retired. Do not reopen provider/registry assets, historical baselines or migration ledgers for a
new business scenario unless Dexter explicitly changes the active decision and this skill is updated.

Business fixture and oracle code stays in the owning domain group. Shared helpers belong in
`BackendAcceptanceTest` only when they are genuinely shared by multiple domains; do not derive paths
from owner spelling or centralize all business knowledge in the app entry suite.

The fresh report root is `.runtime/backend-acceptance/<runId>/` and includes a run manifest,
structured logs, scenario results and resource cleanup evidence. The invocation must print run ID,
discovered/selected counts, current scenario, first failure, `CONTRACT`, `BUSINESS`, business mode,
DB operations and a focused rerun command. Existing provider/registry and split functional/performance
assets are retired and never become a second contract.

## 1. Recover the execution truth before touching an environment

Read the governing source and classify the requested action exactly. Do not infer the execution
plane from a loopback URL, an absent local tool, a historical runner, or an old package title.

| Requested action | Correct boundary | Never substitute |
| --- | --- | --- |
| `reset` | Explicit destructive action through its managed runner. Validate the prior manifest, exact non-production namespace and remote host binding; stop only a runner-owned DEV tree; terminate connections, drop the exact database, then read back absence. | Bare local `psql`, local Docker, a self-made tunnel, guessed database names, or a manual SQL sequence. |
| DEV `start` / `restart` | Spring Boot on the trusted remote non-production host beside PostgreSQL/object storage; local `platform-admin` and `operations-admin` Vite; managed local forwards for Java HTTP and browser asset access. Additive Flyway is allowed only when the approved remote-Java runner does it. | A PostgreSQL tunnel, local Java fallback, remote Vite/browser execution, implicit seed, or running the retired topology while the runner is incomplete. |
| `seed --profile r5-full` | Separate, explicitly authorized destructive action after the required reset/start readiness. Use owner HTTP commands and owner readbacks; only the explicitly approved bootstrap/terminal-fixture exception may use the managed control plane. | Seed-on-start, generic SQL data writes, invented default accounts, or declaring fixture completion without per-scenario readback. |
| `backend-acceptance` | The repository's single managed remote JVM/Docker backend acceptance runner, with catalog-discovered real business scenarios and separate CONTRACT/BUSINESS plus informational DB operations. | Local Docker/Colima probing, a local Docker fallback, response.ok-only checks, a split performance lane, or describing it as browser L2/UAT. |
| Managed browser L2 | Local Spring Boot, local Web apps and local Playwright, one isolated remote database/asset namespace per run, run-scoped manifest/logs and both-side cleanup. This does not inherit the DEV remote-Java topology. | Persistent DEV data, a remote browser, a static/type result, or Testcontainers technical proof. |
| UAT | Fully remote application and browser execution, and only under separate Dexter authorization. | Local DEV, local browser L2, or an unapproved deployment. |

Record the expected topology before starting. For current DEV it must be:

```text
TOPOLOGY=REMOTE_JAVA_LOCAL_VITE_REMOTE_NON_PRODUCTION_MIDDLEWARE
JAVA_APPLICATION=REMOTE_TRUSTED_NON_PRODUCTION_HOST
WEB_APPLICATIONS=LOCAL_HOST
MIDDLEWARE=REMOTE_NON_PRODUCTION
TRANSPORT=MANAGED_HTTP_AND_ASSET_SSH_TUNNEL
```

If the managed DEV runner still starts local Java or opens a PostgreSQL forward, fail closed; the
retired topology is not a fallback. Remote Java ownership requires trusted host, boot id, PID,
start ticks and command digest; local Vite/tunnel ownership still requires PID and OS start token.

An authorized managed Testcontainers/backend-acceptance run implicitly authorizes one narrow DEV
lifecycle sequence. If a valid managed DEV manifest exists, record `DEV_WAS_RUNNING=true` and run
managed DEV stop before the test; the test may start only after stop cleanup PASS. Restart DEV only
when Testcontainers business and cleanup both PASS and `DEV_WAS_RUNNING=true`. Do not start DEV when
it was absent, and do not restart after a failed test. This does not authorize reset, seed, browser
L2, UAT, data actions, or stopping identities not owned by the manifest.

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
