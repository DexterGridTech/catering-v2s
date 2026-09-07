# TER sample UI 能力与体验实施计划

## 0. 计划元数据与边界

PLAN=2026-09-05-v2s-terminal-ui-capability-and-experience
DESIGN=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-implementation-design-codex.md
IA=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-ia-design-codex.md
INTERACTION=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-interaction-design-codex.md
REQUIREMENTS=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md
IMPLEMENTATION_AUTHORITY=false
CURRENT_TASK_AUTHORIZATION=DEXTER_2026_09_05_IMPLEMENTATION
AUTHORIZED_NOW=按 CP-1 至 CP-4 完成源码、测试、依赖与本机验证
NOT_AUTHORIZED_NOW=§9 比例静态门、真实 POS、UAT、部署、DEV、seed、浏览器自动化
PLAN_STATUS=READY_FOR_IMPLEMENTATION_UNDER_DEXTER_AUTHORIZATION

本计划是实施输入，不替代 Dexter 授权。Dexter 已解除 source input gate；实现统一使用
layer type=6 与 layer partKey=7 双分母，并按当前授权进入 CP-1。

## 1. 目标、架构与技术栈

### 1.1 目标

补齐 §4-C 的能力闭环：primitives 统一提供可寻址呈现路径，业务 feature 不感知
automation 后端；同时让 sample 的门店会员登记旅途在单屏、双屏、空态、拒绝、
撤回、退出和基础设施失败下都能回到可继续状态。

### 1.2 架构顺序

CP-1 工具链与 Android 显示地板 → CP-2 primitives RNR 内胆 →
CP-3 theme 与 render layer 地板 → CP-4 Journey 与 feature-local 体验。

段 4 的交互设计可以提前静态准备，但实现不能越过 CP-3。Web 画布固定钉死
terminalSurfaces 目标尺寸；部件内部按比例适配机型，两者不是同一条规则。

### 1.3 技术栈边界

- NativeWind + Tailwind：只在 CP-1 接线，版本以本机解析值为准。
- React Native Reusables：copy-in 到 primitives，不能成为 workspace/runtime dependency。
- React Native：现有八个 primitive 的底层能力继续由 primitives 隔离；本批另有一个受控 `PrimitiveScrollView` 公共滚动契约。
- theme：base tokens 在 primitives，app theme 在 sample-console/theme。
- render：LayerStack 负责覆盖、模态、backdrop、Android back、focus；不负责业务语义。
- automation backend：本批不建；控件挂点必须是未来 automation 的必经路径。

## 2. 原子 CP 总览

| CP | 主题 | 依赖 | 完成闸门 | 停止点 |
|---|---|---|---|---|
| CP-1 | 工具链与 Android 显示基线 | 无 | 本机解析兼容、真实 primitive class path、Web/Android 基线 | 版本或启动不可证明 |
| CP-2 | RNR copy-in、八项既有 contract 与受控滚动 contract | CP-1 | contract/testID/className/依赖边界均可证伪 | contract 或强制挂点破坏 |
| CP-3 | theme 与 render layer | CP-2 | token、覆盖、guard、back、focus 均有 focused/red | render 需要业务依赖或 layer 仍不覆盖 |
| CP-4 | Journey、actors、feature-local 控件 | CP-3 | 12 catalog parts、15 IA views、7 layer keys、单双屏和失败恢复对账 | 实际分母/输入与已裁定实现输入不一致，或任一业务路径静默/越权 |

## 3. CP-1：工具链与 Android 显示基线

### 3.1 实施前读取与版本解析

实施者先读取当前 package.json、yarn lock/安装树、Expo/RN package metadata，
再执行本机解析，不引用教程或旧 POC：

1. 解析 NativeWind、Tailwind、Expo 与 RN 的实际安装版本以及 peer range；
2. 读取 sample-terminal Android Gradle 实际 minSdk、compile/target SDK、NDK
   resolved value；
3. 将解析结果与 NativeWind/Tailwind 官方兼容要求写入 CP-1 evidence。

