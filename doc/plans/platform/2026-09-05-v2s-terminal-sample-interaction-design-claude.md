# TER sample 交互设计：门店会员登记旅途的完整闭环

~~~text
SCOPE=段 4 · 基于 sample 现有业务，不是 POS 形态原型
AUTHORITY=Dexter 2026-09-05 委托 Claude 出交互设计
REQUIREMENTS=doc/plans/platform/2026-09-05-v2s-terminal-ui-capability-and-experience-requirements-claude.md
BASELINE=v13 §4.1 旅途 · §4.3 双屏场景矩阵 · §4.4 单屏场景矩阵
STATUS=交互设计裁定与理由。逐屏矩阵属详设阶段（Dexter 2026-09-05 裁定本轮只评需求合理性）
RULINGS=X-1 至 X-7 已由 Claude 代 Dexter 裁定，见 §13；X-8 已撤回，见 §3.3
~~~

## 1. 设计立场

### 1.1 我按什么推

不从现有八个 part 反推，而是**走一遍真实的店员与顾客**：
店员站在主屏前、顾客站在客显前，每一步问三件事 ——
**他现在想做什么、他能不能反悔、出错了他怎么回到能继续的地方。**

现有旅途只画了**主路径**（登录 → 看列表 → 新增 → 顾客确认）。
下面每一节先说**断在哪**，再给补法。

### 1.2 本文的简写约定（Codex 第二轮 S-2 指出原稿三种写法混用）

正文用 shorthand，正式 `partKey` 一律以 `sample.` 开头：

| shorthand | 正式 `partKey` |
| --- | --- |
| `auth-notice` | `sample.auth.notice` |
| `registry-notice` | `sample.desk.registry-notice` |
| `waiting-confirm` | `sample.desk.waiting-confirm` |
| `member-form`／`member-list` | `sample.desk.member-form`／`sample.desk.member-list` |
| `customer-member`／`customer-welcome` | `sample.desk.customer-member`／`sample.desk.customer-welcome` |
| `staff-login` | `sample.auth.login` |
| 三个新层 | 见 §11.2b |

### 1.3 两条不可动摇的约束

**其一，所有对话框都是 `layerTier: 'alert'` 的 part**，走既有的
`openLayerCommand` / `closeLayerCommand`，不引入第二套弹窗通道。

**其二，弹窗的「确认」就是派一条命令**，不是 resolve 一个 promise。
本设计中每一个确认动作都落到一条具名命令上。

---

## 2. 断点一：进了新增就出不来（最严重）

### 2.1 现状

v13 场景 4 「点新增会员 → `member-form`」，场景 6 「点提交」。
**从 4 到 6 之间没有任何出口** —— 店员填了一半发现顾客走了、填错了人、
或者根本点错了按钮，界面上没有返回，只有提交。

⚠️ 2026-09-05 修订：`preview` 态已下线（编辑值不再进 store，副屏无可镜像之物），
此时副屏停在 `customer-welcome`。断点本身不变 —— 店员填了一半仍然没有出口。

### 2.2 补法

`member-form` 增加**取消**动作。按是否已录入分两种行为：

| 表单状态 | 点取消 | 理由 |
| --- | --- | --- |
| 两个字段都为空 | **直接返回** `member-list`；**双屏时**副屏回 `customer-welcome` | 没有东西可丢，再弹窗是打扰 |

⚠️ 「为空」的判定：部件读自己那两个登记 uiVariable 判空。
这是 props/变量分支，不是屏数分支，不触 `P-9`。
| 任一字段有值 | 弹 **`discard-confirm{intent}`**（`decisive`），选「放弃」才返回，选「继续填写」留在原地 | 已录入的内容是店员的劳动，不能一点就没 |

⚠️ **`intent` 是必需的**（自审第 2 轮发现）：同一个 `discard-confirm` 在
「取消录入」与「带草稿退出」两处复用，**确认之后的去向不同**
（前者回 `member-list`，后者退到 `staff-login`）。
⇒ 层的 props 带 `intent: 'cancel-form' | 'logout'`，部件按 intent 派对应命令。

这是 props 分支，不是屏数分支，不触 `P-9`；
`registry-notice` 已有 `props: {reasonCode}` 的先例，形态一致。

**新增命令**：`memberFormCancelledCommand`（店员意图）·
`memberDraftDiscardedCommand`（确认放弃）

⚠️ `discard-confirm` 是 **`decisive`** —— 点遮罩、按返回键都不能关，
因为「放弃」与「继续」是必须由人做出的选择，绕过等于替用户决定丢数据。

---

## 3. 断点二：等待确认时店员被锁死，且看不到待确认信息

### 3.1 现状

v13 场景 6：主屏 `member-list` ＋ `waiting-confirm`（standard 层），
副屏 `customer-member{mode:'confirm'}`。

