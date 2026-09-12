# TER admin console 修复后详设与实施计划 — Claude 独立复审

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN (REMEDIATED BYTES)
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
REVIEW_KIND=REMEDIATION_RECHECK（非第三轮独立子 agent 审查,不重置历史 cycle）
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO
M/S/N=2/0/1（交付后 M-B 由需求 owner 关闭,现为 1M/0S/1N;见 §3b）
EVIDENCE_TIER=static（源码与文档对账）+ 一次离线纯函数复算;未构建,未运行任何门、测试、Web、Android、native、DEV、seed、UAT、部署
WRITE_SCOPE=仅本文件
```

## 0. 会话出处与利益冲突

- **会话出处（事实）**：v2s-rooted **续接会话**,上下文经摘要接续。不是 fresh acceptance。本轮复核的每条结论都重开了当前字节与 owning source,未采信历史 verdict、intake 自述或作者 remediation 声明。
- **利益冲突（事实）**：需求正本 `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md` 由我撰写,`doc/review/platform/2026-09-11-v2s-terminal-admin-console-design-review-claude.md` 是我上一轮的评审。五份设计文档由 Codex 撰写。**对设计包我独立;对需求条款本身我不独立**——`M-B` 正是我自己的需求条款出了问题,我按事实报告并注明责任在我。
- **字节状态（事实）**：五份设计文档 mtime 为 20:52–20:53,晚于我的评审(20:23)与作者 intake(20:42)。需求正本停在 18:14,**裁决后未更新**。被引源码文件 mtime 全部早于本 cycle（最新 09-08 18:07），**源码零改动**,本轮确为纯设计复审。

## 1. 结论

`NO-GO (2M / 0S / 1N)`。相比裁决后的 `6M/2S/2N`,**九条阻断项里八条已真正修复**,我逐条重开源码亲验,不是采信 intake。

剩余两条 M:一条是 `M-4` 的修复本身引入的新问题（清理动作与其常量被分在一条单向包边的两侧,且该边反向即成环）;另一条是需求字面未与 Dexter 裁决对账,作者已正确登记为 OPEN 并拒绝代改,责任在我这个需求 owner。

## 2. 已核验修复（重开源码亲验,非采信 intake）

以下八条我逐条打开当前源码与当前文档字节对照,确认修复成立:

- **M-1 catalog 形状（CONFIRMED_FIXED）**。计划第 188 行现在把 `surfaceForm` 定为**必填**并点名全部六个构造/校验点:`UiCatalogEntry`、`approvedEntryKeys`、`assertEntryKeys`、`canonicalEntry`、`DefinePartCatalogFields`、`definePart`,要求原子修改。我亲验 `apps/terminal/ui/base/render/src/foundations/definePart.ts` 确实是**第三处**显式八字段构造点(`DefinePartCatalogFields` 是八个字段名的 `Pick`,`definePart` 内另有八字段字面量)——**这一处是上轮我漏掉、作者自己在源码重开中找到的**。`AdminSectionMetadata` 与 order 字段已整体移除,exact-key 集合固定为九字段。
- **M-2 admission 拿不到 form（CONFIRMED_FIXED）**。计划第 190 行改为由 `createUiStateModule` 初始化一个 assembly 级 `surfaceForm` slice（`persistIntent=never`、`syncIntent=isolated`）,暴露 `selectSurfaceForm(root)`,actor 从 state 读;并明写「There is no separate React-only form prop or open-layer payload form field」。我亲验 `createUiStateModule.ts` 确实已拥有 `stateSlices` 注册机制,`syncIntent` 在 `kernel/base/state/src/types/slice.ts:34` 是真实字段,该形状可落地。§7 传递矩阵的 `surface form` 行与之一致,form **确为单源**。
- **「no runtime setter」是对的,不是缺陷（REJECTED_WITH_EVIDENCE,我自己的怀疑被证伪）**。我一度怀疑「slice 一次初始化、无运行时 setter」与 §3.3 动态切换冲突。重读需求 §3.3 原文:运行时变的是 `displayMode`（由 `displayRole` 与 `instanceMode` 派生,单显示器机器上随电源变化）,**不是 `surfaceForm`**。form 绑定设备朝向组,机器不会在运行中从 mobile 变成 laptop。所以无 setter 是正确且最小的选择,我不成立这条。
- **M-3 remount 自相矛盾（CONFIRMED_FIXED）**。详设第 210 行已删去 remount 表述,改为「Preserve the existing `SurfaceRoot` React identity; do not key/remount the whole root」;第 211 行冻结了 effect 顺序（观察新 snapshot/geometry → blur 旧 field → 定向 `closeLayer` → 卸载 admin 本地态 → 渲染新 identity）。计划第 308 行与之逐字一致,详设与计划**不再给两套机制**。
- **M-5 业务 layer 去留（CONFIRMED,裁决已落）**。五份文档均写入保留规则与 admin-only 例外;详设第 37 行、计划第 308 行、Gate 第 314 行三处互相一致。
- **M-6 native-less null-ref（CONFIRMED_FIXED）**。详设第 159 行冻结了三个类型的字段,并明写「A successful virtual focus sets active keyboard state even when the native ref is null; native focus is attempted only when a ref exists.`complete` follows the same rule and must not silently turn a virtual focus into a failed action」。这正是针对 `useInputFocusController.ts:122-127` 当前静默 no-op 的修复,`activateFocusScope(scopeId)` 也被指定为唯一 scope 转移 API。
- **M-7 三节生产 owner（CONFIRMED_FIXED）**。详设第 222 行改为 `admin-shell` 导出单个 `adminShellAssembly`,内含 layer-only `admin.console` part 与三个内建 section 的 part/renderer;`sample-console` 先合并该 assembly、再合并 feature parts、再合并 title-only sample section,全部经同一 `definedParts`。
- **S-1 口令向量缺日期（CONFIRMED_FIXED）**。详设第 182 行补入 `localDate=2026-09-10` 并要求「The test must construct local time explicitly」。**我按该公式独立复算过 2024-01-01 至 2027-12-31 全窗口,2026-09-10 确在唯一匹配集内**,与作者给出的日期一致——这是我复算的结果,不是转述作者自报值。
- **S-2 包边（CONFIRMED_FIXED,就已声明的三条而言）**。详设第 385–387 行把 `render→primitives`、`admin-shell→display-context/input`、`sample-console→admin-shell` 同时记入 `skeleton-graph.ts`、对应 `package.json` 与 `check-static.mjs` 三处。我亲验这三条边**均不成环**:primitives 只依赖 `ui.base.automation`,automation 只依赖三个 kernel 包;`admin-shell` 与 `sample-console` 侧无反向路径。
- **N-3 仓外绝对路径（CONFIRMED_FIXED）**。五份文档全文检索 `/Users/` 与 `/Volumes/`:**零命中**。
- **N-2 保持未证（CONFIRMED,处置正确）**。详设第 228 行明写 `maxMounted=24` 为硬上限,并要求一个 100 行、**每次滚动转移后采样**的 focused 夹具,断言首尾记录可达、无截断、挂载不超 24,并标注「This is `N-2=UNVERIFIED_REQUIRES_EVIDENCE` until that focused proof exists」。我确认该证据**当前不存在**,本复审**不**把 16+4+4=24 的算术当成行为证明。

## 3. M findings

### M-A — admin 身份常量与其消费点被分在一条单向包边的两侧,反向即成环（新增,由 `M-4` 的修复引入）

`ID=M-A`
`STATUS=CONFIRMED`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/...implementation-design-codex.md:211、224、382、385、445；...implementation-plan-codex.md:308；apps/terminal/skeleton-graph.ts 的 ui.base.admin-shell 节点；tools/terminal-skeleton/check-static.mjs:65-82(assertAcyclic)`
`DEXTER_DECISION_REQUIRED=否`
`EVIDENCE_TIER=static`

