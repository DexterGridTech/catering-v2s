# 测试健康闭环整改独立 DESIGN round-2 输入清单

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_20260811`  
`REVIEW_ROUND=2 / REVIEW_ROUND_LIMIT=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`FURTHER_CODEX_ADVERSARIAL_ROUND_ALLOWED=false`  
`SCOPE=THCL-M-001,THCL-S-001,THCL-S-002 only`

Dexter 已授权本次定向 round-2；它只核验 round-1 1M/2S 的最小修订是否真实关闭。先独立重开 owning source 与当前 design/manifest，形成证伪结论；之后才读取 round-1 reviewer report 与 author intake。不得写 production/source/test/runner/contract/active package，不得启动任何动态环境。

| 输入 | path / command | round-2 核验目的 |
|---|---|---|
| 入口与边界 | `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、Registry/Roadmap CURRENT、design authorization、active package | 确认 BPF 仍暂停且当前仅 design-only。 |
| 设计与历史 finding | current detailed design、granularity manifest、round-1 JSON、author intake | 确认新字节具体覆盖 1M/2S，且没有把旧 verdict 改写为 GO。 |
| M owner | `tools/implementation-design-granularity/cli.mjs`、`scripts/check/implementation-design-granularity` | 实测 design markdown 精确 `implementationAuthority: false`、manifest design hash、round-2 current manifest binding。 |
| S-001 owners | `tools/verify-gates/verify.mjs`、execution catalog、`scripts/check/standards-coverage`、standards matrix | 验证 root 唯一执行、receipt schema/atomic transport、pure U12 consumer、selector 分离、无 duplicate execution 的可实施性。 |
| S-002 owners | `backend-performance-final-acceptance.mjs`、`backend-performance-testcontainers-196.mjs`、两侧 tests、requirements | 验证 shared owner、canonical bytes、key boundary、non-secret receipt、wrong MAC/key/payload red controls的可实施性。 |
| 静态控制 | `scripts/check/implementation-design-granularity --manifest <current> --review <round2>`；`scripts/check/standards-coverage --phase R5` | 只运行 static checks；不得把 PASS 表述为动态、业务、cleanup 或性能结论。 |

round-2 verdict 必须逐项给出 `THCL-M-001/THCL-S-001/THCL-S-002` 的 `CONFIRMED_CLOSED` 或新 finding，并明确确认：不新增 execution map/gate/jsdom，不扩大 daily verify，不触发 BPF/Testcontainers/DEV/L2/seed/reset/browser/UAT。若仍有 M/S，round-2 为 hard stop，直接交 Dexter，不得启动 round-3。