`waiting-confirm` 现在只有一条 `:message`（「已提交，等待顾客确认」）。
两个问题：**店员没有任何动作可做**；**看不到待确认会员是谁**。

真实门店里这一步经常卡住：顾客临时走开、顾客口头说「我不办了」但不去点副屏、
店员发现电话号码写错了。而店员想当面核对「张三、138 开头那个号，对吗」时，
屏幕上没有这些信息。

### 3.2 补法：增强层内容，**形态保持 layer 不变**

`waiting-confirm` 增加：待确认会员的**姓名与电话**、以及**撤回**动作。
`containerKeys: []` 与 `layerTier: 'standard'` **均不变**。

### 3.3 ⚠️ 我撤回了原稿的 X-8（把它改为 screen）

原稿曾裁定把 `waiting-confirm` 由 layer 改为 screen，给了四条理由。
Codex 独立评审逐条反驳，**四条都不成立**，我接受：

| 我的原理由 | 为什么不成立 |
| --- | --- |
| 「流程步骤是 screen、打断才是 layer」 | 这是**交互假设**，不是本仓的架构规则。我把主观判断写成了推导 |
| 「等待时要看待确认信息」 | 增强 layer 同样能显示 ⇒ **这条根本不区分两种形态**，却被我当作论据 |
| 「撤回按钮放浮层别扭」 | 审美判断，不构成理由 |
| 「背后的列表是死重」 | 它依赖「层是模态的」，而模态规则是我在**同一份文档里自己刚立的** ⇒ **循环论证**；且列表被盖住是 `SurfaceRoot`／`LayerStack` 的**实现缺口**，不该反过来当产品形态的裁决依据 |

**更根本的是我漏问了一个问题：这两种形态对用户有区别吗？**
「模态层显示姓名电话加撤回」与「screen 显示姓名电话加撤回」，
店员看到的、能做的**完全一样**。

⇒ 用户侧零差异，却要付出推翻 v13 场景 6／7b、S-6、S-7b、S-15 与 `deskPending` actor 分支的代价。
按「从最真实用户场景出发」，**没有理由做这个交换**。X-8 撤回。

### 3.4 撤回动作

`waiting-confirm` 层上的**撤回**，把等待状态的控制权还给店员。

## 4. 断点三：顾客拒绝之后，店员不知道该干什么

### 4.1 现状

v13 场景 7b：主屏 `member-list` ＋ `waiting-confirm` ＋ `registry-notice`(alert)，
场景 8：店员点「知道了」→ 回 `member-form`（数据仍在）。

链路是通的，但 `registry-notice` 现在只有 `:message` 与 `:dismiss`。
店员读完只能「知道了」，**然后自己再想一遍下一步做什么**。

### 4.2 补法

`registry-notice` 在顾客拒绝这个场景下给**两个出口**，而不是一个确认：
**修改后重试**（顾客说「电话写错了」）与**放弃本次登记**（顾客说「我不办了」）。

⚠️ **先说清通知出现时屏上是什么**（Codex 设计评审指出原稿缺此前提，
`INPUT_CORRECTION_REQUIRED` 由此而来）：v13 §4.3／§4.4 对两种形态的规定**不同** ——
双屏 7b 的 PRIMARY 是 `member-list` ＋ `waiting-confirm` ＋ `registry-notice`；
单屏 7b 的 PRIMARY 已经是 `member-form` ＋ `registry-notice`。
⇒ 同样两个出口，两种形态下要执行的屏切换**不一样**：

| 出口 | 双屏（通知出现时屏是 `member-list`） | 单屏（通知出现时屏已是 `member-form`） |
| --- | --- | --- |
| **修改后重试** | 关 `registry-notice` 与 `waiting-confirm` 两层 ＋ `showScreen(member-form)`，表单以 `pending` 回填；副屏 `customer-welcome` | **只关 `registry-notice`**（屏已正确，无第二层可关、无副屏） |
| **放弃本次登记** | 关两层，留在 `member-list`；副屏 `customer-welcome` | 关 `registry-notice` ＋ `showScreen(member-list)` |

⚠️ 数据语义两种形态一致：**重试保留**登记 uiVariables，**放弃清空**。
⚠️ 这不是新增分支，而是把 v13 已有的单双屏差异显式写出来 ——
详设落地时该分支仍只出现在 `sample-member-desk` 的 actor 内，部件零屏数分支（`P-9`）。

⚠️ 这里**不需要再套一层 `discard-confirm`** —— 顾客刚刚明确拒绝过，
再问一次「你确定要放弃吗」是重复确认，属于打扰。

⇒ `registry-notice` 因此是 **`decisive`**：必须选一条出口才能关。