**事实。** 详设第 224 行:四个身份常量「are defined once in `admin-shell`」,第 382 行把它们的落点定为 `apps/terminal/ui/base/admin-shell/src/foundations/adminIdentity.ts`。详设第 211 行与计划第 308 行把**替换触发的清理**放在替换生命周期里,而详设第 382 行左右的变更表与第 445 行的 focused 证明表都把该生命周期的 owner 定为 `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`。

**事实。** `apps/terminal/skeleton-graph.ts` 的 `ui.base.admin-shell` 节点 dependencies 已含 `ui.base.render`。`tools/terminal-skeleton/check-static.mjs` 第 65 至 82 行的 `assertAcyclic` 在**投影后的声明图**上做环检测并抛错,同文件第 200 至 229 行另对图与 `package.json` 做集合相等校验。因此 `render → admin-shell` 是一条会被机器直接判红的边。

**事实。** 详设第 385 行记录的新边只有三条,**不含 `render → admin-shell`**。详设 §7 的声明→传递→消费矩阵共 24 行（`surface form`、`physical display index`、`display mode`、`host boolean`、`host source`、`layer placement semantics`、…、`logging/masking`）,**没有任何一行承载 admin 身份常量的传递**;每一条需要跨包的事实都有传递行,唯独这一条没有。

