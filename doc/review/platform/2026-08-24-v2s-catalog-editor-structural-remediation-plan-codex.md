# 商品编辑抽屉结构性根因修复计划

状态：`FACT_FAMILY_MIGRATION_COMPLETE__HOST_AND_SESSION_RECONCILIATION_OPEN`

触发：原详设逐项对账发现 `ui/CatalogItemEditorController.tsx` 为 5,209 行；九个
`CatalogItem*Editor.tsx` 文件各只有 pass-through `children` wrapper。这不是可接受的职责拆分，违反正式需求 §8、
IA §2.3、implementation design CP-04/CP-07 的“宿主只装配、九类事实族真实独立”要求。

## 1. 已重开源码的事实

| 当前事实 | 证据 | 结论 |
| --- | --- | --- |
| 宿主同时持有详情读取、草稿 hydrate/persist、whole-save、生产标签/单位/候选读取、九个区段 JSX、规格/资产/套餐/属性/点单子任务 | `CatalogItemEditorController.tsx:444-5209` | 一处变更会跨越生命周期、事实族和 surface，正是本批要消除的根因。 |
| `CatalogItemEditorWorkspace.tsx` 只转发给 controller；各 `CatalogItem*Editor.tsx` 只渲染 children | `ui/CatalogItemEditorWorkspace.tsx` 与九个 wrapper | 文件数量不构成业务边界，不得作为设计完成证据。 |
| 草稿已有唯一 hook，且 `CatalogWorkspaceTask` 已是第一层互斥住址 | `model/useCatalogItemDraft.ts`、`model/catalogWorkspaceTask.ts` | 应保留而不是新建全局 store；拆分必须围绕现有三住址完成。 |
| View 已是独立 `CatalogItemViewDrawer.tsx` 与 presenter | `ui/CatalogItemViewDrawer.tsx`、`ui/CatalogItemReadOnlyPresenters.tsx` | 本次只重构编辑 side，不回退 View/Edit 分壳。 |
| 九个事实族当前均有真实编辑/只读 JSX；旧 `AttributeAssignmentsEditor`、`OrderOptionConfigurationsEditor`、`SkuMatrixEditor`、`Composite*` 与 `Legacy*` 在 controller 均为零命中 | `ui/CatalogItem*Editor.tsx` 与 `ui/CatalogItemEditorController.tsx` 当前源码扫描 | children 透传根因已关闭；controller 仍为 2,503 行且 Workspace 仍只转发，故宿主/会话条目仍 OPEN。 |

## 2. 目标模块边界

```text
CatalogItemEditorDrawer (surface adapter, <= 300 lines)
  └─ useCatalogItemEditorSession (detail/currentData, draft hydrate, whole-save, refresh and close protocol)
      └─ CatalogItemEditorWorkspace (left anchors + fixed footer + active section assembly, <= 300 lines)
          ├─ CatalogItemBasicEditor
          ├─ CatalogItemIdentifiersEditor
          ├─ CatalogItemSkuSpecificationsEditor
          ├─ CatalogItemAttributesEditor
          ├─ CatalogItemOrderOptionsEditor
          ├─ CatalogItemProductionEditor
          ├─ CatalogItemInventoryBomEditor
          ├─ CatalogItemCompositeEditor
          └─ CatalogItemGovernanceEditor
```

每个事实族文件必须拥有自己的业务 JSX、局部 display adapter 与明确 props；不得再只接收 `children`。
跨区段行为只能通过 `CatalogItemEditorSession` 暴露的 typed draft section API 发生。`useCatalogItemEditorSession`
可以拥有协议组合，但不得渲染任何业务表单或区段 JSX；`Workspace` 只能选择区段、装配 props 和运行 Drawer
lifecycle，不能直接实现字段、候选或数组序列化。

## 3. 串行迁移顺序与不变量

