# TER sample UI 能力与体验 implementation-facing 详设

DESIGN_GRANULARITY=implementation-facing
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
BUSINESS_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md
JOURNEY_REFS=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md#13-我替-Dexter-做的裁定
JOURNEY_SOURCE=doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md
IA_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md
AUTHORIZED=写详设、交互工件、IA 与实施计划
NOT_AUTHORIZED=生产代码、测试、依赖、Android/Web 运行、DEV、seed、UAT、部署
IMPLEMENTATION_AUTHORITY=false
DESIGN_STATUS=READY_FOR_IMPLEMENTATION_INPUT

## 1. 真实业务目标与方案比较

### 1.1 结构性问题

当前 sample 的主要缺口不是缺少漂亮样式，而是三类能力没有统一 owner：

1. primitives 原有八个无样式的裸 RN wrapper，统一 testID 已存在；本次另经授权新增一个
   仅含 `testID` 与 children 的受控 `PrimitiveScrollView`。RNR/NativeWind
   内胆、theme token 和 automation 挂点没有形成可扩展的控件边界。
2. LayerStack 目前按树顺序渲染，缺少覆盖、模态阻挡、遮罩、返回键和焦点地板；
   业务层一旦增加确认弹窗，就会各自重复这些行为。
3. sample 的失败、撤回、拒绝、空态和单屏恢复没有完整地回到可继续状态。

不做的后果是：自动化可寻址性依赖每个业务作者手工记忆；视觉/交互行为在两个
feature 中分叉；基础设施 rejection 会清掉 loading 后静默回到 idle；双屏与单屏
会出现不一致的操作分母。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
|---|---|---|
| A. 继续在每个 feature 里直接写 RN、各自处理 layer 和 theme | 最短期改动小，但复制 testID、遮罩、返回键和失败呈现；覆盖率随业务量下降 | 拒绝，因为不能解决 §4-C 的根因 |
| B. 建一个跨应用通用 design-system/theme/automation 大包，一次性承载所有 Journey | 能集中能力，但主题被错误提升为共享事实，且把尚未观察到的业务重复提前抽象 | 拒绝，因为扩大边界、违反应用主题归属和先见重复再下沉 |
| C. 采用四段地板：NativeWind 工具链 → primitives 内部 copy-in RNR → app-local theme + render overlay → feature-local Journey 控件和 actor | 能力路径单一；既有八个 public contract 不变，并以受控滚动 primitive 承载唯一滚动祖先；业务语义留在 feature；每段有独立红向量 | 采用 |

我选了 C 而不是 A/B，因为它直接解决“谁默认提供可寻址和呈现能力”的结构问题，
同时不把 theme 或尚未形成重复的业务组合组件提前提升为共享 owner。

### 1.3 已知输入矛盾，不在详设中悄悄修正

交互源 §11.1/§12.1 写“层由三个增至六个”，但同一份文档明确给出两个
system-notice partKey：

- sample.auth.system-notice
- sample.desk.system-notice

按正式 partKey 复算，layer 语义类型为 6，layer partKey 为 7。这个结果不是
详设任意改名，而是由 J-1 两个 feature 不互相 import 与正式 partKey 共同决定。
本详设把 type=6、partKey=7 双分母固定下来；Dexter 已解除 source input gate，
CP-4 直接以这两个分母作为唯一实现输入。

noticeDismissedCommand 的裁定落在详设：member-desk 的旧命令删除，不复用给
system-notice。原因是它原本表达 registry-notice 的“知道了”路径，而新 system
notice 是每个 feature 自有语义；复用旧名会把不同失败 owner 重新合并。保留的
底层 closeLayerCommand 仍是 ui-state 的通用关闭能力；staff-auth 已有的
authNoticeDismissedCommand 不改名。新增的 systemFailureObservedCommand 与
systemFailureDismissedCommand 各 feature 各自拥有。

