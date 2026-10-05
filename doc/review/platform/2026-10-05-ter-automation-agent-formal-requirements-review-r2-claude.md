# TER automation-agent 正式需求 · 第 2 轮独立盲审（终轮）

```text
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r2-input-checklist-claude.md
blindReviewDeclaration=先独立 verdict、后对照作者材料
authorMaterialReadAfterIndependentVerdict=true
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewedObjectSha256=d96589865d83f6a31bebf0b994811e98371f19a7ff04cc84338096ae253cd982
SESSION_PROVENANCE=fresh 子 agent，catering-v2s 仓根内；静态只读；未构建、未跑测试/设备、未执行 git；盲审例外见输入清单“盲审纪律披露”
AUTHORIZATION_BOUNDARY=本结论只针对需求文档静态评审，不授权详设定稿、实施、规范修订、依赖、构建、DEV、设备或任何数据操作
```

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=GO_WITH_UNVERIFIED_UI（附条件：S-A～S-D 须在详设开工前由作者在本文件内修正；D-2、D-3 交 Dexter）
M/S/N=0/4/13
L1_ENGINEERING=findings：S-A §8 顺序与 D-3 两个选项都不自洽（选 b 时重现 R1 M-1）；S-B F-4 判据不可执行且排错了步骤；S-C R-09 换算链的第 2 步与仓内现行做法相反，可能双重缩放；S-D F 闸“先行证明”与“动态前整体准入”的进入条件未定义
L2_USER_VISIBLE=R-04 第 4 条 admin 状态行已声明 UI_BEARING=true 并把 IA/交互工件交给详设，需求阶段可接受；其余无新增可见界面；见 N-c（状态行迫使 agent 拥有 slice）
L3_UNVERIFIED=F-1/F-2/F-4 全部（对象自认）；measureInWindow 在 Fabric 下是否已含祖先 transform（S-C，外部事实）；Android 对非公共 CA 的 wss 证书信任（N-l，外部事实，官方页本轮取不到）；R-17 前提链（开机首屏、是否需 DEV）；Dexter 对 Rive 草案“删了”原话（N-e）
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=G-1（沿用 R1）：正本未定义 TER 的 Expo Web / 设备动态运行是否属于 implementation-task-template“动态前整体准入”所称的 L2，导致 S-D；G-2：terminal-coding-standard 对“标准修订随批落地”期间 CP 三维对账应以哪一版为准没有判据（N-j）
TEMPLATE_COVERAGE=见 §5
EVIDENCE_TIER=静态源码与文档亲验；无 focused / Web / 设备运行证据
```

不判 NO-GO 的理由：本轮没有方向性错误或会直接拆掉已授权工作的条款（R1 的两条 M 已在源头处理）；四条 S 都是一两句文字可修的排序、判据或算法表述问题，修法不需要新增能力。判 `GO_WITH_UNVERIFIED_UI` 而不是 `GO`，是因为 review-standard 动作 5 规定 L3 非空时只能如此，且本专项的核心可行性（F-1/F-2/F-4）按 Dexter“先不做 spike”的裁定本来就延后到实施中证明。

## 1 · R1 findings 关闭情况

| R1 | 状态 | 证据（对象行号） |
|---|---|---|
| M-1 在途批冲突 | PARTIALLY | D-1（451 行）默认“R-14、R-16 在该批动态收口之后”，R-14 289 行、§8 第 4/7 步写了前置。但 D-3(b) 推荐项让批 A“只改旅途涉及包的 testID”（453 行），没有挂 D-1 前置，见 S-A |
| M-2 受管运行 | CLOSED | R-13 264-270 行：manifest、资源预检、business/cleanup 分判、资源回收、旧 runner 生命周期逐项迁移；§4 表头 385 行；§6 437 行改为“迁移不是净删除” |
| S-1 displayId 来源 | CLOSED | R-09 209-214 行二选一，R-11 237-243 行来源表；补充见 N-h |
| S-2 公开 selector 定义 | CLOSED | R-05 134-137 行；`adminSectionSelection.ts:80`、`stateSyncSlices.ts:12` 亲验为不读 state 的纯函数 |
| S-3 payload 校验 | CLOSED | R-07 176-178 行明确不新增；拒绝路径枚举仍不全，见 N-a |
| S-4 admin 指示 UI 适用性 | CLOSED | R-04 126-128 行 `UI_BEARING=true`、字段候选、复用 admin-shell，工件交详设 |
| S-5 runner 判别式与清单 | CLOSED | R-16 311-328 行；清单文件逐一 `ls` 存在；`ter-admin-display-android.mjs` 无 `.test.mjs`，“各自的 .test.mjs”按存在者理解即可 |
| S-6 调试面现状 | CLOSED | R-15 298-302 行；`SystemFailureBoundary.tsx:20-26`、两 App `App.tsx:10,18-19`/`:14,22-23`、扫描门只被自测调用均亲验 |
| S-7 R-17 分母与前提链 | CLOSED | R-17 335-346 行；`run-sample1-frozen-journey.mjs:39-45` 亲验 dual 合法 case 正是 5 个；前提链诚实标 UNVERIFIED |
| S-8 Rive 冲突 | PARTIALLY | R-08 198-200 行写入现状；I-2 依赖一条未入 §0.2 的 Dexter 原话，Rive 草案文件仍为“草案”无撤回标记，见 N-e；§4-C 改写未同步 T-12 正本，见 N-f |
| S-9 D4 作用范围 | OPEN（DEXTER_DECISION，已正确路由为 D-2） | 452 行；缺未裁定期间的默认，见 N-k |
| S-10 F 闸判据与排序 | PARTIALLY | F-1 已可证伪（377 行，配合 R-08 190-191 行按下事件）；F-3 已移入详设（381 行）；但 F-4 新判据不可执行、排序错位（S-B），F 闸本身的动态进入条件未定（S-D） |
| S-11 输入通道与连接 | CLOSED | R-03 98 行、R-10 221 行 |
| S-12 范围切分 | PARTIALLY | 已成 D-3 交 Dexter；但两个选项的内容与 §8 不自洽（S-A），选 (a) 时没有写“接受超量复核”的理由 |
| N-1 固定计数位置 | CLOSED | R-01 73 行；`verify.test.mjs:149` 亲验 `expectedLintPackages.length, 31`；补充见 N-m |
| N-2 令牌方向 | CLOSED | R-04 119-125 行 |
| N-3 凭证现状 | CLOSED | R-05 142-144 行，`selectTerminalDataClientState.ts:17-37` 亲验 |
| N-4 scripts.execute | CLOSED | R-12 249-252 行 |
| N-5 讨论稿三项 | PARTIALLY | K7→R-10 229 行，Appium→§3 373 行；HOT 交给版本更新专项（420 行），但该专项正式需求与讨论稿 `automation` 0 命中，见 N-d |
| N-6 full state / 不阻塞 | CLOSED | R-06 153、160-162 行 |
| N-7 措辞与门落点 | CLOSED | R-08 182 行；R-05 149 行、R-14 286-287 行 |

合计：CLOSED 15、PARTIALLY 5、OPEN（已路由 Dexter）1。

## 2 · 新 findings

### S-A · §8 的执行顺序与 D-3 的两个选项都不自洽

- **位置**：§8 463-470 行；D-3 453 行；D-1 451 行；R-14 289 行。
- **仓内事实**：在途批的两个受管入口都按旧格式的键盘 testID 定位：`scripts/test/ter-admin-display-web.mjs` 27 处、`scripts/test/ter-virtual-keyboard-android.mjs` 28 处 `ui.base.input:virtual-keyboard:`（grep 计数）；键 testID 由 `ui/base/input/src/components/VirtualKeyboard.tsx:241,275` 生成。R-17 要求店员与顾客“键盘输入经虚拟键盘逐键真实点击”（353 行），所以 input 是首个旅途涉及的包。
- **推论**：
  - 选 (a)：§8 把 R-14（第 4 步，全量改 795 处 testID）排在 R-17（第 5 步，新栈两端首次跑通）之前。第 5 步一旦 F 闸不过、按 §3 停止，仓库就处在“旧 runner 的 locator 已全部失效、新栈未证明”的状态。这正是 R1 S-10 要防的局面，只是从“已删”换成了“已失效”。§6 与 D-3 里“破坏面最大的两项排在新栈证明之后”的理由只对 (b) 成立。
  - 选 (b)（推荐项）：批 A“只改旅途涉及包的 testID”会改到 input 的键 testID，而 D-1 的前置只挂在“R-14 与 R-16”上。照字面执行就会在在途批动态验收期间改掉它 55 处 locator，重现 R1 M-1。批 A 同时也开不了 R-14 的机械门（其他包仍是手写字面量），留下“新旧格式并存、无门”的中间态，与 R-14“不保留旧 ID”的口径冲突。
- **更小的替代（对象未列）**：R-08 的注册表按 testID 字符串寻址，对格式没有要求。首个旅途完全可以在现有 testID 上跑通。
- **分类**：CONFIRMED（计数与行号已证；“F 闸失败后的中间态”为推论）。
- **最小修复**：§8 改为 R-17 在现有 testID 上先两端通过；R-14 排在其后，完成后用同一份旅途再跑一遍作回归；R-16 仍放最后。D-3(b) 的批 A 改为“不改任何 testID”，批 B = R-14 + R-16 + 旅途回归。另补一句：选 (a) 时须写明接受超出半小时可核量的理由（`doc/decisions/2026-07-24-v2s-verification-governance.md` 第 49 行用的是“必须先切小”）。只是重排，不增减能力。

### S-B · F-4 的判据不可执行，而且排在了它依赖的步骤之前

- **位置**：§3 F-4（379 行）；§8 第 3 步（466 行）；V-02（390 行）。
- **文档内事实**：F-4 要求“开关开、关两种构建下，首个旅途各步的两屏截图逐像素一致”。R-02 规定开关关闭时 agent 不启动、不连接（85 行）；R-13 规定等待全部基于 agent 推送、不得有固定 sleep（262 行）；Android 真实输入的坐标来自 agent（R-10 222 行）。
- **推论**：
  - 关闭开关的构建里没有 agent，driver 既拿不到坐标，也收不到推送。要在关闭的构建上“走首个旅途各步”，只能回放坐标并加固定等待，这两样 R-13 都禁止。所以 F-4 写的判据实际执行不了。
  - §8 让第 3 步“证明 F-4”，可 F-4 的判据依赖第 5 步才有的首个旅途。
  - 两次构建之间逐像素一致，还会被时钟、光标闪烁、动画帧等动态内容打破，结果“必然失败”，同样不可证伪。
- **分类**：CONFIRMED（文档内逻辑）。
- **最小修复**：把 F-4 拆成两条可执行的判据。
  1. 渲染不变：在 Expo Web 上用 Playwright 按 DOM 条件等待（不依赖 agent），开、关两个构建各截一组静态页，加 focused 测试证明开关关闭时注册接缝是 no-op。截图须声明排除的动态区域。
  2. 开销：开关打开时注册与查询的耗时不超过上限，设备上测量。
  
  并把“证明 F-4”移到首个旅途之后，或者明确它只用这组静态页，不依赖首个旅途。

### S-C · R-09 的换算链第 2 步与仓内现行做法相反，可能双重缩放

- **位置**：R-09 204-208 行；F-1 377 行。
- **仓内事实**：
  - surface 缩放是作用在宿主上的 transform：`ui/base/render/src/components/SurfaceHostController.tsx:141` 的 `transform: [{scaleX}, {scaleY}]`，`transformOrigin: 'top left'`（163 行）。
  - 共享 admin 的现行代码直接用 `measureInWindow` 的宽度除以 canvas 宽度来得到缩放：`ui/base/admin-shell/src/components/AdminLauncher.tsx:47-50` 的 `measuredScaleX = windowMeasurement.width / canvas.width`，在 150 行调用 `measureInWindow`。这说明作者此前观察到 `measureInWindow` 返回的已经是缩放后的窗口坐标。
  - TR-17 第 4 条（`terminal-coding-standard.md`）把“扣两次 presentation offset”列为已发生的反例。
- **推论**：R-09 规定先 `measureInWindow`，再“叠加所在 surface 的缩放”，最后乘以像素密度。如果 `measureInWindow` 已经包含祖先 transform，第 2 步就会把缩放算两次。F-1 能发现这个错误，但需求本身不该把一条与仓内先例相反的算法写成要求。
- **分类**：PARTIALLY_CONFIRMED。仓内先例已证；RN 0.86 Fabric 下 `measureInWindow` 是否包含祖先 transform 属外部事实，`UNVERIFIED`。
- **最小修复**：R-09 只规定输出契约（目标 display 的物理像素矩形），并把 `AdminLauncher.tsx:36-57` 列为仓内先例。换算链交给详设，按第三方规范核实 RN 版本行为后写定，由 F-1 证明。不改能力。

### S-D · F 闸“先行证明”与“动态前整体准入”的进入条件没有定义

- **位置**：§3 373 行（“须在实施中先行证明”）；§8 464、471、473 行。
- **仓内事实**：
  - `doc/platform/implementation-task-template.md:211-217` 的“动态前整体准入”约束的是“为本批改动第一次运行 L2、reset 或 seed 之前”，要求全部 CP 对账加整体 6b 均为 MATCHED。
  - 在途批的计划对 TER 动态运行采用了“全部 CP 之后做单独全批 6b，MATCHED 后才开始整体验收”（`2026-10-02-...-implementation-plan-codex.md` 第 19 行附近）。
  - `.agents/skills/cs-managed-runtime-execution/SKILL.md:102` 只规定 TER 设备运行须先过 TR-16 的 Web。
- **推论**：F-1 与 F-2 的 Expo Web 和设备运行既不是 browser L2，也不是 reset 或 seed。§8 最后一条把“进入条件以动态前整体准入为准”写成通用条款，有两种读法：
  - 照字面，它对 F 闸不适用，F 闸的进入条件就没有任何来源；
  - 按在途批的惯例，读成“动态运行一律在 6b 之后”，那 F 闸就不可能在第 1 步先行，§3 的“先行证明”落空。

  CLAUDE.md《转达实施授权》要求单列每个昂贵阶段的进入条件，本对象正是之后起草授权话术的依据。
- **分类**：PARTIALLY_CONFIRMED（模板字面范围已证；歧义后果是推论）。相关正本缺口见 DESIGN_GAPS G-1。
- **最小修复**：在 §8 写明三点。
  1. F-1 与 F-2 是所在 CP 内的动态 focused proof：该 CP 三维对账 MATCHED 后、下一 CP 开工前运行，遵守 TR-16 与失败族阶段准入。
  2. 整体 6b 只约束 R-17 与 R-18 的最终两端验收。
  3. R-17 若被证实需要 DEV 与 seed，再完整适用“动态前整体准入”四项。

### N-a · R-07 的拒绝路径列举不全

`createCommandDispatcher.ts:566-571` 有按 requestId 的命令预算 `maxCommandsPerRequest` 超限时 `throw requestBudgetErrorForView`；`createRuntime.ts:464` 未启动时 `throw unavailable()`。R-07 第 174 行只列“未注册、public 缺 requestId、深度超限”。R-07 允许脚本自带 requestId（166 行），复用同一个 requestId 正好会触发预算。CONFIRMED。修复：R-07 改为“dispatch 抛出的任何异常都转为明确的拒绝推送”，V-07 增加预算超限用例。

### N-b · journal 的读取未像 descriptors 那样写明例外

R-06 规定“只经 selector”，R-11 第 239 行为 descriptors 写了“运行时元数据、不受 R-06 约束”，R-07 第 172 行允许直接用 `runtime.journal`（`journal.ts:97-100` 的 `subscribe` 回调），却没有同样的说明。TR-03 的 2026-10-02 段禁止新增 callback 读面。journal 是现有接口，不属于新增，但应当写明。另外，若选用 `selectRequestExecutionView`，须经按名求值调用，不能由 agent 直接 import 后传 state。CONFIRMED（文本）。修复：R-07 加一句“journal 是 runtime 执行元数据，同 R-11 的例外”。

### N-c · R-04 的“连接状态”显示迫使 agent 成为拥有 slice 的 owner

admin 状态行要显示“连接状态”（127 行）。按 TR-03、TR-15、TR-01，UI 只能经 owner 的 selector 读状态，写入只能由 actor 经 command 完成。因此 agent 必须拥有 slice、command 与 actor，并登记自己的 selector（R-05 适用于它自己）。R-01 第 74 行只写了“按 TR-09 声明 owner 还是 toolkit”。这是推论。修复：R-01 写明这一后果，或者把状态行改为只显示构建期常量（是否启用、地址），去掉连接状态。

### N-d · HOT 下发问题交给了一个没有记录它的专项

§5 第 420 行写“在那个专项中处理”，但 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` 与 `2026-10-04-...-requirements-discussion-claude.md` 中 `automation` 均为 0 命中。开关在打包时读入 JS bundle，HOT 下发一个开关打开的 bundle，实际上就是在远端打开开关，与 R-02“不提供运行期修改入口”的意图冲突。CONFIRMED（grep）。修复：在版本更新专项的未决项或 `HANDOFF.md` 中登记，并在 R-02 写明这一事实。

