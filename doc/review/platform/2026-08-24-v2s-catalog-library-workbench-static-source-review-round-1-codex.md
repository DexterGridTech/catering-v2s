# 商品库工作台静态源码审查 · Round 1

> **当前证据状态（2026-08-25 复开）**：下方历史 lint、focused、生成链与 L2 self-test 发生在随后
> 的表格 presenter、配置 Drawer、配置 state、用户文案门与 L2 owner-oracle 改动之前，均为
> `STALE_NOT_CURRENT_TREE_EVIDENCE`。它们只能说明当时的树，不能支持当前树的任何 PASS、动态授权或
> 收口。当前复核以 `doc/review/platform/2026-08-24-v2s-catalog-library-original-design-reconciliation-codex.md`
> 的十二维硬条件为唯一准入：**行为、形态、动作、关系、位置、用户可见文案、限制、状态所有权、控件级联、
> 失败与恢复、可访问/焦点、数据来源与失效边界**。任一维不一致即保持 OPEN。

日期：2026-08-24  
审查范围：编辑抽屉、Workspace、九事实族与其 focused/L2 入口。  
方法：以正式需求、IA、implementation design 为准，逐项重开当前源码；不以文件存在、TypeScript 或旧 review 替代行为核验。

## 对账硬条件

每项只有在**行为、形态、动作、关系、位置、用户可见文案、限制**全部一致时才可标记 `SOURCE_MATCHED`。任一维度不符即为 `OPEN`；不得由组件拆分、静态通过或局部测试替代。

## 当前可证实事实

| 维度 | 现状与证据 | 结论 |
| --- | --- | --- |
| 事实族形态 | 九个 `CatalogItem*Editor.tsx` 均包含实际 JSX；controller 中 `Legacy*`、`AttributeAssignmentsEditor`、`OrderOptionConfigurationsEditor`、`SkuMatrixEditor`、`Composite*` 均为零命中 | `PASS`：children 透传根因已关闭 |
| SKU/套餐行为 | 规格矩阵、单位覆盖、图片、识别码和制作子任务已在 `CatalogItemSkuSpecificationsEditor.tsx`；套餐候选、改目标清 SKU、稳定 `editorId` 已在 `CatalogItemCompositeEditor.tsx` | `PASS_WITH_FOCUSED_PROOF_PENDING`：迁移后仍需对保存体、取消和错误定位做 focused proof |
| 分类关系 | `CatalogItemBasicEditor.tsx` 使用 owner-backed TreeSelect；没有以平铺 Select 替代分类候选 | `PASS_WITH_L2_PENDING`：仍待树路径、不可选原因和跨 scope 的真实 L2 oracle |
| 制作信息限制 | 生产标签在 Production editor 为单值；规格制作子任务不接收生产标签写入入口 | `PASS_WITH_ACCEPTANCE_PENDING` |
| 用户文案 | 发现“基础计量单位决定库存消费单位”泄露实现词；已改为“用于记录库存扣减数量；配置配方或库存时必须填写。” | `FIXED_AND_REREAD_PENDING` |
| View/Edit 关系 | View 仍由 `CatalogItemViewDrawer.tsx`/presenters 承担；本轮编辑事实族不以 disabled 表单代替只读 | `PASS_WITH_RENDER_PROOF_PENDING` |

## 阻断 finding

| id | 不一致维度 | owning source | 事实 | 根因与整改 |
| --- | --- | --- | --- | --- |
| SR1-M | 形态、关系、位置 | `ui/CatalogItemEditorController.tsx`（2,076 行）、`ui/CatalogItemEditorWorkspace.tsx`（15 行） | Workspace 仍只是 controller 转发，实际宿主远超设计的 300 行边界 | 抽出 typed session 的 whole-save、asset、refresh/close 协议与 Workspace 的区段装配；controller 不得以改名或 re-export 伪关闭 |
| SR2-M | 行为、动作、关系 | `model/useCatalogItemEditorSession.ts`（仅 detail/manifest/draft read） | 保存投影已收敛到 `model/catalogItemSaveRequest.ts`，但发命令、known/unknown outcome、媒体 stage/release、精确刷新和 close/recovery 仍在 controller | 将命令与资源生命周期收敛为 session 的 typed API；事实族只通过 props 回写自己的 draft slice |
| SR3-S | 限制、验证 | `ui/CatalogItemDrawer.test.tsx` 与现有 L2 declarations | 新迁出的规格/套餐/区段装配没有逐项证明取消不写草稿、上游变化清理、known failure 定位与关闭回焦点 | 结构根因修复后补 focused proof；不得以当前渲染/静态字符串测试顶替 |