**推论（失败场景）。** 实施者写到计划第 308 行时,`SurfaceRoot` 需要 `ADMIN_CONSOLE_LAYER_ID`,但不能 import `admin-shell`。三条出路都坏:
- 在 render 里硬写字面量 `'admin.console.layer'` ——计划第 308 行恰好把这个字符串内联了,这是最可能被采纳的一条。它直接推翻详设第 224 行「defined once」的单源规则,admin-shell 侧改名后 render 侧静默失配,**`M-4` 要防的漂移原样回来**,且 `closeLayer` 对不存在的 layerId 不报错,失败是静默的。
- 把常量下沉到 kernel 包——可行,但详设明文说它们定义在 admin-shell,属未经设计的改动。
- 声明 `render → admin-shell` ——`assertAcyclic` 直接抛错。

**影响面。** `A-55`（关闭必须移除精确 admin layer）与 `A-57`（替换后 admin layer 数为 0、业务 layer 不变）这两条判据的实现路径当前不可落地;这也是 Dexter 裁决一之后**整条链上唯一必须显式发生的清理动作**。

**最小修复方向。** 把替换触发的清理从 render 移回 `admin-shell`:admin layer 组件自身订阅 `SurfaceContext` 的 surface identity,在 identity 变化时用 ref 捕获的**上一个 `displayMode`** 加自己的 `ADMIN_CONSOLE_LAYER_ID` 自行 dispatch `closeLayer`。常量不出 admin-shell,不新增任何包边,render 保持通用。

**为什么更小的修复不够。** 「在 render 里硬写字面量」更小,但它同时(1)推翻详设自己的单源规则,(2)让 `ui/base/render` 这个基础包内嵌一个 admin 专属的 layer id——这与详设 `forbid` 段禁止 admin 专属 overlay stack 是同一类耦合,只是换了形态,(3)把 `M-4` 已闭合的漂移风险原样放回。次小的方案是由 assembly 把 admin layer id 作为配置传入 `RenderProvider`,render 提供一个通用的 identity-replaced 回调;它同样成立且保持 render 通用,但比自闭方案多一个 prop 与一条接线,所以我把自闭列为首选、回调列为备选,由作者择一并写进 §7 矩阵。

### M-B — 需求 `A-19` 字面仍写 owner 与顺序键,与已落地的裁决冲突（责任在我这个需求 owner）

`ID=M-B`
`STATUS=DEXTER_DECISION=已裁决;待需求 owner 执行对账`
`SEVERITY=M`
`PATH_OR_SYMBOL=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-and-primitives-requirements-claude.md:523；doc/plans/platform/...implementation-design-codex.md:461；...implementation-plan-codex.md:445`
`DEXTER_DECISION_REQUIRED=否（Dexter 已于本轮前裁决「不需要顺序键,按 list 排序」;剩下的是机械对账,不需要再裁）`
`EVIDENCE_TIER=static`

**事实。** 需求第 523 行的 `A-19` 判据仍写「每条注册项带 owner 与顺序键」。需求正本 mtime 为 18:14,在裁决之后未更新。

**事实（作者处置正确,须表扬而非计入其失分）。** 详设第 461 行把该冲突登记为 `OPEN_REQUIRES_REQUIREMENTS_OWNER`,并明写禁止「silently claim the Claude-authored order-key clause was already rewritten」;计划第 445 行的 `A-19` 判据行也带了同样的 OPEN 备注。**作者没有偷选边,也没有代改我的文档**,这是本轮请求焦点 1 要求的正确行为。

**推论（失败场景）。** 两份权威文档当前互相矛盾。实施者若以需求为准会去建 order key,触发 `M-1` 已被裁决移除的整片 catalog 元数据改动;若以详设为准,则 `A-19` 的红夹具无法照需求字面写。判据本身当前不可证伪。

**影响面。** `A-19` 一条判据 + `M-1` 的改动范围。不影响其他判据。

**最小修复方向。** 由我（需求 owner）把 `A-19` 的判据文字改为「注册面源码无模块级可变绑定;section 顺序等于过滤后单一 catalog 列表顺序;无独立 order/owner 元数据」,并在需求沿革段记入 Dexter 裁决二。一行级修订。