**新增命令**：`memberRegistrationRetryRequestedCommand` ·
`memberRegistrationAbandonedCommand`

---

## 5. 断点四：带着未完成的活退出

### 5.1 现状

v13 场景 9 「店员退出 → `staff-login` ＋ `customer-welcome`」，无条件。

但退出时可能正处于：表单有值、或等待顾客确认中。
现状会**静默丢弃**，而且副屏上顾客的资料会突然消失。

### 5.2 补法

退出按表单状态分两种：

| 退出时状态 | 行为 |
| --- | --- |
| 列表页、无草稿 | 直接退出 |
| 表单有值 | 弹 `discard-confirm{intent:'logout'}`，确认后退出 |

### 5.3 ⚠️ 自审第 5 轮：等待中退出这一行原本不可达

原稿还有第三行「等待顾客确认中 → 弹 `withdraw-confirm{intent:'logout'}`」。
该行**不可达** —— 退出按钮 `:logout` 长在 `member-list` 上，
而等待期间 `waiting-confirm` 是**模态层**（§6.3 第 2 条：层在场时底层不可交互），
店员**碰不到底下列表上的退出入口**。
⚠️ 此结论不依赖 X-8：无论 `waiting-confirm` 是层还是屏，退出入口都够不着。

⇒ **删掉该行，也删掉 `withdraw-confirm` 的 `logout` intent。**

**这不是能力缺失，是流程本身强制了正确顺序**：
等待中要退出，只能 撤回 → 放弃草稿 → 退出。三步，每一步都有意义
（把顾客那侧收回来、决定草稿去留、再离开），比一个「先撤回再退出」的复合弹窗更清楚。

⚠️ X-3 原本的「等待中退出必须先撤回」因此**由弹窗实现改为由界面结构实现** ——
结论不变，机制更简单。

⇒ 连带简化：`withdraw-confirm` 只剩一种用途，**不再需要 `intent`**。

---

## 6. 断点五：基础设施失败没有呈现

### 6.1 现状

这是我在更早一轮提过、并已由 focused test 补上的那条：
`dispatchCommand` 在 ledger 写失败、预算、actor 约束等路径上会 reject，
而部件此前对 rejection 无人观察 —— 按钮退出 loading、界面与成功**完全一致**。

测试已经补了，但**呈现形态一直没定**。

### 6.2 补法

新增 **`system-notice`**（`alert` ＋ `dismissible`）：
基础设施失败时显示可诊断但不吓人的文案，**只有「知道了」一个动作**。

⚠️ **自审第 4 轮删掉了「重试」。** 原稿给了重试按钮，但那要求某处持有
「待重试的命令与 payload」—— 那是新增状态，而 §6.9 的禁止清单只允许 `requestId` 存 `useState`。
⇒ 关掉提示后表单数据仍在，店员**重新点一次提交**即可，
零新增状态、零新增命令。这是更简单且已经够用的解法。

⚠️ 与业务失败严格区分：
- **业务失败**（工号密码错、顾客拒绝）→ 走既有的 `auth-notice` / `registry-notice`，文案是业务语言
- **基础设施失败**（存储、ledger、超时）→ 走 `system-notice`，文案是「操作没有完成，请重试」这一类

⚠️ **不得把两者合并成一个通用错误层** —— 合并之后，
「密码错」和「磁盘满」会长成一样，店员无法判断该改密码还是该叫人。

### 6.3 ⚠️ 触发与 owner 链（Codex M-4 指出原稿只有呈现描述）

原稿写了「基础设施失败时显示 `system-notice`」，却没说**谁把失败变成这个层**。
✅ 亲验：当前 `render` 只做 rejection 记录与重新抛出，**没有把失败转成用户可见 layer 的路径**。

⇒ 需求侧必须定死这条链，否则详设阶段会各写各的：

| 环 | 归属 | 说明 |
| --- | --- | --- |
| 失败发生 | `runtime` 的 dispatch 路径 | 已有：ledger 写失败、预算、actor 约束等会 reject |
| **谁观察到** | **发起动作的 `ui/feature` 部件** | 它已经在观察自己那条 request（§6.2 ④ 的 loading 机制），rejection 是同一条 request 的另一个结局 |
| **谁开层** | 该 feature 自己的 actor | 部件派 `systemFailureObservedCommand`，本包 actor 承接并 `openLayer(system-notice)` |
| 关层 | 同一 actor 承接 `:dismiss` | 与既有 `noticeDismissedCommand` 同形 |

⚠️ **不下沉到 `render`**：`render` 不知道业务语境，无法决定这条失败该不该打扰用户；
而且把「开业务层」的能力放进 toolkit，会让 `render` 反向依赖业务 catalog。
⇒ 失败的**观察点**在部件、**呈现决策**在 feature actor，与 `TR-12` 的分工一致。

