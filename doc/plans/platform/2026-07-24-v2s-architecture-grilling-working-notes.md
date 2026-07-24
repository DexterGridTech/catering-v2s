---
title: v2s 架构 Grilling 临时讨论账
status: WORKING_NOTES
createdAt: 2026-07-24
updatedAt: 2026-07-24
implementationAuthority: false
sourceManifest: doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
---

# v2s 架构 Grilling 临时讨论账

## 0. 用途

本文只用于防止当前 Dexter、Claude、Codex 讨论因会话压缩或切换而丢失，不授权实施，也不替代最终 ADR、冻结 manifest 或开工行动计划。

讨论完成后必须把结论分别落入：

1. `2026-07-24-v2s-carryover-manifest-claude.md`：通用规则、禁令与继承/退役清单；
2. v2s 新服务形态 ADR：难以逆转的架构裁决、理由、替代方案和 supersede 关系；
3. v2s 开工行动计划：ArchUnit、migration、Testcontainers、红夹具、DB 往返预算与 `scripts/verify` 接线。

最终必须提供一份“决策 → 规则 → 机器门 → 测试 → 文档落点”闭环清单。

## 1. 问题总表

当前共 12 个根问题，已全部关闭。后续发现的新事实优先作为既有问题的子项处理；只有确属新的难以逆转边界时才新增根问题。

| # | 根问题 | 状态 |
|---|---|---|
| Q1 | 一个业务 app 是部署形态还是领域边界 | `CLOSED` |
| Q2 | 跨模块原子写的事务与写权限归属 | `CLOSED` |
| Q3 | 面向用户任务的跨 schema 组合查询 | `CLOSED` |
| Q4 | 单体内部领域事件、listener 与 outbox 的边界 | `CLOSED` |
| Q5 | 跨 owner schema 外键与数据库完整性 | `CLOSED` |
| Q6 | 模块依赖图是否区分写/FK DAG 与任务型只读依赖图 | `CLOSED` |
| Q7 | `<module>.api` 的公开面、typed command/result 与共享模型边界 | `CLOSED` |
| Q8 | 跨模块调用中的身份、授权、数据范围与 owner 复查责任 | `CLOSED` |
| Q9 | 单库多 schema 的 migration owner、执行顺序、数据库角色与测试基线 | `CLOSED` |
| Q10 | Gateway、TDP、搜索、MQ/outbox 等真实进程边界与激活条件 | `CLOSED` |
| Q11 | 页面任务 API、组合 read model、双后台与共享前端底座边界 | `CLOSED` |
| Q12 | v2s 阶段工程底线：技术栈、`verify`、运行入口、健康/CI/移交欠账 | `CLOSED` |

## 2. 已关闭裁决

### D1. 部署形态不改变领域边界

裁决：

- “一个业务 app”只是当前部署形态，不是新的领域边界；
- 继承 v6 的 bounded context、source-fact owner、术语与不变量；
- v2s 对部署、事务和数据访问边界作新的 supersede 裁决，不得称为“回到 v6 原方案”；
- 单体选择的依据是当前团队规模、事务需求、join 密集的查询形态与单服务器运维成本，不是“AI 让协调成本趋零”；
- AI 降低编码成本，但不消灭语义漂移、边界误用和审查成本。

已核对的 manifest 修订：

- 0.3 已改为“继承 v6 领域边界 + 新 supersede 裁决”；
- “AI 协调成本趋零”已删除；
- 当前分母保持 `30 Scenario / 124 active Step`；
- D.7、Part F 与开工清单均改为不携带 OpenViking/codegraph/provider，记忆和代码结构只走仓内原文、`rg`、compiler/LSP 与 focused build。

### D2. 跨模块原子写：事务可跨模块，写权限不可跨 owner

裁决：

- 发起用户用例的模块 application coordinator 拥有本次本地数据库事务；
- coordinator 只能调用目标模块公开的 `<module>.api` command；
- 每个模块独占自身 invariant、repository 与 schema 写权限；
- coordinator 不得直接引用其他模块 repository/domain，也不得用跨 schema SQL 修改其他模块表；
- 任一模块 command 失败，整个事务回滚。

执法细节：

1. 模块 command 默认加入现有事务，传播语义为 `REQUIRED`；生产代码默认禁止 `REQUIRES_NEW`。若未来确有独立提交需求，必须由 Dexter 对精确类/用例逐项裁决并登记；
2. coordinator 归发起用例的模块 application 层，不建全局编排层；coordinator 零资产、零表、零 repository、零自身业务不变量，只拥有调用顺序和失败语义；
3. ArchUnit 强制任何类不得 import 其他模块 repository/domain，只能 import `<module>.api`；repository 对模块外不可见；
4. audit 由各 owner 在同一事务中直接写入，不是 coordinator 的事实资产。

### D3. 任务型跨 schema 读：允许只读 join，不授予事实主权

裁决：

- 写侧必须经过 owner command；
- 面向具体用户任务的读侧可以直接跨 schema `SELECT/JOIN`，避免逐模块 API 调用造成进程内 N+1；
- 组合查询归发起用户任务的模块，不建全局“组合查询层”或 BFF 上帝模块；
- 返回页面专用 typed read model，不返回万能聚合 DTO，也不成为 source fact；
- 组合查询零表、零 migration、零 repository、零业务不变量。

