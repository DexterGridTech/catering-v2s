---
title: R5 v2 有价值资产与 v2s 设计约束反向审计
status: POST_ROUND_2_AUTHOR_AUDIT
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 v2 有价值资产与 v2s 设计约束反向审计

## 1. 审计方法与结论

本审计重新读取 all-v2 当前源码、R5 双盲分析、G-01～G-12 全文、v2s kernel、架构
decision、R5 Journey/interaction/contract catalog/开发蓝图/总详设。判断顺序固定为：

1. 先问该 v2 资产是否服务 R5 已批准的 32 个用户任务；
2. 再问其业务或工程机制是否仍有价值；
3. 最后用 v2s owner、事务、部署、consumer face、business corpus 和退役规则决定
   `CARRY / ADAPT / REGENERATE / NOT_CARRIED`，不以“v2 已存在”替代理由。

结论：R5 已守住主体范围与架构边界，但本轮反向审计发现两个需要在交付前补实的设计点：

- v2 后端 `platform-foundation` 中仍有可复用的无业务事实基础能力，原详设只写了结果规则，
  没有给开发 agent 明确逐项去留，容易全丢或把 messaging/内部服务残件一起搬入；
- 已复制到 v2s 的 `admin-ui-foundation/contextScopedQueryArgs` 仍使用旧
  `workspaceKey`，原详设写了全局改名，却没有把这个具体文件列为必改路径。

两项均已并入开发蓝图和实施单元；不增加 R5 业务范围，不授权实施。

## 2. v2 有价值资产逐类 disposition

| v2 资产/机制 | 价值判断 | R5 disposition | 开发 agent 的确定性落点 |
| --- | --- | --- | --- |
| 两个独立 admin app、现有页面信息层级、ProTable/Descriptions/Drawer/Modal、列表名称进详情、详情内动作 | 直接服务已批准用户任务 | `CARRY_ADAPT` | `frontend-asset-carryover-manifest.json` 的 19 个 surface；不合并 app，不重画已存在页面 |
| `admin-ui-foundation` 的 Drawer lifecycle、detail Drawer、overlay lock、drawer surface、testId | 消除跨页面重复且已经过 v2 行为验证 | `CARRY_ADAPT` | 继续放 `libraries/frontend/admin-ui-foundation`，app 只能消费，不得复制 |
| `platformHttpProtocol`、observed base query、safe logger | correlation、Problem 和脱敏日志仍有价值 | `CARRY_ADAPT` | foundation 内改为 v2s edge 头与 Problem；不得保留旧服务头、旧 endpoint 或 raw payload |
| `contextScopedQueryArgs` | context 隔离机制有价值，但 `workspaceKey` 已被 G-10 修订 | `ADAPT_REQUIRED` | 明确更新 `src/list/contextScopedQueryArgs.ts` 与 `src/foundation.test.ts` 为 `groupWorkspaceKey`；禁止兼容双字段 |
| v2 `platform-wire-model` 的 operation/page 常量生成思路 | 防手写漂移有价值，共享旧 wire model 无价值 | `REGENERATE` | 从唯一 edge OpenAPI 生成 admin operation/page/problem/presentation catalog；不复制旧 Java 字节或共享 generated barrel |
| correlation/request context | 单 deployable 中仍需要一致请求身份和日志关联 | `CARRY_ADAPT` | `libraries/backend/platform-foundation` 中保留 wire-agnostic `CorrelationIdSupport/RequestContext` |
| safe log sanitizer、structured logger、observability auto-configuration | 脱敏、run-scoped 诊断仍是现行标准 | `CARRY_ADAPT` | 同一 backend foundation；按 v2s logging standard 改名/删旧 service 语义 |
| Problem mapping | typed domain problem 到 RFC7807 的集中映射有价值 | `CARRY_ADAPT` | `ProblemDetailSupport` 按唯一 edge ErrorCode catalog 重建 |
| pagination value、query count instrumentation、advisory lock | 分页闭集、DB 次数预算、窄锁语义仍有价值 | `CARRY_ADAPT` | foundation 只保留 `PagedQuery/CountingJdbcTemplate/DatabaseOperationTracker/AdvisoryLock` 等无 owner 事实 primitive |
| OTP rate-limit policy | 安全规则有价值，但属于 workspace-IAM 语义 | `MOVE_TO_OWNER` | `libraries/backend/workspace-iam`，不得成为全局万能 OTP policy |
| v2 owner service 的 domain invariants、状态机和失败语义 | 是后端重构的主要业务价值 | `REIMPLEMENT_IN_V2S_OWNER` | 七个 owner module；按 104 operation catalog 和 G-01～G-10 重写，不复制 remote adapter |
| task overview/read model 的页面聚合意图 | 用户任务真实存在 | `ADAPT_TO_TASK_JOIN` | 同库显式 task join；不搬 projection、asOf、per-source degradation |
| invitation public 7-step、session/context readback、role/page/action/data-node 分离 | 安全与授权边界真实且符合语料 | `CARRY_SEMANTICS_REIMPLEMENT` | workspace-IAM owner；只有 complete 创建任职，mutation 返回 owner readback |
| asset stage/claim/release 与内容校验 | 空间 Logo 任务真实存在 | `ADAPT_TO_LOCAL_TRANSACTION` | platform-asset owner + workspace 同一 `REQUIRED` 事务；不搬 proof/grant/outbox |
| MQ、outbox、listener、repair、polling、34 projection tables | 只服务旧分布式拓扑 | `NOT_CARRIED` | runtime/source/config 零引用 |
| gateway 本体、八份 internal OpenAPI、internal client、service credential、downstream Problem translator | 单 deployable 下增加第二真相与远程失败面 | `NOT_CARRIED` | edge adapter 直接调用本地 application/api；禁止 process-local RPC |
| Ed25519 owner proof、internal service security | 只证明旧跨服务调用 | `NOT_CARRIED` | proxy/session 形成可信 context；owner 在事务内重查事实 |
| 多数据库、多 Flyway history、旧 migration 编号 | 与一个数据库/一条 history 冲突 | `NOT_CARRIED` | 仅在现有 history 后追加能力命名 migration |
| v2 的 `workspaceKey`、`itemCodes[]`、direct assignment、旧“商户/当前身份/查看范围”文案 | 与现行业务语料冲突 | `NOT_CARRIED_OR_REWRITE` | `groupWorkspaceKey`、`items[{code,name}]`、邀请链、四维授权术语 |
| 五个 operations role home bootstrap | route/shell 有价值，旧注释与虚假功能无价值 | `RETAIN_EMPTY_BOOTSTRAP` | 保留 route 与 owner-confirmed navigation，不新增 dashboard 内容 |

