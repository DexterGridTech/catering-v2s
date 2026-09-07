# TER terminal input · 详设与实施计划 DESIGN REVIEW

- **评审对象**：`ui/base/input` 的 implementation-facing 详设与实施计划
- **结论**：**NO-GO**
- **finding 计数**：**M=2 · S=3 · N=2**
- **日期**：2026-09-06
- **评审人**：Claude（独立评审会话）

## 0. 会话出处与证据档位

fresh v2s-rooted 独立评审会话，非续接、非它仓。

⚠️ **本轮为纯静态评审，未运行任何命令** —— 这是本评审角色的固定纪律，不是本轮的临时限制。
所有对源码的断言均为**打开文件亲验**，逐条在 finding 内给出锚点；所有对文档的断言均为逐字比对。

⚠️ **本评审不授权**：源码、测试、依赖变更、Android/Web 运行、DEV、seed、L2、UAT、部署。
静态 review 不授权进入实施。

### 被评审材料

| 文件 | 角色 |
|---|---|
| `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md` | 详设（被评审） |
| `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-plan-codex.md` | 实施计划（被评审） |
| `doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md` | 冻结需求（判据来源） |
| `doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md` | sample 需求（S-30…S-39 正本） |
| `doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md` | 交互设计 |

---

## 1. 结论摘要

方案方向**成立**：surface-local keyboard、frame render prop 接缝、原子快照、年龄链的 owner 划分
都对，且高度公式、KBC 取舍、Presentation 取证三处质量明显高于一般设计稿。

阻断项不在方向，在**判据与接缝**：

1. 详设自己的验收判据表引用了 v13 的判据编号，但**内容对不上**（M-1）；
2. 本批新造的 layer↔键盘焦点接缝**无 owner、无行为定义**（M-2）。

⚠️ **加重情节**：按 2026-09-06 新立的「逐代码与详设对账」闸门，对账对象是**本详设**。
M-1 的判据错配会**原样穿过对账闸门**到达交付 —— 对账会照着错的判据判 `MATCHED`。
⇒ 在 M-1 修复前，该闸门在本批上不具备判别力。

---

## 2. Findings

### M-1 · 判据 ID 映射错乱：S-30…S-36 与 S-38 · `CONFIRMED`

**证据类型**：仓内事实（两份文档逐字比对）。

详设 §11「详设级判据、红向量与证据档位」使用 v13 的判据编号，但承载的内容与正本不同：

| 编号 | v13 正本原文 | 详设 §11 写的 | 判定 |
|---|---|---|---|
| S-30…S-35 | 年龄业务六条：双屏顾客点年龄框副屏弹数字键盘 / 单屏 `handheld-confirm` 主屏弹键盘 / 不填年龄直接确认成功且 `age` 为空 / 填了年龄确认后 `age` 等于所填 / 录入期间 PRIMARY 读不到该值 / 顾客拒绝时年龄整体丢弃 | 「selection/backspace/shift/complete 等**编辑语义**错误」，最低证明 `pure edit tests` | **错配** |
| S-36 | 年龄键盘出现后，**年龄框仍完整可见**（内容区收缩 ＋ 焦点滚入可见区） | 「不来自 surface 声明、无上限、layout 高度不同」，最低证明 `pure formula test` | **错配** |
| S-38 | 【双屏】顾客输年龄时店员点撤回 ⇒ ① 副屏离开确认态回 `customer-welcome` ② 顾客随后点确认不产生登记 ③ store 无年龄残留 | **§11 无此行**；两份文档中该编号零命中，仅实施计划 §9.2 的 failure/recovery 维度有泛指的「撤回竞态」四字，未承载上述三段断言 | **缺失** |

S-37、S-39 两条映射**正确**，说明详设并非自建编号体系，而是对 v13 编号的错配。

**失败场景**：实施方照 §11 建了编辑语义 pure test 与高度公式 test，两者全绿，
`RECONCILIATION` 判 `MATCHED`，交付。而以下四件事**一条都没被验证**：

