---
title: TER skeleton batch 1 CP-6 verifier evidence
status: complete
date: 2026-08-29
scope: TER-local static/full verifier, Turbo task scope, and marker contract
---

# CP-6 evidence

## Result

```text
CP6_VERIFY_STATIC=PASS
CP6_TURBO_DRY_TYPECHECK=PASS_EXECUTABLE_14
CP6_TURBO_DRY_TEST=PASS_EXECUTABLE_1
CP6_TURBO_DRY_LINT=PASS_EXECUTABLE_0
CP6_TURBO_DRY_CLEAN=PASS_EXECUTABLE_0
CP6_PACKAGE_TYPECHECK=PASS
CP6_METRO_EXPORT=PASS
CP6_VERIFY=PASS
CP6_MARKER_FAILURE_CONTROL=PASS
CP6_EXPORT_CLEANUP=PASS
CP6_ROOT_VERIFIER=NOT_CONNECTED_BY_DESIGN
```

CP-6 only changes the TER-local tools. It does not modify
`tools/verify-gates/verify.mjs`, does not run Gradle or `expo run:android`, and
does not run the root `scripts/verify` normal mode.

## Implementation

`tools/terminal-skeleton/verify.mjs` now runs, in order:

1. `verify-static.mjs` (model red/green controls, six rule gates, and the
   separately reported scaffold hygiene check);
2. Turbo dry-run exact-set for `typecheck`, `test`, `lint`, and `clean`;
3. the TER-filtered `typecheck` task;
4. assembly `npx expo export --platform android`.

The dry-run checker reads the active projection from
`apps/terminal/skeleton-graph.ts`, not a second package list. Turbo emits a
`<NONEXISTENT>` task entry for a package that has no script. Those entries are
validated for TER directory/owner hygiene but are excluded from the
*executable* owner exact-set. The current batch-one expected executable sets
are therefore:

```text
typecheck = all 14 active leaves
test      = active adapter leaves (1)
lint      = empty
clean     = empty
```

Any frontend/library directory, aggregate owner, wrong task name, missing
executable owner, or extra executable owner fails before typecheck/export and
prints `TERMINAL_VERIFY_FIRST_FAILURE:turbo-dry-<task>`.

`tools/terminal-skeleton/verify.test.mjs` uses a temporary failing `yarn`
executable to prove that a dry-run subprocess failure exits non-zero, reports
the first failure, and does not print `TERMINAL_VERIFY=PASS`. The temporary
fixture is removed at test exit.

The static model test now exercises the approved red controls against a copied
fixture and restores every mutation before exit. It covers: graph/package and
bootstrap edges, three-name drift in both `package.json.name` and the
`src/moduleName.ts` literal, an adapter-to-kernel direction violation,
an undeclared workspace import, ordinary-package deep import, a non-self cycle,
a kernel-to-UI direction violation, an extra package.json edge, a TR-01 reducer
call outside the whitelist, kernel React manifest and side-effect source
imports, and both scaffold hygiene mutations. The graph gate now rejects
unknown spec references, non-root workspace specifiers, and cycles in the
projected graph. The kernel platform gate uses parsed static import
declarations, so side-effect imports such as `import 'react'` are rejected as
well as `from 'react'` imports. Every mutation asserts the full gate status
vector (with the intentionally correlated graph/completeness failure for an
undeclared import); the real tree is asserted to exit zero with all six gates
and hygiene green.

## Fresh commands and output

Focused static entry:

```sh
yarn workspace @catering-v2s/terminal run verify:static
```

Observed output (full log:
`.runtime/terminal-skeleton/cp6/verify-static.log`):

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SUPPORT_CHECKS=1
RULE_GRAPH_COMPARISON=PASS
RULE_TRIPLE_NAMING=PASS
RULE_DEPENDENCY_DIRECTION=PASS
RULE_DEPENDENCY_DECLARATION_COMPLETENESS=PASS
RULE_TR01_REDUCER_BOUNDARY=PASS
RULE_KERNEL_PLATFORM_INDEPENDENCE=PASS
SCAFFOLD_HYGIENE=PASS
TERMINAL_STATIC=PASS
VERIFY_STATIC_EXIT=0
VERIFY_STATIC_ELAPSED_SECONDS=8
```

Full TER entry:

```sh
yarn workspace @catering-v2s/terminal run verify
```

Observed output (full log:
`.runtime/terminal-skeleton/cp6/verify.log`):

```text
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=14 tasks=14 executable=14
TERMINAL_TURBO_DRY_TEST=PASS packages=14 tasks=14 executable=1
TERMINAL_TURBO_DRY_LINT=PASS packages=14 tasks=14 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=14 tasks=14 executable=0
Tasks:    14 successful, 14 total
Cached:   14 cached, 14 total
Android Bundled 1443ms apps/terminal/assembly/android/pos-desktop/index.ts (623 modules)
Exported: dist
TERMINAL_VERIFY=PASS
VERIFY_EXIT=0
VERIFY_ELAPSED_SECONDS=13
```

The verify invocation's typecheck was a successful cached run; CP-5 already
provided the uncached `--force` proof in
`cp5-assembly-codex.md` (`14/14`, zero cached). The full entry therefore
proves ordering and marker closure without pretending the cached invocation
was a fresh compiler execution.

The marker failure control was run separately:

```sh
node tools/terminal-skeleton/verify.test.mjs
TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS
```

The expanded static model test was also run directly:

```sh
node tools/terminal-skeleton/check-static.test.mjs
TERMINAL_SKELETON_MODEL_TEST=PASS
```

The export generated `.expo/` and `dist/` under the assembly. Both were
removed by exact-path cleanup after the full entry:

```text
CP6_EXPORT_CLEANUP=PASS
```

After closing the whole-batch red-control findings, the two TER entry points
were rerun from the current tree. The final logs are
`.runtime/terminal-skeleton/cp6/verify-static-final.log` and
`.runtime/terminal-skeleton/cp6/verify-final.log`; both commands exited zero.
The static rerun again printed all six rule PASS markers, `SCAFFOLD_HYGIENE=PASS`
and `TERMINAL_STATIC=PASS`. The full rerun printed the four exact-set markers
(`typecheck=14`, `test=1`, `lint=0`, `clean=0`), 14/14 cached typechecks,
`Android Bundled ... (623 modules)`, `TERMINAL_VERIFY=PASS`, followed by the
exact-path `CP6_FINAL_EXPORT_CLEANUP=PASS` cleanup probe.

A later read-only verifier rerun briefly regenerated the same assembly
`.expo/` and `dist/` export outputs. That exposed that cleanup was external to
the entry and was repaired before CP-7: `verify.mjs` now fail-closes when either
path pre-exists, owns only paths absent at start, cleans them in both export
success and failure paths, and withholds `TERMINAL_VERIFY=PASS` on cleanup
failure. The fresh self-closing run is recorded in
`.runtime/terminal-skeleton/cp6/verify-self-closing-final.log` and printed
`TERMINAL_VERIFY_CLEANUP=PASS`, `TERMINAL_VERIFY=PASS`, followed by the
filesystem assertion `CP6_VERIFY_SELF_CLOSING=PASS`; no adapter `android/`
source tree was deleted.

## Scope and remaining boundaries

The four dry-run checks prove that the fixed TER filters do not execute
frontend/library or aggregate tasks and that the current executable task owner
sets match the batch-one policy. They do not prove batch-two packages, native
Gradle/autolinking, Kotlin capability, device startup, or any terminal
business behavior.

The root verifier remains intentionally unconnected until CP-7's whole-batch
local and one-time emulator acceptance are green. No root normal verifier was
run.
