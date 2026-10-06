---
title: TER automation-agent 统一 UI 自动化正式需求
status: PROPOSED_FORMAL_REQUIREMENTS
createdAt: 2026-10-05
author: Claude
implementationAuthority: false
reviewTarget: DESIGN
reviewCycleId: TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
---

# TER automation-agent 统一 UI 自动化正式需求

## 0. 目的、依据与授权

### 0.1 要解决的问题

TER 在原生端跑自动化测试有三个痛点（Dexter 原话）：定位组件麻烦、触发组件动作麻烦、state 是黑盒只能靠日志验证。现有约 1.85 万行 runner 依赖 uiautomator dump、坐标点击、固定等待和 logcat 解析（讨论稿 §3.1）。

本专项新建一个统一的 App 内自动化包 automation-agent 和一个主机侧脚本库 automation-driver。同一份旅途脚本，既能跑 integration 的 Expo Web，也能跑 application 的原生 Android。脚本可以定位、查询、触发控件，可以订阅任何包已登记的 selector，可以发任何 command 并跟踪执行结果。

### 0.2 依据

- 讨论稿：`doc/plans/platform/2026-10-05-ter-ui-automation-requirements-discussion-claude.md`。原话、仓内事实、方案比较与第三方事实见该稿。本文件是本专项的需求正本；与讨论稿有出入时以本文件为准。
- Dexter 2026-10-05 会话裁定（逐字）：

> 1，我希望这个automation包是个超级全能包，可以发command，可以访问full state，可以访问任何包的selector，没有任何能力限制。2，不限制automation包的使用场景，在package.json中增加开关及连接服务器参数，只要打开就能用，不管是生产包还是调试包。3，我希望本地测试脚本的访问与控制能力能发挥automation包的能力。

> 1，修改TR-08的要求，对automation是例外。所有代码都要包含automation包，只在package.json中做开关。2、3，我说错了，automation不需要直接访问full state，全部通过selector访问数据，每个包都需要在runtime中登记selector。4，不需要automation包执行动态脚本，automation需要提供基础能力，比如外部的测试脚本要订阅TDC的连接状态，就要传连接状态的selector和参数给automation包，收到后就执行订阅，每次数据变化就将数据通过WS传出来。再比如腕部的测试脚本要执行command，将参数给automation包，收到后就发送command并订阅requestID，讲command执行结果通过WS传出来，等等

> D1保留，D2要机械门，D4不做任何处理不脱敏，D7只覆盖automation。这个包就叫做 automation-agent吧？合适么

> 待定项中，D6要全部删除，D8要完全重建，其余的都按你的推荐。另外，详设和实施阶段必须建立相应skill，不然后续的agent不知道这套automation agent机制如何使用

> D11、D12都按你的推荐

Dexter 2026-10-05 在本会话中对 Rive 软键盘需求草案（`doc/plans/platform/2026-09-30-ter-rive-soft-keyboard-requirements-claude.md`）说：

> 需求删了吧，不改了

需求评审收口后，Dexter 对 §7 的待决项裁定（逐字）：

> 1，不并行，等codex做完。2，同意。3，不管几批要一次性顺序做完。4，忽略这个需求吧，不用管他了。5，允许HOT打开开关，不需要过度限制

- 对应关系：1 → D-1，2 → D-2（选项 a），3 → D-3，4 → Rive 软键盘草案（I-2），5 → HOT 与开关（I-3）。

Dexter 2026-10-05 追加（逐字）：

> 我希望把rxjs的包加入到automation agent中，帮助实现各种订阅或其他能力，不用再重复造轮子。请你加入到需求中，并把可以简化automation agent工作的地方都解释清楚。你觉得如何？

- 对应 R-19。

Dexter 2026-10-05 追加（逐字），针对作者对其他第三方库的推荐：

> 根据你的推荐来写吧，写完再复核

- 对应 R-20。

- 第二条中的“腕部”按上下文理解为“外部”。
- 讨论稿 §7.1 汇总了以上裁定，本文件 §2 逐条落为要求。
- 业务语料：在 `project-memory/decisions/confirmed-business-language-corpus.md` 中检索 automation、自动化、selector、testID、testId、测试、终端，结果为 `NO_CORPUS_ENTRY_MATCHED`。本专项不涉及业务术语。
- 禁推：
  - 不得从现有 runner 的做法反推 automation-agent 的协议；
  - 不得从 POC 的 30 个方法反推能力清单；
  - 不得把本需求读成对 `scripts.execute`、TDP、业务包行为的授权或要求。

### 0.3 授权

本次指派原文：“先不做spike了。请生成正式需求文档，并完成几轮对抗式review，最后自审上下文冲突和一致性问题”。

- 本文件只是需求，不授权详设定稿、实施、新增依赖、修改规范正本、构建、设备或任何运行。
- 讨论稿计划的 spike 本次不做。它要证明的可行性事实，改为实施中先行证明的准入闸（§3、§8）。

## 1. 术语

| 名词 | 含义 |
|---|---|
| automation-agent | App 内的自动化包 `apps/terminal/ui/base/automation-agent`。Web 与 Android 共用同一份 TS 代码 |
| automation-driver | 主机侧的 Node 脚本库，放在 `tools/` 下，不进入 `apps/terminal` 依赖图 |
| 旅途脚本 | 用 automation-driver 写的端到端测试，一份脚本两端执行 |
| 基础能力 | automation-agent 对外提供的协议方法（R-05～R-11）。脚本只传名字和参数，agent 执行并经 WS 返回或推送 |
| 真实输入 | 由 driver 经平台输入通道完成的操作：Web 用 Playwright，Android 用 `adb shell input -d <displayId>` |
| 语义动作 | 由 agent 直接调用控件回调（例如 `onPress`）完成的操作 |
| selector 登记 | 每个拥有 state selector 的包在 runtime 中按名登记自己的公开 selector，见 R-05 |
| 控件注册表 | agent 内记录可寻址控件的表，由 `ui/base/primitives` 统一上报，见 R-08 |
| RxJS | agent 与 driver 内部实现事件流的第三方库 `rxjs`，见 R-19 |
| 其他第三方依赖 | adbkit、zod、pixelmatch 等，见 R-20 |

## 2. 必须满足的要求

### R-01 包、标识与依赖方向

- 三重标识按 `doc/platform/terminal-coding-standard.md` §2-A 由目录派生：
  - 目录：`apps/terminal/ui/base/automation-agent`；
  - moduleName：`ui.base.automation-agent`；
  - npm 包名：`@catering-v2s/ui-base-automation-agent`。
- 放在 `ui/base`：控件注册与测量依赖 RN，而 kernel 不得依赖 react / react-native。
- 依赖方向：
  - automation-agent 只依赖 `kernel/base` 与 `ui/base` 的包，不依赖任何 feature、integration 或 application 包；
  - `ui/base/primitives` 提供上报接缝，不依赖 automation-agent；
  - automation-agent 不新增平台端口（`kernel/base/platform-ports/README.md:33`：automation 不进端口），也不依赖 adapter；
  - 具体依赖哪些包由详设定，须符合 `tools/terminal-skeleton/check-static.mjs` 的方向规则。
- 新包登记进 `apps/terminal/skeleton-graph.ts`。随之更新写死包数的测试：`tools/terminal-skeleton/verify.test.mjs`（`expectedLintPackages.length`）及其他受影响的固定计数，由详设盘点。
- 按 TR-10 提供中文 README；按 TR-09 声明自己是 owner 还是 toolkit。
- 新包与所有公开面变化的包，同步各自 `terminal-invariants.json` 的 `publicExports`（由 `tools/terminal-skeleton/check-static.mjs` 消费）。
- automation-driver 放在 `tools/` 下，具体目录名由详设定。

### R-02 始终打包，package.json 开关

- 所有构建都包含 automation-agent，生产包与调试包相同。
- 开关与连接参数写在 package.json，打包时读入，改了要重新打包：
  - Android：每个 `apps/terminal/application/android/<app>/package.json`；
  - Expo Web：对应 `apps/terminal/ui/integration/<app>/package.json`。
- 字段名与读入方式由详设定，须与现有 `terminalSurfaces`、`serverSpaces` 等 application 输入同形。
- 开关关闭时：
  - agent 不启动，不建立连接；
  - 控件注册接缝保持 no-op，不改变渲染行为。
