# CP-1 stage reconciliation round 2 — Hume

## Metadata

- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_SCOPE=CP-1 stage reconciliation`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `agentId=01a0a0c4-dca2-73e1-b7ef-38ce0936e3a7`
- `verdict=NO-GO`
- `M/S/N=2/0/0`
- Read-only review; no repository writes or runtime execution by the reviewer.

## Verdict

Current source bytes reverse the older findings for D-1 coverage, root workspace static reading, generic assembly App discovery, `ui.integration.sample-console` ownerization, and TR-13/shared-console wiring. CP-1 still cannot GO because the B0 sample2 frozen implementation-acceptance prerequisite is open, and the current D-1/D-4 red-mutation execution evidence is not yet replayable at the required level.

## Evidence

- `node tools/terminal-skeleton/check-static.mjs` was observed passing with seven rule gates, including `RULE_RUNTIME_DEPENDENCY_CONTRACT=PASS`.
- `node tools/terminal-layering/check-static.mjs` was observed passing with four layering rule gates.
- `tools/terminal-skeleton/check-static.mjs:655-705` covers package dependency fields, tsconfig references/paths, and boundary import capabilities for D-1.
- `tools/terminal-shared/import-capabilities.mjs:20-61` covers value imports, re-exports, `import type`, import-equals, dynamic import, and `require`.
- `tools/terminal-skeleton/graph-model.mjs:258-293` scans `src`, `test`, `test-expo`, `scripts`, and package-root script/config files.
- `tools/terminal-skeleton/check-static.test.mjs:145-225` contains root-workspace, D-1 import-form, runtime-subset, and dependency-array-drift red mutations.
- `package.json:8-19` and `tools/terminal-skeleton/check-static.mjs:526-541` cover TER workspace patterns and checker-side omission detection.
- `tools/terminal-skeleton/check-static.mjs:456-466` discovers assembly App entries generically and rejects an empty set.
- `apps/terminal/ui/integration/sample-console/src/application/module.ts:22-59` contains a real internal command, actor, and runtime module factory.
- `apps/terminal/ui/integration/sample-console/src/dependencies.ts:13-30` and `src/assembly/assembly.tsx:65-72,231-258,385-410` show shared console dependencies, the single catalog, and `AdminLauncher` content framing.
- `doc/platform/terminal-coding-standard.md:549-580` defines the applicable TR-13 shape.
- `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md:66-82,133-140` requires B0 sample2 acceptance before CP-2 and blocks when that prerequisite is absent.
- `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md:7-12,117-120` and `doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-execution-codex.md:6-13,466-488,532-545` explicitly retain partial/open status for Web, release, native device, visual acceptance, the complete A/F matrix, and remaining Android scope.

## Findings

### M-1 — B0 prerequisite is open

`CONFIRMED`.

The B0 plan requires the sample2 frozen implementation acceptance before CP-2. Current sample2 evidence is explicitly `ANDROID_DYNAMIC_PARTIAL_WITH_OPEN_REVIEW_ITEMS` and does not close the required Web, release, native-device, visual, or complete A/F evidence. The current bytes provide no frozen acceptance record.

Reproduce with:

```sh
rg -n "implementation acceptance|完整 visual|完整 A/F|Web、release|OPEN|supporting" \
  doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-execution-codex.md \
  doc/evidence/platform/2026-09-14-v2s-terminal-sample2-*.md
```

### M-2 — red-mutation execution evidence is not yet replayable

`PARTIALLY_CONFIRMED`.

The current checker and red fixtures exist, but the reviewer did not find a current repository evidence record proving that the new D-1/D-4/root-workspace/runtime-contract mutations were executed and failed as required. Older `/tmp` records predate the current seven-gate/D-4 state and are not sufficient evidence.

The required replay command is:

```sh
node tools/terminal-skeleton/check-static.test.mjs
```

The resulting stdout/stderr and cleanup result must be retained under the current evidence directory.

## Rejected candidate findings

- `REJECTED_WITH_EVIDENCE`: D-1 does not cover type-only, re-export, dynamic, `require`, import-equals, test/config, tsconfig, or cross-package-relative forms. Current collector and fixtures cover them.
- `REJECTED_WITH_EVIDENCE`: assembly App entry is hard-coded and has no empty-set guard. Current projected-graph discovery is generic and rejects an empty set.
- `REJECTED_WITH_EVIDENCE`: `sample-console` is not a real owner. It has a runtime factory, command, actor, and shared writer wiring.
- `REJECTED_WITH_EVIDENCE`: integration is not connected to TR-13/shared admin console. Both `sample-console` and `sample-wallpaper-console` use the shared catalog and `AdminLauncher` and declare the corresponding dependencies.

## Required next action

1. Close or explicitly resolve the sample2 frozen-acceptance prerequisite before advancing CP-2.
2. Execute and retain the current red-mutation/model evidence, including cleanup verification.
3. Retain a repository evidence record for the current seven-gate static result instead of relying on old `/tmp` output.
