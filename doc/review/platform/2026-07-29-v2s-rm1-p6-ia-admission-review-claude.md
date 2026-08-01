---
title: RM1 P6 IA-01 / IA-02 准入复审（Claude）
reviewTarget: INTERACTION_DESIGN
scope: IA-01 + IA-02 current bytes（UI 详设准入复审）
verdict: GO
findings: M=0 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅 IA-01/IA-02 静态交互详设复审；不授权 implementation、DEV、动态运行、seed/reset、Roadmap 状态变更或 Git 操作
createdAt: 2026-07-29
---

# RM1 P6 IA-01 / IA-02 准入复审

## 0. 结论

**GO**，`M=0 / S=1 / N=3`。

上一轮的 S1（摹本）与 S2（foundation 绑定）**均已真实闭合**，且闭合方式正确：
S2 不是在 IA 里补几个词，而是**先改模板**（新增第九项强制声明）再逐屏落地，
并把 import 对账**诚实地标为"implementation-facing design 前置、当前未执行"**。
Dexter 的选择器裁决也已正确落地——Header 方案从可实施 screen 中移除，仅留作已拒绝来源。

唯一新发现的 S1 是一处**声明了休眠原语**：IA-02 的集团空间概览把
`createRefreshSignal` / `useRefreshVersion` 列为 foundation primitive，
而该机制在本仓**零生产订阅者**，且已被 P5 显式登记为休眠残留。
按当前设计它会被 import 对账门**强制导入**，等于把已收敛的 ST-9 问题重新打开。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。未启动任何动态环境。

**授权边界**：仅 IA-01 / IA-02 静态交互详设复审。不授权 implementation、DEV、动态运行、
seed/reset、Roadmap 状态变更或 Git 操作。

---

## 1. S（应修复）

### S1 ｜集团空间概览声明了零订阅者的休眠原语，会被 import 门强制复活

**owning source**
- `doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md`
  的 `IA02-PLATFORM-WORKSPACE-OVERVIEW`（`### Screen` 起于 `:273`）：

```text
BUSINESS_GOAL=阅读当前集团空间的业务概览，不在阅读任务中修改空间资料或状态
USER_VISIBLE_COPY=标题“集团空间概览”；区块“空间概览”“初始化情况”“账号访问”；按钮“刷新”；
                  某一资料暂时无法获取时按钮“重试”
FOUNDATION_PRIMITIVE=contextScopedQueryArgs, createRefreshSignal, useRefreshVersion, testId
```

**实际反例（本会话重开源码）**

`useRefreshVersion` 全仓检索（`apps/frontend` + `libraries/frontend`，排除 `node_modules`）
**只有三处，全部是定义与再导出，零生产消费者**：

```
libraries/frontend/admin-ui-foundation/src/index.ts:9            export {createRefreshSignal, useRefreshVersion}
libraries/frontend/admin-ui-foundation/src/behavior/index.ts:8   export {createRefreshSignal, useRefreshVersion}
libraries/frontend/admin-ui-foundation/src/behavior/refreshSignal.ts:30  export function useRefreshVersion(...)
```

P5 已就此作出登记（`doc/evidence/platform/rm1/p5/rm1-u08-claude-s1-problem-family.json:59`）：

> "RefreshSignal has publish sites but no production subscriber.
> RTK tags are the current write-refresh authority…"

处置为 `NOT_APPLICABLE_WITH_REASON` / `NOT_A_P5_FUNCTIONAL_DEFECT`——
即**有意保留为休眠残留，不是背书其复用**。

而该 screen 的真实需要只是"读页面上的刷新与资料级重试"。all-v2 的同页用的是
RTK query 自带的 `refetch()`：

```
catering-all-v2/apps/frontend/platform-admin/src/features/workspace-overview/ui/WorkspaceOverviewPage.tsx
  :17  {skip: !workspaceKey, refetchOnMountOrArgChange: true}
  :39  onClick={() => void detail.refetch()}      // 资料级重试
  :51  onClick={() => void detail.refetch()}      // 资料级重试
  :85  loading={detail.isFetching} onClick={() => void detail.refetch()}   // 刷新
```

**适用边界**

- **当前无用户影响**——P6 未实现，这只是声明。
- **但它是被强制执行的声明**：准备件 §4.2 规定
  「每一个 `FOUNDATION_PRIMITIVE` export 必须在该 screen 的实现路径…中导入」。
  该门一旦按契约落地，**会强制实现方 import 一个零订阅者的机制**——
  比不声明更糟：把休眠残留变成了强制依赖。
- **与 ST-9 冲突**：P1 的 authority ledger 把"写后如何刷新列表"收敛为单一权威，
  P5 复核确认 RTK tag 是该权威（139 处 `providesTags`/`invalidatesTags`）。
  复活 `refreshSignal` 会重新制造"多套刷新机制并存"。
