# TER 版本更新阶段 A 设计包 · 外部独立 DESIGN 评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
reviewerKind=EXTERNAL_CLAUDE_STATIC_DESIGN_REVIEW（经 Dexter 中转）
SESSION_PROVENANCE=续接会话（v2s 仓根），非 fresh；本会话此前曾口头对抗性评审本专项正式需求，未参与阶段 A 设计包写作
NOT_A_SUBSTITUTE_FOR=内部 DESIGN cycle（已在 R2 硬停止）；本评审不重开内部 cycle
AUTHORIZATION=仅静态评审阶段 A 文档与指定源码/API；不授权实施、改需求/规范、依赖、生成、编译、测试、verify、DEV、Web、设备、reset/seed、L2、UAT、部署或 B/C
```

## 0 · 对象与亲验哈希

本轮重新计算的 SHA-256 与 intake §46-55 一致：

| 文件 | 前 16 位 |
|---|---|
| 详设 `…stage-a-implementation-design-claude.md` | `1fa3f3eb70237ba3` |
| 计划 `…stage-a-implementation-plan-claude.md` | `8d3f8e7d9f12b229` |
| 附件 `…stage-a-source-and-api-appendix-claude.md` | `760529efaefbc43b` |
| Journey / IA / UI | `12573920fd97b4c4` / `ed422efd4a13e1e1` / `61a4e6692893f232` |
| 正式需求（只读） | `f4ae511b8691710f` |
| 讨论稿（只读） | `707172f77399323f` |

判断顺序如下：

1. 先从正式需求 §20.3、§20.7、§20.8 与 R-08～R-14 独立推导阶段 A 应有的行为；
2. 再读当前设计与源码；
3. 最后读 intake 与 R1/R2，不继承作者处置，也不继承旧字节的 verdict。

源码读自当前工作区字节；automation 仍由 Codex 收尾，其接口按当前字节核对。

## 1 · 结论

```text
VERDICT=NO-GO
M/S/N=0/3/5
L1_ENGINEERING=S-1 原生选包未绑定已安装 APK 身份；S-2 installer“会话已消失且版本未达”永久 UNKNOWN 无出口；S-3 内嵌发布改为每次安装后复制到文件目录再加载，给正常启动新增失败面
L2_USER_VISIBLE=静态未见阻断；N-3 原生失败面的观察通路在详设与 UI 工件间矛盾；三个面线框 UNSET
L3_UNVERIFIED=见 §6
SAME_ROOT_SCAN=见各 finding
DESIGN_GAPS=沿用：verification-governance.md 未定义 M/S/N
TEMPLATE_COVERAGE=四模板逐节已有（详见 §5）；内容缺口见 S-1/S-2/S-3
EVIDENCE_TIER=静态文档 + 当前源码 + node_modules 中 Expo/RN 精确版本源码；无运行
```

主干方向成立，不需要换路线。3 个 S 都是可用文字修正的具体缺口，但若不在设计阶段修正，会在 CP-03/04 的真实设备上首次暴露：一个导致 JS 版本错误，一个导致永久卡死，一个导致启动失败。

## 2 · 方案合理性

**问题对不对。** 对。阶段 A 要先证明“包确实能更新设备”，同时保证不错报成功、不循环加载坏包。详设 §1 的目标与需求 §20.3 一致；本阶段没有后台、规则或手工更新入口，没有越出范围。

**方案优不优。** 下面逐项列出我独立构造过的替代方案，以及与详设方案的比较：

- **加载路线。** 我核对了 node_modules 中的源码：
  - `ExpoReactHostFactory.kt:42-77`：`jsBundleLoader` 是 getter，每次访问都重新读取 `hostHandlers.getJSBundleFile`；若返回值以 `assets://` 开头则用 asset loader，否则用 file loader。
  - `ReactHostImpl.kt:1145-1187`：每次创建实例都会读取 `reactHostDelegate.jsBundleLoader`。

  因此“同一 Host 加 reload”有公开的源码依据，比整进程重启（受后台启动限制、要恢复双屏 Activity）更简单，也比引入 expo-updates 的第二套选包与清单更简单。选择成立。
- **boot 身份。** 每个 ReactContext 在实例层面绑定一次 reservation，并把旧 context 先绑定到旧 reservation（L203-212）。
  - 这是在 TurboModule 懒初始化前提下，防止旧 Runtime 迟到确认的最小做法。
  - 我构造过一个更简单的替代：“JS 自己读取 token 后回传”。它在旧 context 的模块迟到初始化时会读到新 token，因此不成立。