另有一处冻结输入需要在实施前修正文案：交互源的单屏 interaction map 旧行写成
`confirm/reject→list`，但当前 owning actor 的拒绝链是“打开
`registry-notice`，单屏保持/回到 `member-form`，再由 retry/abandon 决定去向”。
本详设采用后者，因为它保留已裁定的两个出口；这不是实现期自行改 Journey，
而是把输入与 owning source 的冲突显式阻塞在 CP-4 前。

## 2. CP 总览

| CP | 主题 | owner | 主要输出 | 依赖 |
|---|---|---|---|---|
| CP-1 | NativeWind/Tailwind 工具链与 Android 显示基线 | sample-console / sample-terminal owner | 本机解析值、Web/Android 接线、横屏、甲档沉浸、Presentation 铺满 | 无；必须先证明版本兼容 |
| CP-2 | primitives 的 RNR copy-in 内胆 | ui-base-primitives | 八个既有 public contract 的 RNR 内部实现，加一个受控 `PrimitiveScrollView`，强制 testID、token 接缝 | CP-1 工具链 |
| CP-3 | app theme 与 render layer 地板 | sample-console theme / ui-base-render | base tokens、app-local theme、overlay/modal/back/focus | CP-2 public contract |
| CP-4 | Journey 重梳、feature-local 控件与闭环 | 两个 ui/feature + sample-console | 12 个 catalog part、15 IA 视图、单/双屏 actor 链、失败和恢复 | CP-3；且需先修 layer 分母文字 |

段 4 的交互设计可以在 CP-1 至 CP-3 实施前静态准备；其实现不得跳过 CP-3，
因为确认层视觉覆盖和返回键是 Journey 的基础行为。

## 3. 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
|---|---|---|---|---|
| 读侧节点授权 | kernel feature selector、ui-state selector；路径见 IA | focused test 读取唯一 selector；源码无业务 mirror | N/A：本地 sample 无跨租户授权 | member list、pending、session、ui variables |
| 写授权与 grant 复核 | kernel feature public command；TR-11/TR-12 | 事件/actor focused test；组件不直接写 slice | N/A | login、submit、confirm、reject、withdraw、abandon |
| 跨 owner 写与事务 | kernel actor dispatch；本批无数据库事务 | 静态核对 feature actor→kernel command；运行时命令结果测试 | N/A_WITH_REASON: sample 无跨 schema/DB | member-desk→registry、staff-auth→session |
| 集合形态与分页 | IA collectionShapeAndScale；member selector | 0/1/many fixture；列表唯一滚动；不声称分页 | BOUNDED_SAMPLE，禁止把 sample 规模当生产上限 | member registry |
| 缓存失效 / 改完刷新什么 | runtime subscribe + ui-state selector | command 后重新观察 list/pending；没有 query cache | N/A：无远端 query cache | confirm、reject、withdraw、abandon |
| RTK 数据读取与加载判定 | NOT_APPLICABLE_WITH_REASON：TER runtime 不用 RTK | 静态检查无 RTK import | N/A | 全部 terminal UI |
| 同一事实只有一个住址 | runtime state / ui-state variables / selector | 同一事实变异 red vector；无 feature 私有镜像 | N/A | member、pending、session、surface placement |
| 失败可见且原因不得改写 | useDispatchCommand diagnostics + feature catch + system notice | 必然 reject focused test；断言 loading 先清、notice 可见、raw error 不进 UI | 若观察命令也失败，只结构化诊断且不递归 | login、submit、confirm、reject、withdraw、logout |
| owner 错误到 HTTP 映射 | NOT_APPLICABLE_WITH_REASON：无 HTTP | 不把本地 runtime error 冒充 HTTP problem | N/A | 全部 |
| 幂等键构成与重放 | createRequestId、dispatchWithRequestId、pending existence | public command 缺 requestId red；双击/迟到命令 no-op | 不新增全局幂等层 | 所有 feature-owned public command |
| 该用生成物的地方不得手搓字符串 | TypeScript public exports、package.json terminalSurfaces | public export/invariants/README 对账；不复制 surface 字段 | N/A | package public surfaces |
| 日志落点与脱敏字段 | AGENTS.md observability；render reportRenderCommandDispatchRejection | 失败 focused test 检查 operation 诊断；日志不含 raw error/payload/phone | 只记录 operation、commandName、requestId 与错误类别 | system failure、host failure |
| 迁移回填与可逆性 | NOT_APPLICABLE_WITH_REASON：无数据库 schema | 文档列 N/A；不得新增 migration/seed | N/A | 全部 |
| 前端共享行为 | ui-base-render LayerStack、SurfaceRoot、useTrackedRequest | render focused test；业务包不复制 overlay/back/focus | 新 render 能力必须是窄、业务无关 API | LayerStack、所有 layers |
| 候选/下拉数据源 | NOT_APPLICABLE_WITH_REASON：无候选控件 | IA 明列 N/A | N/A | 全部 |
| 编码与名称呈现 | primitives public contract、integration app theme | 原始 part/catalog 与用户文案对账 | theme 只在 ui/integration/sample-console | 全部 user-facing surfaces |
| 同时坏的东西原子组 | 每个 CP 的三维对账与停止条件 | 任一 CP 的 focused proof/静态对账失败即停 | 不拆出“先绿后补”子任务 | CP-1 至 CP-4 |

