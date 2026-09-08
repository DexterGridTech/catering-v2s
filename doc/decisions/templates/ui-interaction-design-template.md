---
title: UI-bearing Journey 交互设计工件模板
status: TEMPLATE_PROPOSED_FOR_CLAUDE_REVIEW
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# 交互工件：<JOURNEY_ID> <名称>

> 前置条件：对应 Journey 裁决已由 Dexter 接受，且其中每项 actor 前提不是未决外部前提。
> 使用时复制本模板为一个新的 reviewable artifact。低保真线框须先交 Dexter 看图，
> 再写 implementation-facing design；它不是视觉稿或组件库规范。

## 1. 工件元数据

```text
JOURNEY_DECISION=<repo-relative path#unique anchor>
BUSINESS_REQUIREMENT_SOURCE=<repo-relative path#unique anchor>
BUSINESS_PROBLEM=<要解决的用户业务问题，不写技术症状>
BUSINESS_USER_OR_OWNER=<受影响的业务用户或业务 owner>
CURRENT_TASK=<本 Journey 在解决的当前业务任务>
SUCCESS_OUTCOME=<用户可观察到的成功结果>
UI_BEARING=true
SKILL_USED=NONE | cs-brainstorming@<frozen-vendor-sha256>
DEXTER_WIREFRAME_REVIEW=UNSET | ACCEPTED | REVISE
DEXTER_HIFI_REVIEW=NOT_REQUIRED | UNSET | ACCEPTED | REVISE
CONSUMER_FACE=<platform-admin | operations-admin | public>
```

<a id="ui-detailed-design-admission"></a>

## 1.1 UI 详设强制标准（不可省略）

每个 user-facing screen、弹出面和可触发控件都必须在本工件中单独声明下列各项；缺少其中任何
一项的 screen 不得进入 implementation-facing design：

```text
CONSUMER_FACE=<platform-admin | operations-admin | public>
UI_SURFACE=<独立页面 | 内容页 | 内容 Tab | Drawer | Modal | Popover | Header 控件 | 侧栏底部控件 | 表单控件>
HOST_AND_ENTRY=<路由、宿主页面/壳层位置、打开控件和进入条件>
ACTOR=<业务角色的用户称谓，不写技术 principal/type>
BUSINESS_SCENARIO=<该用户在何种业务情境下到达此处>
BUSINESS_GOAL=<用户希望完成的业务结果>
USER_VISIBLE_COPY=<标题、字段、按钮、空态、确认与失败提示的逐项业务文案>
TECHNICAL_BOUNDARY=<服务端核验/contract 字段；不可显示给用户>
FOUNDATION_PRIMITIVE=<一个或多个 @catering-v2s/admin-ui-foundation 的确切 export；或 NONE_WITH_REASON:<当前 screen 不适用的具体理由>>
CONTAINER_LAYOUT=<容器宽高与来源 · 哪一部分不得超出视口 · 哪一段滚动 · 关键对齐>
```

`CONTAINER_LAYOUT` 是 2026-08-20 Dexter 要求新增的第十项声明。原因:
**它是"看得见但只有渲染出来才发现"的一类事实** —— 线框画得下,真机上却横向溢出、
出现双层滚动条、或多栏基线不齐;而这些在 Dexter 体验之前无人发现。

四件必须写全,缺一即 `REVISE`:

1. **宽高与来源** —— 优先写 foundation 已有 export 的确切名字,不要自造像素值。
   Drawer 已有现成解:`adminWideDrawerSurfaceProps` 的宽度是
   `min(1024px, calc(100vw - 48px))`,天然不超视口;标签列宽 `164` 也在其中。
   非 Drawer 容器(内容页多栏、树加详情、表格区、Modal)没有现成解时,
   写出具体依据和它在窄屏下的行为,⛔ 不写"自适应"这类无法检验的词。
2. **哪一部分不得超出视口** —— 通常是外框与操作区(按钮、分页、Tab 头)。
   点名到具体元素,不写"整体不溢出"。
3. **哪一段滚动** —— 点名唯一的滚动容器。
   ⛔ 同一 screen 出现两个可滚动祖先必须显式说明理由,否则视为缺陷。
4. **关键对齐** —— 标签列宽、多栏之间的基线、表格列与表头的对齐依据。