- **不影响 `contextScopedQueryArgs` 与 `testId`**——这两项在该 screen 上成立，保留。

**建议的最小修复**

1. 该 screen 的 `FOUNDATION_PRIMITIVE` 改为
   `contextScopedQueryArgs, testId`（若刷新/重试确定走 RTK query 的 `refetch`，
   则无需额外 foundation 原语；也可按模板写
   `NONE_WITH_REASON:<刷新与重试由 generated RTK query 的 refetch 提供>` 说明该维度）。
2. 全量自查其余 22 个 screen 是否还有同类"名称存在但无生产消费者"的原语；
   本会话逐条核对结果为**仅此一处**（见 §2.3）。
3. 在模板对 `FOUNDATION_PRIMITIVE` 的说明中补一句：
   **所声明 export 必须是当前有生产消费者、或本轮即将建立首个消费者的活跃原语；
   已登记为休眠/待退役的 export 不得声明**，并在 §4.2 的 import 对账门中加一条对应红变异
   （声明一个零消费者 export 时必须红）。

**结论分类**：`CONFIRMED`
**是否需要 Dexter 裁决**：否（工程事实，非产品语义）。

---

## 2. 逐项核验结果

### 2.1 准入九项：全覆盖（上一轮 S2 已闭合）

```
IA-01：10 screen；CONSUMER_FACE/UI_SURFACE/HOST_AND_ENTRY/ACTOR/BUSINESS_SCENARIO/
       BUSINESS_GOAL/USER_VISIBLE_COPY/TECHNICAL_BOUNDARY 各 10；FOUNDATION_PRIMITIVE 10
IA-02：13 screen；同上各 13；FOUNDATION_PRIMITIVE 13
（CONSUMER_FACE 各多 1，为工件元数据块，非 screen）
```

**模板已先行修订**（`ui-interaction-design-template.md:45,48,146`），
把 `FOUNDATION_PRIMITIVE` 写成逐 screen 强制声明，并明确
「不是泛写"将复用 foundation"。每个名称必须能在…找到」。
**先改标准再改工件，顺序正确。**

`Surface ownership roster`：IA-01 **10/10 PASS**，IA-02 **13/13 PASS**，
上一轮的 `REVISE_PENDING_DEXTER` 随 Header 候选移除而消失（原 N2 关闭）。

### 2.2 核验点 5：Header 方案已降为历史冲突记录 —— `CONFIRMED`

- `IA02-PLATFORM-WORKSPACE-HEADER-CONTROL` **不再是 screen**（13 个 screen 中无此项）。
- `:326-328` 原文：「正式 v2 `admin-consumer-chrome-standard.md` 与 element ledger 曾把选择器放在
  Header；…裁决采用**左侧菜单底部**。因此 Header 仅作为已拒绝的来源候选留档，
  **不能再作为 UI screen、线框、…**」
- §3 表该行标 `DEXTER_DECIDED_SIDER_2026-07-29`，两侧来源 hash 均保留为记录。
- roster 表头：「本稿 **13 个可实施 screen**；Header 来源候选已拒绝」。
- **唯一残留的 "Header" screen 是 `IA02-OPERATIONS-SHELL-HEADER`**——
  那是运营后台的**任职切换器**，与平台后台的集团空间选择器是不同后台的不同控件，
  保留正确，不构成混淆。

### 2.3 核验点 4：foundation 声明真实性 —— `PARTIALLY_CONFIRMED`

对 foundation 的 30 个实际 export 逐条比对 23 个 screen 的声明：

- **零杜撰**：所有声明名称都是真实 export，未发现不存在的符号。
- **命中的原语与 screen 语义匹配**：Drawer 类声明 `useDrawerFormLifecycle` +
  `adminDrawerSurfaceProps`；详情入口声明 `useDetailDrawer`；Modal/Drawer 声明 `useOverlayLock`；
  含提交的 screen 声明 `useSubmissionLifecycle`；声明"未知结果先 readback"的 screen
  声明 `useAsyncGenerationGuard`；全部 screen 声明 `testId`。
- **唯一例外见 S1**：`createRefreshSignal` / `useRefreshVersion` 名称真实但无生产消费者。

**核验点 4 后半（不得把 import-equality 当作已执行的机器检查）—— `CONFIRMED` 且处理得当**：

准备件 §4.2 标题即为「final P6 foundation import equality（**implementation-facing design 前置**）」，
正文结尾原文：

> 当前 IA 还没有 final path，故本阶段只冻结此机械控制契约，
> **不能伪称 import check 已通过或越权修改实现 gate**。

本会话实测 `tools/verify-gates/cli.mjs` 中 `FOUNDATION_PRIMITIVE`/`foundationPrimitive`
命中 **0**——门确实尚未实现，与其自述一致。**未发现任何冒称已执行的表述。**