- 开关打开时：
  - 启动后按配置连接；
  - 连接成功即可使用 agent 的全部基础能力（R-05～R-11），不设能力子集或分级。driver 侧的真实输入另需平台通道，见 R-03。
- 不提供已安装包的运行期修改开关入口。

### R-03 传输与会话

- App 作为 WebSocket 客户端，主动连接 package.json 配置的地址；设备上不开监听端口。
- 本地测试：
  - Android 经 `adb reverse` 连接主机；
  - Web 直接连接 `localhost`。
- 也可以连接局域网或远端测试服务器，此时 WS 连接不依赖 adb。但 Android 的真实输入只能经 adb 通道（R-10），没有 adb 时只能使用 agent 侧能力，包括语义动作。
- driver 作为 WS 服务端：
  - 一个服务端可同时接受多条连接；
  - 每条连接带设备与 App 身份；
  - 双机场景就是两条连接。
- 两种身份分开：
  - **runtime 身份**是业务 Runtime 的 `runtimeId`（`kernel/base/runtime/src/application/createRuntime.ts` 在 Runtime 创建时生成，只读）。只有 App 重启或 JS reload 重建 Runtime 时才会变；
  - **连接会话身份**是 automation 每次建立 WS 连接时的会话 id。每次重新建立连接都会变，包括只是断网后恢复、Runtime 并未重建的情况。
- 重连：
  - App 重启、JS reload 或断网恢复后自动重连，建立新的连接会话；
  - 订阅与推送绑定连接会话：旧会话上的订阅全部失效，不得把旧会话的推送当成新会话的结果；
  - 断网恢复不得为了换身份而重建业务 Runtime。
- 重连用 RxJS 实现（R-19），退避间隔与上限由详设定。远端正常关闭与异常断开都要自动恢复；本地主动关闭、开关关闭与销毁时不重连。连接失败不得影响 App 正常运行。
- Web 端与 Android 端使用同一套协议与同一份 agent 代码。平台差异只允许出现在连接建立与 bounds 换算这两处。

### R-04 连接面最小要求

以下四条是连接面的最小要求，不限制能力：

1. 开关默认关闭，必须在 package.json 中显式打开；
2. 连接参数中带一个会话令牌，driver 校验通过后才下发指令；
3. 连接地址不是 `localhost` 时必须使用 `wss`，并校验服务端证书；
4. 开关打开的构建，在启动日志和共享 admin console 中能看出 automation 已启用及其连接地址。

- 这四条各自防住什么：
  - 令牌由 App 携带、driver 校验，只防止陌生 App 连进 driver，不能防止有人控制终端；
  - 终端侧的安全前提是配置地址可信：谁能占用这个地址，谁就能下指令；
  - 地址不是 localhost 时，还要依靠 `wss` 的证书校验。
- 令牌写在 package.json，会随 bundle 和仓库一起分发。这是“连接参数写在 package.json”这一裁定的直接后果，须由 Dexter 知悉（§6）。
- 这是 TR-08 原反例“代码在产物里、默认不启动”在本例外下的接受形态（R-15）。
- 令牌的生成、注入与校验方式由详设定。令牌不得写入日志。
- 第 4 条是唯一新增的可见界面：`UI_BEARING=true`，只限这一处。
  - 只显示两项构建期常量：是否启用、连接地址。不显示实时连接状态，因此 agent 不必为这一行成为拥有 slice 的 owner；连接状态由 driver 侧与启动日志观察。
  - 详设阶段须为它补交 IA 与交互工件：放在共享 admin console 的哪一页、文案和 testID。
  - 复用 `ui/base/admin-shell` 的现有页面结构，不新建页面体系。
- 生产化安全（审计、轮换、权限分级）不在本期范围，登记到 `HANDOFF.md` 欠账。

### R-05 selector 登记

- **范围**：每个拥有 state selector 的 runtime 模块，在 runtime 中按名登记自己对外公开的全部 state selector。runtime 提供按名查找与按名求值，与 command 按名分发同形。
  - Dexter 原话是“每个包都需要在runtime中登记selector”。本需求按“凡有 state selector 的包都登记”理解：没有 state selector 的包，没有可登记的内容。
- **定义**：本需求中的“公开 selector”，是从 runtime 模块包根导出、签名为 `(state: StateRoot, args?) => value` 的函数。
  - 名字以 `select` 开头但不读 state 的纯函数，不在登记范围。仓内实例：`ui/base/admin-shell/src/foundations/adminSectionSelection.ts:80` 的 `selectAdminSections`，`ui/base/integration-assembly/src/foundations/stateSyncSlices.ts` 的 `selectStateSyncSlices`。
  - 没有 runtime 模块、也没有 state selector 的包，无需登记。例如 primitives、render、admin-shell 这类 toolkit。
- **推荐的登记方式**：公开 selector 一律经 runtime 提供的定义函数创建，登记表由定义派生，做法与 `defineCommand` 同形。详设可选其他方式，但须满足下面的机械门。
- **仓内事实**：`RuntimeModuleDescriptor`（`apps/terminal/kernel/base/runtime/src/types/module.ts:96-108`）目前只登记 `stateSliceNames`、`commandNames`、`actorKeys`，没有 selector。须扩展模块契约，并为现有全部公开 selector 补登记。现有公开 selector 的逐个盘点、登记方式与 JSON 化结论，是详设输入。
- **命名**：`<moduleName>.<selectorName>`，与 command 名同一命名空间规则。
- **参数**：有参数的 selector 须声明参数形状，agent 据此校验 WS 传来的 JSON 参数。参数形状用 runtime 自己的简单描述声明，不要求各包依赖 zod（R-20）。
- **返回值**：须可 JSON 化。不能 JSON 化的值，agent 返回明确错误，不得静默丢字段或改写取值。
- **敏感值**：能返回凭证、令牌等敏感值的 selector 照常登记，返回值不脱敏（Dexter 已裁定）。
  - 仓内事实：现有 TDC 公开 selector 不返回凭证本体（`kernel/base/terminal-data-client/src/selectors/selectTerminalDataClientState.ts:17-37` 只给出 terminalRef、storeRef 等）。
  - 本条只规定：若某个已登记 selector 返回敏感值，agent 经协议原样返回。driver 写入日志、报告、截图等落盘产物时，按 AGENTS.md 的日志条款脱敏（Dexter 已裁定，§7 D-2）。
- **机械门**：
  - 包根导出的公开 selector 与该模块登记的 selector 必须一致，漏登或多登时门报红；
  - 须配红夹具：删掉一条登记后门必须红；
  - 判定按上面的定义，不得用 `select` 前缀等关键词匹配冒充语义判断；
  - “包根导出”的分母可以复用各包 `terminal-invariants.json` 的 `publicExports`；
  - 门接入现有静态检查流程（例如 `tools/terminal-skeleton/check-static.mjs`），具体落点由详设定。

### R-06 读取与订阅 selector

- agent 只经 runtime 的按名求值接口访问数据，不调用 `runtime.getState()`，不按 slice 字符串键读取。automation 与业务包遵守同一条 TR-03，不需要例外。
- **读一次**：脚本传 selector 名与参数，agent 计算一次并返回当前值。
- **订阅**：
  - 脚本传 selector 名与参数，agent 用 `runtime.subscribe` 监听 store，每次 store 变化后重新计算该 selector；
  - 结果与上次推送值不同才推送；
  - 订阅建立时先推一次当前值；
  - 脚本可退订，连接断开时 agent 自动退订全部订阅。
- **高频变化**：
  - 合并或节流的规则由详设定，不得丢最后一次值；
  - 单次求值与推送的耗时上限由详设给出依据，并作为验收判据。
- 订阅、去重、节流与退订用 RxJS 实现（R-19）。

### R-07 分发 command 与跟踪 requestId

