---
id: decisions.v2s-single-deployable-modular-monolith-service-shape
title: v2s 采用单业务部署单元、模块化领域边界与单库多 schema
type: decision
status: active
scope: future v2s repository architecture
owners: [product, platform]
createdAt: 2026-07-24
acceptedAt: 2026-07-24
acceptedBy: Dexter
implementationAuthority: false
reviewStatus: GO_RESOLVED
freezeStatus: W0_FROZEN_INPUT
reviewRef: doc/review/platform/2026-07-24-v2s-service-shape-claude-review.md
reviewResolutionRef: doc/review/platform/2026-07-24-v2s-service-shape-claude-review-resolution.md
programContext: AI_FIRST_FOUNDATION
sourceManifest: doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
sourceDiscussion: doc/plans/platform/2026-07-24-v2s-architecture-grilling-working-notes.md
actionPlan: doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md
---

# v2s 采用单业务部署单元、模块化领域边界与单库多 schema

## 1. 状态与授权边界

Claude 已于 2026-07-24 给出 `GO(0 M / 0 S / 3 N)`，三条 N 已全部关闭；Dexter 随后明确回复“接受并冻结该 ADR”。本 ADR 因而转为 `active`，并作为未来 v2s W0 的 `W0_FROZEN_INPUT`。

冻结只确认本 ADR 的服务形态、模块主权、事务、数据访问、边缘、生成面、证据与重判边界。它不修改 all-v2 当前运行时、Roadmap 状态、数据库、契约或测试，也不授权创建 v2s 仓库、迁移业务、删除 all-v2 资产、执行 Git 或生产操作。任何代码实施仍须在 v2s 新仓按其开工规则另行授权。

冻结后不得在实现中静默改写本裁决；任何实质变更必须形成新的 decision、说明触发事实并建立 supersede 链。

## 2. 背景与问题

v6 用 bounded context、source-fact owner、术语与不变量划分业务，同时明确领域边界不等于一领域一微服务、一领域一数据库。all-v2 实际形成七个业务服务、七个数据库、一个自研 gateway 以及多条 outbox → MQ → projection → repair 链。

这些机制分别解决了多进程、多数据库拓扑制造的问题：

- 跨 owner 原子写不能使用本地事务；
- 页面无法跨库 join，只能由 gateway、投影或前端扇出拼装；
- owner 引用必须通过 proof、异步 claim 或版本化投影传播；
- 每个服务拥有独立迁移、端口、健康、客户端、测试与 DEV 资源；
- 常态 outbox 轮询、MQ、repair 和前端追平逻辑成为基础成本。

上述实现本身可以严谨，但当前团队、部署与产品阶段没有证据证明这些进程和数据库边界值得长期承担。v2 尚未生产上线、没有需要在线搬迁的生产数据，业务语料、契约、Journey、测试教训和 owner 规则已经外化，因此现在是重新裁决部署边界而不是继续给错误拓扑补偿的最低风险窗口。

## 3. 决策

### 3.1 部署拓扑

v2s 初始拓扑固定为：

```text
browser
  -> standard infrastructure reverse proxy
  -> one stateless business application
  -> one PostgreSQL database with domain-owned schemas
```

- 边缘只使用标准基础设施反向代理，不自研 Java/Spring gateway deployable；
- 业务后端只有一个可横向复制的 deployable；
- `platform-admin` 与 `operations-admin` 保持两个独立前端 app；
- PostgreSQL 是初始唯一业务数据基础设施，一库多 schema；
- 初始依赖树不含 MQ、通用 outbox、Redis、搜索引擎、TDP 或 Spring Cloud；
- TDP 完全退出当前设计分母，只有 Dexter 未来明确提出后才重新设计。

### 3.2 领域与模块边界

单业务 app 只是部署形态，不是新的领域边界。v2s 继承 v6 已批准的 bounded context、source-fact owner、术语和不变量，并将它们实现为编译期和测试期可强制的模块边界。

- 后端按稳定 bounded context/owner 组织，不按 Scenario、Step、页面或 CRUD 实体分包；
- 每个模块拥有自己的 domain、application、repository、schema 写权限与业务不变量；
- 模块外只能依赖目标模块的窄 `<module>.api`；
- `<module>.api` 只公开 typed command、typed judgment、稳定业务 ID、必要闭集 enum 与 typed failure；
- 禁止公开 aggregate、domain entity、repository row、JDBC model、generated edge DTO、通用 `findAll/getById/exists`；
- 不建立全局编排模块、全局查询模块、service locator、动态 registry 或内部 OpenAPI/client。

