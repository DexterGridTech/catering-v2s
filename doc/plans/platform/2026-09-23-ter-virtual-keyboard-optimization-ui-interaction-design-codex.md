# TER 程序虚拟键盘优化交互设计（低保真）

> STATUS: REVISED_AFTER_CLAUDE_DESIGN_FOLLOWUP；REVIEW_CYCLE_ID: `TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23`；IMPLEMENTATION_AUTHORITY: true（来源：Dexter 在 `doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-followup-review-claude.md` 后的本轮会话授权）。  
> BUSINESS_REQUIREMENT_SOURCE: `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md` §1–§8。  
> JOURNEY_DECISION: 既有 TER 输入旅途；本批横切输入能力、不创建新 Journey。  
> BUSINESS_PROBLEM: 操作者在已有输入任务中须看清完整焦点框，且键盘不能把表单、弹窗及提交动作挤变形。  
> BUSINESS_USER_OR_OWNER: 使用现有终端输入的店员、顾客及管理员；输入机制 owner 为 `ui/base/input`，原业务 owner 不变。  
> SUCCESS_OUTCOME: 外框与键列按最终 surface 宽度填满且外框直角；焦点完整可见；普通页面与弹窗形状不变；切换键盘的位移连续。  
> UI_BEARING=true；CONSUMER_FACE=TER terminal（模板的两个后台 face 不适用）；`SKILL_USED=cs-spec-to-plan`。  
> DEXTER_WIREFRAME_REVIEW=随实施结果一并审阅（未批准）；DEXTER_HIFI_REVIEW=随实施结果一并审阅（未批准）。  
> PRECEDENCE: 新正式需求 §8 的全宽、直角、无 CAPS、覆盖避让事实优先于 2026-09-19 键盘 IA 旧尺寸与键帽；既有键盘主题语义、业务字段、系统 IME 与 owner 边界保留。

## 1. 屏幕与操作分母

本稿只画公共输入能力的可见面，不画新的业务页面。已有入口为 `sample-staff-auth` 的工号/密码、`sample-member-desk` 的姓名/电话与 sample-only alpha/financial 探针、顾客年龄、管理员 PIN 与拓扑主机地址；其它同包输入注册须在实施 CP-0 重算。普通页、弹窗和双屏各 surface 共用以下四个 screen，业务原页本身不因此增按钮。按 N-3 设计移除 `field` placement，窄字段宿主不再是本次能力分母。`full` 的十项 URL 符号以受控 input harness 验证，拓扑地址继续 financial。

| Screen | UI_SURFACE / HOST_AND_ENTRY | ACTOR / BUSINESS_GOAL | USER_VISIBLE_COPY / 控件 | FOUNDATION_PRIMITIVE / CONTAINER_LAYOUT |
| --- | --- | --- | --- | --- |
| VK-01 | 普通页面内 surface 底部覆盖键盘；点现有 virtual 字段进入 | 店员等输入已有字段 | 焦点框、full/alpha/numeric/financial 对应键盘、删除、完成；原页提交/取消照旧 | `@catering-v2s/admin-ui-foundation` N/A：TER RN/Web 不是双后台；复用 `ui/base/input`、`ui/base/primitives`。内容外框保持原 W×H，键盘外框宽 W、底对齐；只固定尺寸的 `InputScrollArea` 内容可滚动，整体内容可平移 |
| VK-02 | 已有 Modal/LayerStack 内容的输入字段；管理员 PIN 为受保护 scope 变体 | 管理员等完成现有弹窗输入 | 原弹窗字段/动作/遮罩不增减；容量不足时显示明确的调整窗口/退出恢复提示 | 同上；遮罩固定铺满 surface，弹窗框与内部控件不重新排布，弹窗内容整体平移，滚动仅在已有固定尺寸内区；PIN 无滚动宿主时不得伪称可滚动 |
| VK-03 | 全键盘按键面；由已有 full 字段或 harness 打开 | 已在输入的操作者输入字母、数字、空格、URL 字符 | 普通数字 1–0；Shift 字符行 `: / . ? & = - _ % +`；`SHIFT/⇧`、`空格/␣`、`BACKSPACE`、`COMPLETE` | 同上；键盘外框 W、四角 0；内部保持可触达 padding/gap；无 CAPS 或长按层，不能横向溢出 |
| VK-04 | 输入框 A→B 或显式收起的过渡面；同 surface 原位置 | 已在输入的操作者连续填写 | 新字段焦点/原键盘与目标键盘；同布局不重弹；异布局新下旧上；无新增业务文案 | 同上；两个视觉键盘共一块 surface，旧键盘仅退出画面且不接收输入；内容、滚动与键盘在同段运动 |