- 副屏上是否真的弹出了键盘（S-30）；
- 单屏 `handheld-confirm` 下是否弹出（S-31）；
- 不填年龄能否确认成功（S-32）、填了是否真的落进 `Member.age`（S-33）；
- 年龄框是否被键盘盖住（S-36）、店员撤回时顾客那一下是否失效（S-38）。

⚠️ **pure formula test 在数学上无法证明「年龄框可见」** —— 高度算得对与控件是否被遮挡是两件事。
S-36 的原判据要求内容区收缩**且**焦点滚入可见区，公式只覆盖前半。

**验收判据**：详设 §11 每一行的判据描述，须与 v13 §9.2 主表同编号行**逐字一致**；
S-38 须补入。任一编号的内容与正本不同，即本 finding 未闭。

---

### M-2 · layer 与虚拟键盘的焦点接缝无 owner、无行为定义 · `CONFIRMED`

**证据类型**：仓内事实（源码亲验）＋ 推论（对后果的推断）。

详设 §4.1 对 LayerStack 只写一句：「LayerStack 仍由 render owner 管理 overlay、guard、back 和 focus」，
即认为下沉进 content subtree 后行为不变。

✅ **亲验 `apps/terminal/ui/base/render/src/components/LayerStack.tsx`**：它并非被动渲染，
而是**主动操纵焦点**。其 `useEffect` 中：

- 首层打开时，把 `TextInput.State.currentlyFocusedInput()` 存入 `focusedBeforeLayer` ref；
- 有层且顶层变化时，调 `topLayerFocusTarget.current?.focus?.()` 把焦点移到顶层 View；
- 末层关闭时，调 `focusedBeforeLayer.current?.focus()`，**把焦点还给原输入框**。

而本批的虚拟键盘可见性由 `activeFieldId`（即焦点）驱动（详设 §6.1）。
⇒ **两个子系统在同一件事上互相写，而没有任何一方声明谁赢、什么时候赢。**

**失败场景**（双屏主屏）：店员在 `member-form` 聚焦密码字段、虚拟键盘在场；
`auth-notice` 弹出 ⇒ LayerStack 把焦点移到层 View。
若无人清 `activeFieldId`，屏上出现**模态告警与虚拟键盘同时在场、内容区仍被压矮**的状态；
层关闭后 LayerStack 自动 restore focus ⇒ 键盘**自行弹回**，而这既未被设计声明为预期，
也未被任何判据覆盖。

**行为其实可判定，缺的是 owner 与明文**：按需求 §1b「与系统键盘行为一致」，
系统 IME 在模态夺焦时收起、还焦时恢复 —— 这恰与 LayerStack 现有的存/还语义吻合。
⇒ 期望行为是「层打开即收键盘、层关闭随焦点恢复而重开」，但**必须写进详设并指定 owner**。

⚠️ **加重情节**：实施计划 §9.2 的 `accessibility/focus` 维度已要求对账
「focus、selection、back、hand-back 和 **layer focus restore 一致**」——
而详设从未定义此处「一致」是什么。⇒ **对账届时无物可对。**

**验收判据**：详设须明文写出四件事 ——
① 层打开时 `activeFieldId` 的处置；② 层关闭时键盘是否随焦点恢复而重开；
③ 该行为的 owner 是 `ui/base/input` 还是 `ui/base/render`；④ 一条可证伪判据。
判据自带反例：层打开后键盘仍在场，或层关闭后焦点回到输入框而键盘不回，即红。

---

### S-1 · CP-0 的逃生口架空了它自己这道前置门 · `CONFIRMED`

**证据类型**：仓内事实（同一文档内两节互相取消）。

实施计划 §3.1 把 CP-0 的范围写为必做项，含：
「在一个**受控 probe surface** 上验证副屏 `TextInput` focus、IME visible、输入值和提交回读」。

同文档 §3.4 写：「若当前 sample 尚无输入控件，CP-0 的焦点项保持
`UNVERIFIED_REQUIRES_EVIDENCE`……实现时必须在 age field 接入后重跑」。