## 3a. L2 脚本开发前 UI/testID 前置复核

本批不授权浏览器自动化或 L2，因此不创建 L2 binding。仍必须给 focused/static
动作分母，未来若另行授权 L2，必须沿真实控件节点绑定，不得用文字或父容器替代。
本批不创建 app `*TestIds.ts` 常量，也不把 design-time testID roster 误报为 L2 ready。

```text
UI_DESIGN_REVIEW=PASS
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON:本批不授权L2/浏览器自动化；testID只冻结真实动作身份
L2_SCRIPT_ADMISSION=BLOCKED
```

| case/action | 用户控件与动作 | UI owning source | testID source | 实际动作节点 | focused/static proof | 结论 |
|---|---|---|---|---|---|---|
| login | 工号、密码、登录 | sample-staff-auth components | feature testID roster | Input/Input/Button native node | StaffLogin focused | DESIGN_ONLY_L2_BLOCKED |
| member form | 姓名、电话、提交、取消 | sample-member-desk components | feature testID roster | Input/Button native node | MemberForm focused | DESIGN_ONLY_L2_BLOCKED |
| customer decision | 确认、拒绝、交还 | CustomerMember | feature testID roster | Button native node | CustomerMember focused | DESIGN_ONLY_L2_BLOCKED |
| layers | retry、abandon、keep、discard、withdraw、dismiss | feature layer components | feature testID roster | Button native node | layer focused | DESIGN_ONLY_L2_BLOCKED |

## 4. 每个 CP 的门控

### CP-1 工具链与显示基线

未来实施顺序：

1. 只在本机解析当前安装的 NativeWind、Tailwind、Expo 57、RN 0.86.3 版本；
   将 package manager resolved version 与 Expo/RN peer range 写入 CP evidence。
2. 在 sample-console 工程接入 Metro/Babel/Tailwind；真实 primitive 的 className
   只在 primitives 内部使用。
3. app.json 使用 landscape；不直接编辑生成 AndroidManifest。
4. 主屏与 TerminalPresentation 都启用甲档沉浸式全屏；Presentation window 填满
   target Display；不启用 lock task。

通过条件：一个真实 primitive 在 Web 与 Android 受 className 驱动；接线移除的红
变异导致样式失效；主屏横屏、主副屏系统栏隐藏、Presentation 铺满。

停止条件：本机解析值不能证明兼容；为接线修改 kernel port；需要业务包感知
surfaceMode；不能解释启动错误；或只能靠旧 POC 的独立 VM/进程形态。

### CP-2 primitives RNR 内胆

预计实施文件：

