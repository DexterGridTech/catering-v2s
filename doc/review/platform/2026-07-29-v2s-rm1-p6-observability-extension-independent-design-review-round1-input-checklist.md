---
reviewTarget: DESIGN
reviewCycleId: RM1-P6-U01-OBSERVABILITY-EXTENSION-DESIGN-20260729
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
blindReviewRequired: true
---

# RM1 P6-1 observability extension — 独立设计审查 R1 输入清单

审查者必须先以证伪为目标独立重开下列输入；不得先读取作者结论或代写 implementation。审查范围是 design admission，不授权任何源码、契约、runner、动态运行、DEV、seed/reset 或 Roadmap 状态。

| input | SHA-256 / anchor | 必答问题 |
| --- | --- | --- |
| `doc/plans/platform/2026-07-29-v2s-rm1-p6-observability-extension-implementation-design.md` | `422da37eab081f70c471c105e900774f35ac0d5f25efeb7f9251b6f86c32ce6a` | 是否真的解决 P6 用户任务和无日志停滞，而未改变匿名恢复反枚举/owner truth？ |
| extension manifest | `70e98658bb2096b3870c80794b0747d07f02a7de3813bcd267421e420e3ce81c` | source/operation 分母是否精确、完整、无泛化 controller 捕捉？ |
| source disposition | `b029296bd6f12e79de3e1f576caf93e8fc14f67f166b5c61e863f5aee88a63b4` | 六类 source 是否都有 owning source、反例与适用边界？ |
| old P6-1 detail | `§3` | 新设计是否保留账号+手机号+OTP、集团空间品牌、owner-first 与 P6 串行闸门？ |
| unified observability decision | `§1--§4` | 设计是否强制日志、run manifest、log read、cleanup 分账与范围外修复？ |
| frozen logging standard | `# 长期约束` | context/recorder/reaper/secret/phase 形状是否符合，是否误用 audit/Problem？ |
| current runner | `r5-remote-testcontainers.mjs` | 该设计能否处理同步 SSH 静默、失败收集与有效进程回收？ |
| current foundation/edge/advice/controllers | extension manifest `sourceSets` | 真实调用/Problem 形状会不会造成双终态、秘密泄露或 wire 漂移？ |
| edge root + workspace access path doc | extension manifest `contractProjection` | 7 legacy ref / 35 paths / 40 operations 是否属实，修法是否是最小 projection repair？ |

独立核验必须包含：

1. 对全部 18 operationId 逐项在 generated route registry/contract 中找反例；
2. 全量查找 raw request/header/cookie 的现有传递面，判定 typed recorder 是否可能旁路；
3. 推演 success、global Problem、controller-local Problem、unhandled exception 四类终态，找双写或无终态；
4. 推演 runner 的 SSH 断开、无新日志、PID reuse、Gradle 完成但 cleanup 失败，找不安全 reaper；
5. 对 root-path 修复测试“少一条 target”和“重加 generic key”是否必红；
6. 核验每条 red mutation 是实际 validator/test 路径而非字符串扫描自测。

输出 JSON verdict 到指定 R1 路径，必须含 `REVIEW_CYCLE_ID`、`REVIEW_ROUND=1`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、输入 path+hash、blind statement、`GO|NO_GO` 与 M/S/N。finding 先给 owning source、反例、范围与建议；不直接改作者设计。
