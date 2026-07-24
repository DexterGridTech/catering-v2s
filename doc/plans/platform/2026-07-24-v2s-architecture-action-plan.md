---
title: v2s 架构裁决行动计划
status: DRAFT_DERIVED
createdAt: 2026-07-24
updatedAt: 2026-07-24
implementationAuthority: false
adrStatus: W0_FROZEN_INPUT
adrRef: doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
sourceManifest: doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
sourceDiscussion: doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md
---

# v2s 架构裁决行动计划

## 0. 目的与授权边界

本计划把已关闭的 D1-D12 转成可执行准备物，确保每条裁决都有规则、机器门、测试与文档归宿。它不是 v2 当前 Roadmap 的实现许可，也不授权在 `catering-all-v2` 中提前改造运行时；真正开工仍须在 v2s 新仓完成 ADR、项目记忆播种、批准设计与相应实现入口。

Dexter 已于 2026-07-24 接受并冻结新服务形态 ADR 与 carryover manifest；manifest 的 Codex 独立审查结论为 `GO(0 M / 0 S / 0 N)`。W0 第 1-3 项因此关闭。第 4-7 项仍待未来 v2s 建仓入口处理，不能把任一文档冻结扩张为建仓或实施授权。

## 1. 执行波次

### W0：冻结架构真相

1. `[CLOSED]` 起草并冻结新服务形态 ADR，明确标准基础设施反向代理 + 一个业务 app + PostgreSQL 单库多 schema；
2. `[CLOSED]` 在 ADR 中逐条登记 D1-D12、替代方案、supersede 关系与未来重判触发；
3. `[CLOSED]` 独立审查并冻结 carryover manifest，锁定资产取舍、通用设计要求与携带样板；
4. 重播种 v2s project-memory，删除或替换多服务拓扑专属规则；
5. 建立单一模块依赖 registry，以 `COMMAND / SCHEMA_FK / TASK_READ` 标记三类边；
6. 建立 `HANDOFF.md`，写入七项初始生产化欠账与可判定 trigger；
7. 在未来 v2s 建仓入口另行确认后，冻结旧 v2 为只读迁移来源，不再把当前实现形态当成目标架构。

### W1：建立最薄可运行骨架

1. 建立 `apps/backend` 单 deployable、两个独立 admin app、contract 与全局 migration 布局；
2. 接入标准反向代理、覆盖式 forwarded/internal header、`X-Edge-Auth` 直连拒绝；
3. 用 Java 21 + Spring Boot 4.1 做最小兼容性 spike；
4. 建立一份全局 Flyway history、UTC 毫秒版本命名与 PostgreSQL Testcontainers 基线；
5. 实现 `start/restart/stop/seed/reset` 五个 DEV 命令：start/restart 正常运行 Flyway additive schema migration，但不 seed/迁移数据语料；reset 是唯一破坏性入口，按显式 allowlist 清理开发数据库与 asset 开发存储路径/对象桶，reset 后不自动 seed，并以 reset report 逐项记录前后 readback；
6. 打通登录 + 一个真实页面的 walking skeleton。

### W2：机器门先于业务迁移

1. ArchUnit：模块 API、repository/domain 可见性、事务传播、listener 白名单与 coordinator 零资产；
2. migration 检查：schema owner、跨 schema FK、依赖 registry、全局版本与 DDL 范围；
3. query 检查：禁 DML/`FOR UPDATE`/`SELECT *`，并运行真库安全负例和 DB 次数预算；
4. contract/codegen：`x-consumer-faces`、服务端 route face、双 admin endpoint slice 三方对账；
5. generated wire：每个 target 只生成 operation 可达闭包，foundation 保持 wire-agnostic；
6. 建立分钟级 `scripts/verify`、red fixtures、module→L2 确定性映射与 `scripts/check/handoff-debt`。

### W3：按模块与用户 Journey 迁移

