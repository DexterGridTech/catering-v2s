# TER 虚拟键盘视觉与交互 · implementation-facing 详设与实施计划独立评审（Claude）

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=4/2/2
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK + APPROVED_IA_PIXEL_READBACK
SESSION=CONTINUED_SESSION（非 fresh 会话；本轮所有行级断言均在本轮重新打开原文件核对，未采信历史 review 结论）
COMMANDS_RUN=无构建/测试/设备/Web/Android/Metro/Git 动作；仅只读文件与 approved IA 的 PNG 解码取点
WRITES=仅本文件
INDEPENDENT_SUBAGENT_REVIEW=CLOSED_BY_CODEX_ROUNDS_1_2（本文不替代该机制，也不重置 DESIGN cycle）
AUTHORITY=本结论只针对详设与实施计划；不授权源码、测试、依赖、脚本、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git
```

## 0. 本轮做法与两处方法纠错

先解码 approved IA 取像素，再读源码，最后才读详设/计划，避免被作者叙述牵引。

两次检索因 zsh 把 `--include=*.ts` 当通配符展开而**整条 grep 没有执行**，输出的"零命中"是假的；两次都改为加引号重跑后结论反转（`terminal-image-compare` 实际有 6 份文档消费者；`createTailwindConfig` 实际有两个 Android app 调用）。本文所有否定式结论均以直接打开文件为准。

## 1. 方案合理性（先于闭环正确）

**问题对不对**：对。真实缺口三条且都在仓内可证：`alpha` 缺 `CAPS`（`apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts:132-147`，而 `2026-09-06-...-requirements-v2-codex.md:118` 早已要求 alpha 保留 caps）、dock 写死 `#FFFFFF`（`VirtualKeyboard.tsx:249`）、键位借用通用 `bg-action`/`bg-surface`（`primitives/src/theme/tokens.ts:28-31`）。

**方案优不优**：token + primitive + integration theme 的拆法（详设 §1 方案 C）正确，我独立推导也会这么分。但**验证侧严重超配**。真实改动是：布局数组加一个 key、删一行硬编码色、改写 6 条 class recipe、两个 theme 各加 7 个变量。为此设计引入了一个新 Node 生成器、一套 manifest schema、既有比较器的新分支、以及 4 layout × 4 state × 2 platform × 2 integration 量级的 baseline 产物目录。

作者没有列出的替代（我构造 3-1）：保留已冻结的 token/几何表 + computed-RGB theme test（便宜、确定、正好逮住颜色漂移与 mapping 缺失）；像素部分按仓内既有做法标 `UNVERIFIABLE_BY_MACHINE`，写明谁/什么设备/什么分辨率/看什么/产物落 `doc/evidence/` 何处；`compare.mjs` 回到它被造出来的用途——**同设备改前/改后 ROI 差分**，用于防回归而不是判"像不像 IA"。这条替代去掉了生成器、manifest 与 exact 分支，保留了机器真正能给的可证伪性。

**代价配不配**：不配。而且代价是**前置阻断式**的——计划把 CP-0 的 baseline 产出设为"否则不写源码"（计划 `:39`、详设 `:299-301`），于是一个四文件的视觉修复被一套本轮证明不可执行的像素基建挡在门外（见 M-3）。这与 `AGENTS.md`/`CLAUDE.md` 的右尺寸标尺（分钟级、零基建、防回归）和仓内既有裁定冲突：`doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md:254` 已明确"`compare.mjs` 只作 ROI 辅助，不是 absolute oracle；设备/视觉判定不能由差分退出码替代"。

## 2. UI 与交互强制自问