### 键宽基准（Dexter 对 S-3 的裁定）

键帽列轨随全宽外框填满，按各布局既有列数、内边距和 gap 计算。laptop surface `1280×720`：full/alpha 标准键宽 `118`，numeric/financial 每列键宽 `412`；mobile surface `360×640`：full/alpha 标准键宽 `30`，numeric/financial 每列键宽 `110`。这四组数是后续 IA 逐控件视觉对账基准；最终实现仍按实测外框与真实 padding/gap 验证，不设居中限宽。

以上每 screen 的技术边界相同：字段 value/selection/maxLength 和 business validation 归现有 field/feature；输入 owner 仍仅一个 `virtual` 或 `system`；`UI_VISIBLE_COPY` 中的键盘标签不是服务端事实。所有控件同时有键级 testID 和非纯颜色的 selected/focus 反馈。此批没有 HTTP query、候选集合、提交命令或后台 Drawer，模板中 CRUD、候选搜索、B.4 HTTP 和管理后台 §3-K-1..10 均 `NOT_APPLICABLE_WITH_REASON=TER 本地输入基础能力`。

## 2. Interaction map 与低保真线框

| 顺序 | 前提 | 用户动作/可见变化 | 成功/退出 | 失败恢复 |
| --- | --- | --- | --- | --- |
| 1 | 当前 surface 已测量且容量可用 | 点已有 virtual 字段；键盘自底升起，内容只在必要时整体上移 | 焦点完整可见，可用原字段继续编辑 | 未测量/容量不足不取得死焦点，提示调整窗口或退出 |
| 2 | full 键盘已显示 | 点 Shift：数字行显示十个 URL 符号；点一个字符：插入标签值后恢复数字行 | 空格是末行原 Shift 位置的独立可点键；零插入不消耗 Shift | 字段原有 maxLength/validation 照旧 |
| 3 | 焦点 A 正在输入 | 点 B 或点完成进入下一字段 | 同布局键盘不动；异布局先新键盘在旧下升起、再旧退出；内容/内部滚动同段调整 | B 预检失败保留或安全退出 A owner，不显示不可输入的键盘 |
| 4 | virtual 会话结束 | 按完成/合规的外点关闭/字段卸载/scope 切换 | 键盘向下退出；内容同段回位；Shift 待生效不潜伏 | 受保护 scope 的外点不套 business scope 关闭规则 |

### VK-01 普通输入与 VK-02 弹窗输入

```text
┌──────────────────── 所属 surface W × H ────────────────────┐
│ 普通页面原外框 / 固定遮罩覆盖整屏（弹窗时）                  │
│   ┌──────── 页面或弹窗内容原尺寸 ────────┐                 │
│   │ 字段 A                              │                 │
│   │ [焦点字段 B：完整边框可见]          │ ← 整块内容统一平移│
│   │ 原有“提交 / 取消”仍在原布局位置     │                 │
│   └────────────────────────────────────┘                 │
│ ┌────────── 固定尺寸内部滚动视口（仅已有时） ───────┐      │
│ │ 输入内容可滚，上缘/下缘裁切均可触发滚动           │      │
│ └─────────────────────────────────────────────────┘      │
├─────────────── 键盘覆盖层顶部 y=H−K ──────────────────────┤
│                 全宽、直角、内部有 padding/gap              │
└──────────────────── surface 底边 ────────────────────────┘
```