### 3.3 跨模块原子写

事务可以跨模块，写权限不能跨 owner。

- 发起用户用例的模块 application coordinator 开启本地事务；
- coordinator 只能按依赖顺序调用目标模块公开 command；
- 目标模块 command 默认以 `REQUIRED` 加入现有事务；
- 生产 command 禁止 `REQUIRES_NEW`；任何未来例外必须由 Dexter 对精确用例裁决并登记；
- coordinator 零资产：无表、无 repository、无自身业务不变量；
- coordinator 或任何模块不得 import 其他模块 repository/domain，也不得跨 schema 直接 DML；
- 任一步失败，全部模块写入、各自审计与必要本地事实一起回滚；
- audit 由事实 owner 在同一事务直接写，禁止 listener 补写。

### 3.4 三条互斥协作通道

跨模块协作只允许以下三条通道：

| 任务 | 通道 | 允许 | 禁止 |
|---|---|---|---|
| 页面展示 | 发起任务模块的 task query/read model | 事务外显式跨 schema `SELECT/JOIN` | 逐模块 API 拼装、全局 BFF 查询模块 |
| 业务判断 | 目标 owner judgment API | typed 允许/拒绝、原因码、闭集结果 | 返回实体载荷、伪装 `getById` |
| 状态变更 | 目标 owner command API | 同事务 typed command/result | 跨 schema DML、listener 隐式写 |

写事务中的跨模块前置校验只走 judgment API，禁止在写事务内执行跨 schema join。页面读允许跨 schema join，但不得获得写主权、锁或业务规则解释权。

### 3.5 任务型读取

任务型 read model 以独立决策 surface 为粒度：

- 列表首次加载、详情、表单支持和有独立 loading/error/recovery 生命周期的区域分别定义 query/read model；
- read model 归发起用户任务模块的 query 包，使用 `<业务任务>View` 或 `<业务任务>FormSupport` 等业务命名；
- 禁止通用 `PageResponse<T>`、字段袋、万能候选 DTO、动态查询 DSL；
- SQL 只允许 `SELECT`，禁止 DML、`FOR UPDATE` 与 `SELECT *`；
- 必须显式包含 workspace、data-scope、revoked、状态等安全谓词；
- 每条组合查询至少有跨 workspace 不可见和 revoked 不可见两个真库负例；
- 默认每个 surface `databaseOperationCount <= 3`；
- detail 的动作可用性不得由 SQL `CASE` 复制 owner 规则，而由 owner 纯 judgment 函数基于可信上下文和已读判断事实返回。

### 3.6 授权与事务线性化

- 顶层 command 在事务内首批读中解析一次 immutable trusted `ExecutionContext`；
- context 携带服务端确认的 actor、consumer face、workspace/employment identity、page grants、data scope、capabilities、contextVersion、authorizationRevision、operation 与 correlation；
- 客户端不得提交或覆盖授权真相；
- 顶层用例检查 page/action/scope，目标 owner 基于同一 context 复查对象范围、状态、来源、revision 与不变量；
- 目标 owner 不在同一事务再次查询 IAM，避免一次命令内出现新旧授权快照撕裂；
- command 签名必须接收 `ExecutionContext`，禁止以裸 boolean 传递 `allowed/authorized/filtered`；
- 在事务入口授权已通过后发生的普通撤权不承诺取消在途事务；紧急停用若需更强语义，未来另行设计。

### 3.7 单库、多 schema 与完整性

- 每个 owner 模块只 DDL 自己的 schema；
- 一个 deployable 使用一份全局 Flyway history 和确定执行顺序；
- migration 文件可按模块目录组织，但由同一个 Flyway lifecycle 聚合执行；
- 版本使用 UTC 秒 + 毫秒，例如 `V20260724_153012_482__organization_add_region.sql`；
- 强一致、不可悬空引用使用 `(workspace_key, referenced_id)` 跨 schema 复合 FK；
- FK 由引用方 migration 创建，保持 immediate，禁止 `DEFERRABLE`；
- 禁止跨 owner `ON DELETE CASCADE` 与 `ON UPDATE CASCADE`；
- 引用方 FK 边必须预先登记且不得形成 schema dependency cycle；
- owner 删除/失效被引用事实时，通过公开 command 返回 typed conflict 或执行显式业务处置；
- 名称快照、历史结果、外部 ID 和允许暂时无法解析的引用不建 FK；
- 初始只使用一个 runtime DB role，跨 schema 写主权由 ArchUnit、模块可见性和评审强制；这是 HANDOFF 已知权限边界，不冒充数据库权限级隔离。

