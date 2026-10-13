# TER 重点代码结构 T1 优化 · 正式需求

日期：2026-10-13。需求版本：正式需求；独立结论及其字节范围见评审报告。作者：Codex。

`DOCUMENT_KIND=FORMAL_REQUIREMENTS`；`IMPLEMENTATION_AUTHORITY=NONE`。

## 0 · 任务、来源与授权

### 0.1 · 用户任务和成功标准

Dexter 要让 TER 代码更清楚、权责更明确、便于后续人工维护。目标是最优且长期可维护的结构，不以搬文件、改包或调整内部 API 的成本为保留旧结构的理由；同时遵循简单直接、职责单源和现有能力复用，不以“长期”预建未来框架。

完成后，维护者应能从一个能力包找到它的声明、行为、状态、公开读取、内部外部 API 和依赖；增加该包能力时，不需去各 App 补第二份事实名单。装配者只选择包、应用政策和真正外部输入，不再复制 owner 行为。

### 0.2 · 原始输入与已确认裁决

原话唯一记录：[需求讨论稿](2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md) §1、§11、§13.1。结构参考附件：[源码盘点](2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json)。附件是一次静态导航快照，不是新的准入台账，不证明逐分支审查完成。

| 输入 | 来源 | 本需求落实 |
|---|---|---|
| actor/slice/selector 具名分文件，共用方法提取 | 原话 1 | R-03、R-04 |
| 全面盘点错误、parameter 及既定机制 | 原话 2～4 | R-02、R-05～R-07 |
| commands/parts 等集中声明 | 原话 5；Q-1 已选择 declarations | R-03 |
| 包的定义/声明/行为自闭环，装配仅加载和外部注入 | 原话 6 | R-08～R-10 |
| URL 数量随环境配置，不写死 One/Two | 原话 7；Q-3 取消固定上限 | R-11 |
| 全包逐逻辑职责与多真相检查 | 原话 8 | R-02、R-12～R-15 |
| 可调整的策略默认值统一静态 ParameterDefinition | Q-2 已确认 | R-06 |
| 外部 API 在使用包内声明/使用，跨包只能 command/selector | 补充及最终澄清 | R-07、R-08 |
| 不改变 transport 的 owner 定位 | 补充最终澄清 | R-01、R-07 |

本稿是上述输入的需求收敛，不把讨论稿作者的内部函数名或推荐拆法自动提升为 Dexter 裁决。

### 0.3 · 当前授权

Dexter 当前只授权编写正式需求和若干轮对抗审查。按仓规本 DESIGN cycle 做两轮 fresh 独立审查；第二轮硬停止，残余问题如实处置，不因换 reviewer/文件/hash 再开第三轮。

不授权详设定稿、规范/记忆修改、生产代码或测试实施、依赖变动、生成、编译、构建、测试/verify、DEV、reset/seed、Web、Android/设备、L2、UAT 或部署。后文实施与验收要求是未来授权后的交付义务，不是本次运行授权。

## 1 · 范围与非目标

### R-01 · 整改范围与不变的产品语义

范围为 `apps/terminal/` 全部当前 workspace：kernel/base、kernel/feature、ui/base、ui/feature、ui/integration、adapter/android、application/base/android、两个 Android application，以及根聚合脚本/配置。现有导航快照是 39 个功能包和一个聚合包；这是现状计数，不冻结未来包数量。

需同时纳入被实际改动影响的仓内 canonical/生成策略/生成器、静态检查器、模板、README、API 文档、direct tests、唯一 automation driver 和受管配置 producer。它们只为闭合 T1 变更，不能借跨文件影响扩为后台新业务或新部署拓扑。

四层方向、React-free kernel、command→actor 写、selector 跨包读、单机双屏同 VM/store、副机无独立 TDS、TDC 唯一凭证 owner、store/project/update/remote 的事实边界保留。transport 保持现有 owner 定位及通用通信责任。

不新增产品页面、业务规则、动态参数后台、服务发现、MQ/outbox、事件总线、第二 Runtime/store/请求账本、host-runtime 中间层或常态轮询。既有业务能力重构后须保持；修正错误分类和取消地址数量上限是本稿明确要求的变化，其余产品差异必须交 Dexter。