- apps/terminal/ui/base/primitives/src/components.tsx
- apps/terminal/ui/base/primitives/src/index.ts
- apps/terminal/ui/base/primitives/src/rnr/
- apps/terminal/ui/base/primitives/test/primitives.test.tsx
- apps/terminal/ui/base/primitives/README.md
- apps/terminal/ui/base/primitives/terminal-invariants.json

形态：

- RNR 源码 copy-in，不声明 RNR workspace dependency；
- 八个既有 export 名和 props 语义保留；另增 `PrimitiveScrollView`，只接受强制 `testID` 与 children，作为 feature 滚动区域的唯一公共滚动祖先；
- 每个 export 必须经过统一 assertTestID，再把 testID 挂到真实 RN 节点；
- className 只存在于 primitives 内部，ui/feature 生产源码零命中；
- automation backend 仍押后，但将来挂点不能有绕过 API；
- 不在本 CP 新增业务控件。

通过条件：八个既有公共 export 加受控滚动 export 的集合、invariants、README 对齐；空/空白 testID
仍抛；RNR 内部 token 能改变真实 primitive；业务 feature 无 className。

红向量：移除任一 assertTestID 旁路、把 className 写入 feature、把 RNR dependency
加入 package.json、把 Primitive props 改为业务字段，均必须失败。

停止条件：RNR 迫使公共 contract 改名或 testID 旁路；无法在不新增依赖边的情况下
copy-in；需要把业务语义塞进 primitives。

### CP-3 theme 与 render layer

预计实施文件：

- apps/terminal/ui/base/primitives/src/theme/
- apps/terminal/ui/integration/sample-console/theme/
- apps/terminal/ui/integration/sample-console/src/assembly.tsx
- apps/terminal/ui/base/render/src/components/LayerStack.tsx
- apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx
- apps/terminal/ui/base/render/src/types/catalog.ts
- apps/terminal/ui/base/render/src/hooks/ 或对应窄 hook 文件
- apps/terminal/ui/base/render/test/

规则：

- base tokens 只在 primitives；
- app theme 永远在 sample-console/theme，不建 ui/theme；
- theme 不包含业务文案、command 或 actor；
- LayerStack 绝对覆盖 surface、阻挡底层、渲染遮罩、处理 Android back；按本机
  RN 0.86.3 的真实 API 从 `TextInput.State.currentlyFocusedInput` 记录打开前焦点，
  将焦点送入可聚焦的 top layer wrapper，并在最后一层关闭后恢复；无 target 安全 no-op；
- layerTier 继续只表示排序覆盖优先级；guard 是独立的 dismissible/decisive 维度；
- render 不知道业务 catalog 的语义，不返回 promise，不提供 await showDialog；
- 业务确认仍派 feature-owned command。

通过条件：standard 与 alert 的 z/覆盖关系可由 focused test 观察；decisive
遮罩/返回键不能绕过；dismissible 可以关闭；打开/关闭 focus 语义有可执行测试；
app token 改变能改变最小 primitive。

红向量：把 LayerStack 改回正常 flow、把 decisive 改为 dismissible、把 alert
放到 screen 后、把业务错误映射写入 render，均必须被测试或静态门抓住。

停止条件：需要 render import feature/catalog；不能同时满足遮罩语义和树稳定性；
或 focus/back 只能由每个业务层重复实现。

### CP-4 Journey 与体验闭环

前置：CP-3 完成；采用已由 Dexter 解除的 layer type=6、partKey=7 双分母；T-1
比例门仍未裁定时不建立该门。

预计修改/新增 owning source：