**红例(必须能打红)**:把窗口宽度收到 1280 以下,该 screen 出现横向滚动条,
或内容区与页面同时出现纵向滚动条 ⇒ 本项不成立。

⚠️ 本项**不规定统一尺寸**,只强制**逐屏声明**。
具体取值仍以 `doc/platform/frontend-coding-standard.md` 与 foundation 既有 export 为准,
本模板不复述它们。

`FOUNDATION_PRIMITIVE` 是逐 screen 的强制声明，不是泛写“将复用 foundation”。每个名称必须能在
`libraries/frontend/admin-ui-foundation/src/index.ts` 重新打开；一个 screen 可用逗号列出多个 export。
声明前还必须回读该 export 的当前生产消费者及既有退役/休眠处置：不得仅因名称存在就把已登记为
休眠或待退役、且与当前业务目标无关的原语重新列为强制依赖。若当前 screen 将成为一个原语的首个
生产消费者，必须在该 screen 说明其不可替代的业务需要和唯一 owner；“零消费者”本身既不自动允许
也不自动禁止复用。
若声明 `NONE_WITH_REASON`，理由必须说明为何当前 screen 没有 lifecycle、Drawer/Modal surface、overlay、
列表上下文、HTTP protocol、observability 或 automation primitive 可复用。final detail design 必须把该
声明绑定到 exact implementation path；实际 import 集合与声明不等，或以 app-local 机制重做已声明原语，
均为 NO-GO。相应架构 gate 与真实 red mutation 在 implementation-facing design 确定 path 后建立，不能拿
尚无路径的 IA 假装已经执行过 import 对账。

`CONSUMER_FACE=public` 只说明未认证访问边界，不能掩盖该公开页所服务的后台。每个 public screen
还必须追加 `APPLICATION_AFFILIATION=<platform-admin（运维管理后台）|operations-admin（运营管理后台）|独立 public 能力>`，并说明它**不是**已登录后台 shell 或 session。凡属于某一后台的公开入口，必须沿用该
后台已裁定的品牌名称与品牌标识 readback，但不得因此把 public operation、token 或访问控制改成后台会话。

`platform-admin`（运维管理后台）与 `operations-admin`（运营管理后台）必须逐屏明确，不能只在
工件总标题中笼统声明。一个页面内混有独立面、Drawer、Modal、内容 Tab 或 header 控件时，各面
分别声明；“当前页面”“弹窗”不是合法形态说明。

一个 `### Screen` 只能表达一种 `UI_SURFACE`。若 header 控件打开 Drawer/Modal，或内容页内有
Drawer/Modal/Tab，宿主与被打开面必须拆成各自 screen id，各自提供线框、状态与上列声明；同一路由
的多个步骤也必须逐步声明，不能以第一步线框代表全流程。

#### Surface ownership 自检（每个线框强制）

线框中的每一项可见元素必须属于该 screen 声明的 `UI_SURFACE`，并与其 `USER_VISIBLE_COPY` 一一可追溯。
只能作为上下文存在的 sibling shell、侧栏、账户菜单、另一 Header 控件、另一 Tab/Drawer/Modal 或相邻
内容页不得画进该 screen；应由自己的 screen id 单独画出。对“不要显示”的约束，只能写在
`BUSINESS_GOAL`、后续行为说明或状态/边界表，不能把“不显示某操作”当作用户会看见的文案或线框行。
例如 Header 控件线框只画该控件，不画侧栏、用户头像或另一个 Header 控件；内容页空态只画空态本身，
不画全局 Header。

交付前逐屏填写并复核下表；任一元素的 `surface owner` 不是当前 screen，或任何 `USER_VISIBLE_COPY`
没有实际呈现位置，均为 `REVISE`，不得交 Dexter 看图：

| screen id     | 声明 UI_SURFACE | 线框可见元素分母        | 每项是否属于当前 surface       | USER_VISIBLE_COPY 可见项是否全有位置 | 结论                                |
| ------------- | --------------- | ----------------------- | ------------------------------ | ------------------------------------ | ----------------------------------- |
| `<screen-id>` | `<...>`         | `<标题/字段/按钮/提示>` | `是/否，否则拆出 owner screen` | `是/否，补齐或移出`                  | `PASS/REVISE/REVISE_PENDING_DEXTER` |

`REVISE_PENDING_DEXTER` 只用于已保留互相冲突的 owning-source 候选、等待 Dexter 产品/物理 surface
裁决的 screen；它不是通过结论，不能作为 implementation-facing input，也不能用来掩盖可由作者自行
补齐的缺项。