| 顺序 | 原 controller 段 | 迁移目标 | 迁移后必须成立 |
| --- | --- | --- | --- |
| S-01 | `223-443` 纯 clone/serialize、字段标签、小型 pure helpers | `model/catalogItemEditorDraftAdapters.ts` | 纯函数零 JSX；draft 结构的 clone/serialize 只有一个住址。 |
| S-02 | `444-2364` 内的 detail/read/draft/save/asset/production-tag 生命周期 | `model/useCatalogItemEditorSession.ts` | `currentData` 是唯一服务端事实；`useCatalogItemDraft` 是唯一草稿；whole-save、known/unknown outcome、close/recovery 行为不变。 |
| S-03 | `2365-2619` 基础与媒体区段 | `CatalogItemBasicEditor.tsx` | 分类仍只用 owner candidate TreeSelect；单位、图片、价格规则不泄漏至宿主。 |
| S-04 | `2620-2701` 标识与规格区段；`2965-3933` 标识/规格子任务 | `CatalogItemIdentifiersEditor.tsx`、`CatalogItemSkuSpecificationsEditor.tsx`、各子任务文件 | 稳定 editorId、规格同商品制作标签、子任务只回写父草稿。 |
| S-05 | `2702-2737` 属性与点单；`4668-5209` editors | `CatalogItemAttributesEditor.tsx`、`CatalogItemOrderOptionsEditor.tsx` | 两种候选形态、定义切换清理、点单制作变化不增加生产标签。 |
| S-06 | `2738-2794` 制作信息；`3134-3238/3934-4042` profile editors | `CatalogItemProductionEditor.tsx` | 单一 `productionTagRef`，候选停用语义、规格不可改生产标签保持。 |
| S-07 | `2795-2821` 库存与 BOM | `CatalogItemInventoryBomEditor.tsx` | 仅编辑态有可编辑控件；owner rule/mode/计量语义不由 UI 重建。 |
| S-08 | `2822-2897` 套餐与治理；`4043-4667` candidate/asset/composite helpers | `CatalogItemCompositeEditor.tsx`、`CatalogItemGovernanceEditor.tsx`、`ui/catalog-item-editor-support/*` | 复制/套餐候选不穿透 session state；治理不混入普通保存。 |
| S-09 | 删除 `CatalogItemEditorController.tsx` 旧实现 | `CatalogItemEditorDrawer.tsx` + workspace/session | 不留下 re-export、legacy controller、pass-through wrapper 或两套实现。 |

## 4. 每段回读与反例

1. 每次迁移前后重读正式需求 §4.4-4.6、§6.4、§8 与 IA §2.2-2.5、§3.3。
2. 每个 section 的 focused proof 至少验证：区段真实渲染、上游变化清理、known failure 保草稿并定位、关闭回焦点；
   不以文件存在或 snapshot 代替。
3. 全局静态反例：任何 `CatalogItem*Editor.tsx` 为单一 children wrapper、任意宿主超过 300 行、一个字段新增
   同时要求改 workspace 宿主、或 `CatalogItemEditorController` 残留，均为 FAIL。
4. 不新建草稿 store、不创建 section save、不将 owner facts 拷贝进 `useState`、不把 sessionStorage 秘密扩大。
5. 生成/compile/test 在 S-09 与原详设对账全部闭合后才允许执行。

## 5. 两轮静态计划审查标准

**Round 1：边界完整性。** 检查九事实族、session/Workspace、各子任务是否都有唯一归属；反例是“移动组件但
保留 controller 直接调用/直接 JSX”。

**Round 2：行为守恒。** 用 save body、draft recovery、close protocol、category TreeSelect、productionTagRef、
asset cleanup、inventory mode switch、option effect 七条跨边界流程逐一追踪；反例是 props 传递遗漏导致 owner
规则、错误定位或草稿清理变成 fallback。

两轮均记录明确 PASS 才实施；任一 finding 先修改该计划或准确重开设计，禁止边写边猜。

## 6. 计划静态审查记录

### Round 1 · 边界完整性

`RESULT=PASS_WITH_CORRECTION`

重开 `CatalogItemEditorController.tsx:444-2364` 后发现初稿把全部 local state 一并归入 session hook，会让
`activeSection`、子任务开关、治理 Modal、配置绕行焦点等纯 UI 瞬态脱离工作区 reducer。该形态违反 IA 的三住址。

**已修正边界：** `useCatalogItemEditorSession` 只拥有 server read/currentData、draft hydrate/persist、whole-save、
staged asset ownership、精确 refresh 与 close outcome；`CatalogItemEditorWorkspace` 拥有 active section、scroll anchor
controller、`CatalogEditorChildTask`、`CatalogViewChildTask` 接力、promotion Modal 和 dictionary handoff 的纯 UI state。
九事实族只从 typed session API 读写自己的 slice。不得用 session hook 返回一个未类型化的“全部 controller state”对象。

### Round 2 · 行为守恒

`RESULT=PASS`

逐项从现有 controller 追踪并对照正式需求 §4.4-4.6、§6.4、§8 与 IA §2.2-2.5：

