# TER 虚拟键盘视觉与交互实现计划

> STATUS: PROPOSED_FOR_DESIGN_REVIEW
> IMPLEMENTATION_AUTHORITY: false
> REVIEW_TARGET: DESIGN
> DESIGN_SOURCE: doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md
> HISTORICAL_REQUIREMENTS_SOURCE: doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md
> IA_ASSET: doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-complete.png
> IMPLEMENTATION: NOT_AUTHORIZED
> DYNAMIC_EXECUTION: NOT_AUTHORIZED_IN_THIS_TURN
> CLAUDE_REVIEW_INTAKE: ROUND_1_NO_GO_4M_2S_2N; ROUND_2_NO_GO_1M_2S_2N_INTAKE_REPAIRED; PALETTE_DECISION_CLOSED_BY_DEXTER

## 1. 目标、范围与开工门

### 1.1 目标

按已确认 IA 实现四种程序虚拟键盘的共同视觉契约，并完成以下闭环：

1. alpha 在三行内增加持久 CAPS，复用现有 edit model；
2. 键盘 dock、普通键、动作键、文字和 icon 全部通过 primitives semantic token 呈现；
3. `sample-console` 与 `sample-wallpaper-console` 各自持有同名 theme 变量与 Tailwind mapping，
   不让 base/input 持有应用色；
4. 保留 InputProvider/VirtualKeyboard 的局部更新边界，不因视觉改造引入逐字符整棵表单刷新；
5. 在交付实现前完成静态、focused、Web/Android 动态和 IA↔runtime 固定 ROI 视觉对账；
   视觉一致至少约 98%，任一对账 `OPEN` 都不得写“实施完成”或“视觉通过”。

### 1.2 不得扩大范围

不改业务 feature/state/command，不新增会员字段，不改 system IME、admin login、surface
topology、keyboard owner、input snapshot 或 field 文案；不新增第三方依赖，不创建第二个
keyboard renderer，不把 layout/keyboard token 复制进两个 integration 的业务组件。

实施前必须确认 `MemberForm` 的 alpha probe 仍存在且仍为 sample-only；如果不在当前源码，
CP-0 停止并回到设计层，不以新增业务字段补洞。

## 2. 批次与依赖

| 批次 | 落点 | 入口条件 | 收口判据 |
| --- | --- | --- | --- |
| CP-0 | IA、固定 ROI manifest、源码分母、依赖与 token 设计 preflight | 详设与计划 review 通过、Dexter palette decision 已记录、实现授权明确 | token/geometry manifest、改动分母、现状差异和 owner 全部 MATCHED；否则不写源码 |
| CP-1 | primitives keyboard surface/token recipe 与两个 integration theme | CP-0 MATCHED | primitive render、两个 theme test、typecheck 和红变异全闭；fresh 三维对账 MATCHED |
| CP-2 | alpha layout/CAPS 与 VirtualKeyboard renderer 接缝 | CP-1 MATCHED | alpha/全布局/编辑语义/renderer boundary focused 通过；fresh 三维对账 MATCHED；不新增冷路径 cache |
| CP-3 | integration consumer readback、README、静态与 focused 汇总 | CP-2 MATCHED | 两个 integration 的主题、sample-only consumer、公共面和非目标范围对账 MATCHED |
| CP-4 | 全批三维对账、逐代码与详设对账、动态前置 | CP-3 MATCHED | 全批三维 MATCHED；任何动态运行前逐行 code↔design MATCHED |
| CP-5 | Web/Android 动态体验与 IA↔runtime 固定 ROI visual reconciliation | CP-4 MATCHED 且动态授权 | 每个平台/主题/目标 surface/state 的 visual、geometry、焦点和 cleanup evidence 关闭 |

CP-5 不得提前到 CP-4 之前。CP-1/CP-2 之间不允许留下只有 token 没有 renderer、或只有
alpha 行没有编辑语义的半套状态。

## 3. CP-0：设计和分母 preflight

主 agent 在修改任何生产文件前逐项重新打开：

- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`；
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`；
- 本次详设；
- complete IA PNG 及 SHA-256；历史 `ia-approved.png` 仅作风格来源参考；
- `keyboardLayout.ts`、`editText.ts`、`VirtualKeyboard.tsx`、`InputProvider.tsx`；
- primitives token/Button/Icon/Container 与两个 integration CSS/Tailwind/theme test；
- `apps/terminal/assembly/base/android/config/index.cjs`、两个 Android App 的 Tailwind config
  与其 owned config test；
