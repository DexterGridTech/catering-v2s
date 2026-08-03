---
name: cs-managed-runtime-execution
description: Safely classify and run authorized reset, DEV, seed, Testcontainers, browser L2, and UAT work through the repository's managed execution boundaries.
---
# cs-managed-runtime-execution

Use this skill before any dynamic environment action or any proposal to change a runner. It
does not grant authority. `AGENTS.md`, the active package, the current Roadmap authorization,
the applicable plan, `scripts/README.md`, and routed project memory decide whether the action
is permitted.

## 1. Recover the execution truth before touching an environment

Read the governing source and classify the requested action exactly. Do not infer the execution
plane from a loopback URL, an absent local tool, a historical runner, or an old package title.

| Requested action | Correct boundary | Never substitute |
| --- | --- | --- |
| `reset` | Explicit destructive action through its managed runner. Validate the prior manifest, exact non-production namespace and remote host binding; stop only a runner-owned DEV tree; terminate connections, drop the exact database, then read back absence. | Bare local `psql`, local Docker, a self-made tunnel, guessed database names, or a manual SQL sequence. |
| DEV `start` / `restart` | Local Spring Boot, `platform-admin`, and `operations-admin`; managed tunnel to remote non-production middleware; additive Flyway is allowed only when the approved runner does it. | Remote app/Vite/browser execution, treating `127.0.0.1` tunnel ingress as local middleware, or implicit seed. |
| `seed --profile r5-full` | Separate, explicitly authorized destructive action after the required reset/start readiness. Use owner HTTP commands and owner readbacks; only the explicitly approved bootstrap/terminal-fixture exception may use the managed control plane. | Seed-on-start, generic SQL data writes, invented default accounts, or declaring fixture completion without per-scenario readback. |
| Focused Testcontainers | The repository's remote JVM/Docker runner when the test imports or creates Testcontainers. | Local Docker/Colima probing, a local Docker fallback, or describing it as browser L2/UAT. |
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
3. For remote Testcontainers, require zero prior `org.testcontainers=true` containers and volumes.
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