预期观察命令由实施者在受管授权后执行，示意为：

    node -p "require('./node_modules/react-native/package.json').version"
    node -p "require('./node_modules/expo/package.json').version"
    yarn why nativewind
    yarn why tailwindcss
    cd apps/terminal/assembly/android/sample-terminal/android
    ./gradlew :app:properties --no-daemon

上述命令本轮不运行。若解析结果不能证明兼容，停止交 Dexter，不改 port、
不把版本写成教程结论。

### 3.2 计划改动面

- apps/terminal/ui/integration/sample-console/package.json：只放实际需要的工程依赖字段。
- apps/terminal/ui/integration/sample-console/metro.config.js：NativeWind/Expo Metro 接线。
- apps/terminal/ui/integration/sample-console/babel.config.js：NativeWind Babel 接线。
- apps/terminal/ui/integration/sample-console/tailwind.config.js：只声明 primitives/app theme 所需路径。
- apps/terminal/ui/integration/sample-console/theme/：创建 app-local theme 入口。
- apps/terminal/assembly/android/sample-terminal/app.json：orientation=landscape。
- apps/terminal/adapter/android/dual-screen/android/src/.../TerminalPresentation：窗口铺满、甲档沉浸。
- apps/terminal/assembly/android/sample-terminal/android 生成链：只由 prebuild/Gradle 产生，不手改 manifest。

实际 Android 源码路径以 CP-1 开工前的仓内文件枚举为准；若需要新增 MainActivity
bootstrap、业务 assembly surfaceMode 或 kernel port，立即停止。

### 3.3 判据与红向量

| 判据 | 真实树结果 | 模型红向量 |
|---|---|---|
| className 在真实 primitive 生效 | Web/Android 真实 primitive 样式改变 | 删除 Metro/Babel 接线后样式失效 |
| orientation 横屏 | 横屏设备无黑边 | 改回 portrait 必红 |
| 甲档沉浸 | 主副屏无状态/导航栏 | 去除每个窗口标志后系统栏出现 |
| Presentation 铺满 | 副屏窗口覆盖 target display | 去掉 layout params 后不再铺满 |
| 版本兼容 | 本机解析值满足范围 | 用不兼容版本 scratch fixture 必失败 |

真实树绿与模型红分开报告。没有真实 Android/Web 运行，不能声称 CP-1 完成。

## 4. CP-2：primitives RNR 内胆

### 4.1 实施顺序

1. 复制 RNR 需要的内部源码到 primitives/rnr，不引用 RNR package。
2. 逐个保持八个既有 export 的 export、props、呈现语义，并新增窄的 `PrimitiveScrollView` 公共契约；该新增契约只允许强制 `testID` 与 children。
3. 把 assertTestID 放在每个公共控件唯一必经路径，testID 挂真实 RN 节点。
4. 把 base tokens 接入 primitives 内部；不把 className 暴露给 ui/feature。
5. 同步 README、invariants、index 与测试；automation 仅保留未来挂点，不导入 backend。

### 4.2 文件与验证

生产/契约路径：

- apps/terminal/ui/base/primitives/src/components.tsx
- apps/terminal/ui/base/primitives/src/rnr/
- apps/terminal/ui/base/primitives/src/theme/
- apps/terminal/ui/base/primitives/src/index.ts
- apps/terminal/ui/base/primitives/README.md
- apps/terminal/ui/base/primitives/terminal-invariants.json

focused/static：

- apps/terminal/ui/base/primitives/test/primitives.test.tsx
- ui/feature 两包生产源码 className 与裸 RN import 的静态扫描
- primitives public export / invariants / README 集合核对

### 4.3 判据与停止

通过：八个既有 public contract 与受控滚动 contract 的集合、invariants、README 对齐；空/空白 testID 抛错；RNR dependency 不进
package；feature 内零 className；所有控件仍可渲染。

红向量：任一控件绕过 assertTestID；feature 写 className；RNR 通过 package
依赖引入；在 props 加业务字段。任何一个未红，停止修门。

停止：RNR 迫使 public API 改形、无法保持强制 testID、或业务 feature 必须感知
className。不要用兼容层或可选 testID 止血。

## 5. CP-3：theme 与 render layer 地板