禁令与执法：

1. 只允许 `SELECT`；禁止 DML、`FOR UPDATE` 和调用其他模块 repository；
2. 查询显式包含 workspace、data-scope、revoked、状态等安全谓词；
3. 每条组合查询至少有“跨 workspace 行不可见”和“revoked 行不可见”两个负例；不建立共享谓词 DSL；
4. 禁止 `SELECT *`，必须显式列出字段；
5. 集成测试运行于 Testcontainers + Flyway 真 schema；owner 删除或修改被引用列时必须立即失败；
6. owner schema 变更不得用长期兼容 view 静默遮蔽组合查询漂移；
7. 读端点默认 `databaseOperationCount <= 3`，预算断言阻断逐模块拼装复发。

已识别 supersede：

- all-v2 当前 `project-memory/decisions/backend-owner-implementation-standard.md` 在多服务拓扑下规定“跨 owner 展示禁止跨域 SQL join”；该条不能原样播种到 v2s，必须由本裁决替代。

### D4. 单体内部必需协作不走事件

裁决：

- 同一用户动作中，成功结果必需的跨模块写入必须由 coordinator 显式调用目标模块 command，并加入同一事务；
- 不得通过同步/异步 event listener 隐藏业务主链；
- 不为未来可能拆服务预建内部 event bus；
- 不用本地异步 listener 制造单体内最终一致性；
- 模块不得通过订阅事件建立未登记依赖；
- outbox 不用于单体内部模块同步。

唯一合法 listener 白名单：

- 真进程边界的 outbox publisher 可由具名 `@TransactionalEventListener(AFTER_COMMIT)` 唤醒；
- listener 只允许触发传输或遥测副通道，例如 outbox 唤醒与日志刷写；
- listener 永不修改业务状态；
- audit 必须由 owner 在原事务中直接写，不得由 listener 补写；
- `ApplicationEventPublisher`、`@EventListener`、`@TransactionalEventListener` 只允许出现在具名白名单传输类中；模块 application/domain 层零出现，由 ArchUnit 在 `verify` 中拒绝。

未来模块真正提取为独立进程时，才把当前可 grep 的显式 command 边改造成契约化消息边界。

### D5. 跨 schema FK：保护强引用完整性，不产生跨 owner 写权

裁决：

- 一库多 schema 允许建立跨 owner schema FK，但只用于同步、强一致、不可悬空的业务引用；
- 跨 schema FK 只表达引用完整性，不允许引用方修改被引用 owner 的事实；
- 必须使用 `(workspace_key, referenced_id)` 复合外键，数据库直接拒绝跨 workspace 引用；
- 禁止跨 owner `ON DELETE CASCADE` 与 `ON UPDATE CASCADE`；
- FK 由引用方模块 migration 创建，被引用方先提供稳定唯一键；
- owner 删除/失效被引用事实时，必须通过公开 command 返回 typed conflict 或执行显式业务处置；
- 具名约束冲突映射为 typed application/domain error，禁止暴露数据库自然语言；
- 名称快照、历史结果、外部系统标识和允许暂时无法解析的引用不建立 FK。

执法细节：

1. 跨 schema FK 边必须是已登记模块依赖 DAG 的子集，且不得引入新边或环；`verify` 脚本对比 `information_schema` 的跨 schema FK 与模块依赖登记；
2. 跨 schema FK 必须保持 immediate，禁止 `DEFERRABLE`；coordinator 按依赖序调用，不能用延迟约束遮蔽顺序错误；
3. 每条跨 schema FK 继承 H12 红夹具义务：至少有一个跨 workspace 引用被具名复合约束拒绝的真库负例；
4. 真正提取为独立进程时，再以迁移与契约替换该 FK，不为未发生的拆分牺牲当前完整性。

### D6. 一份模块依赖登记，三类边分别判定

裁决：

- command/API 写协作依赖必须有向无环；
- 跨 schema FK/migration 依赖必须登记、不得成环，且不得形成 command/import 之外的隐性写权限；
- 面向具体用户任务的跨 schema 只读依赖必须登记，但允许成环；
- read 边不授予 command/import 权限，不传播写事务，不允许锁，也不得反向生成 FK；
- 不得为了让只读关系无环而复活 projection、逐模块 API 拼装或全局查询模块。

执法细节：

1. 三类边放在同一个 registry 文件中，以 `edgeKind` 区分，不建立三个会漂移的登记文件；
2. registry 必须与现实机器对账：
   - command 边与 ArchUnit 可见的 `<module>.api` import 集对账；
   - schema 边与 `information_schema` 的跨 schema FK 清单对账；
   - read 边与实际存在的任务型组合查询清单对账；
3. command 与 schema 两类边执行无环断言；read 边只执行覆盖与目标存在性比对；
4. read 边的对账键为 `(task/query id, initiating module, referenced schema object)`，用于 owner schema 变更影响检索；
5. 某模块 read 边横扫大半 schema 属于评审气味，通常提示页面任务错位或缺少合理 owner 摘要 API；当前只做人工评审观察，不建立硬阈值。

### D7. `<module>.api` 只承载窄业务协作

裁决：

