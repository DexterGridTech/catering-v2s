# TER sample 验证切片 —— 需求分析稿（非正式）· 第五版

作者：Claude ｜ 日期：2026-09-03 ｜ 状态：**讨论稿，不构成实施授权**

> **第五版**：作者自对抗审查两轮后的修订，共处置 2 M / 5 S / 7 N。
> 两条 M 均为**我自己前一版的设计错误**，处置见 §6.2「已修正的设计错误」。
>
> **第四版的两处变化**：
> ① 按 Dexter 裁定收窄范围 —— **「明确该有的能力，不满足就优化；明确还没建的功能先放下」**；
> ② 把**设计模式提为第 1 章的脊梁**。前三版把模式当成勾选项，
> 本版反过来：先立模式与其可证伪判据，旅途与功能都必须服从它。
> **不得为了凑覆盖率丢掉设计模式** —— 凑出来的覆盖率是负资产。

**本轮宿主范围：只覆盖 Android。**（Dexter 2026-09-03 裁定）
产品宿主只有 Android，机制即 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` ——
一个 ReactHost、一个 Hermes VM、一个 JS 线程、一个 store、多个 Root Surface。
Expo Web 仅作**开发与测试宿主**，不是产品形态。其它宿主不在本轮视野内，不为其预留任何结构。

**做 sample 不是目的。** 目的是拿真实旅途压 TER：框架**完整**吗？**简单健壮**吗？
它**加速**业务开发，还是让业务开发更麻烦？因此本稿最重要的产出是 §7 的框架发现。

---

## 1. 设计模式是脊梁（不可为凑功能让路）

### 1.1 MVC 在 TER 中的映射

| MVC | TER 载体 | 谁可以写 |
| --- | --- | --- |
| **M**odel | slice（业务包自有）＋ ui-state 的 content / variables | **只有 actor** |
| **V**iew | `definePart` 注册的 React 部件 | 只读；**永不写** |
| **C**ontroller | **command ＋ actor** | actor 是唯一写入点 |

**唯一合法写路径**（`TR-01` 原文）：

```
command → actor → dispatchAction
```

**唯一合法事件路径**（`TR-11` 原文，Dexter 2026-09-02 定为「本 TER 工程最重要的设计模式」）：

```
事件（外部端口／内部状态变化） → command → 关心它的业务方自己的 actor → dispatchAction
```

### 1.2 View 绝不做决策

View 只做两件事：**读 selector** 与 **`dispatchCommand`**。

它**不判断**「现在该显示什么」——那是 actor 的事。
UI 只汇报「用户点了什么」，由业务 actor 决定后果。这正是 Dexter 说过的形态：
> 用户 logout 了，应该有个 logout command，login 的业务模块 actor 监听到了，
> 就直接设置当前的 UI 为 loginUI，而不是从 UI 队列里反推。

### 1.3 九种「为凑功能丢掉模式」的具体形态（本 sample 的反例栏）

| # | 违反形态 | 后果 | 可否机械判定 |
| --- | --- | --- | --- |
| V-1 | 部件里出现 `dispatchAction` / `store.dispatch` / `useDispatch` | 直接违反 `TR-01` | ✅ 禁止句 |
| V-2 | 把 dispatch 藏进改名的包装函数再跨文件传递 | 绕过禁止句 | ❌ 只能 review（`TR-01` 反例栏明载） |
| V-3 | **部件自己判断该渲染哪个屏**（如 login 部件读 session 状态自行切换为主页） | View 变成 Controller | ❌ review |
| V-4 | 表单值存组件 `useState`，绕过 uiVariables | 场景 8「取消后数据仍在」**直接失效**；且是 POC 的老毛病 | ✅ 见 §9 判据 |
| V-5 | 把业务状态（`pendingMember`）塞进 uiVariables 而非业务 slice | Model 分层错位；uiVariables 是**界面变量**不是业务事实 | ❌ review |
| V-6 | 在 selector 里写业务决策 | Controller 逻辑漏进 Model 读侧 | ❌ review |
| V-7 | **integration 里写业务逻辑**（如集成层决定登录后去哪一屏） | 业务语义泄漏到编排层，将来 POS/KDS 各写一遍 | ❌ review |
| V-8 | 两个 feature 包的部件互相 import | 破坏包自治 | ✅ 依赖图 |
| V-9 | 事件桥缺**播种／去重** | `TR-11` 明载 POC 实测后果：**每次启动翻转一次屏身份** | ✅ 见 §9 判据 |

⚠️ 九条里只有四条可机械判定。**其余五条靠 review** —— 这正是 `TR-11` 反例栏
说的 `UNENFORCEABLE_BY_MACHINE`。⇒ 实施评审必须逐条对照本表，不得只看门是否全绿。

---

## 2. 用户旅途：门店会员登记

**角色**：店员（主屏）· 顾客（副屏）

**旅途**：店员登录 → 查看已登记会员 → 新增会员 → **顾客在副屏确认后才生效**

选它的理由：`需顾客确认` 是一次**跨 surface 的双向交互** —— 主屏发起、副屏决策、
状态在确认后才提交。这条比「主屏操作、副屏展示」苛刻得多，能压到 TER 最没被验证的部分。

## 3. 场景矩阵

| # | 时刻 | PRIMARY（店员） | SECONDARY（顾客） |
| --- | --- | --- | --- |
| 1 | 开机，未登录 | 登录页 | 待机：欢迎光临 |
| 2 | 工号或密码错 | 登录页 ＋ 提示层（alert） | 待机 |
| 3 | 登录成功 | 会员列表 | 待机 |
| 4 | 点「新增会员」 | 登记表单（空） | 信息预览（空） |
| 5 | 店员录入中 | 表单（有值） | 预览**实时同步** |
| 6 | 点「提交」 | 列表 ＋ 等待确认层（standard） | 确认页：信息 ＋ 确认／取消 |
| 7a | 顾客点「确认」 | 列表（含新会员） | 待机 |
| 7b | 顾客点「取消」 | 列表 ＋ 等待层 ＋ 已取消提示（alert） | **预览**（登记未结束） |
| 8 | 店员关掉提示 | 表单（**数据仍在**） | 预览（不变） |
| 9 | 店员退出 | 登录页 | 待机 |

**场景 7b 保留等待层再叠提示层**，使 standard 与 alert 两层同时在场 ——
alert 必须盖在上面店员才看得见。`layerTier` 排序由真实交互自然要求，不是硬造。

**副屏语义收紧**：`customer-welcome`（待机）＝ **没有进行中的登记**。
故 7b 顾客取消后副屏回**预览**而非待机（表单数据还在，流程未结束），
场景 8 副屏因此不需要任何动作。

> ⚠️ 第四版此处矛盾：场景矩阵写场景 8 副屏为「预览」，而 §6 链路未派任何 SECONDARY 命令
> ⇒ 副屏会停在待机。本版收紧语义后消解。

### 3.1 单屏形态

**Dexter 硬需求：sample 必须能判断本机单屏还是双屏，两者展示方式不同。**

⚠️ **单屏时 §3 的 SECONDARY 整列不存在**（没有第二棵 surface 树被挂载），
不是「有副屏但隐藏」。第四版写「只有场景 6–8 改写」是错的。

单屏下 PRIMARY 的差异只在三处：

| # | 单屏 PRIMARY | 与双屏的差异 |
| --- | --- | --- |
| 6 | **`customer-member` 占满整屏**，提示店员把设备转给顾客 | 双屏是「列表＋等待层」 |
| 7b | 表单 ＋ 已取消提示（alert） | 双屏是「列表＋等待层＋提示层」 |
| 8 | 关提示即可（**无等待层可关**） | 双屏要关两层 |

⇒ **单屏下验不到 `layerTier` 排序**（同时只有一层）。S-7b 判据因此限定「双屏形态下」。

**单屏与双屏共用同一个 `customer-member` 部件**，只是 `showScreen` 的目标 displayMode 不同
⇒ 该部件声明 `displayModes: ['PRIMARY','SECONDARY']`。
业务分支被压缩到 actor 里的**一处**，且是业务本来就该有的分支。

## 4. 部件

| part | 包 | displayModes | containerKeys | layerTier | 出现于 |
| --- | --- | --- | --- | --- | --- |
| `staff-login` | auth | `['PRIMARY']` | `['main']` | — | 1,2,9 |
| `auth-notice` | auth | `['PRIMARY']` | `[]` | `alert` | 2 |
| `member-list` | desk | `['PRIMARY']` | `['main']` | — | 3,6,7 |
| `member-form` | desk | `['PRIMARY']` | `['main']` | — | 4,5,8 |
| `waiting-confirm` | desk | `['PRIMARY']` | `[]` | `standard` | 6,7b |
| `registry-notice` | desk | `['PRIMARY']` | `[]` | `alert` | 7b |
| `customer-welcome` | desk | `['SECONDARY']` | `['main']` | — | 1,2,3,7 |
| `customer-member` | desk | `['PRIMARY','SECONDARY']` | `['main']` | — | 4,5,6；单屏时占满主屏 |

`customer-member` 的 props 只带 `{mode: 'preview' \| 'confirm'}`；
**业务数据读 `sample-member-registry` 的 slice**。

> ⚠️ 第三版曾立过「副屏数据一律走 props、禁读 slice」——**本版撤销**。
> 那条理由是「双机时对端 store 没有数据」，而双机按本轮范围已放下。
> 在单 VM 单 store 下，副屏读同一 slice 是**正确且更自然**的写法；
> 把整个会员对象塞进 props 反而造成数据重复。用未来需求约束当下写法，正是本轮要过滤掉的。

## 5. 包划分

| 层 | 包 | 职责 |
| --- | --- | --- |
| `kernel/feature` | `sample-staff-session` | session slice、`login` / `logout` command 与 actor |
| `kernel/feature` | `sample-member-registry` | 会员 slice、待确认状态机、`openMemberForm` / `submitMember` / `confirmMember` / `rejectMember` |
| `ui/feature` | `sample-staff-auth` | `staff-login` ＋ `auth-notice` |
| `ui/feature` | `sample-member-desk` | 其余 6 个 part |
| `ui/integration` | `sample-console` | 组装；兼 Expo Web 工程 |
| `assembly/android` | `sample-terminal` | 只剩端口表 |

骨架 22 → 26（新建 4，`platform-console` 与 `pos-desktop` 改名）。

**两个 kernel/feature 包是旅途逼出来的**：会话与会员登记是两件事，
而它们的协作方式正是模式要示范的东西（见 §6 场景 3）。

---

## 6. 每个场景的 command 链路（模式落到每一步）

### 6.1 会话状态的唯一出口：`sessionEstablishedCommand`

`sample-staff-session` 定义 `sessionEstablishedCommand({authenticated, operatorName?})`，
在**三处**派出：install 恢复后、登录校验通过后、退出后。它是「会话状态已确定」这个
**内部事件**的承载体（`TR-11`）。

两个模块各自监听它，**动作互斥**，因此并发执行也无竞态：

| 监听者 | 条件 | 动作 |
| --- | --- | --- |
| `staff-session` 的导航 actor | `!authenticated` | `showScreen(PRIMARY, staff-login)` |
| `member-registry` 的导航 actor | `authenticated` | `showScreen(PRIMARY, member-list)` |
| `member-registry` 的导航 actor | **两种情况都** | `showScreen(SECONDARY, customer-welcome)` |

- 对 PRIMARY 的写入**互斥**（`authenticated` 与 `!authenticated`）⇒ 无竞态；
- 副屏待机部件 `customer-welcome` 属 desk 包，故由 desk 包派 ⇒ 无跨包 partKey 知识；
- `staff-session` 派出事件时**不知道谁关心** ⇒ `TR-11` 收益 ③ 的真实示范。

### 6.2 已修正的设计错误（第四版 M 级，自查发现）

> ❌ **第四版原文**：「`staff-session` 写 session；`member-registry` 监听**同一条 `loginCommand`** 自行导航」。
>
> ✅ 亲验 `createCommandDispatcher.ts` 第 527 行：
> `await Promise.all(handlers.map(handler => dispatchActor(...)))`
> —— **同一条命令的多个 handler 是并行执行的**。
> ⇒ `member-registry` 可能在 `staff-session` 写入 session slice **之前**读取它，**存在竞态**。
>
> **修正**：改为因果链 —— 写入方写完后派出**新命令**，关心方监听那条新命令（§6.1）。
> 顺序由因果保证，不依赖 handler 注册顺序或并发时序。
>
> ⚠️ 这条同时收窄了 §7.1 A-2：「一命令多 actor」是 TER 的**能力**，
> 但**不可用于有先后依赖的场合**。本 sample 只在互斥动作上用它。

### 6.3 逐场景链路

| 场景 | UI 动作 | 业务 command | 承接 actor | 写入 | 派出的后续命令 |
| --- | --- | --- | --- | --- | --- |
| 1 | 无（模块 `install`） | `bootstrapSessionCommand` | `staff-session` | — | 读已恢复 slice → `sessionEstablishedCommand` |
| 2 | 点「登录」（校验失败） | `loginCommand` | `staff-session` | **不写** | `openLayer(PRIMARY, auth-notice)` |
| 3 | 点「登录」（校验通过） | `loginCommand` | `staff-session` | session slice | `clearUiVariables{keys:['loginPasscode']}` ＋ `sessionEstablishedCommand{authenticated:true}` → §6.1 |
| 4 | 点「新增」 | `openMemberFormCommand` | `member-registry` | — | `showScreen(PRIMARY, member-form)`；**双屏**另加 `showScreen(SECONDARY, customer-member{mode:'preview'})` |
| 5 | 输入 | `setUiVariablesCommand` | ui-state 自有 actor | 变量 slice | — |
| 6 | 点「提交」 | `submitMemberCommand` | `member-registry` | `pendingMember` | **双屏**：`showScreen(PRIMARY, member-list)` ＋ `openLayer(PRIMARY, waiting-confirm)` ＋ `showScreen(SECONDARY, customer-member{mode:'confirm'})`；**单屏**：`showScreen(PRIMARY, customer-member{mode:'confirm'})` |
| 7a | 副屏／主屏点「确认」 | `confirmMemberCommand` | `member-registry` | 会员入列表、清 `pendingMember` | `clearUiVariables{keys:['memberName','memberPhone']}` ＋ `showScreen(PRIMARY, member-list)`；**双屏**另加 `closeLayer(waiting-confirm)` ＋ `showScreen(SECONDARY, customer-welcome)` |
| 7b | 点「取消」 | `rejectMemberCommand` | `member-registry` | 清 `pendingMember` | `openLayer(PRIMARY, registry-notice)`；**双屏**另加 `showScreen(SECONDARY, customer-member{mode:'preview'})`；**单屏**另加 `showScreen(PRIMARY, member-form)` |
| 8 | 点「知道了」 | `dismissNoticeCommand` | `member-registry` | — | `closeLayer(registry-notice)`；**双屏**另加 `closeLayer(waiting-confirm)` ＋ `showScreen(PRIMARY, member-form)`（副屏不动） |
| 9 | 点「退出」 | `logoutCommand` | `staff-session` | 清 session slice | `clearLayers(PRIMARY)` ＋ `clearLayers(SECONDARY)` ＋ `sessionEstablishedCommand{authenticated:false}` → §6.1 |

**`install` 不设例外**（`TR-01` 原文）：场景 1 的 `install` **只 `dispatchCommand`**，
读 slice 与写状态一律在 actor 内完成。

**单屏／双屏分支只出现在 `member-registry` 的 actor 内**，判据是
`selectSecondarySurfaceAvailable(root)`。**部件内零分支。**

### 6.4 场景 5 的实时同步是零机制成本的

✅ 亲验 `variableSlices.ts` 第 183 行，变量 slice 按 `stateKeys[workspace]` 分区，
**只按 workspace，不按 displayMode** ⇒ 主副屏读同一变量天然同步，无需任何跨屏机制。
（**仅双屏形态可验**；单屏下无副屏。）

### 6.5 uiVariables 的两个持久化档位

| 变量 | `persistIntent` | 语义 |
| --- | --- | --- |
| `loginOperatorName` | **持久** | 记住上次登录的工号 |
| `loginPasscode` | **不持久** | 密码不落盘 |
| `memberName` / `memberPhone` | **不持久** | 登记表单值；场景 8 靠它「取消后数据仍在」 |

真实业务写每个变量都要回答「要不要落盘」，范本必须给出**两种答案的样例**。

✅ 亲验 `clearUiVariablesCommand` 的 payload 是 `{keys: readonly string[]}` —— **按 key 清，不是清全部**。
⇒ 场景 3 只清 `loginPasscode`，**必须保留 `loginOperatorName`**，否则「记住账号」失效；
场景 7a 只清两个登记表单变量。§6.3 已按此写死 key 列表，实施不得裸调 `clearUiVariables`。

⚠️ 与 session slice 中的 `operatorName` 区分：后者是**登录后的身份事实**（业务状态），
前者是**登录表单里的输入值**（界面变量）。两者同名不同物，实施时须用不同标识符。

## 7. 框架发现

### 7.1 TER 帮到忙的地方

| # | 发现 | 依据 |
| --- | --- | --- |
| A-1 | 场景 5 副屏实时镜像**零机制成本** | 变量按 workspace 分区，不按 displayMode |
| A-2 | 业务模块协作**依赖方向可以是对的** | `handlersByCommand` 是数组，一命令多 actor。⚠️ **但 handler 并行执行**（§6.2），故此能力**只可用于互斥动作**，有先后依赖时必须走因果链 |
| A-3 | 场景 8「取消后数据仍在」**自动成立** | 值在 uiVariables 而非组件 state |
| A-4 | 副屏**可交互**，框架无处假设 SECONDARY 只读 | `SurfaceRoot` 渲染普通组件，组件可 dispatch |
| A-5 | 「不知道有几块屏」**已被正确建模** | ✅ `displayDevice.ts` 的 `DisplayInfoRead` 是 `valid \| unavailable \| malformed` 三态联合。⚠️ 与 W-7 不矛盾：**读取**建模完备，缺的是**存放**位置 |

### 7.2 W-7 · 唯一要优化 TER 的一处（已裁定）

**缺陷**：✅ 亲验 `display-context` 只有 `displayRoleSlice` 一个 slice，
`displayCount` **从不入 state** —— 五个 actor 各自现查 `DevicePort`（1 秒超时）。
⇒ UI 无法据此渲染：查询是异步的，且 View 不得碰 port。**§3.1 的硬需求当前不满足。**

**判定为「该有的能力」**：`DevicePort`、`display-context` 均已建成，
单机双屏是 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 已裁定支持的形态。⇒ **优化 TER。**

**修复设计**（形态照抄 `powerStatusActor` / `installPowerStatusBridge`，零新机制）：

| 件 | 内容 |
| --- | --- |
| slice | `surfaceTopologySlice { localDisplayCount: number \| null }`，`null` ＝ 未探测到 |
| command | `displayTopologyChangedCommand({displayCount})`，定义在 `display-context`（它依赖 runtime，符合 `TR-11` 的定义点约束） |
| actor | 写 slice；**唯一写入点** |
| bridge | `installDisplayTopologyBridge(context)` 挂在 `install`；✅ 亲验 `createDisplayContextModule.ts` 第 57-62 行 install 里已在 dispatch 命令，路走得通 |
| 公开 selector | `selectSecondarySurfaceAvailable(root): boolean` ＝ `(localDisplayCount ?? 1) >= 2`。✅ 亲验本包已有 `src/selectors/selectDisplayRole.ts` 并公开导出 ⇒ **照抄现有形态，非新形态** |

**三条设计约束**：

1. **状态只有 `localDisplayCount` 一个字段，不加任何其它来源。** 本轮 Android 单机形态下副屏就是本机第二块屏，屏数即答案。将来若出现别的副屏来源，改的是这个 selector 的**实现**，签名不变 ⇒ 业务零改动。**现在不做投机结构。**
2. **`?? 1` 是安全降级**：未知 → 单屏。理由是第一性的 —— 单屏流程在双屏设备上**仍可用**（确认页占满主屏）；双屏流程在单屏设备上**会卡死**（顾客无处可点）。降级只写在这一处纯函数里，可测可变异。
3. **Web 测试宿主如何产生两种屏数**：`sample-console` 的 `test-expo` 端口表绑一个
   **按 URL 查询参数返回 `displayCount` 1 或 2 的 `DevicePort`**，缺省不带参数时返回 `unavailable`
   （与真实 Web 一致 ⇒ `?? 1` 降级为单屏）。
   ⚠️ 这是**平台绑定层**的正当职责，不是 hack —— 它恰好演示了端口注入点的价值，
   且**不触碰任何业务代码**。S-16 的双屏分支靠它可验。
4. **本轮只在 `install` 查一次，不做热插拔。** ✅ `DevicePort` 现有 `subscribePowerStatus` 但**无 display 对应订阅**（该不对称已登记在 `adapter/android/dual-screen/README.md`）。将来补 `subscribeDisplayStatus` 时，改动**全部落在 bridge 里**，并按 `TR-11` 加**播种与去重**；slice、selector、业务代码都不动。

### 7.3 观察项（已有能力的使用体验，实施后回答，**现在不预设计**）

| # | 观察 | 说明 |
| --- | --- | --- |
| W-1 | **一个业务动作要派 3–4 条 ui-state 命令，且模块间协作还要额外造中间命令** | 见 §6.3 场景 6/9 的 dispatch 串，以及 §6.1 为消除竞态而引入的 `sessionEstablishedCommand`。后者是**并行 handler 语义的连带成本**：凡有先后依赖就得造一条命令。是否难受，做出来再说；**现在不预设计解法** |
| W-2 | `clearLayers` 只清一个 displayMode | ✅ 亲验其 payload 为 `{displayMode}`。场景 9 必须派两次。可能缺一个「清全部」形态 |

### 7.4 本轮放下（明确还没建的功能）

| # | 事项 | 放下的理由 |
| --- | --- | --- |
| — | 双机 pair 拓扑 / 命令按拓扑路由 | peer 能力**还没建**。本轮 Android 单机形态下 surface 全部在同一 VM 内，不涉及路由 |
| — | 数据获取与加载态约定 | 依赖 `transport`，**还没建**。会员数据本轮存本地 slice ＋ persist |
| — | `ui/base` 通用对话框归属 | `primitives` **还没建**。`auth-notice` 与 `registry-notice` 本轮各归各包 |
| — | 副屏待机态需业务显式派 | **我判断不是缺陷**：Dexter 裁定过「容器有个 default 的空页面」，即容器空态兜底是设计内的；由此推出「业务显式派待机页属正常写法」是**我的推论，非他的裁定**。若你不认同可推翻 |

---

## 8. sample 的写法纪律（保留三条，均零成本）

| # | 纪律 | 理由 |
| --- | --- | --- |
| N-1 | part 的 `workspaces` / `instanceModes` **只声明本轮可达值**（`['MAIN']` / `['MASTER']`） | 第四版写「声明为全集」，与本轮「不为视野外的东西预留结构」冲突，且不可达值**无法被任何判据验证**（死声明）。第二刀开 `BRANCH`/`SLAVE` 时改一行，那时才有依据。**真正需要精确的维度是 `displayMode`** |
| N-2 | 业务只读 `selectSecondarySurfaceAvailable`，**不读 `displayCount`** | W-7 修复的配套；单机下也正确 —— 业务问的就是「有没有副屏」 |
| N-3 | **禁止任何平台判断决定屏数或布局**（`Platform.OS`、`typeof window`、UA 嗅探） | 屏数唯一来源是注入的 `DevicePort`。Web 是**测试宿主**：那里「默认单屏」应当是端口不可用 → `?? 1` 安全降级的自然结果，而不是被写死的平台分支。写死了，Android 上双屏就验不到同一段代码 |

> 命令的 `defaultTarget` 一律省略（`defineCommand` 省略即 `'local'`）。
> 不需要 peer 时业务本来就不会写 `target`，**什么都不做就是对的**，不必立为纪律。

---

## 9. 测试要求（前置说明，不得实施时再补）

### 9.1 归属

`sample-console` 拥有跨包集成行为测试（`REAL_TESTS` / vitest）；
两个 `kernel/feature` 包各自拥有 slice 与 actor 单元测试；
两个 `ui/feature` 包各自拥有 part 注册与 props 契约测试。

### 9.2 判据按场景编号，与 §3 / §6 一一对应

| # | 判据 |
| --- | --- |
| S-1 | 开机后主屏为登录页、**副屏为待机部件**，不得是 `container-empty` 兜底 |
| S-2 | 登录失败时 alert 层在场，且 session slice **未**变为 authenticated |
| S-3 | 登录成功后主屏为会员列表，**且该导航由 `member-registry` 监听 `sessionEstablishedCommand` 的 actor 发出**，而非 `staff-session` 直接派 —— §6.1 的可证伪形式 |
| S-4 | 进表单后副屏部件由 `customer-welcome` 换为 `customer-member`，props `mode` 为 `preview` |
| S-5 | **【双屏形态】** 主屏写入 uiVariable 后副屏部件读到同值 —— A-1 的可证伪形式 |
| S-6 | 提交后主屏列表在场、等待层在场、副屏为 `confirm` 形态，**三者同时成立** |
| S-7a | 顾客确认后会员进入列表 slice、等待层消失、副屏回待机 |
| S-7b | **【双屏形态】** standard 与 alert 两层同时在场，且 alert 排在 standard 之后。⚠️ 单屏下同时只有一层，验不到排序（§3.1） |
| S-8 | 关掉两层后回到表单，**uiVariable 中录入值仍在** —— A-3 与 V-4 的可证伪形式 |
| S-9 | 退出后**两个 displayMode 的层都被清空** —— W-2 的可证伪形式 |
| S-10 | 真实组装：真 `createRuntime` ＋ ui-state ＋ display-context ＋ 2 个 sample module，`status === 'started'` |
| S-11 | **真实 root 经 `selectScreen` 读出 `showScreenCommand` 写入的 placement** —— 头号目标 |
| S-12 | 重启后会员列表 slice 与 `loginOperatorName` 变量仍在、`loginPasscode` 与登记表单变量已消失 —— §6.5 两档 persistIntent 的可证伪形式 |
| S-13 | 10 个 binding 全为 unavailable/memory 时 S-1…S-9 全部成立 |
| S-14 | 五类兜底：`runtime-unavailable` 与 `container-empty` 运行时可达；其余三类由**测试构造坏 catalog** 覆盖，不在运行时页面放坏部件 |
| S-15 | 两个层部件不出现在 `selectAvailableParts('main', …)`；三个屏级部件按 context 正确出现 |
| S-16 | **单屏形态**：屏数为 1 时 `customer-member` 出现在 PRIMARY 且无等待层；屏数为 2 时出现在 SECONDARY 且 PRIMARY 有等待层。**同一部件、同一 props** |
| S-17 | **屏数未知时不崩**：`DevicePort` 返回 `unavailable` 时按 `?? 1` 降级为单屏，显式可断言，不抛错、不卡加载态 |

### 9.3 设计模式判据（与功能判据同等级，**不可为凑功能豁免**）

| # | 判据 | 手段 |
| --- | --- | --- |
| P-1 | sample 全部生产文件中 `dispatchAction` / `store.dispatch` / `useDispatch` **零命中**（`features/actors/**` 除外） | 禁止句（V-1） |
| P-2 | **部件文件中 `useState` / `useReducer` 零命中**（一刀切，本 sample 的 8 个部件均不需要 local state） | 禁止句 ＋ S-8（V-4）。⚠️ 第四版写「零命中**于表单值**」——**禁止句无法机械区分「表单值的 useState」与其它 useState**，那是把语义伪装成 checker。改为一刀切后才是真判据，且更严格 |
| P-3 | **`sample-*` 业务与集成源码中 `displayCount` 零命中**；`sample-console/test-expo/**` 的端口绑定层**除外** | 禁止句（N-2）。⚠️ 第四版未设例外，与 §7.2 约束 3 的 `DevicePort` 绑定**直接冲突** —— 那里必然出现 `displayCount` |
| P-4 | sample 源码中平台判断标识符**零命中** | 禁止句（N-3） |
| P-5 | 两个 `ui/feature` 包之间**零互相 import** | 依赖图（V-8） |
| P-6 | W-7 的 bridge 具备**播种与去重**；补订阅后首个事件不得派发 command | 焦点用例（V-9，`TR-11` 明载） |
| P-8 | **无竞态**：不存在「两个模块的 actor 监听同一命令、其中一方读取另一方本次写入的 slice」的形态 | ❌ review（§6.2）。红夹具：把 §6.1 的因果链改回「同听 `loginCommand`」，S-3 应变得不稳定 |
| P-7 | **V-2 / V-3 / V-5 / V-6 / V-7 逐条 review** | ❌ 不可机械判定，实施评审必须逐条书面回答 |

### 9.4 红向量要求

每条判据至少一条 **production red mutation**（改生产源码，**不改夹具**），
并验证 negative 变红、control 保持绿。沿用 `tools/terminal-ui-render/check-behavior.mjs`
已验证有效的三道自保：锚点出现次数恰为 1；mutation 前先跑 baseline；判红前先断言 focused test 收集数非零。

### 9.5 明确不作为测试手段

- ❌ 不以「人眼在浏览器里看过了」充当判据；
- ❌ S-10 / S-11 全链路禁止 mock `ui-state` 或 `runtime`；
- ❌ 不以 `expo start --web` 能启动充当行为证据；
- ❌ **不得以「门全绿」替代 §9.3 P-7 的逐条 review**。

---

## 10. 分刀

| 刀 | 内容 |
| --- | --- |
| **一** | 场景 1–9 全部 ＋ 单屏/双屏两形态 ＋ W-7 修复。Expo Web 上两个并排 `SurfaceRoot` |
| **二** | `instanceMode` / `displayRole` 切换、`workspace` 分区、切换资格 reasonCode |
| **三** | 真机 Android，adapter 逐个替换端口表 |

**范本不许有临时写法**：part 的 `displayModes` 从一开始写真实值、
`SurfaceRoot` 的 displayMode 参数化、任何地方不硬编码 `'PRIMARY'`。

**结构要求**：integration 必须导出「按 displayMode 取一棵可独立挂载的树」，每棵树自带
`RenderProvider`，而不是「一棵含两个 surface 的树」。

理由是 Android 侧的事实：`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 是**多个 Root Surface**，
Kotlin 按屏传不同 `initialProps`；RN 的每个 Root Surface 是**独立 React root**，
彼此不共享 context。⇒ 若按「一棵树含两个 `SurfaceRoot`」写（Web 上并排那种写法），
第三刀上真机时 integration 必须重写 —— 那正是范本不许有的临时写法。

✅ render 支持这一形态：`RenderProvider` 只接收 `stateSource` 三件套，
同一个 runtime 可以喂多个 Provider，各自持有自己的 snapshot reader 与诊断 reporter。

## 11. 本稿性质

讨论稿。未经 Dexter 确认前不转正式需求文档，不构成设计或实施授权。
标 ✅ 的事实均为本次会话打开源码亲验；未标注者为设计建议或推论。
§7.3 的「实施后回答」是**有意留白**，不在本稿预先设计解法。
