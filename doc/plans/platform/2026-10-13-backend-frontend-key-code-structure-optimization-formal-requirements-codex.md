# 前后台重点代码结构优化 · 正式需求

日期：2026-10-13。`DOCUMENT_KIND=FORMAL_REQUIREMENTS`；本文件定义产品与工程要求，不授予实施或运行权限。

## 0 · 来源、裁定与授权

Dexter 原始任务：

> 关于T1的需求，你再仔细读一下，然后归纳成共性的问题模式，针对这些问题模式，请扫描一下BackEnd和Frontend两个代码目录，寻找前后台代码存在的问题，并给出整改建议，仅输出问题分析稿，暂不作为正式需求，对于问题和整改方案我们可以一起讨论确认

Dexter 本次裁定：

> 需要我确认的内容全部按你的建议，然后根据分析稿生成正式需求文档，并完成对抗性review，直至go

来源分析稿：`doc/plans/platform/2026-10-13-backend-frontend-code-structure-problem-analysis-discussion-codex.md`，初始 SHA-256 `c369a9a82e23fd397359195a7b7e738d3972b9fed3205a69c18f76655b04907c`。
TER T1 原始需求：`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`，SHA-256 `b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e`。

“全部按建议”落实为以下五项确定输入，不把分析稿中的候选措辞当成实施者可任意扩展的指令：

| 决定 | 确定要求 |
|---|---|
| D-01 保持业务边界 | 本期先整改职责、复用与单源消费；既有业务、Journey、数据库、公开 HTTP 契约和 Java 公开类型身份保持。B-4/B-5 的跨契约调整单独列为后续范围，本期不执行 |
| D-02 feature 公开边界 | 有实际跨 feature 消费的能力提供窄公开入口；不强制每个 feature 新建空 index 或模板文件 |
| D-03 共用能力住址 | 同 App 的跨领域纯规则优先复用现能力；只有真实跨 App 的通用机制才进入 foundation。不新增共享业务模型、动态参数 catalog |
| D-04 商品页签 | 纯页签呈现最终归前端，后台仍拥有引用、授权和业务可用性事实；契约字段移除须另立范围，本期保留 tabs 及既有消费者语义 |
| D-05 Java 类型 | 新公开边界类型落 api；存量 FQCN、公开嵌套 record、直接构造接缝继续按 R-READ-02 保持。迁移另立范围 |

本次授权仅包括本需求文档与独立审查/处置文档。需求接受不授权详设定稿、源码/测试/生成器/规范/项目记忆/依赖修改或运行；TER T1 在途工作不因本稿扩大范围。所有拟议整改与验证均为 `NOT_RUN`。

## 1 · 要解决的问题与方案取舍

目标是让维护者从一个能力的明确入口找到事实、派生规则、公开接口和资源生命周期，减少修改时遗漏另一份名单、规则或失效处理。成功不以文件变短、包数增加、接口数量增加或抽象数量增加衡量。

本期针对已定位的共性问题：P-1 责任混装；P-2 重复事实；P-3 内部组织泄漏；P-4 既有能力未复用；P-5 业务与呈现越界；P-6 隐藏装配名单；P-7 固定契约/策略/环境混淆；P-8 异步资源身份分散；P-9 用存在性或 cast 代替正确消费。P 编号只用于文档，不进入代码命名。

采用现 owner 内提纯、现 foundation 真实接入、现 canonical 生产链派生和窄 feature 接口。拒绝全仓机械拆文件、所有 Java 包加 declarations、所有 Service 加接口、所有值参数化，以及为此次重构引入通用 registry、事件总线、动态发现、上传 pipeline 或第二 HTTP 执行器。TER 的 actor/selector/ParameterDefinition 机制不搬到前后台。

## 2 · 范围与问题族处置

