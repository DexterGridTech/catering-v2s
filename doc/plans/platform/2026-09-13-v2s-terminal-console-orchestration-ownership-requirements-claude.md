# sample 治理(第一轮:编排职责归位) · 需求分析

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Claude
PROGRAM=sample 治理 —— 抽 base 的前置立项(拆分原因见 §0.1)
ROUND=1/N;本轮只做 G-1~G-5,其余候选在 §0.3 登记
SCOPE=ui/feature/sample-member-desk, ui/feature/sample-staff-auth, ui/integration/sample-console, TR-12
SCOPE_RULE=修复落点全在 sample 包内的做;需动 kernel/base 或 ui/base 的留给抽 base(§0.2)
EVIDENCE_TIER=static;未执行任何命令
AUTHORITY=需求分析,不是实施授权
```

## 0. 立项

### 0.1 这个立项是怎么来的(Dexter 2026-09-13)

> 做这件事情的原因,是因为我们最初提到抽 base 的事情,但是发现 sample 里有很多不合理的地方,需要治理,但是会扩大抽 base 立项的范围,又导致立项范围太大 review 一直通不过。那我就觉得先把 sample 治理的事情提前,先做完。然后再抽 base。

**所以本文不是"给 integration 加 actor 和 slice"的立项,是 `sample` 治理立项。** actor + slice 只是其中一项治理动作的结果,不是目的。

事实佐证这个判断:上一版 base 抽取文档(REVISION=2)被三轮 fresh 独立对抗审查推翻,其中一条根因就是范围里混进了治理动作,而治理动作各自缺证据。**拆开之后,两边都能各自收口。**

### 0.2 范围规则(本轮防止再次膨胀的唯一手段)

一条,可机械判定:

> **修复落点全部在 sample 包内的,本轮做;需要动 `kernel/base` 或 `ui/base` 的,留给抽 base。**

sample 包 = `kernel/feature/sample-*`、`ui/feature/sample-*`、`ui/integration/sample-console`、`assembly/android/sample-terminal`。

推论一条:**本轮不新增、不修改任何 base 包的公共面。** 一旦某项治理发现"非改 base 不可",那就是它属于下一个立项的证据,本轮原地登记、不做。

### 0.3 治理候选全集与本轮取舍

我在上一轮 base 分析里已经把 sample 全量读过,下面是全部候选。**取舍按 §0.2 一条规则,不按我的偏好**:

| # | 不合理之处 | 证据 | 修复落点 | 本轮 |
|---|---|---|---|---|
| G-1 | 会员交互包越域编排:`createDeskNavigationActor` 四个 handler 全由 `staff-session` 命令驱动 | §1.2 | `member-desk` + `sample-console` | **做** |
| G-2 | 两个交互包同时往 PRIMARY 写,无人仲裁 | §1.3 | 同上 | **做** |
| G-3 | 交互包在 actor 里做设备 I/O 问显示拓扑,12 处 | §1.4 | 4 处在本轮内;**8 处须 `display-context` 先拥有拓扑** | **做 1/3**,余下转抽 base(§4.3) |
| G-4 | 会员交互包直接派发 `staff-session` 的 `logoutCommand` | §1.1 | `member-desk` + `sample-console` | **做** |
| G-5 | `assembly.tsx` 389 行,编排/诊断/JSX/装配混在一处 | 上一版 §3.2 | `sample-console` | **部分**:G-1~G-4 落地后编排自然剥离;诊断与 JSX 不动 |
| G-6 | 两份逐字相同的 `tailwind.config.cjs`;`assembly/android/sample-terminal` 的那份零测试覆盖 | 上一版 D-3 | sample 包 + `tools/` | **不做**,转第二轮(D-1) |
| G-7 | `baseModuleDescriptors.ts` 伪造三个 descriptor;两个交互包各手写一份排除清单 | 上一版 D-5 | **必须改 `kernel/base` 的依赖声明契约** | **不做**,按 §0.2 属抽 base |
| G-8 | `SurfaceForm` 等类型三处声明 | 上一版 D-1/D-2 | 两处在 `kernel/base/ui-state` 与 `ui/base/dev-host` | **不做**,按 §0.2 属抽 base |
| G-9 | `displayIndex → surfaceKey` 映射两处 | 上一版 D-4 | 正本应落 `display-context` | **不做**,按 §0.2 属抽 base |

**G-6 为什么不做(裁决 D-1,见 §8)**:它的修复落点确实全在 sample 包与 `tools/`,按 §0.2 的规则合格。但它与 G-1~G-5 **没有任何共同根因**——那五条是同一个病(编排职责错位),G-6 是主题配置重复。一轮里塞两个独立根因,reviewer 就得独立验两件事,而这正是上一个立项过不去的机制。

**归属定死:G-6 转 sample 治理第二轮,独立收口。** 不并入抽 base——它的修复不碰任何 base 包,并进去反而又把抽 base 的范围撑大,重蹈覆辙。也因此它**不阻塞抽 base**:两者无依赖,谁先做都行。

### 0.4 本轮的实质:一个病,五个症状

G-1~G-5 是同一件事的五种表现:**"谁在什么时候占据哪块屏"这个决定,今天散落在两个交互包里,没有归属。**

按 Dexter 定的名:

| 层 | 定名 | 回答的问题 |
|---|---|---|
| `kernel/feature/*` | **service(服务)** | 系统**能做什么**——与后台交互、业务判断、业务状态 |
| `ui/feature/*` | **交互** | 一个人**怎么用它**——呈现、单 service 内的跳转、提示 |
| `ui/integration/*` | **编排与协调** | 多 service × 多交互,**谁在什么时候占据哪块屏** |

治理动作一句话:**把跨 service 的决定从交互层收回编排层。**

### 0.5 关于"现在 sample 太小,编排层没什么可编排"

Dexter 已回答:

> 当前的 sample,有两个 kernel feature (service),两个 ui feature(交互),一个 integration。这种情况下 integration 没什么好编排的。但是后面有很多个 service、很多个交互的时候,integration 就会需要做各种编排和协调了。**所以不用纠结是不是为了有了再改。**

我的执行边界据此定为:**职责现在就归位,机制有多少证据做多少。**

| 现在就做(职责归位) | 现在不做(为规模预建机制) |
|---|---|
| 把**已经存在**的编排逻辑从交互包搬进编排包 | 造 service/交互注册表、插件机制 |
| 编排包拥有自己的 actor 与 slice,承载 surface 分配 | 设计通用编排 DSL 或路由配置层 |
| 交互包不再需要知道别的 service 存在 | 为"未来很多 service"预留扩展点、抽象基类 |

判据:**搬动一段今天就存在的代码 = 职责归位,做;新增一个今天没有调用者的抽象 = 预建机制,不做。**

⚠️ 我前两版反复拿 TR-09 的"不得造占位 slice"质疑编排包该不该有 slice。Dexter 已听过该顾虑并裁定推进,本文不再重复,相关论证段落已删减。

### 0.6 为什么必须排在抽 base 之前

除了 §0.1 的"范围太大"这个直接原因,还有一条技术上的单向因果:

```
编排逻辑还缠在交互包里  →  分不清哪些是"会员业务"、哪些是"任何终端都要的通用能力"
                       →  抽 base 只能靠猜
结构摆正后             →  通用的那部分自己浮出来  →  才谈得上抽
```

最直接的一例:`hasSecondarySurface` 今天长在 `member-desk` 的 actor 里,在那儿它看着像"会员台的一个工具函数",**上一版 base 分析里它根本没进候选清单**。一旦挪到编排层,它立刻显出本来面目——显示拓扑查询,而那是 `display-context` 的事。**不搬,就永远看不出它该去 base。**

§7 列出本轮预期为抽 base 产出什么。

## 1. 现状实测

### 1.1 ⚠️ 一个与预设不同的事实:两个 ui/feature 之间没有互相引用

我把三个包的跨包 import 全部列过。**`sample-member-desk` 与 `sample-staff-auth` 彼此零引用**——双向都没有,连类型都没有。

所以"feature 之间尽量少引用"这个目标,在**字面意义上今天已经满足**。真正的耦合在另一条路径上:

```
sample-member-desk  ──→  kernel/feature/sample-staff-session   ← 会员域的 UI 伸进了员工会话域
                         (它自己的域是 sample-member-registry)
```

具体两处(`member-desk` 侧):
- `features/actors/actors.ts:14-20` — import 了 staff-session 的 5 条命令;
- `components/MemberList.tsx:1` — import 了 `logoutCommand`,登出按钮直接派发。

`sample-staff-auth` 引用 staff-session 是**正当的**:那是它自己的域。

**结论:本轮要解的不是"feature 互相引用",是"feature 越域编排"。** 下面三条是它的具体表现。

### 1.2 表现一 · 一个 UI feature 全靠别人的域命令驱动导航

`createDeskNavigationActor`(`member-desk/actors.ts:82-106`)**四个 handler 全部**由 staff-session 命令触发,且全部决定两块屏幕放什么:

| 触发命令(staff-session 域) | member-desk 的动作 |
|---|---|
| `loginSucceeded` | PRIMARY ← `desk.member-list`;有副屏则 SECONDARY ← `desk.customer-welcome` |
| `sessionRestoredAuthenticated` | 同上 |
| `logoutSucceeded` | 清 PRIMARY 层;有副屏则清 SECONDARY 层并 ← `desk.customer-welcome` |
| `sessionRestoredAnonymous` | 有副屏则 SECONDARY ← `desk.customer-welcome` |

"员工登录成功之后这台终端显示什么"**不是会员业务的知识**。换一个 console(自助点单机、KDS),登录后该显示什么完全不同,而这个答案今天写死在 member-desk 里。

### 1.3 表现二 · 两个 feature 同时往 PRIMARY 写,没有任何一方拥有仲裁权

两个包各有一个 navigation actor,监听**同一批** staff-session 命令:

| 命令 | `staff-auth` 做什么 | `member-desk` 做什么 |
|---|---|---|
| `loginSucceeded` | 写 `operatorName` 变量、清 PRIMARY 层 | PRIMARY ← `desk.member-list`、SECONDARY ← `desk.customer-welcome` |
| `logoutSucceeded` | 清 PRIMARY 层、PRIMARY ← `auth.login` | 清 PRIMARY 层、清 SECONDARY 层、SECONDARY ← `desk.customer-welcome` |
| `sessionRestoredAnonymous` | PRIMARY ← `auth.login` | SECONDARY ← `desk.customer-welcome` |

**并发事实(已亲验)**:`createCommandDispatcher.ts:538-545` 用 `await Promise.all(handlers.map(...))` 跑同一命令的全部 handler。各 handler 内部还有多次 `await context.dispatchCommand(...)`,因此它们的内部派发**会交错**,注册顺序不构成执行顺序保证。

⚠️ **我没有发现今天存在实际错屏。** 两包事实上分了工——登出态 PRIMARY 归 auth,登入态归 desk,`clearLayers` 只清浮层不动 screen(`contentActors.ts:280-286`),而且重复 `clearLayers` 的 no-op 返回 `{changed:false, persistenceStatus:'succeeded'}`(`completeWrite.ts:17-23`),不会让命令判失败。

**所以问题不是"今天坏了",是"今天的正确性靠一条没写下来、没有门、两个互不知情的包各自遵守的约定"。** 加第三个 feature、或改任一方的 handler,都没有任何东西会报警。

### 1.4 表现三 · UI feature 在 actor 里做平台 I/O 问显示拓扑

`member-desk/actors.ts:45-46`:

```
const hasSecondarySurface = async (context) =>
  resolveSecondarySurfaceAvailable(await readDisplayInfo(context.platformPorts.device))
```

它在该文件里被调用 **12 次**(`:85,90,95,103,117,139,156,167,186,191,199,207`)——几乎每个导航 handler 一次。

三重错位,每一重都可独立成立:
1. **职责**:"这台终端有没有副屏"是显示拓扑知识,不是会员业务知识;
2. **形态**:每次导航都发起一次设备读,而这个答案在一次会话内几乎不变;
3. **范围**:`member-desk` 是**唯一**在 actor 里调 `readDisplayInfo` 的 ui/feature(全仓核过;`staff-auth` 一次都没有,其余调用点都在 `display-context` 自己和 `dev-host` 内)。

## 2. 目标边界

按 §0.1 的三个词,一句话:**交互层管"我长什么样",编排层管"谁上台、上哪块屏、什么时候换人"。**

判据是**跨不跨 service**:一段逻辑只要涉及两个 service,或涉及"整台终端此刻是什么状态",它就不属于任何一个交互包。

| 问题 | 归属 | 理由 |
|---|---|---|
| 登录失败怎么提示 | 交互(`staff-auth`) | 单 service 内的呈现决定,换个交互场景答案就不同(TR-12 原意,不变) |
| 会员提交后表单→等待→列表 | 交互(`member-desk`) | 全程只碰 `member-registry` 一个 service |
| **员工登录成功后这台终端显示什么** | **编排(`sample-console`)** | 触发来自 `staff-session`,结果落在 `member-desk` 的画面上——**横跨两个 service**,没有任何单个交互包有权决定 |
| **副屏归谁用、什么时候给** | **编排** | 同上,而且是整台终端的资源分配 |
| **这台终端有没有副屏** | **编排** | 显示拓扑,一个 service 都不属于,更不是业务知识 |

⚠️ 表里三条"编排",**今天全部写在交互包里**——这正是 §1.2 / §1.3 / §1.4 三条实测。

## 3. TR-12 修订案

### 3.1 为什么必须改

TR-12 第 3 条今天的原文(`terminal-coding-standard.md:481-482`):

> **`ui/feature` 必须有自己的 module 与 actor** —— 「失败了该怎么呈现」「成功后跳哪里」每种交互场景答案不同,只能由 UI 侧承接。`partKey` 自始至终不离开拥有它的 `ui/feature` 包。

**「成功后跳哪里」这一句,正是 §1.2 那四个 handler 的授权来源。** 规范把跨域交接判给了 ui/feature,于是 member-desk 必须知道"员工登录 = 显示会员列表"。不改这一句,§1.2 就改不掉。

### 3.2 ⚠️ 先更正本文 v1 的一处错误:partKey 的约束范围

本文初稿写了"`partKey` 字面量不得出 `ui/feature` 包,所以 integration 要通过具名入口句柄编排",并据此设计了一套 `staffAuthEntries` / `memberDeskEntries` 导出机制。**这是错的,已删除。** 更正依据(Dexter 2026-09-13 指出后核实):

- TR-12 的门写得很明确,作用域只有 kernel(`:506-508`):
  > ① `kernel/feature/**` 生产源码中 `partKey`/`containerKey`/`displayMode` 字面量零命中;② `kernel/feature/*/package.json` 的 dependencies 中 `ui/*` 包零命中。
- 负控制更是反过来的(`:513`):**`ui/feature` 的 actor 里出现 `partKey` ⇒ 绿(那是它自己的部件)**。
- 整份 `terminal-coding-standard.md` 里 `ui/integration` **只出现 1 次**(`:471` 那张 1:N 表的一行),**没有任何一条针对 integration 的 partKey 约束**。
- `tools/` 下也**根本不存在** partKey 相关的门(核过,零命中);连 kernel 那条都是 review 规则,`:516-518` 自己写明"门只抓字面量与依赖",几种绕法"都抓不到"。

`:482` 那句"自始至终不离开拥有它的 `ui/feature` 包"孤立读起来确实像全域禁令,但它自己的门与负控制把范围定死在 kernel。**我读宽了一句话的作用域,然后为这个不存在的约束发明了一层间接。**

**修正后的结论**:`ui/integration` 直接书写 partKey 字面量**没有任何规则禁止**,而且合理——integration 就是组合层,它本来就已经 import 了两个 feature 包的 `parts`。本文因此**不引入任何句柄机制**:console 的编排 actor 直接写 `partKey`。将来若真出现改名维护痛点,feature 的 part 句柄今天已经导出,改成读句柄是逐点一行的事,不必现在预先抽象。

### 3.3 改后条文

第 3 条拆成 3a / 3b,**partKey 那一句不动**:

> **3a. `ui/feature` 必须有自己的 module 与 actor** ——「失败了该怎么呈现」「在本 feature 已获分配的 surface 内部,从自己的一个画面走到另一个画面」每种交互场景答案不同,只能由 UI 侧承接。
>
> **3b. 跨 service 的决定只能归 `ui/integration`** ——「哪个交互占据哪块 surface」「何时换人」不属于任何单个交互包:它要么得知道别的交互存在(违反自闭环),要么得替整个应用做产品决定(超出它的 service 域)。
>
> 因此:**一旦存在跨 service 的决定,它必须由 `ui/integration` 的 module / actor / slice 承接,不得下放给任何 `ui/feature`。** `ui/integration` 监听各 service 的域事件命令并做 surface 分配;**它书写被组合交互包的 `partKey` 是正常用法**。
>
> **3c(原第 3 条末句,措辞收紧)**:`partKey` / `containerKey` / `displayMode` 字面量**不得出现在 `kernel/feature` 包中**。

**`:482` 的措辞收紧(裁决 D-3,见 §8)**:原句「`partKey` 自始至终不离开拥有它的 `ui/feature` 包」的字面范围比它的执行范围宽,我本人就是被它误导的。改为 3c 的写法。

**这不是把规则改宽以迁就我的失误——TR-12 这条规则的三层全是 kernel 作用域**,逐层核过:
- **门**(`:507`):`kernel/feature/**` 生产源码中零命中;
- **负控制**(`:513`):`ui/feature` 的 actor 里出现 `partKey` ⇒ **绿**;
- **门抓不到、只靠 review 的那三种绕法**(`:516-518`):「把 partKey 存进 **kernel** 的 slice 再读出来」「用字符串拼接构造 partKey」「**kernel** 依赖一个中间常量包转手」——三条里两条明写 kernel,第三条夹在中间。

即规范从可执行的门到只靠 review 的补充条款,**没有任何一层把范围延伸到 `ui/feature` 之外的包**。`:482` 是单纯的措辞宽于实质。

## 4. 三个包的改造设计

### 4.1 `sample-console` 新增 actor:`console-surface-plan`

承接 §1.2 那四个 handler,以及 `staff-auth` 中同样属于跨域交接的部分:

```
defineActor('ui.integration.sample-console', 'console-surface-plan', [
  onCommand(staffLoginSucceededCommand,              → 分配 PRIMARY=desk 入口, SECONDARY=desk 顾客入口)
  onCommand(staffSessionRestoredAuthenticatedCommand, → 同上)
  onCommand(staffLogoutSucceededCommand,             → 分配 PRIMARY=auth 入口, SECONDARY=desk 顾客入口)
  onCommand(staffSessionRestoredAnonymousCommand,    → 同上)
])
```

`sample-console` 今天已经依赖 `kernel-feature-sample-staff-session`(`dependencies.ts:6`),**不新增包边**。

### 4.2 `sample-console` 新增 slice:`ui.integration.sample-console.surface-availability`

⚠️ **本节是修订后的版本。初稿设计的 slice 含 `allocation`(每块 surface 当前分配给哪个入口)字段,已删除。** 原因是规范 **4-B**(`terminal-coding-standard.md:621-627`)明文禁止"导航镜像状态":

> 页面/Tab/面板"当前选中的是哪个 screen"的事实源统一是 UI runtime 的 `screen` slice。业务 slice **不得**新增 `selectedTab`/`currentPage`/`activeScreen` 这类导航镜像状态。
> **为什么**:这是"崩溃/被关闭后重启能恢复原状"能成立的机制性原因——**当前在哪一页只有一个真相源**。有第二份镜像,恢复就会出现"页面对了但 tab 不对"。

我初稿用"因与果"替 `allocation` 辩护(content 存渲染结果、allocation 存交给了谁),现在判定**这个辩护不成立**:4-B 的理由不是"语义层级",是**重启恢复时只能有一个真相源**。`allocation` 无论持久化与否都会在重启路径上与 ui-state 的 screen 产生第二份真相——持久化则两份都恢复可能冲突,不持久化则由会话命令重放重算、会覆盖已恢复的画面。**这正是 4-B 说的"页面对了但 tab 不对"。**

**修订后 slice 只持有一项:**

| 字段 | 内容 | 为什么归 console |
|---|---|---|
| `surfaceAvailability` | **本 console 声明的每块 surface,当前是否可用** | 它是两个事实的合成:"我声明了哪些 surface"(来自本包 `terminalSurfaces`,是 app 知识)× "设备现在有几块屏"(来自 `display-context` 的 `readDisplayInfo`)。**合成结果只有 console 知道**,今天不在任何 state 里,每次现读设备(§1.4) |

它不是导航镜像:它描述**设备能力**,不描述"当前在哪一页",与 4-B 无关。

**它也不会在抽 base 之后被删掉**:`display-context` 将来即使拥有设备侧拓扑,"我声明了哪些 surface"那一半仍是 app 的,合成仍在 console。**不是一个排期待删的东西。**

### 4.3 `sample-member-desk` 的收缩

| 动作 | 对象 | 之后 |
|---|---|---|
| **删除** | `createDeskNavigationActor` 整体(`actors.ts:82-106`) | 由 §4.1 承接 |
| **部分删除** | `hasSecondarySurface` 的 **4 处**调用(`actors.ts:85,90,95,103`)随导航 actor 一起移走 | 移入编排 actor,改读 §4.2 的 selector |
| **保留(本轮修不掉)** | 另外 **8 处**调用(`actors.ts:117,139,156,167,186,191,199,207`)及 `hasSecondarySurface` 本体 | ⚠️ 见下方"G-3 只能完成三分之一" |
| **改写** | `actors.ts:183` 的 `dispatchCommand(staffLogoutCommand)` | 改派发自己的 `deskExitRequestedCommand`,由 console 决定"离开会员台"是不是等于登出 |
| **改写** | `MemberList.tsx:1` 的 `logoutCommand` 直接派发 | 同上 |
| **保留** | 其余 6 个 actor、12 个 handler | 域内跳转,合 TR-12 改后 3a |

⚠️ **G-3 只能完成三分之一,初稿是过度承诺,此处更正。** 初稿写"member-desk 改读 `surface-plan` selector"——**结构上不可能**:`skeleton-graph.ts:176` 有 `ui.integration.sample-console → ui.feature.sample-member-desk` 边,member-desk 反向读 console 的 slice 会成环,`tools/terminal-skeleton/check-static.mjs:65,206` 的 `assertAcyclic` 直接红。

要让两边都能读同一份拓扑事实,它必须住进两边共同的上游 = `kernel/base/display-context`(member-desk 已依赖它,`skeleton-graph.ts:154`)。**按 §0.2 的范围规则,那属于抽 base 那一轮。** 本轮只能带走随导航 actor 迁移的那 4 处;**剩下 8 处继续现读设备,并在 §7 登记为抽 base 轮的明确输入。**

改完后 `member-desk` 对 `kernel-feature-sample-staff-session` 的依赖**降为零**,`dependencies.ts:6` 一并删除。**这是本轮"自闭环"的可验收判据**:`member-desk` 的 import 里不再出现 `staff-session`。

### 4.4 `sample-staff-auth` 的收缩

| 动作 | 对象 | 之后 |
|---|---|---|
| **拆分** | `createAuthNavigationActor`(`actors.ts:50-67`) | `loginSucceeded → setUiVariables(operatorName)` 是本域的,**留下**;`logoutSucceeded / sessionRestoredAnonymous → showLogin` 是"PRIMARY 交给谁"的决定,**移交 §4.1** |
| **保留** | `createAuthResultActor`、`createAuthNoticeActor`、`createAuthSystemNoticeActor` | 全是"我自己怎么提示",合 3a |

`staff-auth` 对 `staff-session` 的依赖**保留**——那是它自己的域,不是越域。

**两个 feature 的对外导出形态不变。** 初稿曾要求它们各导出一张具名入口表供 integration 引用,按 §3.2 的更正,那层间接没有依据,已删除。

## 5. 明确不做

| 不做 | 理由 |
|---|---|
| 抽 base(原 E-1~E-5) | 按 §0.1 拆分,它是本轮的下游立项 |
| G-6~G-9 四项治理候选 | 按 §0.2 的范围规则判出本轮之外,已在 §0.3 逐项登记,不是遗漏 |
| 任何 base 包的公共面改动 | §0.2 推论:一旦发现"非改 base 不可",那正是它属于下一立项的证据 |
| 新建 `sample-console-2` / `member-desk-2` | 它们是**校验方向的思想实验**,不是要交付的代码 |
| 把 `member-desk` 对 `member-registry` 的依赖也切断 | 那是它自己的域。切断它等于让 UI 不能有业务,与 TR-12 的 1:N 相反 |
| 运行期 surface 增删的完整支持 | §4.2 已说明今天无信号源。slice 留出位置,不在本轮实现响应逻辑 |
| 给 `surface-availability` 加持久化 | 它是设备当前能力,重启必须重新探测,持久化只会带来陈旧值 |
| 在 console 里记录"哪块屏当前给了谁" | 规范 4-B 禁止的导航镜像状态,详见 §4.2 |

## 6. 影响面与验收

**源码**:三个包的 actor 层;`member-desk/dependencies.ts`;`sample-console` 新增 module 的 slice/actor/commands 各一处;`skeleton-graph.ts` 中 `ui.feature.sample-member-desk` 的依赖项减少一条。

**`sample-console` 声明成 owner——这是改一个值,不是突破一条规则。** 初稿把它写得像要克服什么约束,更正:**规范里没有任何一条说 integration 必须是 toolkit**。TR-09 只要求每个包声明 owner 或 toolkit 二选一,对 integration 一字未提;`skeleton-graph.ts:165` 的 `plannedKind: 'toolkit'` 就是 skeleton 期的当前值,`plannedKind` 这个字段本身的定义就是"还没落真实 slice 时的临时声明"。

落第一个真实 slice 时同步两处即可:graph 条目删掉 `plannedKind`,包内导出 `moduleKind = 'owner'`(照 `member-desk/src/moduleName.ts:2`)。漏做任一处,`tools/terminal-skeleton/graph-model.mjs:132-138` 会抛 `has a real state slice but still declares plannedKind` 或 `real state slice requires moduleKind owner`。**已有门就能证伪,不必新增。**

**测试**:`member-desk/test/memberDesk.test.tsx`、`staff-auth/test/staffAuth.test.ts` 中覆盖导航的用例会失效(断言的行为搬走了),须改写为在 `sample-console/test/sampleAssembly.test.tsx` 里验证跨域交接;`packageSurface.test.ts` 因公共面变化须同步。

**可验收判据(可证伪,不是关键词匹配)**:
1. `member-desk` 全包 import 中不再出现 `kernel-feature-sample-staff-session`;
2. `staff-auth` 与 `member-desk` 的 actor 中不再出现对方域或跨屏分配的决定(逐 handler 对照 §4.3 / §4.4 的表);
3. 登录→列表→登出这条完整旅途的断言,全部落在 `sample-console` 的测试里通过;
4. `readDisplayInfo` 在 `staff-auth` 中零调用;在 `member-desk` 中由 12 处降为 8 处(**不是零**,理由见 §4.3)。

## 7. 本轮为"抽 base"产出什么

按 §0.3,这是本轮真正的验收项。重构完成后,下列判断**从"靠猜"变成"看得见"**:

| 重构后露出来的东西 | 它为抽 base 回答了什么 | 与上一版 base 文档的关系 |
|---|---|---|
| `hasSecondarySurface` 集中到编排层的一处 | 它不是业务工具,是**显示拓扑查询**。归属问题立刻变成"要不要进 `display-context`",而不是"要不要从 member-desk 抽走" | 它当时**根本没进候选清单**——因为长在 feature 包里,看着像业务代码 |
| surface 分配从 `if` 分支变成 actor + slice | "分配机制"与"分配策略"分开:机制(怎么把一块屏交给一个入口)可能是 base 候选,策略(登录后交给谁)永远是 app 的 | 当时无法评估,因为没有形状可看 |
| `assembly.tsx` 卸掉编排职责后剩下什么 | 上一版 E-3 / E-4(runtime↔render 适配、host source 解析)是否真的是那里仅剩的非业务物 | 直接检验 E-3 / E-4 这两项——它们是三轮审查唯一没被推翻的候选 |
| 编排包的公共面稳定下来 | `SurfaceForm` 一族类型(上一版 E-1)的真实消费形态 | E-1 当时的归属论证建立在"谁 import 了它",重构后消费方会变 |

**已经提前兑现的一条(本轮设计过程中就产出了)**:`display-context` 必须拥有"本机有几块屏"的拓扑事实,并以 selector 对外提供。依据是 §4.3 那条成环证明——`member-desk` 与 `sample-console` 都要读它,而两者之间已有单向边,所以它只能住在共同上游。**这是抽 base 轮的一条带证据的确定输入,不是候选。** 上一轮 base 分析里它根本没出现过。

⚠️ **本表是预期,不是承诺。** 其中任何一条在重构后没有兑现,都应如实记为"该论点不成立",不得反过来为了凑这张表去调整设计。

## 8. 裁决记录

> Dexter 2026-09-13:「待我决策,全部由你以最优最长远的方向来决策。」
> 三项均由 Claude 决定,依据与可推翻条件逐条列在下面。**这些是我的判断,不是 Dexter 的裁定**;后续任何一条被推翻,不影响其余两条。

### D-1 · 范围切口:本轮 G-1~G-5,G-6 转第二轮

**决定**:本轮只做 G-1~G-5;G-6(主题配置重复)转 sample 治理第二轮独立收口,**不并入抽 base**。

**为什么不是"顺手一起做"**:G-6 规则上合格、体量也小,单看是该带上的。但本立项存在的原因(§0.1)就是上一轮范围过大导致 review 反复不过——**那说明真正稀缺的不是轮次,是"一轮只验一件事"的可审性**。一轮里放两个独立根因,reviewer 必须独立验两遍,通过率按乘法掉。省一轮换来通过率下降,长期是亏的。

**为什么不并入抽 base**:G-6 的修复不碰任何 base 包。并进去只会把抽 base 的范围又撑大一次,正是要避免的事。两者无依赖,**G-6 不阻塞抽 base**,谁先做都行。

**可推翻条件**:若第二轮迟迟排不上,且 G-6 的零测试覆盖导致真实渲染事故,则该判断应重估——但重估的方向是"提前第二轮",不是"塞进本轮"。

### D-2 · TR-12 改后 3b 的模态:两个选项都不采用,取第三种

我原本给的两个选项分别是「`ui/integration` **必须**拥有 module/actor/slice」和「**存在跨域交接时才必须**」。**两个都有毛病,都不采用:**

- 无条件"必须":未来一个只挂载单个交互、确实无可编排的 integration 包,会被逼出占位 slice——**正是 TR-09 明文禁止的东西**,规范自相矛盾;
- "存在时才必须":听着稳妥,但它只约束了"有编排时要有地方放",**没有禁止把编排放到别处**。而本轮治理的这个病(G-1~G-5),恰恰就是编排被放进了交互包。这条规则写了等于没写,拦不住它自己要治的病。

**采用的第三种**:把规则从"integration 必须有什么"翻转成"**跨 service 的决定不许去哪儿**"——

> 一旦存在跨 service 的决定,它必须由 `ui/integration` 的 module / actor / slice 承接,**不得下放给任何 `ui/feature`**。

三个好处:① 直接命中本轮要治的病,规则自带执行对象;② 无编排时不强制任何结构,不产生占位;③ 它是关于**禁止去向**的规则,review 时问"这段决定跨不跨 service"即可判定,不依赖数 slice。

**可推翻条件**:若出现一种跨 service 决定,放在 integration 反而比放在某个 ui/feature 更差——目前想不出,但这是该规则的证伪形式。

### D-3 · 收紧 `:482` 的措辞:做

**决定**:`:482` 改为「`partKey` / `containerKey` / `displayMode` 字面量不得出现在 `kernel/feature` 包中」(即 §3.3 的 3c)。

**为什么这不是"让规范迁就我的阅读失误"**:我逐层核过 TR-12 这条规则的全部三层——可执行的门(`:507`)、负控制(`:513`,明写 ui/feature 里出现 partKey ⇒ 绿)、以及门抓不到只靠 review 的三种绕法(`:516-518`,三条里两条明写 kernel)。**没有任何一层把范围延伸到 `ui/feature` 之外。** 所以这是让字面追上实质,不是改动实质。

**为什么值得改而不是留着**:一条字面宽于执行范围的规则是陷阱。我读错它,直接后果是本文初稿发明了一整套不存在需求的句柄机制(§3.2)。下一个读者——人或 AI——大概率重犯同样的错,而且未必有人当场指出来。

**可推翻条件**:若 `:482` 的宽措辞是**有意**的、承载着某条尚未写进门与反例栏的 review 意图,则应改为把那条意图补写清楚,而不是收紧措辞。我在仓内没有找到这样的意图记录,但这是负面结论,证据强度弱于前两条。

---

**本文仍不含详设。** 范围既定,下一步是 actor / slice / 命令的逐项详细设计。