## 审查结论

`RESULT=NO_TEST_PERMISSION_YET`。TypeScript 当前可通过，但 SR1-M/SR2-M 意味着与详设的形态、关系和动作仍不一致；禁止进入生成链、Testcontainers 或 L2。下一轮审查仅在 session 与 Workspace 实际收敛、并回读同一维度后进行。

## 首败诊断记录

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

- `FIRST_FAILURE`：`yarn lint:architecture` 的本批首项为
  `CatalogItemEditorController.tsx:466`，`closeAfterStagedRelease` 使用了 `setMediaDraft` 与
  `setSkuStagedMedia` 却未声明 React callback dependency。
- `LAST_KNOWN_GOOD`：同树 `yarn typecheck` exit=0；
  `scripts/check/frontend-architecture` exit=0。
- `BROKEN_BOUNDARY`：事实族迁移后，关闭前媒体释放的 session/resource lifecycle 仍由 controller 捕获；
  ESLint 同时列出的 controller unused imports/不可达治理函数不是独立清理项，而是 RR-01 至 RR-05 的同根表象。
- `NEXT`：不单补 dependency 或删除函数止血；先执行修复计划 §8 的 R1/R2 静态审查，确认治理归属、session 边界和
  surface 形态后才改动生产源码。全 app 其余 lint 项单列为并行遗留，不与本批根因混淆。

## 2026-08-25 增量对账（非收口）

- `useCatalogItemEditorSession` 已接管整单保存、规格作废和 staged asset release 的命令、幂等键与脱敏
  `STARTED` / `SUCCEEDED` / `KNOWN_FAILURE` / `UNKNOWN_FAILURE` 日志；商品库 UI 的
  `operationsProblemOf(...).detail` 与 `feedback.detail` 直出集合已为精确零。
- 这不关闭 `SR1-M` / `SR2-M`：Controller 仍为 1,424 行，Workspace 仍为 forwarding surface，图片 stage 与
  close/recovery 仍未迁入 session。故状态仍为 `SOURCE_RECONCILIATION_OPEN`，不得把本次静态进展解释为
  focused、generated、Testcontainers 或 browser L2 通过。

## 2026-08-25 编辑工作区逐维源码复核 · Round 2

`REVIEW_SCOPE=RR-01/RR-02 + IA-CATUI-04`  
`METHOD=正式需求 4.4/4.5、IA-CATUI-04、结构修复计划 §2-4 与当前 owning source 双读`  
`RESULT=STATIC_SOURCE_MATCHED_FOR_EDITOR_STRUCTURE_ONLY`

| 对账维度 | 当前源码与可证伪边界 | 结论 |
| --- | --- | --- |
| 行为 | `useCatalogItemEditorSession` 已唯一拥有 RTK detail/manifest、draft hydrate、整单保存、规格作废、暂存媒体 stage/release；dirty refetch 不覆盖草稿，保存成功才标记下一次 hydrate | 匹配；动态 owner/readback 仍待后续验证 |
| 形态 | `CatalogItemEditorController.tsx` 与所有 re-export/import 为零；`CatalogItemEditorDrawer.tsx=11`、`CatalogItemEditorWorkspace.tsx=184`，均未超过 300 行 | 匹配；不以新 hook 文件数量替代此扫描 |
| 动作 | Workspace 的唯一保存动作在固定 footer，文案为“保存商品”；取消、X、Esc、遮罩均经同一 `useDrawerFormLifecycle`，close 前仍先由 session 释放暂存资产 | 匹配；关闭后的真实焦点需 L2 证明 |
| 关系 | 商品级生产标签候选 cursor/read、停用既有绑定可见性和分页滚动已移入 `CatalogItemProductionEditor`；Workspace state 不再读该候选。前端 `productionTagRefs`/`addProductionTagRefs` 精确零 | 匹配；单值 owner 判定仍待 acceptance |
| 位置 | Workspace 是实际 `Drawer`，以 `Tabs tabPosition="left"` 作为按形态裁剪的左侧区段锚点；唯一内容区由 `contentRegionRef` 滚动，footer 固定 | 匹配；不再是 forwarding wrapper |
| 文案 | 编辑标题为“〈商品名/编码〉· 编辑商品”，恢复提示为“检测到未保存草稿”，读取失败按钮为“重新加载”；错误适配不再直出 `detail` | 匹配；完整 USER_VISIBLE_COPY 扫描仍在全工作台审查范围 |
| 限制 | 草稿新增 `contentScrollTop`，不进入 save body；恢复后重置内容滚动位置。生产标签仍是 `selectedProductionTagRef?: string` 单值且 SKU/点单制作 props 无标签写入口 | 匹配；恢复、键盘及定位 oracle 待 focused/L2 |