生产范围为 `apps/backend/` 的 CBS、20 个现模块与 TDS，以及 `apps/frontend/` 两个独立 App。直接依赖的现 foundation、canonical、生成器、相关测试和文档属于配套影响范围。TER 手写生产代码与行为不在本期范围；唯一 TER 配套影响是 R-04 同一生成器双目标输出的 additive 运行期常量。该 TER 文件仍是生产消费的生成物，不能称为非生产代码；只允许未来获准实施时由原生成器同步重写，不手改、不接入 TER 手写消费者，也不扩大在途 T1。详设重开当前 outputPaths，并与 T1 的最终输出位置协调；先后安排由 Dexter 统筹。本需求本身不授权现在生成或改源码。分析稿中的文件计数只是导航快照，不是语义审查完成证明，不建立新分母台账。

详设须对下面全部问题族给出当前源码证据、真实调用者、目标住址、保持条件和验证落点。对同根新增实例，只能按同一已批准问题模式、现 owner 内且不改业务/公开契约的边界处理；不能借同根扫描新建业务能力或扩大 B-4/B-5。

| 来源项 | 本期明确处置 | 对应需求 |
|---|---|---|
| B-1 TDS topic 闭集 | 必须取消 codec 的第二份合法 topic 声明，消费现 canonical 加载能力 | R-03 |
| B-2 资产流式物化 | 必须在 asset owner 内归并实际重复资源生命周期；保留各自内容校验 | R-05 |
| B-3 商品制作差异 | 必须统一同 owner 纯规则，保持列表与详情事实输入范围 | R-06 |
| B-4 商品 tabs | 归属方向已定；本期不移除/改动公开字段。另批先核 IA、canonical 和完整消费者 | R-07 |
| B-5 IAM 公开类型 | 方向已定；本期保护现 FQCN，不迁移存量公开类型 | R-07 |
| B-6 商品 Service | 必须形成具名纯校验和详情值组装边界；不强制 promotion 另建 Bean | R-06 |
| B-7 手工构造依赖图 | 本期保留既有公开直接构造接缝；无状态多实例不作为多真相缺陷，不新增依赖容器 | R-14 |
| F-1 多 surface Page | 必须按现 surface/资源梳理职责；更新页为主，PlatformReadPage/SalesMenuPage 为同根核验对象 | R-10 |
| F-2 generation 重复 | 必须用现 foundation 的适用能力，保留每种独立资源和业务身份 | R-10 |
| F-3 远控 start/end | 必须由 remote-control 窄公开能力闭合；宿主仍拥有任务上下文/入口资格 | R-09/R-11 |
| F-4 远控入站枚举 | 必须从现生成器派生运行期闭集，不手改 generated，不删入站校验 | R-04 |
| F-5 图标隐性白名单 | 必须取消图标决定菜单成员的路径 | R-08 |
| F-6 扩展字段 | 必须归现 extension-fields 并真正消费现 canonical 对象，移除掩盖形状的 cast | R-12 |
| F-7 主数据状态 | 必须复用现生命周期呈现能力，不改变未知值和领域状态语义 | R-13 |

同根结构定位覆盖上述范围，但不要求重写每个文件：无同一事实/行为的重复、owner 内合理职责、合法 App 差异和已正确接入能力保留。详设需列明代表实例及具体不适用反例，不承诺“所有行已全面审计”。

## 3 · 正式要求

### R-01 · 保持业务与对外边界

不新增用户任务、页面、Tab、业务操作、权限、业务状态、数据库迁移、业务 deployable 或网络拓扑。两后台仍独立拥有 shell/router/store/baseApi/theme/generated API。现 operation、HTTP 请求/响应 schema、错误状态码、Java 公开类型身份与调用接缝保持；保留事务、授权、锁/CAS、幂等、审计、readback 和分页语义。内部序列化可改为既有契约已合法支持的形式，须按 R-12 证明语义，不把“保持契约”误作所有 payload 字节不许变化。

### R-02 · 职责按事实与维护原因划分

CBS 跨 owner 仍调用目标公开 command/read API；写入加入既有 REQUIRED 事务，task join 不产生写权限。Java 使用现 api/application/domain/persistence/support 分类，前端使用现 feature、App 与 foundation。提取行为须列出输入、输出、真实消费者及唯一事实 owner；不能因长文件、字符串相似或类实例数量判定职责错误。