### 5.1 Theme

新增/修改：

- apps/terminal/ui/base/primitives/src/theme/baseTokens.ts
- apps/terminal/ui/integration/sample-console/theme/index.ts
- apps/terminal/ui/integration/sample-console/theme/tailwind.config.js
- apps/terminal/ui/integration/sample-console/theme/global.css 或等价 app 入口

base tokens 是可复用能力；sample-console theme 是应用身份。不得建
apps/terminal/ui/theme 或共享 app theme。

真实树判据：改一个 app token，最小 primitive 的真实渲染改变。
红向量：绕过 token 写固定值，或把 theme 放 ui/theme，必须红。

### 5.2 Render layer

新增/修改：

- apps/terminal/ui/base/render/src/components/LayerStack.tsx
- apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx
- apps/terminal/ui/base/render/src/types/catalog.ts
- apps/terminal/ui/base/render/src/types/props.ts（仅需要的窄 overlay/back/focus 输入）
- apps/terminal/ui/base/render/src/hooks/ 或独立 foundations（Android back/focus）
- apps/terminal/ui/base/render/test/LayerStack*.test.*

执行顺序：

1. 先把 LayerStack 放到 SurfaceRoot 的覆盖层定位上下文，保证不参与正常流布局。
2. 由 layer entry/renderer binding 提供 guard；layerTier 仍只决定排序。
3. backdrop 点击只关闭 dismissible；decisive 不关闭。
4. Android back 只处理最上层 dismissible；decisive 不退出、不关闭。
5. 通过 RN 0.86.3 的 `TextInput.State.currentlyFocusedInput` 打开时捕获当前 focus，
   将 focus 送入可聚焦的 top layer wrapper，关闭最后一层时恢复；无 focus target 时安全 no-op。
6. render 不 import feature、不决定业务文案、不返回 promise、不保存命令 payload。

判据：

- standard 与 alert 同时在场时 alert 位于 standard 之后且视觉覆盖；
- 底层 screen 不可交互；
- dismissible 的遮罩/back 关闭；
- decisive 的遮罩/back 不关闭；
- 关闭后 focus 恢复；
- render 公共面、invariants、README 与实际 import 同步。

红向量：LayerStack 恢复正常 flow、decisive 改为 dismissible、render 新增业务
catalog import、实现 await showDialog、关闭后 focus 丢失。模型红与真实树分开。

## 6. CP-4：Journey 与体验闭环

### 6.1 已解除的输入接缝与实现分母

Dexter 已解除需求/交互的 source input gate。实现不得回到历史单数字口径，固定使用：

- layer semantic type=6；
- layer partKey=7；
- catalog parts=12；
- IA-ID=15。

单屏顾客拒绝的 interaction map 已补齐两种屏幕形态；实现不得写成直接 `reject→list`；批准的
闭环是 `reject→member-form + registry-notice`，再由 retry/abandon 分别回 form/list。
当前 owning actor 与本计划均按此闭环，不能重新引入旧路径。

不得以“六个层”同时代表 type 和 partKey；两个分母必须在实现、测试和交付报告中分列。

### 6.2 文件级实施清单

staff-auth：

- apps/terminal/ui/feature/sample-staff-auth/src/commands.ts
- apps/terminal/ui/feature/sample-staff-auth/src/module.ts
- apps/terminal/ui/feature/sample-staff-auth/src/parts.ts
- apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts
- apps/terminal/ui/feature/sample-staff-auth/src/components/
- apps/terminal/ui/feature/sample-staff-auth/test/
- package.json、src/dependencies.ts、terminal-invariants.json、README.md

member-desk：

- apps/terminal/ui/feature/sample-member-desk/src/commands.ts
- apps/terminal/ui/feature/sample-member-desk/src/module.ts
- apps/terminal/ui/feature/sample-member-desk/src/parts.ts
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts
- apps/terminal/ui/feature/sample-member-desk/src/components/
- apps/terminal/ui/feature/sample-member-desk/test/
- package.json、src/dependencies.ts、terminal-invariants.json、README.md