1. whole-save 仍只在 session API，一次 `saveOperationsCatalogItem`，任何 section 不直接发保存；
2. category TreeSelect 仍在 Basic section，候选由 `useCatalogCategoryCandidates` 读取 contract 的 path/selectable/reason；
3. 单一 `productionTagRef` 只在 Production section，SKU/option props 不含标签写入入口；
4. asset stage/release 的 owned staged refs 由 session 管理，section 只发送稳定 editorId；
5. inventory mode 变化的确认与 draft 清理归 Inventory section，whole-save 仍由 session owner command 收口；
6. option effect 仍只包含时长增量与说明，不能借 section 拆分恢复标签字段；
7. dirty close/recovery 经过 workspace lifecycle 调 session draft API，known/unknown save outcome 均不改写事实。

未发现要求新产品语义、第二草稿住址或兼容 fallback 的缺口。可以按 S-01 至 S-09 实施；每个 S 完成后仍必须对原始详设逐条回读。

## 7. 实施对账记录

### S-01 · 草稿适配层

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

已将 `MediaDraft`、整单草稿快照、稳定 `editorId` 的规格/标识/套餐草稿类型、字段到区段映射、
clone/serialize 边界、制作变化纯函数迁入
`model/catalogItemEditorDraftAdapters.ts`。`CatalogItemEditorController.tsx` 现只 import 这些类型与
函数，不再定义第二份草稿模型或保存序列化逻辑；focused test 也直接从适配层导入被测纯函数，避免经
surface re-export 形成隐式兼容面。

此项尚未标记 `SOURCE_MATCHED`：下一步须先完成 S-02 至 S-09，且在 controller 被删除后复读
原详设 §8 的“宿主只装配”条款；随后才可运行任何 compile 或 focused test。

### S-04（进行中）· 标识事实族

`STATUS=IN_PROGRESS_NO_STATIC_GATE_RUN`

`CatalogItemIdentifiersEditor.tsx` 已由 pass-through wrapper 改为实际承载商品标识编辑、只读
投影、规格识别码子任务以及由 manifest 解析的 item/SKU 准入。区段 host 只传入标识草稿 slice、
准入、稳定行 id 与 typed 回写，不再把标识 JSX 包在 children 中。迁移期间 controller 的旧同源定义
尚待删除；因此本项不能以“新文件存在”宣称完成，S-09 的 legacy-zero 扫描仍是关闭条件。

### S-03 / S-05（进行中）· 基础与商品属性事实族

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

`CatalogItemBasicEditor.tsx` 现在实际承载名称、短名、分类 TreeSelect、商品标签、销售/基础计量单位、商品级标准价和图片操作；它不再接受 `children`。分类候选仍经 owner task read，不建立本地平铺分类。`CatalogItemAttributesEditor.tsx` 现在实际承载属性定义候选、顺序、文本/选项值编辑与只读投影；只读分支使用 presenter 而不是禁用表单。控制器内旧同源函数尚待在 S-09 删除，故这两项仍不是 `SOURCE_MATCHED`。

`CatalogItemOrderOptionsEditor.tsx` 现在实际承载选项定义候选、单选/多选约束、默认项、加价与可交换的制作变化；制作变化仍严格限于时长增量和追加说明，排序写回选项组/选项值业务 displayOrder。控制器中旧同源实现尚待清除，防止两套维护路径。

### S-02（进行中）· session 读模型与草稿住址

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

新增 `model/useCatalogItemEditorSession.ts`，它是唯一的编辑 session 读模型：拥有 RTK `currentData` 的商品详情、商品形态说明、媒体规则和可恢复的整单草稿；不含 Drawer、Tab、Modal 或任何业务 JSX。控制器已改为消费该 typed session，而不是自行请求/解码详情、说明与草稿。当前它仍持有过多 surface-local state 和 action callback；必须继续迁给 workspace/事实族并删除 controller 后才可标记 `SOURCE_MATCHED`。

### S-09（部分完成）· 旧实现清零

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

旧 `LegacyCatalogCategoryDescriptorField`、`LegacyIdentifierEditor`、`LegacySkuIdentifierEditorModal`、`LegacySkuPreparationEditorModal`、`LegacyPreparationProfileEditor` 与 `LegacyCatalogAssetEditor` 已从控制器精确删除；目前 `rg '^function Legacy'` 为零，且类型检查继续通过。此结果只关闭“同源旧实现并存”的一个维度；控制器仍超出宿主上限，规格/套餐 wrapper 仍存在，因此 S-09 和总体结构对账保持 OPEN。