### R-03 · TDS topic 合法闭集单源消费

`contracts/protocol/terminal-connection-protocol.json` 的 topicKeys 是合法 topic 类型正本。优先扩 `TerminalConnectionProtocol` 现加载/校验接缝，`TerminalConnectionFrameCodec` 消费同一集合，删除其手写 TOPIC_KEYS。保持当前全部合法 key、非法 key 的 typed 拒绝与既有帧边界。
session 的 binding/权限分类、repository 的 topic SQL/参数路由继续由各自 owner 明确实现；不得拿合法 key 集合替代权限或读取来源，不建动态 topic registry。

### R-04 · 远控协议生成类型与运行校验一致

扩现 `scripts/generate/terminal-remote-control-protocol.mjs`，从现 canonical 输出 INPUT_RESULT、SESSION_END 等真实消费闭集的运行期值；Web parser 使用该生成值。类型 union 与运行期集合由同一源派生，不能新造第二 enum、手改生成物或以 cast 取消校验。消息字节、UUID、seq、字段形状/关联和业务身份仍校验；中文反馈留在 remote-control。
现生成器对 TER `remote-control/src/generated/terminalRemoteControlProtocol.ts` 与 operations-admin 对应生成物使用同一 renderer，输出相同内容；新增 export 必须 additive，保持既有类型、export 与 wire 语义，两目标一起生成并检查，不引入分目标渲染。TER parser、actor、declarations 与公开入口不因本期改动；其手写 reason 闭集由 T1 自身范围处理，不借本期接入。详设按当前字节核查两目标路径与消费者，而非固守此处导航路径。

### R-05 · asset owner 的资源生命周期一处实现

归并 `PlatformAssetService` 两条物化路径共同的 tempfile、流式读取、摘要、限长、prefix、写入与失败删除。使用一个具名 owner 内方法，以现大小/prefix 策略为显式输入；既有流关闭和临时文件所有权不变。当前可达消费者是更新 ZIP 与公开入口准许的图片用途/格式：各自大小策略和 magic/signature 保留，decode 仅用于图片。现存 video/mp4 的大小、后缀、magic 保留分支及读引用形状不等于公共上传准入；提取不得放开视频用途，也不得给这些保留分支误加图片 decode。不把一次性 SHA helper 冒充流式实现，不建立跨 owner 上传/校验框架，不新增恶意归档或 JDK 缺算法专项。

### R-06 · catalog 纯规则与聚合关闭责任分开

`CatalogItemService`、`CatalogWorkbenchReadService` 的制作差异判断采用一份同 owner 纯规则，优先现 `CatalogOwnerValueSupport`。null/missing/effective 语义保持；不得为了共用规则扩大受限读取或删 totalCount 等事实。
将 ItemService 中独立的草稿/制作校验和详情值组装提为具名同 owner 能力。稳定 facade、公开嵌套类型、直接构造、锁/CAS、receipt/审计/权威 readback 仍沿当前路径。promotion 保持原事务/调用边界；只有详设证明现 self-call、Spring 代理、事务传播与成本后才可在本 owner 内重新组织，不强制拆 Bean、聚合或一 handler 一 service。

### R-07 · 存量公开模型保持，后续调整不偷渡

当前 catalog tabs/visible/disabled/reason 及其生成契约和消费者保留；新职责提取不能顺带将后台字段转前端。现 IAM API 使用的 application 嵌套类型/FQCN保留，按 R-READ-02 核对真实消费者。后续纯页签迁移及公开类型迁移分别记录必要输入与影响，既不作为本期“已整改”，也不作为本期尚未完成的阻断义务。

### R-08 · 菜单成员由注册与授权决定

operations-admin 菜单只消费现 catalog、实际 page registration 与授权结果；图标属于呈现，不得过滤掉已注册且授权的页面。优先让同一具名 registration 提供其图标，或采用等效完整类型约束；不新增图标白名单、用默认图标掩盖缺注册或把 router 放 foundation。显式组件注册与 generated catalog 是不同事实，保留各自职责。无权限、缺组件注册的页面仍不能进入。