### 3.8 一份依赖登记、三类边

v2s 使用一个 dependency registry，以 `COMMAND`、`SCHEMA_FK`、`TASK_READ` 区分：

- command 边必须与真实 `<module>.api` imports 对账并保持 DAG；
- schema FK 边必须与 `information_schema` 对账并保持 DAG；
- task read 边以 `(queryId, initiatingModule, referencedSchemaObject)` 登记，与真实组合查询对账，允许成环；
- read 边不授予 command/import、事务传播、锁或 FK 权限；
- registry 与现实不一致时 `verify` 失败。

### 3.9 单体内部事件禁令

- 同一用户动作成功所必需的业务写入必须是显式 command 主链；
- application/domain 禁止 `ApplicationEventPublisher`、`@EventListener`、`@TransactionalEventListener`；
- 唯一白名单是具名 `AFTER_COMMIT` 传输/遥测副通道，例如未来真实外部投递的即时唤醒；
- listener 永不修改业务状态，audit 不走 listener；
- 初始不建内部 event bus、MQ、通用 outbox 或“为未来拆分”预留的消息框架；
- 真进程边界未来获批时，再在可 grep 的显式 command 边界替换为契约化消息。

### 3.10 边缘、安全面与 OpenAPI face

- 反向代理覆盖式写入 forwarded/correlation/parent 类头，并注入 `X-Edge-Auth`；
- app 首层 filter 强制校验边缘凭据，直连 app fail-closed；
- OpenAPI operation 的闭集 `x-consumer-faces` 是暴露面的唯一声明源；
- 同一元数据同时生成业务 app 内 route-face registry 和两个 admin 的 endpoint 切片；
- `verify` 对账 `OpenAPI metadata ≡ server route registry ≡ client generated slice`；
- consumer face 只定义暴露面，不授予 page/action/scope 权限；
- 服务端和每个 consumer target 只生成其 operation 可达的 wire type 闭包；
- `admin-ui-foundation` 保持 wire-agnostic，不得成为跨 app generated model 绕行通道。

### 3.11 真实进程边界与触发制

初始基线不预建未来系统：

- TDP：只有 Dexter 明确要求启动设计时进入分母；
- MQ：只有获批真实进程边界具有 durable delivery 需求时裁决；
- 外部搜索引擎：只有批准 Journey 需要 PG 不具备的能力，或优化后执行计划/压测证明 PG 无法满足 SLO 时裁决；
- indexer worker：只有吞吐、隔离或扩缩实测证据要求独立进程时提取；
- 支付/权益账本：未来因合规、风险和隔离要求重判；
- 域拆库：索引、读副本、租户分片仍无法解决真实瓶颈后才考虑。

trigger 必须是可判定事实，禁止“规模大了”“业务复杂了”。外部搜索引擎本身只是基础设施依赖，不自动产生 search-service、worker 或 MQ。

### 3.12 前端与工程证据

- 两个 admin app 独立拥有 Shell、menu、Content Tab、router、store、session/context、theme、page/read model、业务文案与 L2/L3；
- 只共享两个真实消费者已证明同构的机械 foundation；
- 形似但政策不同的能力必须登记 `INTENTIONAL_DIFFERENCE`；
- `scripts/verify` 分钟级、确定性退出，包含 contract/codegen check、lint、架构规则、编译/typecheck、单元测试、Testcontainers migration/integration 与 red fixtures；
- `verify` 不启动浏览器/持久 DEV，不读写开发库，不 seed；
- walking skeleton 与受影响 L2/L3 使用 run-scoped 动态环境，business 与 cleanup 分账；
- 每次变更的证据链为 `verify + walking skeleton + 确定性受影响 L2/L3`，不绑定执行者；
- `start/restart/stop/seed/reset` 五命令分权；start/restart 启动 app 时正常由 Flyway 应用尚未执行的 additive schema migration，被禁止的只是隐式数据 seed/数据语料迁移，不得误读为启动禁跑 Flyway；
- reset 是唯一破坏性入口，按显式 allowlist 清理开发数据库与 asset 模块登记的开发存储路径/对象桶，reset 后不自动 seed；执行前后逐项记录 readback 数量，任一未归零或未达预期即 FAIL；
- 当前不建第二套 health/readiness endpoint，受管启动复用 walking skeleton 的最薄真实入口断言。

