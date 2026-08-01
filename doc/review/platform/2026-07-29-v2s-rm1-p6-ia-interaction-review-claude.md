---
title: RM1 P6 交互设计（IA-01 / IA-02）独立审核（Claude）
reviewTarget: INTERACTION_DESIGN
scope: IA-01 + IA-02 current bytes（交互接受前阶段）
verdict: GO
findings: M=0 / S=1 / N=2
revision: 3（Dexter 授权免画摹本→原 S1 关闭；Dexter 另指出 foundation 绑定缺失→新增 S2）
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅只读审核与输出 review 文档；GO 仅表示交互稿可进入 Dexter 裁决，不构成 implementation authorization
createdAt: 2026-07-29
---

# RM1 P6 交互设计（IA-01 / IA-02）独立审核

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。

> **revision 2**：Dexter 于本轮明确授权 **本次可不画静态基线/摹本**（理由：耗时）。
> 原 S1 与同源的 N3 据此关闭——但**不是靠豁免关闭的**：
> 摹本要求防的是"手绘线框与 all-v2 漂移"，该风险已由本会话的**字段级机械比对**独立关闭（见 §1）。

**GO 的含义（按来件定义）**：交互稿可进入 Dexter 的下一步裁决（看图 + 选择器来源二选一）。
**不构成 implementation authorization**。
S2 不阻塞 Dexter 看图，但**必须在 implementation-facing 详设开工前闭合**。

### 先回答 Dexter 的问题：这活到底解决什么，解决了没有

本会话**不从 review 清单出发**，而是先重开 all-v2 源码、v1/v4 对照与工程模板，再看 IA。

**要解决的问题是真的**：v2s 当前的运营上下文与平台集团空间链路存在"凭空新增操作、
把不同交互面混画、从现有代码反推用户任务"的风险——这正是 CLAUDE.md 的 UI 强制自问
所针对的。两份 IA 明确以"不做通用切换器"为立场（IA-02 §1 原文：
「本稿解决的是用户在两个不同后台中的两个不同上下文问题，而不是"做一个通用切换器"」）。

**解决了，而且不是为了凑 GO**：本会话独立比对 all-v2 实际源码，IA-02 的平台链路**逐条吻合**（§3），
三个幻影操作在 all-v2 中命中 **0**、在 IA 中只作为禁止性约束出现在正文而非线框/文案（合规）。
IA 还主动重开了 **v1 与 v4** 的同功能实现并给出取舍理由（§4），这是来件未强制、
但 Dexter 明确要求的动作。

**原本唯一的实质缺口是证据形式**：12 个 `EXACT`/`PARTIAL_COUNTERPART` screen 以手绘 ASCII 线框
替代了模板强制的"静态摹本或截图"。Dexter 本轮授权免画摹本；
该要求所防的"线框与 all-v2 漂移"风险，已由本会话的**字段级机械比对**独立关闭（§1.2，7 项逐项一致）。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。未启动任何动态环境。

---

## 1. 原 S1 的处置：Dexter 豁免摹本，残余风险由字段级比对关闭

**Dexter 裁决（2026-07-29）**：本次授权可不画静态基线/摹本。
**结论分类**：`DEXTER_DECISION`（豁免），并附本会话的补偿性核验。

摹本要求存在的理由只有一个——**证明 `EXACT_COUNTERPART` 的线框摹自 all-v2 而非重画**。
既然不画摹本，本会话改用**对 all-v2 源码的字段级机械比对**关闭同一风险，不需要任何人画图。

### 1.1 workspace 链路（上一稿已比对，结论不变）

`WorkspaceManagementPage.tsx` 无 `title:'操作'` / `valueType:'option'` / `fixed:'right'`；
仅 `:155` 页头 `新建集团空间` 与 `:86-87` 名称 `detailLink → openDetail`；
`WorkspaceOverviewPage.tsx` 仅 `重试`×2 + `刷新`；三个幻影操作 all-v2 命中 **0**。**与 IA-02 吻合。**