旧 POC `/Users/dexter/Documents/workspace/idea/_old_` 与 `/Users/dexter/Documents/workspace/idea/newPOSv1` 仅只读参考，禁止成为 build/runtime 输入、fallback 或“旧实现就是正确”的依据。需采用的内容由本仓拥有，不能跨根读取。

### R-02 · 全包、逐逻辑职责核验

正式详设前重新枚举当前包和 source/public exports/imports/config/生成 producer，并与讨论快照比较；并行工作造成的差异按当前字节处理。不得把快照中的数量/行号当准入条件。

每包必须审查所有手写生产逻辑，涵盖 actor handler、slice/reducer/descriptor、selector、纯工厂、hook/组件、平台实现、native 类及配置解析。每个能力至少明确：为什么属于该包、输入和输出、事实与资源 owner、跨包读写、生命周期/失败、真实调用者、保留/移动/合并/删除结论。正文以能力和问题族汇总；不为每个字符另建审批或对账关卡。

generated 从 canonical/生产者核对；vendor 区分上游原样内容与本仓接线；测试/runner 从被证明的生产接缝和业务断言核对。行数、文件存在、文本命中和“编译能过”均不能替代职责判断。

## 2 · 文件组织与定义

### R-03 · 集中声明与具名行为单元

统一 `src/declarations/`：本包 commands、errors、parameters、parts、UI variable 等静态定义集中在具名文件，可在同一 declarations/commands.ts 声明多条 command。UI parts 可用 parts.tsx 引用 renderer；声明不得在定义时发请求、写状态或启动资源。

actor 定义一文件；slice 定义一文件；公开 selector 定义一文件；hook 一文件一具名 hook。文件名称表达能力，不保留包罗多个单元的 actors.ts/slices.ts/selectors.ts。barrel 只显式 re-export，无实现。无对应声明的包不建空 errors/parameters/parts 文件。

一个 actor 可以处理同一责任的多条 command。一个 slice 保留它的状态、reducer 和 persist/sync/reset 描述的可追溯关联，不按字段机械拆 slice。私有短小辅助单元可就近保留；跨多个单元真正复用的纯规则按能力抽取，不能为单次调用创建层层 wrapper。

`moduleName.ts`、`dependencies.ts`、`index.ts` 保持身份/依赖/公开边界住址；业务目录重组允许同步修改现行词表，但不在此要求合并三个根文件。generated/theme/vendor 等保留专用责任。

### R-04 · 大单元按责任拆解，资源事实单一

TDC、terminal-update、remote-control、topology、store-basic、project-basic 等大单 actor，以及 Runtime dispatch/lifecycle、State persistence、UI input/admin/render 和原生桥，均须按实际责任核验，而不是只修复多 actor 同文件。

拆分前标清共享状态、连接、定时器、pending、request/operation/boot 身份、启动/停止和迟到结果的责任。不强制“一 handler 一 actor”或行数上限。拆后不能增加第二连接控制器、队列、任务事实或两套清理规则；独立行为应能沿具名能力找到，互斥/顺序和资源释放保持原有合法语义。

纯 helpers 留在 owning 包 foundations；网络、store、平台和可写资源处理不得因抽公用方法被放入纯 foundations。包间抽共享能力需先证明现有能力不能承接及真实复用收益，不建泛化 god module。

### R-05 · 错误定义与消费分类统一

每包盘点实际失败分支，不按 errors.ts 存在判断完成。本包可预期业务拒绝、用户输入校验、资格不足，使用本包具名错误/已有 typed result，保留可区分的分类与原因；需要 AppError 时复用 contracts 工厂，定义集中 declarations/errors.ts。

构造期程序不变量可抛 Error；平台端口继续 PortResult/unavailable；CBS typed problem 保留 canonical 身份；持久化失败使用现有 typed 边界。禁止全局把所有失败改 AppError，或在每包复制一份服务端/平台错误协议。