<a id="business-language-and-dynamic-item-naming"></a>

#### 业务语言与动态明细命名（强制）

所有用户可见文案以已接受 business corpus 的业务称谓为准，禁止暴露 contract、schema、权限或
实现术语。例：`node`/“节点”不可作为用户可见标签；按任务改为“任职机构”“可查看范围”“可查看
机构”等具体业务词。技术字段可以在 face/owner 矩阵出现，但每个对应 UI 文案必须在
`USER_VISIBLE_COPY` 中明确映射。无法从 corpus/Journey 推导的文案必须标为 `待 Dexter 裁决`，
不能用技术词填空。

`USER_VISIBLE_COPY`、低保真线框、字段/列表列名、按钮、placeholder、空态、确认和失败提示都属于
用户可见文案。它们只能说明用户能理解的**业务对象、业务动作和业务结果**；`component`/“组件”、
`target`、BOM、`ref`、owner、scope、schema、transaction、内部状态枚举及其中文直译都只能放入
`TECHNICAL_BOUNDARY`、face/owner 矩阵或 implementation-facing 说明。动态数据的可见名称尤其不得
照搬底层结构：名称必须让用户知道“这是什么、业务上有什么作用”；没有业务词时应保留为
`待 Dexter 裁决`，不得以技术名凑齐界面。

#### Owner-definition 驱动字段槽位（强制）

当运维管理后台定义某实体字段、另一个管理后台或只读面使用该实体时，每一个适用 screen 必须在
`USER_VISIBLE_COPY`、低保真线框和 surface ownership roster 同时声明该字段**槽位**：它位于原生字段之后，
仅显示当前启用项并按 `displayOrder` 排序，运行时标签、必填性和控件由 owner definition 返回；详情空值显示
“—”。槽位可以不预造运行时字段名称，但不得以此省略可见位置。业务上不画“经营资料”“补充资料”或其他
独立分组标题，也不得向用户显示 definition、revision、schema 或 contract 术语。若实体写请求传 `extensionValues`，
是否携带 definition revision 必须以已裁决的 owner 规则为准；未获明确裁决时只保留 owner 侧只读留痕，不能擅自
把 revision 设为浏览器写入前置条件。

两个管理后台的登录 screen 均为独立页面，实施必须使用仓内已安装的
`@ant-design/pro-components` `LoginFormPage`：平台为“运维管理后台登录”，运营为“运营管理后台登录”。
公开邀请、公开密码恢复不是管理后台登录页，不适用本条，但仍适用本节的逐项声明。

登录 screen 在画线框前还必须先重开当前锁定 `@ant-design/pro-components` 版本的
`LoginFormPage` 类型与实现，并在 IA 中列出官方构成映射：`logo`、`title`、`subTitle`、
`message`、`children`（表单字段/方式切换）、`submitter`、`actions`，以及是否使用
`activityConfig`、背景图或背景视频。默认应沿用组件的页面画布、容器、header、描述、328px
表单主区和全宽 large submit。官方 header 中 `logo + title` 是左右并列、垂直居中（锁定版为 44px
标识、16px 间距）；`subTitle` 是 header 下方的独立描述，不能把 LOGO、标题、描述画成三行上下堆叠。
不得以 `Card + Form`、自建登录壳或为摹写旧系统而重画同一层级。
只有有明确业务来源的视觉差异才可覆盖默认布局，必须写明原因、响应式影响与复用方式。

## 2. Interaction map

| 顺序 | 前提                  | route / 屏幕   | 用户目的 | 可见信息与可操作项 | server/owner readback | 成功去向 | 失败/退出恢复 |
| ---- | --------------------- | -------------- | -------- | ------------------ | --------------------- | -------- | ------------- |
| 1    | <来自 Journey 前提链> | <route/screen> | <...>    | <...>              | <...>                 | <...>    | <...>         |

## 3. v2 对应页面盘点（强制）

先按 `doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md` 对每个 user-facing
screen 盘点 all-v2 对应页。`EXACT_COUNTERPART` / `PARTIAL_COUNTERPART` 必须以静态摹本或
截图替代凭空重画的线框，并标明“摹自 all-v2 path@hash”；没有对应页才可新画，且必须给出
检索范围和理由。未进入 frozen registry 的来源标 `PENDING_HERITAGE_REGISTRATION`，只可作
静态审看出处，不能成为 runtime/build fallback 或实现搬运输入。

