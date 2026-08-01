---
title: catering-v2s R3 专项设计 Codex 自审
status: NO_GO
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# catering-v2s R3 专项设计 Codex 自审

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-SPECIALIZED-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## 用户任务

业务用户要验证的新底座不是静态壳：平台管理员登录后能完成一个真实、可理解的管理任务，并由 owner 事实 readback；同时不把 R3 扩成批量业务迁移。

## Dexter 立场

Dexter 要的是 solo + AI 阶段最薄、可证明、分钟级回归的 walking skeleton；产品入口不能由接口或旧实现反推，R3 设计 GO 也不能自动授权 implementation。

## 替代方案

- `/me` 或 health 更短，但不选作真实页面：不能证明 workspace task 与 owner readback；两类 current-session readback 仍作为刷新恢复基础设施保留；
- 两个 admin 各做业务页更完整，但不选：把一条 skeleton 扩成两个 Journey；
- operations 空工作台符合一条冻结规则，但不选为首选：业务 read model 判别力不足。

当前推荐 `platform-admin 按已知 workspaceKey 核验注册状态/基础事实 + operations-admin 独立登录与 session 恢复面`，但产品入口仍需 Dexter 接受。

## 方案合理性

问题选择正确：需要证明一代理、一 app、一库、双 consumer 与真实页面，而不是证明静态文件存在。方案以 3 个 owner module 和 8 个 operation 换取两类 principal 非 union、刷新后 session 可恢复、generated slice 非空与一个真实页面，复杂度与判别力基本匹配；两个未关闭 M 使其暂不能 GO。

## UI 与交互

APPLICABLE：workspace 核验候选来自“登录 + 一个真实页面”的 Roadmap 目标，但具体页面并非既有批准 Journey，因此没有把它升级为产品真相。exact workspaceKey→0/1 result→只读详情比无目的浏览更接近可验证任务；health、disabled form、操作列、模糊搜索和假工作台均被拒绝。歧义来源是冻结输入未指定页面入口，需 Dexter 裁决，而不是由后台接口或独立 reviewer 决定。

## 审查意见复核

round 1 独立 reviewer 得出 `NO_GO(4 M / 2 S / 2 N)`。Codex 没有全盘接受，而是在 `doc/review/platform/2026-07-24-v2s-r3-design-independent-review-resolution.md` 逐条重开证据、查官方一手资料、找反例并比较更小修复：

- `IR3-M-001`：`DEXTER_DECISION + PARTIALLY_CONFIRMED`，只收窄候选任务，不冒充已批准；
- `IR3-M-002/M-003/M-004/N-001/N-002`：事实确认，其中 M-003/M-004/N-001/N-002 已在设计内最小修订；M-002 当时因权限判断保持开放；
- `IR3-S-001/S-002`：`PARTIALLY_CONFIRMED`，拒绝 `REQUIRES_NEW`、双 CSRF 方案和 R4 gate 前移，只冻结当前阶段最小 typed-denial 与同源 browser policy；
- reviewer 未证明的产品语义不驱动范围；外部 Jackson 结论已由 OpenAPI Generator 与 Spring Boot 官方文档印证。

round 2 fresh-context reviewer 随后给出 `NO_GO(2 M / 3 S / 3 N)`。Codex 在 `doc/review/platform/2026-07-24-v2s-r3-revised-design-verification-resolution.md` 再次辩证复核并作本 cycle 最终决定：

- current-session 字段/失效语义：`CONFIRMED`，只补 app guard 必需字段和 valid/expired/revoked/cross-face/network 行为，拒绝 role/capability 通用模型；
- Gate 0 checkpoint：`CONFIRMED`，补 Dexter-owned immutable commit 与 descendant proof，不引入 checkpoint/可信时间服务，也不把当前 dirty tree 当 oracle；
- browser-forgery：`PARTIALLY_CONFIRMED`，补 server-managed canonical origin、filter order、OPTIONS/CORS header 与唯一 CSRF 配置；依据 OWASP/W3C，不接受“缺 `Sec-Fetch-Site` 一律拒绝”，改为有则校验、无则 strict Origin fallback；
- manifest 旧计数/旧 feature 名：`CONFIRMED` 并修订；
- 首轮旧 input bytes：`PARTIALLY_CONFIRMED_UNRECOVERABLE`，如实保留 provenance debt，不事后伪造 snapshot；
- 版本 spike：`CONFIRMED_OPEN`，保持未来单线验证。

本 `R3-SPECIALIZED-DESIGN / DESIGN` cycle 已达到两轮硬上限。Codex 现在自行给出下述结论，不再召集第三轮 Codex reviewer；后继只允许 Dexter 裁决与一次既定 Claude 独立评审。

两轮结束后，Dexter 澄清必需仓内控制面属于 Codex 自主维护权，不需要逐文件授权。这是权限事实变化后的执行闭环，不是第三轮对抗审查。Codex 已新增 `scripts/check/implementation-design-granularity` 与 supporting production validator，self-test 及 design-hash drift、missing business evidence、severity-count mismatch、round-three、missing finding-unit link 五类 red fixture 均 PASS；`IR3-M-002 / R3-DESIGN-M-002` 因此关闭。