**本轮必须保留的负结论。** 此 `STATIC_SOURCE_MATCHED_FOR_EDITOR_STRUCTURE_ONLY` 不是整个商品库的完成结论，
也不是 focused、生成链、Testcontainers、L2、reset、DEV 或 seed 的通过证据。后续任何组件对账仍必须用
“行为、形态、动作、关系、位置、文案、限制”七维逐项比对；任一维度不一致即回到 `OPEN`，不得由组件存在、
静态通过或局部截图替代。

## 2026-08-25 全量 lint 首败的同根处置

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

- `FIRST_FAILURE`：全量 `apps/frontend/operations-admin` 的 `yarn lint` 首项为
  `CatalogItemOrderOptionsEditor.tsx:1` 未使用 `Select`；同轮还报出十处 React Hook dependency 问题。
- `LAST_KNOWN_GOOD`：商品库编辑器定向 lint 与 typecheck 已通过；全量 lint 修复后 exit=0。
- `BROKEN_BOUNDARY`：候选控件调用方把 `useCursorCandidates` 的 aggregate state object 成员直接捕获进
  `useEffect` / `useMemo` dependency，既掩盖真正读取的稳定 callback/分页值，也使 lint 无法证明依赖关系。
- `根因层`：不是单个 dependency 漏填，而是 app 调用 shared 候选状态机时没有把“查询状态”和“稳定动作”
  解构为明确本地事实。foundation 的 `acceptPage`、`loadNext`、`onPopupScroll` 均由 `useCallback` 稳定提供，
  aggregate object 本身不应成为 consumer 的语义依赖。
- `有限分母`：本次实际 lint 报告的十处同根引用跨候选 hook、审计分页、workspace invitation/user 三个
  surface；对候选 hook 的所有命中复查后，已同步修正 `useOrganizationCandidates`、
  `useContractStoreCandidates`、`WorkspaceInvitationCreateDrawer`、`WorkspaceInvitationPanel` 与
  `WorkspaceUserPage`。审计弹层同样将 `reset` 解构为 `resetPagination`；另移除本批商品库编辑器的未使用导入。
- `反例边界`：依赖值若并非 hook 内 `useCallback` 稳定输出，不能只解构后假定稳定，必须让其在依赖数组中
  真实变化；本次 `useCursorCandidates` 的 callback 源码已读回验证为稳定输出。
- `最小修复`：调用方在创建候选 hook 后立即解构 query/page/items/pageSize/acceptPage/onPopupScroll；请求、
  effect 和列 memo 只消费这些具体值并显式声明。未修改候选查询、分页、搜索、滚动或业务准入语义，也没有
  关闭 ESLint、压制规则或删除 dependency。

`RESULT=FULL_OPERATIONS_ADMIN_LINT_PASS`。该项只关闭全量 lint 的当前静态失败；依然不构成七维组件对账、
focused、生成链、Testcontainers、L2 或受管运行通过的证据。

## 2026-08-25 核心工作台七维对账 · 生成链与动态前复核

`METHOD=正式需求/interaction/IA/implementation/serial-plan 逐条回读；再读当前 owning source、generated chain 与 static gates。`  
`NON_NEGOTIABLE=project-memory/operations/phase-retrospective-and-systemic-repair.md 的 IMPLEMENTATION_DESIGN_SOURCE_RECONCILIATION_IS_UNBOUNDED：行为、形态、动作、关系、位置、文案、限制任一不符即 OPEN。`