固定遮罩不随弹窗内容平移；键盘高于非键盘内容，键盘自身拦截点按/触摸，不让键盘按键冒泡为外点关闭。若 PIN 的可见框高于可见带或无滚动空间，原框不变形，显示容量不足与可恢复动作；不能捏造 PIN 的 scroll area。示意图只规定层级，最终高保真以本批 IA 为准。

### VK-03 全键盘字面与返回路径

```text
普通态（四行；laptop 外框高 246，mobile compact 外框高 189）
  1 2 3 4 5 6 7 8 9 0
  q w e r t y u i o p
  SHIFT a s d f g h j k l
  空格 z x c v b n m ⌫ 完成

Shift 待生效态（只替换数字行标签/值，键盘高度不变）
  : / . ? & = - _ % +
  Q W E R T Y U I O P
  SHIFT A S D F G H J K L
  空格 Z X C V B N M ⌫ 完成
```

十个数字键与十个 Shift 字符一一对应：`1→:`, `2→/`, `3→.`, `4→?`, `5→&`, `6→=`, `7→-`, `8→_`, `9→%`, `0→+`。普通态点 1–0 插入原数字；Shift 态点任一符号或字母，成功插入后自动返回普通态；点 Shift 再次取消也返回普通态；`maxLength` 拒绝零插入时保持 Shift 态。空格键两态均向 selection 插入 U+0020；键帽字面移动到旧 Shift 位置。键宽按上方 S-3 基准：laptop full/alpha 为 118、numeric/financial 为 412；mobile full/alpha 为 30、numeric/financial 为 110。`alpha` 保持三行并与 full 的动作位置一致：`qwertyuiop` / `SHIFT asdfghjkl` / `空格 zxcvbnm ⌫ 完成`，Shift 位于 `a` 左侧、空格位于 `z` 左侧，无 CAPS 或空动作占位。

### VK-04 焦点切换的两个子阶段

```text
旧 A 已显示(K_A)      新 B 在 A 下层升起             A 下行退出，B 已满高
╞════ A 顶 ════╡  →  ╞════ A 顶 ════╡  →  ╞════ B 顶 ════╡
                     B ↑，不露在 A 上层             A ↓，只保留退出画面
内容偏移/内部滚动：从当前可见几何连续运动，任何帧 |上移|≤实际可见遮挡高。
```

先测两把键盘外框。底边锚定时，各自可见高度 `v_i=clamp(K_i−下移_i,0,K_i)`；新在旧下层时，同一帧实际底部遮挡高 `K_visible=max(v_A,v_B)`。新升满前旧不退，旧开始退时新已满；`246→190` 的 `K_visible` 先保持 246 后单调降到 190，`190→246` 先单调升到 246 后保持，`246→246` 始终 246。`|K_B−K_A|>0.5` 个逻辑单位时内容位移按 `λ=(K_visible−K_A)/(K_B−K_A)` 在端点间变化；差值在 0.5 容差内时按共享 progress 插值并逐帧限于真实 `[-K_visible,0]`，高度预检差值超过容差或改变容量分类即重新预检。这样位移跟随真实遮挡而不是墙钟进度。测量统一用 surface/content 局部坐标，当前位移仅在求可见框时加一次。输入焦点切换、遮挡和内容位移要在同段完成；旧退出画面不得形成第二输入 owner 或响应按键。键盘呈现状态独立于可编辑 owner：交接或收起时 owner 即使成为 none，旧/新键帽快照仍保持挂载到动画结束。

