---
title: catering-v2s R3 独立对抗审查辩证处置
status: PARTIALLY_RESOLVED
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# catering-v2s R3 独立对抗审查辩证处置

本 resolution 不把独立 reviewer 当权威。每条 finding 均按 `ADVERSARIAL_FINDING_DIALECTICAL_INTAKE` 重开 owning source，区分事实、推论与产品裁决，寻找反例/适用条件，并比较 reviewer 修复与更小方案。

```text
REVIEWED_INPUT_DESIGN_SHA256=924fc4de5c8f9aca96becc0a67654991d3b569b8fdb8d1306b9f623548262b58
RESOLVED_DESIGN_SHA256=50f136d1c852b4ac974f8855bdb63fc04f07edc0a4cac3290593619f3bfc3ecd
```

## 处置矩阵

| Finding | 分类 | 复核与反例 | 处置 | 最小修订 | 残余风险 |
|---|---|---|---|---|---|
| IR3-M-001 | 产品/Journey | 批准来源确实只要求“登录 + 一个真实页面”，没有指定 workspace 页面；技术可实现不能证明 Dexter 想要它。reviewer 建议的 exact lookup 也只是候选。 | `DEXTER_DECISION` + `PARTIALLY_CONFIRMED` | 把任务从“浏览目录”收窄成“按已知 workspaceKey 核验注册状态与基础事实”，写清 0/1 结果与字段；仍保持 NO_GO 待 Dexter 接受。 | Dexter 可能要浏览/名称发现或其他入口，届时需重审查询/UI/L2。 |
| IR3-M-002 | 仓内事实 + 权限 | checker 路径确实不存在，handoff fresh 首败精确命中；授权决定 §2 正向白名单不包含 `scripts/check/**`/`tools/**`。 | `CONFIRMED` | 不修补、不绕过；保留 blocker，请 Dexter 单独扩权或批准替代 decision。 | 正式 Claude handoff gate 继续 FAIL。 |
| IR3-M-003 | 实现面推理 | HttpOnly cookie 无法被 SPA 直接读；open response 可建立首次状态，但刷新后丢失。用 platform 真实页面接口只能恢复 platform，operations 无受保护业务接口，不能覆盖双 app session guard。 | `CONFIRMED` | 增加两类 current-session operation，`6/4/2` 改为 `8/5/3`。拒绝把 `/me` 当真实页面，也拒绝为此新增第二业务 Journey。 | current-session response 字段仍需 contract spike 精确冻结。 |
| IR3-M-004 | 流程逻辑 | 空树上要求真实 contract/migration 存在不可达；允许缺失则假绿。完全把所有 production gate 后移又破坏“先门后代码”。 | `CONFIRMED` | 拆成 Gate 0 readiness 与 U02/U03 后 production conformity，复用同一 validator core；不把 R4 全量门提前。 | 时间先后仍需 Dexter-owned Git baseline；无可验证 baseline 时不得 GO。 |
| IR3-S-001 | 事务语义 | “任何失败都 rollback”只适用于非预期异常；expected credential denial 可以作为 typed outcome 正常提交。reviewer 若要求所有失败独立事务 audit 会诱发 `REQUIRES_NEW` 过度设计。 | `PARTIALLY_CONFIRMED` | expected denial 同一 REQUIRED 提交 failure counter/security audit，无 session/success audit；unexpected error rollback；明确禁止 `REQUIRES_NEW`。 | rate-limit 并发算法仍由实现 spike 和 focused test 裁决。 |
| IR3-S-002 | 安全设计 | SameSite=Strict 降低 CSRF 风险但不是完整 browser policy；Spring token 是可行方案，但会再加 bootstrap/operation 与前端状态。当前同源两 SPA 的更小方案是严格 Origin/Fetch Metadata/JSON/default-deny CORS。 | `PARTIALLY_CONFIRMED` | 冻结同源、host-only cookie、exact Origin、same-origin Fetch Metadata、JSON、no credentialed CORS 与负例；禁止裸关 CSRF。 | spike 若证明浏览器兼容性不足，改用 Spring CSRF token 并重算 denominator，不预先双线实现。 |
| IR3-N-001 | 外部漂移事实 | 官方 OpenAPI Generator 文档显示 `useJackson3` 独立且默认 false；Spring Boot 官方文档说明 Jackson 3 是默认、Jackson 2 支持 deprecated。 | `CONFIRMED` | generator spike 同时固定 `useSpringBoot4=true`、`useJackson3=true`。 | 仍需实际 generated compile，设计文档不能代证。 |
| IR3-N-002 | 仓内事实 | §5 的“两条”与 §8 三 owner migration 明确冲突。 | `CONFIRMED` | 统一为三个 owner migration 文件、一份 history。 | 无。 |

## 拒绝的过度修复

- 不新增第二个 operations 业务 Journey 来证明 session；
- 不把 `/me`/current-session 升格成“真实页面”；
- 不在 R3 提前建设 R4 全量 ArchUnit/query/retirement gate；
- 不同时实现 Origin defense 与 Spring CSRF token 两条兼容线；
- 不用 `REQUIRES_NEW` 为每次 expected denial 建第二事务；
- 不因 reviewer 推荐 exact lookup 就冒充 Dexter 已批准产品语义。

## 当前结论

技术 finding `IR3-M-003/M-004/S-001/S-002/N-001/N-002` 已通过设计修订关闭或收敛为 implementation spike oracle；`IR3-M-001` 与 `IR3-M-002` 仍开放。修订后的设计必须重算 hash、更新 granularity manifest 与作者审查，并交另一轮独立 reviewer/Claude 验证修复没有引入新问题。
