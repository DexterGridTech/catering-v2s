# `ui/base/input` 需求分析稿

~~~text
STATUS=分析稿，**不是最终需求**。用于收敛方向与暴露待裁项
SOURCES=POC v1／v2 源码亲读 ＋ 本仓现状亲验 ＋ 业界常见做法
CONSTRAINT=Dexter 唯一强要求：确保 UI 性能与用户体验
~~~

## 1. 我读了什么

| 文件 | 行数 |
| --- | --- |
| `2-ui/2.1-cores/base/src/contexts/FancyKeyboardContext.tsx`（V1） | 205 |
| 同上 `FancyKeyboardContextV2.tsx`（V2） | 244 |
| `hooks/useFancyInput.ts` | 61 |
| `hooks/useKeyboardAnimation.ts` | 66 |
| `2.2-modules/mixc-trade/.../PriceKeyboard.tsx` | 144 |
| 同上 `AmountConfirmKeyboard.tsx` | 185 |

⚠️ `2.1-cores/base` 与 `2.1-cores/runtime-base` 下的键盘文件**逐字相同** ——
POC 自己就存在一份重复。

---

## 2. POC 里其实有**两套完全不同**的输入范式

这是本次分析最重要的发现。它们的性能与状态归属**完全相反**，
不能笼统说「POC 的 input 怎么做」。

### 范式 A · FancyKeyboard：浮层 ＋ 暂存值 ＋ 显式确认

点输入框 → 弹出自绘键盘浮层 → 在 `editingValue` 里编辑 →
**确认时才**经 `onChangeText` ＋ `onSubmit` 写回。

- 值在**组件本地** `useState`（`useFancyInput` 第 25 行）
- 有 `hasChanges`（对比 `originalValueRef`）
- 支持 `full` 与 `number` 两种键盘

### 范式 B · PriceKeyboard：内嵌领域键盘 ＋ 每键一条命令

页面内嵌数字键盘，**每按一个字符派一条命令**：
`setProductPrice({char}).execute(shortId(), sessionId)`（第 15 行），
值在 store，靠 `useSelector` 读。

⇒ **A 性能友好但状态归属错（对 TER 而言）；B 状态归属对但每键一条命令。**

---

## 3. 业务目的

POS 终端的输入有三个 POC 没明说但形态上暴露出来的诉求：

1. **不依赖系统输入法** —— Kiosk 形态下要自绘键盘；数字键盘要大按键（戴手套、快速盲打）
2. **领域化键盘** —— 价格、金额有各自的键位与校验，不是通用文本框
3. **输入不遮挡** —— 键盘弹出时把焦点输入框顶上来（V2 的 `containerOffset`）

---

## 4. 做得好的，值得吸收

**其一 · V2 的 context 拆分，这是 V1→V2 的核心演进。**
V1 一个 context 一个 `useState`，**每次按键全体订阅者重渲染**。
V2 拆成 Actions／Display／Editing 三个 context，
把高频变化的 `editingValue` 单独隔离（源码注释原文：
「`editingValue` 高频变化，只让 EditingContent 订阅」）。
⇒ 这是标准且正确的 React 性能手法，直接对上 Dexter 的性能诉求。

**其二 · 暂存值 ＋ 显式确认。**
编辑期间不写回真实值，确认才提交。既减少写入频次，
又天然支持「取消」与 `hasChanges`。

**其三 · 动画用 `useNativeDriver: true`**（`useKeyboardAnimation` 第 45 行），
不阻塞 JS 线程。

**其四 · 旋转时重算遮挡偏移**（V2 第 85 至 104 行），
不是一次算完就不管。

---

## 5. 该摒弃的

| # | 问题 | 位置 |
| --- | --- | --- |
| 1 | **保留了合并版 legacy context**，`{...displayState, ...actions}` ⇒ 任何用旧 hook 的消费者仍然全量重渲染，**把 V2 的拆分优化又抵消掉** | V2 第 228 至 234 行 |
| 2 | **值存组件 `useState`** ⇒ 与 TER 的 §6.9 禁止清单第 2 条直接冲突（表单值不得存 `useState`，仅 `requestId` 例外） | `useFancyInput` 第 25 行 |
| 3 | **随机 id**：`Math.random().toString(36).substr(2, 9)` ⇒ 不可寻址、不可复现，且 `substr` 已废弃 | `useFancyInput` 第 35 行 |
| 4 | **布局全是魔数**：`- 80`、`- 50`、`/ 3`、`* 0.55`、`shortEdge >= 600` | V2 第 4 至 13、94 至 98 行 |
| 5 | **直接读 `Dimensions.get('window')`** ⇒ 在副屏 Presentation 上取到的是**主窗口**尺寸，双屏架构下会算错 | V2 第 5、120、122 行 |
| 6 | `confirmInput` 用 `setTimeout(…, 0)` 递交回调，还得配 timer 清理 | V2 第 190 行 |
| 7 | `updateEditingValue` 在 setState 更新器里套 IIFE，等价逻辑可直写 | V2 第 161 至 175 行 |
| 8 | `useKeyboardAnimation` 的 `duration` 与 `easing` 入参**被接收但完全忽略**，内部硬编码 150ms | 第 16 至 58 行 |
| 9 | 业务键盘里留着 `console.log('Key pressed:', …)` | `PriceKeyboard` 第 14 行 |
| 10 | `handlePress` 依赖 `[value, …]` ⇒ 每次按键重建，`onPress` 引用持续变化 | `useFancyInput` 第 46 行 |

