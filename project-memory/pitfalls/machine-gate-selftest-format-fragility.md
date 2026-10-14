---
id: pitfalls.machine-gate-selftest-format-fragility
status: active
layer: routed
taskKinds: ["implementation","testing","review"]
domains: ["platform","admin-ui","contract"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform"]
impacts: ["evidence","governance"]
triggers: ["implementation","review","failure"]
assertions: ["SELF_TEST_FIXTURE_MUST_MATCH_STRUCTURE","MUTATION_MUST_CHANGE_SOURCE","NEGATIVE_CONTROL_MUST_BE_SEMANTIC","LAYOUT_GATE_MUST_MATCH_CURRENT_VOCABULARY","STATIC_FIXTURE_MUST_USE_REAL_IMPORTS_AND_TYPES","COMPOSED_ACTOR_DEFINITION_MUST_BE_RECOGNIZED","OWNER_CALLBACK_REFACTOR_MUST_UPDATE_FACTORY_WIRING"]
sourceRefs: ["apps/terminal/kernel/feature/store-basic/src/features/actors/storeBasicActor.ts","doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md","doc/platform/terminal-coding-standard.md","tools/terminal-skeleton/check-static.mjs","tools/terminal-skeleton/check-static.test.mjs","tools/verify-gates/cli.mjs"]
---
# Machine-gate self-test format fragility

- `SELF_TEST_FIXTURE_MUST_MATCH_STRUCTURE`: a self-test that mutates source code must locate the semantic structure with an AST or whitespace-tolerant matcher; it must not depend on formatter-specific spaces or line breaks.
- `MUTATION_MUST_CHANGE_SOURCE`: every fixture replacement must assert that its anchor matched and that the mutated source differs; a silent no-op is not a red mutation.
- `NEGATIVE_CONTROL_MUST_BE_SEMANTIC`: a negative control must distinguish executable literals from comments and documentation, otherwise a text scan can be falsely green or falsely red.
- Root cause: source-format presentation was treated as the guarded behavior, so legitimate formatting changes broke the self-test and no-op replacements could hide that the intended mutation never ran.
- Minimum remedy: parse code literals where the gate is semantic, use whitespace-tolerant anchors only when a full parser is unnecessary, fail before running the gate when an anchor is missing, and keep one real red plus one semantic negative control.
- `LAYOUT_GATE_MUST_MATCH_CURRENT_VOCABULARY`: a package-layout gate must enumerate the currently allowed source-root and direct-child vocabulary, then add one red mutation for each legacy/unclassified location class. Rejecting only a previously observed filename can leave sibling legacy directories or unclassified root files as false-green paths.
- `STATIC_FIXTURE_MUST_USE_REAL_IMPORTS_AND_TYPES`: a source-graph mutation fixture must compile against legal package-local imports and real API types. An invalid import or untyped fixture can fail before reaching the intended gate and create a false regression signal.
- `COMPOSED_ACTOR_DEFINITION_MUST_BE_RECOGNIZED`: actor qualification must recognize the owner actor definition even when command handlers are installed in dedicated helper modules. Keep reducer dispatch inside the owner actor; helper files may coordinate work through narrowly scoped owner callbacks rather than becoming alternate state writers.
- `OWNER_CALLBACK_REFACTOR_MUST_UPDATE_FACTORY_WIRING`: when a helper's required owner callbacks change, update the actor factory's dependency object in the same edit. Re-run that package's typecheck and the existing runtime path that invokes the helper; a successful helper-local compile does not prove the owner factory supplied the callbacks.
- Root cause for these additions: a directory-specific check was narrower than the approved source vocabulary, and a test fixture modeled an impossible source shape. A composed actor was also mistaken for a missing command boundary because the gate required definition and handler installation to appear in one file.
- Minimum remedy: make the gate enforce the closed package vocabulary and isolate its red mutation; compile or type-resolve the mutation fixture before trusting its gate outcome; identify actors from the resolved actor definition while retaining the reducer-boundary check on non-actor helpers.
- Applicability: machine-gate self-tests that edit TypeScript/Java/source text. Counterexample: parsed JSON fixtures can mutate a property by key without source-text matching.