Dexter 可对一个明确范围免画静态摹本，但表格的“静态基线 / 摹本标注”必须改为
`DEXTER_WAIVED_<YYYY-MM-DD>；等价证据：<review/source path#anchor>`。豁免只替代视觉副本，
不替代 path@hash、原始业务来源、差异理由或逐 screen foundation 声明。

| screen id     | 对应关系                                                          | all-v2 Heritage path@SHA-256                            | 静态基线 / 摹本标注   | 差异及原因（新裁决/新范围/质量修复/未裁决不得继承） |
| ------------- | ----------------------------------------------------------------- | ------------------------------------------------------- | --------------------- | --------------------------------------------------- |
| `<screen-id>` | `EXACT_COUNTERPART` / `PARTIAL_COUNTERPART` / `NO_V2_COUNTERPART` | `all-v2 <path>@<sha>` / `PENDING_HERITAGE_REGISTRATION` | `<image/link/anchor>` | `<...>`                                             |

## 4. 低保真线框

每个 user-facing 屏幕都必须有一个可在 Markdown 中审阅的视觉工件：Mermaid、SVG/PNG
链接或等价低保真框图。不得只写字段清单。下列框图仅为占位结构，复制后替换为真实
信息层级和控件；一个屏幕一个唯一锚点。

### Screen: <screen-id>

```text
CONSUMER_FACE=<...>
UI_SURFACE=<...>
HOST_AND_ENTRY=<...>
ACTOR=<...>
BUSINESS_SCENARIO=<...>
BUSINESS_GOAL=<...>
USER_VISIBLE_COPY=<...>
TECHNICAL_BOUNDARY=<...>
FOUNDATION_PRIMITIVE=<一个或多个确切 foundation export；或 NONE_WITH_REASON:<...>>
```

若该 screen 是任一管理后台登录页，紧接上述各项再写：

```text
LOGIN_FORM_PAGE_VERSION=<installed @ant-design/pro-components version>
LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION=logo:<...>; title:<...>; subTitle:<...>; message:<...>; children:<...>; submitter:<...>; actions:<...>; activityConfig:<not used | reason>; background:<not used | reason>
```

#### L2/自动化前控件 testId 清单（适用 screen 强制）

在任何 L2 脚本、locator binding 或 blueprint 控件声明之前，按本 screen 预计被真实操作的控件完成下表；
没有 L2/自动化适用性时必须填写 `NOT_APPLICABLE_WITH_REASON` 并回指业务与授权边界。此表不以“页面元素存在”
代替 UI 设计复核，也不允许测试层用宽 locator 补偿 UI 缺口。

| 用户动作 / case-action             | 实际控件                      | UI owning source | `*TestIds.ts` 常量 | testId 实际挂载节点        | wrapper/native 区分       | L2 binding/touch   | UI focused/static proof | 复核结论       |
| ---------------------------------- | ----------------------------- | ---------------- | ------------------ | -------------------------- | ------------------------- | ------------------ | ----------------------- | -------------- |
| `<click/fill/select/upload/press>` | `<按钮/输入/分页/动态行菜单>` | `<path#anchor>`  | `<path#symbol>`    | `<真实语义或 native 节点>` | `<无 / wrapper + native>` | `<binding/action>` | `<path + result>`       | `MATCHED/OPEN` |

判定条件：每个实际动作控件必须先完成需求/IA/详设与当前 UI 代码对账，并查看同类既有模块和 foundation
消费者；testId 必须来自 app 的 `*TestIds.ts` 唯一源，动态控件使用稳定业务身份，且挂在真正承载动作的节点。
缺失、挂错、只给 wrapper、binding 指向父级，或 UI 对账存在 OPEN 时，本 screen 不得进入 implementation-facing
详设的 L2 脚本开发，必须先修 UI 并完成 UI focused/static proof 与 fresh 独立复核。

复合控件窄例外：仓内已有且组件 API 不暴露 option-level `data-*` 的复合控件（如 `Segmented`），可把 testId
挂在可见 option label/anchor；必须在本 screen 控件表注明 `COMPOSITE_OPTION_ANCHOR`、同一点击语义和
focused/static proof。该例外不适用于可直接标记的 Button、MenuItem、Checkbox、Radio、输入框或 file input，
也不允许以外层 wrapper、文本或宽 locator 替代真实动作节点。