- `<module>.api` 只承载真实跨模块业务协作，不镜像模块全部 application 能力；
- 同模块 web adapter 直接调用本模块 application use case；只有跨模块调用才经过 `<module>.api`；
- 主要公开跨模块 command，以及必须由目标 owner 解释的业务判断；
- 页面列表、详情、候选与展示组合走 D3 的任务型只读 join，不调用一串 module API 拼装；
- 禁止 `findAll`、通用 `getById`、通用 `exists` 等数据访问式 API；
- 只公开 immutable typed command/result、稳定业务 ID、必要闭集 enum 与 typed failure；
- 禁止公开 aggregate、domain entity、repository row、JDBC model 和 generated edge wire DTO；
- `<module>.api` 是进程内 Java 边界，不生成 internal OpenAPI/client，不建立 service locator、反射 registry 或动态调用层。

三条通道必须互斥：

1. 页面展示读：事务外任务型跨 schema `SELECT/JOIN`；
2. 业务判断：目标 owner 的 judgment API；
3. 状态变更：目标 owner 的 command API。

补充执法与气味：

- 写事务中的跨模块前置校验只能调用目标 owner judgment API，禁止在写事务中执行跨 schema join；
- judgment 返回 typed decision，例如允许/拒绝、原因码或闭集结果，不返回实体载荷；
- 返回 `id + 全字段 record` 的所谓 judgment 是伪装的 `getById`，属于评审气味；
- ArchUnit 断言 `<module>.api` 类型不得依赖 domain entity、repository row 或 adapter/JDBC 类型。

### D8. 顶层事务只解析一次授权上下文，owner 各自复查

裁决：

- 顶层 command 事务开始后，服务端从 session/IAM 真相解析一次 immutable trusted `ExecutionContext`；
- context 至少携带 server-confirmed actor/principal、consumer face、workspace/employment identity、page grants、data scope、action capabilities、contextVersion、authorizationRevision、operation 与 correlation；
- 客户端不得提交或覆盖 principal、scope、grant、capability、revision 真相或 `authorized=true`；
- context 显式传入 application/coordinator/module API，不把隐藏 ThreadLocal 当作 application/domain 的授权真相；
- 发起用户用例检查 generated operation 对应的 page grant、action capability 与顶层 data scope，三者独立判断、不互相推导；
- 目标 owner 不重复查询 IAM，但必须基于同一 context 复查目标对象数据范围，并在自身事务写条件中复查对象状态、来源、revision 与领域不变量；
- 内部子 command 不制造虚假 capability；若只是已授权用户动作的必需步骤，则继承 operation context；
- 目标 command 若本身也是可独立调用的用户动作，则检查自己的 page/action 映射，不继承其他动作授权；
- audit 记录服务端确认的 actor、workspace、operation 与 correlation，不记录客户端自报授权信息。

线性化语义：

- `ExecutionContext` 的解析必须发生在命令事务内部，并作为事务首批读；
- 授权判断以该事务入口为线性化点；
- 撤权若已在该点前提交，旧 revision 必须 fail-closed；
- 已完成授权判断的在途事务默认允许完成；普通 revision 比较不得冒充“取消在途事务”；
- 紧急停用若未来要求取消在途操作，另行设计会话撤销与更强锁定语义，不预建。

执法细节：

1. 目标 module command 参数必须包含安全 kernel 唯一定义的 `ExecutionContext`；
2. module API command 禁止出现 `allowed`、`filtered`、`authorized` 等裸 boolean 授权语义，由类型/ArchUnit 规则拒绝；
3. 子 command 是否是独立用户动作以 admin-catalog action 目录为机器判据：目录存在即独立自查，不存在即内部协作继承；
4. 同一顶层事务内不得再次查询 IAM 形成第二份授权快照，防止 READ COMMITTED 下同一命令出现新旧授权撕裂。

### D9. 一个 deployable 使用一份全局 Flyway history

裁决：

- 一个 deployable、一个 database、多 schema 使用一份全局 Flyway schema history 和一条确定性全局 migration 顺序；
- 多套 history 会虚构实际不存在的进程与部署生命周期边界，因此不得按模块各跑一套 migration engine；
- migration 文件仍归各模块目录与 owner；目录表达 DDL 主权，不表达独立部署单元；
- 模块 migration 只能 DDL 自己的 schema；唯一跨 schema 例外是引用方在自己的表上声明 `REFERENCES` 目标 owner 的稳定唯一键；
- 引用方不得 `ALTER` 被引用 owner 的表；
- runtime SQL 必须 schema-qualified，禁止通过 `search_path` 隐藏对象归属或依赖；
- 只设 migration role 与 runtime role：migration role 持有 DDL，runtime role 不持有 DDL；当前不为每个模块建立独立 datasource、pool 或数据库用户；
- 新建 v2s 数据库允许建立 V1 baseline；V1 之后只允许追加 migration，不得修改已应用历史。

版本与顺序：

1. 使用 UTC 秒+毫秒版本避免单个开发 agent 在一次批量脚手架中连续生成多个 migration 时碰撞，例如 `V20260724_153012_482__<module_key>_xxx.sql`；当前“一开发、一评审”模式下不把多作者并行当作主要碰撞源；
2. 版本号由准备物脚本生成；`verify` 必须分别拒绝重复版本、非 UTC 秒+毫秒格式和非单调版本，并检查文件名包含合法 module key；
3. schema/稳定唯一键创建先于引用方 FK；顺序必须与 D5/D6 的 schema dependency DAG 一致；
4. FK 保持 immediate，不用 `DEFERRABLE` 掩盖 migration 或 coordinator 顺序错误。