- 操作是否来自已批准 Journey：是。四种布局的消费者在 `requirements-v2-codex.md:40-45` 有登记，本批不新增 Journey。
- 用户此时这样操作是否合逻辑：是。CAPS 复用既有持久 `capsLock`（`editText.ts:91-94`），不引入第二套输入路径。
- 有没有更短路径：验证路径有（见 §1）；产品路径没有，不建议改。
- 不合理之处来自哪：来自**已确认 IA 资产本身的歧义**（mobile inset 无 CAPS、FULL 副标题写 "8 keys per row" 而实际渲染 10 键/行）与**历史需求正本未同步**（S-2）。
- 无障碍：按 Dexter 裁定，TER 不关心无障碍，本文不产生相关 finding。

## 3. Findings

### M-1 · 主题分母漏掉 Android 的 `sharedColors`，照此实施会让 Android 键盘比今天更差 · CONFIRMED

**仓内事实**：详设把 theme owner 定义为"两个 integration 的 `global.css` 与 `tailwind.config.cjs`"（`design:143-145`、`design:245`、计划 `:113-114`），粒度清单的 `packages` 也只有 4 个包（`design-granularity.json:16-21`）。但 Android 侧的 Tailwind 颜色映射不在那里：`apps/terminal/assembly/android/sample-terminal/tailwind.config.cjs:1-9` 与 `sample-wallpaper-terminal/tailwind.config.cjs:1-10` 都调用 `createTailwindConfig` 且**不传 `theme`**，于是 `apps/terminal/assembly/base/android/config/index.cjs:115` 的 `theme: theme ?? {extend: {colors: sharedColors}}` 生效，颜色表是同文件 `:78-109` 的 30 条字面量 `sharedColors`。两个 Android app 的 `global.css` 走 `metro.config.js:7-10` 的 `globalCssPath` 指向 integration 主题，**CSS 变量是共享的，Tailwind 颜色映射不是**。

**推论**：只在两个 integration 的 `tailwind.config.cjs` 加 `keyboard-*`，Android 上 `bg-keyboard-surface`/`bg-keyboard-key`/`bg-keyboard-action`/`text-keyboard-*`/`border-keyboard-*` 全部生成不出 utility。

**反例（具体到会坏成什么样）**：今天 Android 能出颜色，恰恰因为 dock 用的是 inline RN style `#FFFFFF`（`VirtualKeyboard.tsx:249`，且 `:246-248` 的注释写明就是为了不暴露宿主背景），键位用的 `bg-action` 在 `sharedColors:84` 里。详设 `:189` 强制删掉 `#FFFFFF` 并改用新 token 之后，Android 的 dock 变透明、普通键与动作键无背景色，而 `rounded-md`/`flex-1` 这类核心 utility 照常生效——得到的是"有圆角没颜色"的键盘。**这是本批把 Android 从可用改成不可用**。

**为什么现有判据抓不住**：V-6 的执行体是两个 `theme.test.ts`（`design:261`），而 `sample-console/test/theme.test.ts:47-50` 只做 `tailwind.includes(name+':')` 的字符串存在断言、`sample-wallpaper-console/test/theme.test.ts:29-34` 只从 `global.css` 正则取 RGB——两者都读不到 Android 的 `sharedColors`，也都不构建样式表。唯一可能暴露的是 V-11（Android 逐像素），而它被 CP-5 挡在 M-3 之后。

**最小修复**：把 `apps/terminal/assembly/base/android/config/index.cjs` 的 `sharedColors` 列入详设 §2.2/§4 的 theme 分母与粒度清单 `packages`；V-6 增加一条"七个 keyboard 名在 integration Tailwind 映射与 Android `sharedColors` 两侧都存在且同名"的断言，其反例是"只改 integration 一侧时必红"。顺带登记：`surface-elevated`/`surface-inset`/`focus` 三个 admin-login 批次的名字至今仍不在 `sharedColors`（`:78-109`），是同一类缺口的存量。

**owning source**：`assembly/base/android/config/index.cjs`。**阻断实施**：是。**需 Dexter 裁决**：否。

---