## 4. 机器执法最低集合

ADR 激活后，第一行业务迁移代码前必须建立：

1. ArchUnit：跨模块 import、repository/domain 可见性、command transaction、coordinator 零资产、event/listener 白名单、API 类型边界；
2. dependency registry 对账：imports、`information_schema` FK、task query 三类现实边；
3. Flyway：全局 history、UTC 毫秒版本唯一/单调、模块 DDL owner、引用方 FK 例外；
4. Testcontainers：从零 migration、跨 workspace FK、安全谓词、rollback、CAS 与具名约束错误；
5. SQL/query：禁 DML/锁/`SELECT *`、显式列、DB 次数预算；
6. OpenAPI/codegen：`x-consumer-faces` 三方对账、target wire reachability、跨 app/foundation import 禁令；
7. runtime：边缘伪造头覆盖、直连 app 拒绝、walking skeleton；
8. retirement：旧服务、内部 client、投影、轮询、MQ/outbox、旧 generated 面与旧测试零引用/注册/route/symbol；
9. HANDOFF：deferred item 存在、七字段完整、稳定 ID 唯一。

任何只有文档声明、没有真实配置、标准脚本、red fixture 和完成证据关联的“机器门”，只能标为 future work，不能声称已强制。

## 5. 物理退役

v2s 迁移采用干净替换，不做兼容改造。目标能力有 replacement evidence 后，必须物理删除：

- 七业务服务 deployable、七独立数据库 bootstrap 与服务发现配置；
- 自研 gateway 及 owner 间内部 HTTP/OpenAPI client；
- 单体内部不再需要的 proof/grant、projection、repair、常态 polling、MQ/outbox；
- 前端为投影追平存在的 refetch、双读、固定等待与“稍后重试”状态机；
- consumer graph、前端 allowlist、全量 generated model/endpoint 并集和共享 wire `importMappings`；
- 多套 Flyway history 与只验证旧分布式拓扑的测试。

禁止 deprecated、alias、兼容 adapter、双读双写和静默 fallback。删除要有零引用/注册/route/generated-symbol、focused compile/test、business PASS 与 cleanup PASS。

## 6. 明确保留

以下能力不因单体化被删除：

- bounded context、source-fact owner、术语、不变量和 typed error；
- workspace_key、FORCE RLS、复合唯一/FK、CAS、幂等、审计和安全日志纪律；
- OpenAPI wire truth、标准生成、封闭安全面和 default-deny；
- 两段式上传本身，以及同事务 claim 后“提交返回即有效”；
- 邀请/找回多因子与分用途一次性 grant；
- 双 admin 的 actor、信息最小化、Shell/context 与业务任务差异；
- Testcontainers、Playwright、managed runtime、business/cleanup 和旧路径退出证据；
- v2 的 outbox/MQ/projection 等高质量实现只保留一份只读 Heritage 样板，未经 trigger 不进入 v2s 依赖树。

## 7. 被拒绝的替代方案

### A. 保持 all-v2 七服务七库

拒绝。当前没有生产隔离、独立扩缩、合规或团队自治证据支持其持续成本；页面 join、原子写和 DEV 运维反而被迫复杂化。

### B. 一个领域一个微服务、一个数据库

拒绝。领域是业务建模单位，不是部署单位；这会把语义边界机械转换成网络、事务和运维边界。

### C. 原地把 all-v2 合并为单体

拒绝。当前治理和证据大量绑定既有 topology/hash；在冻结资产上做架构手术比新仓按已外化真相重建更难审计，且更容易遗留兼容双路径。

### D. 一个 deployable 但保留七数据库

拒绝。它失去本地事务、跨 schema FK 和任务型 join 的主要收益，却保留多库 migration、连接、测试和数据同步成本。

### E. 一个数据库但所有模块直接互相读写

拒绝。单库只降低数据访问成本，不取消 owner 主权。写必须经过 command API；页面读 join 只拥有任务查询，不拥有事实解释和写权限。

### F. 为未来拆分预建 MQ/outbox/internal OpenAPI

