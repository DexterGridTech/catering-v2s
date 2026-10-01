# Batch 2 CP-02 implementation proof

```text
CP=CP-02
STATUS=IMPLEMENTED_PENDING_FRESH_THREE_DIMENSIONAL_RECONCILIATION
WRITER=MAIN_AGENT
SCOPE=server-config owner, exact state reset retention, and its static/runtime guardrails
MANAGED_ACCEPTANCE=NOT_RUN
DEV_RESET_SEED=NOT_RUN
```

## Intake and repaired design residuals

| Finding | Intake | Evidence reopened | Disposition |
|---|---|---|---|
| S-1 reset-only dry-run omission | `CONFIRMED` | Four-finding review §3; requirements D-34 at `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:1701`; implementation task template `doc/platform/implementation-task-template.md:211-217`; seed/reset template `doc/decisions/templates/implementation-design-template.md:276-281` | Design and plan now require current-byte complete `r5-full` dry-run before any actual reset or seed; reset must follow a passing dry-run. Backend acceptance and DEV steps without reset/seed remain independent; §3a stays `N/A_WITH_REASON` without L2 controls. CP/6b, resource identity/budget, logs and cleanup remain required. |
| N-1 CP-06 exit wording | `CONFIRMED` | Four-finding review §3; design §2/CP-06/13c and plan §§2/4/8/11 | CP-06 exit is limited to scenario/runner work, focused proof, static entry checks and its CP reconciliation. Batch 6b, dynamic results, cleanup, 13c and final implementation review are explicitly post-CP-06 batch closure. |

The review’s proposed repairs were treated as inputs. The reset-only rule follows the extant reset admission text; the no-reset/no-seed backend acceptance and DEV carve-out does not dilute destructive-action admission. No reset, seed, L2, backend-acceptance, or DEV action was run during CP-02.

## Implemented behavior

- `server-config` is a distinct owner for service addresses, overrides, proxy configuration and the protected proxy password. Its public selector masks passwords; the network adapter subpath exposes only the injected composition boundary. Terminal activation credentials remain outside this package.
- The state API defaults slices to `clear`. `server-config` declares `retain`; reset flushes first, preserves only registered retained persistence keys and removes other namespace keys including orphan keys. After successful storage cleanup, the root reducer starts all slices at initial values and projects only retained descriptors’ persisted fields/records back into the retained slice. Transient fields such as service revisions reset. A storage failure prevents visible root reset.
- Generic partitioned/workspace slice creation cannot select retention: its descriptor type omits `resetIntent`, and the runtime adapter forces `clear`. This closes the indirect `createDescriptor` path as well as direct owner declarations.
- `tools/terminal-skeleton/check-static.mjs` adds `state-reset-retention-only`, resolving the factory symbol (including import aliases), requiring statically inspectable policy, and permitting exactly the `server-config` slice declaration. Its red fixtures cover a second owner, computed policy, aliased factory use, and an owner slice union widened with an extra mode. The generic state adapter is narrowly excluded from owner-declaration scanning because it forces `clear`; `partitioned.test.ts` proves that behavior.

The actual rule lives in `doc/platform/terminal-coding-standard.md` TR-09. Design and plan now describe the in-memory projection and storage behavior implemented above; stale wording that delegated retention to owner reducers was removed.

## Focused proof on current bytes

| Command | Result |
|---|---|
| `yarn workspace @catering-v2s/kernel-base-state typecheck` | PASS |
| `yarn workspace @catering-v2s/kernel-base-state test` | PASS, 5 files / 70 tests |
| `yarn workspace @catering-v2s/kernel-base-state lint` | PASS, 23/23 source files, zero errors/warnings |
| `yarn workspace @catering-v2s/kernel-base-server-config typecheck` | PASS |
| `yarn workspace @catering-v2s/kernel-base-server-config test` | PASS, 2 files / 5 tests |
| `yarn workspace @catering-v2s/kernel-base-server-config lint` | PASS, 16/16 source files, zero errors/warnings |
| `node tools/terminal-skeleton/check-static.mjs` | PASS, 8/8 rule gates and scaffold hygiene |
| `node tools/terminal-skeleton/check-static.test.mjs` | PASS, full model suite; second-owner, dynamic-policy, aliased-owner, widened-union and restore markers PASS |

These are local package/static checks, not managed business evidence. Managed backend-acceptance, Node/HTTP/WS, Expo Web, DEV, reset, seed and cleanup remain `NOT_RUN` until all CPs and overall 6b are reconciled and their run-specific admission passes.

## First failures and root-cause disposition