### R-09 · 有消费者的 feature 提供窄公开入口

实际跨 feature 的共享能力由其能力 owner 提供明确入口，消费方不直达该 feature 的内部 model/ui。本期覆盖 remote-control、扩展字段，以及已找到的三组同根：organization-structure 的 organizationStatus（组织状态词表及 toggle）；store-operating-rules 的 useStoreOperatingRuleGate 及 StoreOperatingRuleGateState 类型；business-channel 的 accessKindLabels/orderKindLabels。现消费者涉及 business-channel、store-management、store-profile、catalog-management、inventory-management、sales-menu、store-service-point，详设逐项核实当前调用与 type-only import。保留能力、业务 owner 与查询生命周期，只增加有消费者的窄公开入口并改引用；audit-history 的现 index 是可复用形态。不导出整个目录、不为无消费者的 feature 新建空文件、不建全局插件/command bus。前端 App 的 wire/generated 执行边界保持，不能以 TER T1 为由生成每 feature HTTP 执行器。

### R-10 · Page 编排与异步资源闭环

更新页按规则列表/详情及门店分页、报告列表/详情及历史、mutation 等现 surface 提取具名 hook/controller/组件；Page 保留现用户任务、上下文和焦点编排。PlatformReadPage、SalesMenuPage 对同根路径逐项核对；无问题的路径保留，SalesMenu 先复用现 useSalesMenuReadModel。
每个独立资源使用现 `asyncGeneration`/cursor query identity 等适用能力；保留 target/context、分页并发、unmount、finally 和特殊资源清理的 fence。不同 Tab/资源不得共用一个 counter 互相取消，合法 effect 内布尔 guard 无须替换。不得换一层包装继续复制同一失效规则。

### R-11 · remote-control 自闭合会话生命周期

remote-control 公开 launcher/controller 与 workspace 接缝拥有 start、restart、end、迟到 start cleanup、Room/track/keepalive 的身份关闭。宿主更新页提供已批准 target、入口资格和关闭后焦点归还；项目/报告 owner、权限权威不迁入远控。不改变现全屏弹窗和远控可操作范围，不新增第二会话管理器、额外报告或恢复框架。

### R-12 · 扩展字段规则归属与真实对象适配

将跨领域纯定义筛选、hydrate、差量和提交转换归现 `extension-fields` 能力，提供窄公开入口；不藏于 organization-structure、不在多个业务 Drawer 复制、不因同 App 多消费者升到 foundation。业务 scope/引用/规则查询仍由各业务 owner 控制。
当前 canonical 声明 extensionValues 为对象，现 `ExtensionSubmissionWireMapper` 同时支持对象和 legacy 数组。本期消费 canonical 对象：SET 发送真实 JSON 值，CLEAR 发送 key:null，未提交/未变化不建立 key，空提交为 {}。保留 enabled 字段、DATE 规范化、false/0、changed-only 与 required 最终复核；不能发送 valueJson 字符串代替解析值或用双重 cast/any 掩盖数组。
表单值经既有 DATE 等规范化后为 undefined/null/空字符串时：原值存在则提交 CLEAR；原值不存在则不建立 key。false/0 不是空值，不能被 truthy 判定清除。该表单规则不把所有合法 JSON 空字符串都定义为服务端 CLEAR；HTTP 的显式 CLEAR 仍是 key:null。
Java owner 继续使用显式 SET/CLEAR 的 ExtensionSubmission；不改变 schema/generator/DB。legacy 指 HTTP 数组适配支路，不是 owner 的 typed list。详设须在前端迁移后核清其真实生产提交者；测试和 fixture 不算保留理由。若已无生产提交者，按删除过时代码原则移除该支路并同步迁移依赖它的现测试/fixture；如仍需保留，须给出具名生产调用者与兼容理由，不能只说“现 acceptance 在用”。有限实际范围以当前源码复核为准，来源截面为十个 Drawer、十四个 operation：组织 REGION/PROJECT create、组织 update、集团 update；品牌/租户/总公司各 create/update；门店 create/update；合同 create/update。详设必须核清继承形状与全部调用者，不能只数 extensionValues 文本次数。