- apps/terminal/ui/feature/sample-staff-auth/src/commands.ts
- apps/terminal/ui/feature/sample-staff-auth/src/module.ts
- apps/terminal/ui/feature/sample-staff-auth/src/parts.ts
- apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts
- apps/terminal/ui/feature/sample-staff-auth/src/components/
- apps/terminal/ui/feature/sample-member-desk/src/commands.ts
- apps/terminal/ui/feature/sample-member-desk/src/module.ts
- apps/terminal/ui/feature/sample-member-desk/src/parts.ts
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
- apps/terminal/ui/feature/sample-member-desk/src/components/
- apps/terminal/kernel/feature/sample-member-registry/src/commands.ts
- apps/terminal/kernel/feature/sample-member-registry/src/module.ts
- apps/terminal/kernel/feature/sample-member-registry/src/features/actors/actors.ts
- apps/terminal/kernel/feature/sample-member-registry/src/index.ts
- apps/terminal/kernel/feature/sample-member-registry/test/
- apps/terminal/kernel/feature/sample-member-registry/README.md、terminal-invariants.json
- 两个 feature 的 test、README、terminal-invariants 与依赖声明
- sample-console 的 assembly、theme、focused test

四个新组合控件先落 feature：
DialogSurface、DialogActions、EmptyState、ScrollArea。它们不是 primitives
公共面；props 只能描述呈现，不接 intent、guard、reasonCode、mode、command。
若两个 feature 在本 CP 结束后真实重复，再另起批次评估下沉。

命令/actor 形态：

| feature | 保留/新增 command | listener owner |
|---|---|---|
| staff-auth | 保留 authNoticeDismissed；新增 authSystemFailureObserved、authSystemFailureDismissed | auth result / auth system notice actor |
| member-desk | 保留 memberFormOpened；删除 noticeDismissed；新增 memberFormCancelled、memberDraftDiscarded、memberSubmissionWithdrawn、memberRegistrationRetryRequested、memberRegistrationAbandoned、deskSystemFailureObserved、deskSystemFailureDismissed | form/navigation/pending/rejected/system actor |
| kernel features | 不新增 UI command；registry 仅补 owner-owned withdraw business command/event | 继续由 registry/session owner 决定业务事实；UI 的 `memberSubmissionWithdrawnCommand` 仍留在 member-desk |

请求结果与失败形态：

`dispatchWithRequestId` 的返回值不是只有 Promise reject。依据
`apps/terminal/kernel/base/runtime/src/types/execution.ts` 的 `CommandDispatchResult`，
必须同时处理 `status=running|completed|error|timed-out|partial-failed`；`running` 是
非终态，actor error 会被
`createCommandDispatcher` 收进 fulfilled result，只有 dispatcher/ledger 等边界仍会
以 Promise rejection 离开。

1. 业务部件 start requestId，派业务 public command。
2. `status=completed` 才进入成功路径；先 finish 原 requestId。
3. `status=running` 是非终态：不 finish 原 requestId、不记录失败诊断、不打开
   system-notice；保留 requestId，让 request ledger 的后续终态观察决定 loading 与结果。
   该状态不是凭空增加的兜底值：`aggregateCommandStatus` 在
   `completedAt === null` 或任一 actor 仍为 `running` 时明确返回它；
   `createCommandDispatcher` 的正常 `dispatchInternal` 会等待 actor 终态后再发出
   `command.completed`，因此一次正常、完整的直接 dispatch 通常返回终态。`running`
   仍可由 request ledger 的中途观察、peer/持久化回放或不完整的生命周期观察得到，
   所以 selector 与 feature 分类必须保留这条非终态分支；不能把它压进失败兜底。
4. resolved 的 `error`、`timed-out`、`partial-failed` 先 finish 原 requestId，再按 feature 的有限分类表处理：
   - 已知业务失败：`actorResults[].error.category` 为业务允许的
     `AUTHENTICATION` / `BUSINESS` / `VALIDATION`，且同一次 dispatch 已产生对应的
     owner domain event/state（例如 `loginFailedCommand`）。沿既有 auth/registry notice
     路径，不再开 system-notice；没有对应 domain event 的未知业务形状不得静默。
   - 基础设施失败：`SYSTEM` error、`timed-out`、含 system actor 的
     `partial-failed`，或 Promise rejection。生成新的 observation requestId，派本
     feature 自有 observation command。
   - 其他确实未知的非 completed 结果（不包括已明确处理的 `running`）：按 system
     failure 处理并记录 operation；实现不得把原始 error 或 actor result 塞进 UI，若
     无法证明分类则停止交 Dexter，不自行添加新业务语义。