### 本轮发现并已根治的差异

| finding | 七维影响 | 根因 | 根治与反证 |
| --- | --- | --- | --- |
| `SR4-MATCH-01` | 文案、关系、限制 | L2 locator 仍把规格页叫作“SKU规格与价格”，实现与 interaction 的用户文案为“规格与价格”；库存页标签也仍为旧“库存与BOM”，与批准交互的“库存扣减与用料”不一致。 | 统一 locator 与 `catalogTabLabels` 为批准文案；`catalog-inventory-l2-fixture --self-test` 重新证明每个 binding 必须在 owner source 中出现。 |
| `SR4-MATCH-02` | 限制、动作、位置 | `FRAMEWORK_ONLY` 的 `activeRows=[]` 使 L2 owner-fixture 的 synthetic-target 与 target-fact 两个 red mutation 实际没有任何 case，因此“红变异”是假绿。 | 自测改用批准的 24-case incremental exact-set；仍保持执行 profile 的 0 active。缺任意事实路径现在被 `L2_OWNER_FIXTURE_SYNTHETIC_TARGET_FORBIDDEN` 或 `L2_OWNER_FIXTURE_TARGET_FACT_PATH_VALUE_MISSING` 拒绝。 |
| `SR4-MATCH-03` | 位置、文案、限制 | 十列表格的 selection 列未固定左侧；SKU 默认规格只是普通文字；空属性/制作摘要使用泛化“未设置”。 | selection 固定左侧；默认规格为弱强调 Tag；父行空值改为“未设置商品属性”“未设置制作信息”。不删列，不以横滚为由缩减信息。 |
| `SR4-MATCH-04` | 关系、限制 | 编辑器拆分后，静态 query/idempotency/refresh tests 仍将 retired `CatalogItemDrawer` 视作 read/command owner，详情 manifest 存在一次无必要的类型加宽。 | 测试迁至 `CatalogItemViewDrawer`、`useCatalogItemEditorSession`、`useCatalogItemEditorWorkspaceState`、`CatalogTemporaryPromotionTask`；详情直接消费 generated response。旧 router 不再被错误地当作行为 owner。 |

### 对账矩阵