#### Implementation-facing 控件 roster（强制）

每个进入 implementation-facing design 的 UI-bearing screen，除上表的逐动作证据外，必须提供一张可直接
对账的最小控件 roster。该表用于在 UI 设计、`*TestIds.ts` 唯一源、真实挂载节点与 L2 binding 之间建立闭环；
不能只列 foundation 原语名，也不能把未来控件名称当作当前实现证据。

| 控件键 | testId | 所在真实动作节点 | 是否 `COMPOSITE_OPTION_ANCHOR` |
| --- | --- | --- | --- |
| `<业务动作或观察键>` | `<来自 app *TestIds.ts 的稳定值/构造器>` | `<真实 Button/Input/Radio/Select/Table/分页/native 节点>` | `是/否；是必须说明 option 点击节点与例外理由` |

要求：每个新增用户动作和需要被 L2 观察的动态状态都必须逐行列出；动态行必须使用稳定业务身份，不使用
label、placeholder、row index、CSS/XPath、Modal/Drawer wrapper 或页面文本。`COMPOSITE_OPTION_ANCHOR` 只
能标注已证明无法在 option-level 挂载的复合控件宿主；Radio、Button、MenuItem、Checkbox 和输入框必须标注
实际动作节点。实现前应将该 roster 与 owning source、唯一 `*TestIds.ts`、binding 和 focused/static proof
逐项对账，缺行、重名、挂错节点或仅有 wrapper 均为 `REVISE`。

### 1.2 表单控件依赖图（每个输入-bearing wireframe 强制）

每个包含输入控件的线框，在其线框后必须逐控件写出下表；包括登录字段、选择器、搜索框、单选/多选、
开关、日期和确认输入。“无上游依赖”也必须显式写出，不能只在
字段清单中暗示。其目的不是把前端当作授权方，而是让用户知道先做什么、后做什么、改变前项会怎样
影响后项。

| 用户可见控件 | 控件形态/搜索方式                                | owner 候选或初始值来源  | 上游依赖与可用条件 | 变更后的级联清理/重载 | 可选项约束   | loading/empty/failed | 提交时 owner 再核验 |
| ------------ | ------------------------------------------------ | ----------------------- | ------------------ | --------------------- | ------------ | -------------------- | ------------------- |
| `<字段>`     | `<Input / searchable Select / multi Select ...>` | `<readback / 用户填写>` | `<无 / 先选字段>`  | `<无 / clear ...>`    | `<业务约束>` | `<...>`              | `<...>`             |

若一个下拉框依赖另一控件，线框必须把“先选择 A，才可选择 B”画出来；在 `onChange` 中被清空的
下游值、由 owner 重新返回的候选集、不可选提示及失败恢复都必须在上表说明。禁止依据本地角色、
URL、页面 key 或旧选择猜测候选；前端过滤只改善可用性，不能替代 command owner 的最终校验。

### 1.2.1 新建、编辑与确认 mutation 的字段事实矩阵（强制）

每个创建、编辑、凭据、状态/作废或集合替换 screen，必须先按**一个真实 command variant 一行**声明
`FORM_MUTATION_DENOMINATOR`，再给该 variant 的每个 request fact 一行。该矩阵不以“页面有几个
字段”为分母；它以批准 Journey 的业务任务、当前 OpenAPI request、edge mapping 与 owner command 的
交集为分母。其目的，是防止把名称相近的实体、可见控件和 command 真相错误合并。

| 业务字段或 command 事实 | 用户可见文案/控件     | 分类                                                                                 | 原始业务来源              | request 取值与唯一来源                                                   | 变更、级联与校验 | command owner 最终复核       | 冲突/失败恢复 |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------ | ---------------- | ---------------------------- | ------------- |
| `<事实>`                | `<文案/控件或不显示>` | `EDITABLE` / `FIXED_READONLY` / `CONDITIONAL_EDITABLE` / `HIDDEN_OWNER_FACT` / `GAP` | `<Journey/corpus/source>` | `<用户输入 / latest detail / owner candidate / session / owner default>` | `<...>`          | `<状态、关系、版本、授权等>` | `<...>`       |