两句互相取消：§3.1 说必须用 probe surface 验，§3.4 说没有输入控件就可以不验。

**为什么这不是可接受的软化**：CP-0 的**唯一存在理由**，是在 CP-1…CP-3 动工之前
把本批最大的未知项（副屏能否真正输入）清掉 —— 详设 §3.2 自己也把它列为未确认项。
允许 CP-0 带 `UNVERIFIED` 通过，等于把该风险推到 CP-3 之后；
届时若重跑失败，CP-2 与 CP-3 的整套双屏输入设计作废，返工面覆盖整批。

⚠️ probe surface 的成本是一个临时 `TextInput`。用它换掉「整批双屏设计可能作废」的风险，
比例明显。

**验收判据**：CP-0 的副屏输入焦点项不得以任何条件降级为 `UNVERIFIED` 而放行下一 CP。
§3.4 的逃生口须删除或改写为「probe surface 亦无法构造时停机交 Dexter」。

---

### S-2 · 焦点滚入可见区只活在计划里，详设零覆盖 · `CONFIRMED`

**证据类型**：仓内事实。

需求 §1b.3 把「焦点输入框滚入可见区」列为**硬要求**，并在 §1b.3a 进一步证明：
本机沉浸式配置下 `adjustResize` 失效，Android 平台自带的
`requestRectangleOnScreen` 链**根本不会跑** ⇒ 本包是该行为的**唯一来源**。

- 详设 §4、§7 及全文：**零覆盖**（搜「滚入 / scroll / 滚动 / 可见区」无命中）；
- 实施计划 §5.4：仅三行。

⚠️ **后果不止于「写在哪」**：实施计划 §9.1 的对账表按 **owning design** 组织，
每个代码组都要指向详设的某一节。滚动逻辑**没有任何一行的 owning design 指向它**
⇒ 逐代码对账时它没有设计锚点。叠加 M-1 中 S-36 被错配，
该需求同时失去**判据**与**设计锚点**。

**验收判据**：详设须有一节承载该行为（触发时机、滚动祖先的判定、无可滚祖先时的 no-op、
与键盘高度的关系），并在 §9.1 的 owning design 列可被指向。

---

### S-3 · 键盘互斥机制只覆盖一个方向 · `PARTIALLY_CONFIRMED`

**证据类型**：仓内事实 ＋ 外部事实（RN API 语义）。

需求 §1a.1 列出四种转移，其中两种必须显式处理：**系统→虚拟**、**虚拟→系统**。

详设 §5.3 写：「切换 system/virtual 前先 `Keyboard.dismiss`，同一 surface 同时只允许一个 keyboard owner」。

⚠️ `Keyboard.dismiss()` 只关**系统 IME**。
- 系统→虚拟：由它覆盖 ✅
- **虚拟→系统**：需要清 `activeFieldId` 收起自绘键盘，详设**未写机制** ❌

「同一 surface 只允许一个 keyboard owner」是**结果陈述**，不是机制。

**验收判据**：两个方向各有一条明确机制，并有一条判据断言「任一时刻至多一个键盘可见」。

---

### N-1 · §6.2 快照类型与散文不一致 · `CONFIRMED`

详设 §6.2 散文称 `captureInputSnapshot()` 复制「`value`、selection 和 **registration version**」，
但同节给出的 `InputSnapshot` 类型中，per-field 只有 `value` 与 `selection`
（`revision` 在顶层，是快照级而非字段级）。

二者取一：要么类型补 per-field registration version，要么散文删掉该词。
⚠️ 这不是纯文字问题 —— 字段级 registration version 是「旧实例 cleanup 不误删新实例」
（§6.1 第 2 条）在快照侧的对应物，删掉需说明为什么不需要。

---

### N-2 · §9.2 actions 行措辞可能误导 · `CONFIRMED`

实施计划 §5.2 第 6 步写对了：「接 focus-next/last-field complete；最后字段只执行 close-only」，
与需求 §3a 一致。