**为什么更小的修复不够。** 只在详设里加一句「以裁决为准」不够:需求是本批的权威输入,`§11.4` 的三维对账（需求 ↔ 详设 ↔ 记忆）会在实施每一步比对需求字面,留着矛盾会让每一步的 `reconciliation` 都无法判 `MATCHED`。

## 3b. `M-B` 关闭记录（2026-09-11,复审交付后）

Dexter 裁定 owner 字段随顺序键一并去除。需求正本已由我（需求 owner）完成对账,三处一行级修订:

- `AC-5.4`（第 295 行）改写为「注册项不设独立的 owner 字段与顺序键」,并写明 owner 由 `partKey` 命名空间承载、顺序等于过滤后单一 `UiCatalog.entries` 列表顺序。
- `A-19` 判据内容（第 527 行）改为「两次注册后先注册者仍在;section 顺序等于过滤后单一 `UiCatalog.entries` 的列表顺序;catalog 条目不可变且注册面源码无模块级可变绑定」,红夹具扩为三条(模块级可变数组整体替换 / 出现第二份 section 列表 / 过滤后顺序与 catalog 列表顺序不一致)。
- §0 沿革新增一行,记录裁决与理由（保留 owner 会让 catalog 需要一个只有 section 才有的可选字段,重新触发 `assertEntryKeys` 的 exact-key 崩溃路径）。

`AC-5.3`（注册增量,后者不得抹掉前者）与 `AC-5.5`（注册面无模块级可变绑定）**未改动**,它们才是该判据的防回归实质。全文检索确认无 owner/顺序键残留引用。

**`M-B` 状态改为 `CLOSED`。详设第 461 行的 `OPEN_REQUIRES_REQUIREMENTS_OWNER` 与计划第 445 行的同名备注现已可以撤除。裁决后计数为 `1M / 0S / 1N`,仍为 `NO-GO`,唯一阻断项是 `M-A`。**

## 4. N findings

### N-A — 变更表对 `SurfaceRootProps` 的措辞仍读得出「form 是 prop」

`ID=N-A`
`STATUS=PARTIALLY_CONFIRMED`
`SEVERITY=N`
`PATH_OR_SYMBOL=doc/plans/platform/...implementation-design-codex.md:380`
`DEXTER_DECISION_REQUIRED=否`
`EVIDENCE_TIER=static`

**事实。** 详设第 380 行的变更表把 `apps/terminal/ui/base/render/src/types/props.ts` 的改动写成「`SurfaceRootProps` / `RenderProviderProps` | form/host/runtime facts」。

**事实（反证）。** 同一份详设第 371 行的 `SurfaceRoot` 行写「read form through the state selector」,§7 矩阵的 `surface form` 行写传递路径是 `selectSurfaceForm(root)`,计划第 192 行明写「There is no separate React-only form prop」。

**推论。** 权威表述是单源的,第 380 行只是措辞残留;但它是变更文件清单,实施者最可能照它建 prop,从而造出第二个 form 来源。一词之改。

**最小修复方向。** 把第 380 行的 `form` 去掉,只留 `host/runtime facts`。

## 5. 被推翻的作者结论

- **作者 intake 第 3 节称 `S-2` 的四条新边已覆盖依赖真相。** 推翻:就已声明的三条而言成立,但 `M-A` 表明还存在一条**被设计隐含要求、却因成环而不可声明**的边,该缺口未被识别。
- **作者 intake 第 5 节「最小改动理由」称生命周期落在 `SurfaceRoot` 加既有 `LayerStack`/`InputController` 是最小方案。** 部分推翻:把 admin 专属清理放进基础包 render,在包图上不可实现,且引入基础包对 admin 的耦合;把清理放回 admin-shell 自闭更小也更干净。
- **我自己上一轮的一处怀疑被本轮证伪并撤回**:我曾准备就「`surfaceForm` slice 无运行时 setter」与 §3.3 动态切换的冲突立一条 finding。重读需求 §3.3 原文后确认运行时变的是 `displayMode` 而非 form,该怀疑不成立,已撤回,不计入计数。

## 6. 当前文档仍漏掉的问题（除上述 findings 外）