普通 Error 被 Runtime 归为 SYSTEM 时，必须确认其确为系统/程序故障；用户可改正的配置或业务拒绝不得因此进入错误的系统失败 UI。界面消费 owner 结果，不能再按裸字符串重造类别。

contracts 模板语法、示例、工厂和公开类型须一致；code/category/业务文案来源清楚。诊断和业务错误反馈分开，日志按现行唯一正本，不新增脱敏/错误恢复框架。

### R-06 · 静态 ParameterDefinition 与常量单源

本包可独立调整的策略默认值（如 timeout/retry/interval/queue/page 策略）统一静态 ParameterDefinition，复用 contracts 工厂，集中 declarations/parameters.ts；默认值和单位具名、消费者引用同一定义。确有外部覆盖时由所属能力统一校验并得到有效值，不各调用点再给不同 fallback。

协议固定上限/错误码/topic key/operation 等沿 canonical/generated/owning definition；算法的 0/1、下标、单位换算和局部展示值不机械参数化，不建全局 constants 垃圾桶。选择哪些值属于策略必须以真实用途说明，不能为了达到“没有数字”伪指标重写算法。

ParameterDefinition 不代替 command payload、selector 参数 schema、UI variable 或 serverSpaces。不给静态参数新增运行期 store/catalog、管理页面或远端覆盖机制。没有消费者的 errorDefinitions/parameterDefinitions 等 metadata 按实际用途派生或删除，不为保留字段补运行期目录。

## 3 · 外部 API、包闭环与装配

### R-07 · 外部 HTTP/WS API 包内私有

各包声明自己所需外部 operation；由本仓唯一 canonical/现有生成器按消费包输出内部 generated client/协议类型。包内生成并声明不意味着为每包创建生成器或另写 schema；公共执行/编码机制继续共享。

API client、业务 endpoint、网络请求封装不作为包根公共能力导出，不准跨包 deep import 调用。A 要执行 B 的业务，发 B 的 command，由 B actor 请求并提交；A 要读 B 的事实，用 B selector。公开业务类型可服务于 command/selector，不把其绑定成对外可调用的 wire client。

“包内 API”不允许 UI/assembly 直接请求后端绕过 actor，也不允许 selector 求值发 HTTP。单个包的 actor 可使用其私有调用封装，该封装复用通用 transport/认证命令或现有受控执行接缝，不恢复新业务入口。

TDC 自身保留激活/取消和 TDP 协议 API；store-basic 消费门店/合同/服务点 API；project-basic 消费项目/组织路径/规则 API；terminal-update 消费更新 grant/report；remote-control 消费远控 API。此为责任范围，详设逐 operation 根据真实调用链落位；同一 CBS operation 的确有多个业务消费包时可以各自生成私有描述，canonical 仍单源，不人为设置“一接口只有一包能用”的业务限制。

TDC 继续唯一持有凭证并提供公共认证/TDP 能力；业务 API 私有化不得复制凭证、修改 CBS 鉴权规则或恢复 X-Terminal-Device-Id 旧 HTTP 身份机制。共享认证接缝不得掌握全业务 operation 目录、解析门店/合同 path、改写业务请求或返回所有业务 DTO。配置选择/代理、request 关联、取消/超时/HTTP 完成事件复用现有机制。

WS 的连接资源仍按唯一 owner 管理；API 私有化不等于每 feature 再连一个 TDS。topic 订阅/版本通知/结果确认仍由 TDC 提供基础能力，业务数据读取与提交仍归各 feature。副机继续只持共享凭证请求 CBS，不独立连接 TDS。

### R-08 · 包的定义、行为与公开面自闭环

加载一个包的 module 即获得其声明的 commands/actors/selectors/state registrations；加载 UI 能力时能获得其 parts/variables/admin contribution 等既有呈现声明。不需要 App 手工重写包内 fact/part 映射、actor 处理、错误或同步资格名单。

module metadata 从本包实际 definitions/registrations 派生；不同时手写 commands/actors/slices 名单和 concrete definitions 两份事实。保留 brand、归属、重名、可见性和依赖校验。自动识别只消费显式加载的包，不扫描 workspace 自动启动包，不建立超级 registry。