1. 先迁稳定 owner/invariant，再迁跨模块 coordinator；
2. 状态变更走目标 owner command API，事务内业务判断走 judgment API；
3. 页面读走发起任务模块的 surface read model 与显式跨 schema join；
4. 顶层 command 在事务内首批读解析一次 `ExecutionContext`；
5. 每个迁移单元同时登记保留、改写、删除与不带走资产；
6. 删除旧服务通信、投影补偿、轮询、内部 OpenAPI/client 与旧测试，不留兼容路径。

### W4：证据与移交

1. 每次变更通过 `verify + walking skeleton + 确定性受影响 L2/L3`；
2. 动态证据分别记录 business 与 cleanup，零活跃受管资源；
3. 对迁移范围执行旧路径零引用、零注册、零 route、零 generated symbol 检查；
4. 对 owner/contract/schema/security/transaction 变更执行 Claude 独立对抗审查；
5. HANDOFF trigger 未发生的欠账保留；已发生的欠账必须先由 decision + evidence 关闭。

## 2. 决策闭环矩阵

| 决策 | 规则 | 机器门 | 测试/证据 | 文档落点 | 波次 |
|---|---|---|---|---|---|
| D1 部署与领域 | 一个 deployable 不合并 bounded context、owner、术语与不变量 | 模块布局与依赖方向检查 | 模块架构测试、owner focused test | 新服务形态 ADR、project-memory | W0-W2 |
| D2 原子写 | coordinator 归发起模块；跨模块写只调目标 `<module>.api` command；默认 `REQUIRED`，禁 `REQUIRES_NEW` | ArchUnit import/repository/transaction/coordinator 规则 | 任一步失败整体回滚真库测试 | ADR、backend owner standard | W2-W3 |
| D3 任务型读 | 页面读允许显式跨 schema join；归发起任务模块；禁 DML、锁与万能 DTO | SQL 结构检查 + query registry 对账 | 跨 workspace/revoked 负例、真 schema、`databaseOperationCount <= 3` | ADR、query/read-model standard | W2-W3 |
| D4 事件边界 | 单体业务主链显式 command；listener 只允许具名传输/遥测副通道，永不改业务状态 | ArchUnit event API 白名单 | 白名单正例与 application/domain 违规红夹具 | ADR、listener registry | W2 |
| D5 跨 schema FK | 强引用用 `(workspace_key,id)` immediate FK；禁跨 owner CASCADE/DEFERRABLE | migration SQL + `information_schema` + registry 对账 | 每 FK 跨 workspace 具名约束负例 | ADR、migration standard | W2-W3 |
| D6 依赖图 | 单 registry 三类边；command/schema 无环，read 可成环 | registry 与 imports/FK/query 三方现实对账 | 缺边、额外边、环与失效对象红夹具 | dependency registry、ADR | W0-W2 |
| D7 模块 API | 只公开窄 command/judgment；禁 `findAll/getById/exists` 与实体载荷 | API 类型依赖与命名/签名架构规则 | typed decision、跨模块判断 focused test | ADR、module API standard | W2-W3 |
| D8 授权上下文 | 事务内首批读解析一次 trusted `ExecutionContext`；owner 复查对象范围/状态/来源/revision | command 参数与裸授权 boolean 规则；action catalog 对账 | 撤权 revision、跨范围、独立/内部子 command 负例 | security ADR、admin catalog | W2-W3 |
| D9 单库 migration | 一个 deployable 一份 Flyway history；模块只 DDL 自己 schema，引用方 FK 例外 | UTC 毫秒版本、唯一/单调、DDL owner 检查 | 全量 Flyway + Testcontainers 从零迁移 | migration ADR/standard、HANDOFF runtime role | W1-W2 |
| D10 真实进程边界 | 不自研 gateway；初始无 MQ/outbox；TDP 暂不设计；搜索按证据阶梯激活 | 禁旧 deployable/MQ/outbox；边缘封闭路由与 listener 白名单 | 伪造头覆盖、直连拒绝；激活能力的专属验收 | 服务形态 ADR、触发 registry、HANDOFF | W0-W4 |
| D11 页面与生成面 | read model 按独立 surface；双 admin 独立；`x-consumer-faces` 是唯一暴露声明；wire 按 target 生成可达闭包 | face 三方对账、可达闭包、restricted imports、依赖图 | 双 app focused L2、codegen `--check`、业务动作 owner 判定 | contract standard、frontend architecture maps | W2-W3 |
| D12 工程底线 | `verify` 与动态证据分离；五 DEV 命令分权；start/restart 正常跑 Flyway 但不 seed；reset allowlist 覆盖数据库与开发资产；HANDOFF 轻量受约束 | `scripts/verify`、managed runner、L2 映射、handoff 三查 | verify、walking skeleton、受影响 L2/L3、逐项 reset readback report | scripts README、HANDOFF、运行 memory | W1-W4 |

