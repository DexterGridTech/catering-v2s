# Terminal activation batch 1 · CP-05 reconciliation r2

```text
CP=CP-05
STEP_RECONCILIATION=MATCHED
M/S/N=0/0/0
REVIEW_TARGET=CP_STAGE_RECONCILIATION
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/cp05_r5_preflight_reconcile
EVIDENCE_TIER=SOURCE_REVIEW_PLUS_SAVED_FOCUSED_PROOFS
DYNAMIC_TOPOLOGY=NOT_COVERED
```

## Verdict

Fresh reviewer `/root/cp05_r5_preflight_reconcile` reconciled the full CP-05 Step 7 scope against
the current requirement, detailed design/IA, project-memory standards, owning implementation and
focused-proof records. Verdict: `MATCHED`, `M/S/N=0/0/0`. This closes the stale CP-05 verdict after
the R5 preflight evidence repair. It does not establish live remote topology or business behavior.

## R5 preflight root-cause closure

The earlier first-run 6c reviewer found that remote resource query failures and stale resources
failed closed without preserving the observed inventory in the run manifest. The fresh CP-05
reviewer independently checked the repair:

- [`r5-remote-testcontainers.mjs`](../../../scripts/test/r5-remote-testcontainers.mjs), lines
  1260-1334 emits separate container/volume query markers and observed resource identities; lines
  1403-1539 classify `EMPTY`, `NON_EMPTY`, `PARTIAL`, `UNAVAILABLE`, and `INVALID`, and attach
  structured `preflightEvidence` to failures.
- The same file, lines 2277-2338, initializes the manifest; lines 2366-2396 execute and record
  preflight before remote workspace preparation; lines 2636-2641 persist failure evidence.
- The same file, lines 1385-1401, only reports pre-workspace Testcontainers cleanup as PASS when
  both independent queries passed and each resource set was empty. Workspace/process cleanup is
  recorded separately.
- [`r5-remote-testcontainers.test.mjs`](../../../scripts/test/r5-remote-testcontainers.test.mjs),
  lines 322-475, covers unknown, partial, stale, malformed and empty inventories; lines 478-533
  run the generated shell with a fake Docker executable; lines 535-646 cover Node and capacity
  preflight and propagation; lines 746-762 cover invalid-capacity cleanup.

The reviewer concluded this closes the earlier 6c source/focused-proof blocker. The repair does not
make any claim about the current remote host's inventory; that is queried only by the authorized
managed runner before workspace preparation.

## Remaining CP-05 scope

- [`implementation-plan-codex.md`](../../../doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md),
  line 32, defines the two-business-context and separately managed TDS harness. Source reviewed at
  `BackendAcceptanceTest.java:698-785` proves two isolated contexts, one metrics sink, and separate
  TDS process startup; `:797-829` binds TDS protocol scenarios; `:1647-1669` provides PostgreSQL
  fault hooks.
- `TdsAcceptanceProcess.java:80-178` starts TDS separately with explicit reactive application type
  and configured capacity; `:297-321` records classpath, PID, RSS, port and cleanup evidence;
  `:323-358` stops only the validated process identity.
- `terminal-ws-wire-client.mjs:1-10,48-111,126-242,396-523` uses only pinned Node core modules and
  supports raw handshake, PMD and frame-level controls.
- Current focused evidence is recorded at
  [`execution-status-codex.md`](2026-09-27-v2s-terminal-activation-batch-1-execution-status-codex.md),
  lines 6-26: R5 runner 37/37, Node health 532/532, memory checks PASS, and identity-only static
  verify 46/46. These are local evidence, not a live topology result.

## NOT_COVERED

The reviewer ran no tests, builds, verify gates, SSH, tunnels, managed commands or remote resource
queries. A real remote Testcontainers inventory, separate TDS process, two live business contexts,
HTTP/WebSocket traffic, PostgreSQL outage/recovery, remote logs and cleanup remain for the 6c
admitted first managed run. Historical runs on older bytes remain historical.

The next gates are the current-byte whole-batch 6b reconciliation and fresh 6c admission. Neither
this CP-05 result nor the earlier 6b verdict authorizes remote execution by itself.
