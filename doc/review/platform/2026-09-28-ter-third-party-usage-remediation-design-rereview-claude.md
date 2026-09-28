# TER 第三方库整改 v3.4 · 详设与实施计划复评（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
被审对象（本次复评时的字节，文件修改时间 2026-09-28 19:19–19:20；下文行号均指此版）：
  doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md（下称详设，357 行）
  doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md（下称计划，273 行）
需求输入：doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md（v3.4）
上一轮：doc/review/platform/2026-09-28-ter-third-party-usage-remediation-design-review-claude.md（NO-GO，5/12/14）
VERDICT=NO-GO
M/S/N=0/3/8
reviewerKind=CLAUDE_REVIEW（主审）。按 Dexter 要求（「你主审即可」），本轮没有独立子 agent 结论
会话出处：CONTINUED_SESSION（接续会话，不是 fresh v2s-rooted 会话）
EVIDENCE_TIER=静态：通读两份文档，对承重论断逐条回源；未运行任何构建、测试、Web、Android、虚拟机或设备
评审口径：Dexter「抓大放小」「特别边缘的场景，可以不考虑，不要过度设计」
```

## 结论

**NO-GO，但只差三处文字修订。** 上一轮 5 条 M 已全部关闭，12 条 S 中 11 条关闭、1 条部分关闭（S-5 并入本轮 S-1）。本轮新发现 3 条 S，都是文档内的矛盾或次序问题，不涉及方向和新机制：

1. RNTL v14 的共享 setup，计划的写法与 POC 实际需要的不一致；
2. 两处“现有能力”在仓内并不存在：重启 JS 的 command，以及 TP-C1 的 typed 失败码；
3. 最终阶段的安装次序可能永久毁掉 TP-A11 的证据。

**建议**：这 3 条 S 改完即可进入实施，不必再复评；8 条小项实施中顺手修改。是否这样安排，由 Dexter 决定。

## 上一轮 findings 的处置核对

| 上一轮 | 本轮核对（详设/计划位置） | 结论 |
|---|---|---|
| M-1 颜色键正本 | 正本改为 `ui/base/primitives` 的 CJS 公共子路径 `semantic-color-keys.cjs`；application 的 factory 与两个 integration 配置是三个映射 owner；单键变异同时检查三份映射和四份输出；动态类名限定为可枚举（详设 L124、L152、L237；计划 L68、L80）。层向合法：application→ui、integration→ui/base | 关闭 |
| M-2 fflate 内存 | 每次送入解压器 ≤1,024 字节，给出峰值推导；用例断言 push 长度与次数，“一次全送”必红（详设 L221；计划 L81）。推导按每输入字节 2,064 输出字节取上界，比 deflate 实际上限更保守 | 关闭 |
| M-3 真机非拓扑验收 | 有 W1–W11 矩阵，列出入口、构建类型、注入与按键方式（计划 L148–160）；CP-C 改键盘 runner 的形态准入，接纳物理 presentation 副屏，并加 debug 变体，两种形态都有 focused 测试（计划 L111）；证据只在单一最终阶段运行（计划 L24、L103、L116）；TR-17、错误持续时管理入口可用、resetRuntime 时序都已补上 | 关闭 |
| M-4 TP-A11 前置 | 在任何 persist-kv 改动之前构建改前 APK，覆盖安装并确认旧 marker，之后设备冻结，观测前断言新命名空间不存在；迁移方式比较了 (a)(b)(c)，选定 (c)（详设 L155；计划 L53、L71、L82） | 关闭（观测依据见小项 4，次序见 S-3） |
| M-5 TP-A9 | 本端意图 → 原因码对照表共 7 行；发送、关闭、发布在锁外；T4 逐行对照该表；N-24 回到 TP-A9（详设 L197–209、L314；计划 L173） | 关闭 |
| S-1 TP-A7 判据 | 读超时统一为 [timeout, timeout+interval)，加 +ε 变异；判据 3 的对端改发 control Pong；另设完全静默的半开对端；线程基线在服务运行中采集，不在 stop 之后（详设 L153、L241；计划 L81） | 关闭 |
| S-2 TP-A9 判红机制 | 同步钩子只在测试中，归类 TR-08_TEST_ONLY；顺序为先钩子、修复前判红、再修复；每次判红独立 JVM；org.json 作 test 依赖（详设 L209；计划 L81） | 关闭 |
| S-3 角色判定与 runner 准入 | 每轮显式输入 master/slave 的 AVD 名，结合 `emulator -list-avds` 映射 serial；形态阈值为横屏、最短边 ≥600dp；runner 登记进程、做预算与互斥检查、APK 绑定源码摘要（详设 L116、L173；计划 L69、L176） | 关闭 |
| S-4 lint 真实执行 | 每包实际检查的文件数 >0，且等于生产源分母；不再以 dry-run 代替执行；红夹具放在 lint 覆盖的生产源拷贝上（计划 L65、L78） | 关闭（§9 变异表残留旧写法，见小项 5） |
| S-5 RNTL v14 | POC 4/4 通过；依赖在阶段 A 引入；react-test-renderer 的 import 与声明都为 0（详设 L63–78；计划 L122、L140） | 部分关闭，共享 setup 不一致见本轮 S-1 |
| S-6 TP-B1 按裁定落地 | “知道了”→ command → actor → `appControl.resetRuntime`；Web 端 port 不可用时保留提示并记录，不伪报成功；首屏失败报告 `contentFailure` 且 `primaryRealReady=false`；外层边界包住 SurfaceRoot，AdminLauncher 留在外面；“重试”已删除（详设 L120–138、L181） | 关闭（command 实际并不存在，见本轮 S-2） |
| S-7 控件分母与判据 | screen 8 个、layer 14 个、外层边界、7 条 TextInput 路径、TP-B3 的两个字段与正向对照、剪贴板前提、两种长按状态、修复前判红，都已列全（详设 L124–140） | 关闭 |
| S-8 T3 走不到 zlib | 要求两个方向各有一次 `codec=zlib-base64` 并读回一致，做不到标 OPEN（详设 L169；计划 L172） | 关闭 |
| S-9 并行写入保护 | 格式化前确认 TER 没有其他在途写入，只处理已跟踪且在范围内的文件，红变异在临时副本上做（计划 L36、L124） | 关闭（§9 残留见小项 5） |
| S-10 N 附表 | N-3、N-19、N-24、N-26、N-35、N-36、N-37 都已照附表处置（详设 L293–327） | 关闭 |
| S-11 耗时 | §7.2 固定四项的入口与计时字段（计划 L127–136） | 关闭 |
| S-12 需求条目漏设计 | TP-A10 写明开关键 `experiments.autolinkingModuleResolution`、@expo/cli 源码依据与桩入口 hooks 守卫；TP-A5 用 `--dev-matrix` 两态，每个分支都有红夹具；TP-C1 补了 typed 失败 | 关闭（“现有 typed 失败码”并不存在，见本轮 S-2） |

上一轮小项中：
- 第 1、3、4、6、8–14 项已处理；
- 第 2 项部分未处理，第 5 项未处理，分别见本轮小项 7、6；
- 第 7 项 install-state 的处置，见“对 Codex 提问的答复”。

## 方案合理性

- **问题对不对**：对，没有变化。
- **方案优不优**：Dexter 的四项裁定落实得都很简洁：
  - 恢复方式统一为一个按钮加一条 command；
  - `pm clear` 只保留在两台 laptop 上，不另写初态准备逻辑；
  - RNTL v14 一次迁到位；
  - T2 不加生产逐帧计数，改为读窗口首尾的状态与连接生命周期。
- **代价配不配**：比上一轮明显收敛。全量盘点被忽略文件、逐分母做摘要、四处重复书写身份协议，这些都已删除。
- **UI 自问**：操作都来自 Dexter 的裁定，路径最短，没有新增控件或文案。Web 端 port 不可用时停在提示上，这对开发预览可以接受。

## Findings（本轮）

### S-1 · RNTL v14 的共享 setup：计划只挂 `expect`，POC 实际需要显式接入生命周期与 cleanup

- **详设**：
  - L74：POC 在“Vitest 关闭 globals 时显式接入 `beforeAll/afterEach/afterAll` 生命周期与 RNTL cleanup”，才通过多用例清理与 act 环境检查。
  - L158：“显式 Vitest lifecycle cleanup，不开 globals；仅在 POC 已证明确需时保留 setup bridge”。
- **计划**：
  - L122：共享 setup “imports resolved Vitest `expect` and assigns only `globalThis.expect`”，加到每个 RNTL 配置里。
  - L90、L140、L260 沿用“shared Vitest `expect` setup”的说法。
  - cleanup 与 act 环境怎么接入，计划只写了要“确保”，没写接在哪里。
- **后果**：照计划迁移 29 个文件后，同一文件里上一用例的组件树可能不会卸载，用例之间互相串扰。这种问题多数表现为偶发红或假绿，难以定位。
- **最小修正**：
  - 共享 setup 按 POC 实际证明的最小集合写死：`expect` 是否仍需要、生命周期钩子与 cleanup 怎么接入、act 环境怎么设置。
  - 加一个 focused 门：去掉 cleanup 接入后，“跨用例残留”用例必须判红。
- **DEXTER_DECISION**：否。

### S-2 · 两处“现有能力”在仓内不存在

- **重启 JS 的 command**
  - 详设 L125 写“点按发出唯一 reset command”，L181、L192 写“the existing (reset) command”。
  - 仓内事实：kernel 与 ui 里没有重启 JS 的 command。runtime 只有 `initialize`、`setRuntimeInstanceMode`、`runtimeInstanceModeChanged`、`cleanupRequestLedger`；display-context 只有 power role 系列。`appControl.resetRuntime` 只在拓扑 actor 的 `resetSlaveRuntime` 里内部调用（`apps/terminal/kernel/base/topology/src/features/actors/actors.ts` 第 380–389 行）。
- **TP-C1 的 typed 失败码**
  - 计划 L116 写“produces the existing typed failure code”。
  - 仓内事实：`TerminalNativeLoadingRegistry.kt` 只有 `MAIN_QUEUE_TIMEOUT_MS = 2_000L`（第 28 行）和 `task.get(MAIN_QUEUE_TIMEOUT_MS, …)`（第 316 行），没有 typed 失败码。
- **后果**：实施时找不到这两样东西，只能临场发明。command 定义在哪一层是 TR-11 的层序问题（TER 最重要的设计模式）。一旦发明错了，例如组件直接调用 port，或者 command 放错层，最终评审就要返工。
- **最小修正**：
  - 详设写明新 command 的名称、定义所在模块、处理它的 actor 与 port 调用，并满足 TR-11 的层序。例如在 kernel 层定义 command，由对应 actor 调 `appControl.resetRuntime`；render 包里的按钮只负责派发。
  - 写明 TP-C1 typed 失败码的名称、由哪一层返回、日志字段。
- **DEXTER_DECISION**：否。

### S-3 · 最终阶段的安装次序可能永久毁掉 TP-A11 的证据

- **计划规定**：
  - L24：设备“观测前禁止再……安装中间 APK”；
  - W10（L159）要求“最终升级前新命名空间不存在”；
  - 但 W1、W4、W5、W9（L150–158）要在同两台目标机上安装 debug 或 release 构建，矩阵没有规定 W10 必须最先执行。
- **推论**：只要任何一个最终字节的构建先于 W10 装到这两台机上（debug 与 release 同 applicationId，覆盖安装时共享数据），启动时的 hydration 就会用新 key 建出新命名空间。W10 的前提“新命名空间初始不存在”从此永远不成立，而这两台机禁止清数据，无法恢复。
- **最小修正**：写明在最终阶段，两台目标机上**第一次安装最终字节必须是 W10 的 release 升级观测**；W1–W9、W11 的 debug 或 release 安装都排在 W10 之后。
- **DEXTER_DECISION**：否。

## 小项（实施中顺手修改，不单独复评）

1. 详设 L46 的硬不变量 5 仍写“边界为 screen 级且重挂该 screen”，与恢复方式裁定矛盾，改为“点按‘知道了’后经 command 重启 JS”。
2. 详设 §12 第 3 条（L335）仍写“没有授权的建立步骤就不能进行”，与详设 L155、计划 L53 已安排的改前 APK 步骤矛盾；L90 的“hard OPEN”也要同步改写。
3. §12 第 1、5 条的答复：见下节“对 Codex 提问的答复”。
4. TP-A11 的旧命名空间证据应点名具体日志。现有代码不单独记录 marker 写入；可用的证据是受保护模式的操作结果日志 `event=persist-kv operation=… mode=protected status=…`（`TerminalPersistKvModule.kt` 第 290–296 行），启动 hydration 时的 listKeys 会打出这一行。按代码路径，这一行成功即说明带 marker 的命名空间已经存在。
5. 计划 §9 的变异表中，TP-A3 一行仍写“测试源”；L222 仍是“马上恢复”的原地改写法。与 §2.2、§4.1 的“在拷贝上做”统一。
6. 计划 §12 的逐代码对账仍由主 agent 执行（L248–252）。模板 §13c 规定由 fresh 独立子 agent 执行，并做两项必查：零调用者的新增代码、详设点名却未产出的文件。这是上一轮小项 5，未处理。
7. 详设 §13 中“§13 stop conditions → plan §6”仍然指错（计划 §6 是 CP-C），应改指计划 §2.1 第 6 步与 §14。详设 §6 仍是自定义行，不是模板 §3 的固定行（上一轮小项 2，不阻塞）。
8. RNTL v14 的官方依据链接指向 `main` 分支的文档（详设 L78、L219），应按第三方规范改为 v14.0.1 tag 的版本化来源。

## 对 Codex 提问的答复

- **`.yarn/install-state.gz` 的 cleanup OPEN**：可以保持 OPEN，不阻塞。它是 Yarn 的安装状态缓存，阶段 A 正式 `yarn install` 时会被重写。在锁文件差异核对里如实记录安装前后的状态即可，不需要追溯归属。
- **§12 第 1 条（wallpaper-console 800/720 基线）**：本批不需要裁决。按需求 §2，以“测试标识 + 首个失败特征”作为基线比较，不在本批修改。
- **§12 第 5 条（是否需要单独的 IA 或交互工件）**：不需要。§5 的控件分母与需求 TP-B1/B3/B4/B5 已足够，状态链已写在 §5、§6.1、§7。
- **RNTL v14 POC**：4/4 的结果与“POC 不等于正式迁移”的口径可以接受。共享 setup 的写法见 S-1。

## 核过、无问题的点（本轮新增或变更部分）

- **POC 残留**：`yarn.lock` 与各 manifest 中没有 RNTL 或 test-renderer，POC 临时文件已移除（详设 L76）。
- **依赖白名单**：计划 L34 限定为 react-error-boundary@6.1.6、RNTL 14.0.1、test-renderer@1.2.0、test 依赖 org.json，TP-X1 不构成新增授权。
- **`pm clear`**：只在通过身份与形态门的两台 laptop 上执行，角色检查先于清数据，并有 focused 负控（详设 L175；计划 L176、L188）。
- **T2**：不加生产逐帧计数，读窗口首尾状态与连接生命周期；JVM 另外证明 control Pong。
- **会员旅途 18 个标签**：对函数体做静态 exact-set，运行期只要求 18 个都出现。
- **N 附表**：全部照需求处置。

## 未验证清单（L3）

- 键盘 runner 改造后，在物理双屏真机上的准入结果（最终运行才可证）。
- 会员旅途期间，两个方向是否都会产生超过压缩阈值的同步（T3 已规定做不到就标 OPEN）。
- 两台目标机现有的旧命名空间状态（由 CP-A 的改前 APK 步骤建立或确认）。

## 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/3/8
L1_ENGINEERING=findings：S-1（v14 共享 setup）、S-2（不存在的 command 与 typed 失败码）、S-3（TP-A11 次序）
L2_USER_VISIBLE=PASS（UI 分母、恢复方式与 TR-16 顺序均已成立；运行期证据待实施）
L3_UNVERIFIED=见上节 3 项
SAME_ROOT_SCAN=
  “现有”能力的声称共 3 处：reset command、typed 失败码、shared expect setup（第三处即 S-1）；
  最终阶段在两台目标机上安装构建的场景 5 个（W1、W4、W5、W9、W10），次序由 S-3 统一
DESIGN_GAPS=沿用上一轮三条（TR-08 与 release-only 入口、记忆路由维度、模板 §3a 列定义），无新增
TEMPLATE_COVERAGE=
  implementation-design-template：§0、§1、§3 第三方、§3a、§4、§7、§9a、§12、§13b、§13c 有；
  §3 固定行仍为自定义（小项 7）；
  §5、§6、§8、§10、§10b、§11 NOT_APPLICABLE，理由成立；
  ia、ui-interaction、journey 模板 NOT_APPLICABLE，理由成立
EVIDENCE_TIER=静态；未运行任何门、构建或设备
```

## 授权边界

- 本复评只针对上述两份文档，不授权源码实施、正式依赖安装、构建、Web、Metro、Android、虚拟机或真机运行，也不授权清除数据。
- 3 条 S 改完之后，是否直接进入实施，由 Dexter 决定。

## Dexter 裁定（2026-09-28，复评之后）

> 重写话术，授权codex修改后即可进入实施阶段，按照项目实施要求完成详设和实施计划，验收完交由我和Claude做review。

- 3 条 S（连同小项）改完即进入实施，不再交 Claude 复评。
- 实施按详设与实施计划执行；验收完成后，交 Dexter 与 Claude 做实施后 review。
- 实施后评审时，应先核对本文件 3 条 S 与 8 条小项的落实情况。