### 1.2 三个 Drawer 的字段集（本轮新增比对，上一稿未做）

| 项 | all-v2 实测 | IA-02 声明 | 判定 |
| --- | --- | --- | --- |
| Create/Edit 字段 | `WorkspaceFormDrawer.tsx:228-253` → `workspaceKey`（集团空间编码）、`name`（集团空间名称）、`operationsTitle`（运营管理后台标题名称）、`notes`（备注） | 集团空间编码、集团空间名称、运营管理后台标题名称、备注 | **一致** |
| Logo 控件 | 同文件 `:258` `WorkspaceLogoField`；`:145` `LogoIntent` = `Keep/Replace/Remove` | `:487` 「保持当前 / 选择新 Logo / 移除」三选一 | **一致** |
| 创建态 Logo 必填 | `:219` `mode === 'create' && !stagedAsset` 禁用提交 | `:434` 「创建前必须完成上传」 | **一致** |
| Logo 失效恢复 | `:180` 「Logo 已失效，请重新上传。其他已填写内容会被保留。」 | `:434` 「上传失败不清除其他已填写内容」 | **一致** |
| 详情展示 Logo | `WorkspaceDetailDrawer.tsx:136-140` | `:384`/`:392` 详情含「Logo <图片/未配置>」 | **一致** |
| 商业集团初始化字段 | `CommercialGroupInitializationDrawer.tsx` → `groupCode`（集团编码）、`groupName`（集团名称） | 「集团编码」「集团名称」 | **一致** |
| 列表 Logo 列 | `WorkspaceManagementPage.tsx:102-107` `title:'Logo'`、`dataIndex:'logoUrl'`、未配置回退 | `:256`/`:258` 列表含 `Logo` 列 | **一致** |

**结论：逐项一致，未发现任何漂移。** `EXACT_COUNTERPART` 的声明成立。

> **作者失误披露（两次，均在报告前自行更正）**：
> ①一条 `echo` 被无条件打印，导致"all-v2 列表无 Logo"的错误标注——实为 `:102-107` 确有 Logo 列；
> ②用 `paste - -` 抽取 label/name 时配对错位，一度看成 all-v2 只有 4 个字段而 IA-02 多一个 Logo。
> 两次均在下结论前重查源码证伪。**记录在此，以免后续会话误引这两个中间结论。**

### 1.3 豁免的残余风险与边界

- **已关闭**：上表 7 项覆盖了 `EXACT_COUNTERPART` 的全部可见元素分母（列表列、详情字段、三个 Drawer 的字段与 Logo 语义）。
- **仍未证明**：视觉层面的布局/间距/控件尺寸。这本就不是低保真线框的职责
  （模板 §4 明写"不是视觉稿或组件库规范"），且 §9 高保真为 `NOT_REQUIRED`，**不构成缺口**。
- **建议（不阻塞）**：在 IA-02 §3 的"静态基线/摹本"列填
  `DEXTER_WAIVED_2026-07-29；等价证据见本评审 §1.2`，使豁免有据可查、
  不至于被后续复核当成漏填。

## 1A. S2 ｜24 个 screen 无一绑定 `admin-ui-foundation` 的具体导出（Dexter 指出）

**严重级别**：S　**结论分类**：`CONFIRMED`

### 事实与 owning source

RM1 计划对 IA 工件的**强制要求**（`doc/plans/platform/2026-07-28-v2s-rm1-…-plan.md`）：

```
:384  Each amendment must state v2 baseline, state table, typed errors, owner readback,
      **foundation primitive**, and low-fi wireframe.
:399  Each artifact must bind task, state table, generated operation, owner readback,
      typed failures, v2 difference, **foundation primitive** and a unique low-fi screen anchor.
```

`CLAUDE.md:45` 亦明令：「后续任何 UI 功能实现必须优先对接
`libraries/frontend/admin-ui-foundation` 已提供的共享能力；
**禁止**在 `apps/frontend/*` 重复实现相同的生命周期、Drawer surface、overlay lock、
列表上下文、HTTP protocol、observability 或 automation primitive。」