⚠️ 第 5 条对我们**尤其致命**：TER 是双屏架构，
屏幕事实必须来自 `display-context` 与 surface，不能从 RN 全局 API 取。

---

## 6. 业界常用做法

| 做法 | 说明 | 与我们的关系 |
| --- | --- | --- |
| **高频值就近持有** | 输入中的值放本地或非受控，**失焦／提交才上抬** | 与 TER「值必须在 uiVariables」冲突，需要调和 —— 见 §8 |
| **Context 拆分** | 把高频与低频状态分开订阅 | V2 已做，直接可借鉴 |
| **`useDeferredValue`／`startTransition`** | React 18 起，把「镜像给别人看」的更新标记为非紧急，保证输入本身跟手 | **可能是本专题最关键的一招**，见 §8 |
| **原生驱动动画** | `useNativeDriver` | V2 已做 |
| **Kiosk 自绘键盘** | 锁定形态下不用系统 IME，自绘可控大小与键位 | 与我们的沉浸式全屏一致 |

---

## 7. ⚠️ 我们当前的性能实况：每敲一个字，一条 public 命令

✅ 亲验 `MemberForm` 第 32 至 36 行：每次输入都调
`dispatchWithRequestId(setUiVariablesCommand, …)`。

✅ 亲验 `setUiVariablesCommand` 的 `visibility: 'public'`；
而 P-11 规定「从部件发起的 `public` 命令派发点**必须显式带 `requestId`**」。

⇒ **每一个字符触发的完整链路是**：
生成 `requestId` → dispatch → actor 解析 → ledger 写入 → store 变更 →
**两棵 surface 树**的订阅者收到通知 → 持久化 debounce 计时重置。

⚠️ **这不是 bug，是规则的必然结果** —— 但它正是 Dexter 性能诉求要面对的东西，
而且我们现在踩的恰好是 POC 里较贵的那套（范式 B）。

---

## 8. 适配候选：三条路，各有取舍

### 甲 · 暂存 ＋ 确认提交（吸收范式 A，值仍归 uiVariables）

键盘浮层内用**本地暂存**编辑，**确认时**一次写入 uiVariables。

- ✅ 每字段只有一条命令，链路成本降一个数量级
- ✅ 天然支持取消与 `hasChanges`
- ❌ **副屏不再逐字实时镜像** —— 与 v13 §4.3 场景 5「店员录入中 …… **实时同步**」冲突
- ⚠️ 需要裁定：暂存值算不算「表单值存 `useState`」而违反 §6.9？
  我的读法是不算 —— 它是键盘控件的编辑缓冲，不是表单的真相源；但这需要明确

### 乙 · 保持逐字写入，但降低单次成本

维持实时镜像，改为让变量写入更便宜（例如变量写入走 `internal` 语义、不进 request ledger）。

- ✅ 实时同步语义不变
- ❌ 触碰 `setUiVariablesCommand` 的 visibility 契约，影响面超出本专题
- ⚠️ 需实测：ledger 写入到底占多少成本，别没测就改

### 丙 · 保持逐字写入，用 React 18 的优先级切分

输入框自身的显示走紧急更新，**副屏镜像走 `useDeferredValue`／transition**。

- ✅ 打字跟手，同时保住实时镜像语义
- ✅ 不动任何契约
- ❌ 副屏镜像有几十毫秒延迟（对顾客而言无感）
- ⚠️ 需确认 `useSyncExternalStore` 这条链上 transition 是否真的生效

**我目前倾向丙，或丙＋甲组合**（数字键盘用甲、文本输入用丙），
但这依赖 §9 的产品裁定，本稿不下结论。

---

## 9. 需要 Dexter 裁的产品问题

| # | 问题 | 为什么必须你定 |
| --- | --- | --- |
| **Q-1** | 副屏是否**必须逐字实时镜像**？还是每字段确认后同步即可？ | 这一条直接决定 §8 走甲还是丙。v13 §4.3 场景 5 写的是「实时同步」，改它是产品语义变更 |
| **Q-2** | `input` 本轮**含不含虚拟键盘**？ | §4-C 已把 T-12 虚拟键盘登记为 automation 寻址的例外，其三层结构落在 RNR 组件模型外。含它，范围与风险大一截 |
| **Q-3** | 是否需要**领域键盘**（数字／金额）还是只要通用文本输入？ | POC 的领域键盘是内嵌页面的业务组件，不是 base 能力。若要，归属需先定 |
| **Q-4** | 系统 IME 与自绘键盘的关系：完全禁用系统输入法，还是共存？ | Kiosk 形态下这是真实选择，影响 focus 管理与遮挡策略 |

---

## 10. 本稿的性质

**分析稿，不是最终需求。**

§1 至 §7 的事实均为本轮亲读 POC 源码与本仓源码所得，行号可复核。
§8 的三条候选与 §9 的四个问题**有意不下结论** ——
方向未定之前写细则，只会产出一份需要推翻的需求。

⚠️ 尚未分析：`AmountConfirmKeyboard`（185 行）我只看了规模未逐行读；
POC 的焦点管理、多输入框切换与校验时机也未展开。
若 §9 裁定后需要，再补第二轮。