目标 B 被旧键盘遮挡期间不提交为可输入 owner：以现有 `blockedFieldId=B`、`blockedCapacity=null` 保存待提交目标，并由 `preflightFocusTarget(B)` 复核。A→B→C 时 C 通过预检后替换 B；旧键盘完全退出、B 可见且仍注册/有效时才提交 B 并清除 pending。取消、关闭、scope 改变、字段卸载或新预检失败会清除或替换 pending，不可把 pending 当作容量错误提示。与输入 owner 分离的键盘呈现状态由 surface 几何 owner 持有：首次打开依次为测量、进入、显示；异布局切换为交接；收起为退出。它保留旧/新键盘的键位、实测外框高、键帽标签快照和新键盘 `hasNextField`，因此 owner 暂置 `none` 时视觉过渡仍持续；命中层在两个交接阶段吞点，旧键盘完全退出且目标通过复核后新键盘才接键。`keyboardState.visible` 仍只表示当前可编辑，不控制覆盖层挂载。取消、关闭、scope 改变、字段卸载或新预检失败会清 pending，并按当前可见几何转向退出/保留旧态，不提交不可操作的目标。

## 3. 状态、依赖与可证伪操作合理性

| 状态/情形 | 可见且可操作 | owner/恢复 |
| --- | --- | --- |
| unmeasured/unsupported | 不显示半截键盘，显示现有尺寸提示，原内容不变形 | 不建立 virtual 死焦点；尺寸恢复后可重试 |
| focused/open | 外框全宽直角；焦点全框在 `[0,H−K]` 与其真实滚动视口交集内 | `activeFieldId` 与 owner 决定当前会话 |
| shift armed | 唯一 Shift 有文字/选中双重反馈，数字行十字符 | 成功插入后清，零插入保持，离开会话清 |
| focus transition | 两阶段都由键盘区域吞点按；异布局旧层退出完毕才由新层接键 | 以 pending target/preflight 保存待提交 B，A→B→C 由 C 替换；取消、失焦、scope 改变、卸载清理；每帧按真实遮挡限位 |
| clipped/high field | 平移后仍裁切才滚动；字段高于可见带显示容量不足 | 保留草稿；退出、改尺寸或回原字段可恢复 |
| dismiss | 自上而下消失，内容同步回原位 | scope 原关闭规则不被改写 |

输入控件依赖：每个字段的 layout、maxLength、selection、初始值仍来自原 feature/field；无新候选和级联。键盘外框依赖本 surface 实测 W/H；键帽、padding/gap 依赖键盘公共定义；内部滚动依赖当前视口、scroll offset、实际焦点框、`K_visible`；不能从全局 window 或另一屏得值。旧 208 内容高度不是覆盖模型的通过条件。

| 可见操作 | 用户为何此时做 | 更短路径/不选原因 | 来源与决策 |
| --- | --- | --- | --- |
| 点已有输入框/切到下一框 | 继续原业务输入 | 不新增入口；直接点/原完成键最短 | 需求 VK-R05–R07；无新增 Journey |
| Shift/再次 Shift | 取得一次大写/符号或取消 | 长按 CAPS 增加隐蔽状态，Dexter 已否决 | VK-R03/R04、Q5 |
| 数字、字母、十项 URL 字符、空格 | 输入看到的字符 | 隐藏手势/IME/剪贴板不可发现 | VK-R03/R04、S-4 |
| 删除/完成 | 修正、结束或 focus-next | 保留既有动作，不增业务提交 | VK-R03/R08 |
| 外点收起 | 退出当前 business focus scope | 受保护 scope 不由这一动作触发 | VK-R05/R08 |

full 保持四行、只提供十个数字行 Shift 字符，是 Dexter 对 S-4 的明确裁定；交接时长为 250ms，缓动为 `Easing.inOut(Easing.quad)`，内容、旧/新键盘共用一条 progress。实际画面与键宽仍须在获授权实施后逐控件核对；当前视觉状态为“随实施结果一并审阅（未批准）”。交接期间键盘覆盖区持续吞点按，旧键盘未完全退出前新键盘不可操作。触控/命中、键帽形态和动态动画须在获授权实施后以运行画面验证。