- `EDITABLE` 只用于业务用户在当前任务中可以改变、且 command 允许改变的事实；`FIXED_READONLY`
  必须展示其业务含义，但不得允许用户改写；`CONDITIONAL_EDITABLE` 必须给出条件、清理与重读；
  `HIDDEN_OWNER_FACT` 不显示为用户字段，仍必须写明它从最新 detail、session、owner default 或安全
  grant 的唯一来源；`GAP` 必须说明缺失的 owner/contract 以及在补齐前为何不能提交。
- 创建时的 owner 默认状态、对象标识、expected version、idempotency proof、owner 侧只读留痕、目标状态
  和当前读回事实，不能因为不显示就从矩阵消失；纯确认 Modal 也必须列出对象、动作、版本等 hidden
  facts，并明确它没有可编辑的业务资料字段。
- 同一页面若承载品牌、经营租户、总公司等不同 command，必须分 variant 写；不得以“业务实体”或
  “基本资料”把不同必填字段合并。动态明细必须写数量、空值、去重、顺序、增删、最小项及 owner
  readback；owner-definition-driven 动态字段必须写 definition task-read、显示/录入位置、启用过滤、
  displayOrder、标签/必填/控件映射、缺失值和未知旧值边界。除已有业务裁决明确要求外，不得把 definition
  revision 作为用户输入或 entity write request 前置条件；revision 只能是 owner 侧只读留痕。
- 新增稳定标识、资产 staging/release、前端生成 technical key 或把用户选择的对象当授权范围，均不得
  靠 UI 猜测：先重开 owner source。当前 contract 没有合法来源时标 `GAP`，并保留原始业务问题；不得
  以隐藏 input、URL、已加载列表或页面 key 伪造事实。

<a id="parent-child-dynamic-aggregate-layout"></a>

#### 主从动态集合的布局、归属与保存边界（强制）

当一张表单同时维护主集合及其从属动态集合时，线框、控件依赖图和字段事实矩阵必须先明确：
**层级关系、当前正在编辑的主项、每层集合边界、增删排序规则，以及整体/逐项保存边界**。不得把所有
层级平铺成连续卡片、无归属的重复行或一张无法判断父项的表。

主集合必须提供稳定的当前项定位面（例如列表或可编辑表格）；从属集合只能绑定当前选中主项，切换
主项时同步切换其从属数据，不能把不同主项的从属数据混排。每一层还必须逐项声明：无主项、当前主项
下零条、已有数据三种状态；新增、删除、待删除确认、排序、去重、最少项、切换当前项和保存后的
readback。已有从属数据时不得同时显示“没有数据”的空态。用户不阅读技术说明也应能辨认：**现在在
编辑哪一项、下方数据属于谁、保存会影响什么**。

### 1.3 业务驱动的搜索与候选选择详设（每个 search-capable screen 强制）

`search-capable` 包括列表查询/筛选、搜索框、搜索选择、候选多选、级联选择和可输入的远程候选控件；
它不等同于“页面上有一张表”或“表中出现了某个字段”。每个 UI-bearing 工件必须先声明有限的
`SEARCH_CAPABILITY_DENOMINATOR`：逐 screen 写明 `APPLICABLE` 或
`NOT_APPLICABLE_WITH_REASON`。后者必须回指原始业务任务与 contract/owner source，不能以“常规页面”
或“暂时没有设计”蒙混。

每个 `APPLICABLE` screen 必须先回答用户正在寻找、缩小或选择的**业务对象**是什么、为何在当前业务
场景需要这一能力，再逐个查询条件或候选控件填写下表。一个展示列不自动成为查询条件；一个接口、旧页
或技术 id 的存在也不自动成为用户可见筛选。没有业务问题、owner 候选或已批准 contract 的条件不得画出。

| screen / 业务对象 / 用户问题 | 条件的用户可见文案 | 匹配语义与控件形态 | 值或候选的唯一来源 | 上游级联、清理与重载 | 请求/提交 owner 核验 | 适合性与排除的替代方案 | contract 缺口或不适用处置 |
| --- | --- | --- | --- | --- | --- | --- |
| `<screen>/<实体>/<用户要回答的问题>` | `<字段>` | `<包含文本 Input / 精确编码 Input / 固定 Select / searchable Select / Cascader / 日期范围等>` | `<固定冻结词表 / operationId + response field / owner task read>` | `<无 / A 改变后清空 B 并重取>` | `<list query 参数或 command owner 的最终事实判定>` | `<为什么不是文本/为什么不是本地枚举>` | `<无 / GAP:<owner+contract+下一步裁决> / NOT_APPLICABLE_WITH_REASON>` |

