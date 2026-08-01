---
title: catering-v2s R3 专项设计独立 Codex 对抗审查
status: NO_GO
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
reviewerTask: /root/r3_independent_adversarial_review
reviewerContext: fork_turns=none
reviewCycleId: R3-SPECIALIZED-DESIGN
reviewTarget: DESIGN
reviewRound: 1
reviewRoundLimit: 2
repositoryWritePerformed: false
implementationAuthority: false
---

# catering-v2s R3 专项设计独立 Codex 对抗审查

## 独立性

reviewer 以无父会话上下文的独立任务启动，只收到仓根、入口链、只读边界和审查维度。它先从 Roadmap、project-memory、冻结 ADR/manifest 与 standards 独立推导最小 walking skeleton，再读取作者设计，最后才读取作者对抗审查与自审。reviewer 未写仓库、未启动 runtime/数据库/浏览器，未执行 Git 写操作。

本报告审查的输入 hash：

```text
DESIGN_SHA256=924fc4de5c8f9aca96becc0a67654991d3b569b8fdb8d1306b9f623548262b58
MANIFEST_SHA256=1ef89f44a2b2ceccec60699eee924d15b2923be9e18c04dfdbdc08b41645c384
```

## 独立预期方案

最小正确 R3 应证明：

1. 一个获批准的 operator 真实任务，而不是 health/static shell；
2. proxy-only ingress → 一个 stateless backend → 一个 PostgreSQL database → owner schema/readback；
3. 两个真正独立的 admin app 与 principal/session system；
4. face metadata → server registry → app-local generated slice；
5. 每个 HttpOnly-cookie app 有 session bootstrap/readback；
6. 第一行业务 source 前只证明 Gate 0 readiness，真实 contract/migration 创建后再证明 production conformity；
7. 失败登录 bookkeeping、安全负例、受管 business evidence 与零资源 cleanup；
8. 无跨 owner DML、MQ/outbox、internal HTTP client、共享 admin 业务层或 Heritage fallback。

`R3-J01` 是当前最合适的技术候选，但“查看目录并打开详情”仍像导航描述，不足以证明真实用户结果。建议收窄成“按已知 workspaceKey 找到工作区并确认注册状态与基础事实”，仍由 Dexter 决定是否为正确产品入口。

## Findings

### M

#### IR3-M-001 — 产品入口未获批准

- 路径：R3 design §1、granularity manifest `candidateJourney`；
- 事实：批准来源没有冻结 workspace directory/detail 为 platform operator 的真实任务；
- 风险：技术自洽被误当产品正确；
- 最小修复：Dexter 接受 outcome-oriented Journey 和最小 lookup/detail matrix，或选择替代入口；
- 需 Dexter：是。

#### IR3-M-002 — 正式 handoff checker 缺失且当前未授权修补

- 路径：`scripts/check/claude-review-handoff`；
- 事实：`REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN` 会调用不存在的 `scripts/check/implementation-design-granularity`；
- 风险：正式 handoff gate 无法通过；
- 最小修复：Dexter 单独授权新增 checker 的 production validator/shared-core self-test/red fixture，或批准替代控制面 decision；
- 需 Dexter：是，属于写入权限扩展。

#### IR3-M-003 — HttpOnly session 缺少 refresh bootstrap

- 路径：R3 design §2.2、§2.3、§3；
- 事实：原 6-operation denominator 只有 open/close session；SPA 刷新后无法从 HttpOnly cookie 重建 session context，operations-admin 又没有受保护业务 endpoint 可作 readback；
- 风险：session guard 只能在首次登录 response 后假绿；
- 最小修复：增加 face-specific current-session operations，denominator 改为 server/platform/operations=`8/5/3`；`/me` 类 operation 只作 session infrastructure，不冒充真实页面；
- 需 Dexter：否。

#### IR3-M-004 — Gate 0 readiness 与 production conformity 循环

- 路径：R3 design §5、manifest R3-U01；
- 事实：原设计要求空树 Gate 0 对尚未由 U02/U03 创建的真实 contract/generated/migration 做精确 production validation；若缺失仍绿是假绿，若缺失必红则流程不可达；
- 风险：时间 oracle 无法同时满足“先门后代码”和“真实 artifact 精确存在”；
- 最小修复：Gate 0 只证明 validator wiring/self-test/red fixture、D.1 current-tree clean 与业务 source 空 inventory；U02/U03 后用同一 production validator 分段跑 conformity；
- 需 Dexter：否。