CP-4 允许并要求一个已授权的 owner 接缝：`sample-member-registry` 新增
`withdrawMemberCommand` 与 `memberWithdrawnCommand`。这不是把 UI 命令移进 kernel，
而是把“撤回 pending、保留 draft、与 confirm/reject 竞态先到者赢”归还给 registry
owner；UI 仍只拥有并派发 `memberSubmissionWithdrawnCommand` 意图。对应 owning source
为该 kernel feature 的 `commands.ts`、`module.ts`、`features/actors/actors.ts`、
`src/index.ts`、README、terminal-invariants 与 focused test；不得把 UI part、layer、
display mode 或 raw error 传入 kernel。

integration：

- apps/terminal/ui/integration/sample-console/src/assembly.tsx
- apps/terminal/ui/integration/sample-console/theme/
- apps/terminal/ui/integration/sample-console/test/
- package.json、terminal-invariants.json、README.md

### 6.3 Command、part、actor 与 mode

最终 catalog partKey：

sample.auth.login
sample.auth.notice
sample.auth.system-notice
sample.desk.member-list
sample.desk.member-form
sample.desk.waiting-confirm
sample.desk.registry-notice
sample.desk.discard-confirm
sample.desk.withdraw-confirm
sample.desk.system-notice
sample.desk.customer-welcome
sample.desk.customer-member

member-desk 删除 noticeDismissedCommand；不复用给 system notice。新增：

- memberFormCancelledCommand
- memberDraftDiscardedCommand
- memberSubmissionWithdrawnCommand
- memberRegistrationRetryRequestedCommand
- memberRegistrationAbandonedCommand
- deskSystemFailureObservedCommand
- deskSystemFailureDismissedCommand

staff-auth 保留 authNoticeDismissedCommand；新增：

- authSystemFailureObservedCommand
- authSystemFailureDismissedCommand

所有 feature-owned public command 在 producer 处经 `dispatchWithRequestId` 生成 requestId，
带 loading 生命周期的业务动作复用 tracked requestId；module、allowed-list、invariants、
focused tests 同步。kernel 业务 command 不因视觉偏好改 owner；本 CP 唯一新增的
`withdrawMemberCommand`/`memberWithdrawnCommand` 是为修复撤回业务事实归属而经授权补回
registry owner 的明确接缝，不能推广成 UI 绕过 owner 的通用模式。

customer-member props：

- preview：双屏只读核对；
- confirm：双屏确认/拒绝；
- handheld-confirm：单屏确认/拒绝/交还店员。

组件只按 mode 选呈现，不导入 display-context、不读取屏数。actor 根据
hasSecondarySurface 选择 mode；所有“副屏回……”只在 actor 的双屏分支。

### 6.4 请求结果、rejection 与 system notice

`useTrackedRequest.finish` 的 requestId 比对和 `useRequestInFlight` 保留；现有部件的
`finally` 形态要改为显式 success/catch，并且不能只观察 Promise rejection。
`CommandDispatchResult` 在
`apps/terminal/kernel/base/runtime/src/types/execution.ts` 明确有
`running`、`completed`、`error`、`timed-out`、`partial-failed` 五种聚合结果；`running`
是非终态，不能清除 loading 或打开 system notice；actor handler
错误通常会以 fulfilled result 返回，dispatcher/ledger 边界才会 reject。

实现顺序：

1. start 原 request；
2. `status=completed`：finish 原 request，保留既有成功 actor/state 链；
3. `status=running`：保留原 requestId 与 loading，不开 notice、不记失败诊断，等待 request ledger 后续终态；
   `aggregateCommandStatus` 在 `completedAt === null` 或任一 actor 仍为 `running` 时
   产生该状态；直接 dispatcher 的正常路径会等待 actor 终态后再返回，但中途
   request ledger、peer/持久化回放或不完整生命周期观察仍可读到 `running`，所以
   不能由未知非 completed 兜底吞掉它；
4. resolved `error`/`timed-out`/`partial-failed`：先 finish 原 request，再运行 feature-owned
   的有限分类。已知 `AUTHENTICATION`/`BUSINESS`/`VALIDATION` 且已有对应 domain
   event/state 的业务失败沿 auth/registry notice，不开 system notice；