固定而完整的业务词表（例如 status）才可用本地 `Select`；跨 owner 的对象、当前范围内会增长的对象或需要
按名称/编码定位的对象，必须使用 owner-returned `searchable Select` / `Cascader`，并写出触发时机、
搜索字段、分页/加载、空结果和失败恢复。自由文本只适用于 contract 明确提供的名称、编码、编号等文本
匹配，必须说明 contains/exact 语义；不得把应当选择的业务事实伪装为任意文本，也不得把本应文本匹配的
条件伪装成不受支持的候选服务。

所有候选数据必须写清是冻结常量、当前 readback、还是后台接口/contract 的 `operationId + response field`；
候选不存在、契约未暴露所需 query 参数、或所需 owner task read 尚未设计时，必须标 `GAP`，保留当前
原文并交 Dexter/后续 contract design 裁决。浏览器不得通过已加载列表、本地角色、URL、页面 key 或
其他实体反推候选，更不能把 client-side filter 宣称为服务端搜索。上游改变后必须清空不再成立的下游值；
每次 list query 和 command 仍由 owner 按当前权限、范围、关联关系与可用状态重新核验。

每一项“为什么最合适”必须回指原始业务需求/Journey/corpus，而不是由开发便利、组件偏好或 all-v2
外观推断。实施前，详设作者必须重新打开对应 owning source、候选 read operation 与 query/command
contract，**并验证 owner 的当前 task read/controller 实际接收、应用该条件且以同一谓词计算分页 total**。
OpenAPI 声明 query 参数不等于当前实现已经拥有搜索语义；任一转发、过滤、total 或候选 read 缺失都必须
标 `GAP`，不得以 contract、前端筛选或已加载行伪称可用。无此 source-reopen 的搜索设计不得进入
implementation-facing design。

### 1.3.1 候选搜索查询统一协议（所有 future detail design 强制）

凡从增长型、可能重名、受当前权限或上游关系约束的业务对象中选择值，必须复用一个 consumer-side
candidate-query protocol，而不是由每张表单新造搜索接口、分页语义、取消机制或错误恢复。统一协议至少
定义 `subjectType`（固定业务对象词）、`queryText?`、`page?`、`pageSize?`、`consistencyToken?`、
`dependencies[]` 与统一候选页 `items[{ref,label,secondaryLabel?,disabledReason?}]`。`consistencyToken`
只能逐 owner 映射为其已返回的 context/version/revision 事实；owner 没有该事实时字段缺省，浏览器不得
临时合成 app-local version。每个 `subjectType`
仍由正确 owner 的 public task read 实现和最终授权；统一 consumer protocol **不得**成为跨 owner 万能查询表，
不得由浏览器根据已加载行、URL、页面 key 或名称补候选。

每个候选控件在 §1.3 表中必须声明该协议的 `subjectType`、依赖 ref、owner adapter、查询字段、分页和
上游变更后的取消/清空/重读。固定枚举、latest detail 的只读事实、已获批准的自由文本筛选与用户输入的
业务明细不属于 candidate query。若对应 owner 尚未提供合法 task read，标 `GAP`；不能为保持“统一”而
在某一 Drawer 退回全量列表、客户端筛选或自由输入。

```text
┌─────────────────────────────────────────────────────┐
│ <页面标题 / 用户当前位置>                             │
├─────────────────────────────────────────────────────┤
│ <关键只读事实 / 当前状态>                             │
│                                                     │
│ <输入控件、校验提示或空态>                            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ <次要操作>                           <主操作>        │
└─────────────────────────────────────────────────────┘
```

## 5. 状态与边界表

| 屏幕/动作       | initial/loading | validation | submitting | success | conflict/denied | timeout/unknown    | owner/face 边界          |
| --------------- | --------------- | ---------- | ---------- | ------- | --------------- | ------------------ | ------------------------ |
| <screen/action> | <...>           | <...>      | <...>      | <...>   | <...>           | <先查询/重试/退出> | <server final authority> |

## 6. 逐操作任务合理性

<a id="visible-operation-denominator"></a>