- **installer 协议。** 一份 native action 记录配合系统 session 事实，不建第二账本，方向正确。但还有一个出口缺失，见 S-2。
- **内嵌发布复制到文件目录**（L141）。这一处偏复杂，有更简单的替代，见 S-3。
- **TR-09 例外。** 本身是有限例外，但理由需要更正，见 N-1。

**代价配不配。** 6 个 CP、14 个 case 与“双 App × 两种形态 × 原生安装/加载/保护”的真实范围相配。预算（§8.8）是候选值，并标明待测。

**UI 自问。** 三个面分别是：

- OS 的安装与设置面；
- 既有启动加载层；
- 原生只读失败文本。

都来自 R-10、R-11、R-14，没有新增 TER 操作，路径已是最短。失败文案「更新未能启动，请联系管理员」合理，看图前保持 UNSET；不存在产品层面的歧义。

## 3 · Findings

### S-1 原生“已选入口”没有绑定当前已安装的 APK 身份，APK 变化后可能继续加载旧 HOT

- **位置。** 详设 L148（`getJSBundleFile` 每次读取原生已选入口）、L163（readFacts 返回 embedded/selected/previous）、L171（原生原子记录只保存 selection/previous/candidate/boot/action）、L179（FULL 读回成功后新 boot 运行内嵌 JS，再续接 HOT）、L198。
- **仓内与外部事实。**
  - selection 记录存放在 app 私有文件目录，APK 覆盖安装后仍然保留。
  - 正式需求 V-10 要求“原 JS5 → FULL 内嵌 JS4 启动读回 → HOT JS6”，即 FULL 之后必须先运行新 APK 的内嵌 JS。
  - R-02 允许旧 APK“经外部分发安装”，所以 APK 也可能不经本模块的 FULL 路径而被替换。
- **推论。** 详设没有写明冷启动时由谁、依据什么，把 FULL 之前的 HOT selection 作废。若 runtime 字符串相同，例如 FULL 只升 nativeBuildNumber、没改 runtime，loader 会继续加载旧的 HOT JS5，而不是新 APK 的内嵌 JS4：
  - V-10 的中间读数据证明因此落空；
  - 如果发布者漏改 runtime（需求 R-01 已接受“人工漏改风险”），旧 HOT 会运行在新原生上。

  L198 只限制了“可否作为回退目标”，没有限制“当前 active selection”。
- **反例。**
  - 第一个：APK1 + HOT JS5 处于 active，FULL 到 APK2（runtime 相同，内嵌 JS4）。新进程冷启动时 loader 读到 selection=JS5，于是加载 JS5；task 的 FULL 读回成功，但实际 JS 并不是 V-10 所要求的内嵌 JS4。
  - 第二个：MDM 外部安装了 APK3，内嵌 JS7 高于 JS5。冷启动仍加载 JS5，相当于静默降级。
- **影响。** 实际运行的 JS 版本错误；R-15 要求报告的实际版本也随之不可信。
- **最小修正。** 在 §8.4/§8.7 写明一条原生规则：
  - selection、previous、candidate 记录都保存创建时的已安装 APK 身份（versionCode 加内嵌 publicationId，或 PackageInfo 的 lastUpdateTime/签名摘要中选一个稳定值）；
  - 冷启动 `beginBoot` 时，若与当前已安装 APK 身份不一致，则作废 selection 与 previous 的加载资格（记录保留作诊断），改为加载内嵌发布；
  - 由 owner 在 readback 中看到“APK 已变化、选包已复位”的事实。

  新增两个反例场景：同 runtime 的 FULL，以及外部安装更高 APK。挂在 `update.full-hot` / `update.compatibility`。
- **需 Dexter 裁决。** 否。

### S-2 「session 已消失且版本未达」被定为永久 UNKNOWN，任务没有任何出口

- **位置。** 详设 L190（“无法核实时保留未知，不轮询重复提交”）、L219（“不能证明或 session 消失且版本未达时 UNKNOWN，不 create 另一个 session/重复 commit”）、L232。
- **推论。**
  - 本 adapter 是唯一的 session 创建者（L217）。`getMySessions` 中已没有本 action 的 session，且 PackageManager 读回仍低于目标时，说明系统里已经没有进行中的安装；无论之前是否 commit 过，都已以“未安装”结束。这时已无“未知”可言，重新受理不是 R-10 所禁止的“盲目重复提交”。
  - 按现文，task 永远停在 UNKNOWN。R-09 规定“每个 boot 优先续接未终结任务”，后续一切规则都无法进入；本期又没有手工重试，设备的更新通路从此被锁死。
