# TER screenPart 机型解析 · 需求分析(第 9 版)

```text
DOC_KIND=REQUIREMENTS_ANALYSIS
AUTHOR=Claude
BUSINESS_SOURCE=DEXTER_DIRECT_REQUEST_2026-09-16
EVIDENCE_TIER=static;作者会话只读当前源码,未执行任何构建、测试或运行命令
AUTHORITY=需求分析,不是实施授权;下一步是详设与 IA
REVIEW_CYCLE=对抗式盲审两轮已完成(REVIEW_TARGET=DESIGN 上限两轮)
  第 1 轮 4 个 fresh 子 agent 合计 NO-GO 6M/13S/14N,intake 见 §9
  第 2 轮 3 个 fresh 子 agent 合计 NO-GO 4M/14S/8N,intake 见 §10
  Codex 实施可行性评审 NO-GO 5M/10S/3N,intake 见 §11(Codex↔Claude 经 Dexter 中转,不设轮次上限)
ROUND_FINAL_DECISION=SELF_DECIDED(盲审两轮上限已达;§11 属另一条评审通道,不重置该上限)
BLOCKED_ON=无。§8 两项已由 Dexter 于 2026-09-16 裁决,Codex M-01/M-02 随之关闭
修订史=v1 机型解析首版;v2 写入 Dexter 两项裁决并纳入 admin console 重排;
      v3 按澄清改写 R-11(全屏=最大化,不是新弹窗机制);
      v4 第 1 轮 intake:核心机制换成装配期按机型过滤(原"catalog 双键索引"方案作废);
      v5 第 2 轮 intake:**冲突检测前移到过滤之前**(与运行机型无关);
        更正"仓内无单机型 part"的事实错误;R-5 补第三态;R-13 改判(无横向滚动能力);
        R-4 砍掉拿不到的诊断字段;重做 U-1/U-2/U-7/U-9/U-12/U-14 并新增 U-15;
      v6 Codex 实施可行性评审 intake:**U-9/U-10 的视觉结论降级为不可机器判定**(ROI 差分只作辅助证据);
        更正 card 分母(9 处/8 组件)并补分区层 `bounded`;§4.1"零改动"措辞收窄;
        第三次改掉 token 名与组件 prop 词表的混用;U-15 改按归一化条目比较;
      v7 Dexter 两项裁决落地:**not-found 统一成容器内呈现,不再走启动失败页**(R-5 重写,
        收起开机画面的责任显式转移,v6 的"文案经入参传入"随之作废);
        **TR-13 改为检查装配输入而非 catalog**(与机型过滤解耦);
      v8 Dexter 方向"分清代码失败与业务失败、就绪不看业务失败":新增 R-15 失败分类与 R-16 就绪判定;
        发现 `runtime-unavailable` 一值三义必须先拆;**v7 的"收起责任转移/收起与就绪解耦"整条作废**
        (按新分类收起随就绪自然发生);**修订既有裁定 R-S1 与 R-S7**;
      v9 Codex 第 2 轮 intake(NO-GO 3M/6S/3N,三个 Major 全部成立):就绪与收起**收窄到目标 PRIMARY 物理表面**;
        R-10 拆成声明拆分(进机制批)与组件分化(留 admin 批);内容失败的可见呈现、identity 与传播链闭合;
        U-15 补比 `rendererBinding` 的 `layerTier`/`layerGuard`(此前恰好漏掉自己要防的那个缺陷);
        分类载体不再写死;Dexter 授权作者裁定的两项已定
文档边界=本稿写「必须成立什么」与验收要证明的性质;实现机制、API 形状、取值与 IA 细节列入 §7 交详设
路径约定=以 `apps/terminal/` 为根的路径省略该前缀;`tools/`、`doc/`、`project-memory/` 是**仓根**路径
```

## 0. 方向、核心目的与已定裁决

### 0.1 方向

> 每个 screenPart 定义自己的 partKey 和机型;partKey 可以重复,同 partKey 的不同机型各自对应不同组件,机型重叠时启动报错;展示时只指定 partKey,由系统按当前机型找组件,找不到就 log error 并显示页面找不到;容器可设默认 partKey;组件文件名标识机型。

**核心目的**:开发本组件时可以知道它将用在 mobile 还是 laptop,但在展示其他 screenPart 时,只需要关注 partKey,不用管对方的机型。

判据:**调用方只写 partKey,机型差异由系统吸收**。

### 0.2 已定裁决(Dexter 2026-09-16)

| # | 事项 | 裁定 |
|---|---|---|
| ① | "页面找不到"呈现什么 | **显示 partKey 与 surfaceForm**(写入 R-5) |
| ② | 是否借本批把真实 part 拆成双机型样例 | **拆 admin console,且包含它的全部子页面**;同时重排布局(R-10 至 R-14) |

Dexter 对 admin console 的要求与澄清:

> admin console 虽然是弹窗,但要全屏展示,不留 mask 区域。laptop 下以 master-detail 形式展示,本机信息要作为其中一个 tab。mobile 模式下与 laptop 不同,按 mobile IA 最佳实践定。虽然分了不同 component,但希望使用同一个 hook。
>
> (澄清)现在 admin console 打开后只占屏幕的一部分,但里面的内容比较多,我希望最大化显示,看着舒服一些。并不希望过度设计出另一套弹窗机制。

⇒ 全屏是**版式问题**。v2 的"呈现意图字段"方案已作废。

## 1. 当前实现事实

### 1.1 part 定义与 catalog 构建

`ui/base/render/src/foundations/definePart.ts:66-89` 产出 `catalogEntry` 与 `rendererBinding`;`:59` 的 `layerGuard` **默认 `'dismissible'`**。条目九字段见 `kernel/base/ui-state/src/types/catalog.ts:12-22`,其中 `surfaceForm` 是**闭合数组**(`:19`)。

**关键事实**:`ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-266` 在**同一处**完成三件事——汇总 `[...adminShellAssembly.parts, ...input.parts]`、`assertUniquePartKeys`、`createUiCatalog`/`createRendererCatalog`,而 `input.surfaceForm` 在 `:266` 就在手里。这是本稿新方案的落点。

`:268-273` 的 `startupReadiness.parts` 要求 catalog 内**每个**条目都能解析到 renderer,否则 `:352-354` 的 `writeComplete` 前置不满足会抛错。

**`createUiCatalog` 是公开导出**(`kernel/base/ui-state/src/index.ts:22`),测试侧可以绕开装配直接建 catalog,且**今天确实这么用**——见 §1.10。这决定了"唯一收口处"只在生产路径成立。

### 1.2 partKey 当前是全局唯一

`consoleAssembly.tsx:260` 与 `kernel/base/ui-state/src/foundations/catalog.ts:120` 各抛一次重复 partKey;索引 `byPartKey` 一对一(`types/catalog.ts:26`)。renderer 侧另有一次重复 `rendererKey` 抛错(`createRendererCatalog.ts:68-69`)。

### 1.3 机型如何参与

`isUiCatalogEntryAvailable`(`catalog.ts:141-158`)把五个维度一起判定,`:158` 判断机型包含。机型是一个值、启动时固定(`features/slices/surfaceForm.ts:15-27`),且与装配传入的是**同一个值**(`createUiStateModule.ts:80` 的 `createSurfaceFormSlice(input.surfaceForm)`)。

### 1.4 展示命令与容器状态

`show-screen` 载荷只有 displayMode、containerKey、partKey 与可选 instanceId/props(`features/actors/contentActors.ts:88-114`)——**已经不带机型**;`createShowScreenActor`(`:229-237`)不校验 catalog。对照 `createOpenLayerActor`(`:243-254`)在**派发期**校验并抛错。

容器初始为空(`foundations/workspaceSlices.ts:84-86`),**没有默认 partKey 概念**。

**容器记录是持久化的**:`workspaceSlices.ts:236-250` 序列化、`:311-321` 水合、`:461-471` `persistIntent:'owner-only'` 且 `storageKeyPrefix:'containers'`。`parseContainers`(`:311-321`)对非法记录静默丢弃,无诊断(layer 侧有)。

**layer 有启动期裁剪,容器没有**:`kernel/base/ui-state/src/application/createUiStateModule.ts:141-155` 在模块 install(启动链上、早于 `createSurface`)派发 `prune-hydrated-layers`,未完成即抛错;`contentActors.ts:311` 清掉"partKey 在 catalog 中不存在"的 layer 并记 `unknown-part` 诊断。**容器没有任何裁剪对应物**——这正是 R-6 要求恢复路径的原因。

### 1.5 解析失败今天是什么呈现(v3 有错已更正;v5 再补一个分支)

`ui/base/render/src/components/resolvePart.ts:30-34` 的 `RenderFallback` 本身只是空 `Text`。**但 `ScreenContainer` 会在满足门控时把它升级成启动失败页**:

- `ScreenContainer.tsx:87-110`:容器无记录 → `container-empty`,且在目标主表面渲染 `StartupFailurePage(reason='screen-fallback:container-empty')`;
- `:123-145`:其余四种终态 fallback(含 `missing-catalog-entry`、`incompatible-catalog-entry`)→ **同时**渲染 fallback 节点与 `StartupFailurePage`;
- `:129-135`:**只有 `resolved` 才挂 `ScreenReadyBoundary`**,也只有它会 `hideOnce('startup-ready')` 并宣告主屏就绪。

⚠️ **升级是有门控的,不是无条件的**:`:136` 要求 `terminalFallback && isTargetPrimarySurface`,`:93-97` 另要求 `status==='started'`、host 就绪且 `isHostPrimaryDisplay`。**在副屏、Web 预览与未承载表面上,not-found 今天只剩一个空 `RenderFallback`——用户什么都看不到**。R-5 必须覆盖这一分支(v4 把它漏了)。

日志侧已是 error 级、非 DEV 限定、按身份去重(`foundations/diagnostics.ts:59-83`)。

**收起开机画面在全仓只有两条路径,且与"宣告就绪"今天是捆在一起的**(R-15/R-16 正是据此设计;v7 曾据同一组事实得出"必须解耦"的结论,那个结论已作废,事实本身不变):

- `hideOnce('startup-failure')` —— `ScreenReadyBoundary.tsx:113`(`StartupFailurePage`)与 `:165`(`StandaloneStartupFailurePage`);
- `hideOnce('startup-ready')` —— `:253`,**只在 `onPrimarySurfaceReady` 之后**调用;
- 两条都以 `targetSurfaceState`(`:24-38`)命中目标物理表面为门:要求 surfaceKey/displayIndex 等于 `capability.targetPhysicalSurface`,且 `isHostPrimaryDisplay` 或主表面 host 不可用。

⇒ 今天"收起开机画面"与"宣告就绪"被 `ScreenReadyBoundary` 捆死,而就绪又要求排除**全部六种** fallback(R-S1 原文)。这正是 R-15 要拆开的东西。

**`runtime-unavailable` 是一个被重载的 token,一个值当三件事用**(v8 发现,这是失败分类必须先做的原因):

| 触发点 | 实际含义 | 今天的呈现 |
|---|---|---|
| `ScreenContainer.tsx:81-86` `root === undefined` 且 `status !== 'failed'` | **运行时还没起来(过渡态)**,不是失败 | 裸 `RenderFallback`,无失败页 |
| `:70-80` `root === undefined` 且 `status === 'failed'` | **系统失败**:runtime 起不来 | fallback + `StartupFailurePage(reason='runtime-failed')` |
| `:61-68` `surfaceHostAvailability === 'unavailable'` | **系统失败**:宿主表面不可用 | 目标主表面上是 `StartupFailurePage(reason='surface-host-unavailable')`,其余表面是裸 fallback |

⇒ 失败页那一层用了三个不同的 reason 字符串来区分,**但信息在 `RenderFallbackReason` 这一层被丢掉了**。因此"就绪只看系统层"在今天的类型上**无法正确实现**——分不清"还没起来"和"起不来了"。R-15 必须先拆这个重载。

`FAILURE_MESSAGE`(`:11`)是被两个失败页共用的模块级单常量——该事实在裁决①之后**不再对本稿有约束力**(not-found 不再使用失败页),仅保留为背景。

### 1.6 layer 的失败路径与 screen 不同

