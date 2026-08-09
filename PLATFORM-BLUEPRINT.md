# catering-v2s Platform Blueprint

## 当前产品形态

v2s 从一个业务 deployable 起步：单进程模块化单体、单 PostgreSQL 数据库、多 owner schema、单一 Flyway history。模块通过公开 `<module>.api` command API 协作，同步加入同一 `REQUIRED` 事务；coordinator 不拥有业务资产。跨 schema read 只为明确任务型 join 服务。

初始形态不包含 MQ、通用 outbox、TDP、内部 OpenAPI client、搜索平台或常态轮询。只有真实触发条件与新 decision 可以改变该边界。

## HTTP 与管理端

OpenAPI extension `x-consumer-faces` 是 operation 暴露面的单一真相。`platform-admin` 与 `operations-admin` 是两个独立 consumer app，分别拥有 shell、registry、theme、route 和状态生命周期，不能合并为一个后台。

### 平台授权模型红线

每位已启用的平台管理员都是同一层级的 `platform-super-admin`。平台端写操作只允许“有效平台 session + platform owner 对管理员已启用状态的最终复核”；它们不得进入 `workspace_account`、运营角色、页面准入或动作 capability 模型。Contract 对已认证平台操作必须使用 `AUTHENTICATED_PLATFORM_SUPER_ADMIN` / `PLATFORM_SESSION_ENABLED_ADMIN` 与 `x-required-platform-authorization`，公开 OTP、凭据和邀请接受流程使用 owner protocol 事实；只有 `operations-admin` 的已认证 workspace 操作可以声明 `x-required-capability` 并投影进 `WorkspaceCapabilityRequirementCatalog`。生成链和不变量门必须拒绝 platform-admin 的 `capabilityKey`、`capabilityMapping` 或 `AUTHENTICATED_WORKSPACE` 投影；这不削弱 operations-admin 的角色能力治理。

### 运营写权限与范围解析红线

operations capability 只表达用户发起的写工作流，不得作为页面访问或任何 GET 的读取权限。不同独立用户任务或不同目标数据节点类型的写入必须有不同 capability；事实 owner 不会自动创造第二个用户授权。例如，商品 whole-save 中随商品保存的 StockTarget/BOM 定义仍属于商品编辑，而盘点、增加、调整和库存工作台的独立配置属于门店库存编辑。跨 owner 的 whole-save 只能由 operation policy 明确列出有限 owner command、同一 `REQUIRED` 事务与精确 originating requirement；目标 owner 必须同时复核 grant 的 workspace、group、target type、target reference、capability 和 operation purpose，不能把一个商品 grant 泛化成任意库存写。页面可见性只是 UX，服务端必须从 operation policy、显式 data-node selector 和 live role/assignment/task-path 复核得出唯一写授权。会话允许同时保留 Store 与 Head Company 选择时，禁止 Store-first/Head-Company-first 猜测：必须按请求 selector 命中对应的持久化选择，缺失、歧义或不匹配一律 fail closed。edge 解析的 server-minted `OperationsOwnerScopeGrant` 必须传入事实 owner，并在 receipt replay 或 mutation 前完成上述复核；不得让 coordinator、header、session snapshot 或 UI capability 代替 owner 授权事实。普通 scoped GET（包括诊断）只受页面/会话/owner scope 约束，不新增 read capability。

### 跨层变更闭合红线

凡修改一个 operation 的范围、session selector、header、capability、owner command、请求/响应字段、生成 wire 或运行 fixture，必须在启动动态验证前建立该问题族的有限“声明—传递—消费”矩阵；不能等 API/L2/DEV run 才发现静态可见的遗漏。分母必须先由 authoritative operation contract 得出，再逐项对照 request/response schema、root 与 path OpenAPI 参数/header、所有 generated Java/TypeScript wire、edge/controller 解析、coordinator/owner 重核、生产 consumer、API/L2/DEV fixture 与 focused proof。只从一个页面、一个 operationId 字符串或一次成功请求反推分母均不成立。

范围/权限/session 改动必须扫描所有共享 `allowedDataNodeTypes`、session-selection 或 capability mapping 的 operation，并验证显式 selector 从 UI/runner 到 HTTP、edge 和 owner 的传递与 fail-closed 语义；数据/读模型改动必须扫描 owner projection、edge serialization、generated type、查看/编辑 UI 与所有体验/测试 fixture；资产改动必须扫描 stage/claim/release、public read resolver、列表/详情/编辑预览和 cleanup；runner/fixture 改动必须扫描命令图、隔离 namespace、report 依赖与 cleanup owner。单目标且 controller 明确可无歧义推导的 operation 可以不带 selector，但必须在契约和 focused negative proof 中写明该反例；测试文件不是 production consumer，却必须在自己的 proof 分母中同步更新。

每个这类问题族至少有一个诚实的机械 exact-set/red-mutation 控制，以及一个跨层 review checklist；无法机械判断的 consumer 行为不得伪装成关键词门。generated output 只能由其 owning generator 产生。只有静态矩阵、生成检查、编译与 focused red/green proof 都闭合，动态运行才可作为业务/cleanup 确认，而不是遗漏发现工具。

### 不透明引用与复制闭合红线

持久化的跨事实关系必须存 owner 分配的不可变不透明 `*Ref`（UUID），不得把人可读、可修改或可复用的业务编码伪装成引用；业务编码只可作为显示、搜索、兼容路由和 owner 边界内解析输入。每个实际关系字段必须先写入有限、逐路径的引用矩阵，明确其事实 owner、存储路径、读模型标签投影、复制重写和 migration backfill；禁止按 JSON 键名、`Ref` 后缀或递归遍历猜测关系。

复制跨数据节点时，所有矩阵内引用必须由所属 owner 以 `(objectType, sourceRef) -> targetRef` 的显式映射重写，且在写入目标事实前完成；不得复用源域 UUID、退回按编码匹配或让 catalog 跨 schema 查询其他 owner。目标 readback 必须只显示 code/name 等标签，不能把 UUID 作为用户文案。迁移必须对每一个旧编码在 scope/brand 内作 exactly-one 解析；零匹配、多匹配、非法 UUID 或矩阵外的遗留关系一律 fail closed。资产 ref、库存 target ref、ledger ref 等已由 owner 定义为 UUID 的字段是反例，不得因本规则重新建模。

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