1. Initial static-gate run found `server-config`’s newly used `platform-ports` test dependency missing from the skeleton graph and dependency-name export; both declarations were aligned.
2. The new static rule initially called a helper that was not in scope. It now uses literal AST property-name handling and TypeScript symbol resolution, with dynamic/computed policy rejected.
3. The first fixture run found its help assertion still expected seven rules; help text and expected rule count now both say eight.
4. The existing omitted-package red fixture also triggered the new rule’s “approved owner missing” guard. Its expected failure vector now names both independent gates.
5. Symbol-aware scanning found that generic partitioned-slice creation forwarded caller-controlled reset intent. The API type and runtime adapter now restrict that path to clear; a focused unit test proves an untyped retain attempt still registers as clear.
6. The first state typecheck exposed non-distributive `Omit` over the persistence declaration union. A local distributive descriptor type now preserves the original discriminated union.
7. The initial server-config lint wrapper reported only an error count and discarded ESLint locations. It now emits bounded structured diagnostics; the surfaced two unused imports were removed, and the same package lint proof passes.

The early failed invocations are preserved here as failures; only subsequent checks on the repaired bytes are reported as PASS. No dynamic managed run was active while these source changes were made.

## Files in this CP

- State/reset: `apps/terminal/kernel/base/state/src/**`, `apps/terminal/kernel/base/state/test/**`, `apps/terminal/kernel/base/state/README.md`, `apps/terminal/kernel/base/state/terminal-invariants.json`.
- Server configuration: `apps/terminal/kernel/base/server-config/**`.
- TER graph and guard: `apps/terminal/skeleton-graph.ts`, `tools/terminal-skeleton/check-static.mjs`, `tools/terminal-skeleton/check-static.test.mjs`, `tools/terminal-shared/closed-union-consumers.mjs`.
- Shared reset rule and design: `doc/platform/terminal-coding-standard.md`, `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-design-codex.md`, `doc/plans/platform/2026-09-30-v2s-terminal-activation-batch-2-implementation-plan-codex.md`.
- Failure diagnostics: `tools/terminal-shared/run-owned-lint.mjs`.

This record does not declare CP-02 `MATCHED`; that verdict belongs to the fresh independent reviewer.

## Current-byte delta proof after reviewer OPEN

The first fresh CP-02 delta reviewer found no semantic mismatch, but marked the CP OPEN because the raw focused output for the post-MATCHED `server-config` source-layout/readability edits was not available to inspect. Re-ran the affected owner and state packages and retained the raw outputs; this is evidence closure, not a code change.

| UTC run | Command | Current result |
|---|---|---|
| `cp02-typecheck-20260930T1610Z` | `yarn --cwd apps/terminal/kernel/base/server-config typecheck` | PASS; transcript includes command, `EXIT_CODE=0`, and source manifest hash; `.runtime/review/terminal-activation-batch-2-cp02-current/server-config-typecheck.log` |
| `cp02-focused-20260930T160610Z` | `yarn --cwd apps/terminal/kernel/base/server-config test` | PASS; 2 files / 5 tests; raw output `.runtime/review/terminal-activation-batch-2-cp02-current/server-config-test.log` |
| `cp02-typecheck-20260930T1610Z` | `yarn --cwd apps/terminal/kernel/base/state typecheck` | PASS; transcript includes command, `EXIT_CODE=0`, and source manifest hash; `.runtime/review/terminal-activation-batch-2-cp02-current/state-typecheck.log` |
| `cp02-focused-20260930T160610Z` | `yarn --cwd apps/terminal/kernel/base/state test` | PASS; 5 files / 70 tests; raw output `.runtime/review/terminal-activation-batch-2-cp02-current/state-test.log` |

Evidence bundle SHA-256: server-config test `0605a1849f0555e506d147abd6848c916963499d921950f89c6cb32b38b28666`; server-config typecheck `e0f9cc10941683faa536a30a948c2c5838d6963721acc44b1e8b67adc2391aa7`; state test `aa6ed8b38611c15298323c5eec5efcc74141f7bd5de59adef94aadd119cc65ab`; state typecheck `96e0eaf91ffe85c48a9e6520f0c72d84c503d0bbf5f15f5a9e8d8d4f58654839`; corrected source-only inventory `.runtime/review/terminal-activation-batch-2-cp02-current/source-sha256.txt` `559203eeb10a5e0cc4f05dd47c06d25289c7eb1c77b4877aa114bf0a3daa0f12` (58 source/test/config/fixture inputs; generated `.turbo` test/typecheck logs are excluded and retained separately above).

These are local owner/state focused checks; they do not establish managed acceptance, DEV, reset, seed, L2, or cleanup. A fresh independent CP-02 recheck is required to close the earlier `OPEN`.