5. `SYSTEM`、timeout、含 system actor 的 partial failure、Promise rejection，或
   除 `running` 外无法映射到已批准业务结果的未知非 completed 形状：生成新的 observation requestId，
   派本 feature 的 observation command；
6. observation rejection 仅调用结构化 logger，不再生成 observation；原始 rejection
   继续抛回，调用方不能得到假成功；
6. system notice props 只允许静态 operation，如 submit-member、login、confirm-member。
   禁止 raw error、原始 payload、手机号、设备标识。system notice 的关闭动作是
   feature-owned dismissal command；底层实际关层仍调用 ui-state closeLayerCommand。

focused red 分母必须同时包含：

- 一个 resolved `status=error` 且 error category 为 `SYSTEM` 的夹具；
- 一个 resolved `status=timed-out` 或 `partial-failed` 的夹具；
- 一个 Promise rejection 的夹具；
- 一个已发出 approved domain event 的业务失败夹具，证明不会重复开 system notice。

前三者必须断言 loading 先清、system-notice 可见且 operation 可诊断；第四者必须
断言只出现既有业务 notice。模型红向量与真实 production tree 结果分开报告。

### 6.5 Feature-local controls

本 CP 内先实现：

- DialogSurface：卡片、标题、正文、slot；
- DialogActions：呈现主次动作排列；
- EmptyState：说明与主动作；
- ScrollArea：会员列表/表单唯一滚动祖先；feature wrapper 只转接 `PrimitiveScrollView`，不得退化为 `PrimitiveContainer`/`View`。

四者只在 feature 内组合 existing primitives，所有可寻址节点仍由 primitives
提供强制 testID。props 只能描述呈现。CP-4 结束时统计两个 feature 的真实
重复；没有真实重复就不下沉，不能因为名字“通用”提前改 primitives。

### 6.6 单屏/双屏与失败恢复

双屏 pending：

- actor show PRIMARY member-list；
- actor open PRIMARY waiting-confirm；
- actor show SECONDARY customer-member mode=confirm。

单屏 pending：

- actor show PRIMARY customer-member mode=handheld-confirm；
- 不创建 SECONDARY；
- 不创建 withdraw-confirm；
- hand-back 直接派 memberSubmissionWithdrawnCommand。

双屏 waiting withdraw：

- waiting layer 的撤回打开 withdraw-confirm；
- 业务命令与顾客 confirm/reject 竞态先到者赢；
- pending 不存在时迟到命令 no-op。

customer rejected：

- 双屏保持 customer preview，PRIMARY registry notice；
- 单屏回 PRIMARY member-form，PRIMARY registry notice；
- retry 保留草稿，abandon 清理草稿并回 member-list；
- registry notice 无 dismiss。

logout/cancel：

- 有 dirty draft 才开 discard-confirm；
- waiting 状态没有退出入口，必须先撤回；
- decisive 层不受遮罩/返回键绕过。

### 6.7 CP-4 判据与红向量

| 判据 | 真实树/行为 | 红向量 |
|---|---|---|
| part set | 12 catalog parts，7 layer keys | 删除任一 part registration |
| mode set | 三 mode exact；组件不读屏数 | feature component 加 screen-count if |
| single surface | no secondary 时只一棵 PRIMARY | 强制渲染 SECONDARY |
| waiting layer | standard layer 显示 name/phone/withdraw | 把 waiting 改 screen 或丢撤回 |
| registry notice | retry/abandon 两动作，no dismiss | 恢复 dismiss |
| system failure | loading 先清、notice 可见、raw error 不出 | void/catch swallow 或 props 放 error |
| request identity | 每个 public feature command 显式 requestId | 删除 requestId |
| layer guard | decisive 不可绕过，dismissible 可关 | 互换 guard |
| feature boundary | no className、no direct RN、no business primitive | 直接 import RN 或添加 PrimitiveX |
| scroll | list/form single scroll owner | page+list 双滚动 |

## 7. §12.1 v13 修订清单落段