- `MemberForm.tsx` 和 input/primitives owned test entry。

CP-0 还必须先登记三项视觉正本收口：

1. 本批 numeric 目标是当前 IA 与源码已有的三列底行
   `BACKSPACE | 0 | COMPLETE`，旧需求稿中的“0 跨两列”属于历史文字，不得恢复；
2. mobile inset 不是 alpha key inventory。mobile runtime 仍使用包含 `CAPS` 的完整 alpha
   definition；inset 只提供紧凑承载比例示意，不能直接生成 pixel baseline。
3. mobile 的 `CAPS` 与 `SHIFT` 只做符号化显示，分别为 `⇪` 与 `⇧`；laptop 保持
   `CAPS` 与 `SHIFT` 文案。key kind、testID、handler、capsLock/shift 语义和键位不变。
   financial 的 `−` 与 `·` 同样只改变呈现标签，事件仍发送 ASCII `-` 与 `.`。
4. 历史需求稿 §5.2 的“0 跨两列”必须在进入实施前按 `USER_VISUAL_REVISION` 机制登记为
   superseded，当前 IA 的三列 numeric 才能作为唯一对账正本；该文档同步属于 CP-0 的文档动作，
   不得静默忽略。

若实施方不能接受这三项优先级，或 palette readback 与 Dexter 的
`A_NEUTRAL_PLUS_THEME_FOCUS_BORDER` 不一致，CP-0 记录 `DESIGN_GAP=OPEN`，不自行挑选
另一种布局/颜色。

输出 `CP-0` readback：

| 项 | 必须记录 |
| --- | --- |
| alpha consumer | `MemberForm` alpha probe 仍是唯一受控 consumer；不进入业务 payload |
| current gap | alpha 缺 CAPS、dock `#FFFFFF`、generic action/surface palette、mobile modifier 尚未符号化、现有 performance boundary |
| no-go files | admin login、feature business actor、store、command、IME、topology、App/Metro |
| baseline | complete IA PNG hash；CP-0 生成并校验含 `canvasRect`、`roiRect`、`maskRects`、`minUnmaskedFraction=0.25` 的固定 ROI manifest；机器门只收 geometry/token，不能预报 visual PASS |
| dependency | 只复用 React/React Native/NativeWind/现有 primitives，不加包 |
| numeric current state | 当前 workspace 的 numeric 底部三列是本轮 IA 已确认目标；本批不重写其业务语义，但必须纳入 layout/pixel 对账 |
| theme denominator | 两个 integration CSS/Tailwind、两个 Android App Tailwind、assembly-base-android `sharedColors`；七个有色 keyboard token 必须同名映射，backdrop 固定透明 |
| palette readback | `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER`：surface/key/action/两个 foreground 的 computed RGB 两主题相等且 key/action 相等；border/focus 由各 integration 持有，focus 两主题不等；CP-0 记录取样区域和统计方法 |

CP-0 的 red mutation 是把 `MemberForm` alpha probe 删除或将其接入 `submitMemberCommand`；
现状扫描/consumer 对账必须对此变红。

CP-0 的视觉 baseline 输出固定为：

```text
doc/evidence/platform/terminal-input-keyboard-visual/cp0/baseline-manifest.json
doc/evidence/platform/terminal-input-keyboard-visual/cp0/baselines/<platform>/<integration>/*.png
doc/evidence/platform/terminal-input-keyboard-visual/cp0/baselines/<platform>/<integration>/*.metadata.json
```

manifest 必须逐 entry 记录
`platform/integration/logicalViewport/layout/state/canvasRect/roiRect/maskRects/`
`minUnmaskedFraction/png/sha256/tokenSnapshot/sourceInputs/measurementMethod/comparisonMode`；
`minUnmaskedFraction` 必须为 `0.25`，缺字段、错 hash、错尺寸或 `RUNTIME_SELF_BASELINE`
均让机器 baseline gate 保持 `OPEN`。manifest 字段可由 CP-0 的轻量校验步骤读取，
`tools/terminal-image-compare/compare.mjs` 只复用既有 `legacy-threshold` ROI 差异输出，
不改旧调用方语义，也不把差异结果当作非零退出码。