#### owner：**各 `ui/feature` 各持一份，不跨包共用**

两个 feature 的动作都可能失败（`sample-staff-auth` 的登录登出、
`sample-member-desk` 的提交确认拒绝），所以两边都需要。

⚠️ 而 J-1 明令**两个 `ui/feature` 互不 import** ⇒ 不能由一方持有、另一方调用。
⇒ **每个 feature 各自拥有一个 `system-notice` part 与一条 `systemFailureObservedCommand`。**

⚠️ 这是**受边界强制的重复，不是设计选择**。按「先看见重复再下沉」的规则，
它是后续批次的下沉候选；但下沉目的地不是 `render`（理由见上），
需另行裁定，本文不预设。

#### 请求生命周期（Codex 第二轮 M-2 指出未闭合）

| 项 | 规定 |
| --- | --- |
| `requestId` | `systemFailureObservedCommand` 是 `public` 命令 ⇒ 按 P-11 **必须显式带 `requestId`**，由部件用 `createRequestId()` 生成 |
| rejection 不静默 | 部件对原 request 的 `.catch` 中：**先**清 loading（`finish(requestId)`），**再**派观察命令。两步都在 catch 内，不放 `finally` |
| loading 只清一次 | 成功走 `.then` 清、失败走 `.catch` 清，**互斥**；`useTrackedRequest` 的 `finish` 已按 requestId 比对，重复调用是 no-op |
| **递归保护** | 观察命令自身若再 reject，**只记结构化诊断，不再派第二条观察命令**。否则失败会自我放大 |
| `:dismiss` | 复用还是新增本包命令，属详设裁定；本文只要求「关层动作必须落到一条具名命令」 |
| props | `{operation: string}` —— 只带静态操作名（如 `'submit-member'`），⚠️ **不得带原始 error、payload、设备标识或任何敏感信息** |

---

## 7. 断点六：返回键语义未定义

### 7.1 现状

Android 返回键当前**零处理**，会直接退出应用 —— 在 Kiosk 形态下这是灾难。

### 7.2 语义表

| 当前状态 | 返回键 |
| --- | --- |
| 有 `dismissible` 层在场 | 关掉最上层该类层 |
| 有 `decisive` 层在场 | **不响应**，可选给一次轻提示 |
| `member-form`（无层） | 等同点「取消」，走 §2.2 的分支 |
| `waiting-confirm`（无层） | 等同点「撤回」，弹 `withdraw-confirm` |
| `member-list`（已登录，无层） | **不响应**（这是店员的主界面，没有"上一层"） |
| `staff-login` | **不响应** |

⚠️ 全表**没有任何一格是「退出应用」** —— Kiosk 形态下退出只能经显式登出。

---

## 8. 断点七：空态与首次使用

### 8.1 现状

`MemberList` 实现里有 `:empty`（「暂无会员」），但**没进场景矩阵**，
也就没有判据保护，且没有引导。

### 8.2 补法

空态不只是一行字，要**指向下一步**：一句说明 ＋ 直接可点的「新增会员」。
⇒ 空态与非空态的主动作是同一个，位置一致，店员不用重新找。

---

⚠️ **全文凡写「副屏回……」，一律隐含「双屏时」**（Codex 第二轮 S-3 指出）：
单屏下不存在 SECONDARY surface（v13 §4.4），该列整个不存在，不是「有但隐藏」。
⇒ 详设落地时，副屏动作必须由 actor 在 `hasSecondarySurface` 分支内执行，
与既有 `deskPending` actor 的形态一致。

---

## 9. 副屏：顾客视角的三条纪律

副屏的设计原则和主屏不同 —— **顾客不是店务操作者**。

⚠️ **2026-09-05 修订**：原文写「顾客不是操作者，是被服务者」，
在 Dexter 追加顾客侧年龄录入之后**这句话已不成立**。
准确的表述是：**顾客只在自己的数据上操作，不参与任何店务操作**。
店务（登录、建档、导航、异常处置）仍全在主屏。

**其一，副屏永远不显示店员的操作细节。** 顾客看到的是「您的登记信息」，
不是「员工正在填写表单」。⚠️ 这条**不受年龄录入影响** ——
年龄是**顾客自己的数据**，不是店员的操作细节。

**其二，副屏的动作限于「顾客对自己这一单的决定与补充」。**
⚠️ **2026-09-05 修订**：原文写「只在需要顾客决策时才出现动作 …… 只有确认、拒绝两个按钮」，
现已扩为**决策 ＋ 有限录入**：`confirm` 态含确认、拒绝**与一个可选的年龄输入**
（见 sample 需求 §4.5）；`welcome` 仍是零动作。
⚠️ 2026-09-05：`preview` 态已下线，店员录入期间副屏保持 `welcome`。