### R-13 · 主数据呈现复用且不污染领域状态

更新页区分规则状态与规则门店状态。已知值消费 `admin-ui-foundation` 的 LIFECYCLE_LABELS/LIFECYCLE_COLORS；feature 保有现有文案差异和未知 fallback，不修改 foundation 的 lifecycleLabel，不直接裸显未知 raw 值。
规则只有 ENABLED/DISABLED，不增加 VOIDED：列表继续按现分支显示“启用”/success 或“停用”/warning；详情对未知值显示“状态未知”。本结构批次保留列表未知值落“停用”的现 fallback，不能把它解释为 owner 已确认停用，也不悄悄统一为详情文案。规则门店保留 ENABLED=启用、DISABLED=停用、VOIDED=已作废、UNKNOWN=未知及现其他值落“启用”的 fallback；“已作废”为 feature 的可见文案别名，不能为此把 foundation 的“作废”全局改名。详设/测试分别点名这些分支，不能以“一套三态标签”省略差异。改变上述既有反馈须另行明确产品输入。更新任务、报告、远控会话等领域状态仍各自 owner 解释；不得强塞主数据三态或统一所有颜色。

### R-14 · 策略与构造的有限整理

只对实际同一可调策略的重复声明归一具名值，单位、owner 与真实消费者明确；固定协议值来自 canonical，环境数据来自现配置。不同 owner 限值、SQL 参数、算法 0/1 不是同一事实。没有源码支持的固定 URL/地址数量错误不列强制整改。B-7 保留现直接构造路径，不新增 dependency bag、扫描 registry 或通用工厂；现 stateless Facts 的多实例不等于多业务真相。

### R-15 · 文档与防再犯落到现正本

未来实施须同步实际变更对应的 README、公开边界、生成器说明和维护指针；已确认通用模式需落到既有适用测试或 review checklist。若现前后台编码规范已覆盖，只补消费/实例证据，不重复正文；确有规则缺口则在详设中指定唯一正本及实施修改范围，经后续授权写入。项目记忆只放导航指针，不建立第二规则库。机械门只判断一行说清的规则且有真实 red；职责/业务等价不伪装成关键词门。

### R-16 · 后续详设必须把自由发挥收小

每个本期项明确源文件/符号、消费者、目标职责、保留事实、现可复用能力与更小替代；不预先按行数指定拆分数量。给出完整 CP 顺序，明确前后台/生成器的接缝、公开边界和现测试文件或拟新增的具名测试文件；每条 V 有场景 ID、执行档位、具体断言、fixture 来源和 cleanup。任何第三方行为依据先核实际解析版本与官方资料，不以本稿选择新依赖。
沿已批准 IA/Journey 不改页面/权限/控件；未来设计须点名真实交互正本和改动控件内行为，不能用“重构无业务变化”豁免。当前需求阶段不新建线框/IA，不表示现 UI 行为已被独立动态验证。

### R-17 · 验证控制在真实影响范围

后续授权实施后做受影响编译/类型、现生成 check、focused tests 和必要真实 HTTP/UI 验证；不要手改 generated、以文件存在/response.ok/类型检查代替业务断言，不默认跑不相关完整 verify 或未受影响设备矩阵。明确原始失败、修复字节和 proof 边界。
CBS owner 可读性整改仍遵守后台规范 R-READ-07：最终一次受管全量 backend-acceptance 晚于全部生产/测试改动，分开给出 CONTRACT、BUSINESS、信息性 DB_OPERATIONS 与 cleanup，不能拼接 focused 或复用改码前旧 run 代替。它不扩为不相关完整 verify，也不是当前运行授权；详设/计划据此排好最终验证顺序。
进入动态前给整条实际测试链加入必要关联调试日志，再按项目当前规则做两轮 fresh 静态对抗查漏；CP 对账按完整 CP 进行，已对账且未修改部分不重复开关卡。复用唯一受管 backend-acceptance / browser L2 及已有资源生命周期，不新造 runner。任何动态执行须由 Dexter 后续授权；本稿不要求现在运行、不以现在 NOT_RUN 判需求不成立。

