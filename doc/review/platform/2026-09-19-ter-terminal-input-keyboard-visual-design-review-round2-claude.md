# TER 虚拟键盘视觉与交互 · 详设与实施计划复评（Claude round 2）

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=1/2/2
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK
SESSION=CONTINUED_SESSION（非 fresh；本轮所有断言按修订后的字节重新打开核对）
DEXTER_RULING_APPLIED=固定 ROI 约 98%（changedFraction <= 0.02）+ 无明显结构/颜色/文案/图标错位；
                      不要求跨平台 raw PNG 逐字节相等；不要求人工逐像素完全一致；字体抗锯齿与平台栅格化差异单独记录
COMMANDS_RUN=无构建/测试/设备/Web/Android/Metro/Git 动作
WRITES=仅本文件
AUTHORITY=只针对详设与实施计划；不授权源码、测试、构建、Web、Android、设备或部署
```

## 1. round-1 八条的复核结果

按修订后的字节逐条核，**七条实质关闭，一条按裁决口径关闭，一条仍 OPEN 且被正确标注**：

- **M-1 Android `sharedColors` 分母** —— `CLOSED`。已进入 §0.2 第 7 行、§2.2 的 `:150-153`、§4 的两行落点（`:270` 与 `:271`）、V-6、CP-0 readback 的 theme denominator 行、CP-1 步骤 4、CP-1 红变异表"删除 `sharedColors` 任一 keyboard mapping 或只改 integration"、CP-3 执行范围以及 CP-4 对账粒度。口径也对：`sharedColors` 只补 `rgb(var(--color-keyboard-*) / <alpha-value>)` 映射、不持有 RGB，与现有 30 条字面量同形。我另核了执行体可行性：两个 Android App 的 `package.json` 第 44 行都声明 `nativewind 4.2.6`，`assembly/base/android` 已有 `test/` 与 `vitest.config.ts`，V-6 要求的 owned config test 有真实住址，`createTailwindConfig` 不触发 Metro 路径，可在该包内加载两个 App config 读继承结果。

- **M-3 像素门不可执行** —— 按 Dexter 裁决 `CLOSED_BY_RULING`，且**阻断性已真正解除**：CP-0 的收口判据改为 token/geometry manifest（计划 `:40`、`:84` 的"机器门只收 geometry/token，不能预报 visual PASS"），源码工作不再被像素产物挡住；`exact-rgba` 分支取消，comparator 旧语义保留；我上轮指出的 metadata 缺口已补全——`canvasRect`、`minUnmaskedFraction=0.25` 进了必填字段（详设 `:316-318`、计划 `:103-105`、粒度清单 `entryRequiredFields`），与 `compare.mjs` 第 119 行和第 140 至 142 行的硬合同对得上。残留两处见 §2 的 S-1/S-2。

- **M-4 Web 分支不可达** —— `CLOSED`，而且比我建议的方案更好。详设 `:214-216` 取消模块顶层常量，改为 render 期纯函数求取，Node 测试同进程 stub/清除 `globalThis.document` 分别覆盖两条分支，**不新增 jsdom 依赖**；§4 的 `VirtualKeyboard` 行把"把环境选择留在模块级常量"列为不得做；红变异在计划 `:139` 与 `:178` 各有一条。

- **S-1 alpha region 两种读法** —— `CLOSED`。详设 `:121-126` 明确采用 `compoundRow`、该行 region 固定为 `actions`、`text-a` 等从 `letters` 移入 `actions`、region 级 testID 与断言必须同步，并点名"不得在实现时自行改成保持旧 region 的另一种读法"；计划 `:152` 同步，`:171` 有对应红变异。歧义消除。

- **S-2 历史 numeric 正本** —— `CLOSED`。计划 CP-0 第 3 项（`:70-72`）要求按 `USER_VISUAL_REVISION` 机制把历史需求 §5.2 登记为 superseded，并写明"属于 CP-0 的文档动作，不得静默忽略"；CP-4 对账粒度也加入了"历史 numeric supersede"。

- **N-1 selected/pressed 未冻结** —— `CLOSED`。详设 `:204-209` 冻结 idle 一像素 `keyboard-border`、selected 用与 `pinCellFocused` 同形的 `border-2 border-keyboard-focus`、pressed 沿用现有 `opacity 0.78 / 0.72` 与 `scale 0.985`，并要求四态都进对账。补一句核实：RN 是 border-box，1px→2px 只压缩内容盒不改外框，详设"不改变外框几何"的说法成立。

- **N-2 冷路径 cache** —— `CLOSED`，处置比我建议的更彻底：§3.2 直接删除新增 cache 要求并写明理由（冷路径再缓存只增加 identity 约束），计划 `:160-161` 同步。

- **M-2 palette 与 approved IA 冲突** —— 仍 `OPEN`，但**文档处置正确**：详设 `:158-168` 把表降级为 `PALETTE_PROPOSAL`，写明"approved IA 的可量取结果显示普通键与动作键目前是同一底色，而下表人为增加了层级差异"，给出 `PALETTE_A`/`PALETTE_B` 两案，`:165` 禁止未定前生成 canonical baseline 或让 V-7 写 PASS，`:183` 把 `PALETTE_DECISION=OPEN` 定为 design blocker；V-7 的执行体也从自洽的 readback 改成"palette decision readback + token geometry machine gate + 人工 IA 视觉对账"，我上轮指出的恒真问题随之消失。这已不是文档缺陷，是待你拍板的一项决定。

## 2. 本轮 findings

### M-1 · `PALETTE_DECISION` 未裁决，详设自己把它定为 design blocker · DEXTER_DECISION

这不是文档缺陷。详设 `:162-163` 的两案是：`PALETTE_A` 按 approved IA 量取值重定表并取消普通键/动作键的颜色层级差异；`PALETTE_B` 保留层级差异但记录为超出 approved IA 的新增视觉决定。

我上轮实测的 approved IA 值供你决策：dock 约 `#131719` 至 `#14181A`；普通键约 `#282D31`；动作键 CAPS `#272C30`、SHIFT `#282D31`、COMPLETE `#272C31`、BACKSPACE `#2F3439`——与普通键同一区间，差异在 1 至 7 个通道单位内，肉眼是同色。accent 约 `#3583FE`，与图例标注的 `#3B82F6` 同源。详设当前提案给 `keyboard-action` 的 `#334155` 比 `keyboard-key` 的 `#1F2933` 亮出约 (20,24,34)，是可见的一层。