5. Promise rejection 也走第 4 步的基础设施分支；`useDispatchCommand` 的既有日志只
   负责诊断与 rethrow，不取代 feature 对 fulfilled failure 的分类。
6. observation reject 只通过已有结构化诊断记录，禁止递归观察；原始 rejection
   继续抛回，不伪装成功。system notice props 只含允许列表中的 operation；不含原始
   error、payload、手机号或设备标识。

显示分支：

- actor 读取 display-context 的 hasSecondarySurface；
- 双屏 pending：PRIMARY member-list + waiting layer，SECONDARY customer confirm；
- 单屏 pending：PRIMARY customer-member mode=handheld-confirm；
- 只有双屏 pending 的撤回按钮可开 withdraw-confirm；
- 组件源码只分支 mode，不读取屏数；assembly 不手抄 PRIMARY/SECONDARY 推导。

通过条件：12 个 catalog part、15 个 IA 视图、7 个 layer partKey 全注册；场景
1–9 的成功/拒绝/撤回/退出/失败路径 focused proof；resolved `error/timed-out/partial-failed`
与 Promise rejection 两类失败均可区分，业务失败不会重复开 system-notice；单双屏操作分母分别可证伪；
真实 production tree 零 className、零裸字符串控件、零 feature 直连 React Native。

红向量：

- 删除任一新命令的 module registration；
- 让单屏 render SECONDARY 或显示 withdraw-confirm；
- 给 CustomerMember 加屏数判断；
- registry notice 恢复 dismiss；
- system observation 不带 requestId；
- finish 放回 finally 导致失败观察前 loading 未清；
- 用 raw error/payload 填 system notice；
- 两个 system-notice 合并成一个跨 feature import。

停止条件：输入分母未修正；任一单屏/双屏语义只能通过组件读屏数完成；
基础设施失败仍静默；需要让 render 依赖 feature；或需求判据无法在不改语义下成立。

## 5. operation / path / face / 集合形态

本批没有 HTTP operation、数据库表、迁移、seed 或后台 consumer face。

| 业务意图 | operationId | method/path | face | 集合形态 | 预期规模与增长驱动 |
|---|---|---|---|---|---|
| 登录、登记、确认 | N/A | N/A | terminal sample | 本地 command / bounded sample collection | member fixture 0、1、many；无生产规模承诺 |

## 6. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
|---|---|---|---|---|
| display topology | display-context readDisplayInfo | actor reads once per decision | actor chooses screen/mode | single/double focused |
| customer mode | IA/props contract | showScreen props | CustomerMember branches only on mode | S-16 focused |
| layer partKey | feature parts | openLayer payload | renderer catalog/LayerStack | partKey exact set |
| layer guard | part metadata/renderer binding | render catalog | backdrop/back behavior | decisive red |
| testID | primitive/feature roster | component props | native action node | focused + static |
| requestId | createRequestId/dispatchWithRequestId | command options | runtime ledger/useRequestInFlight | missing-id red |
| system operation | allowlisted feature string | observation command props | system notice copy | raw error red |
| member collection | registry selector | runtime subscribe | MemberList/Customer pending | 0/1/many |
| theme token | primitives base / app theme | NativeWind class path | primitive render | token mutation red |
| Web canvas size | sample-console terminalSurfaces | host layout | test-expo preview | flex-to-fit red |

## 7. 业务规则与 owner 判定

| 规则 | owner 判定点 | UI 只能做什么 |
|---|---|---|
| 登录凭据 | sample-staff-session | 收集输入并派命令 |
| 成员是否 pending | sample-member-registry | 显示 selector 结果 |
| 确认/拒绝先后 | registry command owner | 禁用重复点击，不能决定事实 |
| 单/双屏 mode | sample-member-desk actor | actor 选择 props，组件不读设备 |
| layer 可否绕过 | part guard + render | 声明 guard，不自行接遮罩 |
| 失败是否呈现 | feature component/actor | 观察 rejection、打开 feature-owned notice |
| 主题/尺寸 | integration theme / terminalSurfaces | 消费 token，不硬编码 surface 尺寸 |