### M-2 · 被冻结为 canonical 的 keyboard palette 不是 approved IA 的颜色，且"普通键/动作键分层"与 approved IA 相反 · CONFIRMED（分层部分需 DEXTER_DECISION）

**仓内事实**：详设 `:155-163` 给出"本轮 CP-0 冻结的初始 canonical token 值"，并在 `:262` 用 V-7 要求"两个 integration 的初始 keyboard palette 与 canonical IA baseline 一致"。我直接解码 approved IA（`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-approved.png`，1671×941，8-bit RGB 非隔行），在**避开字形的条带**上取均值：

| 元素 | approved IA 实测 | 详设 §2.2 (sample-console) |
| --- | --- | --- |
| dock 背景 | `#131719` / `#14181A` / `#131619`（FULL/NUMERIC/ALPHA 左边距） | `keyboard-surface` `#0F1720` |
| 普通键 | `#282D31`（FULL "1"）、`#2E3338`/`#22272C`（ALPHA T/O） | `keyboard-key` `#1F2933` |
| 动作键 | `#272C30`（FULL CAPS）、`#272C31`（ALPHA CAPS/COMPLETE）、`#282D31`（SHIFT）、`#2F3439`（BACKSPACE） | `keyboard-action` `#334155` |
| accent | `#3583FE`/`#3181FF`（与图右上角图例标注的 `#3B82F6` 同源） | `keyboard-focus` `#3B82F6` |

**推论**：①数值不是从 IA 量出来的，是另行拟定的；②更要紧的是，**IA 里普通键与动作键是同一个底色**（FULL 的 "1" 与 CAPS 相差 1 个通道单位），而详设 `:138` 却要求 `keyboard-action` "与普通键保持层级差异"，并给出比 `keyboard-key` 明显更亮的 `#334155`（Δ≈(20,24,34)）。这是在已确认图之外新增了一层视觉语义。

**反例（判据抓不住自己）**：V-7 的两端——theme 值和 reference baseline——都由详设 §2.2 这张表派生（`design:289-292`：生成器"读取 token 表…生成 reference PNG"）。同一个输入喂两边，**V-7 恒真**。V-1..V-12 中没有任何一条把任何产物与 approved IA 的像素比较，IA 在整套判据里只以散文形式存在。同理 `keyboard-focus` 的唯一消费点被设计成 CAPS/SHIFT 的 `selected`（`design:181-187`），而 IA 里带 accent 的是字符键（FULL "5" 实心、NUMERIC "0" 描边、ALPHA "R"、MOBILE "M"），没有一处在 CAPS/SHIFT 上——图例写了 "(example)"，所以这不算冲突，但**它意味着 accent 的真实目标状态未被任何判据覆盖**。

**附带观察**：approved IA 的 FULL 副标题写 "Numbers, letters and actions. 8 keys per row."，而该面板实际渲染 10 键/行。详设 §2.1 `:95-99` 按 10 键写，是对的；这条只是提醒该资产自身有一处文案不自洽，后续若有人拿副标题当正本会走偏。

**最小修复**：二选一并写进详设——(a) 把 §2.2 的值改为从 approved IA 量取的值，并取消 key/action 分层；或 (b) 保留分层与现值，但在 §2.2 明写"这是超出 approved IA 的新增视觉决定，待 Dexter 裁决"，且在 V-7 之外补一条**真正以 approved IA 为参照**的判据（哪怕是人工判定，按仓内既有写法写明谁/设备/分辨率/看什么/产物落哪）。无论哪条，都不能让"palette 与 canonical baseline 一致"继续冒充"与 IA 一致"。

**owning source**：详设 §2.2、approved IA 资产。**阻断实施**：是（否则 64 份 baseline 按一个未经裁决的调色板生成）。**需 Dexter 裁决**：是——动作键要不要比普通键亮，approved IA 说不要。

---

### M-3 · 逐像素门按当前写法不可执行，且它阻断了全部源码工作 · CONFIRMED