### 2.4 Heritage 对照与豁免记录 —— `CONFIRMED`

上一轮 Dexter 豁免静态摹本后，两份 IA 的 §3 第 4 列已全部改为显式豁免记录：

```
IA-01 4 行：DEXTER_WAIVED_2026-07-29；等价证据：R5 #<锚点> + …
IA-02 7 行：DEXTER_WAIVED_2026-07-29；等价证据：Claude IA review §1.2 …
IA-02 selector 行：DEXTER_DECIDED_2026-07-29；等价证据：本稿 #platform-wo…
```

**豁免没有替代原始来源**——`all-v2 path@SHA-256` 列原样保留；
差异理由列亦保留；后续实现责任由 §11 的严格设计输入承接。
IA-02 引用的"等价证据"指向本评审上一轮的字段级比对（7 项逐项一致），可追溯。

### 2.5 核验点 3：无凭空新增操作、无技术术语外泄 —— `CONFIRMED`

- `USER_VISIBLE_COPY` 中检索 `节点` / `pageKey` / `pageDesignKey` / `schema`：**0 命中**。
  文案使用"任职机构""可查看范围""集团空间"等业务称谓。
- 平台链路与 all-v2 的一致性在上一轮已逐条比对（无操作列、页头新建 + 名称链接、
  先关详情再动作、总览只读、三个幻影操作 all-v2 零命中），本轮 §3 表与 roster 未变，结论不变。
- 线框内混画 sibling（侧栏 / 另一 Header / 用户头像）：**0 命中**。

### 2.6 核验点 1 / 2 —— `CONFIRMED`

**IA-01 登录约束**：`LOGIN_FORM_PAGE_VERSION=@ant-design/pro-components@3.1.12-0`；
`LOGIN_FORM_PAGE_OFFICIAL_COMPOSITION` 逐项映射
`logo/title/subTitle/message/children/submitter/actions/activityConfig/background`；
线框为标识与标题**左右并列**、副标题在其下方独立一行，非三行堆叠，未用 `Card + Form`。
平台 OTP 仍标为来自 P-N1 的新增边界，且明写「G-05 …**不**是平台 OTP 的业务授权」。

**IA-02 v1/v2/v4 基线**：§4 已重开 v1 `OperationsShell.tsx@f60e206b…` 与
v4 `app.tsx@dbe4731644…`，两者均以 `menuFooterRender` 置于侧栏底部；
IA-02 的数据范围入口据此采用侧栏底部摘要控件 + 右下 Popover，
并明确不采用 v4 的 Redux/storage 范围状态与本地权限推导。**与 Dexter 的侧栏底部裁决一致。**

---

## 3. N（观察项，不阻塞）

**N1 ｜22 surface / 25 pageDesignKey 的 CARRY 对账仍未产出**
`结论分类：UNVERIFIED_REQUIRES_EVIDENCE`
已在准备件中列为 D5 / U09-G 的待交付分母。当前阶段合理（纯 CARRY 页沿用 v2 基线，
不需要独立 IA），但必须在详设中做成机械对账并配红变异，否则它是唯一能让页面无来源通过的通道。
**未覆盖边界**：本会话无法核验任何一页是否真有可引用的 v2/R5 基线，因为对账工件尚不存在。

**N2 ｜import equality 门尚未实现（契约已冻结，实现待 final path）**
`结论分类：CONFIRMED（如实标注，非缺陷）`
§4.2 已冻结该控制的契约，包括两类真实红变异（删掉已声明 import；以 local state/手写 lifecycle
重做同一共享行为）。**当前 `tools/verify-gates/cli.mjs` 中零命中，与其自述一致。**
建议在实现该门时一并加入 S1 建议的第三类红（声明零消费者 export 必须红）。

**N3 ｜视觉层未证明，且本阶段不需要证明**
摹本豁免后，布局/间距/控件尺寸未被任何工件约束。这本就不是低保真线框的职责
（模板 §4 明写"不是视觉稿或组件库规范"），且两份 IA 的 `DEXTER_HIFI_REVIEW=NOT_REQUIRED`。
**未覆盖边界**：若后续发现实现的视觉与 all-v2 差异较大，本轮 IA 不构成其依据，需另行处理。

---

## 4. 处置

S1 为工程事实，不需要 Dexter 产品裁决，交 Codex 修（改一处声明 + 模板补一句 + 门补一类红）。
N1–N3 不阻塞本轮。

**再审条件**：S1 闭合后即可。S1 未闭合不影响 Dexter 看图与接受，
但**不得进入 implementation-facing design**——否则 import 对账门会把休眠原语固化为强制依赖。

**本复审不授权**：implementation、DEV、动态运行、seed/reset、Roadmap 状态变更或 Git 操作。
未发现需要 `DEXTER_DECISION` 的产品或 Journey 歧义。