通用激活/登录/业务页呈现 command 由对应 UI 包自身 actor 完成幂等路由。integration 仍决定整个 App 的业务阶段优先级，发各包公开 command；UI 包不知道其它业务包的完整 stage，kernel 不知道 UI part。

业务跨包写仍 command，读仍 selector；装配/provider 只绑定外部能力，不以 provider 把 B 的内部 API 或完整 state 暴露给 A。平台端口、通用传输、Runtime 执行和窄的只读声明视图属于既有基础设施接缝，不冒充第二业务协议。

### R-09 · 同步资格只声明一次

每 slice owner 唯一声明同步字段、方向、authority 和资格。Runtime/State 从已加载 modules 获取 registrations，topology 消费其只读资格视图，发送/接收沿现有 State sync 实现；删除两个 integration 的 stateSyncSlices 外部手写白名单。

非 sync/isolated、未加载、未知 slice 均不因收到 payload 被加入。MAIN/BRANCH、主/副机权威、credential-only projection、持久化与根级 reset 例外保持既有判据；不得全 slice 同步或反向覆盖 owner。

可同步全集不等于业务 required projections。某个用户行为必须等哪些投影，由该行为 owner/应用政策明示其真实前提；不能“等待全部同步包”，也不能删掉既有断链遮罩和本机 admin 恢复。

### R-10 · application/integration 装配只保留合法责任

App 输入以加载模块、应用主题/surface 与真正外部输入为核心：platform ports、native loading、App/version、持久化 namespace、package defaults、peer channel、network adapter 和获准 fixture provider。

通用 createIntegrationAssembly 可实现 Runtime/RenderProvider/StateSource/surface 生命周期和已加载声明合并，不能编码具体 feature 业务规则。两个 integration 的业务阶段 actor 保留，内部实现离开 application/module 描述文件；不把 integration 误当纯测试包。

update 的业务候选资格归 project-basic，执行前本机复核归 terminal-update；assembly 只绑定公开能力。跨 base owner 的配对/激活资格须依既有事实 owner 和窄公开接缝处理，不为消除输入 callback 制造依赖环或让 base 反依赖 feature。

## 4 · 环境、身份与既定机制

### R-11 · serverSpaces 和可变地址集合

每个运行入口按 package.json.serverSpaces 选取一份内置 defaults；不把多个入口 defaults 合并成新全局真相。server-config 继续负责有效配置、覆盖/清除、持久化/同步和合法性校验；transport 消费通用地址集合。

服务地址数量没有固定上限；非空服务地址集合必须支持一条、两条、十条等合法数量。删除 One/Two 专用参数、恰好替换两条的假设及 1～4 的旧限制；不在另一层悄悄重新设固定 N。保持现有 timeout/URL/唯一名称等有效性规则，不表示接受非法或重复地址。

受管环境输入按具名服务/地址集合匹配，不按数组位置猜测，不保留未替换的内置 DEV URL，不硬写某一集团路径或默认空间。DEV/UAT/生产地址各自由其配置提供；当前 DEV 两个受管 HAProxy 保持，不增建节点或服务发现。

同根影响须闭合 Android applications、Web test-expo、唯一 automation driver、DEV config producer、acceptance fixture 与实际生成/静态消费者。现有 loopback、tunnel、manifest/process identity 和 cleanup 边界保留。

### R-12 · 单一事实、符号和身份

module/command/actor/slice/part/topic/operation/error 身份从 owning 定义或 canonical/generated 引用；同一业务事实不同时维护字符串清单、复制 state 和另一个 registry。

App/package/native/protocol 版本是不同维度，不能因字段都叫 version 就合并。每种身份明确其来源与消费者，不再同一 App 的 assembly、TDC 和更新 readback 各猜不同默认值。transport profile/service/address 及 instance/workspace/display/surface 等也须先读派生和真实消费者，不能按相似词合并。

state 的 slice name、持久化键、sync payload 字段和 native 更新目录/action/boot 身份不能因文件移动随意变动。若实际职责重划确需变更持久身份，详设须明确本仓所有权及已有本地数据的处理，保留可读事实；不静默清除凭证/任务。不得为“无长期兼容层”擅自牺牲已有设备数据。