但同文档 §9.2 的 `actions` 维度压缩成「complete 是否 **close-only**」——
单独读会与 §3a 的「非末字段**推进焦点**」冲突。对账表是实施后逐条照着走的清单，
措辞歧义会直接变成对账结论歧义。

建议改为「complete：非末字段推进焦点、末字段 close-only 且不提交」。

---

## 3. 十个核验点的逐条结论

⚠️ **本节不是「全部通过」清单。** 十点中 **7 点无保留通过**、**3 点带 finding**
（点 2 → M-2；点 6 → M-1；点 9 → S-1）。带 finding 的行在「结论」列明确标出，
扫表时不得只看 ✅ 就当该点已闭。

| # | 核验点 | 结论 | 亲验依据 |
|---|---|---|---|
| 1 | frame render prop 同时覆盖 content subtree 与 KeyboardDock sibling | ✅ 成立 | 详设 §4.1 的 callback 接收已含 children+ScreenContainer+LayerStack 的单一 `content`，装配方返回 `InputProvider > frame View > [content, dock]`，一次调用同时完成包裹与加兄弟。拒绝两个独立 prop 的理由（会让两者落进不同 Provider）成立 |
| 2 | LayerStack 位于可收缩 content 内且 overlay 语义保持 | ⚠️ **结构成立，焦点语义未闭（M-2）**；我最初对定位祖先的质疑不成立，已撤回 | 曾怀疑下沉一层后 `position:'absolute'` 的定位祖先出错。亲验 `LayerStack.tsx` 的 `styles.stack` 为 absolute inset-0；RN 下绝对定位相对**直接父节点**，`react-native-web` 的 View 基样式亦带 `position:relative` ⇒ 下沉后正确相对 content View，随内容区收缩。back 用全局 `BackHandler`、focus 用全局 `TextInput.State`，均与树位置无关。**但焦点语义另见 M-2** |
| 3 | 字段注册、同步快照、注册注销竞态、submit/confirm owner | ✅ 闭合 | §6.1 第 4 条「`onChangeText` 先同步写 `valueRef` 再更新局部 state」直接关掉需求 §2.3a 第 1 条的过期闭包失败面；§6.2 的胜者规则按 JS 事件顺序定义且 capture 内不 `await`，无半份快照 |
| 4 | age 只经 customer confirm handler → `confirmMemberCommand` → confirm actor → `Member.age` | ✅ 闭合 | §10 逐层给出正向职责与**否定约束**，含 confirm actor「不得像 `memberId`/`registeredAt` 一样自行生成 age」—— 与 sample 需求 §4.5.3 的边界逐字对应；`PendingMember`/reducer 明确不改 |
| 5 | `PrimitiveInput` 公共契约、`maxLength`、testID 强制路径 | ✅ 保持边界 | 四个 prop 全部可选；`assertTestID` 仍在透传前；不暴露 `inputMode` 且给出理由。✅ **另有一条本评审未预见的正确洞察**：虚拟键盘是程序发键，native `maxLength` 拦不住，故纯编辑函数必须使用同一上限（本文全文 ⚠️ 一律表示问题，此处刻意不用） |
| 6 | 键盘高度公式的可证伪性 | ⚠️ **公式与前提成立，但判据映射错（M-1）** | 逐项复算：PRIMARY `723−208=515`、`⌊723×0.5⌋=361`、`min(320,361,515)=320`、剩 403；SECONDARY `541−208=333`、`⌊541×0.5⌋=270`、`min(320,270,333)=270`、剩 271。✅ 声明尺寸亲验 `apps/terminal/ui/integration/sample-console/package.json` 的 `terminalSurfaces`：PRIMARY 1157×723、SECONDARY 962×541，与详设表一致。⚠️ **但 S-36 的映射错误另见 M-1** |
| 7 | WindowInsets owner 留在 adapter/assembly；KBC 未被未经验证地采纳 | ✅ 成立 | §3.1 在隔离 scratch 跑了三个探针，如实报 Web export PASS / prebuild PASS / Gradle 编译 FAIL，且**不把 FAIL 归因为 RN 0.86.3 不兼容**。设计结论为**本批不引入 KBC**，并指出 KBC 的 `WindowInsetsCompat` 与仓内 `applyImmersiveWindow` 直接改 window flag 存在 owner 重叠。§8 把 IME inset owner 留在 adapter/assembly |
| 8 | Android Presentation 真实输入焦点仍标为待运行验证 | ✅ 标注正确 | §3.2 查到 Presentation window 已注册为 display 2 的 `imeInputTarget`/`imeControlTarget`，但因当前无 `TextInput`、`mInputShown=false`，明确拒绝把「window 是 IME target」升级为「副屏输入已可用」 |
| 9 | 四个 CP 的停止条件、红向量与依赖顺序 | ⚠️ **停止条件与顺序成立，CP-0 前置门被架空（S-1）** | 停止条件具体且可证伪；CP-0 用 probe surface 化解了「CP-0 需要 CP-3 产物」的表面循环。**但见 S-1** |
| 10 | 实施后逐代码—详设对账的维度覆盖 | ✅ 通过 | §9.2 覆盖 behavior / shape / actions / relationships / placement / user-visible copy / limits / state-control / failure-recovery / accessibility-focus / data-invalidation **十一维齐全**；§9.1 有固定代码全集与 `N/A_WITH_REASON`；§9.3 有 `MATCHED`/`OPEN`、`RECONCILIATION=FAIL/PASS` 与交付闸门，且明确「行号不是稳定锚点，使用唯一 symbol/文本锚点」 |