### N-e · I-2 依赖的 Dexter 原话没有落到 §0.2，Rive 草案仍在仓内

`doc/plans/platform/2026-09-30-ter-rive-soft-keyboard-requirements-claude.md` 头部仍是“正式需求（草案）”，没有撤回标记。“需求删了吧，不改了”只出现在作者 intake 中，不在 §0.2 的逐字裁定里。后续 agent 读到这份草案，会把它当作有效需求。UNVERIFIED_REQUIRES_EVIDENCE。修复：在 §0.2 逐字收录该原话与日期，并由作者在自己的草案头部标注撤回。

### N-f · §4-C 改写未同步 T-12 正本与 platform-ports README

R-15 第 304 行改写 §4-C，但 §4-C 的例外文字引用的是 `T-12`（`terminal-coding-standard.md:900`）。T-12 是 Dexter 的技术栈裁定（`doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md:829`，“Dexter（专家意见）”），并写在 `project-memory/decisions/terminal-architecture-and-stack-rulings.md:63`。只改 §4-C 会形成两份真相。另外，`kernel/base/platform-ports/README.md:33` 写的理由是“TR-08 要求编译期剔除”，在本例外下已经失效。CONFIRMED。修复：R-15 的同步清单加入这两处；T-12 与现行源码不一致这一点，请 Dexter 知悉。