### R-13 · 全面复用和删除失效机制

逐包检查实际采用：errors/parameters、command/selector/part/UI variable 工厂、Runtime 注册/生命周期/resource cleanup、State persist/sync/reset、PortResult/unavailable、统一 logger、primitives/input、TestId、render/admin 和现有生成器。

为每个真实遗漏给出根因和目标落点。合法替代/无需要也必须说明，不以“每包必须有所有文件”验收。删掉已经失效且无消费者的机制，迁移全部当前消费者后删除旧内部入口，不并存两套行为或长期 fallback。

日志现行政策、公开 API 和规则例外从唯一正本读取；T1 不自行新增安全/保密规则。已有日志缺口在未来授权实施中按仓规修，不借“结构整改”删除 request/业务失败的诊断。

### R-14 · 四层、原生和生成边界

kernel 保持 React/Expo/native-free；adapter 只翻译平台能力和持有该能力资源，不拥有终端业务事实；application 注入平台实现及身份；UI 呈现只消费 owner 能力。ui-state 留 kernel，render 留 UI。

拆包以真实独立职责和依赖方向为依据，可以重组但不添加仅作转发的包。原生双屏、更新和远控同样要明确事实/资源住址，不复制 SDK 或系统状态为第二业务账本。

generator 保留仓根/符号链接输出校验、canonical 来源和实际消费者覆盖；生成物只由原生成链产生。新 private API 输出和 declarations 目录应同步生产者、导出边界、检查器及类型消费者，不手改 generated 绕过。

### R-15 · 规范、说明和内部可维护性一并交付

未来实施须同步 terminal-coding-standard 的目录/公开边界规则、适用模板与 routed memory 指针、真实静态门/红夹具、package exports/dependencies、terminal-invariants、README 和 API 用法。只修改本仓当前正本及明确获准 successor，不改冻结 Heritage。

README 中文说明定位、作用、目录单元、公开 command/selector、内部 API、外部输入、生命周期/失败和如何扩展；示例必须符合当前源码。module identity/依赖/root barrel 保持清楚，不能在根 index.ts 实现 native/业务调用。

机械门只判路径/类型/import/export/确切结构，用真实反例；职责和业务语义由代码 review 判断。复用已有门，不增加全文件 hash 台账、per-edit receipt、泛化流分析或维护成本高于问题本身的控制面。

## 5 · 详设和未来实施的交付要求

### R-16 · 详设必须把重构接缝写清

详设从本需求、当前 owning source、原业务要求和项目约束推导，不照抄讨论建议函数名。至少明确：全包职责结论、目标目录/依赖、包内 module 声明收口、私有 API operation 分配/生成链、认证与 transport 复用、sync qualification 与业务 readiness 分开、地址 producer→resolver→owner→consumer、错误/参数消费、状态/持久身份保持、native/测试/文档同步面。

列出实际会改的能力与受影响调用者，未决产品项不留给实施猜。行为不变的内容引用已有判据；确需改变产品语义时先交 Dexter。不要求重绘未变化的业务 UI，模板槽位按内容给有据 N/A；不能用没有新页面跳过已有 Journey 行为回归设计。

### R-17 · 验证有效性、顺序与诊断

验收必须证明生产接缝而非测试内另写实现：包内 actor 请求私有 API、command/result/selector、Runtime 注册、真实 State descriptor/sync、配置变动到请求目标和失败恢复。反例按本稿 §6 的常见行为设计，不扩为恶意归档、长期容量或极端故障专项。

未来非 adapter 行为遵循 TR-16：两个 integration Expo Web 先行，再对受影响 application/设备使用同一场景清单；adapter-only 行为具名说明执行面，不能靠 Web fixture 冒充 native。自动化只用当前 terminal-automation/agent，旧 runner 不恢复。具体设备拓扑、环境/data 操作和运行范围由后续详设提出并获得明确实施授权；本需求不隐含授权设备矩阵或 reset/seed。

