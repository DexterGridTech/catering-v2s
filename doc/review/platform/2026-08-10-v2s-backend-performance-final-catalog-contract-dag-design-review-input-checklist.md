# Final catalog-contract and executable-DAG design — independent review input checklist

`REVIEW_CYCLE_ID=BACKEND_PERFORMANCE_FINAL_CATALOG_CONTRACT_DAG_DESIGN_20260810`
`REVIEW_TARGET=DESIGN`
`REVIEW_ROUND=1`
`REVIEW_ROUND_LIMIT=2`

The reviewer must work from a fresh context, read this checklist completely and attempt to
falsify the design before reading author conclusions. This remains design-only:
`implementationAuthority=false`, `runtimeAuthority=false`, no dynamic resource may be started.

| required input | review action |
| --- | --- |
| `AGENTS.md`, `PLATFORM-BLUEPRINT.md`, roadmap CURRENT block, `scripts/README.md` | read full/current authorization; distinguish static design from dynamic acceptance |
| all project-memory kernels and routed business/implementation/evidence hits | read G03/G05/G07/G11/G12, deterministic context, source reread and verification rules |
| `contracts/policy/standards-coverage-matrix.json` | run `scripts/check/standards-coverage --phase BACKEND_PERFORMANCE_FINAL_CLOSURE` |
| this manifest and `...catalog-contract-dag-design-intake.md` | recompute hash and test every claimed change surface against business actor/owner boundary |
| final catalog, checker, workload and route/OpenAPI sources | independently recompute 396 / 592 / 113 / 216+12+2; search for legacy raw-state materialization |
| catalog owner, coordinator, edge controller, capability token, canonical OpenAPI/coverage/generator and generated consumer | verify delete field drift, single-vs-double promotion envelope, selected data node/capability/REQUIRED invariants, and no contract/generator change need |
| `scripts/test/catalog-inventory-l2-test-fixture.mjs` | confirm temporary item is normally reachable by create -> save -> detail; reject terminal/RM1 runtime reuse as an implementation path |
| final runtime/fixture scripts | prove no static test or design action can start final runtime or substitute measurement secret for credentials |

Falsify at least: an owner response that contradicts the claimed raw contract; loss of operations
role/session/data-node/owner-recheck semantics; a terminal or SQL shortcut; a stale or cross-item
preflight digest; a delete replay claim unsupported by owner ordering; a generated artifact change
smuggled into the scope; wrong 396/592/113 denominator; and any extra implementation surface.