### N-g · 模板覆盖仍缺 Corpus 声明与禁推

journey 模板 §5 要求写 corpus 命中结果，对象中仍然没有。本轮检索 automation、自动化、selector、testID、testId、测试、终端均 0 命中，应写 `NO_CORPUS_ENTRY_MATCHED`。§4 的“禁推”也没有。CONFIRMED。修复：补两行。

### N-h · “displayId”实际是两个 id

现有 runner 对每块屏同时解析逻辑 displayId（供 `input -d` 使用）和 SurfaceFlinger id（供 `screencap -d` 使用）：`scripts/test/ter-virtual-keyboard-android.mjs:5795-5810` 用 `sf.id` 截图，`run-sample1-frozen-journey.mjs:215-228,337` 同样处理。R-09、R-11、R-13 只写了一个 displayId。CONFIRMED。修复：映射输出两个 id，并把它列进 R-13 的迁移能力。这也说明 R-09 的第二种来源（driver 侧）已有现成实现，可作为推荐项。

### N-i · V-15 的断言与 §8 时序冲突

V-15（403 行，属于 R-15，§8 第 6 步）断言“`ter-vk://` harness 已删除”，但 R-15 第 299 行与 R-16 规定 harness 随 R-16 在第 7 步删除。CONFIRMED。修复：把这条断言移到 V-16。