⚠️ **边界要守住**：副屏可录入的只能是**顾客本人才知道、且只属于这一单**的信息。
不得把店员的字段（姓名、电话）挪到副屏让顾客填 —— 那会把店务推给顾客。

⚠️ `handheld-confirm` **永远不会出现在副屏** —— 它是单屏专属形态，
屏幕在店员与顾客之间传递，故额外带「交还店员」。
本条纪律说的是**副屏**，不与 §10.2 的三 mode 冲突（Codex S-2 指出原稿此处措辞含混）。

**其三，副屏不弹任何 `alert` 层。** 所有异常都在主屏处理 ——
顾客不该看到系统错误，店员才是要处置的人。

⇒ 这条同时是一条**可机械检查的判据**：
副屏在场的层集合必须为空，任何 `openLayer` 到 `SECONDARY` 的调用都应视为设计错误。

⚠️ **虚拟键盘不破这条**：按 input 需求 §1b.6，键盘挂在 `SurfaceRoot` 的**底部区**，
它既不是屏也不是层 ⇒ 副屏出现键盘时，层集合**仍然为空**。
⚠️ 反过来说：**不得把副屏键盘实现成一个 layer** —— 那会同时破掉本条纪律
与 input 需求 §1b.6 的挂载形态。

---

## 10. ⚠️ 单屏形态：自审发现的硬伤与补法

### 10.1 问题

上面 §2 至 §8 基本是**按双屏写的**。对照 v13 §4.4 的单屏矩阵重走一遍，
发现三处在单屏下**根本没有落点**：

| 断点 | 单屏为什么不成立 |
| --- | --- |
| §3 的「撤回」 | 单屏场景 6 是 `customer-member{confirm}` **占满整屏**，`waiting-confirm` 层**不出现** ⇒ 撤回按钮无处可放 |
| §5.2 第三行「等待中退出」 | 同上，屏幕上是顾客的确认页，店员碰不到退出 |
| §7.2 返回键表 | 完全没有覆盖「屏幕上是 `customer-member{confirm}`」这一状态 |

⚠️ 第三条尤其危险：单屏下设备在**顾客手里**，
若返回键能回到店员界面，顾客一按就越权了。

### 10.2 补法：给 `customer-member` 增加第三种 mode

单屏下设备是**交到顾客手上再拿回来**的，所以需要一个「交还店员」的出口。

⇒ `customer-member` 的 mode 由两值扩为三值：

| mode | 用于 | 顾客可见动作 |
| --- | --- | --- |
| ~~`preview`~~ | ⚠️ **2026-09-05 下线**：编辑值不进 store，无可预览之物；录入期间副屏保持 `welcome` | — |
| `confirm` | **双屏**副屏确认 | 确认、拒绝 |
| `handheld-confirm` | **单屏**占满整屏确认 | 确认、拒绝、**交还店员** |

**为什么用 mode 而不是在部件里判屏数**：`P-9` 明写「部件源码中零 `if` 分支依赖屏数，
单屏／双屏分支只在 `sample-member-desk` 的 actor 内」。
mode 是 props，部件按 props 分支是允许的；而**由 actor 决定给哪个 mode**——
actor 本来就在做这个判断（v13 §4.4 已确立）。⇒ 零新机制。

⚠️ 同时守住 §9 的副屏纪律：双屏副屏永远拿到 `confirm`，
**永远看不到「交还店员」** —— 那是单屏专属的设备移交动作，不是顾客的业务决策。

### 10.3 「交还店员」之后

点「交还店员」⇒ 等同于 §3 的撤回：
主屏回 `member-form`（数据保留），`pending` 撤销。

⚠️ 它**不弹 `withdraw-confirm`** —— 双屏下撤回要确认，是因为店员看不到顾客那一侧、
可能误撤；单屏下顾客就在店员面前，把设备递回来这个动作本身已经是确认。
**多一次弹窗是打扰。**

**新增命令**：复用 `memberSubmissionWithdrawnCommand`，不另造。

⚠️ **竞态与清理与双屏撤回同规则**（Codex S-1 指出原稿未同步）：
顾客点确认与店员点「交还店员」若同时到达，按 §3 的**先到者赢**处理；
幂等判定依据同为 `pending` 的存在性 —— 后到者进 actor 时 `pending` 已不存在 ⇒ no-op ＋ 结构化诊断。
撤回成功后 `pending` 清除，登记 uiVariables **保留**（店员要接着改），
与双屏撤回完全一致，不为单屏另立规则。

**新增 testID**：`sample.desk.customer-member:hand-back`

### 10.4 单屏的返回键

补齐 §7.2 表格：

| 单屏状态 | 返回键 |
| --- | --- |
| `customer-member{mode:'handheld-confirm'}` | **不响应** |