- 脚本传 command 名、payload，可选 requestId；agent 可以分发任何已注册 command，包括 internal 可见性的 command。
- requestId 未给时由 agent 生成。public command 必须带 requestId（`createCommandDispatcher.ts` 的现行规则），agent 不得绕过。
- agent 对这次 requestId 的执行过程建立无空窗的观察（可用 RxJS 实现，见 R-19），经 WS 推送。具体做法是先订阅再分发，或使用能证明无空窗的既有快照加订阅组合。原因：journal 的 subscribe 不回放已有事件（`kernel/base/runtime/src/foundations/createRuntimeJournal.ts`），而 `command.started` 在分发过程中同步发出。推送内容：
  - 受理结果；
  - 执行进展：command 开始，各 actor 的运行、完成、出错、超时，以及迟到完成和迟到出错；
  - 最终结果 `CommandDispatchResult`（`apps/terminal/kernel/base/runtime/src/types/execution.ts:40-45`）；
  - 分发返回之后的迟到事件：actor 超时后实际执行仍会继续（`createCommandActorDispatcher.ts`），其迟到完成或出错继续推送，直至详设给出的有限观察期限或连接会话结束。分发返回不等于观察结束。
- 跟踪复用 runtime 现有能力：journal 事件（`types/journal.ts`）和按 requestId 查看执行过程的 `selectRequestExecutionView`。用哪一种或两者组合由详设定，不另建跟踪账本。
- 拒绝：
  - runtime 现有的拒绝路径包括：未注册、public 缺 requestId、深度超限、按 requestId 的命令预算超限（`createCommandDispatcher.ts` 的 `maxCommandsPerRequest`）、runtime 未启动；
  - 分发抛出的任何异常，agent 都转换为明确的拒绝推送，不得让连接中断或静默丢失。
- 读取方式：
  - journal 是 runtime 现有的公开接口，与 `descriptors` 一样属于运行时元数据，agent 可直接订阅，不受 R-06 的“只经 selector”约束；
  - 若用 `selectRequestExecutionView`，须经 R-05 的按名求值调用，不得由 agent 直接 import 后传入 state。
- payload 校验：
  - runtime 没有 command payload 的形状校验（`kernel/base/runtime/src/types/command.ts:53-71`），本专项不新增；
  - 形状错误的 payload 会原样到达 actor，由 actor 的既有处理决定结果。

### R-08 控件注册表

- 由 `ui/base/primitives` 在控件挂载时统一上报。对 primitives 的使用方而言，注册零改动（`terminal-coding-standard.md` §4-C）。R-14 的 testID 改写是另一项改动。
- 每个节点至少包含：
  - testID、role、label；
  - `accessibilityState`（disabled、busy、selected 等）；
  - value（适用时）；
  - 所属 surface（PRIMARY / SECONDARY）；
  - 组件引用（用于测量与语义动作）。
- **按下事件**：
  - 注册表记录节点收到的按下与抬起事件，包括触点坐标（RN `nativeEvent` 的坐标）与来源；
  - 这些事件经控件订阅推送（R-11），用于证明真实输入落在哪个节点、落在哪里（F-1）。
- 可见性按事实计算，不得自报：已挂载、layout 尺寸非零、落在所属 surface 范围内。遮挡不在查询中判断，由真实输入证明。
- 两块屏上的同名节点用 `{testID, surface}` 区分。primitives 没有任何依赖，也不能依赖 `ui/base/render`，节点的 surface 归属如何获得（例如由 render 的 surface 承载边界向接缝提供上下文）由详设定。
- 卸载即移除。查询不得返回已卸载节点；对已卸载节点发起操作返回明确错误。
- primitives 之外的可寻址节点（例如 `ui/base/render` 的 surface 根节点、层容器，或不经 primitives 渲染的控件）：
  - 详设须盘点现有全部带 testID 的节点；
  - 逐一给出它们进入注册表的方式，不留“有 testID 却查不到”的节点。
- 虚拟键盘：
  - 仓内事实：键已由 `PrimitiveButton` 渲染（`ui/base/input/src/components/VirtualKeyboard.tsx:239-250、273-284`），随 primitives 自动注册；
  - §4-C 中“虚拟键盘单表面命中测试、须单独设计寻址”的例外已与源码不符，随本专项改写（R-15）。

### R-09 bounds 与坐标换算

- **输出契约**：Android 端返回节点在目标 display 上的物理像素矩形；Web 端返回 viewport 坐标系下的 CSS 像素矩形，与 DOM 的 `getBoundingClientRect` 一致。两种坐标系不得混用，换算只做一次。
- **换算链**：
  - 换算链由详设写定。须先按第三方规范核实所用 RN 版本下 `measureInWindow` 是否已包含祖先 transform；
  - 仓内先例：surface 缩放是宿主上的 transform（`ui/base/render/src/components/SurfaceHostController.tsx` 的 `transform: [{scaleX}, {scaleY}]`）；`ui/base/admin-shell/src/components/AdminLauncher.tsx:36-57` 用 `measureInWindow` 的宽度除以 canvas 宽度求缩放，即把它当作已含缩放的窗口坐标；
  - 不得重复叠加缩放（TR-17 第 4 条已登记“重复扣减 presentation offset”的反例）。
- **display 标识**：每块屏需要两个 id：
  - 逻辑 displayId，供 `adb shell input -d` 使用；
  - SurfaceFlinger id，供 `adb shell screencap -d` 截图使用。现有 runner 已两者都解析（`scripts/test/ter-virtual-keyboard-android.mjs:5795-5810`、`tools/terminal-sample2/run-sample1-frozen-journey.mjs:215-228`）。
- **id 的来源**：
  - 仓内事实：displayId 只在 `kernel/base/platform-ports/src/types/device.ts:30` 的 DevicePort 与 dual-screen 适配层中；display-context 的公开读模型 `DisplayFactsSurface`（`kernel/base/display-context/src/foundations/displayDevice.ts:28-36`）只有 `displayIndex`。
  - 推荐：由 driver 在主机侧经 `adb shell dumpsys display` 取得两个 id，并与 surface 对应。现有 runner 已有这套做法，可迁移（R-13）。
  - 备选：由 display-context owner 在其公开读模型中加入 displayId，经已登记 selector 提供。
  - 不得新增平台端口或 getter，也不得由脚本猜测。
- 换算正确性是可行性前提 F-1（§3）。

### R-10 触发控件：真实输入与语义动作并存

- **真实输入**由 driver 完成：
  - Web：Playwright 在对应 locator 上点击或输入。locator 必须限定在节点所属 surface 的容器内，因为 Expo Web 把两块 surface 渲染在同一个 DOM 中，可能有同名 testID（例如 `ui/base/dev-host/src/components/testExpoApp.tsx:465、480`）。
  - Android：`adb shell input -d <displayId> tap x y`，坐标取 R-09 的结果。
- **语义动作**由 agent 完成：直接调用节点回调，例如 press、changeText。节点没有对应回调时返回明确错误，不得返回成功。
- 两种方式都提供，由脚本选择，不设使用限制。
- 每次触发的结果都标明 `real` 或 `semantic`。driver 的旅途报告按这个标签分列，区分“用户点到了”和“代码被调到了”。
- 文本输入两种方式都可用：
  - 经 TER 虚拟键盘逐键真实点击；
  - 用语义动作直接写值。
- 系统安装确认、系统对话框等不在 React 树内的界面不进注册表。旅途需要操作它们时，driver 可以仅为这些界面使用 uiautomator，并在报告中注明。

### R-11 控件查询、订阅与运行信息

- **查询**：按 testID、surface、role、文本等条件查询注册表，返回节点字段与计算后的可见性。
- **订阅**：按查询条件订阅；匹配结果变化时推送，包括节点出现、消失、状态变化，以及按下与抬起事件（R-08）。
- **运行信息**：每项注明来源。

| 信息 | 来源 |
|---|---|
| 模块列表、已登记的 selector 与 command 名 | runtime 的 `descriptors`（`kernel/base/runtime/src/types/runtime.ts`）。这是运行时元数据，不是业务数据，不受 R-06 的“只经 selector”约束 |
| surface 列表 | 注册表与 display-context 已登记 selector |
| surface 对应的逻辑 displayId 与 SurfaceFlinger id | 按 R-09 选定的来源 |
| App、application 与设备身份 | 详设指定的已登记 selector，或 driver 侧的连接身份 |
| runtime 身份与连接会话身份 | runtime 身份取 runtime 的 `runtimeId`；连接会话身份由 agent 在每次建立连接时生成（R-03） |

### R-12 不执行动态脚本