拒绝。未来提取应从显式 command 边界演化；预建事件中介会隐藏当前业务主链并制造单体内伪最终一致。

### G. 建全局 query/BFF 模块

拒绝。任务型 query 归发起业务任务模块；全局查询模块会演变为无 owner 的数据上帝层。

## 8. 结果与代价

预期收益：

- 跨模块业务写可以保持 owner 主权并获得本地原子事务；
- 页面组合查询从跨服务/前端扇出收敛为显式、可预算的 SQL join；
- 跨 workspace 引用由数据库复合约束直接拒绝；
- DEV 从多服务、MQ、投影和 repair 收敛为更短反馈链；
- 真正需要提取的边界成为显式 command/query/registry 中可定位的有限集合。

接受的代价：

- 模块边界主要由代码结构、ArchUnit、review 与测试强制，不由进程/数据库账号天然隔离；
- 单 Flyway history 需要全局顺序和 migration owner 机器门；
- 任务型 read 允许依赖环，因此 schema 变更需要 registry + 真库测试定位影响；
- 一个 runtime DB role 暂时不能在权限层阻止跨 schema DML；
- deployable 变大，必须保持 module API、query budget、测试选择和旧路径退出纪律。

## 9. Supersede 与适用范围

本 ADR 获批后，只在 v2s 新仓 supersede 下列 all-v2 多服务拓扑规则；all-v2 当前仓仍保持原规则直到冻结退役：

| all-v2 当前规则 | v2s 替代 |
|---|---|
| 跨 owner 只走 generated client/facade | 跨模块写走 `<module>.api` command；页面读走 task join |
| 跨 owner 展示禁止 SQL join | 事务外任务型跨 schema join，带安全负例与预算 |
| 每 owner 本地事务 + outbox/MQ/projection | 单体必需协作进入同一本地事务；真外部边界才启用 delivery intent/outbox |
| 服务同步依赖 DAG | command 与 schema FK 保持 DAG；task read 边允许成环 |
| 每服务独立数据库/migration truth | 一库多 schema、一份 Flyway history、模块 DDL owner |
| gateway 扇出与服务间 proof | 标准反向代理 + app 内封闭安全面 + trusted ExecutionContext |
| 每服务 generated client/wire importMappings | 单 app server closure + 每 consumer face 可达 wire closure |

继承 v6 领域边界不等于“回到 v6 原方案”。本 ADR 是对部署、事务和数据访问边界的新 supersede 裁决。

## 10. 重判触发

只有发生可判定事实才重开本 ADR：

- 出现第二个真实外部 upstream 或必须独立部署的业务进程；
- 支付/权益账本进入批准范围并出现合规/风险隔离要求；
- PostgreSQL 优化后执行计划与压测仍无法满足批准 SLO；
- 单库租户分片、读副本与配额无法解决已测量争抢；
- 专职后端开发人数达到 `2` 人（AI 不计）；该事实只触发服务形态复审，不自动拆服务、拆库或引入 MQ；
- 安全审查要求 schema-scoped runtime credential；
- Dexter 明确要求开始 TDP 设计。

重判必须形成新 decision 和 supersede 链，不能在实现中静默加入服务、数据库、MQ、worker 或兼容路径。

## 11. HANDOFF 初始生产化欠账

v2s 建仓时 `HANDOFF.md` 初始登记：

1. CI 执行平台；
2. 备份/恢复；
3. 密钥轮换；
4. health/readiness 端点；
5. 部署回滚；
6. 指标/告警；
7. 单 runtime DB role 的权限边界。

每行必须包含稳定 ID、当前边界、延后理由、风险、可判定 trigger、未来验收证据与 decision source。关闭不得删行，只追加 `closedBy: doc/decisions/...`。

## 12. 评审与接受结论

- Claude 独立评审结论：`GO(0 M / 0 S / 3 N)`；
- 三条 N 已按 [findings resolution](../review/platform/2026-07-24-v2s-service-shape-claude-review-resolution.md) 全部关闭；
- Dexter 于 2026-07-24 明确接受并冻结本 ADR；
- 本 ADR 当前状态为 `active / W0_FROZEN_INPUT / implementationAuthority=false`；
- 八项架构核验结论以 [Claude review](../review/platform/2026-07-24-v2s-service-shape-claude-review.md) §4 为独立评审证据，不在本 ADR 复制第二份结论真相。
