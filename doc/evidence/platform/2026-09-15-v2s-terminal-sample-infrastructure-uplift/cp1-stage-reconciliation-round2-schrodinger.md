# CP-1 stage reconciliation — fresh independent review

REVIEW_TARGET=IMPLEMENTATION_STAGE_RECONCILIATION
REVIEW_STAGE=CP-1
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=NO-GO
M/S/N=3/1/0
EVIDENCE_TIER=static source reconciliation + fresh read-only static check + existing typecheck/Turbo output inspection; no dynamic/native/device/DEV/Metro/Web/seed/reset/deploy

## Provenance

This is the fresh independent reviewer report received on 2026-09-15. The reviewer read
current repository bytes, requirements v3.6, implementation design and plan, project-memory
inputs, owning source, checkers and available evidence before forming the verdict. The
reviewer did not modify files, use Git, or start runtime/device/Web/DEV or managed cleanup.

## Confirmed findings

### F-1 — M — D-1 boundary checker semantic coverage is not closed

The requirements and design require coverage of `src`, `test`, `test-expo`, root config and
package files, tsconfig paths/references, and value imports, `import type`, export/export
type, dynamic import, require, import-equals and cross-package relative paths. The current
implementation cited by the reviewer is narrower:

- `tools/terminal-skeleton/graph-model.mjs:270-278` scans only `src` (optionally
  `test-expo`);
- `tools/terminal-skeleton/graph-model.mjs:253-267` collects only `ImportDeclaration`;
- although `tools/terminal-shared/import-capabilities.mjs:14-60` contains a broader AST
  collector, the reviewer found no use of it from `tools/terminal-skeleton/check-static.mjs`.

Reproduce with:

```bash
rg -n "import-capabilities|collectStaticImport|ImportEquals|dynamic import|require\\(|ExportDeclaration" tools/terminal-skeleton tools/terminal-shared
```

Then inject a forbidden edge into each omitted scope/form and run the static checker; the
required red controls are absent.

### F-2 — M — assembly entry reachability is still a hard-coded App list

The requirements (`...requirements-claude.md:483-493`) and design (`...implementation-design-codex.md:291-296`)
require all non-base assembly entries without hard-coding App names. The reviewer found
`tools/terminal-skeleton/check-static.mjs:403-408` still explicitly names
`assembly.android.sample-terminal` and `assembly.android.sample-wallpaper-terminal`.

Reproduce by adding a third first-party non-base assembly entry with the same required
shape but no hard-coded name; the current predicate does not discover and validate it.

### F-3 — M — `ui.integration.sample-console` is declared owner without a TR-09 owner surface

`apps/terminal/ui/integration/sample-console/src/moduleName.ts:1-2` declares
`moduleKind='owner'`, but its factory at `src/application/module.ts:6-15` has empty
`commands`, `actors`, `slices` and `stateSlices`. TR-09 (`doc/platform/terminal-coding-standard.md:298-311`)
defines an owner as owning at least one such runtime surface. The reviewer contrasted the
non-empty `sample-wallpaper-console` actor surface.

Reproduce with the current factory and TR-09 owner predicate; it is a declared owner with
no owned runtime fact, so it must either gain a real owned surface or be declared as toolkit
and excluded from the runtime-owner subset.

### F-4 — S — existing typecheck/Turbo records do not prove current enumeration

The reviewer found these available records:

- `.runtime/terminal-skeleton/cp1/aggregate-typecheck-final.log:3-9` reports `Running typecheck in 0 packages` / `0 successful, 0 total`;
- `.runtime/terminal-skeleton/cp1/turbo-*-dry.json` reports `packages: []` / `tasks: []`;
- `/tmp/ter-static-cp1-after-platform.txt:35-43` is an older six-gate record and predates
  the current D-4 runtime contract gate.

These records cannot prove current workspace/typecheck/Turbo enumeration. This is an
evidence gap, not a dynamic/native acceptance claim.

## Rejected candidate findings

The reviewer independently rejected as currently fixed: R-E6 package-only correction,
D-4 package/target-derived runtime subset and red controls, five factory consumption and
feature/integration exclusion removal, root workspace declarations and graph nodes,
README content, duplicate module registration, runtime owner with empty runtime dependency,
toolkit console-assembly exclusion, and the selected native/runtime items. These rejections
do not close the four findings above.

## Verdict

`NO-GO`, M/S/N `3/1/0`. D-4's old NO-GO is closed, but CP-1 remains OPEN until D-1
coverage, generic assembly discovery, sample-console owner semantics, and current
typecheck/Turbo enumeration evidence are corrected or explicitly constrained by a fresh
review.