机器执法：

1. 按 module migration 目录解析 SQL，断言所有 DDL 对象属于本模块 schema；
2. 唯一允许的跨 schema 语法是“`ALTER TABLE` 本模块表 ... `REFERENCES` 其他 schema”，并与跨 schema FK registry 对账；
3. `verify` 覆盖 empty-DB clean migrate、Flyway validate/历史 hash 不可变、全局版本唯一与单调、module-owned DDL、跨 schema FK registry、RLS/cross-workspace 红夹具；
4. 每条跨 schema FK 继续承担 D5 的具名约束、禁止 CASCADE、immediate 与跨 workspace 真库负例义务。

显式 supersede 与已知边界：

- 本裁决显式 supersede `doc/review/platform/2026-07-19-systemic-delivery-retrospective.json` 的 `SDR-03` 中“owner 的迁移历史与连接 search path 独立可裁判”部分；SDR-03 是多服务拓扑下各 deployable 独立生命周期的产物；
- SDR-03 所保护的 schema owner 主权仍保留，但在 v2s 中由模块目录、schema-qualified SQL、DDL ownership verify、ArchUnit 与真库测试执法，不再由多套 history/search path 表达；
- 一个 runtime database role 意味着“禁止跨 schema 直写”当前是代码级而非数据库权限级保证；在当前“一开发、一评审”协作规模下该强度充分，但仍必须如实登记为已知边界，不得冒充权限隔离；
- 若未来 ADR 批准按 profile/模块拆连接池，可再以 schema-scoped credential 将写主权升级为数据库权限级；这里只登记 HANDOFF/ADR 演进点，不作为当前工作。

### D10.1. 边缘采用标准基础设施反向代理，不自研 Gateway 应用

裁决：

- 当前不建立自研 Java/Spring Gateway deployable；
- v2s 拓扑的准确表述是“边缘 = 标准基础设施反向代理 + 业务 app”，不是“gateway app + 业务 app”；
- 反向代理只承担 TLS、请求大小限制、粗粒度 IP 限流、静态转发、受信头覆盖与边缘凭据注入，不持有业务形状；
- 业务 app 负责 session/IAM、账号级限流、generated operation/page/action 映射、Q8 `ExecutionContext` 解析和全部真实授权；
- TDP 将来成为第二条 upstream 也不自动触发自研 programmable gateway；只有多个真实 upstream 同时出现独立发布、安全策略、凭据或生命周期需求时，才重新裁决。

四个锁定条件：

1. **私网可达必须 fail-closed**：监听地址、防火墙或容器网络限制之外，标准代理必须注入边缘共享凭据头（例如 `X-Edge-Auth`），业务 app 首层 filter 强制校验；缺失或错误凭据的直连请求一律拒绝。密钥由部署 secret 注入，不得进入仓库、生成配置、日志、trace 或错误响应；比较使用常量时间语义；
2. **伪造头覆盖式处理**：代理对 forwarded、correlation、parent/internal context 类头先移除再覆盖写入，禁止 append；业务 app 只信任通过边缘凭据校验的代理链。Walking skeleton 必须端到端证明外部伪造内部头未进入 app trusted context；
3. **封闭路由面迁入业务 app**：v2 的 generated route face classifier + 多条 `SecurityFilterChain` + final `denyAll` 样板迁入业务 app，不随自研 gateway 退役；代理不成为第二份 route/authorization catalog；
4. **DEV/生产同构入口**：代理配置模板入仓，DEV 与生产消费同一份路由和 header 策略，差异只由部署参数/secret 注入；DEV start、L2/L3 与 walking skeleton 全部经过代理，禁止前端或测试直连业务 app。

安全边界说明：

- 边缘共享凭据是私网/绑定配置之外的第二层 fail-closed 防线，不替代网络隔离；
- 当前单服务器/私网 hop 可使用共享凭据；若未来代理与 app 跨不可信网络或独立节点部署，必须重新裁决 mTLS/工作负载身份，不把静态 header secret 无限外推。

### D10.2. 初始基线不带 MQ，也不预建 outbox

裁决：

- v2s 初始依赖树、DEV、生产与 `verify` 均不包含 RocketMQ；
- 单体模块协作只走显式 command + 同一事务，不得写 outbox、发 MQ 或建立内部投影；
- 不预建通用 outbox 表、publisher、repair worker、消息 abstraction 或 broker 配置；
- v2 的 organization→IAM `outbox→MQ→projection→repair` 只保留在冻结 v2 中作为将来真实进程边界的阅读样板，不进入 v2s baseline；
- 删除 MQ 后，DEV 不再启动 broker、不建隧道、不重置 topic/consumer-group/retry/DLQ，也不承担对应 readiness/cleanup。

真实边界触发：

- Dexter 重启 TDP 设计并批准其进程边界、或以实测证据批准提取 indexer worker 等异步业务进程时，才逐边界裁决 MQ client、owner outbox、版本化事件、幂等 consumer、提交后即时 publisher 与 recovery poll；单纯接入外部搜索引擎不自动引入 MQ；
- MQ 只传通知，不是真相；owner database/outbox 才是 durable truth；
- recovery poll 只补偿 broker 失败、执行器饱和、进程崩溃或租约过期，不得成为正常新写入 dispatcher。