### N-j · TR-08 例外在批内 CP 对账期间按哪一版生效

R-15 第 307 行写“评审通过前，原文照常生效”。可是第 1～3 步就把 agent 装进所有构建，CP 三维对账的“设计规范”一维按现行 TR-08 必然判 OPEN。Dexter 的例外裁定已经存在（§0.2），需求应写明本专项各 CP 以该裁定为准，正文修订随批评审。这是推论。修复：加一句话。

### N-k · D-2 未裁定期间没有默认

AGENTS.md 的日志条款是硬约束。在 Dexter 写入具名例外之前，driver 落盘只能按选项 (a) 脱敏。D-2 应写“未裁定前按 (a)”，避免详设按 (b) 起草。推论。

### N-l · “wss 并校验证书”的测试基础设施成本没有计入

V-03/V-04 要求在 Android 上连接非 localhost 地址并校验证书。按 Android 7+ 的默认行为（外部事实，本轮无法取得官方页，`UNVERIFIED`），应用只信任系统 CA。可行的做法只有两种：使用公共 CA 证书加域名，或者在网络安全配置中信任用户 CA。由于所有构建相同，后者会同时放宽生产包的信任范围。U-3 只写了“证书处理”，§6 的代价里没有这一项。修复：在 §6 或 U-3 写明这项取舍。