四处独立的不可执行点，都能逐行核到：

1. **比较器没有判定，只有指标**。`tools/terminal-image-compare/compare.mjs:222-234` 只返回 `changedFraction`/`P95`/`meanAbsDiff`/`changedCellFraction`/`threshold`；`:245-251` 的 CLI 打印 JSON，`:256-262` 只有抛错才置 `exitCode`。**不匹配不会失败**。详设 `:291-292` 把它称作"最终 ROI 比较执行体"、计划 `:248-251` 直接 `node compare.mjs …` 然后"读取并记录"，中间没有任何一方把 `exactRgbaMismatchCount` 与 0 比较并关门。
2. **metadata 合同与既有工具互斥**。`compare.mjs:119` 要求 `canvasRect`、`:140-142` 要求 `minUnmaskedFraction` **严格等于 0.25** 否则失败关闭、`:126-128` 要求 `roiRect` 至少占 canvas 20%、`:137-139` mask 不超过 80%、`:211` mask 不得排除全部格子。而详设 `:285-286`、计划 `:98-99`、`design-granularity.json:35` 给出的 entry 必填字段里**既没有 `canvasRect` 也没有 `minUnmaskedFraction`**。照 manifest 生成的 metadata 喂进去，第一步就是 `canvasRect must be an object`。
3. **exact-rgba 与 REFERENCE_RENDER 在数学上不可能同时成立**。baseline 的 `measurementMethod` 只能是 `REFERENCE_RENDER` 或 `APPROVED_CAPTURE`（`design:286-287`），且 `:313-315` 禁止从运行后截图倒推。但 runtime 侧是 react-native-web / Android Skia：键面文字是平台字体栅格化，backspace/complete 是 `react-native-svg` 的 `strokeWidth=2`、`strokeLinecap="round"` 描边（`primitives/src/vendor/slots.tsx:121-134`），`rounded-md` 是抗锯齿圆角，`shadow-lg` 是平台各自的阴影/elevation。一个 Node 生成器产出的 PNG 与它们**逐字节相等**不可能发生，而 `:326` 又明文禁止"自动 anti-aliasing 容忍"。唯一出口是 `maskRects`，但详设没有任何 mask 策略（遮字形？遮圆角？遮阴影带？），而遮掉这些之后 §6.3 `:333` 所说"focused 证不了阴影/字体/抗锯齿"就再无任何执行体去证。剩下的出口 `APPROVED_CAPTURE` 等于"人批准的运行截图"，与 `:313-315` 的自证禁令循环。
4. **与仓内既有裁定冲突**。`2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md:254` 已把该工具定性为"只作 ROI 辅助，不是 absolute oracle"。本详设把它升为 gate 执行体，属于在未取得新裁决的情况下推翻既有结论。

**影响面**：计划 `:39` 与详设 `:299-301` 规定 CP-0 不 MATCHED 就"不写源码、不得进入动态运行"。于是 alpha CAPS、删 `#FFFFFF`、token recipe 这些确定、便宜、已经过 IA 确认的修复，被一个不可能关闭的门永久挡住。

**最小修复**：把 §6 拆成两段并写进计划——①**机器可判**的部分：ROI 几何/尺寸 readback、token 值 readback、同设备改前/改后 ROI 差分（`compare.mjs` 的原语义，带 `canvasRect` 与 `minUnmaskedFraction: 0.25`），失败即红且必须有非零退出；②**机器不可判**的部分（字形、阴影、抗锯齿、"像不像 IA"）标 `UNVERIFIABLE_BY_MACHINE`，写明判定人、设备、逻辑分辨率、看哪几处、什么算通过、产物落 `doc/evidence/` 何处。同时把 CP-0 的阻断口径从"像素 baseline 全部就绪"改为"token/几何/分母就绪"，让 CP-1..CP-3 可以推进。若仍坚持 exact-rgba，必须先在详设里给出 mask 策略与它能覆盖的像素比例，否则该门不可写。