窄外部投递意图：

1. SMS、对象存储清理等外部副作用若经具体 Journey 裁决必须在进程崩溃后继续完成，允许 owner 建立逐用例窄表，例如 `sms_delivery_intent`；
2. 禁止命名为 `outbox`，禁止建立通用 delivery/outbox framework；即使出现第二个用例，也先保留两张窄表，任何合并必须由 Dexter 重新裁决；
3. 正常路径在原事实事务提交后，走 D4 唯一 `AFTER_COMMIT` 传输副通道白名单立即投递；失败补扫属于 maintenance job；
4. 每个 Journey 必须明确记录 at-least-once 语义及崩溃窗口：provider 已成功但 intent 尚未标记时是否允许重发，或是否使用 provider idempotency key；不得把重复副作用当作沉默默认；
5. 窄 intent 不允许反向成为模块间协作、授权传播、页面可见性或成功 readback 的消息总线。

### D10.3. TDP 完全退出当前分母，等待 Dexter 显式重启设计

裁决：

- TDP 不属于 v2s 初始基线，也不因商品目录、销售集合、发布域或终端相关模块出现而自动进入设计或建设；
- 当前不建立空 TDP app、module、schema、database、topic、contract、MQ 配置、运维页面或未来抽取适配层；
- 只有 Dexter 明确提出“开始设计/建设 TDP”后，才以届时批准的真实终端 Journey 为输入另开设计讨论；此前不得以 manifest 的中期路线或 v6 历史方案自行激活；
- 当前业务 app 不得假设终端在线、等待终端投递/ACK，亦不得为了未来 TDP 预建异步发布链。

未来重新讨论时的冻结输入：

1. TDP 的候选定位是终端数据平面，不是普通发布服务；激活至少要求真实终端消费者、主动推送/一对多扇出、弱网断线恢复、cursor/full snapshot/rebase/TTL/ACK 等 HTTP 无法诚实满足的 Journey；
2. 业务 owner 继续拥有业务源事实、payload 语义、topic manifest、具体投递范围、TTL、版本和 publish/delete/tombstone intent；
3. 终端控制 owner 继续拥有终端身份、激活、绑定、凭证、profile、capability、稳定终端组和设备配置，不因 TDP 提取而自动迁移；
4. TDP 若获准独立，只拥有 ingress 幂等、projection envelope、topic cursor、session/subscription、可见性过滤、投递、full snapshot/rebase、ACK、TTL 执行和数据面诊断；
5. TDP 必须被动接收，不查询、轮询或 join owner 表，不组装或解释业务 payload，不审批订阅；delivered/ACK 不得解释为终端业务包、本地 read model、UI、硬件或源业务成功；
6. TDP 不承载业务源事实、projection 可重发/rebase，但 ingress 幂等、cursor、投递、ACK 与运维诊断是其自身持久数据面事实；因此它是低业务耦合候选拆分点，不是“数据全可重建”的零代价拆分；
7. 真正激活时再同期裁决独立数据库、owner outbox、MQ 通知、幂等消费和恢复机制，当前一项也不预建。

### D10.4. 搜索是基础设施能力阶梯，不预设独立 search-service

裁决：

- PostgreSQL 是默认搜索承载：显式 B-tree/GIN/trigram/FTS、受控分页与排序，必要时使用读副本；
- 不因“第二期”、数据量猜测、多个模块需要搜索或技术偏好而引入 Elasticsearch/OpenSearch；
- 只有批准 Journey 需要相关性排序、容错纠错、同义词、多字段全文检索等 PG 不具备或不适合的能力，或优化后的 PG 经真实执行计划与压测仍无法满足已批准 SLO，才允许 Dexter 裁决激活外部搜索引擎；
- 搜索引擎与 PostgreSQL 同属外部基础设施依赖，不构成我方新 deployable，也不自动产生 `search-service`、indexer worker 或 MQ；
- 初始激活形态由发起用户任务的业务模块拥有 search adapter 与页面查询语义，不建立全局业务搜索 owner；
- 只有索引吞吐、资源隔离、独立扩缩容或故障生命周期有实测证据，才允许另行裁决提取无业务语义的 indexer worker；worker 永不拥有业务规则或详情真相。

数据与安全：

1. 索引文档必须携带 workspace、scope、visibility、sourceRef、watermark，不得保存 secret、raw payload、完整账单或未经批准的敏感原文；
2. 搜索结果只提供安全摘要、引用和水位；详情与任何业务动作必须回 owner 重读、重鉴权并复查状态、来源和业务不变量；
3. 事务性列表、读后立即修改与授权敏感查询永留 PostgreSQL，不接受搜索索引的最终一致性；
4. 搜索命中不等于对象存在、当前可见或可操作。

可靠更新与可重建：

1. 需要可靠索引更新时才建立 owner outbox；
2. 提交后即时索引属于 Q4 唯一 `AFTER_COMMIT` 传输副通道白名单；recovery job 只补外部引擎失败、执行器饱和或进程崩溃，不做常态 dispatcher；
3. 此形态不自动引入 MQ；只有 indexer worker 提取等真实进程边界另有证据时再裁决；
4. 搜索引擎激活首日必须提供“从 PostgreSQL owner facts 全量重建索引”的受管命令，并至少完成一次真实演练；缺命令或演练证据时，不得声称索引可丢弃、可重建或激活完成。