### N-m · 已有的 `publicExports` 可直接作为 R-05 门的分母，也是同步面

`apps/terminal` 下有 34 份 `terminal-invariants.json`，其 `publicExports` 冻结了包根导出（例如 `kernel/base/terminal-data-client/terminal-invariants.json` 列出了 `selectActivationState`、`selectConnectionState` 等），由 `tools/terminal-skeleton/check-static.mjs` 消费。R-05 门要找的“包根导出的公开 selector”已经有现成的分母。新增 `defineSelector` 和新包，也都要同步这些文件。R-01、R-05 都没有提到它们。CONFIRMED。修复：在 R-05 写明门基于 `publicExports` 加类型签名判定，并把这些文件加入 R-01 的同步清单。

## 3 · 方案合理性

**问题对不对**：对。痛点与仓内事实一致：runner 依赖 dump 与 logcat，`ter-virtual-keyboard-android.mjs` 8848 行，`NoIdleUiDump.java` 是为绕过 idle 写的 Java 工具。Dexter 要的是“一份脚本两端跑、能点、能看数据、能跟 command”，对象没有把它扩成通用测试平台。用户真正想要的会不会是“5-4”？候选理解是“只要更快地写旅途”，即只要 driver 与 selector 订阅，不要 testID 重建与 runner 删除。但 D6、D8 是 Dexter 的明确裁定，本轮不重议。