**owning source**：详设 §6、计划 §3/§8.2、`tools/terminal-image-compare/compare.mjs`。**阻断实施**：是。**需 Dexter 裁决**：是——像素门到底是通过条件还是辅助证据，这条已被仓内文档裁过一次，本详设要翻案需要他点头。

---

### M-4 · Web `onClick` 这条 surface-dismiss 入口在本仓任何测试里都不可能变红 · CONFIRMED

**仓内事实**：`VirtualKeyboard.tsx:32-34` 在**模块顶层**求值 `typeof document === 'undefined' ? {onTouchEnd} : {onClick}`，结果在 `:139` 展开到 keyboard root。而 `apps/terminal` 下全部 20 个 `vitest.config.ts` 都是 `environment: 'node'`（含 `ui/base/input/vitest.config.ts:11`、`ui/base/primitives/vitest.config.ts:15`、两个 integration 的 `:11`/`:16`）；仓内没有任何 `@vitest-environment` 覆盖，没有 jsdom/happy-dom 依赖，共享 setup `tools/terminal-shared/react-native-vitest.setup.cjs` 也不定义 `global.document`。

**推论**：`typeof document === 'undefined'` 在所有测试里恒为真，Web 分支恒不执行。

**反例**：计划 `:127` 与 `:164` 把"删除 composed Web root `onClick`"列为必红变异，详设 `:192-193` 断言"Native 与 Web 两个事件入口都必须由 composed `VirtualKeyboard` focused test 覆盖；只测 native touch 不能关闭这条边界"。实际把 `:34` 的 `onClick` 分支整段删掉，`environment: 'node'` 下所有断言依旧全绿——**V-8 的 Web 一半不可证伪，而详设正是用它来声称边界已闭合**。真实后果不是测试问题：Web 预览里这条 guard 是无条件 `stopPropagation`，一旦静默失效，点任意键都会触发 `InputSurfaceFrame` 的 dismiss，键盘每次按键即收起。

**最小修复**：详设里写明机制而不是只写要求——为 keyboard root 增加一个 `// @vitest-environment jsdom` 的独立测试文件，并因为 `:32` 是模块级常量而必须 `vi.resetModules()` + 动态 import 才能重新求值（`PrimitivePinInput.tsx:25`、`InputSurfaceFrame.tsx:91` 是 render 期求值，不受此限，不能照抄它们的写法）；这需要新增 jsdom devDependency，属于新依赖，须在详设 §4 显式登记。若不接受新依赖，则把入口选择从模块常量改为 render 期可注入的函数，并写明这是为可证伪性所做的结构改动。二者选其一，不能维持现状还声称已覆盖。

**owning source**：`VirtualKeyboard.tsx:32-34` + 各包 `vitest.config.ts`。**阻断实施**：是（否则 V-8 交付时只能改判 OPEN）。**需 Dexter 裁决**：仅"是否允许为此新增 jsdom 依赖"一项。

---

### S-1 · alpha 加 CAPS 会连带改变 region 分组与 `region:*` testID 归属，详设有两种读法 · CONFIRMED

**仓内事实**：当前 alpha 第二行是 `textRow({value:'asdfghjkl', zone:'letters', align:'center'})`（`keyboardLayout.ts:136`），`region='letters'`；full 的同位行是 `compoundRow([actionKey('caps'), ...asdfghjkl])`（`:120`），`compoundRow` 固定 `region:'actions'`、`align:'start'`（`:87-88`）。`VirtualKeyboard.tsx:107-118` 按连续相同 region 合并，`:145-150` 用 region 生成 `ui.base.input:virtual-keyboard:region:<region>`。