- automation-agent 不在 App 内执行任何脚本、表达式或 eval，只提供 R-05～R-11 的基础能力。
- 判断、等待条件和断言组合都在主机侧的旅途脚本中完成。agent 推送数据，脚本自己判断。
- 与 `scripts.execute` 的关系：
  - 当前仓内不存在 `scripts.execute`；
  - 它是 `project-memory/decisions/terminal-architecture-and-stack-rulings.md` 中 `TER_SCRIPT_EXECUTE_UNRESTRICTED` 保留的产品运行期能力，不属于 automation-agent，本专项不改动它；
  - 后果须由 Dexter 知悉：将来它若以 command 形式登记，R-07 的“可分发任何 command”就构成一条远端执行脚本的通路。

### R-13 automation-driver 与旅途脚本

- driver 完整暴露 R-05～R-11 的全部基础能力，不做子集。
- driver 提供两端的真实输入通道（R-10）和截图：Web 用 Playwright，Android 用 `adb screencap`。
- 同一份旅途脚本在 Expo Web 与 Android 两端执行；平台差异只在 driver 内部。
- 执行顺序遵守 TR-16：
  - 非 adapter 功能先在 integration 的 Expo Web 跑通，再在设备上跑 application；
  - 两端使用同一场景清单，结果逐行对照。
- 等待全部基于 agent 的推送，旅途脚本中不得出现固定 sleep。driver 的等待、超时与竞争用 RxJS 实现（R-19）。
- 失败报告至少包括：失败步骤、最后收到的相关推送值、仍在进行中的 requestId、截图。
- 落盘产物（日志、报告、截图）中的凭证、令牌等敏感值按 AGENTS.md 的日志条款脱敏；协议返回本身不脱敏（R-05）。
- **受管运行**：driver 与旅途运行是受管运行，遵守 AGENTS.md 关于受管运行、资源预算与日志的条款，以及 `.agents/skills/cs-managed-runtime-execution/SKILL.md`：
  - run-scoped manifest，受控的进程与设备身份；
  - 资源预检；
  - business 与 cleanup 分开判定；
  - 首败日志可读；
  - `adb reverse`、WS 服务端进程、Expo Web 进程、安装的 APK 等资源都要回收。
- 被删 runner（R-16）中已有的受管生命周期能力，包括 VM 与设备身份识别、每块屏两个 display id 的解析（R-09）、build、install、launch、run manifest 和 cleanup，由详设逐项列出迁移或复用到 driver 的方式，不得丢失。
- driver 依赖的第三方工具（Playwright 等）按 `doc/platform/third-party-library-usage-standard.md` 核实实际版本，并由 driver 自己声明依赖，不借用其他工作区提升上来的包。adb 调用经 `@devicefarmer/adbkit`，协议消息用 `zod` 定义与校验，其余依赖见 R-20。
- 旅途跑在 vitest 上（TER“vitest 单一 runner”的裁定），driver 用 `playwright` 库控制浏览器。

### R-14 testID 完全重建

- 格式：`<moduleName>:<part>[:<element>][:<key>]`，前缀是所在包的点分 moduleName。
- `ui/base/primitives` 提供唯一的 testID 构造函数。testID 仅对自动化实际需要点击、定位，或读取几何/可见状态作为断言对象的 Primitive 必填；纯装饰、静态且不参与自动化交互或断言的 Primitive 不需要 testID。
- 所属 surface 不写进 testID，由注册表的 surface 字段区分（R-08）。
- 废弃不符合该格式的现有前缀，例如 `ui-base-render:`（连字符而非点分 moduleName）、`terminal.admin:`、`application.base.android:loading`、`<appName>:test-expo:surface:*`。`ui.base.input:` 的前缀本身已是点分 moduleName，但其后各段仍须按新格式与构造函数重建。
- TER 源码中全部 testID 改由构造函数生成，不保留旧 ID 别名。
  - 规模参考（R1 评审 grep）：约 115 个源码文件中有 795 处 `testID`，另有约 35 个测试文件引用。
  - 详设须给出完整盘点。
- **机械门**：
  - TER 源码中手写 testID 字符串字面量即报红；
  - 须配红夹具；
  - 判定口径（哪些写法算手写、测试文件是否适用）由详设定；
  - 门接入现有静态检查流程。
  - 它满足验证治理的“建门三问”：手写 ID 会随代码增长反复出现；判定是机械的；维护成本低于漂移后返工。
- 引用旧 testID 的现行设计文档、README、规范与项目记忆段落，由详设盘点后同步更新。历史评审、证据文件不回改。
- 执行时序见 §8：须在首个旅途以现有 testID 两端通过之后进行。

### R-15 规范与门同步修订

- **TR-08**：增加 automation-agent 例外。
  - 所有构建都包含该包，是否启用只由 package.json 开关决定；
  - TR-08 原文的反例“代码在产物里、默认不启动”，在这个例外下被接受；
  - 例外只覆盖 automation-agent 包及其启动装配；
  - 其余调试面仍受 TR-08 约束。
- **现有调试钩子的现状与处置**（仓内事实，它们今天就不符合 TR-08）：
  - `ter-vk://` 键盘 harness：两个 App 的 `App.tsx` 在生产代码中无条件挂载（例如 `application/android/sample-terminal/App.tsx:10,18-19`），只服务于将被删除的键盘 runner。随 R-16 一并删除。
  - `ter-failure://` 失败注入：`ui/base/render/src/components/SystemFailureBoundary.tsx:20-26`，由 `__DEV__` 或构建期常量 `EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION` 启用，代码照常进产物。本专项不处理，作为现存 TR-08 偏差登记到 `HANDOFF.md`。
- **production 扫描门**：`tools/terminal-sample2/check-production-bundle.mjs` 的禁用词删除 `@catering-v2s/ui-base-automation`、`ui.base.automation`、`TerminalAutomation`。前者正好是新包名的前缀，不删就会误报。其余禁用词保留。
  - 仓内事实：该门目前只被自己的测试调用，没有接入任何构建或 verify 流程，不能证明产物中真的没有其余调试面。本专项只同步禁用词，是否接线不在本专项范围。