---

## 4. 处置与授权边界

### 处置分类

| finding | 性质 | 处置 |
|---|---|---|
| M-1 | 文档一致性 | Codex 在既有批准边界内自主修复 |
| M-2 | **设计缺口**，需新增设计决定 | Codex 自主修复；行为方向已由需求 §1b 确定，不需 Dexter 裁决 |
| S-1 | 计划内部矛盾 | Codex 自主修复 |
| S-2 | 设计缺口 | Codex 自主修复 |
| S-3 | 机制缺口 | Codex 自主修复 |
| N-1 · N-2 | 表述 | Codex 自主修复 |

⚠️ **无一条需 Dexter 裁决。** 七条均在既有批准边界内，方向由冻结需求已经确定。

⚠️ **七条应在同一轮内一并修复后再送复核**，不拆轮：M-1 与 S-2 都指向同一处
（S-36 的判据与滚动逻辑的设计锚点同时缺失），分开修会出现「判据补了但仍无锚点可指」
或「锚点建了但判据还是错的」的半闭状态。

### 授权边界

- 本结论是**静态设计评审**，**不授权**下一 Roadmap step、源码实施、DEV 或数据操作。
- 本结论**不构成**对副屏输入可行性的判断 —— 该项仍为 `UNVERIFIED_REQUIRES_EVIDENCE`，
  由 CP-0 的实跑证据回答。
- 本结论**不替代**实施后的 `REVIEW_TARGET=IMPLEMENTATION` 对抗 review，
  也不消耗其轮次上限。
- ⚠️ M-1 修复之前，2026-09-06 新立的「逐代码与详设对账」闸门在本批上**不具备判别力**：
  它以本详设为对账对象，判据错配会被原样判为 `MATCHED`。

### 未取证事项（不得当作已验）

| 事项 | 档位 |
|---|---|
| 副屏真实 `TextInput` 能否 focus、拉起 IME、接收字符并提交 | `UNVERIFIED_REQUIRES_EVIDENCE`（CP-0） |
| KBC 在本仓组合下的 native build 与运行行为 | `UNVERIFIED_REQUIRES_EVIDENCE`（本批已决定不引入） |
| 本机系统键盘在沉浸式配置下的真实覆盖表现 | `UNVERIFIED`（需求 §1b.3a 已分档） |
