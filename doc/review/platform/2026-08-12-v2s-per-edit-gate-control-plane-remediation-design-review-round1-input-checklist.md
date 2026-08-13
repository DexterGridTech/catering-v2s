# per-edit 门控制面自锁整改独立 DESIGN review 输入清单

`REVIEW_STATUS=WITHDRAWN_BY_DEXTER_EXPLICIT_WAIVER_20260812`  
本清单未形成 verdict；Dexter 已明确要求停止 Codex 内部对抗性 review，直接进入唯一一轮 Claude DESIGN review。

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=PER_EDIT_GATE_CONTROL_PLANE_REMEDIATION_DESIGN_20260812`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`

先重开 source 并以证伪为立场形成 findings/verdict；不得读取尚未形成的 author intake，不得写文件或启动动态环境。

| 类别 | 输入 | SHA-256 / 动作 |
|---|---|---|
| repo entry | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、Registry/Roadmap CURRENT、project-memory kernels 与 routed memories、`scripts/README.md` | READ_REQUIRED |
| authority | `doc/evidence/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-authorization.md` | `bed4d99e23c7c86614d0acf306e8de487111188d9e04318ea9a3f3cc97f8d34c` |
| requirement | `doc/review/platform/2026-08-12-v2s-per-edit-gate-deadlock-remediation-requirements-claude.md` | `a6d2e3ffb593b77cb9f2035b07243be97accc8c7246bf283a57fe8d5553cead8` |
| design | `doc/plans/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-implementation-design-codex.md` | `d5d48a3e8d7362c6545a59c6b17a2cd44072978a16d9b75116ab6fb75f068303` |
| manifest | `doc/review/platform/2026-08-12-v2s-per-edit-gate-control-plane-remediation-design-granularity-manifest.json` | `10130e6180670fa73792b9a3756ee178410f1d1594c1719d5b853499c181f1d9` |
| owning source | `tools/compliance-control/cli.mjs` | `30e93c3bfbbe4a80404d1270d53a8f522052d48f29646b60af7cf27feefef68c` |
| owning closure | `contracts/policy/mandatory-per-edit-gate-command-closure.json` | `d2e5c6689cdcaccb23260fa718dd577af01aa5c8bad8a5c67c9175cdacd06016` |
| owning gate | `scripts/check/backend-performance-sql-merge-coverage` | `9e2696527b35df2c86a7f6c4566f25076ae0d7fc61d99a00d21f274c884b0573` |
| related controls | `scripts/check/mandatory-per-edit-gate-self-test`、`scripts/check/active-package-recovery-self-test`、`scripts/check/implementation-design-granularity` | READ/RUN_STATIC |
| governance | deterministic context、incremental hook、verification governance、independent review、observability、finding generalization、standards matrix | READ_ALL_HITS |

必须独立重算并判断：

1. P0 首次 bridge 是否真是不可再缩小的鸡生蛋解，durable bootstrap 是否能在当前失败点前运行且不能变成正常 scope bypass；
2. P1 changed-path 分母是否真的独立于 receipt，FAIL receipt 删除/编辑能否被 ledger 检出，trim 是否共用校验，是否偷偷恢复退役 after-hash exact-set；
3. P2 六 archetype 映射是否完整、相关、可执行，新增 profile adapter 是否构成不合理第二套体系，final exit 是否要求新鲜执行；
4. P3 anchor denominator 是否有限可复算，双源/行为/保留三分法是否会误删实现纪律；
5. 文件面、六类 package-exit 分母、红变异、串行依赖、静态授权边界是否 implementation-ready。

verdict 必须声明：`blindReviewDeclaration=I received this checklist in a fresh independent subagent context, attempted to falsify the design, and formed findings and verdict before reading any author intake.`；输出 M/S/N counts、逐 unit verdict、solution reasonableness 与明确授权边界。
