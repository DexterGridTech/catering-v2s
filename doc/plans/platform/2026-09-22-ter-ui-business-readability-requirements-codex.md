# TER UI 业务包可读性与基础能力归位 · 需求分析

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Codex
STATUS=PROPOSED_FOR_DEXTER
DATE=2026-09-22
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_UI_BUSINESS_READABILITY_20260922
EVIDENCE_TIER=static-source-analysis
AUTHORITY=仅需求分析与评审；不进入详设、实施计划或实施
```

## 1. 原始要求与真实目标

Dexter 本轮点名 `terminal/ui/feature/sample-member-desk`、`sample-staff-auth`、`sample-wallpaper-picker`，认为 UI 代码可读性较差，并明确要求：

> 1，我希望 component 中 laptop 显示的 part 是一个目录，mobile 是另一个 part，通用的可以放在 component 中，而且文件结尾就不要带 laptop 或 mobile 了，用目录区分。
> 2，我希望 terminal/ui/feature、terminal/ui/integration 里面的包，只关注业务本身，有些重复的可以工具化的功能或方法应该抽到 base 包中，业务包写的越少越好。
> 基于这两点，请你生产一个需求文档，明确我的初衷和你的详细分析与优化方案，写完后给我和 Claude 做 review，暂时不进入详设和实施计划。

仓内实际路径均以 `apps/terminal/` 开头，合法目录名为 `src/components/`。本文将“part 的目录”理解为 **part 对应的组件实现目录**；`definePart` 声明仍归 `src/parts/`，不把注册代码混入组件目录。

目标不是仅把文件搬家，也不是追求最少行数，而是：

1. 找 laptop 或 mobile 的画面时，直接进入对应目录，不再在混排的文件与兼容导出中猜入口。
2. 双端各自拥有布局与展示，业务行为只有一份；修改登录、登记或壁纸规则，不需要同步改两套业务逻辑。
3. 阅读 feature 时主要看到“这个业务显示什么、允许做什么、失败后怎么办”；阅读 integration 时主要看到“组合哪些业务、怎样安排页面”。
4. 请求执行、注册、声明解析等通用机制复用已有 base；下沉之后业务规则更显式，不能只是把复杂度藏进配置或大工厂。

**硬要求已由 Dexter 明确：按目录区分三个 feature 的双端实现、去掉组件文件机型后缀、共用业务 hook、减少业务包内重复机制。** 本文提出的具体抽取候选与范围取舍仍是评审建议，不冒充已批准的 API 设计。

后续指令更新：Dexter 先取消 Claude 交接，最终明确“一轮对抗式 review 即可”。本需求只进行一轮 fresh 独立子 agent 对抗审查，处置 findings 后交 Dexter；不追加第二轮，需求阶段边界不变。

## 2. 范围与本轮不做的事

| 对象 | 本轮分析范围 | 预期归位边界 |
| --- | --- | --- |
| `apps/terminal/ui/feature/sample-member-desk` | 全部组件、hooks、parts，以及关联 command/actor/selector/assembly | 重点整理目录与职责；会员交互规则留本包 |
| `apps/terminal/ui/feature/sample-staff-auth` | 同上，含被两个 integration 复用的登录 | 双端共享登录行为，认证规则不改 |
| `apps/terminal/ui/feature/sample-wallpaper-picker` | 同上，含背景与壁纸状态 | 双端展示分离，选择/确认/失败语义不改 |
| `apps/terminal/ui/integration/sample-console`、`sample-wallpaper-console` | 当前全部两个 integration 的 `src`，共 16 个生产源码文件 | 检查重复机制与现有 base 接入；业务组合和页面安排保留 |
| `apps/terminal/ui/base/render`、`console-assembly`、`feature-assembly`、`primitives` 等现有 owner | 只核实可复用能力与职责归属 | 优先复用/有限扩展，不预设新 base 包 |

目录硬要求直接覆盖点名的三个 feature。wallpaper integration 的两个 laptop-only 组件也在本文记录，建议在后续获批整理范围内采用相同目录表达；**不凭此创建 mobile 对应页面，不把建议扩写为全仓改名授权**。base/admin-shell 不属于本次目录迁移目标。

本轮仅新增需求与 review 材料，不修改源码、测试、依赖、脚本、标准正本或构建产物；不运行 Web、Metro、Android、设备、DEV、L2、UAT。本文不包含 CP 排期、逐文件实施任务、最终接口签名或测试执行命令。已有 admin-console review 的待办不并入本需求，也不宣称被关闭。

## 3. 当前代码事实：不是“没有双 UI”，而是组织与复用没有跟上

### 3.1 组件分母与真实入口

以下数字来自当前 `src/components/` 文件和 `src/parts/parts.ts`，不是运行可达性结论。

| feature | 逻辑 part 数 | laptop/mobile 实现文件 | 无后缀旧转出文件 | 真正共用组件 | 总组件文件 |
| --- | ---: | ---: | ---: | ---: | ---: |
| sample-member-desk | 9 | 18 | 9 | 1：`MemberRow` | 28 |
| sample-staff-auth | 3 | 6 | 3 | 1：`StaffLoginPasscodeInput` | 10 |
| sample-wallpaper-picker | 2 | 4 | 2 | 1：`WallpaperBackground` | 7 |
| 合计 | 14 | 28 | 14 | 3 | 45 |

逐 part 清单：

- member-desk：`MemberList`、`MemberForm`、`CustomerMember`、`CustomerWelcome`、`WaitingConfirm`、`RegistryNotice`、`DiscardConfirm`、`WithdrawConfirm`、`DeskSystemNotice`。
- staff-auth：`StaffLogin`、`AuthNotice`、`AuthSystemNotice`。
- wallpaper-picker：`WallpaperPicker`、`WallpaperSystemNotice`。

它们已经分别注册 laptop/mobile renderer，也已复用业务 hook。问题在于同一目录同时出现 `MemberForm.tsx`、`MemberFormLaptop.tsx`、`MemberFormMobile.tsx`；其中无后缀文件只是转出 laptop，不是真正通用实现。parts 还保留指向 laptop 的旧别名。读者仅看文件名或旧测试引用，会误判生产入口或“共用”范围。

**注册存在不等于可达。** 例如 `customer-welcome` 的 mobile 注册仍要求 SECONDARY，而当前 mobile 声明禁止 SECONDARY；不能把 28 个文件解释成 28 个可运行页面，也不能为“补齐双端”放开 mobile 副屏。`customer-member` 的 handheld-confirm 与副屏确认是不同业务位置，不得机械删除 mobile 实现。

### 3.2 hook 聚合与纯逻辑混居

| 位置 | 当前事实 | 可读性问题 |
| --- | --- | --- |
| member `hooks/useMemberDesk.ts` | 同文件导出九个 `useX`，并含 notice 文案映射、类型与事件类型等 | 修改某一页面需要穿过其他八个职责；违反现行“一文件一 hook”的职责要求 |
| auth `hooks/useAuthNotices.ts` | 两个 notice hook、props 类型、`authNoticeMessage` 纯映射同居 | 文件名不能直接定位单一行为；纯语义和 React 依赖混在一起 |
| wallpaper `hooks/useWallpaperPicker.ts` | picker 与 system-notice 两个 hook，兼有壁纸标签、错误阶段提取和文案映射 | UI 状态、执行机制、业务解释堆在一起；并非双端共享就已经清晰 |
| wallpaper `components/WallpaperBackground.tsx` 与上述 hook | 都含 none/w1/w2/w3 的同一组业务标签 | 同一业务字典两处维护；应在 feature 内归一，不应因此放进 base |

“一套 hook”是**同一职责的行为由双端共用一份**，不是每个包只能有一个巨型 hook。纯映射归本包 `foundations/`，纯类型归 `types/`；小型私有辅助可依其同一变更理由就近放置，不按行数机械切碎。

### 3.3 通用机制已经有基础，但最后一段编排仍重复

三个 feature 已调用 `dispatchWithRequestId`、`useTrackedRequest`、`useRequestInFlight`、`classifyRequestResult`、`useDispatchCommand`。**失败分类器并未被三包重复实现**；重复的是 start → 派发 → 分类 → 按结果 finish → 通知失败的外围编排。

具体同根范围是 member 的 logout、submit、customer decide 三处，auth submit 一处，wallpaper runAction 一处。五处有共同骨架，但不能直接视为等价函数：

- auth 的业务失败会更新 `passcodeResetKey` 清除本地密码输入，记住的工号和保密边界不能随抽取消失。
- member 的顾客决策带 `peer-intent` 路由；重试/放弃/撤回由自己的命令和 actor 决定。
- wallpaper 通过 actor result 区分 `before-write` / `after-write` / `unknown-write-phase`，不得把失败一律解释成“没有写入”。
- auth/member 的 rejection 在处理后继续抛出；wallpaper 的入口处理后消费 rejection。既有详设 D-14 明确保留这一区别，不能由公共 catch 一把吞掉或统一抛出。
- wallpaper 有同步的 `actionInFlight` ref 防重入；其他入口不能仅凭表面类似就被宣称存在同一个已复现故障。未来复用必须保留已存在的保护，并证明 busy 与 request 身份没有串扰。

### 3.4 系统提示共用体已有，但六个 renderer 未使用

`ui/base/render/src/components/SystemFailureNotice.tsx` 已公开提供标题、消息、关闭按钮等共用体，`render/src/index.ts` 已导出；三个 feature 的六个 `*SystemNoticeLaptop/Mobile` 仍各自重复 primitive 组合。

这不是“先造一个通用提示框”的需求，而是**让已有能力承接真实双端使用**。当前共用体内置居中、padding 24、bounded card 与 actions 布局，不能直接假设它足够表达现有 mobile 形态。应在不改变布局与行为的前提下评估有限展示参数或组合槽位；双端 renderer 入口继续独立。业务提示身份、文案及关闭意图仍由 feature 传入。

三个 `foundations/systemFailureDismissal.ts` 是本包 dismissed command 到公共派发器的短绑定，被按钮及 layer dismissal 共用。**短而相似不等于应消除**；它们表达业务身份，不应为了少几行改成 base 猜测 command 的引擎。

### 3.5 part 元数据与注册机制混在业务声明中

三个 `parts/parts.ts` 都包装了 `definePart`，按 surfaceForm 生成 rendererKey，并为同一 part 的两端重复写 title、description、容器与适用条件。局部 wrapper 的 `ComponentType<any>` 还丢失了 `definePart<TProps>` 已能表达的 props 约束。

适合共用的是“一个逻辑 part 对应显式的机型 renderer 绑定”的机制；必须留在业务侧的是 partKey、文案、可用 workspace/display/instance、layerTier/layerGuard 及 props。**不能把所有 part 默认生成为双端，也不能默认把所有提示设成相同 guard。** 单端存在是合法输入，不是漏实现。

### 3.6 integration：剩余重复可定位，但不能重做 console 框架

| 位置（两包均有） | 同根事实 | 业务与机制的分界 |
| --- | --- | --- |
| `application/terminalSurfaces.ts` 的 `readTerminalSurfaces`、`getSurfaceDeclarations`、`surfaceFormForOrientation` 及类型 | 重复尺寸正数校验、portrait 禁 SECONDARY、读取/冻结声明；错误前缀不同 | 公共校验、类型和选择规则可归 base；package.json 的尺寸与本应用声明仍归 integration |
| `application/module.ts` 的 `createStartupReadyActor`，以及 assembly 的 ready payload 映射 | 相同字段的就绪日志和映射重复 | 载荷/日志机制可复用；integration command 身份、owner 和应用辨识不能消失 |
| `assembly/assembly.tsx` 中 stateSyncSlices 的 reduce | 同样排除 isolated、映射 name/syncIntent | 纯筛选可共享；“选哪些模块参与同步”仍由 integration 明示 |

其中 sample-console 包含会员的 master-to-slave slice，wallpaper-console 没把 isolated 壁纸 slice 纳入同步。**抽取筛选不得变成自动扫描/注册所有模块**，更不能让壁纸同步策略改变。

已实际复用、不得再造：

- `createConsoleAssembly` 已负责 admin parts、renderer 选择、唯一 catalog/runtime、启动/恢复和生产 surface 的 `AdminLauncher`、`InputSurfaceFrame`；不能因 integration 没有逐行展开就判断“未接入 admin”。
- `createFeatureAssembly` 已供三个 feature 使用；其 owner 检查只接受 `ui.feature.*`，不能为复用 integration 的 descriptor 而绕过检查。
- `SurfaceRoot`、`LayerStack`、selector-aware hooks、输入注册与请求基础设施已经存在，不另建 store、renderer registry、输入管线或全局失败监听。

wallpaper integration 的 `createWallpaperConsolePlacementActor` 根据登录/恢复/登出安排 picker、welcome、waiting，这是应用场景编排，保留 integration。`WallpaperBackground` 选择、模块组合、诊断 section、应用主题与持久化身份也不属于公共机制。

### 3.7 文档与代码入口也需要一起变清楚

现有 README 的无后缀路径已经不能说明真实 renderer；member README 还写姓名字段使用系统键盘，而当前 hook 使用 virtual-full 配置。这是需回源核对的文档漂移信号，**本需求不据此更改键盘行为**。后续目录归位必须连同公开导出、现有测试引用及 README 一起对账，不能留第二条“默认 laptop”入口遮蔽新目录。

## 4. 需求定义

### R-1 按机型目录组织组件，注册与布局分离

三个 feature 使用 `components/laptop/` 与 `components/mobile/`。文件名表达组件职责，不再追加 Laptop/Mobile。真实共用的组件可直接放在 `components/`；不新设含糊的 `common` / `utils` 包来转移杂物。

以下仅为职责形态示例，不是逐文件实施清单：

```text
src/
  components/
    laptop/MemberForm.tsx
    mobile/MemberForm.tsx
    MemberRow.tsx                  # 真正与机型无关的组件
  hooks/useMemberForm.ts           # 双端共享的这一项行为
  foundations/                    # 本业务纯映射与纯辅助
  types/                          # 纯类型
  parts/parts.ts                  # 显式导入、绑定 renderer