选 `PALETTE_A` 还需一并裁：两个 integration 的键盘中性色是否按 IA 同值，以及 focus 是否仍按各自主题（现提案是 sample-console 蓝、wallpaper 红，IA 图例写的 "(example)" 支持主题化）。

**影响面**：决定 CP-0 能否开工（计划 `:40` 的入口条件含"palette decision 明确"）、四层 baseline 产物按哪套值生成、以及 V-7 能否关闭。**阻断实施**：是。**最小动作**：一句裁决，不需要改文档结构。

### S-1 · baseline 的 measurementMethod 选取规则与 mask 策略未定，98% 这个数字目前不可复现 · CONFIRMED

**仓内事实**：详设 `:318-319` 允许 `measurementMethod` 为 `REFERENCE_RENDER` 或 `APPROVED_CAPTURE`，但没有任何一处说哪个 entry 用哪个；`:316` 把 `maskRects` 列为必填字段，全文没有 mask 策略；`:320-323` 说生成器"只生成固定 ROI 参考图和 metadata"；详设 `:88` 与计划 `:30` 都禁止新增第三方依赖。

**推论**：无依赖的 Node 生成器画不出字形，也画不出 `primitives/src/vendor/slots.tsx` 第 121 至 134 行那种 `strokeWidth=2`、`strokeLinecap="round"` 的 SVG 图标。而 `compare.mjs` 第 7 行的 `PIXEL_CHANGE_THRESHOLD` 是 4，第 154 至 158 行按 max-channel delta 计数。

**反例**：键面文字是浅色压深色（提案值 `#F8FAFC` 压 `#1F2933`），delta 超过 200，每一个字形像素都计入 `changedPixels`。`full` 布局 40 个键，字形加图标按键面 5% 至 8% 估，仅此一项就把 2% 的预算吃掉数倍——`REFERENCE_RENDER` 加空 `maskRects`，`changedFraction` 不可能落到 0.02 以下，CP-5 会永远 OPEN 而看不出是实现错了还是门画错了。

**另一侧同样真实**：若该 entry 用 `APPROVED_CAPTURE`，问题消失且 98% 非常好达成——但证据含义从"符合规格"变成"相对首次批准的捕获不许漂移"。两种含义不能混用，设计没说哪个 entry 算哪种。

**最小修复**：§6.1 补两句。其一，每个 entry 的 `measurementMethod` 选取规则（例如：几何与平面填充用 `REFERENCE_RENDER`，字形/图标/阴影区不入机器 ROI；首次人工确认后的平台捕获登记为 `APPROVED_CAPTURE`，作为后续 run 的防漂移基线）。其二，`maskRects` 的构成规则——文字包围盒、图标盒、阴影带；这三类按 §6.2 第 4 步归人工复核，正好对应你"字体抗锯齿和平台栅格化差异单独记录"的裁定。上限沿用 `compare.mjs` 第 137 至 139 行既有的 canvas 80% 硬约束即可，不必新造。

**owning source**：详设 §6.1。**阻断实施**：否，CP-0 至 CP-4 不受影响；阻断 CP-5 收口。**需 Dexter 裁决**：否。

### S-2 · ROI diff 在 §4 是"辅助证据"、在 §6 与计划里是"机器门"，且没有任何执行体会因超过 0.02 而失败 · CONFIRMED

