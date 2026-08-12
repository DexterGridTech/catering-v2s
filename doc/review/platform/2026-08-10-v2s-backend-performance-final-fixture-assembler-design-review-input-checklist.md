# Final fixture assembler design — independent review input checklist

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_FIXTURE_ASSEMBLER_DESIGN_20260810`  
`REVIEW_TARGET=DESIGN`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`

The reviewer receives this checklist in a fresh context. Before reading any author intake, it must
try to falsify the fixture-plan design and record a verdict. It must not infer runtime authorization:
the active package has `runtimeAuthority=false`.

| required input | path / command | SHA or expected result |
| --- | --- | --- |
| execution rules | `AGENTS.md`, `CLAUDE.md` | `4d64bfb2…`, `8b12b36e…`; read full |
| Roadmap and authorization | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` CURRENT block; current static package input | `487494c4…`, `b8abfdf6…`; final dynamic remains later |
| all memory kernel | `project-memory/kernel/01-*.md` through `06-*.md` | hashes from `project-memory/index.md`; read all |
| routed memory | `scripts/context/recall-memory --task-kind design --domain platform --consumer-face backend --owner platform --impact evidence --trigger implementation` and each returned source | run and read all hits |
| determinism/review/performance rules | `project-memory/decisions/deterministic-context-only.md`, `project-memory/decisions/independent-subagent-adversarial-review.md`, `project-memory/decisions/http-crud-efficiency-design-redlines.md`, `project-memory/operations/verification-governance.md` | `4c98ed79…`, `891fc8de…`, `80efcb00…`, `e424bf92…` |
| standards | `contracts/policy/standards-coverage-matrix.json`; `scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE` | `130abbd8…`; PASS |
| reviewed design | `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-design-amendment.md` | `45e7732459bf3a2dba270b48d71527914ae60b6fe26e4835b39eedeae2fbb093`; read full |
| literal plan oracle | `contracts/policy/backend-performance-final-fixture-catalog.json` | `6cdf737218df5f50539496e43453c0d8ce932aecda39aca2d3fbf2df85e723b5`; read declarations and sample every area/family |
| mechanical enforcement | `scripts/check/backend-performance-final-fixture-catalog`; run `--check` and `--self-test` | both PASS; inspect red mutations |
| workload denominator | `scripts/test/backend-performance-workload.mjs`, both generated route registries and referenced OpenAPI shards | derive 396=78+5+79+38+196, 166 GET/230 command, 216 JSON/12 NONE/2 multipart, 462 path/92 query bindings |
| implementation admission | `doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-granularity-manifest.json` | `e05e3251…`; confirm amendment/catalog path+hash and 396/230/166/462/13/103/10 binding |

Independent checks must falsify: duplicated/missing plan rows; command family overlap or omission;
unbound query/path values; a no-body command with a builder; a source algorithm hash drift;
generic `operationId` dispatch; and any ability to run the adapter or dynamic resources before
the design and static implementation reviews close.
