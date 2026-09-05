# TER sample UI 能力建设与体验完善需求

~~~text
TOPIC=NativeWind ＋ React Native Reusables ＋ theme 体系 ＋ Journey 体验闭环
AUTHORITY=Dexter 2026-09-05 会话裁定
STATUS=正式需求。不构成设计或实施授权
PRIOR=doc/plans/platform/2026-09-03-v2s-terminal-sample-verification-slice-requirements-claude.md
~~~

## 0. 本文与前序需求的关系

前序需求（v13 验证切片）已收口：两个 kernel feature、两个 ui feature、`sample-console`、
`dev-host`、五个 adapter 与 `sample-terminal` 均已实施并通过 review。

本文是**新专题**，不推翻 v13 的任何架构裁定。它只做两件事：
把 §4-C 早已写进编码规范、但一直没建的 **NativeWind ＋ RNR 控件能力**建起来；
在此基础上把 sample 的用户体验做成**完整闭环**。

⚠️ 本文**修订** v13 的 §6.7b 一处措辞（见 §7），因为原文会把人带向错误的实现方向。

---

## 1. 为什么做，以及不做什么

### 1.1 第一性理由不是好看

编码规范 §4-C 的原文：automation 的可寻址节点注册**由控件层统一提供**，业务组件零感知；
POC 实测 `semanticId` 52 处对 `testID` 221 处，**「能不能被自动化测到，取决于有没有人记得注册」**，
加法型机制的覆盖率必然随代码量下降。TER 形态因此定为「所有业务组件由 `ui/base/primitives`
（NativeWind ＋ React Native Reusables）构建，该层统一挂注册 ⇒ 默认全部可寻址」。

⇒ **本专题是在补 §4-C 的欠账**，视觉是附带收益，不是目的。

### 1.2 当前事实（本轮亲验）

| 事实 | 依据 |
| --- | --- |
| 仓内 tailwind／nativewind **零痕迹**，是全新引入 | 全仓 `--include=*.json/js/ts` 搜索零命中 |
| `ui/base/primitives` 的八个控件**零样式** | `components.tsx` 中 `backgroundColor`／`color:`／`padding`／`fontSize` 命中数为 0 |
| `assertTestID` 是强制项，空串与纯空白抛错 | 同文件 `assertTestID` |
| `ui/integration` 目前**只有一个包** | `skeleton-graph.ts` 仅 `ui.integration.sample-console` |
| Android 主屏被锁竖屏 | `app.json` 的 `orientation: "portrait"` ⇒ prebuild 生成 manifest 的 `android:screenOrientation="portrait"` |
| 全仓**零沉浸配置** | 搜 `SYSTEM_UI`／`immersive`／`FLAG_FULLSCREEN`／`WindowInsets`／`setDecorFitsSystemWindows`／`lockTask` 零命中；`styles.xml` 只把系统栏设为 transparent |
| `TerminalPresentation` 窗口层零处理 | 只传 `Theme_AppCompat_DayNight_NoActionBar`，无窗口标志、无尺寸处理 |

### 1.3 明确不做

| 事项 | 原因 |
| --- | --- |
| 引入 POS 业务（点单、结账、支付等） | Dexter 2026-09-05 裁定：段 4 的 Journey 重梳**基于 sample 现有业务**，不是 POS 形态原型 |
| 真 Kiosk／Lock Task 模式 | Dexter 2026-09-05 裁定：当前开发阶段只做**甲档沉浸式全屏** |
| 抽取共享 theme 包 | 见 §5.3 的归属规则 |
| automation backend | §4-C 的挂点保留为必经路径，后端本轮仍不建 |
| 浏览器自动化 | 沿用前序登记，S-12 的 Web 刷新与 S-26 的 resize 仍不取证 |

---

## 2. 四段划分

| 段 | 内容 | 关键风险 |
| --- | --- | --- |
| **段 1** | 工具链跑通 ＋ Android 显示基线 | 版本组合最可能翻船，先撞它 |
| **段 2** | `primitives` 换内胆：RNR 作为实现，公共面不变 | 强制 `testID` 是否被 RNR 冲掉 |
| **段 3** | theme 体系：base tokens ＋ app theme 落位 | 归属规则是否被绕开 |
| **段 4** | Journey 重梳 ＋ 体验闭环 ＋ 按需补控件 | 产品语义，需 Dexter 逐项裁定 |

### 2.1 顺序理由