**仓内事实**：详设 §4 第 `:273` 行写"复用既有 `legacy-threshold` ROI diff 作为**辅助证据**，另以几何/token validator 形成**机器门**"；而 §6.1 `:326` 写"只由轻量结果断言将 `changedFraction <= 0.02` 作为 98% ROI **机器门**"，计划 `:293` 写"以 `changedFraction <= 0.02` 作为 98% ROI **门**"，计划 `:267` 又写"像素 delta 仅作定位信息"。同一件事在四处有三种定性。

**执行体缺口**：`compare.mjs` 第 222 至 234 行只返回指标，第 245 至 251 行的 CLI 打印 JSON，第 256 至 262 行只有抛错才置 `exitCode`；按详设 `:321-322`，`validate-baseline-manifest.mjs` 只校验 manifest 字段、尺寸、ROI/mask 约束、token snapshot 与 hash，不消费比较结果。**因此"98% 机器门"没有任何会失败的执行体**，V-10/V-11 红变异里那句"未达到 `changedFraction <= 0.02` 则 OPEN"没有 owner。

这与仓内已记的教训是同一枚硬币的反面：上一次是把差分器当 oracle，这一次是写成门却没人关门。

**最小修复**：二选一写死。其一，统一为"辅助证据 + 人工判定"：删掉 §6.1 与计划里的"机器门"措辞，把 0.02 降为人工复核清单中的一项量化参考，机器门只留 geometry/token/manifest validator——这与你"不要求人工逐像素完全一致"的裁决完全相容，且不用写新代码。其二，保留机器门：指定执行体（扩 `validate-baseline-manifest.mjs` 或同级脚本消费 `compare.mjs` 的 JSON，超过 0.02 非零退出），并补一条红变异（人为改一个 token 值后该执行体必红）。我倾向第一种，代价更小且不与仓内既有裁定冲突。

**owning source**：详设 §4/§6.1、计划 §8.2。**阻断实施**：否；阻断 CP-5 判定的可复核性。**需 Dexter 裁决**：否。

### N-1 · 同进程 stub `globalThis.document` 需要隔离与恢复

M-4 的方案正确，但仓内同一 idiom 还有四处：`InputSurfaceFrame.tsx` 第 91 行、`PrimitivePinInput.tsx` 第 25 行、`AdminLauncher.tsx` 第 233 行、`primitives/src/vendor/slots.tsx` 第 58 行。测试里对 `globalThis.document` 的 stub 是进程级的，若不在每个用例后恢复，同 worker 内其它用例的分支会被悄悄翻转——而且翻转方向是"变成 Web 分支"，多数断言仍会通过，属于静默污染。建议详设 §2.2 或 §4 的测试行加一句：stub 必须在用例边界恢复原值，并在 primitives/input 两侧各留一条"未恢复即红"的守卫。

### N-2 · 两处措辞仍是旧口径，容易被读回逐像素

其一，V-1（详设 `:283`）仍写"approved IA asset、**canonical baseline** 与目标尺寸有唯一住址"，与 `:165` 的"palette 未定前不得生成 canonical baseline"并置，容易被读成 CP-0 可以先产 baseline。建议改为"…且在 `PALETTE_DECISION` 记录后才生成"。其二，粒度清单 `gates` 里仍是 `pixelReconciliationBeforeImplementationDelivery`，而同文件 `pixelBaselineContract` 已改为 `machineGate: geometry-token-and-roi-98-percent` 与 `visualAcceptance: changedFraction <= 0.02`；建议 gate 名随新口径更名，或在 notes 里点明它指 98% ROI 加人工复核，避免下一个读者又按逐像素理解。

## 3. 其余维度复核结论（不构成 finding）

IA 优先级、numeric 三列、mobile inset 隔离、alpha CAPS 与持久 `capsLock`、full/financial 不漂移、七个 token 的 owner 与 recipe、`PrimitiveKeyboardSurface` 的职责边界（只收事件不理解 dismiss）、`keyboard-focus` 的真实 `selected` 消费、两个 integration 的 theme owner、`InputProvider` 热路径边界与"不作性能结论"、以及 `WEB/ANDROID/VISUAL=NOT_RUN`、`PERFORMANCE=NO_PERFORMANCE_CLAIM`、`IMPLEMENTATION_AUTHORITY=false` 的档位诚实性，本轮逐项重核，全部成立。§7 与计划 §9 的 intake 表没有把任何 OPEN 写成 CLOSED，`PALETTE_DECISION=OPEN` 在详设 `:378`、`:392` 与计划 `:300-301` 三处一致复述，没有用修订措辞掩盖未决项。

## 4. 结论

`VERDICT=NO-GO`，`M/S/N=1/2/2`。

唯一的 Major 是等你在 `PALETTE_A` 与 `PALETTE_B` 之间拍一句；两条 Significant 都是 §6 的局部收口（baseline 方法与 mask 策略、ROI diff 到底是门还是辅助证据），Codex 在既有批准边界内可自主修复，不需要新授权。这三项落定后，本详设与计划具备进入实施决策的条件。

本结论只覆盖详设与实施计划的可实施性，不代表源码实现、测试、Web、Android、visual、release、cleanup 或 acceptance 通过。