**可见操作分母（强制）**：每一个线框、`USER_VISIBLE_COPY` 或状态表中出现的按钮、文字链接、行点击、
Select 变更、Tab、菜单项、刷新/重试和确认/取消，都必须逐项在下表拥有一行，并回指批准 Journey 的原始
anchor 和该操作的真实 owner/surface。不得因为一个接口存在、旧页面曾经有过、或页面“看起来需要”而新增
按钮。若原始 source、Journey 与当前实现发生冲突，必须登记冲突、保留两边原文并标为 `Dexter 裁决`；在
裁决前不得把任一候选画成既定交互。实体列表默认遵循“名称/业务标识链接→详情 Drawer→详情右上动作→
关闭详情后打开下一 surface”；只有批准 Journey 明确例外才可出现行内动作。

| 操作     | 批准 Journey 来源 | 用户为何此时操作 | 是否有更短路径 | 不选替代的理由 | 约束归因（产品/owner/contract/旧文档） | Dexter 裁决是否必要 |
| -------- | ----------------- | ---------------- | -------------- | -------------- | -------------------------------------- | ------------------- |
| <action> | <path#anchor>     | <...>            | <...>          | <...>          | <...>                                  | 是 / 否             |

## 7. Face / owner 对齐矩阵

| 屏幕/动作       | consumer face | 页面准入 | server operation | owner readback / command | 不可由前端替代的判定 |
| --------------- | ------------- | -------- | ---------------- | ------------------------ | -------------------- |
| <screen/action> | <...>         | <...>    | <...>            | <...>                    | <...>                |

## 8. Manifest B.4/B.5 命中对照

这是面向人工审查的出处链，不是语义 checker。逐项列出本 Journey 实际命中的
`B.4`（前端架构与状态）或 `B.5`（交互与信息架构）条文；不适用时写明理由，不得
以“未填写”假装不适用。Heritage 原文只能从
`doc/heritage/registry.json` 已选择的冻结副本引用，并以 `path@sha256` 回指。

| manifest 条文     | 本 Journey 的命中或不适用理由 | 遵循方式 / 待 Dexter 裁决 | Heritage 原文（冻结路径@hash）     |
| ----------------- | ----------------------------- | ------------------------- | ---------------------------------- |
| B.4-<n> / B.5-<n> | <...>                         | <...>                     | `doc/heritage/frozen/...@<sha256>` |

## 9. 可选：高保真静态 demo

默认只交低保真线框。只有新交互范式屏或用户语言敏感屏，且 Dexter 需要进一步看图时，
才可按本节制作高保真静态 demo；它不是 app 原型、实现授权或组件库规范。

1. **假数据可追溯**：每个展示字段、业务术语和示例值必须回指已接受 corpus 条目或
   已裁决 Journey。没有来源的元素必须有显眼 `待裁决` 水印；禁止为了“看起来完整”
   编造字段或值。
2. **一次性静态工件**：只可用零依赖、内联样式、可通过 `file://` 打开的静态 HTML，
   放在 `doc/plans/platform/mockups/<JOURNEY_ID>/`。未来 app 代码必须对该目录零引用；
   implementation 期按图重写，不得 import、复制或把它接入构建。
3. **按需而非默认升级**：标准 CRUD 列表、常规筛选与详情保持线框即可；升级理由写在
   本工件中，避免视觉产物替代业务裁决。
4. **视觉基线可核验**：如摹写 all-v2 前端壳，只提取静态视觉语言，并注明
   `摹自 all-v2 <path>@<sha256>`；不得 import 旧仓运行时代码、不得建立构建依赖，
   all-v2 始终只读。

如使用本节，追加以下记录：

| demo 路径                                               | 升级原因 | 假数据出处 / 待裁决水印位置 | 视觉基线（如适用）                | Dexter 高保真看图结论   |
| ------------------------------------------------------- | -------- | --------------------------- | --------------------------------- | ----------------------- |
| `doc/plans/platform/mockups/<JOURNEY_ID>/<screen>.html` | <...>    | <...>                       | `all-v2 <path>@<sha256>` / 不适用 | `UNSET/ACCEPTED/REVISE` |

## 10. Dexter 看图结论

- 看图日期：<...>
- 低保真线框结论：`ACCEPTED` / `REVISE`
- 高保真 demo 结论：`NOT_REQUIRED` / `ACCEPTED` / `REVISE`
- 修改意见/已接受的操作顺序：<...>
- 允许进入 implementation-facing design：是 / 否