**推论/反例**：若按 full 的写法给 alpha 加 CAPS，alpha 的 region 序列从 `[letters, letters, actions]` 变成 `[letters, actions, actions]`，`text-a` 从 `region:letters` 移入 `region:actions`——`test/virtualKeyboard.test.tsx:79-85` 现有的 alpha 断言（`letters:['text-a']`）会红；对照 full 的断言 `:74-77` 正是把 `text-a` 列在 `actions` 下，可反证这一机制。若改为 `row({keys:[caps,...], region:'letters', align:'center'})` 则 testID 不动，但 alpha 与 full 的结构就不再同形。详设 `:61`/`:119` 与计划 `:138-139` 只说"第二行首位加入 caps、保留 3 行 10 列和所有原有 keyId"，两种读法都满足，实施方必然自行猜测——正是本轮要求排除的那类歧义。（高度不受影响：两种读法都是 `48*3 + 3 + 3 + 18 = 168`，我按 `styles.content`/`styles.region` 各自的 `gap:3` 算过。）

**最小修复**：详设 §2.1 明写 alpha home row 采用 `compoundRow`（与 full 同形、`region='actions'`、`align='start'`），并在 §4 的 `virtualKeyboard.test.tsx` 行登记"alpha `region:*` 归属随之变更、现有断言需同步更新"，否则这条变更会以"测试红了顺手改"的形式无归属地发生。

**owning source**：`keyboardLayout.ts:132-147`。**阻断实施**：否，但不修会产生未归属的 testID 漂移。

---

### S-2 · 历史需求 §5.2 仍在描述旧 numeric，而它同时被指定为对账分母 · CONFIRMED

**仓内事实**：`2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md:196-211` 原文仍是"`0` 横跨前两列，backspace 与 complete 在右侧第三列内部左右分布"，含示意图 `0 0 | backspace 完成` 与"大零键"理由。该文件今天被改过（`:9` 的 `USER_VISUAL_REVISION` 新增了 2026-09-19 的 alpha CAPS 确认），**但同一次修订没有补 numeric 的 supersede**。

**推论**：详设 `:44-47` 与计划 `:63-64` 只要求"实施方不得恢复旧布局"，管住了代码，没有管住正本。而计划 `:53` 把该文件列为 CP-0 必读输入、`:194` 把它列为全批三维对账的第一维。于是 CP-4 的对账要么如实报 OPEN，要么由对账人"心里知道要忽略"——后者正是分母被绕过的形态。

**并置事实**：当前工作区的 numeric 三列是**未提交改动**（`keyboardLayout.ts:154-161` 相对上次提交把 `{span:2,[0]},{span:1,[⌫,↵]}` 改成三个 `span:1`，配套 `test/keyboardLayout.test.ts` 同步）。计划 `:79` 已把它写入"layout/pixel 对账"分母，这点做得对；欠的是正本同步。

**最小修复**：CP-0 增加一条动作——按该文件既有的 `USER_VISUAL_REVISION` 机制补记 2026-09-19 的 numeric supersede（与同日 alpha CAPS 一样的写法），或直接改写 §5.2 正文。按 `CLAUDE.md` 的架构原则，优先删除过时表述而不是靠"不得恢复"的口头约束长期共存。

**owning source**：`requirements-v2-codex.md:196-211`。**阻断实施**：否。**需 Dexter 裁决**：否（他 2026-09-19 已确认三列）。

---

### N-1 · 冻结的 class recipe 清单里没有 selected/pressed 形态，但 baseline 要求这两种 state

详设 `:172-179` 冻结的 recipe 只有 `keyboardDock`/`keyboardKey`/`keyboardAction`/`keyboardButtonText`/`keyboardActionText`/`iconKeyboardAction` 六条，`:182` 说 selected 时"adds the keyboard-focus border recipe"却没定义这条 recipe（边框宽度？是覆盖 `border-keyboard-border` 还是叠加？参照 `tokens.ts:48-50` 的 `pinCell*` 用 `border-2`）。pressed 形态同样无定义，现状是 `PrimitiveButton.tsx:14-18` 的 `opacity/scale`。而 §6.1 `:306` 要求 baseline 覆盖 `idle、caps locked、shift armed、pressed/action` 四态——后三态没有可生成的规格。另：`pressedStyles` 是 `Record<PrimitiveButtonVariant, ViewStyle>`，新增 variant 会触发类型缺口，实施时需一并处理。