### S-07（进行中）· 库存与 BOM 事实族

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

`CatalogItemInventoryBomEditor.tsx` 现真实拥有库存规则事实族的只读/编辑分支、owner 节点的
基础计量单位回查以及 `CatalogInventoryBomWorkbench` 装配。controller 仅提供 scope、brand、规则
draft slice 与 typed 回写，不再直接渲染该 workbench。该拆分不重建库存方式、BOM 或单位语义；
`editing` 仍严格来自 owner 的 denied field。

### S-06（进行中）· 制作信息事实族

`STATUS=MISMATCH_FIXED_AND_REREAD_PENDING`

`CatalogItemProductionEditor.tsx` 已拥有单一生产标签候选、停用绑定的可见性、制作单显示名称、
预计制作时长及制作说明；它同时只读地汇总规格覆盖与点单选项增量。商品级标签选择仍是唯一写入入口，
不向规格或点单 props 泄漏 `productionTagRef`。旧 controller 内同源 profile 实现与规格子任务尚待清零，
故不得据此声称 S-06 已完成。

## 8. 2026-08-24 根因重开：surface、治理与 session 的全量修复计划

`S-01` 至 `S-09` 的迁移完成了 children wrapper 的第一层根因，但本次逐维回读发现它没有完成第二层：
**业务实现虽然被搬出旧 section 函数，却仍由巨型 controller 持有 command、资源、surface 与治理状态。**
因此下列计划取代“只清 unused import 后继续测试”的错误路径；任何一项未满足行为、形态、动作、关系、
位置、文案、限制七维一致时，均不得标记 `SOURCE_MATCHED`。

### 8.1 已证实的同根事实

| id | 七维不一致 | owning source | 已证实事实 | 根因 |
| --- | --- | --- | --- |
| RR-01 | 形态、关系、位置 | `CatalogItemEditorController.tsx` 2,019 行；`CatalogItemEditorWorkspace.tsx` 15 行 | Workspace 仍只转发，controller 同时拥有 Drawer、whole-save、媒体、候选、tab 装配和 Modal | 只是搬运 JSX，没有把 session/surface 主权迁移到批准的模块边界。 |
| RR-02 | 行为、动作、位置 | `CatalogItemEditorController.tsx`、`CatalogItemViewDrawer.tsx` | 生命周期 command 在 View 已有一份正确入口；Editor 仍保留第二份不可达 status/void command。临时商品转正的 preflight/execute 却只遗留在 Editor，且无入口可达 | View/Editor 分壳时没有按 Journey 重新归属治理子任务，形成“一份重复、一份失联”。 |
| RR-03 | 形态、关系、限制 | `CatalogItemEditorSectionAssembler.tsx` 433 行 | assembler 既组合九事实族又自己读取单位/构造 lock/card/context，成为第二个超限隐形宿主 | section props 没有从 typed session/view model 收敛，导致 host 只换名不减责。 |
| RR-04 | 行为、关系 | `useCatalogItemEditorSession.ts` 49 行；controller close callback | session 仅有 read/draft；whole-save、known/unknown outcome、stage/release、精确 refresh/close 在 controller。`closeAfterStagedRelease` 还漏了两个 state setter dependency | draft state 已抽出，资源/命令生命周期仍被遗留 controller 捕获。 |
| RR-05 | 动作、位置、文案 | `CatalogItemViewDrawer.tsx` | 生命周期 action 直接并排在 header，设计要求 View header 的“更多”菜单；临时商品没有“检查是否可以转为正式商品”入口 | UI 已有 actionAvailability 事实，但没有按交互工件收敛动作容器及治理路径。 |
| RR-06 | 关系、限制 | `CatalogItemEditorController.tsx`、`CatalogDictionaryDrawer.tsx` | 编辑内 dictionary quick manage 可以与编辑 Drawer 并存；只有 production tag 走 close→CONFIG→resume | 按编辑绕行的全局规则只实现了一个例外，未建立统一 handoff。 |
| RR-07 | 文案、限制、诊断 | Editor/View 的 `operationsProblemOf(error).detail` 直出路径 | 只有标识/制作的一小部分 typed problem 经 `catalogIdentifierProblemFeedback` 映射；保存、媒体、生命周期和转正仍可直接展示 transport detail | 没有把 IA 的“业务 copy + 区段定位 + 脱敏日志”做成统一 adapter，导致每个 command 自己决定错误呈现。 |