`measurementMethod` 按 entry 固定选择：`REFERENCE_RENDER` 只覆盖几何与键面/底色区域；
文字包围盒、图标包围盒和阴影带进入 `maskRects`，由人工视觉复核。首次经 IA 人工确认的
同平台、同主题、同状态捕获可登记为 `APPROVED_CAPTURE`，后续同条件 run 以它作防漂移
参考；不能把未经人工确认的运行截图自封为 baseline。mask 不得覆盖键面、间距、边框、
dock 几何或 selected 边界，面积上限沿用 `compare.mjs` 的 80% canvas 限制，且每个未遮挡
网格格子的 `minUnmaskedFraction` 固定为 `0.25`。这些规则只增加轻量 readback，不新增
第二个图片比较器。

## 4. CP-1：primitive 与 theme

### 4.1 实施顺序

1. 在 `ui-base-primitives` 中增加 keyboard semantic class/token，先让普通 key、action key、
   text/icon 和 dock 都有明确 semantic owner。
2. 增加 `PrimitiveKeyboardBackdrop` 与 `PrimitiveKeyboardSurface`：backdrop 负责 keyboard
   占用区域的全宽透明承载层，surface 负责内缩 dock 的背景、边界、尺寸 style、统一的
   中性 panel shadow 和结构化 touch/click stopPropagation 透传；不读取 input context，不实现
   dismiss。panel shadow 不读取 Android 宿主 `colorPrimary`；键面不再附加 key-level shadow。
3. 让 `PrimitiveButton` 的 `key/key-action` recipe 与 `PrimitiveIcon` 的 keyboard-action
   recipe 使用新 token；`PrimitiveButton.selected` 只在 keyboard variant 上消费
   `keyboard-focus`；不改变非 keyboard button/icon。
4. 在两个 integration 的 `global.css` 与 `tailwind.config.cjs` 各加入七个有色同名变量/mapping；
   backdrop 固定使用 `bg-transparent`。同时在 `assembly/base/android/config/index.cjs` 的
   `sharedColors` 保持七个有色同名 mapping，
   让两个 Android App 的 Tailwind config 与 integration 共享 CSS variable 名称。RGB 只在
   integration theme owner 中声明，base 不保存 RGB。
5. 补 primitives、两个 integration theme tests 和 assembly-base-android config test；测试
   读取 computed channels、integration mapping、两个 App 的继承结果，并对照
   `terminal-invariants.json`/README 公共面，若
   primitives public surface 变更，必须同步 public export、invariant、README。

### 4.2 CP-1 红变异

| 变异 | 必须变红的执行体 |
| --- | --- |
| dock 恢复 `backgroundColor:'#FFFFFF'` | primitive/input render + source boundary |
| key recipe 恢复 `bg-action`/`bg-surface` | primitive render class assertion + geometry/token machine readback |
| 删除一个 integration 的 CSS 变量或 Tailwind mapping | 该 integration theme test |
| 删除 `sharedColors` 的任一 keyboard mapping 或只修改 integration 不修改 Android mapping | assembly-base-android config test 必红 |
| 两个 integration 被强制为未批准的固定青色或 app action 色 | theme value/canonical palette assertion |
| 两个 integration 的任一中性色不相等、key/action 被分层，或 keyboard-focus 被强制为同值 | 对称性 theme test 必红 |
| 删除 `onTouchEnd`/`onClick` 透传 | primitive/input boundary test；Web/native 两分支分别 stub 环境，不能证明真实冒泡时转 device OPEN |
| 删除 composed Web root `onClick` 或 native root `onTouchEnd` 任一入口 | render-time environment focused test 对应分支必红 |
| document stub 在用例后未恢复，或删除恢复守卫 | primitives/input 两侧 `afterEach` 的 document identity/presence guard 必红 |
| 删除 `PrimitiveButton.selected` 的 `keyboard-focus` 消费 | CAPS/SHIFT selected render test 必红 |
| 删除 `PrimitiveButton` pressed 状态对 `key/key-action` 的 `keyboard-focus` 边框消费 | 普通 key 与 action pressed render test 必红；释放后 idle 边框恢复断言也必须保留 |
| 删除 dock 高度公式中的 `DOCK_BORDER_WIDTH * 2` | `keyboardHeight.test.ts` 的 laptop/mobile content-plus-border 断言必红 |
| 非 keyboard button 被意外改为 keyboard token | primitives regression test |

