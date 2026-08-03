# catering-v2s Platform Blueprint

## 当前产品形态

v2s 从一个业务 deployable 起步：单进程模块化单体、单 PostgreSQL 数据库、多 owner schema、单一 Flyway history。模块通过公开 `<module>.api` command API 协作，同步加入同一 `REQUIRED` 事务；coordinator 不拥有业务资产。跨 schema read 只为明确任务型 join 服务。

初始形态不包含 MQ、通用 outbox、TDP、内部 OpenAPI client、搜索平台或常态轮询。只有真实触发条件与新 decision 可以改变该边界。

## HTTP 与管理端

OpenAPI extension `x-consumer-faces` 是 operation 暴露面的单一真相。`platform-admin` 与 `operations-admin` 是两个独立 consumer app，分别拥有 shell、registry、theme、route 和状态生命周期，不能合并为一个后台。

### 平台授权模型红线

每位已启用的平台管理员都是同一层级的 `platform-super-admin`。平台端写操作只允许“有效平台 session + platform owner 对管理员已启用状态的最终复核”；它们不得进入 `workspace_account`、运营角色、页面准入或动作 capability 模型。Contract 对已认证平台操作必须使用 `AUTHENTICATED_PLATFORM_SUPER_ADMIN` / `PLATFORM_SESSION_ENABLED_ADMIN` 与 `x-required-platform-authorization`，公开 OTP、凭据和邀请接受流程使用 owner protocol 事实；只有 `operations-admin` 的已认证 workspace 操作可以声明 `x-required-capability` 并投影进 `WorkspaceCapabilityRequirementCatalog`。生成链和不变量门必须拒绝 platform-admin 的 `capabilityKey`、`capabilityMapping` 或 `AUTHENTICATED_WORKSPACE` 投影；这不削弱 operations-admin 的角色能力治理。

## HTTP CRUD 效率设计红线

效率设计先声明 generated route 的完整分母与实际覆盖；Seed/fixture 只是未覆盖全量前的诊断样本，不能被说成全接口或性能结论。root OpenAPI、path shard、generated route registry、controller 与 generated consumer 的可达 operation 必须闭合一致。

列表、候选与页面 read model 禁止循环内按 item 查询/调用；优先在正确 owner 内使用 set-based query、bounded batch task read 或任务型 read model。单对象 detail lookup 与已批量化读取不是 N+1。优化新增的 batch/judgment/normalization/session API 必须位于 owner 的公开 API package，edge 只映射，不重建 owner 授权事实，不跨 schema DML/import repository/entity。

不得以降低 DB 次数为由删除幂等、CAS、审计、限流/锁、owner 重核验、typed failure 或必要 owner readback。statement count/duration 只用于定位冗余；性能或索引结论必须有受控 workload、结果分位/吞吐、pool/lock/DB 资源观察和适用的 `EXPLAIN (ANALYZE, BUFFERS)`。task-read 默认预算是评审提示，稳定受限批量读取超出时必须说明用户任务、基数、query chain 与 owner/read-model 理由，不能机械压数引入错误的大 SQL。

受管 HTTP diagnostic、浏览器 Journey L2 与性能研究是三种不同执行面，必须分别声明能证明和不能证明的结果。HTTP diagnostic 的 request inventory 只能保存非敏感形状与 symbolic handle；密码、OTP、token、cookie、Authorization 与身份值只能按 run 在内存生成/注入，禁止落入 manifest、receipt、日志、报告、错误输出或清理工件，并需有泄漏 red proof。

## 数据与开发动作

模块 owner 独占事实写入与最终授权复核。Flyway 是唯一 schema history；DEV start/restart 只做 additive migration，绝不 seed。reset 和 seed 必须是单独、显式、可审计的破坏性动作。

环境执行面固定为三类：**DEV** 在本机启动 Spring Boot 与两个管理端 Web，通过受管 tunnel 使用远端非生产中间件；**当前受管浏览器 L2** 复用本机执行面，但每次必须隔离远端数据库/资产命名空间并分别证明业务与本机/远端 cleanup；**后续 UAT** 仅在获得单独授权后全量远端部署、远端执行。远端 Testcontainers 只是 JVM 与 Docker 同平面的技术验证，不替代任一浏览器 L2 或 UAT。

## AI-first 与证据

仓内 `AGENTS.md`、`.agents/skills/` 当前目录派生的 project-skill inventory、确定性 `project-memory`、只推荐不注入的 hooks，以及 provider-free 的 `rg`/源码回读构成最小执行底座。每个步骤必须有可失败的 clean/red gate、业务与 cleanup 分离的证据，以及明确的授权边界。

## AntD CLI 与统一控件基线

本机安装的 `@ant-design/cli` 是两个管理后台共享的组件 API/依赖/使用面诊断工具。实现或修复重复控件前，先用 `antd doctor` 确认依赖兼容，用 `antd info <Component>` 确认当前 antd 版本的真实 props，用双 app `antd usage` 建立使用分母，再用双 app `antd lint` 扫描 deprecated API 和静态 feedback API。CLI 只证明工具层和静态 API 使用，不证明 IA、catalog 文案、业务状态、owner/readback、浏览器视觉或动态错误恢复；这些仍须按新的 UI IA reconciliation ledger 逐控件证明。deprecated prop 的迁移必须保持 IA 行为等价并补 focused proof，禁止为了消 warning 机械改写。

## Heritage

all-v2、all-v1、v4 与 v6 只作为 hash-bound、显式引用、只读 Heritage；禁止写回和 runtime/build fallback。Roadmap 状态只由本仓 Registry 解析出的唯一 active owner 持有。