段 3 只做 **theme 体系**，不做八个部件的完整视觉 —— 因为段 4 会重梳 Journey、
可能增删部件，把视觉放段 3 会返工。段 4 一次做完「新 Journey ＋ 新视觉」。

⚠️ **段 4 的设计部分不依赖段 1–3，可以并行启动。** 从用户角度重梳场景只需要
需求正本与 IA／交互工件，不需要 NativeWind 装好；而它是关键路径（需要 Dexter 逐项裁定、
可能来回数轮），越早启动越好。

---

## 3. 段 1：工具链与 Android 显示基线

### 3.1 工具链

引入 NativeWind ＋ Tailwind，接进 Metro 与 babel。

**判据**：`className` 在**至少一个真实 primitive** 上生效，且 **Expo Web 与 Android 双跑通**。
⚠️ 红向量：把 NativeWind 的 babel／Metro 接线摘掉，该 primitive 的 `className` 必须失效 ——
若摘掉后外观不变，说明样式来自别处，接线并未真正生效。

⚠️ 版本组合（NativeWind、Tailwind 与 RN 0.86.3／Expo 57）必须由**本机实际解析值**证明兼容，
不得从教程推断。无法证明时停下来交 Dexter。

### 3.2 主屏固定横屏

`app.json` 的 `orientation` 改为 `"landscape"`，重新 prebuild。

⚠️ **不得直接改 `AndroidManifest.xml`** —— prebuild 会覆盖它。
**判据**：横屏设备上主屏铺满，两侧无黑框。

### 3.3 沉浸式全屏（甲档）

隐藏状态栏与导航栏，允许上划临时唤出。

**主屏与副屏都要。** 副屏现在的 `TerminalPresentation` 窗口层零处理，必须一并补。

**判据**：主屏与副屏均不显示 Android 顶部状态栏与底部导航栏。
⚠️ 红向量：移除沉浸设置，系统栏必须重新出现 —— 若移除后仍不显示，说明隐藏来自别处。

⚠️ **不做真 Kiosk**：不引入 `startLockTask`、device owner 或 screen pinning。

### 3.4 副屏窗口铺满

`TerminalPresentation` 的窗口必须铺满目标 display。

### 3.5 段 1 明确不解决的

⚠️ **「副屏文字过大、下方被裁」不在段 1 修。**

真因是**部件当前零样式**（§1.2），渲染的是 RN 默认字号，在副屏那块屏上显得大，
且没有比例约束所以溢出被裁。段 1 只把**可用区域**弄对（横屏、沉浸、窗口铺满）；
按比例排布是段 3 与段 4 的活。

⇒ 段 1 验收时部件仍是朴素默认样式，**这是预期结果，不得记为缺陷**。

---

## 4. 段 2：`primitives` 换内胆

### 4.1 RNR 是 copy-in，不是依赖

React Native Reusables 采用 shadcn 模型：组件经 CLI **拷进本仓**，成为我们自己的源码，
受我们自己的门约束。因此「引入 RNR」＝把它的组件源码拷进 `ui/base/primitives`。

### 4.2 硬约束：公共面与强制可寻址不变

RNR 组件自带 `className` API，**不带我们的 `testID` 强制**。

⇒ **正确形态是：RNR 拷进来作为 `primitives` 的内部实现，
`primitives` 既有八个控件的公共契约（强制 `testID` ＋ 呈现语义 props）保持不变。**

⚠️ **措辞澄清**（Codex S-3 指出）：这里说的是**既有八项契约不变**，
不是「本专题永不新增公共面」。段 4 若观察到真实重复而下沉新控件，
公共面会新增条目 —— 那是**受 §11.3 下沉规则约束的新增**，与本条不矛盾。 业务包看到的仍是
`PrimitiveButton testID=...`，不是 RNR 的 `Button className=...`。

⚠️ **若直接用 RNR 组件替换八个 primitive，§4-C 的「统一挂注册」就退回加法型**，
这正是本专题要补的欠账本身。

**判据**：`assertTestID` 仍为必经路径，八个控件无一例外；空串与纯空白仍抛错。
⚠️ 红向量：给任一控件加一条绕过 `assertTestID` 的旁路，判据必红。

### 4.3 `className` 不得外泄到业务层

**新增禁止**：`ui/feature` 的生产源码中不得出现 `className`。

理由：`className` 一旦能穿到业务包，「业务组件零感知呈现」的边界就松了，
`PrimitiveButton` 这层的语义封装也失去意义。

**判据**：这条可做成静态门，落进现有 `uiNativePackages` 之外的 `ui/feature` 分母。
⚠️ 红向量：在任一 `ui/feature` 部件上写一个 `className`，门必红。