### 8.2 修复顺序与不可回退边界

1. **先收敛可达治理：** 把临时商品 preflight/execute 抽成 View child task（独立 `CatalogTemporaryPromotionTask` 或等价命名的专注组件）。入口只在临时商品 View 的当前动作区；preflight 失效、失败保留输入、成功精确刷新并关闭 task。删除 Editor 内全部 promotion/status/void command 和 Modal。普通生命周期继续唯一地消费 View 的 `actionAvailability`，不从状态字面量推导。
2. **再收敛 surface：** `CatalogItemEditorDrawer` 成为实际 Drawer/lifecycle surface（不超过 300 行）；`CatalogItemEditorWorkspace` 成为实际区段锚点、fixed footer、active section/child task 编排（不超过 300 行）；删除 controller，而不是 re-export/改名。查看 Drawer 同步拆出 action menu 和 View child task，避免超过 host 上限。
3. **再收敛 command/resource session：** `useCatalogItemEditorSession` 公开 typed `saveWholeDraft`、`stage/release`、`refreshAfterSave`、`closeWithStagedRelease` 等协议；它只拥有 RTK currentData、整单 draft、媒体 owned refs、save outcome 与精确 refresh。Drawer/Workspace 只持有 UI 瞬态（tab anchor、confirm/modal、focus return），事实族只得到所属 draft slice/callback。
4. **再收敛 section assembly：** 以 typed section view model 或按事实族分组的装配组件替换 433 行万能 props；Assembler 及所有 host 均不得超过 300 行。候选查询留在事实族或标准 hook，lock 文案/label 由一个共享 adapter 输出，不复制。
5. **统一编辑→配置 handoff：** 任一字典入口均先持久化 draft，关闭 EDIT，再 dispatch `OPEN_CONFIG(returnToEdit)`；配置完成通过已有 `CatalogEditResume` 回原区段/控件。不得在编辑抽屉上再叠配置 Drawer。
6. **最后删除退役物：** `CatalogItemEditorController`、重复 lifecycle command、不可达 promotion Modal、未使用 imports/vars、旧 test source string assertion 同批移除或改为新 surface assertion。不得保留 compatibility wrapper/fallback。
7. **统一问题与日志边界：** 新建或扩展一个 catalog UI typed-problem adapter，输入仅为安全的 `errorCode/field path/known outcome`，输出为 IA 逐字业务文案、定位 section 与可执行下一步；未知/5xx 使用固定通用文案，不渲染 `detail`。session 在 save/media/close 的 start/success/known-failure/unknown-failure 写脱敏结构化日志，关联 `itemCode`、section、action、requestId/operation instance（若可用）和 outcome，禁止 raw body、file content、grant/token、owner/transport detail。

### 8.3 每步的可证伪对账

| 修复 | 行为 | 形态/位置 | 动作/关系 | 文案/限制 |
| --- | --- | --- | --- | --- |
| 治理迁移 | preflight 任一输入变化失效；失败事实不变 | 只从 View child task 打开 | owner actionAvailability 唯一控制生命周期；promotion 不进入 Editor | “检查是否可以转为正式商品/确认转正”，不显示内部 token/version。 |
| Drawer/Workspace | close/reopen 恢复同商品、区段、draft/error | 第一层仅一个 Drawer，Drawer/Workspace 各≤300 | footer 调 whole-save；关闭走 session release 协议 | 关闭三径统一脏提示、失败留在触发位置。 |
| Session | known/unknown outcome 不伪刷新；staged 媒体全部释放才关闭 | 无 JSX/Modal | 事实族不得直发 save/stage/release | 日志只记录关联 id/phase/outcome，不含文件内容或 request body。 |
| Config handoff | 编辑草稿不丢、回到原控件 | EDIT 关闭后才开 CONFIG | `CatalogWorkspaceTask` 是唯一第一层 task union | 只显示业务库名，不暴露 dictionary/owner。 |
| 问题与日志 | known failure 定位而不清草稿；unknown 不伪刷新 | 顶部任务问题 + 区段问题 | command 使用同一个 feedback adapter | 不显示 raw code/detail，日志可由 action→request→outcome 关联且脱敏。 |

### 8.4 重开后的两轮计划审查

**Round R1（静态边界审查）= PENDING。** 逐个检查治理、Drawer、Workspace、session、Assembler、九事实族的
唯一 command/state/JSX 归属；红反例：Editor 出现 promotion/status command、Workspace 仅转发、任何 host >300、
编辑和配置并存。