## 4 · 主要源码与交互导航

以下是当前查证入口，不冻结行号/计数作长期机器规则；详设重新读取 current bytes。

业务语料唯一正本为 `project-memory/decisions/confirmed-business-language-corpus.md`，读取政策为 `project-memory/operations/business-corpus-adoption-and-read-policy.md`。本案命中：G-02/G-03/G-04（组织、经营主体与门店关系）、G-05/G-05A/G-05B（上下文、页面准入/读取/写权限及主关联实体呈现）、G-08/G-09（主数据与合同状态）、G-10（集团空间和双后台）、G-11/G-12/CIPG-01（商品、制作信息及库存/可售边界）。它们只约束术语与不得推导范围，不批准新业务、owner、Journey、schema或运行；本期保留既有语义，不从共享标签或字段整理推导状态联动、权限或制作/库存新能力。后续详设重开命中完整条目，不复制语料正文或另立规则库。

| 族 | 源码/复用入口 |
|---|---|
| TDS | `apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/protocol/TerminalConnectionProtocol.java`、`TerminalConnectionFrameCodec.java`；session/TdsTerminalSessionActors、state/TdsTerminalTopicRepository |
| asset | `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java` |
| catalog | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/` 的 CatalogItemService、CatalogWorkbenchReadService、CatalogOwnerValueSupport、CatalogOwnerService、CatalogCopyService |
| Java 保护边界 | `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceOperationsCommandApi.java` 及实际 wire mapper |
| Page/远控 | `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`、`features/remote-control/`；`apps/frontend/platform-admin/src/features/organization-contract-overview/ui/PlatformReadPage.tsx`；operations 的 sales-menu/ui/SalesMenuPage.tsx |
| 生成/菜单 | `scripts/generate/terminal-remote-control-protocol.mjs`、`contracts/protocol/terminal-remote-control-protocol.json`、operations 的 app/routing/pageRegistry.tsx、app/OperationsApp.tsx |
| 扩展字段 | operations 的 `features/organization-structure/model/organizationExtensionValues.ts` 与 extension-fields；CBS 的 `src/main/java/com/catering/v2s/app/edge/extension/ExtensionSubmissionWireMapper.java` 与 modules/extension/api/ExtensionSubmission.java |
| 共用能力 | `libraries/frontend/admin-ui-foundation/src/behavior/asyncGeneration.ts`、list/usePageQuery.ts、behavior/useDrawerFormLifecycle.ts、生命周期文案/标签；各 owner 的现 receipt/collection/SHA/support |

交互导航包括 `doc/decisions/2026-10-07-ter-update-supply-and-version-report-{journey,ia,ui-interaction}-claude.md`、`2026-10-10-ter-remote-control-{journey,ia,ui-interaction}-claude.md`；catalog 见 `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md` 和 `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-{ia-design,interaction-design}-codex.md`。组织/合同及销售菜单受影响面须在详设补齐其当前交互源，不凭此导航猜产品。

## 5 · 验收要求（未来实施义务，不是当前证据）

档位：F=受影响本地类型/单元/组件及生成检查；H=受管 backend-acceptance 的真实 HTTP/业务读回，TDS 帧由同 lifecycle 既有协议入口验证；L2=每 run 隔离后端的受管浏览器 UI；W=现 terminal-automation 在受管 DEV 上的 Expo Web Journey 回归，不是隔离 L2。具体文件、场景和授权在详设/计划闭合，不新增 runner。未改变 HTTP owner/协议行为的纯提取以 F 和独立源码复核证明；详设逐项说明是否需要 H/L2及理由，不因表中 F 写成免全仓义务，也不机械全量运行。

| V | 对应要求 | 必须证明的业务/工程断言 | 适用档位 |
|---|---|---|---|
| V-01 | R01/R02/R07 | 所有变更保留 operation/schema/Java公开签名与实际事务、授权、幂等、审计、readback；B4/B5未偷渡；合法边界反例被明确保留 | F＋独立源码复核；改变调用链时 H |
| V-02 | R03 | canonical全部合法topic能经过codec，未知key仍typed拒绝；不会把协议合法集当作binding/SQL权限集 | F；实际协议行为变化时 H |
| V-03 | R04 | 类型与运行闭集同源，新增canonical合法reason不需改Web手写名单；同renderer双目标内容一致且仅additive，TER手写消费者未改；未知值/非法字段/关联/字节上限仍拒绝 | F |
| V-04 | R05 | 当前可达ZIP/图片的摘要、prefix、各自正常限长、读取失败清理与流关闭等价；公共入口对视频仍拒绝，不因提取放开用途/格式。保留底层视频分支时不误加图片decode，不把私有分支测试当作合法上传证明 | F；影响asset提交/读回时 H |
| V-05 | R06 | 制作差异在列表/详情、null/missing与SKU子集输入下保持；totalCount及引用/当前读取预算不丢失 | F；影响owner查询/提交时 H |
| V-06 | R06 | 草稿校验/详情提取后原facade、CAS/receipt/审计/事务/readback仍关闭；不会因Bean/self-call改变实际事务 | F＋源码复核；代理/写路径变化时 H |
| V-07 | R08 | 已授权且实际注册页不会因缺图标从菜单消失；未授权/未注册页仍不出现；菜单焦点/路由不改 | F；实际菜单用户路径 L2 |
| V-08 | R09/R11 | remote、extension与R09三组同根的跨feature调用及type-only import均走窄入口，无内部deep import；查询/业务owner不搬移，无空index/整目录公开导出 | F＋源码复核 |
| V-09 | R10 | 列表/Drawer切换context、关闭/unmount后迟到响应不回写；独立Tab资源互不误取消；finally仍按现身份关闭 | F；现受管 update Web Journey 回归（DEV，非隔离 L2） |
| V-10 | R10 | 规则门店/报告历史的cursor、加载更多、查询刷新与现表单dirty/Drawer关闭语义不变；现foundation真实被消费 | F；现受管 update Web Journey 回归（DEV，非隔离 L2），补明确跨页断言 |
| V-11 | R11 | start成功、拒绝、快速关闭后迟到start、restart/end使用同一session身份；旧Room/track按现生命周期释放；宿主资格不变 | F；现受管 remote.web Journey 的入口/结束回归（DEV，非隔离 L2） |
| V-12 | R12 | 十个Drawer/十四operation实际输出canonical对象；SET保留JSON类型；表单undefined/null/空字符串按原值有无转CLEAR或omission，HTTP CLEAR=null；空提交、DATE、false/0与enabled筛选正确，无掩盖cast；对象SET及CLEAR有真实持久化读回 | F；代表新建/修改真实HTTP读回 H |
| V-13 | R12 | extension required/disabled、差量、原值不变、幂等重放与持久化语义保持；legacy实际生产提交者被核清，无生产提交者时支路及依赖fixture同步迁移，保留时有具名理由 | F＋H |
| V-14 | R13 | 规则/门店两类状态的已知标签/色彩复用现能力；分别证明规则列表/详情及门店VOIDED/UNKNOWN/DISABLED的既有文案与fallback保持；foundation未被局部改名，报告/远控领域枚举和颜色未误套主数据词汇 | F；现受管 update Web Journey 的已知状态回归；未知/作废 fallback 由 F 证明 |
| V-15 | R14 | 同一策略仅一住址，单位/消费者可追踪；合法不同值和直接构造保留，无registry/参数页/依赖容器 | F＋源码复核 |
| V-16 | R15 | 真实README/公开入口/生成来源/适用测试与正本指针一致；如加机械门，真实red会失败且合法反例通过 | F＋源码复核 |
| V-17 | R16 | 全部本期问题族具有明确目标、调用者、保留条件、复用比较、CP和具体测试落点；延后项不进入实施遗漏台账 | 静态详设/计划审查 |
| V-18 | R17 | 动态前日志链与两轮静态查漏关闭；所需受管验证输出业务和cleanup分开；未运行项保留，已对账未改范围不重复 | 未来F/H/L2按授权；当前NOT_RUN |

V-12/V-13 并不要求先为十四operation各跑完整浏览器Journey：全调用者类型/提交映射在F闭合。当前 ExtensionAcceptanceScenarios 源码以legacy数组覆盖代表SET及创建/更新，不足以证明对象SET或HTTP CLEAR；未来须在该现有场景文件补对象形状的代表SET（含false/0/DATE）及CLEAR=null的持久化读回，另证明omission/未变化语义。现owner/mapper单测的CLEAR反例不能替代HTTP链证明，测试源码也不等于本轮运行PASS。详设选择实际受影响主体/类型的必要场景并给出理由，不遗漏业务不同语义；若退役legacy，相关fixture一并迁移，不新建runner。R04只增加TER生成常量、不改其消费者行为，本期不新增Expo Web、设备或双机矩阵。

## 6 · 可达性、成本与非目标

新增结构建立在已用canonical loader、协议生成器、asset owner、catalog support、foundation与feature上；扩展对象支路已存在于canonical/edge，不需新公开API或DB。性能收益不预先许诺，整理不能以减少SQL预算为由删业务事实。复杂Spring拆分先证明成本，现稳定接缝优先保留。

不包含：catalog tabs移除、IAM公开FQCN迁移、TER目录优化实施、业务模型/状态/权限改变、统一所有错误文件/DTO、全页共享generation、全Appregistry、全仓格式批、动态参数、服务发现、MQ/outbox/恢复框架、新依赖、恶意归档专项或新管理界面。严守当前90%常见维护/使用主流程，不为罕见情况新增框架；现正常失败与资源释放不因“重构”豁免。

## 7 · 状态与后续

已完成的输入是结构定位、代表源码链读回和Dexter对五项建议的确认；分析稿不是全文件语义证明。正式需求的独立review以当前字节、独立报告和finding处置记录为准，本正文不自写review verdict。

当前详设、实施计划、所有整改、依赖解析、生成、编译、测试、verify、H/L2、DEV、reset/seed、设备、UAT、部署与cleanup均未执行。无实现/性能/动态PASS。通过本需求静态review后仍须Dexter另行授权详设/计划及实施。

`L3_UNVERIFIED` 非空：本结构优化后的菜单准入/导航、Page列表与Drawer/cursor/dirty/迟到响应、远控start/restart/end与焦点/资源关闭、扩展字段Drawer提交及持久化语义均待未来实现和相应运行验证。本次不核验历史运行，也不据此断言既有UI从未验证。需求静态阻断关闭且仅余UI未验证时，按review-standard使用 `GO_WITH_UNVERIFIED_UI`；作者处置记录不能自授该独立verdict，旧字节报告不得升级为修订后结论。

## 2026-10-14 · 验证路线裁决（Dexter）

Dexter 选择 A：隔离 admin-ui L2 只保留菜单、门店扩展、合同扩展三个 case；更新页与远控复用现受管 update Web / remote.web Journey，保留 V-09/V-10/V-11 全部 F，V-14 的未知状态与别名也仍由 F 证明。删除本批隔离 TDS、wire 新模式、报告 credential fixture 和工件到 L2 的交接；不新增 runner。现 Journey 不自动证明所有分页与竞态，详设指定显式跨页回归；异步竞态由 F 验证。首次隔离 L2 的完整 seed dry-run 义务保留，仍需要一次现受管 update.artifacts 源 run；它不是实际 seed，也不证明 owner seed 对象化。裁决仅批准设计取舍，不授权当前构建、DEV、Web 或 L2 运行。