---

## 5. 段 3：theme 体系

### 5.1 base tokens 归 `primitives`

基础 theme（颜色、间距、字号阶梯等 token）内置在 `ui/base/primitives`。

### 5.2 应用主题归 `ui/integration/<app>/theme/`

每个应用的主题放在自己的 integration 包内，与 `terminalSurfaces` 同址同源。

**理由**：NativeWind 主题是 CSS 变量 ＋ tailwind config 组成的**构建期资产**，
必须被应用的 tailwind config 与 CSS 入口接进去 —— 它天然属于应用装配面。
而 `ui/integration` 正是「一个应用」的边界；§6.7b 已经把同类事实
（`terminalSurfaces`，这个应用的目标硬件形态）放在了这里。

### 5.3 归属规则：永远不抽共享 theme 包（Dexter 2026-09-05 裁定）

⚠️ **即使将来出现第二个、第三个应用，主题仍然各自放在
`ui/integration/<app>/theme/`，不抽 `ui/base/theme-*`，也不新建 `ui/theme/*` 层。**

**为什么写成常驻规则而不是「等看见重复再抽」**：主题是**应用身份**，
不是可复用能力。两个应用的主题看起来像，不等于它们应该共享一个真相源 ——
共享之后任何一方要改都得先协调另一方，这与「主题属于应用」的前提相反。
把它定成常驻规则，可以一次性省掉将来反复出现的「要不要抽」之争。

### 5.4 段 3 的范围边界

段 3 只做 theme 体系与**一个最小部件**的验证（token 真的驱动渲染）。
八个部件的完整视觉属段 4。

⚠️ 红向量：改掉 app theme 的某个 token，该最小部件的渲染必须随之改变 ——
若不变，说明样式没走 token。

---

## 6. 段 3（续）：`ui/base/render` 的层能力

### 6.1 已有的，不重建

| 已有 | 位置 |
| --- | --- |
| 层模型：`openLayerCommand`／`closeLayerCommand`／`clearLayersCommand`／`selectLayers`／`LayerEntry` | `kernel/base/ui-state` 公共面 |
| `LayerStack` 与 `LayerTier`（`'standard'` ｜ `'alert'`） | `ui/base/render` 公共面 |
| 确定性排序：tier → `openedAt` → `layerId` | `LayerStack.tsx` 第 31 至 41 行 |
| 三个现成层部件（`auth.notice`／`waiting-confirm`／`registry-notice`，均 `containerKeys: []`） | v13 §6.9 |

⇒ **一个弹窗就是一个 `layerTier: 'alert'` 的 part**，用 `openLayerCommand` 开、`closeLayerCommand` 关。
这套机制不动，段 4 的所有对话框都走它，**不引入第二套弹窗通道**。

### 6.2 ⚠️ 但现在的「层」盖不住

✅ 亲验 `SurfaceRoot.tsx` 第 12 至 18 行：

~~~
<SurfaceContext.Provider>
  {children}
  <ScreenContainer />
  <LayerStack />
</SurfaceContext.Provider>
~~~

**零定位** —— 无绝对定位、无铺满、无 z 序。RN 默认纵向流式布局下，
`LayerStack` 渲染在 `ScreenContainer` **下方**，不是盖在其上。

而 v13 §4.3 的注释明写「**alert 必须盖在上面店员才看得见**」。

⚠️ S-7b 断言的是「两层同时在场且 alert 排在 standard 之后」——
那是 **React 树顺序**断言，不是视觉覆盖断言。所以判据是绿的，视觉前提却不成立。
现在没暴露只因部件零样式、从未做过视觉；**段 4 一做弹窗必然撞上**。

### 6.3 必须下沉到 `render` 的五项

| # | 能力 | 为什么归 render |
| --- | --- | --- |
| 1 | **视觉覆盖**：`LayerStack` 绝对定位铺满 surface，盖在 `ScreenContainer` 之上 | 这是 LayerStack 自身的定位职责 |
| 2 | **模态遮挡**：层在场时底层不可交互 | 每个业务包各写一遍必然不一致 |
| 3 | **backdrop**：遮罩及其点击语义（见 §6.4） | 同上 |
| 4 | **Android 返回键**：关掉最上层可关闭的 layer，而不是退出应用 | 现在零处理，返回键直接退应用 |
| 5 | **焦点管理**：打开时焦点入层、关闭还回 | 可寻址与可访问性的地板 |