⚠️ 理由是**越权**，不是习惯：设备此刻在顾客手里，
返回键若能回到店员界面，顾客就能看到会员列表。

### 10.5 单屏与双屏的差异处由三处增至四处

v13 §4.4 写的是「单屏与双屏的差异**只在三处**」（场景 6、7b、8）。
本设计引入第四处：**撤回的形态不同** ——
双屏经 `waiting-confirm` 的撤回按钮加 `withdraw-confirm` 确认；
单屏经 `handheld-confirm` 的「交还店员」直接撤回、无确认。

⇒ v13 §4.4 的「只在三处」需同步修订为四处。本设计是该修订的依据。

---

## 11. 汇总：新增的层与命令

### 11.1 层（全部走既有 layer 机制）

⚠️ **层的总数由三个增至六个**（自审第 6 轮订正：原稿写「不增反减」后又写「三个变五个」，
自相矛盾；且 X-8 撤回后 `waiting-confirm` 仍是层）。
既有三个：`auth.notice`、`registry-notice`、`waiting-confirm`；
新增三个：`discard-confirm`、`withdraw-confirm`、`system-notice`。
每一个都对应一次真实的用户决策或告知。

| 层 | tier | guard | 触发 |
| --- | --- | --- | --- |
| `discard-confirm{intent}` | alert | **decisive** | 表单有值时取消（`cancel-form`）或退出（`logout`） |
| `withdraw-confirm` | alert | **decisive** | 等待中点撤回 |
| `system-notice` | alert | dismissible | 基础设施失败 |

⚠️ 自审收敛两轮：第 2 轮把 `withdraw-before-logout` 与 `withdraw-confirm` 合并（4 → 3）；
第 5 轮发现「等待中退出」不可达，删掉该路径后 `withdraw-confirm` 连 `intent` 也不再需要。
⇒ **新层 3 个，其中只有 `discard-confirm` 带 `intent`。**
| `auth-notice`（既有） | alert | dismissible | 登录失败 |
| `registry-notice`（既有，改造） | alert | **decisive** | 顾客拒绝，两个出口 |
| `waiting-confirm`（既有，改造） | standard | — | 增加姓名、电话与撤回；**形态仍是层**，见 §3.3 |

### 11.2 命令（**六条**，非五条 —— Codex 第二轮指出原稿漏计）

| 命令 | owner module | 触发 |
| --- | --- | --- |
| `memberFormCancelledCommand` | `sample-member-desk` | 表单点取消 |
| `memberDraftDiscardedCommand` | `sample-member-desk` | `discard-confirm` 确认放弃 |
| `memberSubmissionWithdrawnCommand` | `sample-member-desk` | 撤回，含单屏「交还店员」 |
| `memberRegistrationRetryRequestedCommand` | `sample-member-desk` | `registry-notice` 选修改后重试 |
| `memberRegistrationAbandonedCommand` | `sample-member-desk` | `registry-notice` 选放弃本次 |
| **`systemFailureObservedCommand`** | **各 `ui/feature` 自有一条** | 部件观察到自己那条 request 被 reject，见 §6.3 |

⚠️ **`noticeDismissedCommand` 的去留**：`registry-notice` 移除 `:dismiss` 后，
该命令在 member-desk 侧**失去触发点**。它是否删除、还是保留给 `system-notice` 的 `:dismiss` 复用，
属详设裁定；本文只登记「它的原触发点消失」这一事实。

### 11.2b 三个新 layer 的正式契约

| shorthand | 正式 `partKey` | owner module | displayMode | props | guard | testID |
| --- | --- | --- | --- | --- | --- | --- |
| `discard-confirm` | `sample.desk.discard-confirm` | `sample-member-desk` | `['PRIMARY']` | `{intent: 'cancel-form' \| 'logout'}` | decisive | `:message` · `:discard` · `:keep` |
| `withdraw-confirm` | `sample.desk.withdraw-confirm` | `sample-member-desk` | `['PRIMARY']` | 无 | decisive | `:message` · `:withdraw` · `:keep` |
| `system-notice` | `sample.auth.system-notice`／`sample.desk.system-notice` | **各 feature 各一**，见 §6.3 | `['PRIMARY']` | `{operation: string}` | dismissible | `:message` · `:dismiss` |

⚠️ `layerId` 沿用 v13 既有约定：与 `partKey` 同值（本轮每类层最多一个实例）。

⚠️ 全部是**呈现意图命令**，由 `ui/feature` 自己定义（`TR-11`）；
业务事实的变更仍由 kernel feature 的领域事件命令承担。

### 11.3 ⚠️ 新控件：先留在 feature，不直接下沉（Codex M-5 指出，我接受）