```

不同目录内可以使用相同组件标识，在注册处用导入别名明确 laptop/mobile。不依赖 Metro 对 `.laptop.tsx` / `.mobile.tsx` 的平台解析，不依据窗口宽度或 `Platform.OS` 在一个业务 renderer 内切换整套布局。

同一逻辑 part 的双端仍是 sibling 注册；同一 partKey、原有 rendererKey 与 surfaceForm 策略不因文件搬迁改变。无后缀组件不得继续默默转出 laptop；旧引用必须显式迁移，不以长期兼容壳保留歧义。

### R-2 每个行为一份共享 hook，文件按职责可定位

双端 renderer 消费同一行为 hook，renderer 负责布局、展示与控件绑定，hook 负责 selector 订阅、本地交互状态和业务意图调用；不在 hook 返回 JSX 或机型布局。九个 member hook、两个 auth notice hook、两个 wallpaper hook 均按实际职责可单独定位。

不要求一切只有三行，也不把简单直接的业务事件包装成多层转发。不得复制状态机、用整个 root state 透传视图，或为拆 hook 建第二份业务状态。

### R-3 业务包保留显式业务；base 承接可证实的通用机制

判断一个候选是否下沉，要同时回答：当前真实消费者是谁；哪部分机制相同；差异由谁拥有；已有 base 能否直接使用；下沉后业务阅读是否更简单。没有真实复用证据、只有名称相似的内容不强行下沉。

base 不得反向 import feature/integration/assembly（含 type-only），不得识别 sample 名称、壁纸 ID、会员字段、业务 command 或 partKey 字符串，也不得通过“业务类型枚举”隐式分支恢复这些知识。

### R-4 复用后的行为不可退化

公共请求执行机制需要保留 requestId 关联、running/terminal 区分、结束清理、已有防重入和错误可观察性；业务 hook 仍控制 payload、routeIntent、业务失败后动作及 rejection 策略。不得把 system-failure 写成成功、把 running 提前 finish，或让旧请求完成清掉新请求的 busy。

公共提示体只负责呈现和回调，不拥有 feature 的 observed/dismissed 意图。按钮、允许的遮罩关闭、Android 返回应继续进入同一 feature dismissal；decisive 提示仍不能借复用变成可绕过的 dismissible 提示。

### R-5 可读性包含 JSX、类型与公共入口，不只目录

拆开长单行 JSX、复杂嵌套条件和内联列表，使布局层次与状态分支可读。仅当具有独立职责时提取 feature 内局部组件，不为每个标签增加包装层。注册辅助必须保留组件 props 约束，不把方便配对建立在业务层 `any` 上。

共用业务字典在业务包内只有一个住址。index 仅承担清晰导出，测试逃生口不得进入生产入口。README 描述真实目录、行为入口和复用关系，不制造“文档已统一”的未经核对结论。

### R-6 现行规范冲突必须显式衔接

`doc/platform/terminal-coding-standard.md` 的 TR-14 当前要求单机型 renderer **basename 包含 Laptop/Mobile**，与 Dexter 本轮要求直接冲突。新要求优先，不需要让 Dexter 重复选择同一命名意图。

本文建议将目标范围的表达改为“通过明确机型目录辨识实现，文件名只表达职责”，保留显式 resolver、partKey-only 调用、注册正确性等既有约束。后续若获准详设/实施，应先在标准唯一正本对齐适用范围与示例；**本轮标准未修改，base/admin-shell 也不因此批量改名**。目录规则以 review 核验，不另造命名 AST 门。

## 5. 推荐优化方案与不抽取的反例

这些是能力归属建议，不冻结 API 签名或包内文件布局；详设应只补获批候选的必要接口与失败契约。

| 候选 | 推荐方向/现有 owner | 业务侧保留什么 | 不接受的替代 |
| --- | --- | --- | --- |
| 双端 part 绑定模板 | 评估在 `ui.base.render` 的 `definePart` 周边提供小型、类型安全的复用；公共元数据写一次、机型组件显式绑定 | part 身份、props、可用条件、层级与 guard | 新 registry；无条件制造两端；全能 UI schema |
| 请求跟踪与 outcome 外围编排 | 在 `ui.base.render` 组合现有 request/dispatch/outcome 能力，复用生命周期，不重写分类器 | payload、目标路由、失败恢复、清密码、phase 解释、rejection 策略 | 全局订阅所有失败；吞异常；统一“失败即未写入” |
| 系统失败提示共用展示 | 优先用现有 `SystemFailureNotice`，必要时有限扩展布局表达；两端 renderer 保持独立 | 安全文案、testID、dismiss 意图及布局选择 | 又造通用 dialog；把全体业务确认都改成同一种框 |
| terminalSurfaces 类型/纯解析/选择 | `ui.base.console-assembly` 承接共享规则；先复核与其已有 surface 类型的边界 | 配置值、应用上下文与错误前缀 | base 导入某应用 package.json；硬编码尺寸；放开 mobile 副屏 |
| startup-ready 通用载荷/日志 | 在现有 console 组装能力内最小复用；是否值得辅助工厂以消除实际重复为准 | command owner、应用辨识和业务启动选择 | 借用只允许 ui.feature 的工厂；重新分配命令主权 |
| stateSyncSlices 纯筛选 | 优先查已有 state/topology 公共 selector；无适合者再放入对应基础 owner 的有限纯辅助，不预设跨层新包 | 显式输入模块集合及各 slice 已声明 syncIntent | 自动搜全仓 slice；默认改变 isolated |
| 壁纸标签等纯业务字典 | feature 自己的 foundations 内归一 | 全部业务词汇和资产映射 | 将 sample 常量或图片搬进 base |
| 三个 systemFailureDismissal 短绑定 | 保留 feature 意图与现有公共派发器；不以删除几行作为抽取理由 | dismissed command 身份及 layer 入口一致性 | base 拼接 feature 命令名 |
| layout 诊断与错误脱敏等邻近辅助 | 先使用已有 logger/诊断能力；只有核实同类消费者且隐私边界一致才另列复用候选 | 是否采集、业务上下文，不输出密码/手机号/raw payload | 因一个 debug 回调就建设通用诊断平台 |

**推荐“目录归位 + 职责拆清 + 现有 base 的有限复用”。**

- 只搬目录：能缓解找文件，却留下巨型 hook、旧别名与执行样板，不能满足第二项要求。
- 一套 renderer 配机型分支：文件更少，但双端布局重新耦合，违背已明确的双 UI 意图。
- 通用页面/表单/actor 引擎：可能减少 feature 行数，却把显式业务变成配置语言与反向依赖；当前三包没有这项需求。
- 推荐方案允许保留少量直接而有意义的业务绑定；衡量的是读懂业务需跨越多少无关机制，不是代码压缩率。

## 6. 不得在整理中改变的业务事实

| 业务/边界 | 必须保留 | 回源入口 |
| --- | --- | --- |
| 登录 | 工号记忆、密码本地保密与失败清理、输入注册和错误提示；不改认证/keyboard 语义 | auth `useStaffLogin`、`StaffLoginPasscodeInput`、commands/actors |
| 会员登记 | 草稿保留/放弃、顾客确认/拒绝、等待撤回、单屏手持与副屏位置、decisive/standard/alert 区别 | member 九个 hook、parts、actors；09-05 交互设计 |
| 壁纸 | pending 与 confirmed 区别、确认可用条件、none/w1/w2/w3、主副屏背景来源、写入前后失败解释 | picker hook/background、kernel wallpaper owner；09-13 需求、09-14 D-14 |
| 页面编排 | 已登录/匿名时 picker、waiting、welcome 的位置和业务 module 组合 | wallpaper integration placement actor/assembly |
| 公共壳 | 唯一 runtime/catalog、共享 admin 入口与输入管线、应用主题现有覆盖机制 | console-assembly、TR-13；不恢复此前已撤回的主题禁改要求 |
| 显示与拓扑 | 原有 surfaceForm/displayMode/instanceMode 的职责、portrait 禁 SECONDARY、显式同步集合 | parts、terminalSurfaces、topology/state owner |

这里的“保留”是重构边界，不是宣称当前所有交互均已验收正确。源码与既有批准需求若冲突，先记录并归因；不能把“保持当前代码”当作覆盖需求的理由。

## 7. 未来验收应怎样证明目标达成

本节定义成功条件，不是本轮测试结果，也不是实施计划。

1. **入口可定位**：14 个逻辑 part 逐项可从 `parts` 找到对应机型目录与共享 hook；3 个共用组件按实际依赖判断；不再以默认 laptop 转出冒充通用组件。注册全集与生产可达集合分开记录。
2. **职责可读**：hooks 文件按一个行为职责定位，纯映射/类型不混进 React 聚合文件；renderer 不含另一套业务规则或整页机型条件分支。review 比较职责与变更理由，不设行数/缩减比例指标。
3. **抽取有消费与边界**：每个采用的 base 候选至少指出当前实际消费者及正反例；业务包真正调用，而非只添加公共实现；已存在的 console/feature-assembly 能力继续使用。
4. **行为防回归**：沿已有 focused 测试验证 request 终态/运行态、busy、防重入、异常传播、旧请求不清新请求、提示关闭、props 类型约束、非法 surface 声明拒绝、同步输入不扩容。保留的机械/行为断言要以真实错误变异证明能红；不为文档指标制造新门。
5. **业务差异不被抹平**：分别核对登录失败清密码、会员重试保留/放弃清理/顾客决策路由、壁纸写入前后失败、integration placement；“公共 helper 通过”不替代消费者行为。
6. **形态没有回退**：未来进入获授权动态验证前，按本批已批准的 UI/交互依据对实际生产画面与控件分母对账；laptop/mobile 的位置、尺寸、状态、文案、焦点、输入与背景均保留。testID 存在、文件一分为二或 typecheck 通过，不等于视觉正确。
7. **标准与引用一致**：TR-14 的目标范围表达、真实导出、测试与 README 同口径；不留过时兼容路径，不把文档声明当作源码事实。

通用失败模式已进入本需求的后续 review checklist：仅搬文件不拆职责；将短业务绑定误判成基础设施；公共能力存在但无人消费；共用 catch 改写失败语义；注册全集冒充运行可达；业务行数下降但 base 知道更多业务。本轮不新增 project-memory 规则或伪语义 checker。

## 8. 当前证据、未验证项与评审问题

**静态已核**：三个 feature 的全量组件/parts、共享 hook 的调用关系、现有公共能力、两个 integration 的全部生产 src；同根扫描范围见 §3。独立只读分析子 agent 核对了 integration 与已有基础设施；该分析不是最终 verdict。

**本轮未做**：代码修改、类型/编译/focused test、Web、Android/native/device、运行截图与视觉核验；没有创建运行环境，cleanup 无本轮新增进程可清理。所有“未来验收”均未运行，不沿用以前动态 PASS。

请独立审查者核验、最终交 Dexter 裁定的是：

- 是否准确表达“按目录找双端、业务行为共用、业务包少写机制”的初衷？
- §5 哪些候选应成为下一阶段需求，哪些成本大于收益应保留短而显式的业务绑定？
- 两个 integration 的基础机制归位是否合理；wallpaper integration 的两个 laptop-only 文件是否随下轮一起对齐命名？本项仅是范围建议，不影响三个 feature 的既定目录要求。
- 是否存在把业务语义挪进 base、改变失败恢复或假装所有双端注册都可运行的遗漏？

公共 helper 的最终签名、具体文件拆分与验证命令留给**另行授权**的详设/实施计划。需求 review 的 GO 仅表示需求方向可接受，不自动启动这两个阶段。

## 9. 回源索引与本轮双读记录

以下均为仓根相对路径；源码符号是事实定位点，行号随前序工作变化不作为冻结权威。

- 当前原始材料：§1 引述的 Dexter 本轮两项要求及“暂不详设/计划”的边界；`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 与选定 `V2S_W0_W4_EXECUTION` Roadmap 授权字段已重开。不从 Roadmap 推断当前任务。
- 规则：`doc/platform/terminal-coding-standard.md` §0、TR-12/13/14/15、§7.1、TR-R01/R02/R03/R07；`project-memory/decisions/deterministic-context-only.md` 与全部 kernel。
- 六维路由：`scripts/context/recall-memory --task-kind design --domain platform --consumer-face operations-admin --owner frontend-platform --impact architecture --trigger task-start`。路由词表没有 terminal，使用现有前端约束入口并回读命中原文；这不把 TER 归类为 operations-admin，也不使 Ant Design Drawer 规范适用于 RN。
- 任务相关 memory owner：`project-memory/operations/terminal-coding-standard.md`、`decisions/terminal-architecture-and-stack-rulings.md`、`decisions/terminal-build-order-and-batches.md`、`practices/frontend-capability-lookup.md`、`pitfalls/designing-from-conversation-not-system.md`、`pitfalls/invisible-dimension-drifts-at-implementation.md`。同路由后台 HTTP/DB、Ant Design Drawer 条款已读，非本需求行为判据。
- 既有目标：`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md` §0、§3.3–3.5；`doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md` §9.6 D-14。本文延续“业务专注业务、基础设施上收”的既有方向，不把已实现能力说成全新需求。
- 业务：`doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md` §2–6；`doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`；冲突以当前专项批准约束回源处理，旧文档不自动覆盖新要求。
- 三个 feature 的 `src/components/`、`src/hooks/`、`src/parts/parts.ts`、`src/features/commands/commands.ts`、`src/features/actors/actors.ts`、`src/foundations/systemFailureDismissal.ts`、`src/index.ts`、README；尤其 `useMemberDesk`、`useStaffLogin`、`useAuthNotices`、`useWallpaperPicker`、`WallpaperBackground`。
- base：`apps/terminal/ui/base/render/src/foundations/definePart.ts`、`dispatchWithRequestId.ts`、`requestOutcome.ts`，`src/hooks/useRequest.ts`、`useDispatchCommand.ts`，`src/components/SystemFailureNotice.tsx`、`SurfaceRoot.tsx`；`apps/terminal/ui/base/feature-assembly/src/index.ts`；`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`。
- 两个 integration 的 `src/application/terminalSurfaces.ts`、`module.ts`、`src/assembly/assembly.tsx`；wallpaper integration 的 `src/features/actors/actors.ts`、`src/parts/parts.ts`。sample-console 无自有 `src/parts/parts.ts`，不能把不存在的文件当证据。