动态前必须按现行日志正本给整条实际链路配置必要关联诊断并做两轮 TEST_CHAIN_PREFLIGHT fresh 证伪；满足同链路、日志后字节条件的既有审查可复用，改动只复核实际影响面，不重复已完成的未改内容。首败读日志、定位边界、最小修复、focused 复验后再继续，禁止盲目往复重跑。

整批要求不以局部 typecheck/单测、历史动态或机械 source 清单代替。CP 对账单位是完整批准 CP，不为每个文件再开关卡；全批 review 按实施规范完成。相关 proof 与必要回归足够即推进，不扩大默认全仓 verify 或无关设备矩阵。

## 6 · 必须包含的验收场景

以下是未来详设/实施的最低场景，不是已执行证明。F=当前生产源码上的编译/类型/直接单测/静态反例；W=integration Expo Web；D=对应 application/设备；C=契约生成链检查。每个 V 均须在详设绑定生产 owner、入口、业务/结构断言和适用执行面；F 不自动代表 W/D。

| ID | 条款 | 动作/反例 | 预期结果/最小证明 |
|---|---|---|---|
| V-01 | R-02/R-14 | 从所有当前包展开能力、入口和依赖 | 每段手写逻辑可归因，generated/vendor/test 分开；无漏包，无第二真相计数门 |
| V-02 | R-03/R-04 | 查多个 actor/slice/公开 selector 定义及大单 actor；复验其 command | 具名分文件，实际责任清楚；资源和并发语义未被复制（F） |
| V-03 | R-03/R-15 | 改 declarations 后检查根导出、依赖和目录规则；非法旧组织反例 | 生产形状与唯一规范一致，空目录不作为完成；现有机械门可抓对应反例（F） |
| V-04 | R-05 | 用户配置非法/业务拒绝，另作构造错误/native失败 | 保留不同错误类别与用户恢复，普通 Error 不误报可预期拒绝；AppError/PortResult 各在正确边界（F/W） |
| V-05 | R-06/R-12 | 选择实际 timeout/retry 参数，在合法覆盖和默认值下消费 | 同一静态定义，单位正确，非法外部覆盖拒绝；无动态 catalog；协议常量未变可调（F） |
| V-06 | R-07/R-14 | 包内调用 generated API；包 A 尝试根导入/deep import 包 B 的 client | B 内可用、跨包 callable API 被当前边界检查/类型构建拒绝；canonical 和 private输出一致（C/F） |
| V-07 | R-07/R-08 | A 发 B command，B actor 调自身 HTTP，A 读 B selector；模拟拒绝/网络失败 | 结果与状态符合 owner 规则；A 未绕过；认证/配置/取消/关联仍复用（F/W） |
| V-08 | R-07/R-14 | 检查 store/project/update/remote 各 API 及 TDC 自身 API | 无 TDC 全业务 client 导出/operation 解释；无重复凭证和 WS 连接；transport仍业务无关且 owner定位不变（C/F） |
| V-09 | R-08/R-10 | 将完整包加入 module 输入，触发其 UI command；移除该包 | 加载即带本包声明/actor/selector/parts；移除无孤立贡献；没有 App 第二名单（F/W） |
| V-10 | R-08/R-12 | 重复 module/command 身份、描述与 concrete definitions 不一致 | 从实际定义派生并拒绝真正重名/非法归属；不悄悄忽略，结果可诊断（F） |
| V-11 | R-09 | 加载已有及新增 fixture sync slice、isolated slice、未知 payload | eligible 来自 registration，不改 assembly白名单；isolated/未知拒绝或跳过并诊断；方向保持（F） |
| V-12 | R-09/R-10 | 同 App 主副机投影、断链、恢复和未达业务 required projection | 资格与业务ready分开；不因无关 sync 阻塞，不绕过现有遮罩/admin恢复（F/W适用部分/D配对部分） |
| V-13 | R-11 | 同解析路径配置 1、2、10 个具名地址；重复名称/非法URL | 合法集合完整消费，无 One/Two 或4条上限；非法配置整次拒绝；轮转沿既有能力（F/W） |
| V-14 | R-11/R-12 | 两 App 的 Web/Android入口消费环境配置、切换空间/覆盖地址 | 请求目标、代理、身份与当前配置一致；无残留默认DEV地址/错误集团；DEV拓扑不扩张（F/W/D适用接线） |
| V-15 | R-09/R-12/R-14 | 分别验证正常重启/恢复、角色切换、明确解绑/换主清理、取消激活根reset；每种事件单独判定 | 合法恢复不得意外丢失该事件允许保留的事实；解绑/换主按既有规则清除相应共享凭证并flush；取消激活根reset清TDC凭证及其它非retain事实，仅保留既有server-config/terminal-update的persisted retain字段；不出现第二boot/state（F/D适用native） |
| V-16 | R-08/R-10/R-17 | 两 App 激活→登录→业务、会员确认/壁纸选择、本机admin | 真实公开command/selector闭环，原页面及权限行为保持，通用包无需外部补实现（F/W/D同清单） |
| V-17 | R-04/R-07/R-12 | 受影响 TDP/topic数据刷新、更新FULL/HOT接续、远控开始/输入/结束 | 以既有需求的真实行为作回归，不只看request.ok；覆盖哪些子行为依影响面说明（F/W或D） |
| V-18 | R-13/R-15/R-17 | 全包公共用法与README/结构门/生成器/automation consumers对读 | 未用机制合理删除或说明，未来能力扩展只改owner；无旧入口并存、无旧runner回潮（C/F及静态review） |