**Round R2（静态行为审查）= PENDING。** 从用户入口追踪：查看→编辑→保存/关闭恢复、编辑→配置→继续编辑、
临时商品→检查→补缺口→转正、生命周期动作→confirm→owner readback、图片 stage→close cleanup。每条逐字对照
formal/interaction/IA 的位置、文案和限制；任一遗漏即回到本节计划修正，未经 R2 `PASS` 不实施、更不测试。

### 8.5 R1 · 静态边界审查记录

`RESULT=PASS_WITH_CORRECTION`

本轮以当前源码而非迁移自述重算：command mutation 的全集显示 `save/stage/release/transition/preflight/execute`
均仍在 Editor controller，View 又持有一份 transition；`CatalogItemEditorWorkspace` 仅 15 行转发，
`CatalogItemEditorSectionAssembler` 433 行；编辑内仍直接挂 `CatalogDictionaryDrawer`，而 Workbench 的统一
`CatalogWorkspaceTask` 已能正确实现 `EDIT → CLOSE → CONFIG(returnToEdit)`。因此 RR-01 至 RR-06 均成立，
初稿遗漏的两项已纳入计划：

1. View 的临时商品专注任务必须替换 controller 内的不可达 Modal；现有 Modal 把 `sourceVersion` 直接放进
   用户描述，实施时不得搬运该技术事实，改为“资料已变化，请重新检查”等可执行业务说明。
2. View 的并排生命周期按钮必须收敛为 header “更多”菜单下的当前可执行集合；编辑仍是可写用户的主动作，
   生命周期/复制按菜单项顺序与普通/危险确认分级呈现，不能退回灰按钮阵列或从 status 猜动作。

R1 的负向检查也成立：九事实族没有重新出现 `children` wrapper；分类仍由 owner-backed TreeSelect；
production tag 仍为 item 单值，未流入 SKU/option props。R1 不代表源码已合格，只确认 §8.2 的修复边界完整，
可以进入 R2 的用户路径追踪。

### 8.6 R2 · 静态行为审查记录

`RESULT=PASS_WITH_CORRECTION`

按五条入口逐段追踪后的结果如下：

1. **查看→编辑→保存/关闭恢复：** whole-save 仍是一条 `saveOperationsCatalogItem`，但它把成功后的
   clear/reset、导航 `onSaved`、媒体 staged 标记清理拆散在 controller；close release 亦在 controller，
   因而计划必须让 session 输出单一 typed outcome，Workspace 决定 UI 跳转。已由 §8.2 第 3 步覆盖。
2. **编辑→配置→继续编辑：** production tag 正确先 persist/close；TAG、UNIT、规格属性和值却调用 editor
   内部 `CatalogDictionaryDrawer` 并自动写回候选，违反第一层互斥和“配置完成后重新读取候选”。已由 §8.2 第 5 步覆盖，
   实施时删除内部 quick-manage 自动写回而不是加 overlay lock 掩盖。
3. **临时商品→检查→补缺口→转正：** preflight/execute 代码存在但 `openPromotion` 无调用点，现状不可达；
   同时它展示来源版本并直接落 `feedback.detail`。已由 §8.2 第 1 步与第 7 步修正。
4. **生命周期→confirm→owner readback：** View 已正确只显示 actionAvailability 允许的 action 并在成功后 refetch；
   但动作位置是并排 header 按钮、Editor 仍留第二份 command。已由 §8.2 第 1/2 步修正，且禁止本地 status switch。
5. **图片 stage→close cleanup：** media 的 stable row identity 与释放失败不关闭的业务意图仍正确；缺陷是 callback
   closure 与 command ownership散在 controller。已由 §8.2 第 3 步修正，R2 要求以 release readback 与日志关联 proof 回归。

R2 额外发现 `feedback.detail` 直出是横跨五条路径的共同根因，故新增 RR-07 与第 7 步。修订后重新对照 formal
§4.4-4.6、interaction `CATUI-VIEW/CATUI-LIFECYCLE/CATUI-EDIT`、IA §2/§3：计划不再遗漏任何已证实路径，
`PLAN_REVIEW_R2=PASS`。这是修复计划可实施的结论，不是生产源码或静态门的 PASS。

规格制作覆盖弹层现已迁入该模块，覆盖模式只有“继承商品默认”与“单独设置”；两种路径都只读/写
完整制作 profile，且 props 中不存在生产标签选择或写回字段。控制器内旧实现仍需在 S-09 删除。
