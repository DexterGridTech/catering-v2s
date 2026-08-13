---
id: pitfalls.green-by-existence-check
status: active
layer: routed
taskKinds: ["implementation","testing","review"]
domains: ["platform","backend","contract","admin-ui"]
consumerFaces: ["all"]
owners: ["platform","backend","frontend-platform"]
impacts: ["evidence","governance"]
triggers: ["implementation","review","failure"]
assertions: ["EXISTENCE_IS_NOT_EXECUTION","EMPTY_GLOB_MUST_FAIL"]
sourceRefs: ["doc/review/platform/2026-08-11-v2s-test-delivery-and-process-remediation-requirements-claude.md","scripts/test/test-health-entry-runner.mjs"]
---
# Green by existence check

- `EXISTENCE_IS_NOT_EXECUTION`: `existsSync`, a source marker, a self-authored default, or an unconsumed success string cannot certify that a gate or test ran and passed; the owning executor must report the actual exit status and required result markers.
- `EMPTY_GLOB_MUST_FAIL`: a directory expansion must not silently turn an unmatched pattern into `tests 0 / fail 0`; new test directories are added as explicit entries and discovery must equal execution.