仅列 TestId、HTTP 200、字段存在或 fixture 自己实现同步，不符合上述验收。V 中的 W/D 和资源 cleanup 当前均为 NOT_RUN。

## 7 · 事实档位、风险和未决项

### 7.1 · 静态起点

讨论稿已定位：integration 同步白名单；AppModule/RuntimeModule 描述双写；TDC 集中 generated API 且根导出；固定 One/Two 地址输入和旧4条限制；error 工厂使用少、参数工厂无生产调用；大单元和 README 示例漂移。它们是调查入口，不替代重新读当前 owning source。历史代码摘要只说明参考时间点。

### 7.2 · 需在详设关闭的实现决策

module contributions 的最小类型和初始化顺序；认证执行接缝；每个 operation/生成目标/消费类型；有状态辅助单元住址；native classes 内部拆法；必要的持久身份处理；实际静态门更新和验证命令；W/D设备与拓扑范围。均属于下一阶段设计义务，不允许只写“实施自行发挥”。

没有新的未决产品裁决：declarations、静态参数、可变地址数量、API私有边界、transport定位均已有输入。若读源码发现必须改变业务准入、页面流程或持久数据含义，列出具体反例和候选交 Dexter，而非默认重构许可。

### 7.3 · 当前证据与批准范围

本稿只接受正式需求静态审查。UI 无新页面/交互，需求审查可对 UI 模板有据 N/A；既有 UI/业务保真属于未来实现 proof，不是已通过。生成、编译、测试、verify、W/D/DEV/seed、cleanup 全为 NOT_RUN。

正式需求静态 GO 不意味着代码已经符合它，不授予下一阶段实施；独立报告必须分别记录需求可接受性和上述未运行范围。

## 8 · 原始方向到条款的闭合

| 原始方向 | 需求 | 最低验收 |
|---|---|---|
| 1 单文件与共享行为 | R-03/R-04 | V-02/V-03 |
| 2 错误盘点与抽取 | R-02/R-05 | V-01/V-04 |
| 3 静态参数/definition | R-06 | V-05 |
| 4 机制采用 | R-13 | V-18 |
| 5 集中声明 | R-03 | V-03/V-09 |
| 6 自闭环与装配 | R-08/R-09/R-10 | V-09～V-12/V-16 |
| 7 可变地址与环境 | R-11 | V-13/V-14 |
| 8 每包每逻辑、多真相 | R-02/R-12/R-14/R-15 | V-01/V-15/V-18 |
| 补充 私有API＋command/selector | R-07/R-08 | V-06～V-08 |

本稿不替代详设、计划或当前在途交付的既有授权。