写入前按目录/行为、公共机制、integration 三类问题重开对应要求、memory owner、标准与现有源码；写入后以同一组材料复核 §3 的事实和 §4–7 的建议边界。该双读仅证明本轮需求来源与分析一致，不替代未来实施时的逐点双读与独立对账。

## 10. 一轮独立对抗审查与作者处置

按 Dexter 最新要求只做一轮，不交 Claude、不追加第二轮。独立 reviewer 为 Gauss（`01a0c96f-c93b-72d1-ade7-1532a0080c41`），fresh 上下文、全程只读；完整原始报告见 `doc/review/platform/2026-09-22-ter-ui-business-readability-requirements-review-round1-codex.md`，输入清单见同目录 `2026-09-22-ter-ui-business-readability-requirements-review-inputs-round1-codex.md`。

独立原始结论：`REVIEW_TARGET=DESIGN`、`VERDICT=GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/1`。无阻断性 finding；L3 保留未来整理后的双端视觉、交互/失败恢复和真实设备行为，不能理解为实施或 UI 验收通过。

| finding/回源点 | 作者裁定 | 最小处置与回读 |
| --- | --- | --- |
| N1：§3.3 分类器符号误写 | CONFIRMED | 重开 `requestOutcome.ts` 定义、render 的公开导出与三个 feature 的五处调用，均为 `classifyRequestResult`；只改文档，不加兼容别名、不改源码。另四个 API 名称回读正确 |
| `unknown` 阶段说明简写（reviewer 未列 finding） | 非阻断的精确化 | 用当前真实字面值 `unknown-write-phase` 替换简写，防止被误读为新增枚举；未改变阶段语义 |
| 轮次与外部交接 | 最新指令优先 | §1 改为一轮独立审查后直接交 Dexter；不再准备 Claude handoff |

以上为作者处置，不冒充第二份独立 verdict；原报告 `0/0/1` 保留。当前没有未处置的阻断项，需求方案交 Dexter 查看。全过程仅文档写入，457 个 feature/integration/base 范围文件的内容摘要前后相同；未执行测试、构建或动态验证。