CP-1 focused proof 必须先执行，再由 fresh 只读子 agent 做需求/详设/IA 与 project-memory
三维逐项对账；对账不是“读过”，而是逐行输出 `MATCHED` 或 `OPEN`。

所有需要 stub `globalThis.document` 的用例都必须保存原值与“属性不存在”状态，在
`afterEach`/`finally` 中恢复，并由 primitives 与 input 两侧各至少一条 guard 断言原状态；
不得依赖测试文件自动清理或跨用例共享 stub。

## 5. CP-2：alpha CAPS 与 renderer 效率

### 5.1 代码步骤

1. 在 `keyboardLayout.ts` 将 alpha home row 改为与 `full` 同形的
   `compoundRow([CAPS, ...ASDFGHJKL])`，保留 3 visual rows、10 columns、dense spacing 和
   所有原有 keyId；同步接受该行从 `letters` region 进入 `actions` region 的 region/testID 变化。
2. 保持 numeric 当前已确认的三列底行，不恢复旧的跨列 0；新增/保留 focused sequence
   断言 `BACKSPACE → 0 → COMPLETE` 的 testID 与列位置。
3. 不修改 `editText.ts` 的 CAPS 算法；只补充 alpha 通过 `caps` key 的 focused sequence：
   CAPS → `a` → `b` → CAPS → `c`，得到 `ABc`（或同等可复核序列）。
4. `VirtualKeyboard` 改用 `PrimitiveKeyboardSurface`，保留 keyboard interaction boundary、
   key testID、complete/backspace icon 和 `memo`；同时显式传递 `selected` 给 CAPS/SHIFT，
   让 `keyboard-focus` 有真实消费点。
5. 不新增 `keyGroups`、region row model 或 geometry cache；保留 `VirtualKeyboard.memo`、
   静态 definition、regions/handlers 的既有 memo 边界。不得让普通字符输入触发键盘整体
   render 或把业务状态引入 renderer。
6. 复核 `InputProvider`：字符 key 不调用 `forceKeyboardUpdate`，CAPS/SHIFT/owner/capacity
   变化仍调用。若为满足视觉而修改 provider，必须补独立 focused proof，不能顺手改订阅语义。

### 5.2 CP-2 红变异与测试

| 变异 | 预期红点 |
| --- | --- |
| 删除 alpha CAPS、把 CAPS 放末行或增为四行 | `keyboardLayout.test.ts` 的 key order/row count/height |
| 把 alpha 第二行保留为 `letters` region 而不是 compound actions row | `virtualKeyboard.test.tsx` 的 region 归属断言 |
| caps 只改变文本 label，不改变 `EditState.capsLock` | `editText.test.ts` 的持久序列 |
| caps 变成 one-shot shift | 第二次字母序列断言 |
| 普通字符 key 也 `forceKeyboardUpdate` | provider keyboard render-boundary test |
| 让普通字符输入触发 `forceKeyboardUpdate` 或重建整棵 keyboard | provider/render-boundary focused test |
| key testID 改成 index/文本 | `virtualKeyboard.test.tsx` stable key ID |
| PrimitiveButton 不消费 selected，或只声明不使用 `keyboard-focus` | selected modifier render test |
| 普通 key/action pressed 只保留 opacity/scale、不显示 `keyboard-focus` 边框，或释放后不恢复 idle | primitives pressed-state render test |
| 只保留 native `onTouchEnd`、删除 Web `onClick` | composed Web keyboard-root click test |
| 从 input 直接写颜色 | primitive/theme static boundary |

## 6. CP-3：消费者、README 与静态/focused 验证

`MemberForm` 只做 readback，不为 alpha CAPS 新增生产逻辑。必须核对：alpha probe 的
`fieldId`、`testID`、`keyboardKind='virtual'`、`layout='alpha'`、sample-only 文案、
不进入业务 snapshot/command 的事实仍成立。

执行范围：

```text
apps/terminal/ui/base/primitives       typecheck + owned test
apps/terminal/ui/base/input            typecheck + owned test
apps/terminal/ui/integration/sample-console          typecheck + owned test + theme test
apps/terminal/ui/integration/sample-wallpaper-console typecheck + owned test + theme test
apps/terminal/assembly/base/android/config             owned config test + both App Tailwind readback
apps/terminal verify:static            既有 static gate；首败必须保留，不得改写为 PASS
```