这五项都是 `LayerStack` 的**行为**，不是某个业务弹窗的行为 ——
与 §4-C「加法型机制覆盖率必然随代码量下降」是同一条逻辑，所以必须下沉。

### 6.4 遮罩点击语义与逐弹窗 guard（Dexter 2026-09-05 裁定）

**默认语义：点击遮罩＝关闭。** 但每个弹窗必须声明自己的 guard，因为有些弹窗
**必须用户做出选择才能关闭**。

⇒ 新增一个与 `layerTier` **正交**的声明维度：

| 档 | 语义 | 遮罩点击 | 返回键 | 用于 |
| --- | --- | --- | --- | --- |
| `dismissible` | 告知类，用户读完即可离开 | 关闭 | 关闭 | 登录失败提示、系统故障提示 |
| `decisive` | 必须做出选择，不允许绕过 | **不关闭** | **不关闭** | 放弃录入确认、撤回确认、**顾客拒绝后的去向选择** |

⚠️ **「流程提示」不是一个档位判据** —— 判据是**这个层关掉之后，用户知不知道下一步做什么**。
顾客拒绝的提示看似「告知类」，但关掉之后店员被留在原地自己想下一步 ⇒ 它必须给出口，
因此是 `decisive`。归档以此为准，不以「看起来像通知还是像对话框」为准。

⚠️ **`layerTier` 与可关闭性是两件事**，不得合并：
`alert` 说的是**盖在谁上面**（排序），`decisive` 说的是**能不能绕过**（语义）。
一个 `alert` 层可以是 `dismissible`（登录失败提示），一个 `standard` 层也可能是 `decisive`。

⚠️ 红向量：把某个 `decisive` 层改成 `dismissible` 后，「点遮罩即绕过必须的选择」这条判据必红。

### 6.5 不该进 `render` 的两项

**弹窗外观**（卡片、标题、按钮排布）→ 归 `primitives`，是一个控件。
`render` 只管**怎么盖**，不管**长什么样**。

**确认／取消的结果回传** → ⚠️ **不得做成 promise 式** `await showDialog()`。
TER 的模型是「派命令 → actor 决定」；弹窗的确认就是派一条命令。
promise 式对话框会绕开 command 链路，直接违反 `TR-11` 与 `TR-12`。
这条形态很顺手、很好看，必须提前堵死。

### 6.6 v13 押后条到期

v13 §2.2 押后表第 418 行：「`ui/base` 通用对话框归属 ｜ 本轮只建最小 typed primitives，
**不建通用对话框语义**；两个提示层仍各归各包」。

段 4 正是它的触发条件 ⇒ 该条**移出押后表**，落成本文 §6 的正式范围。

放段 3 而不是段 4 的理由：上述五项是 `render` 的**呈现基础设施**，
与 theme 同属「部件视觉开工前必须先有的地板」；放段 4 会让 Journey 设计
与基础设施改造混在同一批里，评审时分不清红的是哪一层。

---

## 7. 段 4：Journey 重梳与体验闭环

### 7.1 范围（Dexter 2026-09-05 裁定）

**基于 sample 现有业务重梳，不是 POS 形态原型。**

现有旅途保持不变：**门店会员登记** —— 角色为店员（主屏）与顾客（副屏），
主流程是店员登录 → 查看已登记会员 → 新增会员 → 顾客确认后才生效。

⇒ 段 4 的目标是把这条旅途做**完整、闭环**，不是换一条旅途。

### 7.2 方法：从用户任务出发，不从现有部件反推

⚠️ **不得从现有八个 part、现有接口或现有表结构反推用户任务。**
输入是用户任务本身：店员在什么情境下做什么、顾客看到什么、每一步的退出与恢复路径。

### 7.3 需要回答的闭环缺口（示例，非穷举）

现有旅途只覆盖了主路径。重梳时至少要回答：
返回与取消路径、错误后的恢复路径、空态与首次使用、
中途放弃的状态归属、顾客拒绝之后店员怎么继续、以及两块屏在每个状态下**各自显示什么**。

⚠️ 这些属**产品语义**。Dexter 2026-09-05 裁定：**交互设计由 Claude 出**，
产出落在独立的交互设计工件
`doc/plans/platform/2026-09-05-v2s-terminal-sample-interaction-design-claude.md`，
不写进本需求正本。
本文只负责界定范围与约束，不预设解法。

### 7.4 产出

重梳后的旅途与场景矩阵 → 派生的部件清单 → **新增控件先在 feature 内实现** →
全部部件一次做完视觉与交互。