逐项核过,**没有发现其他遗漏**。具体地:
- 焦点 3（form 单源、catalog 三点原子、layer-only 与 `admin.sections` 共用 selector）:计划第 188 行原子清单齐全;第 189 行定义 `containerKey=null` 与非空两种语义;第 191 行要求 `selectAvailableParts`、admission actor、`ScreenContainer`、`LayerStack`、`resolvePart` **复用同一 predicate** 且禁止第二 selector。通过。
- 焦点 4（host bool/source 端到端来自物理 index、canvas 仍按 displayMode、Web 与 pending 无偷换）:详设第 33 行「Physical `displayIndex` is used only at the integration/dev-host boundary」;计划第 193 行 `surfaceHostSourcesByDisplayIndex` 且「these maps must not be collapsed」;计划第 354 行要求 dev-host 用同一 capability-named 输入并对 index 0/1 分别调用、「Web must not synthesize host status from `displayMode`」;计划第 306 行明写 pending 态「does not affect the host gate and is not a fail-open/fail-closed decision」。通过。
- 焦点 8（导航/关闭/重开真实改变内容、判据可证伪、§9.2 无错放）:`A-54` 红夹具已是「tab 高亮变了但渲染内容没变」,`A-55` 是「关闭未移除精确 admin layer,或真实 launcher 重开绕过登录态」,`A-56` 是「sample section 为 shell 自有、仅夹具存在,或从生产 assembly 移除后仍可见」——都是行为级、可证伪的。判据总数 **59 条**齐全。§9.2 停放十项（`AC-2.1`、`AC-3.6`、`AC-3A.3`、`AC-6.6`、`ID-2.2`、`PR-4.1`、`PR-6.3`、`§3.1.3`、`§3.1.8`、`DBG-4.1`）与计划 §7.1 枚举**逐项一致,无漂移,无行为义务错放**。通过。
- 五层顺序:计划第 44 至 54 行九步与需求 `§11.3` 分层对应,第 2 步（键盘退役）标为原子且第 3 步依赖它,符合需求「不得与第 3 步并行」;第 3 步注明「CT-2 source first」,符合需求的层内顺序。通过。

## 7. 方案合理性

**问题对不对（产品判断）。** 对。Journey 的四个动作逐一对应 Dexter 裁决,不是从接口反推。

**方案优不优（推论）。** 修订后更优。`M-1`/`M-2` 的修复方向都选了「收进既有 owner」而非新建:catalog 形状改在 catalog 与 `definePart`,form 事实落在既有 `createUiStateModule` 的 slice 机制上,而不是新增 payload 字段或第二 selector。裁决二之后 catalog 只多一个必填 `surfaceForm`,比原方案的「必填 + 可选元数据」小了一整类。唯一仍不优的是 `M-A` 指出的清理落点。

**代价配不配（推论）。** 配。作者 intake 第 5 节自陈的唯一刻意代价是「所有 required primitives 留在范围内,即使某个 primitive 暂无首个业务消费者」——这是 Dexter 在 Q-17 明确要求的权衡,不是过度设计。

**UI 与交互自问（产品判断）。** 遮罩不暂停不夺焦、口令六格分框、section 不可跳转,三项均直接来自 Dexter 裁决;四节导航是同一 catalog 的投影而非独立列表 owner,无多余层级。未发现更短路径。不适用项无。

## 8. 证据档位与授权边界

- **static**：本轮全部结论来自当前源码与当前文档字节的静态对账。我重开并逐行核过 `definePart.ts`、`catalog.ts`(类型与 foundations)、`createUiStateModule.ts`、`contentActors.ts`、`content.ts`、`closeLayer.ts`、`workspaceSlices.ts`、`slice.ts`、`useInputFocusController.ts`、`skeleton-graph.ts`、`check-static.mjs`,以及五份设计文档、需求正本与作者 intake。
- **离线复算**：`S-1` 的日期结论由我按详设内联公式独立复算得出,不读写仓内文件。它只证明日期与向量自洽,**不证明 POC 运行时行为**。
- **focused / Web / Android / native / release / visual**：**全部未执行,本轮也无权执行**。计划 §8 七档状态为 `NOT_RUN` / `NOT_AUTHORIZED` / `UNSET`,我只核了分档与措辞是否诚实,未核其未来可执行性。`N-2` 保持 `UNVERIFIED_REQUIRES_EVIDENCE`,`16+4+4=24` 的算术**不是**行为证明。静态通过、focused 计划完备、历史 review 或作者 intake,**都不构成视觉验收 PASS**。
- **授权边界**：本文只授权本次设计与计划复审。**不授权**源码实施、Roadmap 下一步、任何动态环境操作或仓库控制动作。`M-A` 在既有批准边界内可由作者自主修复;`M-B` 需由我执行需求对账,Dexter 已裁决,不需再裁。