- 派发期:`contentActors.ts:248` 校验不可用即抛 `layer-part-unavailable`;
- 渲染期:`LayerStack.tsx:116-121` 把"条目存在但当前上下文不可用"的 layer **整条过滤掉**(连遮罩都不渲染),只有"条目不存在"才落 fallback;
- `LayerStack.tsx:66`(`tierRank`)、`:92`(`layerGuardOf`)另有两处 `byPartKey` 查找,**miss 时默认 `0` 与 `'decisive'`**;而 `:118` 对"条目不存在"的 layer 是**保留**而非过滤。三者叠加 ⇒ 一个 catalog 里没有的 layer 会渲染成**关不掉的空遮罩**(内容为空 fallback,遮罩点击与硬件返回都因 `decisive` 失效)。

  这个缺陷**不是被新方案消解,而是被新方案从不可达变为可达**:在 mobile 打开过、持久化下来的 mobile-only 浮层,换 laptop 启动时其 partKey 就不在 catalog 里。实际兜底是 §1.4 的启动期裁剪(该 partKey 整体缺席,正好命中裁剪条件),**兜底成立与否必须由判据锁住**(U-7b),不得默认它一直成立。

### 1.7 仓内已存在真实的单机型 part(v4 此处有错,已更正)

v4 说"四个包的全部 part 都声明 `['laptop','mobile']`"——**错**,那只枚举了 feature 包与 admin-shell,漏了 integration 本地 parts。

**事实**:`ui/integration/sample-wallpaper-console/src/parts/parts.ts:9,18,31` 有两条 part 声明 `surfaceForm: laptop`(`laptop = ['laptop'] as const`),即 `sample.wallpaper-console.waiting` 与 `sample.wallpaper-console.welcome`。它们经 `src/assembly/assembly.tsx:62-66` 进入装配。

**这两条对 R-8 的意义**:按 R-1 过滤后,mobile 装配的 catalog 会**少这两条**——所以"过滤后 catalog 与今天完全一致"不成立,R-8 的零回归必须改按**可渲染行为**论证:两条 part 的 `displayModes` 都是 `['SECONDARY']`(`parts.ts:15,28`),而 mobile 走 portrait 声明、portrait 禁止 SECONDARY(`src/application/terminalSurfaces.ts:28-31,57-59`),`assembly.tsx:58` 按机型取声明 ⇒ mobile 下本就没有副屏可承载它们。**catalog 内容变、可渲染行为不变**。

**顺带的收益**:这是仓内现成的单机型样本,U-1/U-7 的零回归对照不必全靠新造夹具。

**另:调用侧今天并非完全不感知机型**:`ui/feature/sample-member-desk/src/features/actors/actors.ts:45-46` 按副屏可用性分支,而副屏有无由机型决定。R-3 已为此划边界。

### 1.8 admin console 现状

| 事实 | 位置 |
|---|---|
| console 是 layer part,`containerKeys: []`、`layerGuard:'decisive'` | `ui/base/admin-shell/src/parts/parts.ts:15-27` |
| 四条 admin part 全声明双机型(`:8` 的 `allForms`,用在 `:22,36,49,62`) | `parts.ts` |
| 四条都是 `rendererKey === partKey` | `parts.ts:16-17,30-31,43-44,56-57` |
| **`layerGuard` 只有 console 显式写了 `'decisive'`;三个分区没写 ⇒ 取默认 `'dismissible'`** | `parts.ts:26`;默认值见 `definePart.ts:59` |
| 根容器用小卡片版式 `layout="card" bounded` | `components/AdminShell.tsx:57` |
| 小卡片版式带宽度上限:`containerCard` = `w-11/12 max-w-xl self-center …`(≈576dp) | `ui/base/primitives/src/theme/tokens.ts:4` |
| **版式词表共七项**;其中 `container` 是 `flex-1 …` **无 `w-full`**,`containerContent` 是 `w-full …` **无 `flex-1`**;`bounded` 是正交开关 | `tokens.ts:2-8`、`components/PrimitiveContainer.tsx:8-32` |
| 组件 API 实际词表是 `layout='fill'\|'content'\|'card'\|'centered'\|'transparent'` + `bounded` | `PrimitiveContainer.tsx:8` |
| 浮层容器同时有 `alignItems:'center'`、`justifyContent:'center'`、`padding:24`,外加整屏遮罩 | `ui/base/render/src/components/LayerStack.tsx:41-58` |
| 遮罩点击对 `decisive` 层无效;**硬件返回键对 decisive 层被吞掉且不做任何事** | `LayerStack.tsx:179-199`、`:201-209` |
| **card 版式的生产调用点共 9 处、8 个组件**(v5 说"7 个"是错的);其中**只有 `AdminShell` 的两处传 `bounded`** | member-desk 四个(`WaitingConfirm.tsx:30`、`DiscardConfirm.tsx:30`、`WithdrawConfirm.tsx:29`、`RegistryNotice.tsx:28`)、`AuthNotice.tsx:25`、`SystemFailureNotice.tsx:27`、`AdminLogin.tsx:103`、`AdminShell.tsx:35` 与 `:57`(同组件两个分支) |
| ⚠️ **`bounded` 不止用在 card 上**:content 版式层与四个分区组件也都传了 `bounded` ⇒ R-11 去掉统一留白后,`maxHeight:'100%'` 的解析基准变化会**同时冲击分区层**,不只是浮层那一层 | `AdminShell.tsx:83`、`sections/SampleSection.tsx:5`、`sections/PlatformPortsSection.tsx:51`、`sections/RuntimeSection.tsx:8`、`sections/DisplayContextSection.tsx:12` |
| **`PrimitiveScrollView` 没有 `horizontal` 能力**:props 仅 `{testID, children, layout, onLayout, onScrollOffsetChange}`,且 `onScrollOffsetChange` 写死读 `contentOffset.y` | `components/PrimitiveScrollView.tsx:17,48-52` |
| 分区导航用 `PrimitiveGrid`(`flex-row flex-wrap`),**换行排布今天就能做** | `AdminSectionNavigation.tsx:14` |
| App 的 tailwind content **只扫** `App.tsx`、`src/**`、对应 integration 的 `src/**`、`primitives/src/**`;**不扫 admin-shell 与 render** | `assembly/android/sample-terminal/tailwind.config.cjs` |
| 本机信息当前是全局 header 三行,且与"显示上下文"分区内容重叠 | `AdminShell.tsx:58-77`、`sections/DisplayContextSection.tsx:15-25` |
| 分区来源按容器从 catalog 过滤,已按机型过滤 | `foundations/adminSectionSelection.ts:6-9` |
| 导航 a11y 角色是 `tablist`/`tab`,label 为 `选择${section.title}` | `AdminSectionNavigation.tsx:14,19-20` |
| layer 挂载时切换焦点域,卸载时还原 | `AdminLayer.tsx:41-44` |
| testID 由 partKey 映射;公共面被 invariant 以 `toEqual` 精确锁定 | `foundations/adminTestIds.ts:18-24`、`test/publicSurface.test.ts:28` |

### 1.9 验证设施的真实能力(第 2 轮补,决定 §5 怎么写)

- `sampleAssembly.test.tsx` 挂载的是**真实生产装配** `createSampleAssembly`,可驱动真实手势、真实持久化与跨 assembly 冷重启(`:780-836`),并能断言 style prop(`StyleSheet.flatten`,`:164`、`:889-892`)。
- **但没有布局引擎**:一切尺寸由测试自己 `onLayout` 注入(`:131-145`)。任何"宽/高/铺满"都是注入值而非计算值 ⇒ 像素级结论在单测中**不可判定**。
- **仓内有截图与像素比较能力**:`tools/terminal-sample2/run-u8-release-cold-start.mjs:122` 走 `adb exec-out screencap`;`tools/terminal-image-compare/compare.mjs` 提供 ROI/mask/阈值比较。⚠️ 它是 **before/after 差分器**(`PIXEL_CHANGE_THRESHOLD`、changedFraction),**不能单独充当"铺满"的绝对 oracle**,但可以证明"同一 ROI 在改前后发生了预期方向的变化"。

### 1.10 既有冻结断言会与生产语义脱钩(第 2 轮发现)

`ui/integration/sample-console/test/sampleAssembly.test.tsx:340-345` 与 `:364-368` 用 `createUiCatalog(createSampleDefinedParts().map(({catalogEntry}) => catalogEntry))` **直接构造 catalog**,再对 laptop 与 mobile 两个 context 断言。

其中 `:348` 那条测试的名字是 **"keeps the production admin test section available in both laptop and mobile"**,但它在 `:364-368` 断言的正是手搓 catalog。

⇒ 按 R-1 过滤后,这两处**照样全绿,却已不代表生产 catalog**。它们是 U-1/U-2 最省力的假绿路径,必须在判据里堵死并给出处置(R-1、U-1)。

### 1.11 必须尊重的既有约束