## 3. 必须物理退役的旧资产

迁移不是兼容改造。目标能力迁完并取得 fresh evidence 后，以下资产必须删除或以明确 `NOT_APPLICABLE` 记录，不得保留双路径：

- 领域一对一微服务 deployable、独立数据库与内部同步 HTTP/OpenAPI client；
- 自研 Java/Spring gateway、服务发现/注册与仅为多服务扇出存在的配置；
- owner projection、proof/grant 复制、补偿读取、常态轮询与前端追平状态机；
- 单体内部业务 event bus、业务 listener、通用 outbox/MQ 框架；
- consumer graph、源码扫描推导 face、前端 allowlist、artifact reachability；
- 全量 generated endpoint/model 并集、跨 app generated import、共享 wire `importMappings`；
- 多套 Flyway history、模块独立数据库 bootstrap 与跨服务契约测试；
- 只验证旧架构通信、最终一致窗口、投影追平或分离授权维护页面的旧测试用例。

删除必须有零引用/注册/route/generated-symbol 断言、focused compile/test、business PASS 与 cleanup PASS；不得用 deprecated、alias、兼容 adapter、双读双写或静默 fallback 代替。

## 4. 明确暂不建设

- TDP：等待 Dexter 明确提出后重新设计；
- MQ、通用 outbox、search service、indexer worker：只有真实外部边界与实测证据触发；
- 搜索引擎：默认 PostgreSQL，激活须有 Journey/SLO 证据、watermark、owner 重读鉴权与全量重建演练；
- CI 平台、备份恢复、密钥轮换、health/readiness 端点、部署回滚、指标告警；
- 多 runtime DB role：当前以 ArchUnit/评审守住 owner 写权，未来 profile/连接池裁决后再升级数据库权限。

这些项目必须进入 HANDOFF 或 trigger registry；“暂不建设”不等于永久禁止，也不得因预想未来而预建框架。

服务形态复审的首个确定性 trigger 为：专职后端开发人数达到 `2` 人（AI 不计）。它只要求重开 ADR 评审，不自动授权拆服务、拆库、引入 MQ 或建立新部署单元。

## 5. 开工与完成条件

开工前必须同时满足：

- manifest 与新服务形态 ADR 冻结且 supersede 链完整；
- v2s project-memory 重播种完成；
- W1 skeleton、W2 机器门和 red fixtures 先绿；
- walking skeleton 真实通过；
- 当前迁移单元具有批准 Journey、模块 owner、contract、schema、测试与删除清单。

完成一个迁移单元必须同时满足：

- owner/transaction/security/wire/read-model 规则均由机器或真测试裁决；
- `verify`、walking skeleton 与确定性受影响 L2/L3 全部通过；
- business、cleanup、旧路径退出与 target hash 均为 fresh；
- HANDOFF 新增欠账具有完整字段和可判定 trigger；
- 没有以当前计划、单项 gate 或静态文件存在冒充业务完成。
