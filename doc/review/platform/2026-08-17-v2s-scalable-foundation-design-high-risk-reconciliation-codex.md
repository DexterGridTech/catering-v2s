# 20 倍业务量的健壮底座 · 作者高风险设计对账

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | `DESIGN` |
| 审查者 | `AUTHOR_HIGH_RISK_RECONCILIATION`（不是 fresh independent verdict） |
| 范围 | G1/P-1、P-2、P-7、D-3/D-5、O-3、E-1、批次写入顺序 |
| 动态执行 | 未运行；未授权 DEV/reset/seed/HTTP/L2/UAT/Testcontainers |
| 结论 | `NO-GO · M=1 · S=2 · N=1`；M-1 需要 Dexter 裁决，两条 S 已回写详设 |

## M-1 · G1 第一达成判据与批准范围冲突

**位置**：需求 G1、P-1/D-1/D-2 的推迟决定；详设 §0。

**事实**：G1 要求下一个新增 owner 模块内 raw `command_receipt` INSERT 和 `pg_advisory` 为零；P-1 却推迟，当前不存在能容纳多种 scope-key 形态的共享 receipt implementation。P-2 只修四个现存 owner 的首次并发，不会产生这一前向能力。

**后果**：三个批次即使全通过，也不能诚实宣称完整关闭 G1。

**最小处置**：维持 P-1 推迟，则最终目标改报“本轮批准范围 GO，G1 第一判据 `DEFERRED_BY_APPROVED_SCOPE`”；若必须完整 G1，Dexter 需把 P-1/D-1/D-2 拉回范围。不能改判据文字掩盖缺口。

**状态**：`DEXTER_DECISION`。详设已显式保留，未擅自扩范围。

## S-1 · P-7 仍有一条 Markdown 真相链

**位置**：`tools/catalog-inventory-p1/cli.mjs:671-673`，详设原 §4.3/§6 B2-C。

**事实**：CLI 读取 IA Markdown，提取 IA ID，并以固定 `89` 与 JSON assertion 的 exact set 决定通过/失败。即使 generator 移除 Markdown，这条 verifier 仍让 Markdown 成为 operation/IA truth。

**后果**：新增命令仍可能需要改 Markdown 才能让生成/检查通过，P-7 的“contract JSON 是真相”及 15→9 目标不成立。

**最小处置**：把 `iaIds` 闭集放入 operation contract JSON 或 design-byte coverage JSON；CLI 从 JSON 验证，删除 Markdown 读取与固定 89。已回写详设。

**状态**：`CONFIRMED`。

## S-2 · P-2 不能以一个固定顺序覆盖 C4、普通写和 copy

**位置**：`CatalogOwnerService.executeBatchStatusWithReceipt: lock → replay`、`executeWrite: recheck → replay`；详设原 §2.1/§3.2。

**事实**：C4 已合规且保持 lock 后直接 replay；普通写当前有 owner freshness recheck；copy 需要锁后重算/核 preflight fingerprint。三者不是同一种 replay 语义。

**后果**：若实施者机械套用“lock → recheck → replay”，会改变 C4 的既有重放行为；若套用“lock → replay”，会绕开普通写与 copy 的 freshness 防线。

**最小处置**：锁位置统一，replay freshness 按入口保留；分别规定 C4、普通写与 copy 的顺序。已回写详设。

**状态**：`CONFIRMED`。

## N-1 · O-1/O-4 的边界应明确

**位置**：详设 B2-B。

**事实**：O-1 的正确目标是统一 completion event，而非 service logger 数量；两个 App 已有可注入 beacon sink，`enabled` 仅抑制 console/debug，不应阻止注入 sink 的 WARN/ERROR。

**后果**：不写清会导致实施者要么到处补 logger，要么把生产 URL 配置误报为本轮已验证。

**最小处置**：明确 O-1 由 O-2/O-3 承接，O-4 只验证 injected sink；部署 sink URL 留 HANDOFF。已回写详设。

**状态**：`CONFIRMED`。

## 已核且未形成 finding 的高风险点

- **P-2 Extension**：`DuplicateKeyException` 后同事务查询确有 PostgreSQL abort 风险；详设的 advisory lock → query → insert/update 方向成立，需以后续并发测试证明。
- **D-3**：P3 migration 确有 `(component_item_ref, product_sku_ref)` 复合 FK，但不带 scope；详设没有继续使用“所有 FK 单列”的错误前提。
- **D-5**：store 的 `brand_id` 与 `tenant_id` 需要两个独立 leading-column 索引，连同 contract/workspace 共四条；详设已纠正。
- **O-3**：当前 `afterCompletion` 只拿到 resolver 未处理的 exception；capture resolver 写 request state、返回 null、最终在 completion 按 status 记一次日志，能避免抢 Spring 400/404/405/406，仍需 focused regression test。
- **E-1**：`verify.mjs` 裸调 `gradle`，remote runner 以 `command -v gradle` 推导 distribution home；详设要求共用 resolver而非只加 wrapper，方向成立。
- **批次顺序**：B1 先删无消费者 Java binding、统一 Gradle 入口与断言处置，B2 再改生成/契约，B3 最后冻结 testId/尺寸门，没有发现必须新增第四批的写入冲突。

## 授权边界

本文件只记录作者对当前设计和源码的高风险对账；不替代 AGENTS.md 要求的 fresh independent DESIGN verdict，不授权实施、动态环境或下一 Roadmap step。