### S

#### IR3-S-001 — denial bookkeeping 与整体 rollback 语义冲突

- 路径：R3 design §2.2、§2.3；
- 事实：原文“任何失败不创建 session/audit”与 fail-closed rate limit/security audit 并存；若 expected denial 通过异常回滚，失败计数也可能消失；
- 最小修复：expected denial 返回 typed outcome，在同一 `REQUIRED` 事务提交脱敏失败计数/security-denial audit，但不创建 session/success audit；非预期异常整体回滚；不引入 `REQUIRES_NEW`。

#### IR3-S-002 — browser request-forgery 与 CORS 语义未冻结

- 路径：R3 design §2.3；
- 事实：原文只有 cookie flags，没有说明 CORS、Origin/Fetch Metadata、login content type 或 Spring CSRF；
- 风险：实现者可能为让 SPA 工作而裸关 CSRF 或开启 credentialed wildcard CORS；
- 最小修复：同源代理、host-only cookie、default-deny CORS、unsafe request exact Origin + `Sec-Fetch-Site: same-origin`、JSON content type 与对应负例；若改用 Spring CSRF token，必须重算 operation/generated/L2 denominator。

### N

#### IR3-N-001 — Boot 4 generated binding 应显式选择 Jackson 3

OpenAPI Generator 的 Spring generator 把 `useSpringBoot4` 与 `useJackson3` 分开，后者默认 false；Spring Boot 4 以 Jackson 3 为默认并把 Jackson 2 支持标为 deprecated。最小修复是 spike 同时固定 `useSpringBoot4=true` 与 `useJackson3=true`：

- [OpenAPI Generator Spring options](https://openapi-generator.tech/docs/generators/spring/)
- [Spring Boot JSON](https://docs.spring.io/spring-boot/reference/features/json.html)

#### IR3-N-002 — migration 数量自相矛盾

原 design §5 写“两条 migration”，§8 又写三个 owner migration 文件。最小修复是统一成三个 owner migration 文件、一份 global history。

## Per-unit verdict

| Unit | Verdict | Findings |
|---|---|---|
| R3-U01 | NO_GO | IR3-M-004 |
| R3-U02 | NO_GO | IR3-M-003, IR3-N-001 |
| R3-U03 | NO_GO | IR3-M-003, IR3-S-001, IR3-S-002, IR3-N-002 |
| R3-U04 | NO_GO | IR3-M-001, IR3-M-003 |
| R3-U05 | GO_WITH_UPSTREAM_BLOCKERS | 上游 session/gate 未关闭前不能产生有效 business evidence |
| R3-U06 | NO_GO | IR3-M-001, IR3-M-002 与上游 finding |

## 方案合理性

```text
SOLUTION_REASONABLENESS=REASONABLE_DIRECTION_BUT_NOT_IMPLEMENTATION_READY
VERDICT=NO_GO
M=4
S=2
N=2
```

一个真实 platform task 加 operations 登录边界，比两个业务 Journey 更便宜、比 `/me`/health 更有判别力；但 `/me` 类 current-session readback 仍是必要基础设施，候选页面必须从“导航动作”收敛成 Dexter 接受的用户结果。

## 只读证据

- `scripts/context/recall-memory ...`：命中 6 kernel 与 deterministic-context；
- `scripts/check/standards-coverage --phase R3`：`PLANNED_ENFORCEMENT_OVERDUE:D.1.L01`；
- `scripts/check/heritage-registry`：PASS；
- `scripts/check/codex-self-review --file ...`：PASS；
- `scripts/check/claude-review-handoff --file ...`：`IMPLEMENTATION_DESIGN_GATE_FAILED`；
- `scripts/check/implementation-design-granularity`：不存在；
- design/manifest/ADR/authorization/review SHA-256 与 JSON parse 已独立复算。

## 授权边界

本 review 不授权 R3/W1 implementation、Gate 0 代码、缺失 checker、apps、contract、generated source、migration、test、compatibility spike、DEV、数据库、动态 evidence、Git 或 `WALKING_SKELETON_READY`。