README 需同步说明：keyboard tokens 由 integration theme 提供、primitive 是唯一 renderer
surface、alpha CAPS 是持久锁、普通字符不触发键盘整体刷新；示例必须回源码核对。

CP-3 收口后再做该步骤的 fresh 三维对账；如果对账有 OPEN，先修复并复查，不能进入 CP-4。

## 7. CP-4：全批对账与动态前置

### 7.1 全批三维对账

任何 Web/Android/设备运行前，fresh 只读子 agent 按以下三维逐项对账：

1. `2026-09-06...keyboard-visual-redesign-requirements-v2-codex.md` 与 complete IA；
2. 本详设与本计划；
3. `project-memory` 命中的 terminal coding/architecture/input verification 原文。

核对粒度包含：key 顺序、CAPS 状态、alpha region 归属、行数、高度、颜色/token owner、
Android sharedColors 分母、主题关系、testID、touch boundary、field owner、性能边界、
失败/不可行状态、历史 numeric supersede、禁止新增范围。结果只允许
`MATCHED` 或 `OPEN`；任一 OPEN 都是“实施未就绪”。

### 7.2 逐代码与详设对账

主 agent 再按详设 §4 的文件表逐行列出：

- 实际修改文件；
- 每个修改点对应的详设段落、IA 行/图、theme token 和测试执行体；
- 每个保留点的 readback；
- 每个 red mutation 真实结果；
- 未运行档位和原因。

这张表不能用三维对账结果替代；缺一行或无法指向 owning source 时为 `OPEN`。

### 7.3 Dynamic admission

CP-4 只在 static/focused、步骤级三维对账、全批三维对账和逐代码对账均 MATCHED 后，
并且 Dexter 明确授权动态运行时才可进入 CP-5。当前本轮没有该授权，因此本计划不能
声称任何 Web/Android/visual/release/cleanup 结果。

## 8. CP-5：动态运行与 IA↔runtime 固定 ROI 视觉对账

### 8.1 运行形态

对两个 integration 分别验证 Web 与 Android 能力；每个平台按已受管 runner 的真实入口运行，
不新造按端口/命令名猜进程的 runner。每个 run 必须记录 process/device identity、logical
viewport、density/DPR、theme、layout、state、日志、PNG/UI XML/timeline 和 cleanup。

至少覆盖：

| 形态 | `full` | `alpha` | `numeric` | `financial` |
| --- | --- | --- | --- | --- |
| laptop PRIMARY | 工号/密码路径 | alpha probe | 电话/年龄路径 | financial probe |
| laptop SECONDARY（如既有 input harness 可挂载） | 同 renderer/尺寸语义 | 同 renderer/尺寸语义 | 同 renderer/尺寸语义 | 同 renderer/尺寸语义 |
| mobile PRIMARY | full 可达/高度 | alpha 三行可达 | numeric 四行可达 | financial 四行可达 |

若现有受管 runner 不能安全驱动 alpha/financial probe，不能用 focused mock 冒充，记录
`DYNAMIC_INPUT_PATH=OPEN` 并指出缺少的 owning runner。

CP-5 还必须记录连续击键观察：在 laptop 与 mobile 的可运行形态各连续按下普通 key、
action key、CAPS/SHIFT，再释放，确认 pressed 的主题边框、opacity/scale、modifier 锁定边框
与释放后的 idle 边框没有闪烁、裁切或高度跳动。该观察用于发现 `border-2` 带来的内容盒
内缩，不用 focused class assertion 冒充设备视觉结论。

### 8.2 98% visual reconciliation gate

每个目标 platform/integration/surface/layout/state 依次：

1. 先读 `doc/evidence/platform/terminal-input-keyboard-visual/cp0/baseline-manifest.json`
   和对应 baseline PNG hash；若 `measurementMethod=RUNTIME_SELF_BASELINE`、manifest
   缺字段或 `canvasRect/roiRect/maskRects/minUnmaskedFraction` 不符合既有 comparator
   合同，立即保持 `OPEN`；