用户可见一致性语义：

- 搜索结果滞后是搜索 surface 的契约语义，不是前端补偿对象；
- 返回值携带 watermark，UI 可按批准业务语言标注“结果截至…”；
- 前端不得用轮询、双读、自动刷新、固定等待或“稍后再试”状态机猜测索引追平；
- 用户打开详情或执行动作时，由 owner 返回当前权威事实并重新鉴权；
- 该例外只属于获批搜索 surface，不能泛化为普通列表、详情、候选或单体内查询的最终一致。

## 3. 全部根问题已关闭

待裁决的核心歧义：

- 无。

Q10 已按 D10.1-D10.4 关闭，Q11 已按 D11.1-D11.4 关闭，Q12 已按 D12.1-D12.3 关闭。后续工作只允许把这些裁决派生为 ADR、项目记忆、机器门、测试与开工行动，不得在实现阶段重新默默改写。

### D11.1. 任务型 read model 以独立决策 surface 为粒度

裁决：

- “按用户任务提供组合查询”不等于“一整个页面一个 mega API”；
- 列表首次加载、详情、表单支持，以及拥有独立 loading/error/recovery 生命周期的页面内 Tab、矩阵或统计区域，分别构成独立决策 surface；
- 每个 surface 拥有一个 task query/read model；内部允许一条或少量有预算的显式跨 schema SQL；
- 不因多个区域同处一个 React 页面而合成万能 DTO，也不因数据来自多个模块而拆成多个前端 owner 请求；
- read model 归发起任务模块的 query 包，正向命名使用 `<业务任务>View`、`<业务任务>FormSupport`；
- 禁止按数据库实体、Scenario/Step、React 组件或路由名命名，禁止通用 `PageResponse<T>`、字段袋、万能候选 DTO 和动态查询 DSL；
- read model 只服务读取，不进入 command 参数或跨模块协作 API；
- list/detail/form-support 可以复用稳定小值类型，但不得为了 DTO 复用强行合并 surface；
- 两个后台即使读取同一 owner，也可因 actor、信息层级与任务不同拥有不同 read model，禁止为了共享 API 扩大字段暴露。

动作可用性焊点：

1. detail read model 中的可执行动作不得由组合 SQL 的 `CASE`、状态谓词或来源谓词推导；
2. 组合 SQL 只允许 workspace、revoked、scope 等安全过滤谓词；
3. 动作可用性属于 owner 判断：装配 detail 时调用目标 owner `<module>.api` 的纯判断函数，输入可信 `ExecutionContext` 与本次 query 已读出的 owner-defined 判断事实，输出 typed action availability/reason；
4. 该判断是进程内纯函数，零额外 DB/HTTP 往返；查询层不得复制 `grant ∩ 对象状态/来源` 规则；
5. command 执行时 owner 仍必须在事务内重查对象状态、来源、revision 与业务不变量，read-side 判断不构成授权凭证。

预算统一：

- B.6.6 的读 `databaseOperationCount <= 3` 以独立决策 surface/task endpoint 为计量单位；
- 列表、详情、表单支持与延迟加载区分别计量；
- 不得把整个页面强压成一个预算，也不得拆分同一 surface 来绕过预算；
- owner 纯动作判定不增加数据库次数。

### D11.2. 双后台保持独立 app，只共享已证明同构的机械 foundation

裁决：

- `platform-admin` 与 `operations-admin` 保持两个独立前端 app；
- 允许共同消费同一 OpenAPI wire/operation metadata 真相，但 generated endpoint/type 仍按 face 进入各 app 自身切片；runtime 只共享不含业务语义的 transport primitive，以及两个真实生产消费者已证明不变量、生命周期、失败语义和演进原因同构的 Drawer lifecycle、提交反馈、Problem 展示、accessibility、locator、受控 layout primitive；
- Shell、menu、Content Tab、router registry、session、身份、workspace/employment/data-scope context、Redux store、base API 实例、context invalidation、theme、产品标题、page/read model/form workflow、page grant/capability/action mapping、业务文案与 L2/L3 必须 app-owned；
- 默认禁止跨 app 共享业务 Page/feature、`shared/pages`、`shared/features`、万能实体组件，以及为了复用表格强迫不同 actor 消费同一 read model；
- foundation 不得读取或依赖任一 app 的 store、router、theme、catalog、session/context 或业务类型；
- 不允许“先放共享目录，等未来第二个消费者”。

差异同样需要证据：

1. 两 app 各自实现形似能力时，必须在各自 Frontend Architecture Map 或相邻 ownership 文档中以一行 `INTENTIONAL_DIFFERENCE: <与另一端不同的政策原因>` 记录为何不同；
2. 差异登记不自动证明设计正确，但缺少差异说明的形似重复不得通过架构评审；
3. Content Tab 是已知正例：operations 身份切换关闭旧业务 Tab，platform 空间切换只失效相关 Tab 的旧读数据；这是政策差异，不是待消除重复。

机器执法：