原稿提议一次性把四个控件补进 `primitives`。**这违反了我自己在
`PrimitiveMemberRow` 那轮立的规则**：不带业务词汇、且**两个以上 feature 真实重复后**才下沉。
现在这四个的真实 consumer 是零。

我原来的辩护是「§4-C 要求 primitives 是可寻址挂点」，**这条也不成立**：
feature 里用 `PrimitiveContainer` ＋ `PrimitiveText` ＋ `PrimitiveButton` 组合出的对话框，
强制 `testID` 已由这三个既有控件保证，不需要新的 base 控件才能可寻址。

⇒ **裁定：四个控件先在 feature 内实现**，段 4 收尾时统计实际重复情况，
**观察到两个以上 feature 真实重复的，再在后续批次下沉**。

⚠️ 若下沉，props 只能描述呈现，**明确禁止**接收 `intent`、`guard`、`reasonCode`、
screen mode 或业务 command —— 那些一旦进 props，控件就带上了业务语义。

### 11.4 段 4 需要的控件形态（暂居 feature）

⚠️ **命名必须避开 `Primitive*` 前缀**（Codex 第二轮 S-1 指出）：
这四个既然暂居 feature，叫 `PrimitiveDialog` 会让人误以为是 base 公共控件，
将来实施时极易被直接放进 `primitives`。

⇒ 改用 feature-local 命名：`DialogSurface`、`DialogActions`、`EmptyState`、`ScrollArea`。
下沉时再按 `primitives` 的命名约定改名，那是一次显式动作，不是顺手。

| 控件 | 为什么现在没有 |
| --- | --- |
| `DialogSurface`（卡片、标题、正文、动作区） | 现有八个控件里没有任何「成组的模态容器」 |
| `DialogActions`（并排动作按钮，含主次层级） | `PrimitiveActions` 是通用容器，没有主次与并排语义 |
| `EmptyState`（说明 ＋ 主动作） | §8.2 需要 |
| `ScrollArea`（列表溢出） | 会员多了必然溢出，✅ 亲验两个 feature 包 `ScrollView`／`FlatList` 零命中。⚠️ 用 `ScrollView` 不用 `FlatList`：sample 的会员量级小，虚拟化是本阶段不需要的复杂度 |

⚠️ 四个都**不带业务词汇**，符合下沉判据。
⚠️ 四个都必须走强制 `testID`，与既有八个一致。

---

## 12. 本设计引起的既有契约变更（自审第 3 轮补）

原稿改造了两个既有部件却没记契约变更 —— 而 v13 §6.9 的 testID 清单是判据依据，
不同步会让 S-2、S-7b 一类判据对不上实现。

| 部件 | v13 §6.9 现有 testID | 本设计新增 | 判据影响 |
| --- | --- | --- | --- |
| `waiting-confirm` | `:message` | `:member-name` · `:member-phone` · `:withdraw` | **形态不变**（仍 `containerKeys: []` ＋ `layerTier: 'standard'`），只增内容与动作 |
| `registry-notice` | `:message` · `:dismiss` | `:retry` · `:abandon`，**移除 `:dismiss`** | 场景 8 由「知道了」改为两个出口，v13 §4.3 第 8 行需同步 |
| `member-form` | `:name` · `:phone` · `:submit` · `:loading` | `:cancel` | — |
| `member-list` | `:row` · `:add` · `:logout` | `:empty-action` | 空态引导，§8.2 |
| `customer-member` | `:name` · `:phone` · **`:age`**；confirm 态另有 `:confirm` · `:reject` | `handheld-confirm` 态另有 `:hand-back` | 见 §10.2；⚠️ **2026-09-05 新增 `:age`**（顾客侧可选年龄输入，sample 需求 §4.5），**两种 mode 都有** |

⚠️ **`registry-notice` 移除 `:dismiss` 是破坏性变更** —— 它从「读完关掉」变为
「必须选一条出口」。v13 §4.3 场景 8「店员点『知道了』」随之作废，需一并修订。

### 12.1 需同步修订的 v13 条目