2. 固定逻辑尺寸，不 resize、不换 density、不用整屏截图替代 ROI；
3. 采集 dynamic PNG、UI XML/DOM rect、timeline 和 token snapshot；
4. 使用 `node tools/terminal-image-compare/compare.mjs <baseline.png> <runtime.png> <metadata.json>`
   （metadata 必须符合既有 `legacy-threshold` 合同）比较同平台同主题同状态 ROI；读取并记录
   changed fraction、P95、meanAbsDiff、changedCellFraction 与 geometry。另运行 manifest/
   geometry/token validator，对 row/key bounds、surface 尺寸、token readback、CAPS/SHIFT
   selected 和 action icon 做机器门；这些机器门不消费 `changedFraction`。再由指定评审人按
   详设 §6.2 的清单做轻量视觉复核，确认结构和用户可见层级没有明显错位。允许字体抗锯齿、
   阴影栅格化等细微差异；`changedFraction <= 0.02` 是约 98% 的量化参考，超过该值或
   出现明显平面颜色、文字、阴影、状态、图标或位置错误才由视觉记录判为 `OPEN`；
5. 失败时保留 first failure、last known good、broken boundary，按 owning source 最小修复，
   再 focused 重验和重新 capture；不延长 timeout、不盲重跑。

Web 与 Android 的字体/阴影栅格化分开比较，不能把 Web PASS 推成 Android PASS；不以
raw PNG 跨平台零差异作为机器条件。若未来确实要求 raw byte equality，先登记新的
`DEXTER_DECISION` 与平台 mask/rasterizer 合同，不能降低阈值后写 PASS。

### 8.3 Cleanup

动态 run 的业务结果和 cleanup 分开记录。未知进程、残留 Metro/Expo、残留 emulator、缺失
日志或未读回截图都不能写 cleanup PASS。当前无动态授权，CP-5 为 `NOT_AUTHORIZED`。

## 9. Claude review intake（历史第一轮，仅保留审计记录）

本轮 Claude DESIGN review 为 `NO-GO, M/S/N=4/2/2`。主 agent 处置如下：

> 本节只记录第一轮当时的事实与状态。第一轮的 `DEXTER_DECISION_OPEN` 不代表当前状态；
> 当前 palette 裁决与第二轮处置以 §9.1 为准。

| finding | 状态 | 计划落点 |
| --- | --- | --- |
| M-1 Android `sharedColors` 漏出 theme 分母 | `CONFIRMED_REPAIRED` | CP-0 分母 readback、CP-1 sharedColors 与 owned config test、V-6。 |
| M-2 palette 与 approved IA 的 key/action 关系不一致 | `DEXTER_DECISION_CLOSED` | CP-0 按 `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER` 复测五个中性色同值、key/action 同值，border/focus 仍由各 integration theme 持有。 |
| M-3 exact-rgba 机器门不可执行 | `CONFIRMED_REPAIRED_BY_DEXTER_98_PERCENT` | CP-0 建 geometry/token manifest machine gate；CP-5 使用既有 legacy ROI diff，把 `changedFraction <= 0.02` 作为视觉复核的量化参考，不改 comparator 退出语义，不建设 exact-rgba 或逐像素完全相等门。 |
| M-4 Web 分支在 Node 测试不可达 | `CONFIRMED_REPAIRED` | CP-1/CP-2 使用 render-time environment helper，stub/clear `document` 分支测试，不新增 jsdom。 |
| S-1 alpha region 两种读法 | `CONFIRMED_REPAIRED` | CP-2 使用 compoundRow，明确 actions region 与 region testID 更新。 |
| S-2 历史 numeric 正本冲突 | `CONFIRMED_REPAIRED_IN_CP0` | CP-0 按 `USER_VISUAL_REVISION` 同步历史 §5.2 supersede 记录。 |
| N-1 selected/pressed 未冻结 | `CONFIRMED_REPAIRED` | CP-1/CP-5 按详设冻结 selected border、pressed opacity/scale 和四态对账。 |
| N-2 冷路径 cache 过度设计 | `CONFIRMED_REPAIRED` | CP-2 不新增 cache，只验证既有 memo/provider boundary。 |

### 9.1 Claude 复评 intake（当前）

本轮复评结论为 `NO-GO, M/S/N=1/2/2`。M-1 的 palette 冲突已由 Dexter 裁定关闭；S-1、S-2、
N-1、N-2 已按详设、计划和粒度 manifest 修订。复评文件为
`doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-review-round2-claude.md`。