- **反例。** 在 COMMITTING 写入之后、commit 调用之前进程被杀；系统随后清掉了未提交的 session（或在不提供 `isCommitted` 的旧 API 上无法区分）。此后每次 boot 都读回 UNKNOWN，永不推进。
- **影响。** 正式需求只接受“用户长期不确认安装”导致的等待（R-09/R-11），没有接受技术性的永久死锁。
- **最小修正。** 把“本 action 的 session 已不存在、实际包未达目标、记录为 INTENT/STAGED/COMMITTING”定义为 `ENDED_NOT_INSTALLED`：
  - 回到 WAITING_USER，在下一次可呈现时以新 action/session 重新邀请安装，语义与“明确用户取消”相同；
  - 不标坏包、不进入 FAILED，也不是面向用户的手工重试；
  - 只有 session 仍存在却无法判定状态时，才保持 UNKNOWN。

  `update.install-result` / `update.interruption` 增加该反例。
- **同根。** L216 的 `BUSY_UNKNOWN`（存在非空、但无法归属的 session）同样需要写明出口，或写明为什么不会出现：唯一创建者，加上 INTENT 记录。
- **需 Dexter 裁决。** 否，这是对 R-10“先观察、读回”之后结果的精确化。若 Dexter 认为任何不确定都必须人工处置，则属 `DEXTER_DECISION`，因为需求明确不提供手工重试。

### S-3 内嵌发布改为“每次安装或 FULL 后复制到文件目录再加载”，给所有正常启动新增一个失败面，而公开接缝本身支持 `assets://`

- **位置。** 详设 L141（APK 将完整发布树保存在 `assets/terminal-release`，由 native 初始准备复制到本机同布局只读目录，再用文件 loader）、L209（没有获准入口则 throw 并显示原生失败，不退回默认 assets）。
- **仓内事实。**
  - `ExpoReactHostFactory.kt:70-72`：`getJSBundleFile` 返回 `assets://…` 时使用 asset loader。
  - `AssetSourceResolver.js:112-135`：从文件系统加载 bundle 时，图片走 `drawable-*` 目录；从 asset 加载时走 APK res，这是 RN 默认的 release 路径。
  - 两个 App 的 Gradle 当前使用 RN 默认打包（`build.gradle:62` debuggableVariants=[]），图片进入 res。
- **推论。**
  - 复制的唯一理由，是让内嵌发布与 HOT 树的“资源字节一致”。但内嵌发布身份可以在构建时对同一发布树计算 publicationId，写入签名 APK 内的 metadata（R-01 允许两种封装形式不同），运行时无需逐字节比较 drawable。
  - 复制方案带来的代价：
    - 每次全新安装和每次 FULL 之后，JS 启动前都要复制整棵发布树；
    - 存储空间翻倍；
    - 首启变慢；
    - 磁盘不足或复制中断时，按 L209 只能显示原生失败。原本一定能启动的全新安装，从此可能因空间不足而无法启动。

    现在正常工作的生产启动路径被改造，回归面覆盖所有设备。
- **影响。** 违背“当前最简单、可靠”的原则；新增的失败模式与 HOT 无关，却会影响每一台终端。
- **最小修正（推荐 a）。**
  - **a：内嵌发布保持 RN 默认的 asset 与 res 路径。** handler 对 embedded 返回 `assets://<bundle>`，只有 HOT 与获准恢复目标走文件根和 `drawable-*/raw` 布局。内嵌身份使用构建时写入签名 APK metadata 的 publicationId。F-LOAD 同时证明 embedded（asset）与 HOT（file）两条路径的图片和字体离线可用。
  - **b：保留复制。** 但需写明复制失败时如何仍从 asset 启动内嵌发布，并实测复制体积与耗时。L209 的“不退回默认 assets”只应针对 HOT 与获准恢复目标的缺失，不应针对 embedded。
- **需 Dexter 裁决。** 否，属于工程取舍。

### N-1 TR-09 例外的触发理由需要更正，才能让 Dexter 依据真实范围裁决

- **位置。** 详设 L168（“为满足 R-09 固定任务/角色改变不抢占……取消激活/角色或 Runtime root reset 应保留”）、L344。
- **仓内事实。** 全仓唯一调用 `requestApplicationReset`（根级 state 清除）的位置，是 `kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:193`（`TERMINAL_ACTIVATION_CANCELLED`）。下面三处都是 JS 重载，不清 state：
  - topology 角色切换：先 flush 再 `appControl.resetRuntime`（`topology/src/features/actors/actors.ts:430-436,563-567`）；
  - 系统失败 reset（`resetRuntimeAfterSystemFailureActor.ts:23`）；
  - TDC 的另一处 `resetRuntime`（`terminalDataClientActor.ts:1961`）。