**实测**：

```
IA-01 中 "foundation" 出现        : 0 次
IA-02 中 "foundation" 出现        : 4 次（2 次是 v1 heritage 路径；1 次是 manifest B.4 行的泛语
                                    「复用 foundation lifecycle/overlay/generation」；1 次是对未来详设的要求）
24 个 screen 中点名任一 foundation 导出的 : 0
```

逐个导出名检索两份 IA，**全部 0 命中**：
`useDrawerFormLifecycle`、`adminDrawerSurfaceProps`、`useDetailDrawer`、`useOverlayLock`、
`useSubmissionLifecycle`、`useAsyncGenerationGuard`、`AdminErrorBoundary`、
`contextScopedQueryArgs`、`testId`、`platformHttpProtocol`。

### 为什么这是实质风险，不是形式问题

foundation 恰好提供了这 24 个 screen 所需的**全部**行为原语：

| IA 声明的行为 | foundation 现有导出 | 涉及 screen |
| --- | --- | --- |
| Drawer 打开/脏值守卫/提交生命周期 | `useDrawerFormLifecycle`、`adminDrawerSurfaceProps` | IA-01 的 2 个 Drawer；IA-02 的 5 个 Drawer |
| 名称链接打开详情 Drawer | `useDetailDrawer` | `IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER` |
| Drawer/Modal 打开时锁底层交互 | `useOverlayLock`、`OverlayLockProvider` | 全部 Drawer + 2 个 Modal |
| 提交中禁重复、失败保留字段 | `useSubmissionLifecycle` | 全部含提交的 screen |
| 迟到响应不覆盖新结果 | `useAsyncGenerationGuard`、`createAsyncGenerationGuard` | IA 逐屏声明的"未知结果先 readback" |
| 子树异常兜底 | `AdminErrorBoundary` | 两个 app shell |
| 范围化列表查询参数 | `contextScopedQueryArgs` | 运营端数据范围相关列表 |
| 自动化锚点 | `testId` | IA 引用的 L2 locator |

**失败模式已经在本仓发生过、且刚被证实**：P5 复核中
`StoreManagementPage.tsx` 与 `ContractManagementPage.tsx` 的候选读取
用的是 **local `useState` + 手写 promise**，而非 foundation 的共享模式——
上一轮的 8 处 `loading={!candidates}` 永久转圈残留正是从这条手写路径来的。
**IA 不点名原语，详设与实现就会重复这条路。**

### 反例 / 适用边界

- **模板本身没有这一条**（`ui-interaction-design-template.md` 检索
  `foundation`/`primitive`/`共享能力`：**0 命中**）。故这不是 IA 作者违反模板，
  而是**模板漏了 RM1 计划已强制的要求**——两处都要修。
- **IA-02 §11 已要求未来详设包含 `foundation reuse`**（`:623`），
  说明作者知道这条存在，只是把它推到了详设阶段。
  但 RM1 计划 `:384`/`:399` 要求的是 **IA 工件本身**声明，不是详设。

### 建议处置（最小）

1. **模板**：在 §1.1 的八项强制声明后追加第九项——

   ```text
   FOUNDATION_PRIMITIVE=<libraries/frontend/admin-ui-foundation 的具体导出名；或 NONE_WITH_REASON>
   ```

   `NONE_WITH_REASON` 必须说明为何该 screen 不需要任何共享原语，防止用空值绕过。

2. **两份 IA**：逐屏补该行，取值取自上表。这不需要重画线框，
   是在已有的 `text` 声明块里加一行。

3. **机械控制**（防"写了不用"）：在 `scripts/check/frontend-architecture` 加一条——
   凡 IA 中声明了 `FOUNDATION_PRIMITIVE=<export>` 的 screen，
   其实现文件必须 import 该 export；未 import 即具名红。
   红变异 = 把某处改回 local `useState` 手写实现，门必须红。
   **这一条才是真正回答 Dexter 担心的"后面实现的时候不用"**——
   声明本身拦不住，声明 + 门才拦得住。