⚠️ **新增控件不直接进 `primitives`**（2026-09-05 订正，原文与交互设计 §11.3 冲突）：
沿用 `PrimitiveMemberRow` 那轮立的规则 —— 不带业务词汇、
且**两个以上 feature 真实重复后**才下沉。段 4 收尾时统计实际重复情况，
下沉留给后续批次。

⚠️ 因此段 4 的新控件**命名必须避开 `Primitive*` 前缀**，避免被误实现为 base 公共控件。
⚠️ 新增控件仍受 §4.2 与 §4.3 约束：强制 `testID`、`className` 不外泄。
⚠️ 带业务领域词汇的组合组件**永远留在 feature**，不进 primitives。

---

## 8. 修订 v13 §6.7b 的措辞

### 8.1 原文会误导

v13 §6.7b 现在写的是：「POS 硬件的屏幕尺寸是**固定的** …… 拿浏览器的响应式尺寸开发，
等于为一个永远不会 resize 的目标做响应式布局，本身就是错的」。

这段读起来像「部件应该按固定尺寸做」。**Claude 2026-09-05 本人就是这样误读的**，
并据此提出了「Android 也按逻辑尺寸渲染 ＋ 缩放」的错误方案。

### 8.2 正确模型（Dexter 2026-09-05 澄清）

**Android 的真实尺寸在先，Web 为 Android 服务。**

`terminalSurfaces` 声明的是**目标真机尺寸**；Web 外壳按它渲染，是为了让开发者
在浏览器里**真实预览**该机型上的效果。它是**预览靶子**，不是渲染契约。

⇒ 必须区分两件现在被混在一起的事：

| 对象 | 要求 | 理由 |
| --- | --- | --- |
| **Web 外壳画布** | **固定**，钉死在目标真机尺寸，不跟随浏览器视口 | 预览必须真实，否则调好的东西到真机不对 |
| **部件内部布局** | **按比例**，适配不同尺寸机型 | 换机型时控件比例不失真；固定尺寸会在别的机型上变成黑边 |

⚠️ S-26 的红向量（外壳容器改 `flex: 1` 跟随视口必红）守的正是第一行，**保持不变**。

### 8.3 落点

请把 v13 的 §6.7b 理由段按上面 §8.2 改写。本文是该修订的授权依据。

---

## 9. 比例纪律（`DEXTER_DECISION`，待裁定）

§8.2 的「部件按比例」是**靠人守**的纪律，而 §4-C 已经证明加法型纪律会随代码量衰减。

**提案**：给它配一条可机械检查的地板 —— **部件源码中禁止裸的绝对像素尺寸字面量**
（`width`／`height`／`fontSize` 等），只允许比例单位、来自 theme 的 token、
或从 surface 尺寸派生的值。

**这不是把丙变成甲**：恰恰相反，它逼着部件用 token 与比例，而 token 的具体值由 theme 按机型给。

⚠️ 红向量：在任一部件写 `fontSize: 24`，门必红。

⚠️ **未裁定前不建此门。** 若 Dexter 裁定不建，§8.2 的比例要求仅作为 review 判据存在，
本文须记录「该纪律无机械地板，依赖人工评审」这一事实，不得假装它被保障了。

---

## 10. 待裁决与待实证

| 编号 | 事项 | 性质 |
| --- | --- | --- |
| **T-1** | 是否建 §9 的比例静态门 | `DEXTER_DECISION` |
| **T-2** | NativeWind／Tailwind 与 RN 0.86.3／Expo 57 的版本组合 | 段 1 实证，本机解析值证明 |
| ~~T-3~~ | 段 4 §7.3 的各项闭环语义 | ✅ **已裁定**（Dexter 2026-09-05 授权 Claude 代裁）：结论见交互设计 §13，其中 X-8 已撤回 |
| **T-4** | RNR 拷入后 primitives 的控件清单是否需要调整 | 段 2 设计时确定 |
| ~~T-5~~ | 遮罩点击语义 | ✅ **已裁定**（Dexter 2026-09-05）：默认关闭，逐弹窗声明 `dismissible`／`decisive` guard，见 §6.4 |

---

## 11. 文档性质

正式需求。**不构成设计或实施授权** —— 须先出设计与实施计划，经 Dexter 与 Claude review 后另行授权。

标 ✅ 的事实均为本轮打开源码或联网亲验；未标注者为设计规定或推论。
§7.3 的闭环缺口在本文**有意留白** —— 解法属交互设计工件，
由 Claude 按 Dexter 2026-09-05 的委托另文产出，不在需求阶段预设。