### N-2 · §3.2 的 renderer 缓存优化的是详设自己证明为冷的路径

详设 `:227`/§3.1 的第 1 条已论证普通字符不触发键盘刷新——我核到实处：`useInputKeyboardController.ts:27-31` 只在 `effect==='mode'` 或 shift/capsLock 变化时才 `forceKeyboardUpdate`，`editText.ts:85` 的 text key 返回 `effect:'edit'`，加上 `VirtualKeyboard` 的 `memo`，普通字符根本不会重渲染键盘。因此 §3.2 要缓存的 `keyGroups`/几何本就不在热路径上。详设诚实地不宣称性能改善，这点很好；但按 `CLAUDE.md`"简单方案已满足需求就不要升级"，这段可以直接删掉，省下的复杂度比它省下的计算多。

## 4. 已核对且判为成立，不构成 finding

- **numeric 三列是最新正本**：approved IA 实测为 4 行 × 3 等宽列、底行 `⌫ | 0 | ↵`；`keyboardLayout.ts:154-161` 与之一致；详设 `:44-47`、计划 `:63-64`、granularity `:42`/`:44` 三处口径统一，没有任何一处写"保留为未归因的既有变更"。
- **mobile inset 不被误读为第二套 key inventory**：approved IA 的 MOBILE 面板实测第二行是 `A S D F G H J K L` 九键居中、确无 CAPS（我裁图放大确认），风险真实；详设 `:48-51`、计划 `:65-66`、granularity `:43` 已把它限定为承载比例示意且明确不据此生成 baseline。处置正确。顺带：该 inset 的形态恰好等于**当前** alpha 的实现（`keyboardLayout.ts:135-136`），这解释了歧义从何而来，也是后续若要单独出 mobile IA 时的参照。
- **CAPS 是持久锁而非 label 假象**：`editText.ts:91-94` `caps` 切换 `capsLock` 并清 `shift`、`effect:'mode'`；计划 `:143` 的 `CAPS → a → b → CAPS → c ⇒ ABc` 序列我按 `insertText:49` 推过，成立。V-3 的反例（改成 one-shot）确实会红。
- **alpha 不增高**：`maxColumns` 本就是 10，第二行 9→10 不改 `cellWidth`，三行高度仍 168。
- **不重复造轮子**：复用 `PrimitiveButton`/`PrimitiveIcon`/既有 `compare.mjs`，不新增第三方依赖、不造第二个 renderer——除 M-4 可能需要的 jsdom 外，方向正确。
- **档位诚实**：详设 `:142-151` 的 `WEB/ANDROID/VISUAL=NOT_RUN`、`PERFORMANCE=NO_PERFORMANCE_CLAIM`、`IMPLEMENTATION_AUTHORITY=false`，以及 round-2 报告保留原始 `NO-GO` 不改判，都没有把未运行写成 PASS，也没有虚构 FPS 或性能改善结论。这两轮独立审查的质量本身没有问题。

## 5. 结论

`VERDICT=NO-GO`，`M/S/N=4/2/2`。M-1 与 M-4 是可直接修的分母/执行体缺口；M-2 与 M-3 需要 Dexter 先裁两件事：**动作键要不要比 approved IA 多出一层亮色**，以及**逐像素比较在本阶段是通过条件还是辅助证据**。这两条裁完，其余修改都在 Codex 既有边界内，不需要新的授权。

本结论只覆盖详设与实施计划的可实施性；不代表源码实现、测试、Web、Android、visual、release、cleanup 或 acceptance 通过，也不授权任何运行动作。
