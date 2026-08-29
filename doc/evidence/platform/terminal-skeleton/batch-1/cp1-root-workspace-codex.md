# TER skeleton batch 1 · CP-1 root workspace evidence

## Scope

This record covers CP-1 only: the v2s root workspace expansion, Turbo task graph,
TER aggregate workspace, TypeScript base configuration, the 22-node literal
`skeleton-graph.ts`, boundary READMEs, and the terminal-skeleton tool entry points.
No TER leaf package, UI capability, native build, assembly app, or verifier tuple is
created or connected in this checkpoint.

## Inputs and implementation facts

- Root workspaces retain `apps/frontend/*` and `libraries/frontend/*` and add only
  the six exact TER globs required by the approved plan.
- Root dependency resolution on 2026-08-29 returned Turbo `2.10.12`; the root
  `package.json` records that parsed version and the CP-0 app manifest's
  TypeScript range `~6.0.3`.
- `apps/terminal/skeleton-graph.ts` contains 22 literal nodes, with
  `activeSkeletonBatch = 1` and no path/npm-name duplication. Projection counts
  are batch 1 = 14 and batch 2 = 22.
- `tools/terminal-skeleton/` contains the five planned entry points. The static
  checker exposes six rule gates plus one separately reported hygiene check, but
  CP-1 does not claim those gates are green before leaf packages exist.

## Commands and results

All commands ran from the repository root
`/Users/dexter/Documents/workspace/idea/catering-v2s`.

| Command                                                                                                | Result                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `yarn install`                                                                                         | exit 0; Turbo `2.10.12` and its platform package entered the lock; Yarn reported only existing peer warnings |
| `node node_modules/typescript/bin/tsc --noEmit -p apps/terminal/tsconfig.json`                         | exit 0                                                                                                       |
| `node tools/terminal-skeleton/check-static.test.mjs`                                                   | exit 0; `TERMINAL_SKELETON_MODEL_TEST=PASS`                                                                  |
| `node tools/terminal-skeleton/check-static.mjs --help`                                                 | exit 0                                                                                                       |
| `yarn turbo run typecheck --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal' --dry=json` | exit 0; Turbo `2.10.12`; task list `[]`                                                                      |
| same filter with `test`                                                                                | exit 0; task list `[]`                                                                                       |
| same filter with `lint`                                                                                | exit 0; task list `[]`                                                                                       |
| same filter with `clean`                                                                               | exit 0; task list `[]`                                                                                       |

The first workspace-script probe exposed a real cwd/bin boundary: with the
initial literal `turbo run ...` scripts, `yarn workspace
@catering-v2s/terminal run typecheck` exited 127 (`command not found: turbo`).
Running the same script from the workspace directory would also resolve
`./apps/terminal/**` relative to `apps/terminal`. The four aggregate scripts
therefore use `yarn --cwd ../.. turbo run ...` so the existing root Turbo binary
and the fixed repository-relative filters are both resolved from the v2s root.
After that minimal fix, all four workspace invocations exit 0 and report zero
tasks at CP-1:

```text
TASK=typecheck EXIT=0 ... Running typecheck in 0 packages
TASK=test      EXIT=0 ... Running test in 0 packages
TASK=lint      EXIT=0 ... Running lint in 0 packages
TASK=clean     EXIT=0 ... Running clean in 0 packages
```

The fixed aggregate outputs are under `.runtime/terminal-skeleton/cp1/`.

The four dry-run JSON files and stderr captures are under
`.runtime/terminal-skeleton/cp1/`.

`yarn workspaces list --json` returned five workspaces in total: the root,
three existing frontend/library workspaces, and `apps/terminal`. Filtering
locations with the required `apps/terminal/` prefix returned zero leaf packages,
which is the CP-1 denominator. The aggregate `apps/terminal` location is
intentionally excluded by that prefix filter.

The model census returned only the aggregate package at this checkpoint and the
literal graph projection returned `specNodes=22`, `batchOne=14`, `batchTwo=22`.

## Expected non-pass at CP-1

Running `node tools/terminal-skeleton/check-static.mjs` currently exits 1. The
first failure is:

```text
RULE_GRAPH_COMPARISON=FAIL
FIRST_FAILURE:graph-comparison:TER leaf package census is empty at CP-1; package graph is not built yet
```

This is an honest checkpoint failure, not a proof failure: CP-2 through CP-5
must create the leaf packages before the six real-tree gates can be green.
The separate hygiene check is currently `SCAFFOLD_HYGIENE=PASS`.

## Evidence boundaries

- The empty Turbo task lists prove only that the CP-1 filter is parseable and
  does not select frontend/library tasks before TER leaves exist. They do not
  prove the eventual 14-package task set.
- TypeScript proof is only the root skeleton specification; no package-level
  typecheck exists yet.
- No `verify:static` or `verify` pass marker is expected or claimed at CP-1.
- The root `tools/verify-gates/verify.mjs` remains unmodified; TER is not yet
  connected to the warehouse-level verifier.
- The template-provided UI manifest values are resolved, while the UI-specific
  Expo SDK mapping remains `UI_EXPO_SDK_MAPPING=BLOCKED` as recorded by CP-0;
  CP-1 does not consume the unresolved set-B mapping.