- ESLint `no-restricted-imports`：foundation package 禁止 import `apps/*` 和所有 app-owned 类型；
- package 依赖图只允许 `apps -> foundation/generated`，禁止 `foundation/generated -> apps`；
- 禁止通过类型重导出、动态 import、callback service locator 或测试夹具绕过依赖方向；
- 两条断言进入 `verify`。

历史证据校正：

- Claude P2-4 指出两个 app 各注入一份内容几乎相同的全量 generated endpoint，导致 bundle 与类型面成为并集；
- Codex 独立裁决核实当时实际为每 app `105` 个 endpoint，不是 `106`；
- P2-4 为 `PARTIALLY_CONFIRMED`：罪证证明需要重新裁决 generated 注入面，但不能仅因文件大或 endpoint 数量多就修改 wire；拆分必须由真实 bundle、类型生成耗时和 app 消费集合证据决定。

### D11.3. `x-consumer-faces` 是 operation 暴露面的唯一声明源

裁决：

- consumer face 必须直接声明在 edge OpenAPI operation 的闭集元数据 `x-consumer-faces` 上；
- 不建立 frontend allowlist、consumer graph、运行时 filter 或从当前源码 import/调用反推 face；
- 每个 operation 必须声明至少一个批准 face，例如 `PLATFORM_ADMIN / OPERATIONS_ADMIN / PUBLIC`；multi-face 合法；
- codegen 按 face 静态生成每个 app 的 endpoint 切片，每个 app 只注入自己获准消费的 endpoint；
- generated 输出位于各 app 内并注入 app-owned baseApi，禁止两个 app 共用 RTK Query API 实例；
- generated 层只拥有 method、path、typed arg/result、wire enum 与 hooks；session、context、correlation、Problem、tag/invalidation、navigation、feedback 和 cache lifecycle 均 app-owned；
- shared operation 在两个切片中出现少量机械 generated 重复是允许的，不能为了去重上提 app policy 或业务所有权。

一次声明，两处执法：

1. `x-consumer-faces` 同时生成业务 app 内的 closed route-face registry，驱动多条 `SecurityFilterChain` 与 final denyAll；
2. 同一元数据生成 `platform-admin`、`operations-admin` 的 endpoint 切片；
3. `verify` 做三方精确对账：`OpenAPI face metadata ≡ server face registry ≡ each app generated slice`；
4. 缺失/未知 face、手写 allowlist、额外 endpoint、漏生成 endpoint 或服务端 route face 分叉一律失败；
5. codegen `--check` 证明切片字节可重复生成。

谱系与安全边界：

- 本裁决显式继承 A5 禁令：从源码 import/使用扫描反推消费者，就是被永久禁止的 consumer graph 复活；
- 数据流方向只能是 `contract declaration -> server/client enforcement`，禁止 `implementation scan -> inferred contract`；
- consumer face 是 wire 暴露面，不是授权；multi-face 不改变 Q8 的 session/page/action/scope、对象状态/来源与 owner command 复查；
- endpoint 数量、codegen/类型检查耗时与 bundle 变化只作为工程证据，不反向修改 operation 的 wire face 真相。

### D11.4. generated wire type 随 target 生成 operation 可达闭包

裁决：

- OpenAPI components schema 保持唯一 wire 真相；
- 服务端、`platform-admin`、`operations-admin` 各自只生成其获准 operation 引用可达的 arg/result/model/enum 闭包；
- 同一 schema 在多个 target 中机械重复生成不是所有权重复，不以去重为由建立全局 generated model 包；
- app 只从自身 generated public entry 导入，禁止跨 app import generated 目录；
- 禁止全局 `export *` barrel 把完整 schema 并集暴露给所有 consumer；
- 禁止手写复制 wire DTO/enum；该拒绝项并入 D.2 的业务字面量/contract-owned symbol 执法面。

`verify` 必须拒绝：

1. consumer 切片包含从其 operation 集不可达的 schema；
2. 两个 app 交叉 import generated 目录；
3. 全局 generated barrel 或 generated model 共享包；
4. 手写复制 wire enum/DTO；
5. 通过 foundation 间接把另一 face 的模型面带入当前 app。

foundation 焊点：

- `admin-ui-foundation` 保持 wire-agnostic，既不 import platform generated 切片，也不 import operations generated 切片；
- foundation 只持有自己的中立机械类型，例如 `RequestFailure`；
- ESLint `no-restricted-imports` 与 package 依赖图同时阻断 `foundation -> apps/generated`、app 间 generated 交叉 import、以及经 foundation 类型重导出的绕行路径。

Part C 样板重判：

- 原“共享 wire `importMappings` + bundle 增量”必须拆开；
- 跨服务共享 wire-model 的 `importMappings` 半条随多服务拓扑退役，v2s 不适用；
- bundle 声明式 inputs/outputs 增量半条继续作为 generator 增量构建样板；
- 服务端单 app 生成自己的 operation 可达 wire type 闭包，不建立共享 Java wire-model 库。

### D12.1. `verify` 与受管动态证据是两条不可互替的证据链

`scripts/verify`：

- 确定性、一次性退出、分钟级完成；
- 包含 contract/generator `--check`、lint、架构规则、编译/typecheck、单元测试、Testcontainers 真库 migration/integration、门的 red fixture；
- 不启动浏览器、标准反向代理或持久 DEV 环境；
- 不读取或写入开发数据库，不 seed；
- 可以与正在运行的 DEV 环境并行执行，互不干扰。