| 实施组件/合同组 | 行为 | 形态 | 动作 | 关系 | 位置 | 文案 | 限制 | 结论 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CatalogItemListTable` | 父商品主表、展开后懒取规格、loading/error/load-more 都是一条子行；SKU 不进入批量选择 | 普通 AntD tree-data，同一十列表头；不是 `expandedRowRender` 或嵌套表 | 父/规格名称均进入同一 View，规格定位规格区段 | 父 total 不含 SKU；规格页按 parent itemCode；跨分类路径取 item projection | selection/expand/item 固定左侧；横滚由十列最小宽度总和承载 | 十列精确“商品、商品形态、价格和单位、规格或选项、商品属性、制作信息、库存与 BOM、更新时间、状态、来源” | 父格四行、SKU 商品格两行；完整内容由 EllipsisTooltip；价格 null 为中性“未设置” | `SOURCE_MATCHED` |
| `CatalogItemViewDrawer` + read-only presenters | 从 owner detail 读九区段，失败可重试，动作由 actionAvailability | 独立只读 Drawer，非 disabled Form | 编辑/生命周期/复制是明确动作；状态变更后 refetch | View 不持有 draft；只读 presenter 不把 SKU/选项当商品级生产标签 owner | 宽 Drawer，tabs 是唯一正文切换 | “查看商品”“重新加载”等业务文案；无 raw problem detail | View DOM 没有 Form/Input/Select；仅可用的生命周期按钮按 owner actionAvailability 控制 | `SOURCE_MATCHED_STATIC`；键盘/焦点留 L2 |
| `CatalogItemEditorWorkspace` + session/state + 九事实族 editors | whole-save、dirty、恢复、staged asset release、typed problem 定位由 session/draft 协作 | 实际超宽 Drawer、左区段 Tabs、sticky footer；宿主不承担事实族 JSX | 保存、取消、三径关闭经同一 lifecycle；子任务 Apply 写 draft、Cancel 零写 | server fact=RTK currentData、draft=typed draft、UI=local；配置绕行靠 return token，不覆盖 draft | Workspace 是唯一滚动区，footer 固定 | “编辑商品”“保存商品”“检测到未保存草稿”及问题反馈均为业务语言 | shape admission/锁定/版本/whole-save 由 contract/owner；无分区提交和 fallback | `SOURCE_MATCHED_STATIC`；owner/readback 与焦点留动态 |
| `CatalogItemProductionEditor` + navigation production-tag branch | 商品可选/清除一个生产标签；停用的既有绑定可读，新候选禁用 | 商品级 Select 单选；SKU override / option effect 不渲染该控件 | “维护生产标签”只通向配置；选项仅时长/说明 | navigator 与商品标签并列一级、生产标签二级按 `productionTagRef` 过滤；tagRef 不串用 | 制作信息区与工作台树均有清晰入口 | “生产标签”“制作单显示名称”“预计制作时长”等业务语言 | 正向前端 `productionTagRefs`/`addProductionTagRefs` 精确零；P1/CP-02 静态门保 partial unique 与 owner 七态 | `SOURCE_MATCHED_STATIC`；0/1 owner 行为留 Testcontainers/L2 |
| 配置抽屉/字典与复杂定义 | 六库在工作台内的全高配置任务，复杂定义在同栏切换，候选按 cursor | 第一层 configuration Drawer；其上只允许 atom Modal，不嵌套 Drawer | create/edit/status/delete 的幂等键在实际 command owner；关闭由 dirty guard | 配置 draft 不写商品 draft；保存只刷新对应库/候选/受影响 read model | 配置与编辑互斥，返回编辑通过工作台接力 | 无 owner/ref/route 等技术词；列表即简单字典详情 | 候选、引用与版本都消费 contract/owner；禁本地 selectable 推断 | `SOURCE_MATCHED_STATIC`；完整六库交互与关闭焦点留 L2 |
| L2 locator/fixture/runtime | 24 case activation candidate 与 65 policy 维持分离；progress 逐 case START/COMPLETE 并记录剩余数量 | `catalogTestIds`、locator binding、Playwright consumer 三方同源 | fixture owner facts 与 action/readback 精确声明，且不借 DEV/seed | action/testId→requestId→completion→DB section join；intercept 与 backend completion 分开 | 受管本机 browser L2 与 DEV 长驻拓扑隔离 | 所有 case oracle 是业务结果，不以元素存在代替 | FRAMEWORK_ONLY 不能让 red mutation 假绿；secret/cleanup 与 exact-set fail closed | `SOURCE_MATCHED_STATIC`；真实 24/24 仍待执行 |

### 本轮静态证据

- `yarn lint && yarn typecheck`：exit=0。
- focused：`CatalogManagementPage` + `CatalogItemDrawer`，49/49 PASS；此前完整前端 scoped set 98/98 PASS。
- P1→tokens→M1→P3：PASS，`OPERATIONS=59`、`L2_SCENARIOS=26/65`、bindings=88，P3 全部 red mutation PASS。
- L2 fixture：`catalog-inventory-l2-fixture --self-test` PASS；`browser-l2-catalog-fixture --self-test` PASS。
- health：`node scripts/test/test-health-entry-runner.mjs --node` exit=0，`181/181`，`DISCOVERED_TEST_FILES=EXECUTED_TEST_FILES=28`。

`FIRST_FAILURE=THCL_NODE_TEST_ENTRY` 中的 stale-owner 静态 tests；随后是 `L2_CONTROL_BINDING_NOT_IN_SOURCE:CATALOG_SKU_TAB`，再随后是 zero-active self-test false-green。  
`LAST_KNOWN_GOOD=完整静态健康门 181/181`。  
`BROKEN_BOUNDARY=组件拆分后的 proof ownership 与 L2 FRAMEWORK_ONLY red-mutation execution boundary，而非业务 contract 或 owner 实现。  
`BUSINESS=STATIC_PASS`。`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。

本节只关闭已列核心工作台的**静态**七维对账。Testcontainers 的真实 HTTP/owner/migration 证明、browser L2 的键盘/焦点/滚动及 24 case、reset/DEV/seed 仍为下一阶段，不能由本节代称。
