# TER 第三方库整改 v3.3 · 详设与实施计划评审（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
被审对象：
  doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md（下称详设；下文行号指本次评审时的字节）
  doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md（下称计划）
需求输入：doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md
  被审时为 v3.3；评审期间按 Dexter 裁定修订为 v3.4（见「评审期间的 Dexter 裁定」）
VERDICT=NO-GO
M/S/N=5/12/14
reviewerKind=CLAUDE_REVIEW（主审，逐条回源）+ 3 位 fresh 独立子 agent 分攻击面盲审（见「盲审 intake」）
会话出处：CONTINUED_SESSION（接续会话，不是 fresh v2s-rooted 会话）
利益披露：需求由 Claude 编写。问题出在需求本身的，已在 v3.4 中修订，并在正文中注明
EVIDENCE_TIER=静态：通读文档与源码、只读检索；第三方事实取自本机解析版本源码、官方 tag 源码与 npm registry；未运行任何构建、测试、Web、Android、虚拟机或设备
评审口径（Dexter 原话）：「特别边缘的场景，可以不考虑，不要过度设计」「抓大放小」
```

## 结论

**NO-GO。** 方向正确：方案 C、阶段顺序、“先 JVM、后两台 laptop 虚拟机”的拓扑结构、serial 动态发现、Sentry 延期与 HANDOFF 登记，这些都成立。

但有五处会导致实施走错、核心修复假绿，或者 Dexter 指定的最终验收做不成：
- 颜色键正本放错了层；
- 解压上限被 fflate 的实际语义架空；
- 双屏真机上没有能跑的非拓扑受管入口；
- TP-A11 丢了已授权的前置步骤；
- TP-A9 丢了两条需求条款。

另外 12 条是判据可以被空过，或者设计有缺口。都不需要新机制，补判据、补设计即可。

按 Dexter 的口径，边缘场景已从 findings 中剔除（见「盲审 intake」）。小项合并为一张清单，顺手修改，不单独复评。

## 评审期间的 Dexter 裁定（已写入需求 v3.4 §1.1、§5）

1. **错误提示的恢复方式**：「“SystemFailureNotice：只有一个“知道了”按钮”这样可以，点击按钮后，调用port方法，重启JS（非原生）」。它取代选择 4、5 的“局部重挂”，屏与层之外的异常也同样处理。落地要求见 S-6。
2. **两台 laptop 拓扑测试虚拟机可以清 App 数据**（选择 7）：「两台测试虚拟机，我关注的是WS数据同步是否能正常运行。一台master 一台slave，如果清空数据也能完整走完双机配对与会员旅途，也可以呀」。
   - 因此撤回详设 L164、计划 L163 与 L177 中“移除 stage-1 的 `pm clear`、用产品操作准备初态、静态调用图判红”这一整套改动，runner 在两台 laptop 上照旧清数据。
   - 单机双屏真机与 mobile 虚拟机上仍然禁止清数据（TP-A11 的证据在这两台上）。
3. **RNTL 改用 v14，一次迁到位**（选择 8）。落地要求见 S-5。
4. **评审口径**：「特别边缘的场景，可以不考虑，不要过度设计」「抓大放小」。

## 方案合理性

- **问题对不对**：对。整改对准的是当前解析版本上的第三方用法，并且先接检测器、再改代码，与需求一致。
- **方案优不优**：大方向（方案 C）成立。以下几处，更简单的替代方案被错过了：
  - 颜色键正本放到 App 与 integration 都能依赖的下层，一处修改三处生效（M-1）；
  - 解压按固定小片送入，每片之后判累计上限（M-2）；
  - TP-A11 在改 key 推导之前，先把改前构建装到两台目标机（M-4）；
  - T3 直接读发送端已有的 `codec` 日志（S-8）；
  - T2 只记连接生命周期和窗口首尾的计数，不在生产代码里逐帧计数（小项 8）。
- **代价配不配**：投入放错了位置。
  - 详设在低收益的控制上花了很多篇幅：忽略文件全量盘点、逐分母摘要、身份协议写了四遍、27 个配置全部双跑。
  - 最贵、也是 Dexter 最关心的“双屏真机怎么跑完全部非拓扑验收”，反而推到了 CP-0 或最后一次运行（M-3）。
- **UI 自问**：
  - TP-B1、B3、B4、B5 的操作都来自 Dexter 的选择或裁定，不是从接口反推的，路径已经最短。
  - 唯一的语义歧义是“点按后做什么”，已由 Dexter 裁定为重启 JS。
  - 详设 L123 写的“按‘重试’”是一个不存在的控件：`SystemFailureNotice` 唯一的按钮是 `:dismiss`“知道了”（`apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx` 第 30–55 行），应删去。

## Findings

### M-1 · TP-A6 的颜色键正本放在 application 层，两个 integration 的键表不在改动面

- **仓内事实**
  - 详设 L140、L211 把键正本定在 `apps/terminal/application/base/android/config/index.cjs`，只让两个 App 派生。
  - 两个 integration 的 `tailwind.config.cjs` 各自硬编码一整套颜色键，例如 `apps/terminal/ui/integration/sample-console/tailwind.config.cjs` 第 14 行起。计划 L66 的改动面里没有这两个文件。
  - 分层门 `tools/terminal-layering/check-static.mjs` 第 182–186 行把 ui → application 判为非法，但 P-5a 只扫 `src/`（第 67–80 行），配置文件里的反向 require 会静默通过。
- **后果**
  - 需求 TP-A6 验收 1“在正本改一个键，App 与两个 integration 同时变化，无需改第二处”必然判红；要么验收被改成只查 App，得到假绿。
  - 如果让 integration 去 require application 包，就是反向依赖，而且门抓不到。
  - 漂移的根因（三张映射表）原样保留。
- **关闭判据**
  - 正本放在 App 与两个 integration 都能合法依赖的下层；
  - 三处 Tailwind 配置都从正本派生，两个 integration 的配置进入改动面；
  - 红夹具：只改正本的一个键，三处生效键集合同时变化；
  - 写明动态拼接类名的处理方式（需求 TP-A6 验收 2）。

### M-2 · TP-A8 的流式方案在 fflate 0.8.3 下内存并不有界，按详设实现会假绿

- **外部事实**（本机 `node_modules/fflate/esm/index.mjs`，版本 0.8.3）
  - `Inflate.prototype.c`（第 1195–1201 行）对整段待处理输入调用一次 `inflt`，全部解压完才回调一次 `ondata`；
  - 流式时 `resize = noBuf || st.i != 2` 恒为真（第 241 行），库内缓冲翻倍扩容（第 248–257 行）；
  - `Unzlib.push`（第 1502–1516 行）也走同一路径。
- **后果**
  - 详设 L196 在 `ondata` 里判累计长度。“一次把全部输入 push 进去”的实现能满足详设的全部文字和判据，却在第一次 `ondata` 之前就把炸弹完整解压进库内。
  - 输入受 8 MiB 重组上限约束，理论上仍可膨胀到 GB 级。
  - 需求原判据只看本仓 buffer，也会被放过，这是需求侧的缺口，已在 v3.4 补上。
- **关闭判据**
  - 规定每次送入解压器的输入上限，并据此推出峰值内存；
  - 用例必须让“一次全送”的实现判红；
  - TP-X1 写明上述库语义，并更正两点：同步 API 在存储块越界时抛 RangeError；解压不校验 Adler-32。

### M-3 · 双屏真机上没有可执行的非拓扑最终验收路径

- **仓内事实**
  1. **形态门**：`scripts/test/ter-virtual-keyboard-android.mjs` 第 353–369 行的双屏形态门要求 SurfaceFlinger 里恰好 1 个 `Virtual Display`。详设 L109 记录真机副屏是物理外接的 presentation 屏，这个 runner 在准备阶段就会失败。详设对拓扑 runner 第二阶段做了同样的判断，但没有对这个非拓扑 runner 做。
  2. **构建类型**：三个受管入口都只构建并安装 release 包（同文件第 1689–1693 行；`scripts/test/ter-admin-display-android.mjs` 第 133、149 行）。TP-B1 与 TP-C1 的调试注入按 TR-08 必须在编译期剔除，受管路径上到不了。
  3. **执行矩阵**：没有“W 场景 × 设备 × 受管入口 × 构建类型 × 注入与按键方式”的矩阵。计划 L133–148、L169 把它推给 CP-0 或末期，“修复、扩展或另规划 runner”。
  4. **运行时点**：三处规定互相矛盾——计划 L114 把设备冷启动日志列为 CP-C 的门，L101 与 L169 又把设备证据放在全部 CP 与整体对账之后。
  5. **场景漏项**：TR-17 键盘清单（该 runner 已有 `VK-IA-01..19`）、错误持续时管理入口仍可用、TP-C2 的 resetRuntime 时序。
- **后果**：Dexter 明确要求的“单机双屏真机完成全部非拓扑验收”在本设计下没有路径。到最后只能临时放宽形态门，这会削弱门；或者用手工操作顶替主证据，而需求只允许手工证据作辅助。
- **关闭判据**
  - 详设给出上述矩阵；
  - runner 的物理双屏形态判据与 debug 变体支持排进某个 CP，在整体对账之前完成，并配 focused 测试；
  - 统一规定：证据运行只在最终阶段，CP 内的设备运行只作调试。

### M-4 · TP-A11 丢了已授权的“先用改前构建建立旧命名空间”

- **仓内事实**
  - 需求 TP-A11 写明“没有的，先用改前的构建建立”。
  - 计划 L51、L146、L177 与详设 L285 改成“没有就不安装、保持 OPEN”。
  - 计划没有安排在改 key 推导之前留存改前 APK。
  - “只读确认”没有写出手段；非 root 真机上的 release 包，读不到应用私有存储。
- **后果**
  - AI 不做仓库控制，一旦 CP-A 改了 persist-kv，改前构建就再也造不出来，这条路径永久丢失。
  - 开发期如果往两台目标机装过中间构建，新命名空间会提前建好，最终的“无 KEY_MISMATCH”就成了假绿。
- **关闭判据**
  - 在任何 persist-kv 改动之前，受管地构建改前 APK 并留存摘要；
  - 两台目标机先覆盖安装（`install -r`，不清数据）并启动，用 App 自身日志证明旧命名空间已建立；
  - 此后到 TP-A11 观测之前，两台目标机不得安装中间构建；
  - 观测开始时，断言新命名空间尚不存在；
  - 补上迁移方式的比较与选定（需求 TP-A11 第 2 点）。

### M-5 · TP-A9 丢了两条需求条款，T4 会把现有缺陷固化成验收基线

- **仓内事实**
  - 需求 TP-A9 要求三件事：“发送、关闭、发布都在锁外进行”；“close 原因码优先采用本端的意图”；给出“本端调用 → 原因码”对照用例表。
  - 详设和计划只写了锁序，全文没有“锁外”。T4 以“current cause mapping”为准（计划 L160），N-24 被降为 README 登记（详设 L264）。
  - 现行 `onOpen` 在 `peerLock` 里执行 send、close、publish（`apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt` 第 158–170 行）。
  - 同文件的 `safeCloseReason`（第 230–236 行）把角色占用拒绝、半开读超时、host-stop 等本端意图大多落成 `TOPOLOGY_PEER_UNREACHABLE`。
- **后果**：只改锁序的实现能过屏障测试和 T4，但两条条款都没有实现；以现行映射为准，等于把错误写进验收。
- **关闭判据**
  - 补上对照表，覆盖：拒绝、心跳超时与半开、host-stop、closePeer、unpair、对端发起关闭、网络断开；由 JVM 用例逐行断言；
  - 加一条“锁内无 I/O”的可证伪判据；
  - T4 改为对照这张表；
  - N-24 回到 TP-A9。

### S-1 · TP-A7 的判据写法会误判正确实现，也会放过错误实现

- **读超时写法不一**：计划 L79 写“心跳间隔 + …”，详设 L215 写“≥ 心跳超时”。应统一为 [heartbeatTimeoutMs, heartbeatTimeoutMs + heartbeatIntervalMs)，并加一条红变异：“读超时 = 间隔 + ε”必须判红。
- **判据 3 的对端模型错了**：服务端存活只认 control Pong（`TerminalTopologyServer.kt` 第 215–217 行）。详设 L141 让对端发 text 帧，正确实现会在 30–40 秒被看门狗关掉。应按判据分别写对端流量模型：判据 3 用约 0.9 × timeout 的 Pong；判据 4 完全静默。
- **线程基线的计数时点错了**：详设 L141 在 `Registry.stop` 之后计数，而 NanoHTTPD 2.3.1 的 `stop()` 会 `closeAll()`，把运行期泄漏的连接线程一并收掉（官方 tag 源码原文已核）。应改为：服务运行中、20 轮开始前取基线，最后一轮之后、在服务仍运行的窗口内计数。

### S-2 · TP-A9 的确定性判红机制没有设计

- 同步点的位置、形态、TR-08 归类都没写。
- 顺序要写成：先落行为中性的钩子，再在修复前的字节上判红，然后修复。
- Registry 是 Kotlin 单例，monitor 死锁不可中断，所以“同一 JVM 连续 10 次判红”做不到；每次判红应在独立 JVM 进程中完成。
- `rejectionFrame()` 用 org.json。只开 `returnDefaultValues` 会让它返回 null 而抛 NPE，修复前的判红做不出来；应引入真实 org.json 作为 test 依赖（需求 TP-A4 第 4 点已授权）。

### S-3 · 设备角色判定不可计算，拓扑 runner 没有准入

- **角色判定**
  - laptop 的形态门只验“单显示、无虚拟显示”，mobile 虚拟机同样满足（详设 §4 记录它是单显示）。
  - 期望的 AVD 名没有出处；发现步骤在受管入口之外；两台 laptop 之间谁当 master 没有规则。
- **拓扑 runner 准入**
  - 拓扑 runner 的 manifest 不登记进程，资源预算检查看不见它。
  - 它不构建 APK，只比对“本地文件 = 已装包”，旧字节的 APK 也能通过 T1–T5。
  - 非拓扑 runner 会重写同一个 `app-release.apk`。
- **关闭判据**
  - 期望 AVD 名作为每轮的显式输入，加上可计算的形态阈值（最短边 dp 与方向），放进受管入口；
  - 规定 master/slave 的分派；
  - 拓扑 runner 登记进程，做预算与互斥检查；
  - APK 与源码摘要绑定。

### S-4 · TP-A3 缺少 lint 真正执行过的证据

- terminal verify 对 lint 只做 turbo dry-run（`tools/terminal-skeleton/verify.mjs` 第 272–276 行）。lint 脚本即使一个文件都没检查，也能全绿。
- 计划 L199 把红夹具放在“测试源”，而 `eslint.config.mjs` 显式忽略测试源，夹具不会变红。
- **关闭判据**：每个包实际检查的文件数大于 0，并且等于该包源文件分母；红夹具放在 lint 覆盖的生产源里；写明 lint 挂在哪个入口。

### S-5 · RNTL 按选择 8 改走 v14，TP-D1 需要重做

- 外部事实（npm registry）：
  - 13.3.3 把 `react-test-renderer` 列为**必需的 peer**，不是详设 L76、L194 所说的传递依赖；
  - 当前主线 14.0.1 的 peer 是 `test-renderer`，并要求 React ≥ 19、RN ≥ 0.78。
- **详设要重做的部分**
  - POC 覆盖 v14 + Vitest + TER RN 桩。原来用 `createNodeMock`、`UNSAFE_root`、`update` 的测试，要给出 v14 的写法。
  - 同一文件多个用例之间的清理与 act 环境要实证：Vitest 不开 `globals`，这是有意的设计，自动清理如何生效要写明。
  - 依赖在阶段 A 引入（需求 TP-D1 第 3 点）。计划 L120、L127 现在放在 CP-D，L88 又要求 CP-B 使用，自相矛盾。
  - 迁移完成后，TER 对 react-test-renderer 的 import 与依赖声明都为 0。

### S-6 · TP-B1 按新裁定落地时要写清的四件事

1. **调用路径**：“知道了” → command → actor → `appControl.resetRuntime`，遵守 TR-11。先例是 `apps/terminal/kernel/base/topology/src/features/actors/actors.ts` 的 `resetSlaveRuntime`。
2. **Web 端行为**：Web 端的 appControl 默认不可用（`apps/terminal/kernel/base/platform-ports/src/defaults/unavailableAppControl.ts`），需写明 Web 上点按之后发生什么。
3. **首屏失败时不冒充就绪**：写明边界与 `ScreenReadyBoundary` 的相对位置，以及渲染异常对应的 `contentFailure` 取值。现在 `ScreenContainer.tsx` 第 157 行对已解析的 part 传的是 `contentFailure={null}`。
4. **外层兜底**：屏与层之外的异常，边界放在哪里要写明；详设 L170、计划 L93 里对应的 DESIGN_GAP 随之关闭。

### S-7 · UI 的控件分母要现在列全，验收判据要能证伪

- **§3a 控件分母**：现在就能列全，不要推到 CP-0。
  - TextInput 路径 7 条：StaffLoginOperatorNameInput、StaffLoginPasscodeInput、CustomerMemberAgeField、MemberFormScrollContent、TopologySectionLaptop，以及两个 App 的 controlledKeyboardHarness；
  - TP-B3 用哪两个具体字段；
  - TP-B1 的 screen 与层清单。
- **TP-B3**：加正向对照，开层期间弹层自身的输入框照常可写；写明设备上按键与扫码的注入方式。
- **TP-B5**：以剪贴板非空为前提，空字段与有内容两种状态分别长按；同一观测在修复前的字节上判红一次；依据改引 RN 0.86.3 的 `ReactEditText`，JS 层的 `TextInput.js` 只能证明属性透传。
- 需求 v3.4 已同步补强 TP-B3、TP-B5 的判据。

### S-8 · T3 走不到 zlib 解压路径

- 压缩阈值是 16384 字节（`apps/terminal/kernel/base/contracts/topology-transport.config.json`）。会员旅途同步的状态大概率低于阈值（UNVERIFIED），解压实现坏了 T3 也照样绿。
- 发送端已有带 `codec` 字段的 `state-full-transfer-planned` 日志（`apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts` 第 197–202 行）。
- **关闭判据**：每个方向至少看到一次 `codec=zlib-base64` 的传输，并且接收端读回一致；或者写明用哪个生产可达的操作造出足够大的同步内容；两者都做不到，就在详设 §12 标 OPEN。

### S-9 · 并行写入保护不够

- 计划 D3（L122）缺少需求 §2 规定的格式化进入条件“确认 TER 没有其他在途写入”，还把未跟踪的源文件纳入格式化。当前工作区里已有他人未提交的 TER 改动。
- 计划 L212 的变异红是在生产源上原地修改再恢复；需求要求红夹具在拷贝上做（TP-A4 第 2 点、§7）。

### S-10 · N 级处置要照需求附表原文执行

需求附表是本批的范围边界。详设 §11 需要逐行改回：
- **N-36、N-37**：附表为“登记”。不补显式依赖，不改 `Module._initPaths`。
- **N-35**：权限登记，不删。
- **N-26**：登记。
- **N-24**：回到 TP-A9（见 M-5）。
- **N-3**：存量登记，新代码用 React 19 写法。
- 详设 L26 的“TP-X1 证明必需的测试依赖”，收回到需求 §6 授权的范围。

### S-11 · 例行入口的耗时没有预算

- 以下每一项都要写明所在入口和实测耗时，按需求 §2 放置，保证静态段仍在分钟级：lint、TER 的 format 检查、三个模块的 Gradle 单测（`--no-daemon`）、至少 90 秒的生产参数长用例。
- DEV 双态只作用于 `*.dev.test.*`，不是 27 个配置全部双跑。

### S-12 · 需求条目漏设计

- **TP-A10**：没写实验开关的键名，也没有 @expo/cli 的依据；需求第二项“vitest 的 RN 桩入口不得使用 hooks”及其静态检查，两份文档里都没有。
- **TP-C1 第 3 点**：主线程超时要给 typed 失败，两份文档中“typed”出现 0 次。
- **TP-A5**：两态怎样进入唯一测试入口没写（`tools/terminal-shared/run-owned-tests.mjs` 每个包只跑一次 vitest、只输出一个 marker），每个分支的红夹具也没写。

## 小项（顺手修改，不单独复评）

1. §3.0 重核表补齐四列：发现、当前位置、结论、防再犯去处；覆盖范围包括体检报告的 M/S/N 编号，不只是 F 事实。
2. 模板 §3 的固定行被自定义行替换了，要改回；§13 引用的计划章节写错了：写成 §5、§6、§8，实际应为 §2.1、§12 等。
3. 计划 L14、L249 的“AC-0 至 AC-13”在需求里没有出处，改用 TP 编号。
4. `*.dev.test.*` 的数量：详设 L58 写 4 个，L93 写 3 个。实际是 4 个。
5. 逐代码与详设对账要按模板 §13c 由 fresh 独立子 agent 执行，并做两项必查：零调用者的新增代码、详设点名却未产出的文件。计划 L236–242 现在由主 agent 执行。
6. `react-error-boundary` 拟用 5.0.0，而当前主版本是 6.1.6（peer 为 react ^18 || ^19）。没有不兼容的证据，就用当前主版本。
7. POC 清理没有覆盖被跟踪的 `.yarn/install-state.gz`：它的修改时间是 16:37，与 POC 改动的 `vitest.config.ts` 同一分钟。
8. 按 Dexter“不要过度设计”收缩以下几处：
   - 忽略文件的全量盘点；
   - 每个分母都记源摘要；
   - 身份发现协议在两份文档里写了四遍；
   - T2 在生产代码里逐帧计数。T2 只需连接生命周期事件，加窗口首尾的计数快照。
9. T3 的 exact-set 只对 `runMemberJourney` 的函数体做静态比对（18 个标签已与 runner 第 2382–2472 行逐一核对一致）；运行产物只检查这 18 个标签都出现。整场运行里还有其他标签，严格按 exact-set 比会恒红。
10. T2 的观察窗口从首轮同步静默之后开始。
11. TP-C2 按需求保留一处未文档引用，并在 README 登记。计划 L108 写成了“替换”。
12. TP-B0 迁出 vendor 时，把 README 里“vendor 是唯一接触 RN value API 的 slot”这条不变式同步到新位置。
13. 原生测试模块改为每次从源码动态发现，不冻结 CP-0 的 26 个 `@Test`，以免新增的测试源集被漏掉。
14. frontend 与 foundation 的 `eslint --print-config` 基线在 CP-0 采集，否则计划 A2 的“与 CP-0 基线对比”无从执行。

## 核过、无问题的点

- **TP-A1**：Sentry 登记在 HANDOFF 的 TER 表，不进十项正本表，也不改 `handoff-debt`；两处项目记忆指针。与源码和需求一致。
- **POC 的残留检查**：`yarn.lock` 与各 manifest 中没有 RNTL；POC 测试文件已删除；`vitest.config.ts` 的内容与原状一致。只有 install-state 一项没清到，见小项 7。
- **会员旅途标签**：18 个与 runner 源码逐一一致。
- **serial**：两份文档都没有写死 serial；拓扑 runner 输出目录用 `--output`；stage-2 的 dual 形态门不用于 laptop，也不用于真机。
- **心跳**：正确识别了两族心跳，即 NanoWSD control ping/pong 与 transport JSON ping/pong，并分端归属。
- **解压陷阱**：正确识别并拒绝了 `unzlibSync` 固定 out 的截断陷阱。
- **JVM 测试路径**：TP-A7 的 JVM 测试走生产 `Registry.start` 路径，不自选读超时。
- **签名**：两个 App 的 release 与 debug 都用仓内的 `debug.keystore` 签名，`install -r` 覆盖安装不会被迫卸载。
- **运行纪律**：
  - 同一失败族第二次出现，只冻结该族，根因修复后继续，不等 Dexter；
  - 同一时间只一个受管运行；
  - 持有运行期间不改源码；
  - 状态报告写两行。

## 盲审 intake

三位盲审员都声明先独立出 verdict，未读作者的自审与处置。

| 攻击面 | 结论 | M/S/N |
|---|---|---|
| 方案合理性、模板、流程与授权 | NO-GO | 5/12/10 |
| 非拓扑要求的闭合与判据可证伪性 | NO-GO | 2/15/2 |
| 拓扑、真 socket 与设备运行面 | NO-GO | 2/7/7 |

**合并与去重**：同一问题被多位命中的，合并为一条，按影响重新定级。所有承重论断都回源核过：fflate 源码、VK runner 形态门、`SystemFailureNotice` 控件、`NanoHTTPD.stop()`、lint dry-run、`onOpen` 持锁 I/O、`codec` 日志、模板 §13c、install-state 时间戳。

**被 Dexter 裁定关闭或改写的**：
- “重试控件不存在”“外层兜底语义”“重试后就绪”三条，由恢复方式裁定关闭，余下的落地要求并入 S-6；
- 拓扑初态与清数据的问题，由选择 7 关闭；
- RNTL 选型由选择 8 定为 v14，并入 S-5。

**按“抓大放小”剔除的边缘项**（不要求处理）：
- 安装前比对签名证书；
- adb forward/reverse 桥接的证据档位声明；
- OkHttp 自动回 Pong 的逐字依据；
- stage-2 的默认 serial 与清数据（本批最终验收不用 stage-2）；
- IMPLEMENTATION 审查的细节；
- TP-D1 抽样变异的清单；
- N-19 取证。

**需求侧（Claude 负责）的修订**：TP-A8 的内存判据只覆盖本仓 buffer；TP-B3 缺正向对照；TP-B5 缺剪贴板前提；TP-A11 在 v3.3 之后的设备范围有歧义。以上已在 v3.4 修订。

## TEMPLATE_COVERAGE

**implementation-design-template**

| 结论 | 章节 |
|---|---|
| 有 | §0、§1 |
| 部分 | §2 CP 总览（详设没有，在计划 §11）；§3 第三方（见 M-2、S-5）；§4；§7；§9a（推到 CP-0）；§13（引用错位） |
| 缺 | §3 横切机制表的固定行（被替换，见小项 2）；§3a 逐控件分母（见 S-7）；§9 owner API 与消费者 |
| NOT_APPLICABLE，理由成立 | §5、§6、§8、§10、§10b（本批没有 seed）、§3a 的 L2 控制面全集（本批没有 L2） |
| 有，但执行者不合规 | §13b（在计划 §2.1）；§13c（见小项 5） |
| 有 | §12 |

**另外三份模板**：
- ia-design-template、ui-interaction-design-template：详设以“没有新 surface，交互由 Dexter 的选择冻结”为由不单列文档，判断可以接受。但状态链须写进详设：失败 → 提示 → 点按 → 重启 JS；开层 → 被遮字段拒写 → 关层 → 无活动字段；启动失败 → 释放遮罩 → 不报真实就绪（见 S-6、S-7）。
- journey-decision-template：NOT_APPLICABLE，判定正确。

## 未验证清单（L3）

- 会员旅途期间，同步内容的实际字节数是否会超过压缩阈值（S-8）。
- 双屏真机的 SurfaceFlinger 输出形态：没有采集，“物理副屏不是 Virtual Display”是推论（M-3）。
- 两台目标机上旧命名空间的现状（M-4）。
- RNTL v14 在 Vitest 不开 `globals` 时的清理与 act 环境（S-5）。

## 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=5/12/14
L1_ENGINEERING=findings：M-1、M-2、M-4、M-5、S-1、S-2、S-3、S-4、S-9、S-10、S-11、S-12
L2_USER_VISIBLE=findings：M-3（非拓扑设备验收无路径）、S-6（恢复方式落地）、S-7（控件分母与判据）
L3_UNVERIFIED=见上节 4 项
SAME_ROOT_SCAN=
  锁内 I/O：onOpen、sendFrame、closePeer 三处已核；
  本端意图丢失：拒绝、半开、host-stop 三条路径；
  TextInput 路径：7 条已列全；
  release-only 入口：3 个 runner 全部；
  需求委托详设决定的项：共 14 项，已按 finding 列出
DESIGN_GAPS=
  1. TR-08 与只装 release 的受管入口之间，没有规定设备上的 debug 注入场景怎么执行（终端规范 owner 补）；
  2. 项目记忆路由词表里没有 terminal 这一维，consumer-face 取 all 会被拒（记忆 owner 补）；
  3. 模板 §3a 的列面向 L2，缺少“UI-bearing 但没有 L2”的 TER 批次的控件分母列（模板 owner 补）
TEMPLATE_COVERAGE=见上节
EVIDENCE_TIER=静态源码、本机解析版本源码、官方 tag 源码、npm registry；未运行任何门、构建或设备
```

## 授权边界

- 本评审只针对详设与实施计划，不授权实施、依赖安装、构建、Web、Metro、Android、虚拟机或真机运行，也不授权任何设备数据清除。
- Dexter 已裁定的“两台 laptop 测试虚拟机可清数据”，在实施获准后才生效。
- 修订后的详设与实施计划，交 Claude 复评。
