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
assertions: ["SELF_TEST_FIXTURE_MUST_MATCH_STRUCTURE","MUTATION_MUST_CHANGE_SOURCE","NEGATIVE_CONTROL_MUST_BE_SEMANTIC"]
sourceRefs: ["doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md","tools/verify-gates/cli.mjs"]
---
# Machine-gate self-test format fragility

- `SELF_TEST_FIXTURE_MUST_MATCH_STRUCTURE`: a self-test that mutates source code must locate the semantic structure with an AST or whitespace-tolerant matcher; it must not depend on formatter-specific spaces or line breaks.
- `MUTATION_MUST_CHANGE_SOURCE`: every fixture replacement must assert that its anchor matched and that the mutated source differs; a silent no-op is not a red mutation.
- `NEGATIVE_CONTROL_MUST_BE_SEMANTIC`: a negative control must distinguish executable literals from comments and documentation, otherwise a text scan can be falsely green or falsely red.
- Root cause: source-format presentation was treated as the guarded behavior, so legitimate formatting changes broke the self-test and no-op replacements could hide that the intended mutation never ran.
- Minimum remedy: parse code literals where the gate is semantic, use whitespace-tolerant anchors only when a full parser is unnecessary, fail before running the gate when an anchor is missing, and keep one real red plus one semantic negative control.
- Applicability: machine-gate self-tests that edit TypeScript/Java/source text. Counterexample: parsed JSON fixtures can mutate a property by key without source-text matching.