**方案优不优**：主干（App 内 agent 只做基础能力、主机 driver、真实输入与语义动作并存、数据只经 selector）仍是我独立推导会给出的方案。对象没有列出、但我认为更小的替代有四个：

1. **首个旅途在现有 testID 上跑**（S-A）。注册表对格式无要求，testID 重建因此与新栈证明完全解耦，也避开 D-1。
2. **testID 门用类型代替扫描**。primitives 的 `testID` 属性改为只能由构造函数产出的 branded 类型，手写字面量直接 `tsc` 报错。门就成了现有 typecheck 加一条红夹具，比自建字面量扫描器维护成本更低。不经 primitives 的 RN 原生 `testID`（render、dev-host 的 View）仍需一条窄扫描。这条交给详设比较，不是 finding。
3. **R-09 默认取 driver 侧来源**（N-h）。旧 runner 已经实现了逻辑 id 与 SF id 的解析，迁移即可；display-context 方案要改 adapter 到 kernel 的推送链。
4. **F-4 用 Web 加 focused 测试**（S-B），不做设备逐像素对比。

**代价配不配**：方向值得。单批 (a) 明显超出可核量，推荐 (b)，但要按 S-A 改成“批 A 不改 testID”。spike 已经取消，F 闸是唯一的风险闸，所以 S-B、S-C、S-D 都是在修这道闸本身，不是锦上添花。

**§8 与 D-1～D-3 是否自洽**：不自洽之处见 S-A 与 S-D，修正后自洽。

