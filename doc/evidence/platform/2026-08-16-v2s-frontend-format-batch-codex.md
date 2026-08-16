# Frontend format batch evidence

## Scope

This evidence closes Step 13 of:

- `doc/platform/frontend-coding-standard.md` §2-D
- `doc/review/platform/2026-08-16-v2s-frontend-remediation-sequence-claude.md` 第 13 步
- `doc/evidence/platform/2026-08-16-v2s-frontend-architecture-assertion-disposition-codex.md`

The batch was performed after Step 12. It was limited to formatting, formatter-stability
of source assertions, and the machine-gate prerequisite needed to keep the formatter batch
from producing a false red. No product rule, Journey, L2 case activation, seed input,
runtime configuration, or API behavior was added.

## Formatter and denominator

- Prettier `3.9.6` is a root dev dependency.
- `.prettierrc.json` fixes `printWidth: 120`, single quotes, trailing commas, and LF endings.
- `.prettierignore` excludes generated TypeScript, `build`, `dist`, and `test-results`.
- The checked target is 240 frontend files under `apps/frontend` and `libraries/frontend`
  with extensions `css/json/js/mjs/ts/tsx`, excluding generated paths.
- Before the batch: `>120=2,676`, `>200=1,069`, longest line `3,729` (the review baseline).
- After the batch: `>120=0`, `>200=0`, longest line `120`.
- `yarn format:check`: PASS.

The package build scripts keep the original lint → architecture check → typecheck → Vite
build order while exposing `lint` as a package alias. `tools/verify-gates/cli.mjs` expands
that alias before checking the required command order, so the gate remains strict without
forcing an unformattable package JSON line.

## Format-stability repairs

- Architecture source assertions that were valid but broke on Prettier whitespace now use
  whitespace-tolerant structural patterns.
- CRUD required-expression checking recognizes a formatter-stable `>{expression}</Button>`
  structure; its existing red mutation remains valid.
- Page-registry reachability accepts the formatted `registrations.map(entry => ...)` form,
  and its self-test mutates the actual route element token.
- The generated-operation boundary test now checks `*_OPERATION_IDS` constants rather than
  obsolete direct operation-id literals.

## Proof

- Operations architecture: 13 PASS, 4 explicit TODO.
- Platform architecture: 9 PASS, 1 explicit TODO.
- Operations Vitest: 66/66 PASS.
- Platform Vitest: 9/9 PASS.
- Catalog/brand/dictionary-model/inventory focused tests: 6 files, 56/56 PASS.
- Foundation focused tests: 4 files, 31/31 PASS.
- Operations, platform, and foundation typecheck: PASS.
- Transport lifecycle: 3/3 PASS.
- Idempotency boundary: 4/4 PASS.
- Catalog query envelope: 15/15 PASS.
- Inventory reference matrix: 5/5 PASS.
- `node tools/verify-gates/cli.mjs frontend`: PASS.
- `./scripts/verify --validate-only`: `R5_VERIFY_VALIDATE_ONLY=PASS`, `EXECUTED=13/13`,
  `CLEANUP=NOT_APPLICABLE_STATIC_ONLY`.

## Evidence boundary

The catalog/inventory L2 framework validates 18 scenarios and 41 cases with zero active
case IDs, owner-HTTP fixture setup, and `SEED_RUNTIME_INPUT=false`. Its self-test and
validator pass. This is framework/static evidence only. Browser L2, complete HTTP,
DEV, seed, reset, UAT, and runtime business/cleanup evidence are intentionally not claimed
by this goal.