- **推论。** 需要例外的真实场景只有一个：终端被取消激活。
  - “角色改变”不会导致根级清除，不应作为理由，也不应写进 TR-09 的例外正文。
  - R-10 的依据仍然成立：如果取消激活能清除坏包标记，它就会成为事实上的“清除失败标记入口”。
- **修正。** 在 §8.4/§12 将触发范围收窄到 `TERMINAL_ACTIVATION_CANCELLED`，把它作为提交 Dexter 的裁决依据，并在提案中写明另一种选择及其代价：
  - 不加例外，取消激活即清空 JS 更新状态；
  - 但需要定义无 JS task 时 native 侧遗留 action/candidate 的处置，并接受坏包标记随取消激活一同丢失。
- **需 Dexter 裁决。** 是（规范例外本身已是 `DEXTER_DECISION`），本条只更正裁决依据。

### N-2 Web 的 typed port fixture 没有写明构建边界

- **位置。** 详设 L170（“Web 的 typed fixture 用于状态机验证”）；计划 L48-49。
- **推论。** R-08 规定“Web 无真实 native 能力，不用默认模拟器冒充安装成功”。详设已为 source provider 写明“仅 automation-enabled 测试构建、生产构建有红例”（L160），但没有为 Web 的模拟 UpdatePort 写明同样的边界。
- **修正。** Web 生产构建使用 unavailable UpdatePort；typed fixture port 只注入 automation-enabled 的 Web 测试构建，并配一条打包红例，与 L160 同形。

### N-3 原生失败面的观察通路，详设与 UI 工件说法相反

- **位置。** 详设 L82（driver 读回 Android 屏幕与可访问性节点）、UI L96，对比 UI L142（只有安装和设置界面可用 driver 内的 uiautomator）。
- **事实。** automation 正式需求 R-10（`…automation-agent-formal-requirements-claude.md:271`）允许 driver 对“不在 React 树内的界面”使用 uiautomator，并在报告中注明。原生 `TerminalUpdateStartupFailureView` 属于这一类。
- **修正。** UI L142 改为：安装、设置与原生失败文本三类非 React 界面，可使用 driver 内的窄例外；TER 的 React 节点仍走 agent。

### N-4 附件中 RN 官方源码链接的组织名可疑

- **位置。** 附件 L35 `github.com/react/react-native/blob/v0.86.3/…`。
- **说明。** RN 官方仓库通常是 `facebook/react-native`。本会话无法联网核实是否存在重定向（UNVERIFIED）。按第三方规范，应改为可核实的精确 tag 链接。

### N-5 关键原生可行性 F-LOAD 排在 CP-01/02 之后

- **位置。** 详设 L37-39、L96、L152；计划 CP-03 第 5 步。
- **推论。** 需求 §20.3/§20.9 要求“先消除 Hermes 加载、资源、安装、启动保护这一高风险未知”，并允许“短技术探针作为后续获授权阶段的内部前置”。现计划先完成 CP-01 与 CP-02（含 TR-09 规范前置），再首次验证加载。
  - 若 F-LOAD 被证伪而需要改走整进程路线，CP-02 的 owner 状态机基本可以复用，所以返工有限，定为 N。
  - 但 S-1、S-3 涉及的选包与 asset 行为，最好与加载一起尽早证实。
- **修正（可选）。** 在实施授权中单列一个不进入产品代码、用后即弃的 F-LOAD 探针，放在 CP-02 冻结端口形状之前。它不构成第二条 HOT 路径，也不触发产品 HOT。

## 4 · 已亲验事实

- **Expo 与 RN 加载接缝**（expo 57.0.18、RN 0.86.3，读自 node_modules）：
  - `jsBundleLoader` getter 每次重新计算，并支持 `assets://`；
  - `onWillCreateReactInstance` 只在首次建立 Host 时调用（`ExpoReactHostFactory.kt:107-125`），与附件 L54 及详设 L205 一致；
  - `onReactContextInitialized` 会回调 `onDidCreateReactInstance`；
  - `handleInstanceException` 会交给 hostHandlers 处理。
- **三条 resetRuntime 通路与一条根级清除通路**：如 N-1 所列。`TerminalAppControlModule.kt:14-17` 只做 `reactHost.reload`。
- **TR-09 现行正文**（`terminal-coding-standard.md:363-369, 383-384`）：只有 server-config 是例外，下游不得自行豁免。`createStateRuntime.ts:80-84` 的 retain 是通用机制。
- **automation 当前字节**：
  - `runner.ts:29` 的 phase 闭集里没有 update；`runner.ts:485` 只有 journey 接入 DEV。
  - `fixtures/managedActivation.ts`、`terminalActivation.ts` 与 TDC 的 `acceptance/operationsFixture.ts` 都已存在。
  - `check-runtime-resource-budget:29` 已有 `terminal-automation/` 加精确 kind 的登记。
  - `androidBuild.ts` 已有“每个 run 一个 applicationId 后缀”、`-PterDisableNativeDevSupport=true`，以及可选 release 构建。