**D-1～D-3 是不是产品歧义**：

- **D-1**：与在途批的排期关系，有默认项，属于调度选择，不是产品或 Journey 歧义。
- **D-2**：Dexter 一条已有裁定（D4）的作用范围，与 AGENTS 硬约束之间的调和，属于治理与安全口径，不涉及用户任务或页面操作。补上默认（N-k）后不阻断需求定稿。
- **D-3**：批次范围，按 kernel `BATCH_ATOMIC_DELIVERY` 由 Dexter 指派，属于范围与排期选择。它阻断的是详设开工（详设范围取决于批次），不阻断需求定稿。

三项都不是 CLAUDE.md 所说“未裁决前不得 GO”的产品歧义。R-04 状态行放在哪一页、地址是否完整显示，属于 UI 细节：Dexter 已认可“能看出连接到哪里”，交给详设的 IA 与交互工件处理，不构成待裁歧义。

**除 Dexter 待定项外阻断 GO 的**：只有 S-A～S-D。它们都在作者的修订权限内，修完无需第三轮（两轮上限），由作者按 intake 处置收口。

**UI 与交互自问**：automation-agent 和 driver 不是用户界面，`NOT_APPLICABLE`（用户是写旅途的工程师与 agent）。admin 状态行来自 Dexter 认可的连接面四条（讨论稿 §5.6）。门店或运维人员看到它是合理的，作用是防止误发测试包。要它显示“连接状态”会带来 N-c 的代价，只显示“是否启用与地址”这条更短的路径可供详设比较。

## 4 · SAME_ROOT_SCAN

- **S-A**：已枚举首个旅途涉及且被在途 runner 引用的 testID 族：`ui.base.input:virtual-keyboard:*`（两入口共 55 处）、`terminal.admin:*`（`ter-admin-display-web-contract.mjs` 含 `terminal.admin:frame`、`terminal.admin:topology`）。sample-staff-auth 与 member-desk 的 testID 未被这两个入口引用（0 命中）。§8 七步与 D-3 两个选项逐一组合核对。
- **S-B**：已核 §3 的全部 F 闸。F-1、F-2 都可在开关打开的构建上执行，只有 F-4 跨越了开关关闭的构建。
- **S-C**：已核全部 `measureInWindow` 的生产调用点：`AdminLauncher.tsx:150`，以及 `PrimitiveInput.tsx:49`、`PrimitiveScrollView.tsx:60` 两个透传 handle。只有 AdminLauncher 涉及缩放，它把测量结果当作缩放后的坐标。
- **S-D**：已核 §8 全部七步中会产生动态运行的步骤：第 1、2、3、5、6 步（W/A）。只有 R-17 可能涉及 DEV 或 seed。
- **N-a**：createCommandDispatcher 与 createRuntime 的全部 `throw` 已逐一过目。外部可达的有：未注册、未启动、public 缺 requestId、请求预算、ledger 写失败；深度超限返回 error 结果。
- **N-f / N-m**：同步面已扫描：`terminal-coding-standard.md`、两份 TER memory、build-order 文档 T-12 行、platform-ports README，以及 34 份 `terminal-invariants.json`。

## 5 · TEMPLATE_COVERAGE（需求阶段适用口径）

- **journey-decision**：
  - §1 元数据：有。
  - §2 用户任务：有（§0.1）。
  - §3 逐 actor 前提链：有（R-17 表，诚实标 UNVERIFIED）。
  - §4 边界与非目标：有（§5）；禁推：缺（N-g）。
  - §5 Corpus：缺（N-g，应写 `NO_CORPUS_ENTRY_MATCHED`）。
  - §6 UI 适用性：有（R-04）。
  - §6.1 管理后台一致性：NOT_APPLICABLE（TER 共享 admin-shell，不是 platform-admin / operations-admin）。
  - §7 Dexter 裁决：有（§0.2，缺 I-2 原话，N-e）。