受管动态证据：

- walking skeleton 与受影响 Journey L2/L3 使用 run-scoped manifest 启动标准反向代理、业务 app、双前端与临时资源；
- business 与 cleanup 分账；
- `verify PASS` 不能冒充 UI/业务 PASS，动态证据 PASS 不能覆盖静态、架构或真库门失败；
- `dev start`、`seed`、`verify` 三命令严格分离，启动或重启 DEV 永不隐式 seed。

执行者消歧：

- “每次变更必须通过 `verify + walking skeleton + 受影响 L2`”定义证据链，不绑定执行者；
- 当前执行者是 Codex 完成前自跑、Claude 评审时重跑；
- H.2 仍成立：本阶段不建设 CI 平台；
- 移交后由真 CI 执行是 `HANDOFF.md` 欠账，不预建平台来冒充当前需要。

受影响 L2 的确定性映射：

- 改动触及的模块 → traceability registry 中该模块 owned 的 L2 spec 集；
- walking skeleton 恒跑；
- 横切/foundation 或无法确定唯一归属的变更 → 全量 L2；
- 映射及实际选择由机器复算，禁止实现者临场挑选、按页面存在性猜测或手写跳过；
- 宁可确定性多跑，不得把自由裁量变成绕过点。

### D12.2. DEV 五命令分权，reset 是唯一破坏性入口

运行命令：

1. `scripts/dev/start`
   - 启动标准反向代理、业务 app、双前端和 PostgreSQL；
   - Spring app 启动时正常由 Flyway 应用尚未执行的 additive schema migration；
   - “start 不迁移”只表示不迁移或注入开发数据语料，不表示禁止 Flyway schema migration；
   - 不 seed、不清库；
   - 已存在 active DEV manifest 时只报告“已运行”，禁止叠加第二套环境。
2. `scripts/dev/restart`
   - 按 active manifest 重启进程；
   - 保留数据库和开发资产；
   - 不 seed。
3. `scripts/dev/stop`
   - 只回收 manifest 登记的 child tree、容器和资源；
   - 不按端口/进程名模糊清理；
   - 不删除持久开发数据。
4. `scripts/dev/seed`
   - 显式写入开发语料；
   - 重复执行必须幂等，或以可判别错误拒绝既有数据漂移；
   - 禁止静默 reset。
5. `scripts/dev/reset`
   - 唯一破坏性 DEV 入口；
   - 破坏面由显式 allowlist 列出，至少包含开发数据库与 asset 模块登记的本地存储路径/对象桶；
   - reset 后不自动 seed；
   - 产出 reset report，逐项记录执行前后 readback 数量，任一未归零/未达期望即 FAIL。

资源与就绪：

- 同一时间只允许一个 active DEV manifest；
- DEV 数据卷、开发资产存储与 Testcontainers 临时资源完全隔离；
- `verify` 和受管测试不得读取或复用 DEV 数据；
- 当前阶段不新建 health/readiness 端点；
- runner 复用 walking skeleton 的入口断言子集：代理可达、登录页 200、外部伪造内部头被覆盖/剥离；
- 禁止另写第二套会漂移的迷你就绪探针；
- app 输出 run-scoped 结构化 `APPLICATION_READY` 事件供 runner 定位启动阶段，但它不能替代真实入口断言。

### D12.3. `HANDOFF.md` 是轻量、受约束的生产化欠账账本

边界：

- 只登记本阶段有意延后的生产化欠账，不登记业务需求、普通 TODO 或未决架构问题；
- 初始七项固定为：CI 执行平台、备份/恢复、密钥轮换、health/readiness 端点、部署回滚、指标/告警、Q9 单 runtime DB role 的已知权限边界；
- HANDOFF 不拥有架构真相；manifest、ADR、project-memory 仍是规则与裁决的唯一原文。

每行字段：

1. 稳定 `id`；
2. `currentBoundary`；
3. `deferredReason`；
4. `risk`；
5. `activationTrigger`；
6. `futureAcceptanceEvidence`；
7. `decisionSource`。

触发与关闭：

- trigger 必须是可判定事实，例如“出现第二个真实外部 upstream”“启用搜索引擎”“团队人数超过 N”；禁止“规模变大后”“业务复杂后”等模糊表述；
- trigger 未发生时，未关闭欠账不阻断当前交付；trigger 一旦发生，对应欠账不得绕过；
- 关闭不得删行，必须由 `doc/decisions/` 中的一事一文 decision 给出证据与 supersede 裁决；
- HANDOFF 行只追加 `closedBy: <decision 文件>`，不复制关闭决策原文。

机器门：

- `scripts/check/handoff-debt` 只检查 deferred item 存在性、七字段完整性和稳定 ID 唯一性；
- 使用秒级 Markdown 解析脚本，不建立状态机、平台、审批流或通用欠账框架；
- 门只证明账本结构可信，不证明生产化能力已经实现。

## 4. 行动文档派生

本轮讨论的最终行动闭环已派生到：

- `doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md`

该计划负责把 D1-D12 转成“决策 → 规则 → 机器门 → 测试 → 文档落点”。本文继续作为会话防丢讨论账，不授权实现。
