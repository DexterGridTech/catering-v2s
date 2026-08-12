# 测试健康闭环整改独立 DESIGN review 输入清单

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_20260811`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`DEXTER_SCHEDULED_ACTUAL_DESIGN_ROUNDS=1`

先证伪设计并形成 verdict，之后才能读取 author intake；禁止写生产文件或启动动态资源。

| 输入 | path / command | result |
|---|---|---|
| 入口与授权 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`CLAUDE.md`、Registry/Roadmap CURRENT、design authorization | READ_FULL |
| project-memory | kernels；三条 design routes；所有命中 memory 及 source refs | READ_ALL |
| upstream | Claude requirements、Codex static audit、reviewed design | READ_FULL |
| owning sources | `verify.mjs`、execution catalog、`standards-coverage`、test/dev/L2/Testcontainers/SQL merge sources named by design | READ_FULL_AND_REDERIVE |
| governance | verification/adversarial/observability decisions；matrix；`scripts/check/standards-coverage --phase R5` | READ_AND_RUN_STATIC |
| design control | granularity checker + self-test after manifest exists | RUN_STATIC |

Verdict must state: `reviewerKind=INDEPENDENT_SUBAGENT`; `blindReviewDeclaration=I received this checklist in a fresh subagent context, tried to falsify the design, and formed findings and verdict before reading author self-review or author finding disposition.`
