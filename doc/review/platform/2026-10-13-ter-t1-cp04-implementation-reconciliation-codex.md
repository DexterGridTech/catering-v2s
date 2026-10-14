# TER T1 · CP-04 implementation reconciliation

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`
`CP=CP-04`
`RESULT=MATCHED`
`REVIEWER_KIND=FRESH_INDEPENDENT_READ_ONLY_SUBAGENT`

## Scope and governing criteria

This record covers only the complete CP-04 scope in `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md` §5 and the corresponding design criteria in `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md` §8.6–§8.7 / §11a. It is a stage reconciliation, not the batch-level 6b result, a dynamic acceptance result, or an overall delivery verdict.

The independent reviewer read the formal requirement R-11, the design/plan, and current source before returning `MATCHED`; no CP-04 OPEN item or required correction was reported. The review checked the complete named service-address path, the new native transport/topology owners and existing update adapter, removal of the old implementations, package/native registration, and focused tests/types.

## Reconciliation result

`MATCHED`: CP-04 implementation and its focused proofs agree with R-11, the approved design/plan, and the routed package-boundary requirements.

- All four package defaults retain their complete named service sets. The shared resolver accepts complete sets without the former fixed one/two/four-address assumptions; the resolver/admin/runner tests cover 1, 2, and 10 addresses and reject malformed or inconsistent sets.
- The managed DEV producer, runner child environment, Android reverse forwarding, and TDC acceptance consume the same structured named configuration. The prior scalar TDS URL handoffs and hardcoded DEV URL assumptions are removed from the active wiring.
- Android network HTTP/WS behavior is owned by `apps/terminal/adapter/android/transport`; native peer topology is owned by `apps/terminal/adapter/android/topology`; AppControl remains in the existing `apps/terminal/adapter/android/update` owner. `application/base/android` now binds platform ports and retains application entry/loading responsibilities.
- Former `application/base/android` network/topology/AppControl implementations and the moved Kotlin implementation/tests have no remaining old-path copies. The independent review found no stale active caller or fallback in CP-04 scope.
- Native autolinking, Gradle dependencies, JS module registration, managed focused-test aliases/discovery, and Chinese package READMEs match the moved ownership.

## Focused proof and run evidence

The following scoped checks passed on the current CP-04 bytes:

| Proof | Result |
|---|---|
| server-config unit tests | PASS, 3 files / 17 tests |
| TDC acceptance/unit tests | PASS, 8 files / 62 tests |
| adapter Android transport TS tests | PASS, 1 file / 3 tests |
| adapter Android topology TS tests | PASS, 1 file / 2 tests |
| adapter Android update TS tests | PASS, 1 file / 11 tests |
| application-base-android TS tests | PASS, 7 files / 14 tests |
| console and wallpaper application typechecks | PASS, exit code 0 each |
| topology, transport, application-base-android, update adapter, TDC typechecks | PASS |
| `node scripts/dev/r5-dev-runner.mjs --self-test` | PASS |
| `node tools/terminal-shared/run-owned-android-tests.mjs --self-test` | PASS |
| managed Android transport tests | PASS, run `ter-a3-86064-1791891342439`, 7 tests, cleanup PASS |
| managed Android topology tests | PASS, run `ter-a3-87504-1791891402809`, 8 tests, cleanup PASS |
| managed application-base-android tests | PASS, run `ter-a3-3891-1791892190708`, 3 tests, cleanup PASS |
| managed Android update-adapter tests | PASS, run `ter-a3-98111-1791891925557`, 18 tests, cleanup PASS |

One initial managed update-adapter run (`ter-a3-92528-1791891653314`) exposed that the mockable Android test runtime lacked the JVM `org.json` implementation used by the moved FULL-package tests. The first failure was retained and read. The minimal test-only dependency was added to the existing update adapter Gradle test configuration, then the same focused module proof passed on the current bytes. The failed run's cleanup also passed.

`yarn workspace @catering-v2s/terminal-automation typecheck` did not pass: it reports existing package-wide diagnostics outside the CP-04 changed modules, including shared UI TSX inclusion and an Android geometry-test timeout typing issue. This is not reported as PASS or hidden by the scoped checks. CP-04's fresh reconciliation found no CP-04 blocker from that broader command; the broader package typecheck remains a separately disclosed validation limitation for final delivery review.

## Not run / later gates

Expo Web, DEV-backed business acceptance, and physical/emulator device acceptance are `NOT_RUN` in CP-04 by plan. They remain in CP-06 after CP-05 and independent full-batch 6b reconciliation. This CP result does not claim those scenarios passed.

## Independent reviewer record

Fresh independent reviewer: `/root/t1_cp04_reconciliation`.
Verdict: `MATCHED`; findings requiring correction: none.
The reviewer was read-only; all repository writes and runs were performed by the primary agent.