## 8. owner API 与消费者

| owner API | 消费者 |
|---|---|
| loginCommand / logoutCommand | StaffLogin、MemberList |
| submitMemberCommand / confirmMemberCommand / rejectMemberCommand | MemberForm、CustomerMember |
| selectors selectMembers / selectPendingMember | MemberList、CustomerMember |
| showScreenCommand / openLayerCommand / closeLayerCommand | feature actors |
| readDisplayInfo / resolveSecondarySurfaceAvailable | feature actor / integration assembly |
| resolveSurfaceDisplayMode | integration surface creation only；feature actor 不消费 |
| createRequestId / dispatchWithRequestId | all public action components |
| useTrackedRequest / useRequestInFlight | tracked action components |
| terminalSurfaces | sample-console host only |

## 9. 变更同步矩阵

| 变更事实 | 契约/生成源 | owner/source | UI surface/state | focused/static proof | 结论 |
|---|---|---|---|---|---|
| 8 个既有 primitives 加受控滚动内胆 | primitives public index | primitives components | all features | primitive contract test | CP-2 同步 |
| app theme | sample-console theme files | integration app | primitives consumer | token mutation | CP-3 同步 |
| layer overlay | render types/LayerStack | ui-base-render | all layers | render focused | CP-3 同步 |
| system notice | feature command/part/module | two ui features | auth/desk layers | reject focused | CP-4 同步 |
| customer modes | customer-member props/part | member-desk actor | secondary/primary | mode focused | CP-4 同步 |
| layer part denominator | requirements + interaction + IA | all parts | S-15 reports | exact-set static | 输入修正后同步 |

## 9a. 实施前全链同步变更清单

| 变更事实 | 契约/唯一生成源/生成物 | owner 与实现路径 | surface/state | focused/static proof | 结论 |
|---|---|---|---|---|---|
| primitive public contract | primitives src/index.ts 与 terminal-invariants.json | ui-base-primitives/src/components.tsx | 所有 feature component | public export exact set、testID red | 同步修改 |
| layer catalog | feature parts.ts、render catalog | 两个 ui/feature parts/assembly | ui-state layer state | partKey/type 双分母 | 同步修改 |
| command allow-list | feature commands.ts、module.ts | feature actors | runtime command ledger | missing registration/requestId red | 同步修改 |
| customer mode | CustomerMember props + actor showScreen | member-desk | PRIMARY/SECONDARY | three mode focused | 同步修改 |
| system failure observation | feature commands/module/actor | render rejection producer + feature actor | system-notice layer | deterministic reject focused | 同步修改 |
| app theme | sample-console/theme | integration app | primitives render | token mutation | 同步修改 |
| Web canvas | sample-console package terminalSurfaces | test-expo host | fixed target canvas | flex-to-fit red | 同步修改 |

## 10. 数据、迁移与 seed

本批没有数据库、HTTP、migration 或 seed。member registry 的 sample state 继续
由既有 runtime/fixture 提供；不新增 seed，不把 UI 视觉事实写入 kernel state。

### 10b. seed 数据

SEED_STATUS=NOT_APPLICABLE_WITH_REASON
REASON=本专题只改 terminal UI 能力、runtime layer 呈现和 sample-local ui-state；
不新增数据库事实、不新增 HTTP 事实、不改变 kernel feature 的持久化 schema。
禁止以 seed 数据代替 UI focused fixture，也禁止执行 seed。

## 11. 验收场景与红向量