## 结论

```text
VERDICT=NO_GO
M=1
S=0
N=2
SELF_REVIEW_INDEPENDENT=false
CODEX_ADVERSARIAL_ROUNDS_COMPLETED=2
CODEX_ADVERSARIAL_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
NO_FURTHER_CODEX_ADVERSARIAL_ROUND=true
IMPLEMENTATION_AUTHORITY=false
```

设计本体已达到路径、owner、事务、schema、security、contract、双 admin、failure 与 evidence oracle 粒度；推荐的 `R3-J01` 比 `/me`/health 假页面更能证明目标架构，又比双业务 Journey 更小。

正式 Claude handoff 控制门已真实调用 granularity checker 并 PASS，但 packet 仍因产品语义阻断，不能提交正式 Claude verdict：

1. `R3-DESIGN-M-001`：`R3-J01` 仍是 Codex 推荐候选，Dexter 尚未明确接受该产品入口；
2. `R3-DESIGN-N-003`：ArchUnit、Gradle 与前端版本集合必须在 implementation 前由单一 spike decision 精确冻结。
3. `R3-DESIGN-N-004`：首轮被审 design/manifest 当时为未跟踪文件，原 hash 与 reviewer finding 尚在，但仓内不存在可独立重算的旧 bytes；不影响现行 packet 的 hash 重算，但以后必须在 mutation 前绑定 immutable snapshot/blob。

## 闭环核验

- 授权：设计写入与 R3/W1 implementation、动态运行、数据库、Git 明确分离；
- 方案：比较了平台目录、双业务页、health、空工作台与 Heritage 复制；
- owner/transaction：三个 owner module，一个 judgment COMMAND edge，一个 SCHEMA_FK edge，同一 `REQUIRED` 事务；
- contract：单一 OpenAPI、8 个 operation、server/platform/operations=`8/5/3`，两 app 的最小 current-session 字段、401 与 unavailable 语义均已冻结；
- UI：一个 platform page，exact lookup/detail 两 surface；operations 不造假业务页；
- runtime：一代理、一 app、一库、一 history；五命令分权；
- security：server-managed per-face canonical origin、edge→browser-forgery→session/auth 顺序、strict Origin + conditional Fetch Metadata fallback、无 CORS allow header 与单线 CSRF strategy 已冻结；
- evidence：GATE_0 readiness 与 post-U02/U03 production conformity 分离，Dexter-owned checkpoint/descendant proof、proxy-only L2、business/cleanup 分账与精确 red fixtures；
- control plane：implementation-design-granularity production validator 真实复算 hash/anchor/unit/finding/verdict/round，self-test 与五类外部判别性 red fixture PASS；
- standards：fresh R3 preflight 的真实首败已保留并诊断为 D.1 gate 到期未接线。

## 同类扫描

| 风险类 | 结果 |
|---|---|
| 旧多服务/gateway/internal client/MQ/outbox/TDP 复播种 | `NOT_APPLICABLE / forbidden` |
| union login DTO 或两 principal 共用 session | `forbidden` |
| frontend allowlist/runtime face filter/shared generated model | `forbidden` |
| 第二 Flyway history/跨 owner DML/REQUIRES_NEW | `forbidden` |
| start/restart seed、reset 后 seed、kill-by-port | `forbidden` |
| health 或 `/me` 冒充真实页面 | `forbidden` |
| 同会话作者审查冒充 independent reviewer | `not claimed` |
| 通过删除 `REVIEW_KIND` 绕过 checker | `forbidden; checker now passes` |
| 换 reviewer/模型/文件/hash 触发第三轮 Codex review | `forbidden; round 2 hard stop` |

## Hash 绑定

| artifact | SHA-256 |
|---|---|
| implementation design | `253045ba543a2ea319aeadb7e1c5fc785df4d81afc4563c2c9ca9bb5f57c8dbd` |
| granularity manifest | `aeb5cabd4cdb3891c0166a469dfdd67bb67335c233358f37fa1c510475765e27` |
| round 1 independent Codex review | `91bef03d7db0b15e26732a0e4ffc78467f9bbf6bf4c3e4d985f9485ae98bbb49` |
| independent finding resolution | `dd618ce63695f4465eadcdc39e289e67b54060039e90d2bf0814409ead61da76` |
| round 2 independent verification | `71813494e28b1211acd52d7e476504569dced1627fa37cdad2a2149dc9c8f568` |
| round 2 verification resolution | `f83009d1abd5684e7cda9af42664eecced90ef41806853939a338a6483dc8bd7` |
| Codex adversarial review | `c9ff4bd35be692b4b88e4c34c147914720c19b2317822ba9b86c5a0096a2bfa7` |

## 授权边界

本自审不接受产品 Journey、不授权 `GATE_0` 或任何 R3/W1 business implementation。必需 checker 已依据 Codex 控制面维护权关闭；本 cycle 仍是两轮 SELF_DECIDED，不启动 round 3。Dexter 接受或改选 `R3-J01` 后即可重算最终 packet hash、fresh 运行 design handoff gate，并交由独立 Claude 重新推导方案与 verdict。