## 3. v2s 约束逐项反向核验

| v2s 约束 | 当前 R5 设计承接 | 审计结论 |
| --- | --- | --- |
| 一个业务 deployable；TDP 并列空占位 | `catering-business-server` 组装七 owner；`terminal-data-server` 无 src/runtime | `HELD` |
| 共享能力与 owner module 放 `libraries/backend` | 七 owner module + 本审计补入窄 `platform-foundation` | `HELD_AFTER_CLARIFICATION` |
| 一个 PostgreSQL、多 owner schema、单 Flyway history | 七 schema、`public.flyway_schema_history`、只追加 migration | `HELD` |
| owner 主权；跨模块写公开 command + 同一 REQUIRED 事务 | dependency DAG、command sequence、owner recheck | `HELD` |
| 跨 schema 读只作 task join；不得推导写/锁/FK | overview/candidate task query 与 command graph 分开 | `HELD` |
| 无 MQ/outbox/TDP/internal client/常态轮询 | retirement 与 forbidden pseudo-fix 明列 | `HELD` |
| `x-consumer-faces` 单一真相；两个独立 app | 38/55/11 closure、face-specific generated slice | `HELD` |
| v2 UI carry-over-first + foundation first | 19 个 path@hash surface 与逐项 primitive | `HELD` |
| G-01～G-10 业务词和不得推导 | Journey、interaction、catalog、schema 不变量均有锚点 | `HELD` |
| 时间点后台存储为 long | wire int64、Java long/Long、DB BIGINT；纯业务日期明确例外 | `HELD_AFTER_DEXTER_REQUIREMENT` |
| contract 源文件分类、单文件不过大 | face+capability paths、owner+schema-family components、500 非空行上限 | `HELD_AFTER_DEXTER_REQUIREMENT` |
| DEV start/restart 不 seed；reset/seed 独立且 fail-closed | 五入口、明确 allowlist、32 前提、固定 clock、business/cleanup 分账 | `HELD_AFTER_ROUND_2_REPAIR` |
| Heritage 只读、无 runtime/build fallback | path+hash freeze；只搬到 v2s 后独立拥有 | `HELD` |
| R5 一个设计/实施/review | 12 单元只作执行顺序，不产生单元 verdict/review packet | `HELD` |

## 4. 开发 agent 开工前的正向读取顺序

未来若 R5 implementation 获得明确授权，每个开发 agent 必须按下列顺序读取，而不是先写代码
再等 gate 拦截：

1. 本单元对应 Journey scenario、interaction surface 和 G 条目；
2. `edge-contract-implementation-catalog.json` 中本单元 operation 行及
   `scenarioOperationCrosswalk` 反向行；
3. `development-agent-execution-blueprint.md` 的全局类型/contract 布局和本 owner 章节；
4. granularity manifest 的本单元 `changeSurfaces/orderedChain/forbiddenPseudoFixes`；
5. 若为 UI，读取 `frontend-asset-carryover-manifest.json` 的精确 source/target/foundation 行；
6. 若参考 v2，只能读取已冻结 path@hash，并先执行本文件 disposition；未列资产不得临场搬运。

任何发现设计缺字段、owner、状态、错误或交互语义时，回到同一 R5 设计包修订；不得用 alias、
兼容 DTO、前端补偿、第二 endpoint 或旧 runtime fallback 自行兜底。