**是否需要 Dexter 裁决**：否（工程要求已在 RM1 计划中冻结）。

---

## 2. 五个核验点的直接回答

### 核验点 1 ｜八项声明与物理交互面 —— `CONFIRMED`

| 项 | IA-01 | IA-02 |
| --- | --- | --- |
| screen 数 | 10 | 14 |
| `CONSUMER_FACE` / `UI_SURFACE` / `HOST_AND_ENTRY` / `ACTOR` / `BUSINESS_SCENARIO` / `BUSINESS_GOAL` / `USER_VISIBLE_COPY` / `TECHNICAL_BOUNDARY` | **10/10 全覆盖** | **14/14 全覆盖** |
| `APPLICATION_AFFILIATION`（public 专属） | 4 个 public screen **全有** | 无 public screen，不适用 |
| Surface ownership roster | 10 行**全 PASS** | 14 行，12 PASS + 2 `REVISE_PENDING_DEXTER`（见 N2） |
| 线框内混画 sibling（侧栏 / 另一 Header / 头像） | **0** | **0** |

物理交互面区分到位：`独立页面` / `独立内容页` / `内容 Tab` / `Drawer` / `Modal` / `Popover` /
`Header 控件` / `侧栏底部控件` 逐屏声明，未出现"当前页面""弹窗"这类非法形态说明。
Header 控件打开的 Drawer/Modal 均拆为独立 screen id（如
`IA02-OPERATIONS-DATA-SCOPE-SIDER-TRIGGER` 与 `IA02-OPERATIONS-DATA-SCOPE` 分列）。

**表单控件依赖图**逐屏提供，含"控件形态/搜索方式、owner 候选来源、上游依赖与可用条件、
变更后的级联清理、可选项约束、loading/empty/failed、提交时 owner 再核验"八列——
与来件核验点 1 的第五项要求逐项对应。

**登录页的工程强制条款全部满足**（模板中最具体的一条）：
`LOGIN_FORM_PAGE_VERSION=@ant-design/pro-components@3.1.12-0`；
`LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION` 逐项映射
`logo/title/subTitle/message/children/submitter/actions/activityConfig/background`；
线框为 `[标识] 标题` **左右并列**、副标题在其下方独立一行——
**不是模板禁止的"LOGO/标题/描述三行堆叠"**，也未用 `Card + Form`。

### 核验点 2 ｜可见操作可回指 Journey / surface / owner —— `CONFIRMED`

IA-01 §2、IA-02 §2 的交互地图逐行给出「前提 → route/屏幕 → 用户目的 → 可见与可操作项 →
server/owner readback → 成功去向 → 失败恢复」，每行绑定 R5 Journey 锚点。
IA-02 §6「逐操作任务合理性」另给出"该操作从哪进入 / 不从哪进入"的对照
（如 `:567` 「动作只从详情右上进入」、`:570` 「状态动作只从详情进入」）。

**凭空新增按钮 / 表格操作列 / 行尾操作 / 混画**：本会话独立检索，**未发现**。

### 核验点 3 ｜platform workspace 链路符合 all-v2 —— `CONFIRMED`

本会话**直接重开 all-v2 源码**逐条比对：