| finding | 状态 | 计划落点 |
| --- | --- | --- |
| M-1 palette 方案未收口 | `DEXTER_DECISION_CLOSED` | CP-0/§2.2 记录 `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER`。 |
| S-1 measurementMethod 与 mask 策略未定 | `CONFIRMED_REPAIRED` | CP-0 与详设 §6.1 固定两种 measurementMethod 的用途，mask 仅含文字盒、图标盒和阴影带。 |
| S-2 ROI 指标没有机器失败执行体 | `CONFIRMED_REPAIRED_BY_SIMPLIFICATION` | CP-5/§6.2 只把 `changedFraction <= 0.02` 作为人工视觉复核参考，机器门仅判 manifest/geometry/token。 |
| N-1 document stub 未恢复 | `CONFIRMED_REPAIRED` | CP-1 focused tests 增加 primitives/input 两侧 `afterEach` identity/presence guard。 |
| N-2 旧 canonical/gate 名称残留 | `CONFIRMED_REPAIRED` | V-1/CP-0 改为 fixed-ROI baseline；粒度 gate 改为 98% visual reconciliation。 |

文档修订完成后按 Dexter 授权进入实施；当时未执行的 V-1 至 V-12、Web/Android/visual/cleanup
结果仍必须分档记录为 `OPEN`，不得由本处置表代替真实证据。

### 9.2 Implementation review intake（当前复评）

当前复评文件为
`doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-review-claude.md`，
结论为 `NO-GO, M/S/N=1/2/3`。主 agent 逐条回源后处置如下：

| finding | 状态 | 处置与落点 | 证据 |
| --- | --- | --- | --- |
| M-1 dock border 不在高度预算 | `CONFIRMED_REPAIRED` | `keyboardHeight.ts` 将 `DOCK_BORDER_WIDTH * 2` 纳入四种布局外框高度；V-13 与 `keyboardHeight.test.ts` 显式断言内容盒加边框不超过外框高度；设计公式同步为 190/246/146/189 | focused red/green：删除边框项时四组断言失败，恢复后通过 |
| S-1 pressed border 参与布局 | `CONFIRMED_RETAINED_WITH_EXPLICIT_COST` | 保留批准 IA 的 `border-2`，不改为颜色或阴影替代；详设改为“外框不变、内容盒按下内缩 1px”，CP-5 增加连续击键动态观察；该观察不能由 focused 结果替代 | static 已确认；真实 visual/device 仍按 CP-5 分档 |
| S-2 Native 每键订阅登录渐变变量 | `CONFIRMED_REPAIRED` | `PrimitiveLoginActionGradient` 子组件只在 `appearance=login-primary` 时挂载 hooks；keyboard key/action 不再建立两项 native variable subscription；primitives focused test 对 key/action 与 login-primary 分别断言 | focused red/green：修复前 key/action 触发 4 次，修复后为 0，login-primary 保持 2 次 |
| N-1 stale `styles.region.gap=3` | `CONFIRMED_REPAIRED` | 删除被 render-time `rowGap` 覆盖的残留 gap；保留 `PrimitiveKeyboardSurface` 自己的 `StyleSheet.create`，不做无关风格重写 | static source readback |
| N-2 compact fallback 口径 | `REJECTED_WITH_EVIDENCE` | `InputKeyboard` 的生产路径总是显式传入按 host frame 判定的 `compact`；`VirtualKeyboard.frameWidth` 的 owning 语义是已计算的 rendered dock width，未传 compact 的直接调用回退按该 dock width 判断。补充 props JSDoc 与既有 360-width focused case，未改变行为 | source readback + existing focused case |
| N-3 evidence review 标识歧义 | `CONFIRMED_REPAIRED` | evidence 改用 `INDEPENDENT_IMPLEMENTATION_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN`，与详设的 independent design review 状态分离 | static evidence readback |

## 10. 交付前状态格式

交付给 Dexter/Claude 前必须附：

1. CP-0 至 CP-5 状态；
2. V-1 至 V-13 逐条执行体与结果；
3. static/focused/Web/Android/visual/release/cleanup 分档；
4. fixed-ROI visual manifest、每份 PNG/UI XML/timeline/hash；
5. 步骤级与全批三维对账；
6. 主 agent 逐代码↔详设逐行对账；
7. 本批实际改动文件与明确未改范围；
8. 任何 OPEN 的 first failure、last known good、broken boundary 和下一动作。

本轮交付只产出详设与计划，不实施、不运行，不把 IA 图、文档或设计自查表写成
implementation/visual/Android/Web/release/acceptance PASS。
