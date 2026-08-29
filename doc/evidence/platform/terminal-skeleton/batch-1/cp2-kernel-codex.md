# TER skeleton batch 1 · CP-2 kernel evidence

## Scope

CP-2 creates exactly seven pure TypeScript kernel packages:

```text
kernel.base.contracts
kernel.base.platform-ports
kernel.base.state
kernel.base.runtime
kernel.base.display-context
kernel.base.ui-state
kernel.base.test-support
```

Each package contains only `package.json`, `tsconfig.json`,
`src/moduleName.ts`, `src/dependencies.ts`, and `src/index.ts`. No Expo,
React Native, React, native source set, feature, application, slice, command,
or capability implementation is included.

## Package shape and dependency facts

- Every package is private, `type: module`, exports only `.` to
  `./src/index.ts`, and has only a `typecheck` script.
- Internal dependencies use `workspace:*` and match the batch-one projection
  of `apps/terminal/skeleton-graph.ts`.
- `dependencies.ts` imports each internal dependency from its real package root
  and exports the resulting `dependencyModuleNames` or
  `devDependencyModuleNames` tuple.
- Each package declares the resolved TypeScript `~6.0.3` as a dev-only tool
  dependency so its independent Yarn workspace `typecheck` has a real compiler
  binary. This is not a TER runtime or graph edge.

## Commands and results

All commands ran from `/Users/dexter/Documents/workspace/idea/catering-v2s`.
Raw logs are under `.runtime/terminal-skeleton/cp2/`.

| Check                                                                                                  | Result                                                             |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `yarn install` after adding the seven packages                                                         | exit 0                                                             |
| `yarn workspaces list --json`                                                                          | exit 0; after filtering `apps/terminal/`, exactly 7 leaf packages  |
| each of the seven `yarn workspace <package> run typecheck` commands                                    | all exit 0                                                         |
| `yarn turbo run typecheck --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal' --dry=json` | exit 0; Turbo 2.10.12; exact task set is the seven kernel packages |
| same Turbo command without `--dry=json`                                                                | exit 0; `7 successful, 7 total`, 2.505 seconds                     |
| model/spec facts                                                                                       | `specNodes=22`, batch-one projection `14`, census kernel count `7` |
| internal dependency/import exact-set script                                                            | exit 0; `errors=[]` for all seven packages                         |
| `node tools/terminal-skeleton/check-static.test.mjs`                                                   | exit 0; `TERMINAL_SKELETON_MODEL_TEST=PASS`                        |
| Prettier on CP-2 files                                                                                 | exit 0                                                             |

The Turbo dry-run task owners are exactly:

```text
@catering-v2s/kernel-base-contracts
@catering-v2s/kernel-base-display-context
@catering-v2s/kernel-base-platform-ports
@catering-v2s/kernel-base-runtime
@catering-v2s/kernel-base-state
@catering-v2s/kernel-base-test-support
@catering-v2s/kernel-base-ui-state
```

No frontend or library task appears in the filtered set.

Turbo 2.10.12 also emits `<NONEXISTENT>` placeholder entries in `--dry=json`
for a configured task (`test`, `lint`, or `clean`) when a package has no
matching script. The corresponding real runs execute zero tasks and exit 0.
This checkpoint accepts only the `typecheck` exact set; the CP-6 task-set
checker must count only executable commands and must not treat these
placeholders as established package tasks.

## Deliberately not green at CP-2

The full `check-static.mjs` real-tree report is not a CP-2 acceptance proof:
the batch-one projection has 14 nodes, while only the seven kernel leaves exist.
Its graph and completeness checks therefore report missing UI/adapter/assembly
packages. That is the expected intermediate state. No `TERMINAL_STATIC=PASS`
or `TERMINAL_VERIFY=PASS` marker is claimed, and the warehouse-level verifier
remains unmodified.

## Evidence boundary

The proof covers package-root resolution, dependency declarations, kernel
platform exclusion, and the Turbo task boundary only. It does not prove UI
version resolution, Expo/Metro behavior, native module buildability, runtime
capabilities, or the final 14-package graph closure.