| 要求 | all-v2 实测 | IA-02 |
| --- | --- | --- |
| 列表只允许页头"新建集团空间"与名称链接 | `WorkspaceManagementPage.tsx:155` 页头 Button；`:86-87` `detailLink → openDetail`；**无 `title:'操作'` / `valueType:'option'` / `fixed:'right'`** | `BUSINESS_GOAL=在一个无行内操作列的列表中识别目标集团空间`；正文「表格**没有**"操作"列、行尾按钮」 |
| 名称链接打开详情 Drawer | `openDetail(record.workspaceKey)` | `IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER`，`EXACT_COUNTERPART` |
| 编辑/启停/初始化只能由详情发起，且先关闭详情 | `WorkspaceDetailDrawer.tsx` 承载三个上下文动作 | `:397` 「点击"编辑""启用/停用"或"初始化商业集团"时，**先关闭本详情 Drawer**，确认关闭后才打开相应的…」 |
| 总览只读，仅刷新/资料级重试 | `WorkspaceOverviewPage.tsx` 仅 `重试`×2 + `刷新` | `USER_VISIBLE_COPY=…按钮"刷新"；某一资料暂时无法获取时按钮"重试"`；roster「不画管理或选择操作」 |
| 不得恢复"选择为当前空间""返回集团空间管理""更换当前空间" | all-v2 全仓命中 **0** | 仅出现在 `:262`、`:338` 的**正文禁止性约束**中，**不在线框、不在 `USER_VISIBLE_COPY`** —— 符合模板「"不要显示"的约束只能写在 BUSINESS_GOAL/行为说明/边界表」 |

### 核验点 4 ｜选择器来源冲突应维持 Dexter 裁决 —— `DEXTER_DECISION`

**IA-02 的处置正确，不应由设计作者自行选择。** 事实：

```
IA-02 §3:74  IA02-PLATFORM-WORKSPACE-SELECTOR | SOURCE_CONFLICT_REQUIRES_DEXTER
  Header 侧：admin-consumer-chrome-standard.md@557fc992… + element ledger@b7fa2c92…
  侧栏底部侧：PlatformShell.tsx@1d9bbb9a… + PlatformWorkspaceSelector.tsx@00ceb58c…
  「正式 v2 文档与当前 v2 代码/L2 对物理位置冲突；本稿列出两个候选但不自行选择，必须由 Dexter 决定。」
§4:335-336 「候选 A 与下列候选 B 只可二选一；在 Dexter 接受前两者都不是 implementation input。」
候选 A/B 各自成 screen（`Header 控件（候选 A；未接受）` / `侧栏底部控件（候选 B；未接受）`）
```

**判断**：**应维持 Dexter 裁决。** 理由是这不是实现细节而是**来源权威冲突**——
正式 element ledger 与当前源码/L2 各自都是被冻结的 v2 事实，二者不可同时为真。
按 CLAUDE.md「涉及产品/Journey/页面操作歧义时，列出候选理解与推荐项并向 Dexter 求证；
未裁决前不得 GO」，作者列候选而不自选是**正确且必要的**。

**补充事实（供 Dexter 裁决参考，本评审不代选）**：IA-02 §4 已重开 v1 与 v4 的同类实现——
`catering-all-v1/.../OperationsShell.tsx@f60e206b…` 与
`catering-server-v4/.../app.tsx@dbe4731644…` **均用 `menuFooterRender` 放在侧栏底部**。
这是运营端"数据范围"的旁证，**不是**平台端"集团空间选择器"的直接证据，
两者是不同后台的不同控件，不可混用作裁决依据。

### 核验点 5 ｜范围完整性（22 surface / 25 pageDesignKey）—— `PARTIALLY_CONFIRMED`

IA-01 + IA-02 覆盖本轮**有行为或交互决策**的 24 个 screen。
其余页面的来源证明**未被省略，但也尚未产出**——已在 P6 准备件中列为待交付分母：

```
doc/decisions/2026-07-29-…-p6-interaction-preparation-and-refreeze-design.md
  :80  U09-G | P-U5 + P-N1 + R-5 surface closure | carry-over manifest 22/25, IA-01, public and invitation surfaces
       | every surface/page key CARRY/ADAPT/NOT_CARRIED exact reconciliation
  :148 D5 | frontend-asset-carryover-manifest.json surfaces + pageDesignKey crosswalk, accepted IA hashes/anchors
       | 22 surfaces and 25 keys each have exact CARRY/ADAPT/NOT_CARRIED
```

**判断**：当前阶段（交互接受前）这样安排**是合理的**——纯 CARRY 页沿用 v2 基线，
不需要独立 IA；但 22/25 的逐条对账**必须在 implementation-facing 详设中作为强制分母产出**，
且不得以"页面未改"为由跳过来源与用户任务证明（见 N1）。