- **TR-03**：不改。automation-agent 只经 selector 读数据（R-06）。
- **§4-C**：改写虚拟键盘例外（R-08）。同步该例外引用的 `T-12` 正本：`project-memory/decisions/terminal-architecture-and-stack-rulings.md` 中“虚拟键盘按单表面命中测试”的条目。历史评审文件不回改。
- **platform-ports README**：`kernel/base/platform-ports/README.md:33` 中“automation 不进端口”的结论保留；其理由若引用 TR-08 的编译期剔除，随 TR-08 修订改写。
- **引用旧 testID 的规范段落**：按 R-14 同步修订。
- **项目记忆**：`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`terminal-build-order-and-batches.md` 等引用 automation 的条目，按本专项结论同步。
- 修订稿由实施方起草，随同批次一起评审。评审通过前，原文照常生效。
- 例外：TR-08 的 automation-agent 例外已由 Dexter 裁定（§0.2）。本专项各 CP 的三维对账以该裁定为准，不因 TR-08 正文尚未修订而判为 OPEN。

### R-16 删除现有 runner

- **判别式**：驱动 TER UI 或设备完成旅途、场景的入口脚本，以及只为它们服务的辅助模块、测试和 App 内专用钩子，都算 runner，全部删除（Dexter 已裁定）。
- **不算 runner、不删**：
  - 检查器与门（例如 `check-production-bundle.mjs`、`tools/terminal-skeleton/*`）；
  - 不驱动 TER UI 的协议或后台验收入口（例如 `scripts/test/terminal-client-dev-acceptance.mjs`、`terminal-ws-wire-client.mjs`）。
- **已知清单**（R1 评审补全，详设须按当前源码重新盘点并逐个判定）：

| 位置 | 文件 |
|---|---|
| `scripts/test/` | `ter-virtual-keyboard-android.mjs`、`ter-admin-display-web.mjs`、`ter-admin-display-web-contract.mjs`、`ter-admin-display-web-stage.mjs`、`ter-admin-display-android.mjs`、`ter-persist-kv-prechange-android.mjs`，以及各自的 `.test.mjs` |
| `scripts/test/` | 引用上述 runner 或 testID 的 `terminal-topology-*.test.mjs` |
| `tools/terminal-topology/` | `run-dual-device.mjs`、`android/NoIdleUiDump.java` 及其辅助模块 |
| `tools/terminal-sample2/` | `run-sample1-frozen-journey.mjs`、`run-sample2-frozen-journey.mjs`、`run-a9-runtime.mjs`、`run-u8-release-cold-start.mjs`；`check-behavior.mjs`、`check-u8-focused.mjs` 是否属于 runner 由详设按判别式判定 |
| App 内 | 两个 App 的 `ter-vk://` 键盘 harness（`controlledKeyboardHarness.tsx` 及 `App.tsx` 中的挂载） |
| 入口 | 调用上述文件的 package.json 脚本、`scripts/README.md` 中的登记，以及指向它们的现行文档 |

- 删除时一并清理，不留下指向已删文件的入口。
- 删除前，把每个 runner 覆盖的场景列成清单，写入详设：场景、形态、原 runner 中的位置。本专项只重建首个旅途（R-17），其余场景后续逐批在新包上重写。
  - `ter-persist-kv-prechange-android.mjs` 承担 TR-04 的重启持久化证明，必须进入清单。
- Dexter 已知悉并接受：删除后到重写完成前，清单中的场景没有自动回归。
- 执行时序见 §8：删除是本专项的最后一步。

### R-17 首个旅途

- 首个旅途为 sample-console（application `sample-terminal`）的冻结旅途，采用单机双屏形态。
- 分母以现有冻结 runner 的双屏 case 集合为准（`tools/terminal-sample2/run-sample1-frozen-journey.mjs:39-45`）：
  - `normal`、`reject-retry`、`abandon`、`withdraw`、`render-smoke`；
  - 年龄输入覆盖空值与非空值两条路径。
- 行为权威：`doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` 的 §4.3 双屏场景矩阵、§4.4 单双屏差异（双屏的“撤回”）、§4.5 顾客侧年龄录入，以及 `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`。
- **前提链**（详设须逐项核实当前源码后写定，当前为 UNVERIFIED）：

| 前提 | 当前所知 | 详设须确认 |
|---|---|---|
| 终端激活状态 | `ui/integration/sample-console/src/assembly/assembly.tsx` 已装配 terminal-activation、TDC、topology，晚于冻结矩阵 | 开机首屏是否仍是 `staff-login`；是否需要先激活，激活靠什么准备 |
| 后台依赖 | 未知 | 旅途是否需要 DEV 后台。若需要，DEV 与 seed 属于昂贵动作，按受管执行与当时授权处理 |
| 店员凭据来源 | `kernel/feature/sample-staff-session/src/features/actors/actors.ts:22` 为本地常量 | 是否仍成立 |
| 设备 | 单机双屏 Android 设备或模拟器 | 使用前确认不干扰其他正在进行的运行 |

- 每一步同时断言三类事实：
  - 两块屏上的可见 part（经控件查询）；
  - 相关 selector 的值（经订阅）；
  - 相关 command 的结果（经 requestId 跟踪）。
- 不以成功文本代替断言。
- 店员与顾客的操作都用真实输入，键盘输入经虚拟键盘逐键真实点击。语义动作和直接发 command 只能用于准备数据，并在报告中标明。
- 先在 `ui/integration/sample-console` 的 Expo Web 跑通，再用同一份脚本在 Android 双屏设备上跑通，两端结果逐行对照（TR-16）。
- 单屏形态的 case（`hand-back`、`keyboard-alpha-probe` 等）列入 R-16 的待重写清单。

### R-18 配套 skill

- 新建项目 skill `cs-terminal-automation`，放在 `.agents/skills/` 下（项目 skill 唯一真相根，见 AGENTS.md）。
- 详设阶段起草，实施阶段随实现完成，内容以实际源码与协议为准。至少包括：
  - 怎么打开开关、填写连接参数、启动 driver；Android 的 `adb reverse`；
  - 受管运行的方式（R-13）；
  - 全部基础能力的调用方式与示例：订阅 selector、发 command 并跟踪 requestId、查询与订阅控件、取 bounds、真实输入与语义动作；
  - 新包怎么登记 selector，漏登时机械门怎么报；
  - testID 构造规则与机械门；
  - driver 中用 RxJS 写等待、超时与竞争的约定（R-19）；
  - 怎么写一条旅途：先 Expo Web 再设备、同一份脚本、`real` 与 `semantic` 的含义；
  - 常见失败与排查：连不上、令牌错误、坐标偏移、订阅没有推送、旧会话残留。
- skill 与协议同步维护：协议或能力变了而 skill 没改，视为交付未完成。
- 验收：由一个只读过这份 skill 的 fresh agent，独立写出并跑通一条覆盖 selector 订阅、command 跟踪和真实点击的小旅途。跑不通，就说明 skill 或实现有缺口，须修复后重验。

### R-19 用 RxJS 实现流式能力

agent 与 driver 中的订阅、推送、重连、等待、超时都是“事件流”问题，统一用 RxJS 实现，不手写一套订阅、节流、重连与清理机制（Dexter 已裁定）。

- **依赖**：
  - `rxjs` 精确锁定版本，由 `automation-agent` 与 automation-driver 各自声明为 dependency。
  - 仓内事实：当前 `yarn.lock` 中没有 rxjs，它是新增依赖。
  - 版本快照（2026-10-05 查 npm registry）：`latest` 为 7.8.2（发布于 2025-02-22），`next` 为 9.0.0-beta.0。推荐 7.8.2，不用 beta。
  - rxjs 7.8.2 只依赖 `tslib ^2.1.0`，仓内已解析 `tslib 2.8.1`。
  - 详设须按 `doc/platform/third-party-library-usage-standard.md` 重核实际解析版本，以及下表用到的每个 API 在该版本的官方依据。
- **边界**：
  - RxJS 只在 automation-agent 与 automation-driver 内部使用；
  - 不进入其他包的依赖，也不进入 kernel 与业务包；
  - 不改变 command、selector、actor 的现有写法；
  - 不出现在任何包的公开 API 中：协议仍是 JSON，其他包看不到 Observable；
  - 不引入 redux-observable 一类把 RxJS 接进 runtime 的库。
- **用法约束**：
  - 只用 RxJS 核心（`rxjs` 与 `rxjs/webSocket`）；
  - 每条长期订阅都必须绑定连接会话的结束（例如 `takeUntil`），保证会话结束即释放；
  - 不自定义 scheduler。
- **体积**：agent 进入所有构建（R-02），rxjs 也随之进入所有生产包。详设须给出 bundle 增量的实测，作为 F-4b 的一部分。
- **能简化什么**（详设据此选型。API 存在性已读 rxjs 7.8.2 源码，语义仍按官方文档核实）：

| 工作 | 不用 RxJS 时要手写的 | 用 RxJS 的做法 | 对应要求 |
|---|---|---|---|
| selector 订阅 | 包装 `runtime.subscribe`、自己比较新旧值、自己写节流且保证不丢最后一次值、自己管理退订 | `runtime.subscribe` 包成 Observable → `map`（按名求值）→ `distinctUntilChanged`（按 JSON 值比较）→ `throttleTime(t, asyncScheduler, {leading: true, trailing: true})`（第二参数是 scheduler，配置在第三参数），或 `auditTime(t)`。注意 `throttleTime` 默认 `trailing: false`，会丢最后一次值，必须显式打开 | R-06 |
| 断开即退订 | 记录每个连接的全部订阅，断开时逐个清理 | 每个连接会话是一个 Observable；会话内所有订阅都 `takeUntil(会话结束)` | R-03、R-06 |
| 自动重连与新会话 | 自己写退避、计数、重置、并发重连保护 | agent 侧用 `webSocket()`（默认使用全局 `WebSocket`，RN 与浏览器都有，也可经 `WebSocketCtor` 注入）。自动恢复必须同时覆盖两条路径：rxjs 7.8.2 的 `WebSocketSubject` 在 `wasClean` 关闭时发 complete，其他关闭发 error；而 `retry` 只处理 error，complete 会直接结束。因此须组合 `retry({delay})` 与 `repeat({delay})`，或把关闭统一转成可重试信号。本地主动关闭、开关关闭与销毁时终止恢复，不重连。退避计数在连接 open 时重置还是收到首条消息时重置，由详设明确；`retry` 的 `resetOnSuccess` 只在收到值时重置，不等于 open。每次连接成功生成新的连接会话身份 | R-03、F-2 |
| 一条连接上的多路订阅 | 自己按订阅 id 分发消息 | `webSocket` 的 `multiplex`，或对消息流按订阅 id `filter` | R-06、R-11 |
| command 跟踪无空窗 | 自己保证先订阅 journal 再分发、合并分发结果、判断何时结束 | journal 事件流的实际订阅必须先于分发执行（`defer` 只是把分发推迟到被订阅时，本身不保证 journal 已订阅）；按 requestId `filter`，再与 `from(dispatch 结果)` `merge`。**dispatch 返回不等于观察结束**：有 actor 超时（`CommandDispatchResult` 中 `timed-out`）时，继续观察该 request 的 `actor.late-completed` / `actor.late-error`，直至详设给出的有限观察期限或连接会话结束；多 actor 命令不得在首个 actor 终态时停止整条观察 | R-07 |
| 控件注册表变化与按下事件 | 自己维护监听者列表 | 注册表与按下事件用 `Subject` / `BehaviorSubject` 发布，控件订阅就是在上面 `filter`、`map` | R-08、R-11 |
| driver 侧等待 | 轮询、sleep、自己写超时 | `firstValueFrom(推送流.pipe(filter(断言), timeout({first: ms})))`；“等成功或等失败信号”用 `race` | R-13（零固定 sleep） |
| 失败报告中的“最后收到的值” | 自己缓存每条订阅的最新值 | `shareReplay(1)` 或 `BehaviorSubject` | R-13 |
| 平台动作接入 | Playwright 与 adb 的 Promise 混在回调里 | `from(promise)` 接进同一条流 | R-10、R-13 |

- **RxJS 不能简化的部分**（仍按原要求单独完成）：
  - 坐标换算（R-09）；
  - primitives 注册接缝与 surface 归属（R-08）；
  - selector 登记及其机械门（R-05）；
  - testID 重建（R-14）；
  - 受管运行生命周期（R-13）。
- **driver 侧的 WS 服务端不由 RxJS 提供**。RxJS 的 `webSocket` 只是客户端。
  - driver 需要一个 WS 服务端库，推荐复用仓内已解析的 `ws`：`yarn.lock` 中有 `ws` 7.x 与 8.x，`tools/terminal-topology/run-dual-device.mjs` 已在使用。
  - driver 自己精确声明版本，并用 `fromEvent` 接入 RxJS。
- **与现有规范的关系**：TR-11 要求事件变成 command、不得以回调交给业务方。RxJS 流只在 agent 内部，不交给任何业务包，因此不违反该条。

### R-20 其他第三方依赖

除 RxJS（R-19）外，以下库替代原本要手写的部分（Dexter 已裁定按推荐采纳）。

- **通用约束**：
  - 每个库都精确锁定版本，并由实际使用它的包（automation-agent 或 automation-driver）自己声明，不借用其他工作区提升上来的包；
  - 不进入 kernel、业务包或其他 ui 包；
  - 下文版本是 2026-10-05 查 npm registry 与 `yarn.lock` 的快照，详设须按 `doc/platform/third-party-library-usage-standard.md` 重核实际解析版本，以及每个用到的 API 在该版本下的官方依据；
  - 进入 agent 的库会随 agent 进入所有生产包，一律优先放在 driver 侧。

**必须采用：**

| 库 | 位置 | 替代什么 | 版本快照与仓内现状 | 约束 |
|---|---|---|---|---|
| `@devicefarmer/adbkit` | driver | 拼接 `adb` 命令字符串并解析输出：设备列表、`reverse`、`shell`（`input -d`、`dumpsys display`）、`screencap`。这正是 `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-execution-retrospective-review-claude.md` 所记 runner 假失败（ADB 空白解析、`sh -c` 参数切分）的来源 | npm `latest` 3.3.9（2026-07-08）；仓内未引入 | 详设核实它对 `reverse`、多 display 的 `input -d` 与 `screencap -d` 的支持；不支持的个别调用可以用参数数组形式的 `adb` 子进程补齐，但不得回到拼接字符串 |
| `zod` | agent 与 driver | 手写 WS 协议消息的类型与校验 | npm `latest` 4.6.5；`yarn.lock` 已有 4.4.3 与 3.25.76，均为间接依赖，没有任何包直接声明 | 只用于 agent 与 driver 之间的协议消息：定义一次，两端共用，收到 JSON 时做运行时校验并得到 TS 类型。**不用于各包 selector 的参数形状声明**，那部分仍用 runtime 自己的简单描述（R-05），否则 zod 会扩散到所有业务包。agent 侧优先用 `zod/mini` 控制体积 |
| `pixelmatch` 与 `pngjs` | driver | F-4a 的静态页像素对比 | `pixelmatch` npm `latest` 7.2.0，仓内未引入；`pngjs` `yarn.lock` 已有 3.4.0，为间接依赖 | 对比时排除详设声明的动态区域；阈值由详设给出依据 |

**可选，由详设决定是否采用：**

| 库 | 位置 | 用途 | 现状 | 不采用时 |
|---|---|---|---|---|
| `dequal` | agent | 给 `distinctUntilChanged` 做深比较，不受对象键顺序影响 | `yarn.lock` 已有 2.0.3，为间接依赖，体积约数百字节 | 用 JSON 值比较，前提是同一 selector 输出的键顺序稳定 |
| `pino` | driver | 结构化日志，用 `redact` 实现落盘脱敏（R-13、§7 D-2） | npm `latest` 10.4.0；仓内未引入 | 写一个小的脱敏函数，覆盖 AGENTS.md 日志条款列出的敏感项 |
| `execa` | driver | 子进程执行与终止辅助。进程树回收能力须按选定版本与配置核实：仓内锁定的 5.1.1 的 cleanup 只终止直接子进程，不遍历后代（[execa 5.1.1 kill.js](https://github.com/sindresorhus/execa/blob/v5.1.1/lib/kill.js#L87-L98)）；较新版本的后代终止须显式配置。无论是否采用，都复用 R-13 的受管身份与 cleanup，不把未知进程交给库去杀 | `yarn.lock` 已有 5.1.1，为间接依赖；npm `latest` 10.0.1 | 用 Node 的 `child_process.spawn` 加参数数组，自行回收进程树 |

**明确不用：**

- Redux DevTools 远程、Reactotron：直接读 full state，与“只经 selector”的裁定冲突（R-06）。
- Flipper：RN 0.74 起已移除内置集成，不再支持（[RN 0.74 发布说明](https://reactnative.dev/blog/2024/04/22/release-0.74)）。
- superjson：会悄悄序列化不可 JSON 化的值，与 R-05 要求的明确报错冲突。
- JSON-RPC 库：RxJS 加一个简单的消息信封已经够用。
- nanoid、uuid：复用 kernel 现有的 `createRequestId` 与 `createRuntimeId`（`apps/terminal/kernel/base/contracts/src/foundations/runtimeId.ts`）。
- `@playwright/test` 作为旅途 runner：项目记忆中 TER 的裁定是“vitest 单一 runner”（`project-memory/decisions/terminal-architecture-and-stack-rulings.md`）。driver 用 `playwright` 库控制浏览器，旅途跑在 vitest 上。frontend 的两个 admin 使用 `@playwright/test` 1.61.1，driver 的 `playwright` 版本可与其对齐，由详设核实。
- Detox、Maestro、Appium：多屏支持或读 state 不满足（讨论稿 §6）。

## 3. 可行性前提（实施的准入闸）

讨论稿计划用 spike 证明以下事实，Dexter 决定本次不做 spike。以下事实当前都是 **UNVERIFIED**，须在实施中先行证明，执行顺序见 §8。任何一项不成立，停止推进并报告 Dexter，由 Dexter 决定调整方案或范围（讨论稿 §10 曾列出改用 Appium 作为设备侧输入的选项）。不得自行降级绕过。

| # | 事实 | 判据 |
|---|---|---|
| F-1 | R-09 的坐标换算在 surface 缩放与副屏 `Presentation` 下成立 | 在 Android 双屏设备上，对两块屏各取一个节点的四个角（向内留出容差）加中心点：按 agent 给出的坐标真实点击后，注册表记录的按下事件（R-08）落在预期节点上，且触点坐标与目标坐标之差不超过容差 N。N 由详设依据像素密度与换算链给出。Web 端坐标与 `getBoundingClientRect` 一致，并覆盖页面有非零滚动的情形。先 Web 后设备 |
| F-2 | R-03 的 WS 客户端能在 App 重启、JS reload、断网恢复和双机场景下自动重连并建立新会话 | 每种情形都能观察到新的连接会话身份、旧订阅失效、新订阅可重建；App 重启与 JS reload 时 `runtimeId` 改变，仅断网恢复时 `runtimeId` 不变。须分别覆盖远端正常关闭后恢复、异常断开后恢复、本地主动停用后不重连。先 Web（页面重载、断开服务端）后 Android（重启、reload、`adb reverse` 移除与恢复、双机两条连接） |
| F-4a | 开关关闭时，注册接缝是 no-op，渲染不变 | focused 测试证明接缝关闭时不注册、不测量；在 Expo Web 上不依赖 agent，用 Playwright 按 DOM 条件等待，开、关两个构建各截一组静态页，用 `pixelmatch` 对比（R-20）。详设须声明排除的动态区域（时钟、光标、动画）与 admin 状态行 |
| F-4b | 开关打开时注册与查询的开销可接受 | 在设备上测量最重页面的注册数与查询耗时，不超过详设给出的上限及其依据；同时给出 automation-agent 及其全部依赖（rxjs、zod，以及详设选用的 agent 侧可选依赖）带来的 bundle 增量 |

现有公开 selector 的盘点与 JSON 化结论（原 F-3）改为详设输入，见 R-05。

**进入条件：**

- F-1、F-2、F-4 都是所在 CP 内的动态 focused proof。按 `doc/platform/implementation-task-template.md` 区分两道关：
  - **首次动态运行前的静态对账**（模板 6c“对账前移”）：该 CP 已完成的代码先经独立静态对账，之后才运行 F proof；
  - **CP 完整退出对账**（模板第 6 条）：F proof 及其失败修复全部完成后，由 fresh 独立子 agent 对整个 CP 对账，MATCHED 之后才开始下一 CP。
- F proof 失败时在 CP 内修复，不提前给出 CP 的退出 MATCHED。
- 运行遵守 TR-16（先 Web 后设备）与“失败族阶段准入”。
- 它们不是 browser L2、reset 或 seed，不受“动态前整体准入”约束；整体三维对账（6b）只约束 R-17 与 R-18 的最终两端验收。
- 若 R-17 被证实需要 DEV 与 seed，则“动态前整体准入”的四项完整适用。

## 4. 验收场景（详设须展开为具体用例）

全部 `NOT_RUN`。执行面：W = integration Expo Web；A = 安装的 Android application；F = focused 测试。W 与 A 的运行都是受管运行（R-13）。

| # | 要求 | 场景与必须断言 | 执行面 |
|---|---|---|---|
| V-01 | R-01 | 三重标识互推；依赖方向门通过；不新增端口；新包已登记进 skeleton graph，固定计数同步 | F |
| V-02 | R-02 | 开关开、关各打一次包：关闭时不连接、不注册、渲染不变；打开时连接成功并可用全部 agent 能力；生产与调试构建行为一致 | F+W+A |
| V-03 | R-03 | 重启、reload、断网恢复后建立新的连接会话，旧订阅失效；远端正常关闭与异常断开都能自动恢复，本地停用后不重连；`runtimeId` 只在重启与 reload 时改变；双机两条连接各自独立；连接失败不影响 App；无 adb 的远端连接下 agent 能力可用 | W+A |
| V-04 | R-04 | 令牌错误时被拒；非 localhost 地址强制 `wss` 并校验证书；是否启用与连接地址在日志与共享 admin console 中可见，与交互工件一致；令牌不出现在日志中 | F+W+A |
| V-05 | R-05 | 按定义识别的全部公开 selector 已登记，纯函数 helper 不在其中；漏登、多登时机械门报红（红夹具）；不可 JSON 化的返回明确错误；参数形状校验生效 | F |
| V-06 | R-06 | 订阅先推初值；变化才推；高频变化不丢最后一次值，且不超过耗时上限；退订与断开自动退订；agent 源码不调用 `getState`、不按 slice 键读取 | F+W+A |
| V-07 | R-07 | public 与 internal command 都能分发；requestId 自动生成；进展与最终结果完整推送；先超时返回、后实际完成或出错时迟到事件仍推送；多 actor 命令不在首个 actor 终态时停止观察；未注册、缺 requestId、深度超限、命令预算超限、runtime 未启动时推送明确拒绝，连接不中断 | F+W+A |
| V-08 | R-08 | 盘点到的全部带 testID 节点都能查到；可见性按事实计算；同名节点按 surface 区分；按下事件带坐标；卸载后查不到，对其操作返回错误 | F+W+A |
| V-09 | R-09 | F-1 的判据在两块屏上成立；displayId 来源与 R-09 选定方式一致；Web 坐标一致 | W+A |
| V-10 | R-10 | 真实输入与语义动作结果分别标为 `real` 和 `semantic`；无回调的语义动作返回错误；禁用控件的真实点击不触发动作；Web locator 按 surface 限定 | W+A |
| V-11 | R-11 | 控件订阅推送出现、消失、状态变化与按下事件；运行信息各项与来源表一致 | F+W+A |
| V-12 | R-12 | 协议中不存在执行脚本或表达式的方法 | F |
| V-13 | R-13 | 同一份脚本两端执行；旅途脚本中零固定 sleep；失败报告包含所需信息；每次运行有 manifest，business 与 cleanup 分开判定，资源全部回收 | W+A |
| V-14 | R-14 | 全部 testID 由构造函数生成；手写字面量时机械门报红（红夹具）；不存在旧前缀 | F |
| V-15 | R-15 | 规范修订稿与实现一致；T-12 记忆条目与 §4-C 同步；扫描门自测中 automation-agent 不再是禁用词、其余禁用词仍生效（证据档位：门自测，不代表产物扫描） | F |
| V-16 | R-16 | 清单内 runner、钩子（含 `ter-vk://` harness）与入口全部删除；无悬空引用；场景清单已写入详设 | F |
| V-17 | R-17 | 首个旅途全部 case 在 Web 与 Android 双屏上通过，逐行对照一致；三类断言齐全；前提链各项已核实 | W+A |
| V-18 | R-18 | fresh agent 只凭 skill 写出并跑通小旅途 | W+A |
| V-19 | R-19 | rxjs 精确锁定且只被 agent 与 driver 声明；其他包的公开 API 中没有 Observable；断开连接后该会话的全部订阅已释放；高频变化下最后一次值必达；bundle 增量有实测 | F+W+A |
| V-20 | R-20 | R-20 必须采用的依赖精确锁定：agent 只引入 `zod`（`zod/mini`），`@devicefarmer/adbkit`、`pixelmatch`、`pngjs` 只在 driver。R-19 的 rxjs，以及详设选用并记录的 R-20 可选依赖（例如 agent 的 `dequal`）另计、不算违规。按实际使用核对，不只看声明；业务包与 kernel 没有新增第三方依赖；driver 的 adb 调用没有拼接命令字符串；selector 参数形状不依赖 zod；可选库的取舍已在详设记录 | F+W+A |

## 5. 非目标

- 不直接读 full state，不按 slice 字符串键读取。
- 不在 App 内执行动态脚本或表达式。
- 不新增平台端口，不新增 command payload 校验。
- 不把 RxJS 及 R-20 的任何库引入 automation-agent 与 automation-driver 以外的包。
- 不采用 R-20“明确不用”中列出的库。
- 不替代 Jest / vitest 单测。
- 不做录制回放，不做通用视觉回归。唯一例外是 F-4a 的开关开、关两个构建的静态页像素比较（R-20）。
- 本期不覆盖 Electron 与 iOS。
- 不做生产化的权限分级、审计与密钥轮换（登记到 HANDOFF 欠账）。
- 不在本专项内重写首个旅途之外的旧 runner 场景（R-16）。
- 不改动 `scripts.execute`。
- 不接线 production 扫描门（R-15 只同步禁用词）；不处理 `ter-failure://`（登记到 HANDOFF）。
- 不限制经 HOT 下发开关打开的 bundle。开关在打包时读入 JS bundle，经 HOT 下发开关打开的 bundle 就等于在远端打开开关，这是允许的（Dexter 已裁定，§7 I-3）。

## 6. 方案合理性

- **问题对不对**：对。三个痛点都对准测试成本本身，现有 runner 的规模与三次假失败（讨论稿 §3.1）是实际发生的代价。Dexter 要的是“一份脚本两端跑、能点、能看数据”，本需求没有扩成通用测试平台。
- **方案优不优**：
  - 现成工具不满足：Maestro 不支持 Android 多屏，Detox 官方未覆盖 RN 0.86，三者都订阅不了 selector、发不了 command（讨论稿 §6）。
  - POC 不满足：它用回调冒充点击，手工注册会漏（讨论稿 §4）。
  - 本方案让 agent 只做基础能力、判断留在主机脚本：App 内代码小，测试逻辑改了不用重新打包。
  - 数据只经 selector，与业务包遵守同一条 TR-03。
  - command 跟踪复用现有 requestId 账本，不另建机制。
  - 评审中采纳的更小替代：
    - selector 登记由定义派生（R-05），机械门因此可以按定义判定，而不靠名字匹配；
    - display id 推荐由 driver 在主机侧取得（R-09），不必在 App 内新增读面；
    - 首个旅途先在现有 testID 上跑通，testID 重建排在之后（§8）。注册表按 testID 字符串寻址，不依赖格式；
    - admin 状态行只显示构建期常量（R-04），agent 不必为它拥有 slice。
- **代价配不配**：
  - 新增：agent、driver（含从旧 runner 迁移的受管生命周期）、新依赖 rxjs 与 zod（随 agent 进入所有生产包），以及只在 driver 侧的 adbkit、pixelmatch 等（R-20）、primitives 接缝、selector 登记（kernel 契约加一个字段，并为现有全部公开 selector 补登记）、testID 全量重建（约 795 处）、两道机械门、一个 admin 状态行和一个 skill。
  - 删除：旧 runner 中的 dump、坐标解析与日志解析部分。受管生命周期部分迁移到 driver，不是净删除。
  - 收益：订阅、节流、重连、等待与超时不再手写（R-19）；旅途脚本只写一份、state 不再是黑盒、command 全程可跟踪、TR-16 对照由结构保证。
  - 前提是 §3 的可行性事实成立。
  - 范围大，按 Dexter 裁定一次性顺序做完（§7 D-3、§8）。
- **需要 Dexter 知悉的代价**：
  - 所有生产包都带 automation-agent 代码；
  - 开关打开的包，任何能占用配置地址的人都能发任何 command、读任何已登记 selector。若有 selector 返回敏感值，也会原样返回；
  - 令牌随 package.json 分发，只认证 App，不保护终端（R-04）；
  - 非 localhost 的 `wss` 要求证书校验。可选方式包括但不限于：公共 CA 证书加域名；Android 网络安全配置中按域名信任随包携带的指定 CA；信任用户 CA。其中信任用户 CA 会同时放宽生产包的信任范围，因为所有构建相同。RN WebSocket 在所用版本下对这些配置的实际行为，详设按第三方规范核实；
  - 将来的 `scripts.execute` 一旦登记为 command，就会经 automation 成为远端执行通路（R-12）；
  - 经 HOT 下发开关打开的 bundle，可以在已安装的终端上远程打开 automation（§5）；
  - 删除旧 runner 后，未重写的场景暂时没有自动回归。

## 7. 解释与未决

| # | 内容 | 处理 |
|---|---|---|
| D-1 | 本专项与在途的终端激活交互与双机拓扑批次（`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`）的先后 | **已裁定**：不并行。本专项的详设与实施都在 Codex 完成该批之后才开始；当前只做本需求的静态评审。该批新增的 runner 与场景并入 R-16 的清单 |
| D-2 | Dexter 的 D4（不脱敏）是否覆盖 driver 落盘的产物 | **已裁定**：选 (a)。D4 只管协议返回；driver 落盘时按 AGENTS.md 脱敏（R-05、R-13） |
| D-3 | 单批范围是否切分 | **已裁定**：不论分几批，都按 §8 的顺序一次性做完，批与批之间不停下来等 Dexter |
| I-1 | 原话中的“腕部”理解为“外部” | 按上下文 |
| I-2 | Rive 软键盘需求草案（`doc/plans/platform/2026-09-30-ter-rive-soft-keyboard-requirements-claude.md`） | **已裁定**：忽略，不再管它。本需求不受该草案约束，也不处理该文件 |
| I-3 | 开关打开的 bundle 经 HOT 下发等于远端打开开关 | **已裁定**：允许，不加限制（§5） |
| U-1 | F-1、F-2、F-4 | UNVERIFIED，见 §3 |
| U-2 | R-17 的前提链 | UNVERIFIED，详设核实 |
| U-3 | 第三方版本（Playwright、RN、RNW），以及副屏 `Presentation` 的像素密度、RN Android 对 `wss` 证书的处理 | 讨论稿为 2026-10-05 快照，详设按第三方规范重核 |

## 8. 交付与执行顺序

- 开始条件：Codex 完成在途的终端激活交互与双机拓扑批次之后，本专项的详设与实施才开始（D-1）。在此之前只允许本需求的静态评审，不并行起草详设。
- 一次性顺序完成（D-3）：
  - 详设可以为了评审可核量把范围切成多批；
  - 不论切几批，都按下面的顺序连续做完，批与批之间不停下来等 Dexter；
  - 每一批都是一次性完整交付单元：详设、实施、复核各做一次，覆盖该批全范围，不按包、文件或单项门拆成独立评审。
- 实施顺序（落到 CP）：
  1. agent 最小能力（注册表与按下事件、bounds）与 driver 最小能力，证明 F-1、F-2，先 Web 后设备；
  2. selector 登记与机械门，读取与订阅，command 跟踪，控件订阅与运行信息；
  3. 开关、连接面四条、admin 状态行，证明 F-4a、F-4b；
  4. R-17 首个旅途，在**现有 testID** 上 Web 与 Android 两端通过；
  5. R-14 testID 重建与机械门，用同一份旅途回归两端；
  6. R-15 规范修订与 R-18 skill 定稿，fresh agent 验收 skill；
  7. R-16 删除旧 runner：最后一步，须在第 5 步两端通过之后。
- 任何一步的 F 闸不通过，停止后续步骤并报告 Dexter（§3）。这是“一次性做完”的唯一例外。
- F 闸的进入条件见 §3。最终两端验收的进入条件与失败处理，以 `doc/platform/implementation-task-template.md` 的“动态前整体准入”和“失败族阶段准入”为准。
- 详设与实施计划须同时起草 R-18 的 skill，并列出本专项涉及的全部规范修订点（R-15）。

## 9. 评审记录

- R1（`doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r1-claude.md`）：NO-GO，2M/12S/7N。处置见 `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r1-claude.md`。
- R2（`doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r2-claude.md`）：GO_WITH_UNVERIFIED_UI，0M/4S/13N，`ROUND_FINAL_DECISION=SELF_DECIDED`，本 cycle 收口。R2 的 S 与 N 已在本版修订，处置见 `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r2-claude.md`。
- 遵循 `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`，REVIEW_TARGET=DESIGN，两轮上限。R2 之后的修订没有新的独立 verdict。
- 收口后，Dexter 裁定了 §7 的 D-1～D-3、I-2、I-3（§0.2），本版据此落入正文。
- Dexter 追加 RxJS（§0.2），作者新增 R-19、V-19，并在 R-03、R-06、R-07、R-13、F-4b、§5、§6 中引用。
- 外部 Claude 复评（`doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-claude.md`）：NO-GO，0M/2S/1N，六项旧 finding 已关闭；R-19 的重连 complete 路径、dispatch 返回与观察结束、`throttleTime` 参数位置三处已在本版修订（R-03、R-07、R-19、F-2、V-03、V-07）。这次修订尚未经过独立复核。
- 按 Dexter 追加裁定新增 R-20（其他第三方依赖）与 V-20，并在 R-05、R-13、F-4a、§5、§6 中引用。尚未经过独立复核。
- 外部 Claude 第三方依赖复评（`doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-third-party-review-claude.md`）：GO_WITH_UNVERIFIED_UI，0M/0S/3N。三项 N 已在本版收敛（V-20、R-20 的 execa 行、§5 非目标），并按评审意见把 F-4b 的 bundle 增量扩到 agent 的全部依赖。
- 外部 Claude 评审（`doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-claude.md`）：NO-GO，0M/3S/3N。六项均为文字收敛，已在本版修订，处置见 `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-intake-claude.md`。