| v13 位置 | 修订内容 |
| --- | --- |
| §4.3 场景 8 | 「点知道了 → member-form」改为两个出口（重试／放弃） |
| §4.4 「差异只在三处」 | 改为四处，见 §10.5（撤回形态单双屏不同） |
| §6.9 testID 清单 | 按上表补齐 |
| **S-15** | 层部件由三个增至**六个**；判据的分母须同步 |
| **S-16** | 需覆盖 `customer-member` 的**两种** mode（`confirm`／`handheld-confirm`）⚠️ **2026-09-05 更正**：原写「三种」，与本表下一行「props 改为 `{confirm\|handheld-confirm\}`」自相矛盾 —— `preview` 已下线 ⇒ 是两种。**两种都须覆盖年龄输入**（sample 需求 §4.5） |
| §6.9 props 契约 | `customer-member` 的 props 改为 `{mode:'confirm'\|'handheld-confirm'}` —— `preview` 下线、`handheld-confirm` 新增，**仍是两值** |
| **P-11** | 六条新命令中的 `public` 命令须纳入「派发点显式带 `requestId`」的判定分母 |
| **P-12** | v13 的 allowed-list 仍只含旧命令 ⇒ 须补入六条新命令；并登记 `noticeDismissedCommand` 原触发点消失 |
| §11.2b 的三个新 layer | `partKey`、owner module、`displayMode`、props、guard、testID 已在本文逐项给出，v13 需照此补表 |
| 新 layer 的 actor 承接 | 每个新 layer 的开／关分别由哪个 actor 承接，须逐项落进 §7.1 listener 表 |
| `waiting-confirm` 的撤回 | 新增 `memberSubmissionWithdrawnCommand` ⇒ command 表、actor 承接、P-12 allowed-list、§7.2 链路四处均须同步（Codex 第二轮指出「只有三个 testID」不完整） |
| §6.6 command／module 表 | 补五条新命令的 owner 与所属 module |
| §7.1 listener 与 §7.2 链路 | 补新命令的承接 actor 与因果链 |
| §8 的 `layerId` 示例 | 补三个新层的 `layerId`（沿用与 `partKey` 同值的既有约定） |

⚠️ **X-8 撤回后，v13 的场景 6／7b、S-6、S-7b 与 `deskPending` actor 均不需要修改** ——
`waiting-confirm` 仍是 standard 层，两层同时在场的业务载体保留，S-7b 照旧成立。

---

## 13. 我替 Dexter 做的裁定（授权见文首）

Dexter 2026-09-05 授权：「需要我裁决的，你替我裁决。原则只有一个 ——
不要考虑沉没成本，以最真实的用户场景和用户旅途出发，无论哪个包都可以修改调整。」

| # | 事项 | 裁定 | 依据 |
| --- | --- | --- | --- |
| X-1 | 撤回／确认竞态「先到者赢」 | **采纳** | 不引入新机制，幂等判据是 `pending` 存在性 |
| X-2 | 顾客拒绝后两个出口，不再套确认 | **采纳** | 顾客刚明确拒绝过，再问一次是打扰 |
| X-3 | 等待中退出必须先撤回 | **采纳，但改为由界面结构实现** | 见 §5.3：等待期间没有退出入口，流程天然强制「撤回 → 放弃草稿 → 退出」，不需要复合弹窗 |
| X-4 | 副屏零 alert 层并做成判据 | **采纳** | ✅ 亲验现有三处 `openLayer` 全指向 `primary`，是固化事实而非新增约束 |
| X-5 | 四个新控件一次补齐 | **采纳，但归属改了** | 一次补齐仍成立，但按 §11.3 **先在 feature 内一次补齐**，不直接进 primitives |
| X-6 | `customer-member` 增加 `handheld-confirm` | **采纳** | 单屏下没有它就没有交还出口，且顾客可越权 |
| X-7 | `registry-notice` 移除 `:dismiss` | **采纳** | 「读完关掉」把店员留在原地自己想下一步；两个出口才是闭环 |
| ~~X-8~~ | `waiting-confirm` 由 layer 改 screen | ❌ **已撤回** | 四条理由经 Codex 反驳均不成立，见 §3.3。用户侧零差异却要付大额 v13 连带代价 |

⚠️ **X-8 已于本轮撤回。** 我当初标它「可逆」是对的 —— Codex 独立评审反驳后，
回退确实只需保留 `waiting-confirm` 的层形态，撤回按钮留在层上即可。
⇒ v13 的场景 6／7b、S-6、S-7b 与 `deskPending` actor **均不需要修改**。

**这条记录保留，不删。** 它说明一件事：我用「不考虑沉没成本」这条授权
做了一次过度推翻，把「现有 layer 内容不足」误判成了「layer 形态错误」——
两者是不同的命题，我当时把它们混在一起了。

---

## 14. 遗留：不在本设计范围

⚠️ 裁定已全部收口于 §13，本节**不再重复**。以下仅记录本设计明确不覆盖的事项。

| 事项 | 归属 |
| --- | --- |
| 逐屏矩阵（screen／layer、文案、布局、操作分母、testID、状态边界、owner 矩阵） | **详设阶段**（Dexter 2026-09-05 裁定；Codex M-1 提出，本轮不做） |
| 具体文案、配色、尺寸 | 段 3 的 theme 与段 4 的视觉实现 |


⚠️ 本设计**未涉及**具体文案、配色与尺寸 —— 那些属段 3 的 theme 与段 4 的视觉实现，
需先有本设计的结构裁定。