---

## 3. N（观察项）

### N1 ｜22/25 CARRY 对账尚未产出，是本轮唯一可能让页面无来源通过的通道

**结论分类**：`UNVERIFIED_REQUIRES_EVIDENCE`

事实：D5 / U09-G 已声明该分母，但对账工件当前不存在，故**无法核验**任何一页
是否真有可引用的 v2/R5 基线。
**处置建议**：在 P6 详设中把它做成机械对账（22 surface × 25 key 逐条 CARRY/ADAPT/NOT_CARRIED，
`NOT_CARRIED` 必须给理由），并配红变异（删掉任一行必须红）。
**不阻塞本轮**——本轮结论是交互稿可进入裁决，不是详设可开工。

### N2 ｜roster 引入 `REVISE_PENDING_DEXTER`，扩展了模板的 `PASS/REVISE` 枚举

**结论分类**：`PARTIALLY_CONFIRMED`

模板 roster 的结论列定义为 `PASS/REVISE`，且规定「任一…均为 `REVISE`，**不得交 Dexter 看图**」。
IA-02 对两个 selector 候选使用了第三个值 `REVISE_PENDING_DEXTER`。

**语义上是对的**——这两行的 owner 与 copy 两列均为"全部有位置"，
即 surface ownership 本身通过，待决的是**来源选择**而非线框合规性；
若沿用裸 `REVISE`，反而会与"不得交 Dexter 看图"冲突，堵死候选二选一的路径。
**但模板未同步修订**，机械 checker 若按 `PASS|REVISE` 判定会误处理。
**处置建议**：在模板中正式加入该取值并写明"仅用于来源冲突待裁决，surface ownership 已通过"。

> **原 N3（§3 第 4 列被 R5 锚点占用）随摹本豁免一并关闭**，仅保留 §1.3 的登记建议。

## 4. 未发现的问题（明确记录，供后续复核不必重做）

- **凭空新增按钮 / 表格操作列 / 行尾操作**：未发现。
- **混画不同交互面**：未发现；线框中检索"侧栏 / Header / 用户头像"作为 sibling 元素 **0 命中**。
- **用技术术语作用户可见文案**：未发现；`USER_VISIBLE_COPY` 使用"任职机构""可查看范围"
  "集团空间"等业务称谓，未见 `node`/"节点"/`pageDesignKey` 一类术语外泄。
- **从现有代码反推用户任务**：未发现；两份 IA 均先声明业务问题与 Journey 锚点，
  且 IA-01 明确写「G-05 只证明运营端已有两种凭据，**不**是平台 OTP 的业务授权」——
  这是本会话认为最能体现"不为凑 GO"的一处自我约束。
- **登录页违反 `LoginFormPage` 强制条款**：未发现（见核验点 1）。

---

## 5. 处置与再审条件

| finding | 严重级别 | 处置 | 需 Dexter 裁决 |
| --- | --- | --- | --- |
| ~~S1~~ | — | **Dexter 已豁免摹本**；残余漂移风险由本评审 §1.2 的字段级比对关闭 | 已裁决 |
| **S2** | S | 模板加第九项 `FOUNDATION_PRIMITIVE=`；两份 IA 逐屏补；加 import 校验门并验红 | 否 |
| N1 | N | P6 详设中做成机械对账并验红 | 否 |
| N2 | N | 模板正式收录 `REVISE_PENDING_DEXTER` | 否 |

| 选择器来源冲突 | — | **维持 Dexter 二选一** | **是** |

**再审条件**：S2 闭合后，交互稿方可作为 implementation-facing 详设的输入；
Dexter 的看图与选择器来源二选一是下一步。

**授权边界**：本审核仅为只读审核与输出 review 文档。
未修改任何 IA、Roadmap、代码、契约、测试、生成物或运行环境；未启动 DEV、seed、reset 或动态运行。
**Claude 的 GO 仅表示交互稿可进入 Dexter 的下一步裁决，不构成 implementation authorization。**