- **两个 App 的 Gradle**：`versionCode 1` / `versionName "1.0.0"` 写死；release 使用 debug 签名（`build.gradle:182-203`）。与附件、Journey 中“企业签名 OPEN”的说法一致。
- **automation R-10 窄例外**：原文在 automation 正式需求 L271。
- **intake 与 R2**：本评审独立发现的 S-1、S-2、S-3、N-1 均不在 R1/R2 的 finding 中。R2-S1（TR-09）由 N-1 部分细化。

## 5 · TEMPLATE_COVERAGE（逐节，本轮亲验）

- **journey-decision §1–§7**：有。§3 前提链分为三类，企业签名为 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`；§7 的裁决项待接受。
- **ia-design §1–§6**：有。三个面的可见与不可见维度、全部错误族、交叉对账都在。
- **ui-interaction §1/1.1/1.2/2/3/4/5–10**：有。表单、mutation、搜索、候选相关节均标 N/A_WITH_REASON（OS 或原生只读面）；看图 UNSET。
- **implementation-design §0–§14**：
  - 有：§3 横切表、第三方依据、§3a、§9a/9a.1/9a.2、§10b.1–10b.6、§11a、§13b、§13c。
  - 内容缺口：§8.4/§8.7 缺 APK 身份绑定（S-1）；§8.7 的 installer 窗口缺 `ENDED_NOT_INSTALLED` 出口（S-2）；§8.1 的内嵌路线见 S-3。

## 6 · 未验证（L3_UNVERIFIED，以产品负责人能决策的话表述）

1. **三个面没人看过图。** 系统安装/设置面、启动加载、原生失败文本的线框均 UNSET。
2. **加载与原生运行行为都没跑过。** Expo handler 是否真的注册、同 Host reload 是否加载指定 HBC、HOT 图片与字体是否离线可用、原生 60s 期限、旧 boot 的迟到确认、一次恢复，均 NOT_RUN。
3. **签名与安装条件未确定。** 企业签名、目标 API、设备的安装资格与静默安装条件，以及实际 Gradle/Maven 的 Hermes、Commons Compress 解析，均 OPEN。
4. **数据兼容与预算都没测。** 两个 App 的中间包与上一成功包能否读取新数据（F-COMPAT），256MiB/512MiB/60s 等预算是否成立，均 NOT_RUN。
5. **TR-09 例外尚待 Dexter 批准**，在此之前 CP-02 不能开始。
6. **automation 尚无 update phase。** 所有新能力、V-01/02/16/21–26 子判据以及 cleanup，均 NOT_RUN。

## 7 · 处置建议

S-1、S-2、S-3、N-2～N-5 均可由作者在既有边界内修订文档关闭，不涉及新产品范围。N-1 只是更正理由，规范例外仍等 Dexter 裁决。

修订后的差量复核范围：详设 §8.1、§8.4、§8.7（含 installer 表）、§9a、§11a 新增反例、§12；UI L142；附件 L35；计划 CP-02/03。本结论不授权任何实施或运行。

## 8 · Dexter 裁决（2026-10-06，本会话）

- **TR-09 例外：按 N-1 批准。** 例外内容如下：
  - 只覆盖终端取消激活引发的根级 state 清除。唯一触发点是 `kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:193`，原因码 `TERMINAL_ACTIVATION_CANCELLED`。
  - `kernel/base/terminal-update` 可在自己的 owner-only 持久化 slice 上声明 `resetIntent: 'retain'`，只保留该 descriptor 实际落盘的 currentTask、recentStatus、failedArtifactIds。
  - 非持久运行态、其他 owner、orphan 键照常清除；sync 保持 isolated。
  - 不以“角色改变”为理由，也不扩大到 TDC 凭证或其他 owner。
- **落地要求不变。** 例外正文只写进 `doc/platform/terminal-coding-standard.md` TR-09 唯一正本，须在 CP-02 之前落地，并配有 focused/red 验证（update 持久字段保留；ephemeral、其他 owner、orphan 仍清除）。

本裁决关闭 OPEN-STANDARD 的产品与规范取舍，不等于授权现在修改规范文件：规范落地的时机与授权，随未来的实施授权一并给出。S-1、S-2、S-3、N-2～N-5 仍由作者修订。