| v13 修订项 | 落段 | 具体计划落点 |
|---|---|---|
| 场景 8 dismiss→retry/abandon | CP-4 | RegistryNotice、actors、focused |
| §4.4 三处→四处 | CP-4 | actor topology table |
| §6.9 testID | CP-4 | interaction/IA roster + component tests |
| S-15 layer denominator | CP-4 开工闸门 | type=6 / partKey=7 / exact set |
| S-16 三 mode | CP-4 | CustomerMember props + actor |
| customer-member props | CP-4 | parts catalog + component type |
| P-11 requestId | CP-4 | all feature command producers |
| P-12 allowed-list | CP-4 | module commandDefinitions/invariants |
| new layer contracts | CP-4 | four new part registrations; two system keys |
| actor listener table | CP-4 | two feature actors |
| waiting withdraw chain | CP-4 | waiting component → command → actor → registry |
| command/module table | CP-4 | commands.ts/module.ts |
| layerId examples | CP-4 | partKey=layerId exact |
| X-8 withdrawal | CP-3 + CP-4 | render overlay, waiting remains layer |
| theme/app ownership | CP-3 | sample-console/theme |
| v13 §6.7b wording | CP-1/CP-3 | fixed canvas vs proportional components |

## 8. §9 比例静态门的处理

T-1 仍是 DEXTER_DECISION。本计划不建立该门、不建立其红向量、不把“门未建”
写成比例要求已被机械保障。CP-3/CP-4 仍必须：

- Web canvas 使用 terminalSurfaces 固定目标逻辑尺寸；
- 部件内部使用 theme token、比例单位或由 surface 尺寸派生的值；
- 逐屏交互/IA 声明容器滚动与溢出边界；
- 由 fresh 独立 review 人工核对裸绝对像素是否造成跨机型偏差。

若 Dexter 裁定建门，必须另起一个明确授权的 gate 变更，先定义能力来源、
分母、真实生产树 PASS 和真实坏用法 red；不得在 CP-4 中顺手补。

## 9. 每 CP 证据与三维对账

每 CP 需要两类分开的结果：

1. 真实树/真实行为：当前生产源码、focused test、类型检查或已授权运行；
2. 模型红向量：只证明门能捕获坏形态，不能代替真实树结果。

每 CP 收口：

- 逐项重读需求；
- 逐项重读本计划、详设、IA、交互线框；
- 逐项重读项目记忆中 TER topology、TR-11/TR-12、owner、single source、
  invisible dimension 和已登记 pitfalls；
- fresh independent subagent 只读对账后，主 agent 才能进入下一 CP；
- 全部 CP 完成后、整体测试前，再做一次全批三维对账。

本批不授权运行，因此当前 evidence 只定义路径，不声称任何 gate PASS。

## 10. 停止条件与交付

任一条件命中立即停止并交 Dexter：

- 本机版本解析无法证明 NativeWind/Tailwind 与 Expo/RN 组合；
- 需要改 kernel port、业务包或 assembly 以承载工具链；
- 出现第二 store、第二 runtime、第二 React instance 或第二套 layer 通道；
- layer partKey 分母或单屏顾客拒绝去向仍未修正；
- render 需要 feature 依赖；
- system failure 仍静默或递归；
- 单屏仍产生 SECONDARY 或组件按屏数分支；
- T-1 未裁定却新增比例静态门。

正常交付顺序：

1. 详设、交互详设、IA、计划经 Dexter/Claude 静态 review；
2. Dexter 单独授权 CP-1；
3. 每个 CP 按本计划独立对账和 fresh review；
4. 四段完成后再交整批 implementation review。

## 11. 计划完成状态

PLAN_STATUS=READY_FOR_IMPLEMENTATION_UNDER_DEXTER_AUTHORIZATION
IMPLEMENTATION_AUTHORITY=false
CURRENT_EVIDENCE=文档静态自审；未运行任何命令
IMPLEMENTATION_ADMISSION=OPEN_UNDER_DEXTER_2026_09_05_AUTHORIZATION
NEXT_REQUIRED_DECISION=按 CP-1 至 CP-4 执行；每个 CP 仍须 focused proof 与 fresh 独立静态 review