- **ia-design**：整体 NOT_APPLICABLE（无业务页面）。admin 状态行的 §2 可见维度交详设：缺，但已明确要求补交。
- **ui-interaction-design**：整体 NOT_APPLICABLE。状态行的 §4 线框与 testID 交详设：缺，但已明确要求补交。
- **implementation-design**（需求阶段可核的节）：
  - §1 方案比较：有（§6，缺本轮四项替代，见 §3）。
  - §3 第三方依据：有（U-3 延后，合规）。
  - §3a：NOT_APPLICABLE（无 browser L2）。
  - §10、§10b：NOT_APPLICABLE（无迁移；seed 视 R-17 前提链，U-2）。
  - §11、§11a：有（§4 V 表；V-15 断言错位，见 N-i）。
  - §12 未决：有（§7）。
  - §13 停机条件：有（§3），进入条件见 S-D。
  - 其余节：NOT_APPLICABLE，至详设再核。

## 6 · 未验证清单

- **静态已证**：本文全部 CONFIRMED 项所引仓内事实。
- **测试已证**：无，本轮不运行。
- **无人验证**：
  - F-1、F-2、F-4；
  - `measureInWindow` 在 Fabric 下的 transform 语义（S-C）；
  - Android 对 wss 证书的信任（N-l）；
  - R-17 的开机首屏与 DEV 依赖；
  - Rive 草案撤回原话（N-e）；
  - 第三方版本（U-3）。

## 7 · 本 cycle 终轮综合（SELF_DECIDED）

- **需求方向与主干成立**：R1 的两条 M 已在源头处理，15 条 R1 finding 已关闭。
- **作者在本轮后直接修订**：S-A～S-D 与 N-a～N-m，不再召集第三轮。修订限于本文列出的文字级修复，不得借修订扩大能力范围。
- **交 Dexter 裁定**：D-2（建议先按 (a)）、D-3（建议 (b)，按 S-A 改为“批 A 不改 testID”）。另请 Dexter 知悉两件事：T-12 与源码已不一致（N-f）；HOT 下发会构成远端打开开关的通路（N-d）。
- **授权边界**：本结论不授权详设定稿、实施、规范修订或任何运行。

## 8 · 对照作者 intake 的差异说明

verdict 与 §1～§7 写定后，才完整读取 `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-finding-intake-r1-claude.md`。逐条对照后，作者处置与本轮结论的差异如下：

- **S-10、S-12**：作者写“§8 写明 F 闸在前、破坏性步骤在后”“§8 按批内顺序给出 CP 序列”。本轮认为这只在 D-3(b) 下成立。在 (a) 下，第 4 步 R-14 排在第 5 步 R-17 之前；在 (b) 下，批 A 的部分 testID 改写没有挂 D-1 前置（S-A）。作者 intake 没有按 D-3 的两个选项分别核对 §8。
- **S-10（F-4）**：作者认为 F-4“已改为可证伪”。本轮认为新判据要在开关关闭的构建上走首个旅途，这一点执行不了（S-B）。
- **S-3**：作者 intake 写“异常转为明确的拒绝推送”，但对象 R-07 第 175 行只覆盖“前两者”，请求预算与未启动两条抛出路径没有覆盖（N-a）。R1 的 SAME_ROOT_SCAN 同样漏了预算路径，作者沿用了这一点。
- **S-8**：作者以“Rive 草案当前不生效”为由，认为不需要 Dexter 排序。本轮同意不需要排序，但这条依据只存在于作者会话和 intake 中，仓内草案未标撤回，§0.2 也没有收录原话（N-e）。
- **N-5**：作者写 HOT“指向更新专项”。本轮 grep 证实，更新专项没有接住这一项（N-d）。
- **M-1、M-2、S-1、S-2、S-4～S-7、S-11、N-1～N-4、N-6、N-7**：与作者处置一致，本轮独立亲验后同意关闭。
- **作者 intake 没有覆盖的新面**：S-C（换算链与 AdminLauncher 先例相反）、S-D（F 闸动态进入条件）、N-b、N-c、N-f～N-m。这些来自本轮对仓内源码的独立核对，不在 R1 范围内。

以上对照没有改变 §0 的 verdict 与 M/S/N 计数。