| scenario | owner files | identity | fixture | business oracle | red vector |
|---|---|---|---|---|---|
| CP1 class path | primitives + host config | real primitive | token fixture | Web/Android class affects output | remove Metro/Babel path |
| CP1 display | app.json + Presentation | PRIMARY/SECONDARY | target surfaces | landscape/immersive/fill | remove each native setting |
| CP2 addressability | primitives | testID | empty/whitespace IDs | throw and native mount | bypass assert |
| CP2 boundary | feature source | feature production tree | className/raw RN mutation | static gate fails | add className or RN import |
| CP3 layer | LayerStack/SurfaceRoot | layerId/tier/guard | standard + alert | overlay, block, order | flow layout or wrong guard |
| CP3 token | theme + primitive | token name | one token mutation | rendered value changes | hardcode value |
| CP4 registry reject | member desk | reasonCode | customer-rejected | retry/abandon distinct | restore dismiss |
| CP4 withdraw | actors + layers | pending identity | double/single topology | first arrival wins | allow late second action |
| CP4 system failure | components/actors | operation/requestId | deterministic reject | loading cleared, notice shown | void/catch swallow |
| CP4 mode | actor + CustomerMember | preview/confirm/handheld | display count 1/2 | mode exact, no screen branch | component reads screen count |
| CP4 empty/scroll | MemberList | zero/many | 0/1/many records | empty action, one scroll owner | page and list double scroll |

模型红向量与真实树结果必须分开报告：模型变异 FAIL 表示门能抓住坏形态；
真实生产树 PASS 只表示当前树干净，不能互相替代。

## 12. 未决项与停机

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
|---|---|---|---|
| layer type/partKey 文字 | RESOLVED_BY_DEXTER | 实现固定 type=6、partKey=7 双分母 | 把两个分母合并成单一数字 |
| 单屏 customer reject 去向文字 | RESOLVED_BY_DEXTER | 采用 member-form + registry-notice，再由 retry/abandon 分流 | 回退到直接 reject→list |
| T-1 比例静态门 | DEXTER_DECISION | 记录为人工 review 判据 | 未裁定前建 checker 或 red vector |
| NativeWind/Tailwind 解析 | UNVERIFIED | CP-1 本机解析 | 教程/POC 版本代替 |
| RNR 控件新增公共面 | 已由 Dexter 本轮授权：仅新增受控 `PrimitiveScrollView` | 八项既有 public contract 不变；新增项只接受 testID 与 children | 不把 DialogSurface/DialogActions/EmptyState/ScrollArea 下沉 |

## 13. 停机条件

任何一项停止条件命中都交 Dexter，不自行改变需求语义：

- CP-1 版本不能由本机解析值证明；
- 需要让 kernel port、业务包或 sample assembly 感知 visual implementation；
- NativeWind/RNR 破坏八个既有 primitive contract 或受控滚动 contract；
- render 必须 import feature 才能完成 layer；
- system failure 不能做到不静默且不递归；
- 单屏语义需要组件读取屏数；
- layer partKey 计数未修正文档；
- T-1 未裁定却要求建比例静态门。

## 14. 三维对账节奏

每个 CP 完成 focused/static proof 后，主 agent 逐项回读：

1. 需求正本：业务目标、明确不做、已裁定 guard 与分段边界；
2. 本详设与 IA：owner、形态、动作、文案、状态、testID、失败/恢复；
3. 项目记忆：TER 单 VM/单 store/多 surface、TR-11/TR-12、先见重复再下沉、
   业务事实单一住址和不可见维度观察规则。

下一 CP 开始前由 fresh independent subagent 做只读三维对账。四 CP 完成后，
进入整体测试前再做一次全批对账；任何偏差在当前步骤修复，不推迟到整体验收。

## 15. 交付状态

DESIGN_STATUS=READY_FOR_IMPLEMENTATION_INPUT
IMPLEMENTATION_AUTHORITY=false
IMPLEMENTATION_ADMISSION=OPEN_UNDER_DEXTER_2026_09_05_AUTHORIZATION
STATIC_PROOF=未运行；本轮只写文档
DYNAMIC_PROOF=未运行；本轮不授权
NEXT_AUTHORITY=按当前 Dexter 授权实施 CP-1；本详设不替代后续步骤级授权与独立 review