- **TR-12**(`doc/platform/terminal-coding-standard.md:499-543`):kernel/feature 零 partKey 字面量,partKey 不离开拥有它的 ui/feature 包。有门。
- **TR-13**(同文件 `:549-586`):四条形态要求,其中第 2 条原文是"assembly 的**唯一** `UiCatalog`/renderer catalog 必须包含 `...adminShellAssembly.parts`";**无机器门**,由 focused test 与评审承接。⚠️ 按 Dexter 裁决②,第 2 条与"反例栏"里"未把 admin parts 放进该 catalog"一句都要改成**对装配输入**断言,见 §8②。其余三条(依赖声明、`AdminLauncher` 包裹、不得自建 admin 身份与入口)不受影响。
- catalog 九字段被 `tools/terminal-ui-state/check-static.mjs:297-305` 逐字锁定;`ui/base/render` 内禁 partKey/containerKey 字面量(`tools/terminal-ui-render/check-static.mjs:228-246`)——注意 **`ui/base/console-assembly` 不在该禁令内**。
- §7.1 `src/` 目录词表(标准 `:732-757`)允许 `hooks/`(一文件一 hook、`useX` 命名);该节是**目录**词表,不是文件命名规则的落点。
- 既有裁定 R-S1(就绪定义排除**全部六种** fallback,并逐条点名了那四种业务类)与 R-S7(终态失败收起开机画面并显示失败页)见 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md` §3.2;该文 U8 判据还把"把任一 `RenderFallbackReason` 当作就绪"列为绕过形态。⚠️ **本批按 Dexter 方向③修订这两条裁定及其判据**,四处修订面见 §8——引用它们的原文之前先看 §8。
- 机器门红线见 `project-memory/operations/verification-governance.md`:门必须驱动 production 本体并有会改变行为的 red mutation。

## 2. 与目标的差距

| 目标 | 现状 | 差在哪 |
|---|---|---|
| part 声明 partKey 与机型集合 | **已支持** | `surfaceForm` 已是闭合数组 |
| 同 partKey 多条目、重叠即启动报错 | **不支持** | 两道断言禁止重复 partKey(§1.2) |
| 展示只指定 partKey | **已支持** | 载荷不含机型(§1.4) |
| 按当前机型选组件 | **不支持** | 一个 partKey 只有一个条目 |
| 找不到时 log error | **已支持** | §1.5 |
| 找不到时显示可见的"页面找不到"并带定位信息 | **不支持** | 主屏显示的是启动失败页、副屏/预览什么都不显示(§1.5);按方向③它属内容失败,要在**所有表面**统一成容器内可见呈现,并在**目标 PRIMARY 物理表面**照常就绪 |
| 失败分层(系统 / 业务 / 过渡)可判定 | **不支持** | 分类散落在组件条件里(`ScreenContainer.tsx:123-125`),且 `runtime-unavailable` 一值三义(§1.5) |
| 容器默认 partKey | **不支持** | 容器初始为空;且失效记录无恢复路径(§1.4) |
| 组件文件名标识机型 | **无规则** | §1.11 |
| admin console 最大化显示 | **不支持** | 小卡片版式 + 居中 + 24 留白(§1.8) |
| laptop master-detail / 本机信息成 tab / mobile 独立形态 | **不支持** | 当前单一布局,本机信息常驻 header |
| 两机型组件共用一个 hook | **可以做到** | §7.1 允许 `hooks/`;当前无该目录 |

## 3. 需求

### 3.1 机型解析

**R-1 装配期按本机机型过滤 parts(核心机制)**
- 装配 catalog 时,按本次运行的机型过滤条目:只有声明包含当前机型的 part 进入 catalog 与 renderer catalog。
- 过滤必须发生在**汇总全部 part 之后、建 catalog 之前**的唯一收口处,不得由各 feature 或各 integration 各自过滤(否则漏一处就静默失效)。
- 过滤后 catalog 的 partKey 仍**全局唯一**,因此索引、解析、浮层、持久化身份、诊断一律不变。
- **必须登记的代价(第 2 轮)**:过滤所用机型与 `createUiStateModule.ts:80` 注入状态的是同一个值,因此 `catalog.ts:158` 的机型判定及其全部下游(`resolvePart`、`LayerStack`、`contentActors`、`adminSectionSelection`)在**生产路径上恒为真**。
  - 本批**不删除**该判定(它仍守着 §1.1/§1.10 的非装配构造路径),但**不得为它建门**,按 `UNENFORCEABLE_BY_MACHINE` 登记;
  - 既有依赖该判定的测试**不再代表生产语义**,必须按 U-1 改为经真实装配取 catalog,§1.10 点名的两处须给出处置。

**R-2 冲突检测前移,与运行机型无关(第 2 轮改写)**
- v4 曾靠"过滤后出现两条同 partKey、由现有重复断言报错"来检测冲突。**该形态已废弃**,因为它只能在受影响机型启动时暴露(laptop 启动发现不了只影响 mobile 的冲突),补偿手段只有一条 focused 测试。
- **改为**:在**过滤之前**,对未过滤的全部 part 按 partKey 分组,检查同组机型集合是否相交;相交即启动报错。
  - 代价与前者相当(同一函数内的一次分组遍历),**不新增机制、不新增门、不新增文件**;
  - 收益:**在实际汇总了该 parts 集合的那次装配里,任何机型启动都能发现该集合内的任何冲突**,不再有"暴露面收窄"这一已知边界;
  - ⚠️ 作用域限定(Codex N-03):它管不到**没被任何装配汇总进来**的 part。若两个 integration 各自汇总不同集合,各自只对自己的集合负责——这是正确行为,但详设须写明,别让人误读成"全仓冲突检测";
  - 错误必须指明 partKey 与重叠的机型;
  - 输入边界须一并定义:空机型集合、同一条目内重复机型、只有一条同 partKey 条目时的行为。
- 过滤后既有的 `assertUniquePartKeys` 与 `createUiCatalog` 重复断言**保留为兜底**,不因前移而删除。

**R-3 展示侧只认 partKey**
- 展示命令载荷不得新增机型参数;TR-12 不变。
- **在 part 解析路径上**,调用方不得感知机型:不得按机型拼 partKey,不得读 surfaceForm 后自行选组件。
- ⚠️ 本条不否定既有的 surface/副屏能力判断(§1.7 的 `hasSecondarySurface` 等):那是"这台设备有没有副屏",不是"该 partKey 用哪个组件"。详设须把两者的边界写清,不得借本需求扩大到改副屏探测。

**R-4 找不到组件时的行为(screen 与 layer 分别定义)**
- **screen**:当前机型无对应条目 → 记 error(含 **partKey、当前机型、containerKey**)+ 按 R-5 呈现。
- ⚠️ **v4 曾要求 error 同时报出"该 partKey 声明过哪些机型",本版删除**。理由:过滤后该条目根本不在 catalog 里,运行期拿不到;要取回就得把一张"被过滤条目"表从装配期穿透到 render 层,而 Dexter 裁决①只要求呈现 partKey 与 surfaceForm。冲突本身已由 R-2 在启动期堵住,这个字段不值一张跨层的表。
  - 若详设发现 R-2 的分组结果**顺带**已可用且穿透成本可忽略,允许作为**可选增强**加回,但不得为它单独设计数据通道。
- **layer**:保持现状——派发期校验拒绝(`contentActors.ts:248`)、渲染期整条过滤(`LayerStack.tsx:116-121`),**不改为可见 not-found**。理由:浮层是叠加物,静默消失比弹出一张错误浮层更符合预期,且改动会波及遮罩与焦点。
- 两条路径的差异必须在详设中写明,不得让实现方自行统一。

**R-5 "页面找不到"是业务失败,在容器内正常呈现**(Dexter 裁决① + 方向 2026-09-16)

Dexter 的原话:找不到 screenPart 属于**业务失败**,跟登录密码错误同级,是开发人员不断体验、测试、调优去解决的;而**开机启动就绪的判定,不看业务失败**。

- **一种形态,不分场景**:所有 not-found 一律在**容器内**呈现可见的"页面找不到",含 **partKey 与 surfaceForm 定位码**。不分首次就绪前/后,不分主表面/副屏/Web 预览,**一律不走启动失败页**。
- **它不阻碍就绪,但就绪与收起只发生在目标 PRIMARY 物理表面**(Codex M-02 纠正 v8 的无差别措辞):
  - **所有表面**都照常显示内容失败的可见呈现;
  - **只有目标 PRIMARY 物理表面**的内容失败参与就绪与收起开机画面;
  - **SECONDARY 与 Web 预览不执行收起**——那里本来就没有原生开机画面,也不得参与 PRIMARY 就绪;
  - 系统失败页同样**只在目标 PRIMARY 物理表面**显示,其他表面保持中性 fallback(这与既有 R-S7 "SECONDARY 任何阶段都不显示全屏失败页"一致,不构成新的修订)。
- **四种内容失败各自的可见呈现都要定义**(Codex M-03):不得只定义 `missing-catalog-entry` 一种而让其余三种继续渲染空 `Text`——`invalid-props` 尤其容易被漏掉。
  - ⚠️ v7 曾要求"把收起开机画面的责任单独转移过来、收起与就绪解耦",**本版作废**。那是把 not-found 当启动问题处理的产物;按新分类它根本不在启动这条轴上,收起自然发生,不需要任何专门通道。
  - 同样作废的还有 v6 的"失败文案经入参传入"——not-found 不使用失败页。
- **要暴露就暴露完整**:not-found 必须画出**带信息的可见内容**(partKey + surfaceForm),不能只渲染今天那个空 `Text`。
  - ⚠️ 作者曾把理由写成"否则白屏、比今天更糟",**该说法已被 Dexter 纠正并撤回**。白屏本身是诚实的,它确实说明系统有问题;而今天主屏上那句"终端启动失败 / 请重启终端"对一个**业务失败**是**误导**——重启补不出缺失的组件条目,它会把运维支使去重启一台根本不用重启的机器。今天的行为不是更好,只是更吵。
  - 真正的理由是:**"暴露"和"写清楚"之间没有取舍**。`RenderFallback` 今天渲染的就是一个带 testID 的空 `Text`,把它换成带字的 `Text` 是同一个组件加一个字符串,复杂度完全相同。既然不花钱,就不该让开发看到白屏后还得去翻日志才知道是哪个 partKey 在哪个机型下没有条目——那个信息此刻就在手边。
- 文案不得沿用"请重启终端"——重启补不出缺失的组件条目,这条提示会把业务失败误导成设备故障。
- 日志仍记 error(含 partKey、当前机型、containerKey),但 category 必须与系统失败可区分(R-9)。

**R-6 容器默认 partKey**
- 容器可声明默认 partKey;该容器无记录时按默认值渲染,默认值同样经 R-4/R-5 处理。
- **默认值是读时派生,不得写入容器表**(否则与用户选择不可区分,且改默认对存量设备永久失效)。
- 传递链必须走 integration → console-assembly → surface → 容器;**禁止**把业务 partKey 字面量写进 `ui/base/console-assembly`(该包不在 render 的字面量禁令内,是最自然的捷径)。
- **失效记录必须可恢复,且必须与 R-1 同批交付**:容器记录会持久化且今天没有裁剪对应物(§1.4)。按 R-1 过滤后,一条跨机型的容器记录会让设备**每次冷启动都停在 not-found**(按 R-5 即容器内的"页面找不到";按 R-16 它在目标 PRIMARY 物理表面照常就绪,所以设备不会卡在开机画面,但每次冷启动都停在一个找不到内容的空壳上)。详设须给出恢复路径(容器裁剪、或 not-found 时回落默认),二选一并说明理由;**D-11 的分批安排不得把本条推迟到 R-1 之后的批次**。
  - **实施方倾向(Codex,需求层记录,不替代详设论证)**:选"not-found 时读时回落默认",不删用户持久化记录、也不把默认值写回容器表。理由是它比新增容器裁剪机制加写回状态更小。⚠️ 这只是倾向,详设仍须论证它在"记录指向的 part 以后又回来了"这一场景下的行为是否可接受。
- 有默认值后,"容器为空"不再是启动失败信号(§1.5 `:87-110`),该信号改由默认 part 的解析结果决定;详设须写明。
- ⚠️ 术语对齐:Dexter 说的"uiVariable 中没有记录"对应的是**内容状态的容器表**,不是 `uiVariable` 键值机制;不得实现进 uiVariable 槽。

**R-7 组件文件命名**
- 双机型组件不带机型标识;单机型组件必须带。
- 推荐 `AdminConsole.laptop.tsx` / `AdminConsole.mobile.tsx`。⚠️ **该扩展名与 Metro 平台解析是否冲突尚未核实**(Codex N-01),详设必须先核这一步再定命名形态——若 Metro 把 `.mobile.tsx` 当平台后缀处理,整套推荐作废,须另选形态(例如 `AdminConsoleMobile.tsx`)。
- 规则**新开条目**写入标准(§7.1 是目录词表,不是文件命名的落点)。
- **裁定为 review-only(第 2 轮直接收口,不再留给详设试)**:命名门唯一可做的 red mutation 是改文件名,而改名**不改变 production 行为**——import 同步改则一切照绿,不同步改是 `tsc` 先红而非门的功劳。⇒ 必然过不了 `PRODUCTION_RED_MUTATION_REQUIRED`,按 `UNENFORCEABLE_BY_MACHINE` 登记。
- 详设须补的是**谁在哪一步人工核**:`tools/code-layout/cli.mjs` 只管目录词表与 flow/scenario 命名,不覆盖组件文件名,这块今天是真空。

**R-8 零回归(第 2 轮改写论证方式)**
- v4 说"现有 part 全是双机型,过滤后 catalog 与今天一致"——**该前提已被证伪**(§1.7)。
- 改按**可渲染行为**论证:过滤后 mobile 的 catalog 会少 `sample.wallpaper-console.waiting` / `.welcome` 两条,但这两条 `displayModes` 只有 `SECONDARY` 而 mobile 无副屏承载 ⇒ **catalog 内容变、可渲染行为不变**。零回归判据必须按"行为"而不是"catalog 等价"来写(U-7)。
- 浮层的层级、可关闭性、遮罩与焦点行为不得改变。
- **跨机型的持久化浮层记录必须在启动期被既有裁剪清除**(§1.4、§1.6):不得出现"关不掉的空遮罩"。持久化记录只存 partKey,机型永不得进入持久化身份。

**R-9 诊断与可观测**
- `parseContainers` 今天对非法记录静默丢弃且无诊断(§1.4),与 layer 侧不一致;详设须对齐,否则水合损坏会伪装成"无记录"并被默认值掩盖。
- 裁剪诊断的 `unknown-part` 语义会扩大:过滤后它同时涵盖"已下线的 part"与"另一机型的 part"。两者的运维含义不同,详设须区分或改写文案,避免把正常的跨机型清理读成故障。
- **诊断必须按失败类别分流**(R-15):系统失败与业务失败要落在可区分的 category 上,运维才能把"终端坏了"和"页面配错了"分开看。今天两类混在同一条 error 流里。

**R-15 失败分类做成一等概念(Dexter 方向 2026-09-16)**

- **两类失败 + 一个过渡态,必须在类型上可判定**,不得靠散落在组件里的字符串条件:
  - **系统失败**:渲染机制本身不在——runtime 起不来、宿主表面不可用、条目存在却解析不到 renderer。语义是"终端坏了",走失败页,R-S7 管这块。
  - **业务失败**:该画的内容不在或不合法——`missing-catalog-entry`、`incompatible-catalog-entry`、`container-empty`、`invalid-props`。语义是"终端好好的,内容不对",在容器内正常呈现,**不影响就绪**。
  - **过渡态**:运行时尚未起来。**既不就绪、也不报失败**,维持今天的等待呈现。
- **必须先拆掉 `runtime-unavailable` 的重载**(§1.5):它今天同时表示过渡态、runtime 失败、宿主不可用三件事,而失败页那层已用三个不同 reason 区分。要求拆成语义单一的值(至少区分"未就绪的过渡"与"终态系统失败"),让失败页那层已有的区分在类型上可见。
- **分类必须在类型上可判定,消费方不得枚举 reason 字符串**:解析结果一次性带上类别,`ScreenContainer` 据类别决定"挂就绪边界 / 走失败页 / 继续等待"。
  - ⚠️ **载体交详设,本稿不写死**(Codex N-03 纠正 v8):v8 曾要求"必须挂在 `RenderFallbackReason` 上",那是实现载体选择而非需求。带 category 的 discriminated outcome 同样满足,且可能更合适;不得为此新增全局 taxonomy 或 AST 门。
- **分类轴是"是否阻断就绪",不是责任归属**(Codex S-02):`invalid-props` 按责任更像调用方的代码缺陷,但按行为它不阻断启动,所以归内容类。本稿用"业务失败"承接 Dexter 的原话,正式定义以**内容失败**为准——它只表达就绪与恢复语义,**不表达是谁的错、也不表达严重度**。
  - 理由(长远):将来新增第七种 reason 时,类型会强迫作者回答"这属于哪一类",而不是让它悄悄落进某个 `!== 'x' && !== 'y'` 的缝里——`ScreenContainer.tsx:123-125` 今天正是这种写法。
  - 附带收益:这给了机器门一个真判据——把某个 reason 改类别,就绪与失败页行为必须可见地变化。
- ⚠️ **这会修订既有裁定 R-S1**(见 §8):R-S1 原文要求就绪排除**全部六种** `RenderFallbackReason`;按新分类,业务失败**算就绪**。R-S7 同步收窄到系统类。

**R-16 就绪判定只看系统层(Dexter 方向 2026-09-16)**

- **就绪 = 被开机画面覆盖的那块物理表面首次画出了东西并完成首次布局**,无论画的是业务内容还是业务失败提示。
- 内容失败**照常**挂就绪边界、宣告就绪、收起开机画面,**但仅限目标 PRIMARY 物理表面**(R-5)。R-E3 关于"按物理表面判定"的重定义不变,变的只是"什么内容算数"。
- 过渡态与系统失败**不就绪**:前者继续等,后者走失败页(失败页本就自带收起,R-S7)。
- **就绪事件必须带出当前是不是内容失败态,并且要沿整条链传到底**(Codex M-03):否则运维无法区分"正常启动"与"启动了但页面配错了",而这两者在新定义下都会上报就绪。这是必要配套,不是可选增强。
  - 传播链**逐点都要改到**,只改就绪边界会漏:`types/props.ts` 的 ready input → `ScreenReadyBoundary` 的构造与上报 → `consoleAssembly` 的 `startup-ready`/`primaryRealReady`/`startup.complete` → `startupDiagnosticsWriter` → 两个 integration 的 `module.ts` payload 与 actor 日志 → 相关 focused test。
  - **`readyPartKey` 允许为空**(Dexter 授权作者裁定 2026-09-16):无记录又无默认值的 `container-empty` 场景下**根本不存在 partKey**,编一个稳定诊断 token 是撒谎,而且那种魔法字符串必然漏进看板被当成真 partKey。定为 `string | null` 加一个类型化的失败原因字段,**消费方必须显式处理空值**;详设须逐个核对上述消费点对空值的处理。
- ⚠️ **连带的语义漂移,详设须裁定**(作者自查补):`ScreenContainer.tsx:59` 用 `failureStage = hasPrimarySurfaceReady ? 'runtime' : 'startup'` 选失败页的档位。按本条,一台落在业务失败上的终端**已经宣告就绪**,于是它之后若 runtime 真的挂掉,失败页会显示"终端运行异常"而不是"终端启动失败"。
  - **已裁定:接受这个漂移**(Dexter 授权作者裁定 2026-09-16,不再是"作者倾向")。终端确实已经起来了,只是内容没配对,后续崩溃按运行期报是诚实的;要维持"启动失败"就得再加一个"是否曾渲染出真实业务内容"的锁存器,为一句文案新增一套状态机,不成比例。
  - 信息需求由"就绪事件带出内容失败态"覆盖,运维不必靠失败页标题去猜。
  - 判据:该漂移必须被**显式断言**(内容失败就绪后再触发系统失败,失败页显示运行期档位),不得作为无人验证的默认继承。

### 3.2 admin console 拆分与重排

**R-10 拆分范围与兄弟条目一致性**
- console 本体与全部子页面拆成 mobile / laptop 两个条目,同 partKey、机型不相交。
- partKey 保持现值,因此 testID 映射不变。
- **兄弟条目的 `rendererKey` 必须各自唯一**(今天四条 admin part 是 `rendererKey === partKey`,§1.8)。两个不同组件共用一个 renderer 身份在语义上是错的,且会在任何未过滤地构造 renderer catalog 的路径上撞 `createRendererCatalog.ts:68-69`。
- **兄弟条目除 `surfaceForm`、`rendererKey`、`component` 外,归一化后的语义字段必须相等**(Codex S-01:v8 写"逐字相同"与 U-15 的"归一化相等"自相矛盾,此处统一为归一化口径)——穷举为 `catalogEntry` 的 `partKey`、`containerKeys`、`displayModes`、`workspaces`、`instanceModes`、`title`、`description`,**外加 `rendererBinding` 上的 `layerTier` 与 `layerGuard`**。
  - ⚠️ `layerTier`/`layerGuard` **不在 `catalogEntry` 里**(`definePart.ts:71-81` 只有九个字段,二者在 `:82-87` 的 `rendererBinding` 上)。只比 `catalogEntry` 就**恰好漏掉本条要防的那个缺陷**——某个兄弟漏写 `layerGuard` 导致该机型的 console 静默变成可点遮罩关闭。
  - 顺手的性质:`definePart.ts:69-70` 是先归一化再写进 binding,所以直接比 binding 上的值天然就是归一化比较——"省略"与"显式 `dismissible`"相等,"省略"与"显式 `decisive`"不等,正是需要的语义。
  - 理由:`layerGuard` 默认 `'dismissible'`(`definePart.ts:59`),而 console 是**唯一显式写 `'decisive'`** 的那条(`parts.ts:26`,§1.8)。某一机型的兄弟漏写这一行,该机型的 console 就**静默变成可点遮罩关闭**,今天没有任何判据能发现。
  - 风险面因此高度集中在 console 本体;三个分区本就取默认值,但仍按同一规则约束,避免"哪些字段要对齐"靠人记。立 U-15。
- 允许复用公共呈现子组件;**不允许**单组件内 `if (surfaceForm)` 冒充拆分。
- 拆分后源码层 admin 条目由 4 变 8,**运行期每种机型仍只注册 4 条**(R-1)。按 Dexter 裁决②,TR-13 改为**检查装配输入**(过滤前是否整份传入 `adminShellAssembly.parts`),不再对 catalog 断言,见 §8②。

**R-11 最大化显示**
- console 根容器不再使用小卡片版式;要达到"铺满",必须同时处理三件事,缺一不可:
  1. 根容器的 `layout`/`bounded` **prop 取值**——⚠️ 这里必须分清两层词表,v4 修过一次、v5 又写混了:**组件 prop** 只接受 `'fill'|'content'|'card'|'centered'|'transparent'`(`PrimitiveContainer.tsx:8`),而 `container`/`containerContent`/`containerCard` 是它内部映射到的 **token 名**(`tokens.ts:2-8`)。要害在于 `fill` 映射的 token 无 `w-full`、`content` 映射的 token 无 `flex-1`,所以**单换一个 prop 值不够**;详设须同时写明选哪个 prop 值、它映射的 token 是否满足,以及不满足时补什么 RN 样式;
  2. 浮层包裹层的 `alignItems`/`justifyContent` 居中(否则横向仍按内容宽收缩);
  3. 浮层包裹层的 24 留白。
- console 铺满后遮罩被完全覆盖,**"不留 mask 区域"随之成立**,不需要 no-mask 开关。
- **明确不做**:不新增 part 字段、renderer binding 字段、第二套 layer 机制、新版式 token 语义。
- **样式来源受限**:App 的 tailwind content 不扫 admin-shell 与 render(§1.8),新 utility class 不会被生成;只能用 primitives 既有 token 或 RN 样式。
- **零回归含垂直轴,且分母是两层不是一层**(§1.8):
  - **浮层层**:9 处 card 调用点 / 8 个组件,其中只有 AdminShell 的两处传 `bounded`。去掉统一留白后,内容高于视口的浮层会贴边或溢出。
  - **分区层**:content 版式层与四个分区组件也传 `bounded`,`maxHeight:'100%'` 的解析基准同样会变——v5 只分析了浮层层,这一层是作者自查补的。
  - 详设须**逐调用点**给出处置(建议把留白下放给各浮层自带),并说明分区层的高度约束在新版式下以谁为基准。

**R-12 laptop:master-detail,本机信息成为其中一个 tab**
- 左侧分区列表、右侧详情同屏;顶部只留标题与关闭。
- 本机信息不再常驻 header;复用已包含这三项的"显示上下文"分区,标题按 IA 定稿。
- a11y 角色随之变化(tab → 列表项),焦点落点与返回后的焦点恢复必须定义。

**R-13 mobile:换行分区条 + 单内容区(第 2 轮再改判)**
- 同样铺满。
- **首选形态**:**换行(flex-wrap)分区条 + 单一内容区**,与 laptop 同构。
  - v4 曾写"横向可滚动分区条",**该形态今天做不出来**:`PrimitiveScrollView` 没有 `horizontal` 能力且滚动偏移写死读 `y`(§1.8)。要做就得扩 primitives,直接撞 §6 的"不新增"。
  - 换行分区条用 `PrimitiveGrid`(已是 `flex-row flex-wrap`)**零新增能力**即可实现;admin 分区是个位数的固定集合,换行比横向滚动更好——不会把条目藏到屏幕外。
  - ⚠️ **失效边界**:该结论只对**当前冻结的分区集合**成立,不得声称对任意数量可用。分区增多后换行条会吃掉过多纵向空间,届时要么改形态、要么才去补横向滚动能力。
  - **触发规则**(Codex S-06 改进,比写死数量更小更可靠):**任何超出当前冻结分区集合的新增,都必须重新评估 mobile IA**;该规则与 D-15 的分母冻结共用同一份清单。
  - 该形态**不新增导航状态、不需要返回通道**,因此不触及"decisive 浮层吞掉硬件返回键"这一既有机制(§1.8)。
- 备选形态:单窗格列表-详情(v3 曾主推)。**采用它的前置条件**是先解决返回通道:详情返回列表、列表返回关闭,而今天 decisive 浮层的硬件返回被吞掉且不做任何事。若详设选备选形态,必须先证明返回通道能在不改 layer 机制的前提下打通。
- 两种形态都必须定义 a11y 角色与焦点顺序。
- 最终形态由详设的 IA 定稿,但必须在两者间做出比较并说明理由。

**R-14 同一个 hook 服务两种机型**
- console 的状态与派生逻辑集中在一个 hook;两个机型组件只负责布局。
- hook 放在 `src/hooks/`,一文件一 hook、`useX` 命名。
- **hook 内不得出现机型分支,也不得读取 surfaceForm**;机型差异只体现在组件结构。注意"选中分区"的语义在两种形态下不同(laptop 需回落首项、紧凑态可能允许无选中),hook 应返回原始选择状态,由组件各自决定回落,而不是在 hook 里判断机型。
- **边界**:分支下沉到**组件**是允许的(那正是 R-10 拆分的目的);被禁止的是分支回到 hook 或 hook 调用的共享纯函数里。判据按此写(U-12)。
- 分区同理:每个分区的两个机型组件共用该分区自己的 hook。

## 4. 方案与影响面

### 4.1 方案要点

1. **冲突检测前移 + 装配期过滤**(R-1、R-2):在 `consoleAssembly.tsx:259-262` 这一处,先对未过滤 parts 按 partKey 分组查机型相交,再按 `input.surfaceForm` 过滤,然后走既有 `assertUniquePartKeys` 与 `createUiCatalog`。
2. **机型解析机制本身不触碰解析与浮层逻辑**:catalog 的 partKey 仍唯一,因此 `resolvePart` 的查找方式、`LayerStack` 的三处 `byPartKey` 查找、`contentActors` 的校验与裁剪逻辑、持久化身份全部不因过滤而改。
   ⚠️ **这不等于这些文件在本批不被修改**(v5 此处措辞会被读成"文件不动",Codex 已指出):§4.2 中对 `LayerStack`(去居中留白)、`workspaceSlices`(水合诊断)、`contentActors`(容器恢复路径)的改动分别来自 R-11、R-9、R-6,**与过滤机制无关**。判断零回归时要按"过滤机制没有改变这些逻辑"来证,不能按"这些文件没被碰过"来证。
3. **失败分层与就绪判定**(R-5、R-15、R-16,Dexter 方向):把失败拆成系统类 / 内容类 / 过渡态,**在类型上可判定、消费方不得枚举 reason 字符串**(载体交详设),顺带拆掉 `runtime-unavailable` 的三重重载;就绪只看系统层——内容失败在**目标 PRIMARY 物理表面**照常就绪并收起开机画面,副屏与 Web 预览只呈现、不参与就绪也不收起;not-found 在所有表面统一成容器内可见呈现。**修订既有裁定 R-S1 与 R-S7 的适用范围。**
4. **容器默认值**(R-6):读时派生 + 恢复路径,与机制同批。
5. **admin 重排**(R-10 至 R-14):换版式 + 去居中留白 + 拆组件(兄弟字段一致)+ 收 hook。

### 4.2 预期改动面

| 位置 | 要做什么 |
|---|---|
| `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:259-266` | 冲突检测前移(分组查相交)+ 按机型过滤 parts |
| `ui/base/render/src/components/resolvePart.ts:13-19` | **失败分类做成 reason 的固有属性**;拆掉 `runtime-unavailable` 的一值三义(R-15) |
| `ui/base/render/src/components/ScreenContainer.tsx:61-148` | 按类别分流:系统类走失败页且不就绪、业务类挂就绪边界、过渡态继续等;删掉 `:123-125` 那种枚举 reason 字符串的写法;not-found 容器内可见呈现;默认值回落 |
| `ui/base/render/src/components/ScreenReadyBoundary.tsx` | 就绪边界现在也会包住业务失败态;就绪事件须带出"是否业务失败态"(R-16)。⚠️ v7 曾要求在此解耦收起与就绪,**已作废**,本文件的改动因此比 v7 预计的更小 |
| `doc/plans/platform/2026-09-14-…-uplift-requirements-claude.md` §3.2 与 U8 | 修订 R-S1(就绪不再排除业务类 fallback)、R-S7(收窄到系统类),并同步该文 U8 判据与 §8 v3.7 第 1 项 |
| `ui/base/render/src/components/LayerStack.tsx:41-58` | 去掉居中与 24 留白(两项一起,含垂直轴处置) |
| 9 处 card 调用点 / 8 个组件,外加 content 层与四个分区组件的 `bounded` | 自带留白与高度约束(R-11 零回归,两层分母) |
| `ui/base/render/src/components/resolvePart.ts`、`foundations/diagnostics.ts` | screen not-found 的 error 内容(R-4 的 owning source,v5 漏列) |
| `SurfaceRoot`/`SurfaceContext`/`consoleAssembly`/两个 integration | 默认 partKey 传递链(禁止字面量落在 console-assembly) |
| `kernel/base/ui-state/src/foundations/workspaceSlices.ts:311-321` | 水合诊断对齐(R-9) |
| `kernel/base/ui-state/src/features/actors/contentActors.ts` | 容器失效记录的恢复路径(R-6,二选一) |
| `ui/base/admin-shell/**` | console 与三分区各拆两组件(兄弟字段一致、rendererKey 唯一);根容器换版式;新增 `src/hooks/`;header 三行移入分区;index.ts 与 invariant 同步 |
| `sample-console` 的 `sampleAssembly.test.tsx:340-345`、`:364-368` | 改为经真实装配取 catalog,或明确降级为"非装配路径"专项测试并改名(§1.10) |
| 两个 integration 的 assembly 测试 | admin 断言按新布局更新;补三个生产分区在 mobile 下可渲染 |
| 标准新条目 | R-7 命名规则(不放 §7.1) |
| 标准 TR-13 第 2 条与反例栏 | 断言对象由 catalog 改为装配输入(裁决②) |

**不需要**:改 catalog 字段集、改 catalog 索引结构、改 `resolvePart` 的查找方式、新增 renderer binding 字段、新增版式 token、新建 static checker、把被过滤条目表穿透到 render 层。

## 5. 验收判据

⚠️ 通用约束(第 2 轮补):本仓**没有布局引擎**,单测里一切尺寸是注入值(§1.9)。凡涉及像素的性质,一律拆成「属性/结构可判定部分」+「显式标注 `UNVERIFIABLE_BY_UNIT_TEST` 的视觉部分」,后者必须写明**谁、在什么设备与分辨率下、看什么、什么算通过、产物落在哪**。

| # | 要证明的性质 | red mutation / 已知绕过形态 |
|---|---|---|
| U-1 | 同 partKey、机型不相交的两个 part 可共存:两种机型下各自装配成功,且各自 catalog 只含本机型条目。**catalog 必须经 `createSampleAssembly({surfaceForm})` 取得,不得手搓** | red mutation 须具体到能击穿中央过滤(Codex N-02):把 `consoleAssembly` 里的过滤改成恒等(直接用未过滤的 `allParts` 建 catalog),本判据必须变红——只"挪个位置"可能仍等价。绕过:直接 `createUiCatalog(...)`(§1.10 的既有惯用法,零阻力);只测一种机型 |
| U-2 | **任一机型启动**都能发现机型相交的冲突(含只影响另一机型的冲突),错误指明 partKey 与重叠机型。**red fixture 须用真实拆分件构造**:取 R-10 拆出的一对 admin 兄弟条目,把其中一条的机型集合改成与另一条相交,装配必须抛错(Codex S-02) | 只在受影响机型上验;`toThrow()` 不校验消息内容;用自造 part 冒充——自造件证明不了真实拆分结构会被检出 |
| U-3 | 展示只传 partKey:两种机型分别渲染各自组件,渲染输出可区分(不靠组件名断言),且**另一机型的组件确实缺席** | 断言组件名或 rendererKey;只断言存在不断言缺席;用夹具绕过真实装配 |
| U-4a | **screen**:当前机型无条目时记 error(含 partKey、当前机型、containerKey)且按 R-5 呈现 | 只断言日志;断言空 fallback 的 testID |
| U-4b | **layer**:保持派发期拒绝与渲染期过滤。**可执行形式**:点名的既有 layer 测试文件 diff 为空且仍全绿。⚠️ 这是**回归护栏**不是行为 oracle(Codex S-03)——它只证"我们没改这些测试、行为仍满足它们",证不了 layer 行为本身正确;若既有覆盖不足,详设须补的是覆盖,不是换判据形式 | "与今天逐字一致"无 oracle;新写一条过滤测试就收工;把护栏当 oracle 宣称 layer 行为已验 |
| U-5 | not-found 是业务失败,三件事必须**同时**成立:①容器内有**可见**的"页面找不到"且含 partKey 与 surfaceForm 定位码,主表面/副屏/Web 预览形态一致;②在**目标 PRIMARY 物理表面**上照常宣告就绪并收起开机画面,**SECONDARY 与 Web 既不上报就绪也不执行收起**;③不出现启动失败页;④**四种内容失败都验,不止 `missing-catalog-entry`**。像素级"确实看得见、没被裁剪或压成零高"标 `UNVERIFIABLE_BY_MACHINE`,按 D-13 出视觉证据 | 只断言"有 testID"而不验真的把 partKey 与机型画了出来——空 `Text` 也有 testID;拿结构断言冒充"看得见";让 SECONDARY 参与 PRIMARY 就绪;沿用旧口径断言 not-found **不**就绪(v7 及以前的作废设计);仍然使用"请重启终端"那套文案 |
| U-5b | **失败分类可判定且闭合**:每个 `RenderFallbackReason` 都有明确类别;系统类走失败页且不就绪;业务类就绪且不走失败页;过渡态既不就绪也不走失败页。red mutation:把任一 reason 改成另一类别,就绪或失败页行为必须可见地变红。**系统失败页只在目标 PRIMARY 物理表面出现**,其他表面保持中性 fallback | 在组件里枚举 reason 字符串冒充分类(今天 `ScreenContainer.tsx:123-125` 正是如此);只测内容类不测系统类;拆 `runtime-unavailable` 后漏掉过渡态那一支,把"还没起来"当成失败;**让 SECONDARY 也显示系统失败页**(违反既有 R-S7) |
| U-6 | 容器无记录时渲染默认 part;默认值**不写入容器表**(断言**反序列化后的容器键集合**,不是存储字符串 `not.toContain`);失效的持久化记录可恢复,冷启动不会永久卡在 not-found | 用派发写入冒充默认;只测首次冷启动;用字符串匹配(默认 partKey 与业务 partKey 同名时会假绿/假红) |
| U-7 | 零回归按**行为**而非 catalog 等价证明(§1.7):两种机型下现有 part 的可渲染行为不变,含 `sample.wallpaper-console.*` 两条单机型 part 在 mobile 下的行为与今天一致;**浮层的层级、可关闭性、遮罩与焦点不变** | 用"catalog 完全相同"冒充零回归(已被 §1.7 证伪);只验存在不验可关闭;只验 console 不验其他浮层 |
| U-7b | 跨机型持久化浮层:在一种机型下打开并持久化的单机型浮层,换另一机型冷启动后该记录被裁剪,**渲染树中不残留 `layer-backdrop`、也不出现关不掉的空浮层**;**容器态同理**(R-6) | 只断言 `selectLayers` 状态为空而不看渲染树;只在同一机型下重启;只测 layer 不测容器;用双机型 part 做夹具(那样本就不可达) |
| U-8 | 单机型组件的文件名与其声明的机型一致,**且该组件确实只在该机型被注册**(命名与行为绑定,后半与 U-3 共用执行体) | 只比对文件名;改名即通过 |
| U-9 | **结构部分(可自动判定)**:console 根容器不再使用卡片版式档位;浮层包裹层 flatten 后 `alignItems`/`justifyContent`/`padding` 取**精确值**断言,console 根节点含 `flex:1` 且无 `maxWidth`。**视觉部分标 `UNVERIFIABLE_BY_MACHINE`**:由人在指定设备与分辨率下目视判定"铺满且看不到遮罩",ROI 差分只作**辅助证据**(证明该区域确实发生了预期方向的变化),**不作为通过条件** | ⚠️ v5 曾把 ROI 差分写成通过条件,与本稿 §1.9 自己写的"它是差分器不是绝对 oracle"自相矛盾(Codex M-04 指出):改遮罩透明度、换个矩形都能让差分通过却没有铺满。结构部分的绕过:用否定式存在断言("不再贡献居中")——把居中挪到别处即绿而画面不变,必须改精确取值 |
| U-10 | laptop master-detail 拆两段:**结构部分**断言分区列表与详情共享父节点、父容器 `flexDirection:'row'`、本机信息是其中一个分区、header 不再常驻三行;**"真正同屏可见"标 `UNVERIFIABLE_BY_MACHINE`**,由 laptop 设备视觉或真实测量证据承接 | ⚠️ 结构断言证不了可见、未重叠、未被裁剪(Codex M-05):无布局引擎时纵向堆叠、宽度塌成 0、详情被裁掉都可能通过。不得用结构部分冒充"同屏"结论;只改 header 两处都留一份 |
| U-11 | mobile:所选形态可用,分区可切换;若选备选形态,返回通道必须实测可用(`BackHandler` 的驱动方式须在 D-7 给出)。⚠️ **"可用"必须在 D-7 定义成可判定的条件**(Codex S-04):在 360×640 下每个分区入口可见、可点、未被裁剪,选中态可辨识——不写死这些,"可用"就是一句空话 | 只测切换不测形态约束;返回路径不验;用"渲染出来了"冒充"点得到" |
| U-12 | 两个机型组件的状态**来源于同一 hook 且行为一致**。两段并列,缺一不可:<br>(a) **行为**:用最小 wrapper 直接 render 该 hook,同一输入下两机型返回的分区集合与选中结果相同;<br>(b) **结构**:hook **及其在本包内的传递依赖**都不出现 `surfaceForm` 读取(TS AST 级判定,复用 `tools/terminal-ui-render/check-static.mjs` 惯用法,**禁止纯字符串匹配**)。⚠️ 只扫 hook 单文件会被"抽一个 helper 去读机型"绕过,判定范围必须覆盖它在**本包内**调用的模块图。**跨包 helper 读取机型这一形态明确降为 review-only,本判据不声称已挡住**(Codex S-05:跨包扫描要新建工具,且那种写法本身就该在评审里被拦) | 只断言"两组件 import 了同一个文件"——四种绕过(复制两份/透传 surfaceForm/分支下沉纯函数/空壳 hook)没有一种能被 import 断言挡住;把机型读取藏进 helper 或间接引用。(a) 的 red mutation:在 hook 内插 `surfaceForm` 分支,必须红 |
| U-13 | admin partKey 与 section testID 不变;**两个 integration 在两种机型下都能打开 console 并渲染各自的全部生产分区**。⚠️ **分母按 integration 分别冻结**(Codex S-07):sample-console 多一个 `sample.console.admin-test` 示例分区,wallpaper 没有,两边分母不同,不得共用一份清单 | 改 testID 让旧断言自然通过;只覆盖示例分区(今天 `sampleAssembly.test.tsx:373,378` 正是如此);拿 sample-console 的分母去套 wallpaper |
| U-14 | 按裁决②分两段:①**装配输入**里整份含 `adminShellAssembly.parts`(过滤前 8 条齐全),这是 TR-13 的新断言对象;②每种机型装配后,该机型的 4 条 admin 条目都能渲染 | 只数 parts 数量;用未过滤的 8 条去构造 catalog(必然抛错,证明不了任何东西);只验输入不验渲染,或只验渲染不验输入完整 |
| U-15 | **兄弟条目一致性**:同 partKey 的两条 part,除 `surfaceForm`/`rendererKey`/`component` 外,`catalogEntry` 的七个字段**外加 `rendererBinding.layerTier` 与 `rendererBinding.layerGuard`** 归一化后相等;`rendererKey` 互不相同。基准是 `definePart` 归一化之后的值,不是源码写法 | ⚠️ **只比 `catalogEntry`——那恰好漏掉 `layerGuard`,也就是本判据要防的那个缺陷本身**(Codex S-01);只验 console 不验三个分区;漏掉 rendererKey 唯一性;拿源码文本比对导致等价写法误报 |

## 6. 明确不做

| 不做 | 理由 |
|---|---|
| 改 catalog 索引结构 / 新增 catalog 字段 | 装配期过滤已达成目的(R-1),索引改造是被否决的重方案 |
| 把"被过滤条目"表穿透到 render 层 | R-4 已砍掉需要它的诊断字段;为一个日志字段拉跨层数据通道不成比例 |
| 展示命令新增机型参数 | 违背核心目的 |
| 把 layer 也改成可见 not-found | R-4 已裁定保持现状 |
| 为全屏新增呈现字段、第二套 layer 机制或新版式 token | Dexter 明确不要另一套弹窗机制 |
| 给 `PrimitiveScrollView` 加 `horizontal` 能力 | R-13 首选形态已改为换行,不需要它;要加须另立需求 |
| 把默认 partKey 做进 uiVariable | 位置错误(R-6) |
| 给 show-screen 增加派发期校验 | 与 R-5 的可见呈现重复;如详设主张,须说明两者如何不撞 |
| 把 not-found 升级成启动失败页 | 它是业务失败,不是系统失败(R-5、R-15) |
| 为 not-found 单独做一条"收起开机画面"的通道 | v7 曾这么要求,**已作废**:按 R-16,内容失败在目标 PRIMARY 物理表面照常就绪,收起随就绪自然发生 |
| 让副屏或 Web 预览参与 PRIMARY 就绪、或在那里执行收起 | 那里本来就没有原生开机画面;就绪的定义锚在被开机画面覆盖的那块物理表面(R-16) |
| 在组件里用 `reason !== 'x' && reason !== 'y'` 判定失败性质 | 分类是 reason 的固有属性(R-15);今天 `ScreenContainer.tsx:123-125` 的写法正是要被替换掉的形态 |
| 运行时切换机型、新增第三种机型 | 机型启动固定、集合闭合 |
| 借本需求改副屏探测 | R-3 已划边界 |
| 为命名规则或机型判定建门 | 都过不了门准入三问(R-7、R-1) |

## 7. 详设必须明确

- **D-1 冲突检测与过滤的落点**:分组查相交写在 `consoleAssembly` 哪一步、错误信息形状;过滤紧随其后;`createUiCatalog` 被公开导出(§1.1)且既有测试正在直接调用(§1.10),是否需要在该处也补一层保护。
- **D-2 失败分类的形状与迁移**:类别怎么表达(reason 上带字段、还是分成三个互不相交的联合类型),使消费方无法再枚举字符串;`runtime-unavailable` 拆成哪几个值、既有 testID(`ui-base-render:fallback:*`)与断言如何迁移;业务失败在容器内的排版、定位码与 testID;就绪事件如何带出"是否业务失败态";文案定稿(不得沿用"请重启终端")。
- **D-3 默认值传递链与恢复路径**:谁声明、经哪些组件传递、如何避免 partKey 字面量落进 console-assembly;失效持久记录二选一(容器裁剪 / 回落默认)及理由;"容器为空"启动失败信号的新归属。
- **D-4 水合诊断对齐**:`parseContainers` 的丢弃是否补诊断,与 layer 侧保持一致。
- **D-5 命名规则落点与人工核验责任人**:标准新条目的位置;打包器扩展名核实;R-7 已裁定 review-only,详设须补"谁在哪一步核"(`tools/code-layout` 不覆盖组件文件名)。
- **D-6 铺满的三处改动**:根容器 `layout`/`bounded` 取值;浮层包裹层去居中与留白的具体改法;**9 处 card 调用点 / 8 个组件**各自的留白与高度处置,外加 content 层与四个分区组件的 `bounded`(§1.8;v8 此处仍误写"7 个",Codex N-01 指出);全部样式必须来自 primitives token 或 RN 样式(tailwind 扫描范围所限)。
- **D-7 admin IA(两份)**:按仓内 IA 与交互设计模板产出;R-13 两形态的比较与定稿;信息层级、导航模型、返回语义(含 `BackHandler` 在测试中的驱动方式)、a11y 角色、焦点落点与恢复、空态与错误态、每个动作节点的 testID。
- **D-8 admin hook 契约**:hook 名称与返回结构;登录态归属(今天在 layer 组件本地);"选中回落"如何留给组件而非 hook;U-12(b) 的 AST 判定如何实现。
- **D-9 公共面与 invariant 同步**:新增组件与 hook 的导出粒度(`AdminSectionNavigation` 是否仍属公共 API);invariant 精确相等断言的更新;README(TR-10)。
- **D-10 冻结旅途影响**:两个 integration 的 admin 断言如何更新;`sampleAssembly.test.tsx:340-345`、`:364-368` 两处手搓 catalog 的处置(改走装配 / 降级改名);哪些必须逐字不变以证明零回归;补齐三个生产分区在 mobile 下的覆盖(U-13 的分母)。
- **D-11 迁移顺序**:**实施方建议拆两批(Codex,作者采纳)**。
  - **机制批 = R-1 至 R-9 加 R-15、R-16**。R-15(失败分类)与 R-16(就绪判定)是 R-5 的**前提**而不是后续增强——没有可判定的分类,"就绪只看系统层"无法正确实现,所以它们必须在同一批,且在 R-5 之前落地。
  - **R-10 拆成两步,声明拆分归机制批**(Codex M-01):`R-10a 声明拆分`——把 admin 四条 part 各拆成同 partKey、机型不相交的兄弟条目,**两边先指向同一组件**——进机制批;`R-10b 组件分化`与 R-11 至 R-14 的版式重排留在 admin 批。
    - 理由一:U-1/U-2 要求用**真实拆分件**做 fixture,而机制批里今天没有任何兄弟条目,不拆就只能自造 part,判据自我架空;
    - 理由二(更重要):两边先指向同一组件时,**拆分后的行为必须逐字不变**——这是零回归最强的证明形式,比任何断言都硬。
  - 机制批必须先证明:两种机型真实装配、冲突前移生效、失败分类闭合(U-5b)、内容失败在**目标 PRIMARY 物理表面**照常就绪且副屏/预览不参与(U-5)、R-6 的失效记录恢复、R-9 诊断分流,以及既有 layer 行为零回归。
  - 之后再进 **admin 重排批(R-10b 至 R-14)**与真实视觉验证。
  - **约束**:R-6 的容器恢复路径属机制批,不得推迟;admin 重排批不得在机制批零回归未证前开工;对 2026-09-14 那份需求稿的四处修订(§8)属机制批,不得留到后面补。
- **D-12 兄弟条目一致性的落实方式**:U-15 靠 focused test 还是靠 `definePart` 层面的约束。**实施方倾向(Codex)**:用 admin-shell 范围内的 focused test 比较归一化后的语义字段,**不给通用 `definePart` 增加 sibling-aware 机制**——后者会为一个局部约束改动全仓 part 定义入口。作者同意该取舍,详设若要推翻须说明理由。
- **D-13 视觉与测量证据的产出方式**:U-9(铺满且无遮罩)、U-10(laptop 真正同屏)与 **U-5(内容失败确实看得见、没被裁剪或压成零高)**的视觉部分——设备、分辨率、ROI 坐标、改前基线从哪来、判定语句、产物落在 `doc/evidence/` 何处;ROI 差分只作辅助证据,须写明通过与否由谁判定。U-5 这一条尤其不能只靠"非空 Text + testID"收工(Codex S-04)。
- **D-14 U-11 的"可用"条件**(新):360×640 下分区入口的可见、可达、可点、未裁剪与选中态的具体判定方式。
- **D-15 U-13 的分母冻结**(新):两个 integration 各自的生产分区清单如何固化,新增分区时谁负责同步。

## 8. 授权边界与已定裁决

需求分析,**不是实施授权**。作者会话只做静态核验,未修改任何源码(本文件除外)。

**Dexter 裁决(2026-09-16,两项均已定)**:

| # | 事项 | 裁定 | 连带后果 |
|---|---|---|---|
| ① | not-found 的呈现形态 | **统一成容器内呈现**,所有场景一律不走启动失败页(作者曾建议分三态,未采纳) | ⓐ 这比作者的三态更贴 Dexter 的原始要求;ⓑ **R-S7 的适用范围随之收窄**——not-found 不再属于"终态启动失败",R-S7 继续管其余终态失败原因,这是对既有裁定的**修订**,不是补充;ⓒ ~~收起开机画面的责任必须显式转移给容器内呈现~~ —— **v8 按方向③作废**:业务失败照常就绪,收起随就绪自然发生,不需要专门通道(见本表 ③ⓐ);ⓓ v6 的"失败文案经入参传入"约束**自动作废**,因为不再使用失败页 |
| ② | TR-13 在 admin 拆双机型后不可满足 | **改为检查装配输入**:断言装配输入里整份含 `adminShellAssembly.parts`(过滤前),不再对 catalog 断言(作者曾建议改成按机型表述 catalog,未采纳) | ⓐ 与机型过滤**彻底解耦**——TR-13 从此不受任何 catalog 侧变化影响,比按机型改写更稳;ⓑ 要动的是标准 TR-13 第 2 条与反例栏中"未把 admin parts 放进该 catalog"一句;ⓒ U-14 随之拆成"输入完整"与"每机型可渲染"两段 |

| ③ | 失败该怎么分层、就绪该不该看业务失败(Dexter 方向,授权作者定方案) | **分清代码失败与业务失败**:找不到 screenPart 属业务失败,与登录密码错误同级,由开发迭代解决;**开机就绪判定不看业务失败**。作者据此定出 R-15(失败分类做成一等概念)与 R-16(就绪只看系统层) | ⓐ **v7 的"收起责任转移/收起与就绪解耦"整条作废**——按新分类收起随就绪自然发生,改动反而更小;ⓑ 发现 `runtime-unavailable` 一值三义,必须先拆才能正确实现(§1.5);ⓒ `container-empty` 归入业务类,作者此前建议的"维持终态失败"被自己推翻;ⓓ **修订既有裁定 R-S1**——业务类 fallback 从此算就绪 |

⚠️ **本批修订两条既有裁定,修订面比 v7 预计的大**(正本均在 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md`):

- **R-S1**(§3.2):原文要求就绪排除**全部六种** `RenderFallbackReason`,并逐条点名了那四种业务类。按方向③,业务类算就绪 ⇒ 该段必须改写;
- **R-S7**(§3.2):原文把"真实 part 持续落在上述任一 fallback"列为终态失败场景 ⇒ 收窄到系统类;
- **U8**(该文验收判据):原文写"就绪按…全部 `RenderFallbackReason` 排除",且把"把任一 `RenderFallbackReason` 当作就绪"列为绕过形态 ⇒ 同步改写,否则新实现会被旧判据判红;
- **§8 v3.7 第 1 项**:"PRIMARY 主屏终态 fallback 显示同一失败页的运行期变体" ⇒ 同步收窄。

四处必须同批改,只改本稿等于在仓里留一组互相矛盾的权威文件。Codex 第 2 轮已独立复扫并确认**就是这四处、没有第五处**(旧 D-5 里的"约束 R-S1–R-S7"只是引用,不是第五套独立规则)。

**Dexter 授权作者裁定的两项(2026-09-16,原话"需要我明确的,你替我明确即可")**:

| # | 事项 | 裁定 | 理由 |
|---|---|---|---|
| ④ | 内容失败已就绪之后,后续系统失败显示哪个档位 | **接受漂移,显示"终端运行异常"** | 终端确实已经起来了,只是内容没配对,后续崩溃按运行期报是诚实的。要维持"启动失败"就得再加一个"是否曾渲染出真实业务内容"的锁存器,为一句文案新增一套状态机,不成比例。信息需求由"就绪事件带出内容失败态"覆盖。判据须显式断言该档位,不得默认继承 |
| ⑤ | 无默认值的 `container-empty` 在就绪事件里报什么 partKey | **`readyPartKey` 允许为空(`string \| null`),另加类型化失败原因字段,消费方必须显式处理空值** | 这种情况下根本不存在 partKey,编一个稳定诊断 token 是撒谎,且那种魔法字符串必然漏进看板被当成真 partKey。空值 + 原因字段不撒谎,并逼下游显式处理该分支 |

其余机制问题按 §7 交详设;mobile 形态按 Dexter 授权由本稿给出首选与前置条件,最终由详设 IA 定稿。

## 9. 第 1 轮对抗式盲审 intake

4 个 fresh 独立子 agent 分维度盲审(机制与消费者、默认值与 not-found、admin 重排、文档质量),合计 NO-GO 6M/13S/14N。逐条处置(**两处归因已按第 2 轮核验更正,见标注**):

| Finding | 处置 | 落点 |
|---|---|---|
| A-M1 LayerStack 三处 `byPartKey` 未登记,miss 时浮层变关不掉 | **部分接受(v5 更正归因)**:三处代码确实无需改动,但缺陷**不是被新方案消解,而是被新方案从不可达变为可达**;实际兜底是 `createUiStateModule.ts:151` 的启动期裁剪,由 U-7b 承接。v4 把它写成"由新方案消解"会让读者以为风险消失 | §1.6、U-7b |
| A-M2 未比较"装配期按机型选 parts"的更小替代 | **接受并采纳**,且进一步简化为在 console-assembly 一处过滤;原索引改造方案作废 | R-1、§4、§6 |
| A-S1 R-1b 对 displayModes 过强(mobile 无副屏) | **接受**:R-1b 整条删除 | R-1b 已删 |
| A-S2 R-3 与既有副屏感知冲突 | **接受**:R-3 收窄为"part 解析路径上",并登记既有例外 | R-3、§1.7 |
| A-S3 兄弟 renderer 必须两份注册、缺一即硬启动失败 | **部分接受(v5 更正)**:运行期确只注册本机型条目,但缺陷迁移到**构造期**——兄弟字段不一致会静默改行为,v5 立 R-10 一致性条款与 U-15 | R-10、U-15 |
| A-N1/N2/N3 诊断字段漂移、持久化身份、集合 membership | **接受,均由新方案消解**;持久化身份不变写入 R-8 | §1.4、R-8 |
| B-M1 not-found 与就绪/启动失败三态未闭合 | **接受**:R-5 重写(v5 再补第三态);§1.5 更正 | R-5、U-5、§8① |
| B-M2 §6"渲染期兜底已覆盖"不成立;容器记录持久化且无裁剪 | **接受**:R-6 增恢复路径要求(v5 追加"必须与 R-1 同批") | R-6、D-3、D-11 |
| B-S1 默认值传递链与改动面缺失、console-assembly 字面量捷径 | **接受** | R-6、§4.2、U-6 |
| B-S2 layer 与 screen 统一会改行为 | **接受**:R-4 拆成 screen/layer 两条,layer 保持现状 | R-4、U-4b |
| B-S3 默认值不得写入容器表 | **接受** | R-6 |
| B-N1/N2/N3 定性、文案层级、水合诊断 | **接受**:定性改为按时机分态;文案禁用"请重启终端";水合诊断立 R-9 | R-5、R-9、D-2 |
| C-M1 mobile 形态未做替代比较 | **接受并改判**(v5 再改判,见 §10) | R-13 |
| C-S1 换版式不足以铺满(居中与 token 缺 w-full/flex-1);tailwind 扫描范围限制 | **接受**:R-11 补三处改动与样式来源限制;§1.8 补事实 | R-11、§1.8、D-6 |
| C-S2 零回归只证水平轴;7 个浮层只有一个 bounded | **接受** | R-11、U-7 |
| C-S3 硬件返回被吞,是备选形态的前置条件 | **接受**:写入 R-13 前置条件 | R-13 |
| C-S4 TR-13 构造性与 mobile 分区覆盖缺判据 | **部分接受(v5 更正)**:U-14 已立、U-13 已补分母,但 TR-13 **原文措辞在拆分后不可满足**,v4 把部分接受写成了完全接受;v5 升级为待裁决② | U-13、U-14、§8② |
| C-N1/N2/N3 选中回落语义、a11y label、公共面粒度 | **接受** | R-14、R-12、D-9 |
| D-M1 `ScreenContainer` 已把解析失败升级为启动失败页,全文未提 | **接受**:§1.5 重写(v5 补门控与第三态) | §1.5、R-5 |
| D-S1 U-4 对 layer 不可达 | **接受**(同 B-S2) | U-4a/U-4b |
| D-S2 U-9 在 react-test-renderer 下不可判定 | **接受**:U-9 改为结构可判定 + 视觉分担(v5 补精确取值与 ROI 差分) | U-9、D-13 |
| D-S3 a11y 与焦点缺失 | **接受** | R-12、R-13、D-7 |
| D-N1 版式事实不全、token 名与组件 prop 词表混用 | **接受**:§1.8 更正为七项并改用 prop 词表 | §1.8、R-11 |
| D-N2 R-7 落点错(§7.1 是目录词表) | **接受** | R-7 |
| D-N3 R-13 越界写死 IA | **部分接受**:保留"形态约束 + 理由",具体 IA 下放 D-7;首选形态仍写明(Dexter 已授权本稿定形态) | R-13、D-7 |
| D-N4 R-S7 悬空引用、启动失败页有 runtime 档 | **接受**:§1.11 补出处 | §1.11 |
| D-N5 路径前缀歧义 | **接受**:文档头补约定 | 文档头 |
| D §5 命名门红线 | **接受**:R-7 默认 review-only(v5 直接裁定,不再留给详设试) | R-7 |
| 作者自查(非盲审所提):过滤后"catalog 中不存在的 layer"从不可达变为可达 | **接受**:核实后确认已被启动期裁剪兜住;立 U-7b 锁住该链路;诊断语义漂移记入 R-9 | §1.4、§1.6、R-8、R-9、U-7b |

## 10. 第 2 轮对抗式盲审 intake(定稿轮)

3 个 fresh 独立子 agent 定向盲审(新机制证伪、第 1 轮关闭核验、判据可判定性),合计 NO-GO 4M/14S/8N。**两处独立撞车**(E-S4 与 G-M1 都指向 R-4 诊断字段拿不到;E-N1 与 F-M1 都指向 TR-13 措辞),已分别处置。

| Finding | 处置 | 落点 |
|---|---|---|
| **E-M1** §1.7 "仓内无单机型 part" 是错的,wallpaper 有两条 `['laptop']` | **接受(作者已亲验确认)**:§1.7 重写;R-8 的零回归论证从"catalog 等价"改为"可渲染行为等价";这两条同时成为 U-1/U-7 的现成对照样本 | §1.7、R-8、U-7 |
| **E-S4 + G-M1(撞车)** R-4 要求报"声明过哪些机型",但过滤后条目已不在 catalog,§7 也无 D 项承接 | **接受,但用删而非加来关闭**:Dexter 裁决①只要求 partKey 与 surfaceForm,该字段是作者自加;为一个日志字段把"被过滤条目"表穿透到 render 层不成比例。**砍掉该字段**,冲突本身由 R-2 在启动期堵住;顺带可得时允许作为可选增强 | R-4、§6、§4.2 |
| **E-N2** 有比"复用重复断言 + 一条 focused 测试"更强且同样廉价的做法 | **接受并采纳,升为 R-2 主机制**:冲突检测前移到过滤之前,对未过滤 parts 按 partKey 分组查机型相交。代价相当,但**任何机型启动都能发现任何冲突**,v4 自承的"暴露面收窄"已知边界随之消失 | R-2、§4.1、U-2 |
| **E-S1** "唯一收口处"只在生产成立;`createUiCatalog` 是公开导出,既有冻结断言正在直接建 catalog | **接受(作者已亲验)**:§1.10 立事实,点名 `sampleAssembly.test.tsx:340-345`、`:364-368`(其中 `:348` 那条测试名字自称覆盖生产却手搓 catalog);U-1 要求经真实装配取 catalog;D-10 给处置 | §1.10、U-1、D-10、D-1 |
| **E-S2** 机型判定在生产路径退化为永真,red mutation 失效 | **接受并登记**:R-1 加"必须登记的代价"段;不建门、本批不删该判定(它仍守非装配构造路径),按 `UNENFORCEABLE_BY_MACHINE` 登记 | R-1、§6 |
| **E-S3** 容器侧无裁剪,跨机型容器记录会让设备每次冷启动都卡住,而 D-11 允许分批 | **接受**:R-6 追加"必须与 R-1 同批交付",D-11 加约束;U-7b 扩到容器态 | R-6、D-11、U-7b |
| **E-N1 + F-M1(撞车)** TR-13 原措辞在拆分后不可满足 | **接受,升为待裁决②**。⚠️ 同时**收窄 F-M1**:F 说"U-14 不可满足"过头了——过滤后每种机型的 catalog 连同 `rendererKey` 都能正常构造,问题**仅在标准措辞**,不在机制 | §8②、U-14、§4.2 |
| **F-S4** 兄弟条目的 `rendererKey`/`layerGuard` 等字段未约束,漏写即静默改行为 | **接受**:`layerGuard` 默认 `'dismissible'` 而 console 现值 `'decisive'`,某机型漏写就变成可点遮罩关闭。立 R-10 一致性条款 + U-15 + D-12 | R-10、U-15、D-12、§1.1 |
| **F-S2** R-5 内部互斥:`FAILURE_MESSAGE` 是两页共用的模块级单常量 | **接受**:R-5 明确文案经**入参**传入,不改全局常量、不新建第二套页面 | R-5、§1.5、§4.2 |
| **F-S3** R-5 的"两态"实为三态,`:136` 有 `isTargetPrimarySurface` 门控,副屏/预览下是纯空白 | **接受**:§1.5 补门控事实;R-5 立第三态;U-5 要求覆盖 | §1.5、R-5、U-5 |
| **F-S5** R-13 首选形态可能被 §6 堵死(标 UNVERIFIED) | **接受并自行核实后改判**:作者亲验 `PrimitiveScrollView.tsx:17` 无 `horizontal`、偏移写死读 `y` ⇒ 横向滚动条今天做不出来。**首选形态改为换行分区条**(`PrimitiveGrid` 已是 `flex-row flex-wrap`,零新增能力),不需要惊动 Dexter,也不撞 §6 | R-13、§1.8、§6 |
| **F §9 诚实性** A-M1 归因错、C-S4 部分接受写成完全接受 | **接受**:§9 两行已更正并标注 | §9 |
| **G-M2** U-12 在单测下必然退化为 import 断言,四种绕过都挡不住 | **接受**:U-12 改为 (a) hook 级行为一致 + (b) AST 级"hook 内不读 surfaceForm",并写明"分支下沉到组件是允许的"这一边界 | U-12、R-14、D-8 |
| **G-S1** U-1 的绕过形态只写在备注里,未转成正向要求 | **接受**:U-1 正文强制经 `createSampleAssembly` 取 catalog,并给出 red mutation(把过滤挪出 console-assembly 必须变红) | U-1 |
| **G-S2** U-7 后半"内容高于视口"的前提在无布局引擎下不可构造 | **接受**:降为属性级判据,像素部分显式标 `UNVERIFIABLE_BY_UNIT_TEST` | U-7、U-9、§5 抬头 |
| **G-S3** 仓内其实有 screencap 与 `terminal-image-compare`,文档未提 | **接受**:§1.9 补设施事实;U-9 视觉部分改为对遮罩区 ROI 做改前/改后差分(承认它是差分器而非绝对 oracle);D-13 落产出方式 | §1.9、U-9、D-13 |
| **G R-7 门准入** 命名门的 red mutation 是改文件名,不改 production 行为,必然过不了三问 | **接受并提前收口**:R-7 直接裁定 review-only,不再留给详设试一轮;D-5 改为补"谁在哪一步人工核"(`tools/code-layout` 不覆盖组件文件名) | R-7、D-5 |
| **G-S4/S5、N1/N2/N3** U-4b 无执行体;U-8 前半与 U-14 无 D 项;U-6 字符串匹配会假绿;U-10 "同屏"证不了;U-11 `BackHandler` 无驱动先例 | **接受**:U-4b 改为"点名文件 diff 为空且全绿"(v6 再补"这是护栏不是 oracle");U-6 改为断言反序列化后的键集合;U-10 加"共享父节点 + `flexDirection:'row'`"(v6 再补"结构证不了同屏");U-11 的驱动方式落 D-7;U-8 后半与 U-3 共用执行体 | U-4b、U-6、U-8、U-10、U-11、D-7 |
| **三路共同的未验证项** `publicSurface.test.ts` 锁定内容、tailwind content 具体行、行号漂移 | **接受为已知未验证**:不影响本稿结论,详设阶段以当时字节为准 | — |
| **作者自审(第 2 轮后)** §1.8 把"双机型"与"`rendererKey === partKey`"挂在同一组行号上;R-10 字段清单漏列 `title`/`description`;§10 收口把 S 的关闭数记错 | **接受并更正**:§1.8 拆成三行并补"`layerGuard` 只有 console 显式写"这一事实(它让 U-15 的风险面集中在 console 本体);R-10 改为穷举;§10 收口改为"14 个 S 全部关闭" | §1.8、R-10、§10 |

**收口**:`REVIEW_TARGET=DESIGN` 两轮上限已达,本版由作者 `SELF_DECIDED` 收口。第 2 轮 4 个 M 全部关闭(E-M1 改事实与论证、E-S4/G-M1 砍字段、F-M1 收窄为措辞并升裁决、G-M2 重做判据),**14 个 S 全部改稿关闭**。升为待裁决②的 TR-13 措辞来自 F-M1 与 E-N1(M 与 N 级),不是某条 S——v5 初稿此处曾误记为"13 条关闭、1 条升裁决",已按作者自审更正。

## 11. Codex 实施可行性评审 intake(第 6 版)

Codex 作为实施方独立评审,`VERDICT=NO-GO`,`M/S/N=5/10/3`,记录见 `doc/review/platform/2026-09-16-ter-screen-part-form-resolution-requirements-implementation-feasibility-review-codex.md`。**NO-GO 成立**——M-03 至 M-05 与 S-09/S-10 是本稿的真实缺陷,其中两条是作者重复犯的同一类错。

| Finding | 处置 | 落点 |
|---|---|---|
| **M-01** R-5 三态仍待 Dexter 裁决 | **确认阻塞,但不改稿**:这是本稿 §8① 主动登记的待裁决项,不是文档缺陷。作为"能否进详设"的判断,Codex 的阻塞结论正确 | §8① 不变 |
| **M-02** TR-13 措辞仍待 Dexter 裁决,U-14 分母未封闭 | **同上**:§8② 已登记。⚠️ 补充接受其中一半——在裁决落地前 **U-14 的验收对象确实不封闭**,这一点本稿此前没写明 | §8②、U-14 |
| **M-03** §4.1 称零改动、§4.2 又要改那几个文件,互相矛盾 | **部分接受(收窄)**:不是"两种执行方式矛盾"——§4.2 对 `LayerStack`/`workspaceSlices`/`contentActors` 的改动分别来自 R-11/R-9/R-6,与过滤机制无关。但 v5 措辞确实会被读成"这些文件不动",**是真实的表述缺陷**。已改为"机型解析机制本身不触碰这些逻辑"并写明零回归该按哪种口径证 | §4.1 |
| **M-04** ROI 差分证明不了"遮罩被 console 覆盖" | **接受,且这是自相矛盾**:本稿 §1.9 自己写了"它是差分器不是绝对 oracle",U-9 却把它当通过条件。改遮罩透明度、换个矩形都能让差分通过。已把视觉结论降级为 `UNVERIFIABLE_BY_MACHINE`,ROI 差分只作辅助证据 | U-9、D-13 |
| **M-05** U-10 结构断言证明不了 laptop 真正同屏 | **接受**:同一类错误。已拆成结构部分 + `UNVERIFIABLE_BY_MACHINE` 的视觉/测量部分 | U-10、D-13 |
| **S-01** §4.2 漏列 R-4 的 owning source | **接受** | §4.2 |
| **S-02** U-2 缺可运行的 overlap red fixture | **接受**:改为用 R-10 拆出的真实兄弟条目构造相交 | U-2 |
| **S-03** U-4b 的 diff 判据不是 layer 行为 oracle | **接受**:明确它是**回归护栏**不是 oracle;覆盖不足时补的是覆盖不是判据形式 | U-4b |
| **S-04** U-11 的"可用"未定义 | **接受**:落 D-14,要求在 360×640 下定义可见/可达/可点/未裁剪/选中态 | U-11、D-14 |
| **S-05** R-13 换行只对当前分区数成立 | **接受**:补失效边界与重新评估触发条件 | R-13 |
| **S-06** U-12 只扫 hook 单文件会被 helper 绕过 | **接受**:判定范围扩到 hook 在本包内的传递依赖 | U-12 |
| **S-07** U-13 分母未按两个 integration 分别冻结 | **接受**:两边分母不同(sample-console 多一个示例分区),不得共用清单 | U-13、D-15 |
| **S-08** "逐字相同"与 `definePart` 默认归一化歧义 | **接受**:判据基准改为**归一化后的 `catalogEntry`**,等价写法不应误报 | U-15、R-10 |
| **S-09** R-11 把 token 名当作 `layout` prop 取值 | **接受,且这是第三次**:v4 的 D-N1 修过一次,v5 又写回去了。已明确分两层词表——prop 只接受 `fill/content/card/centered/transparent`,`container*` 是它映射的 token 名 | R-11 |
| **S-10** card 分母不是 7 | **接受,双方都不够精确**:作者亲验为 **9 处生产调用点 / 8 个组件**(`AdminShell` 两个分支各一处),Codex 的"8 个调用点"混了组件与调用点 | §1.8、§4.2、R-11 |
| **N-01** `.laptop.tsx` 扩展名未核 Metro resolver | **接受并升为前置**:核实前不得定命名形态,冲突则整套推荐作废 | R-7 |
| **N-02** U-1 的 red mutation 不够具体 | **接受**:改为"把过滤改成恒等",而不是"挪个位置"(挪位可能仍等价) | U-1 |
| **N-03** R-2 的"任一机型发现"应限定作用域 | **接受**:限定为"实际汇总了该 parts 集合的那次装配",并补空机型集合、重复机型等输入边界 | R-2 |
| **作者自查(本轮新增)** `bounded` 不止用在 card 上——content 层与四个分区组件都传了 | **接受**:R-11 的垂直轴零回归分母是**两层**,v5 只分析了浮层层。分区层的 `maxHeight:'100%'` 解析基准同样会变 | §1.8、R-11 |

**Codex 的实施方判断,采纳情况**:第 1 条(落点正确且最小)确认;第 2 条(R-6 倾向回落默认)记入 R-6;第 3 条(U-15 用 focused test、不动 `definePart`)记入 D-12 并同意;第 4、5、6 条已分别落进 R-11、R-13、§1.10 与 D-10;第 7 条(拆两批及机制批的放行条件)采纳并改写 D-11。

**状态**:v6 关闭了 M-03 至 M-05 与全部 10 条 S、3 条 N。**M-01 与 M-02 已于 v7 关闭**——Dexter 于 2026-09-16 对 §8 两项作出裁决,均未采纳作者的建议项:①not-found 统一成容器内呈现(不是三态),②TR-13 改为检查装配输入(不是按机型改写 catalog 断言)。两项裁决的连带后果见 §8 表格。⚠️ **本段原先断言"收起开机画面的责任转移是裁决①的硬前置",该断言已被 v8 推翻**——Dexter 随后给出的失败分层方向让业务失败照常就绪,收起随就绪自然发生,见 §12。

**本稿至此不再有待裁决项,可进详设。** 详设按 D-11 拆两批,机制批先行。

## 12. Dexter 方向 intake(第 8 版)

Dexter 2026-09-16 给出方向并授权作者定方案:**分清代码失败与业务失败**——找不到 screenPart 属业务失败,跟登录密码错误同级,是开发人员不断体验功能、测试调优去解决的;**而开机启动就绪的判定,不看业务失败**。并要求:不看成本,取最优最长远的方案。

| 这个方向改变了什么 | 结果 |
|---|---|
| 作者此前一直把 not-found 当**启动问题**处理 | 这是框架性错误。v4 到 v7 围绕"首次就绪前/后""谁收开机画面""两套错误页会不会同屏"的全部设计,都是这个错误框架的产物 |
| v7 的"收起责任必须显式转移、收起与就绪解耦" | **整条作废**。业务失败照常就绪,开机画面随就绪正常收起,不需要任何专门通道 |
| 作者上一轮给 Dexter 的建议:`container-empty` 维持终态失败 | **作者自己推翻**。按方向它属业务类——"这个容器没配内容"正是开发迭代解决的事 |
| `runtime-unavailable` | 发现它**一值三义**(过渡态 / runtime 失败 / 宿主不可用),而失败页那层早已用三个 reason 区分。不拆就无法实现"就绪只看系统层",因此拆它是方向①的**必要前提**,不是范围扩张 |
| 判据 | U-5 反转(旧版断言 not-found **不**就绪,现在要断言它**照常**就绪);新增 U-5b 锁分类闭合 |
| 既有裁定 | 修订 R-S1、R-S7,并同步该文 U8 与 §8 v3.7 第 1 项(见 §8) |

**为什么这个方案更长远**:分类在类型上可判定之后,新增第七种 reason 时类型会强迫作者回答"它属于哪一类",而不是让它悄悄落进 `ScreenContainer.tsx:123-125` 那种 `!== 'x' && !== 'y'` 的缝里——今天 `runtime-unavailable` 的一值三义,正是"分类靠散落条件"长年积累的结果。它同时给机器门提供了真判据:改一个 reason 的类别,就绪与失败页行为必须可见地变化。(⚠️ v8 曾把这写成"必须挂在 `RenderFallbackReason` 上",那是实现载体而非需求,已按 Codex N-03 改回。)

## 13. Codex 第 2 轮实施可行性评审 intake(第 9 版)

`VERDICT=NO-GO`,`M/S/N=3/6/3`。**三个 Major 全部成立且全是作者的问题**,其中 S-01 是本轮最刺的一条:作者发明 U-15 就是为了逮"兄弟漏写 `layerGuard`",而给 U-15 定的比较对象恰好不含 `layerGuard`。

| Finding | 处置 | 落点 |
|---|---|---|
| **M-01** 批次顺序与 U-1/U-2 的"真实拆分件"要求冲突——机制批里根本没有兄弟条目 | **接受**:R-10 拆成 `R-10a 声明拆分`(进机制批,两边先指向同一组件)与 `R-10b 组件分化`(留 admin 批)。额外收益:同组件时拆分后行为必须逐字不变,这是零回归最强的证明形式 | D-11、R-10 |
| **M-02** R-5/R-16 没说清就绪与失败页只作用于目标 PRIMARY 物理表面 | **接受**:所有表面都显示内容失败;只有目标 PRIMARY 参与就绪与收起;SECONDARY/Web 不执行收起;系统失败页只在目标 PRIMARY(与既有 R-S7 一致,不构成新修订) | R-5、R-16、U-5、U-5b |
| **M-03** 内容失败就绪的可见内容、partKey identity、传播链都没闭合 | **接受**:四种内容失败各自定义可见呈现;`readyPartKey` 可空(裁定⑤);传播链逐点点名(props→ReadyBoundary→consoleAssembly→diagnosticsWriter→两个 integration→测试) | R-5、R-16、§8⑤ |
| **S-01** R-10"逐字相同"与 U-15"归一化相等"矛盾,且 U-15 漏检 `layerTier`/`layerGuard` | **接受,作者亲验确认**:`catalogEntry`(`definePart.ts:71-81`)只有九个字段,二者在 `:82-87` 的 `rendererBinding` 上。统一为归一化口径,U-15 补比 binding 两字段 | R-10、U-15 |
| **S-02** `invalid-props`/`container-empty` 叫"业务失败"不准确 | **接受**:明确**分类轴是"是否阻断就绪",不是责任归属**;正式定义用"内容失败",保留"业务失败"承接 Dexter 原话 | R-15 |
| **S-03** `failureStage` 语义停在"作者倾向" | **接受并裁定**(Dexter 授权):接受漂移,且须显式断言 | R-16、§8④ |
| **S-04** U-5 的"可见"无证据执行体 | **接受**:U-5 按两段拆,视觉部分落 D-13 | U-5、D-13 |
| **S-05** U-12 的 AST 范围仍可被跨包 helper 绕过 | **部分接受**:本包内模块图仍机器判定;**跨包形态明确降为 review-only,不再声称已挡住**——跨包扫描要新建工具,而那种写法本身就该在评审里被拦 | U-12 |
| **S-06** R-13 的"重新评估"无触发规则 | **接受 Codex 的改法**(比写死数量更小更可靠):任何超出当前冻结分区集合的新增都必须重新评估 mobile IA,与 D-15 共用同一份清单 | R-13 |
| **N-01** D-6 仍写"7 个 card 浮层" | **接受**:作者在 v6 改了 §1.8/R-11/§4.2 却漏了 D-6 | D-6 |
| **N-02** TR-13 正本仍是旧 catalog 表述 | **接受为实施前置**:不是需求缺陷,但属机制批必须同批完成的四处修订之一 | §4.2、D-11 |
| **N-03** "必须挂在 `RenderFallbackReason` 上"是载体选择不是需求 | **接受,作者过度规定**:改为"类型上可判定、消费方不得枚举字符串",载体交详设 | R-15、§12 |

**Codex 本轮的两项独立贡献**:①复扫确认旧需求稿的同步面**就是四处、没有第五处**;②给出就绪的**七处生产消费面**(ready latch、`failureStage`、ReadyBoundary、consoleAssembly 的三个事件、diagnosticsWriter、两个 integration 的 payload 与日志、相关 focused test),并确认除此之外没有其他直接消费者——这正是作者上一轮请他重点找的东西。
