# 商品库工作台实施前代码—详设逐项对账与静态审查

状态：`PRETEST_SOURCE_RECONCILIATION_NO-GO`

日期：2026-08-24

范围：商品库工作台最终正式需求、IA、implementation-facing design、serial plan 与当前 contract、生成源、owner、operations-admin、acceptance、seed、browser L2 实现的逐项对账。

## 0. 证据口径

- 本轮先完成源码与详设对账，再做两轮静态反例 review；按用户要求暂未运行测试、HTTP、migration、DEV、reset、seed、browser L2 或 UAT。
- `BUSINESS=NOT_RUN`；`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。
- `FIRST_FAILURE=P1_B3_FIELD_EXACT_SET`（来自此前静态链运行记录）；当前 owning source 与 manifest 的 B3 字段集合已静态比对相等，因此该首败暂记 `UNVERIFIED_REQUIRES_EVIDENCE`，不得把历史输出当作当前事实。
- `LAST_KNOWN_GOOD=R4_LOGGING_BOUNDARIES ... CODE_LAYOUT` 静态区段；`BROKEN_BOUNDARY=P1_B3_FIELD_EXACT_SET`（待下一轮集中修复后由 fresh 退出码重新确认）。

## 1. 详设—契约—代码—测试矩阵

| 主题 | 详设要求 | 当前 owning source 事实 | 判定 | 根因层与最小修复方向 |
| --- | --- | --- | --- | --- |
| 59 个 catalog operation | P1→tokens→M1→bindings→P3 单链 | P1/edge/owner binding 已写 59/37/22；P2 仍硬编码旧 56 operation、旧 14 library set | `CONFIRMED`（P2 漂移） | 静态校验器与当前生成源分叉；P2 只改 owning checker 的集合/分母与 red mutation，不改 generated fixture |
| 分类控件统一 TreeSelect | 新建、编辑、批量移动、重新挂父分类统一使用 owner category-candidate task read，UI 只渲染层级、清理级联 | owner/controller/generated RTK 已有 `getOperationsCatalogCategoryCandidates`；四类 UI 仍由 navigation tree 平铺、局部推导 descendant/path | `CONFIRMED_BLOCKING` | 新能力没有进入 consumer；建立共享候选 hook/presenter，四场景只消费候选结果，删除 navigation eligibility/path fallback |
| 分类 contract 来源 | 候选必须携带 path、selectable、disabledReason | manifest `categoryRef.optionSourceRef` 仍绑定 `getOperationsCatalogNavigation/data.tree`；focused manifest/runtime test 仍断言旧来源 | `CONFIRMED_BLOCKING` | manifest generator source 未迁到新 task read；改 manifest owning source 与 focused 语义断言，再生成链闭合 |
| 三层 state 住址 | server facts 只在 RTK `currentData`；整单草稿只在 typed `useCatalogItemDraft`；UI 瞬态只在组件本地；View/Edit 分文件；宿主 <300 行 | `CatalogItemDrawer.tsx` 约 5722 行，同一组件以 `mode` 切 View/Edit，多个局部 draft state；draft hook 仍是单个泛型 payload + setters 回灌；config hook 非六库 typed state | `CONFIRMED_BLOCKING` | 状态与 surface 职责未按设计拆开；按九事实族拆 View/Editor、typed draft/config task，不新增平行 state/fallback |
| SKU 同表子行事实 | SKU row 要显示生效属性、制作信息、实际库存/BOM 摘要 | `CatalogItemSkuPage` schema 只有 attribute refs、单位、价格和固定 null inventory summary；无 attribute/preparation summary；owner `skuCandidateRow` 把 inventory mode/consumption/bom 全部置 null；UI 对属性/制作固定显示“同商品” | `CONFIRMED_BLOCKING` | read model 不够表达设计要求；先补 owner-owned business-ordered summary 与有效库存摘要，再让 Table 直读，不由前端推断/N+1 |
| 十列表格 | 十列全显、横向滚动、父/子同表头、四行上限、长单行 Tooltip、无价为中性“未设置” | 列集合与大部分宽度已存在；但商品分类缺失时回退 navigation 猜路径；单行超长只有 CSS ellipsis 无 Tooltip；标签只取前两项无 `+N`；SKU specs 前端重新排序；scroll.x 硬编码；选择列 32px；仍留有旧 column-settings 常量 | `CONFIRMED_BLOCKING` | 事实缺失被 fallback 掩盖、视觉规则未集中；owner 顺序原样消费、统一 EllipsisTooltip、`+N`、删除路径 fallback、按列最小宽度计算 scroll、清理退役 settings/testId |
| 状态与来源 | 状态紧随商品、全部业务列默认可见、无价合法不红 | 状态/来源列存在，价格 null 已中性展示；但静态/旧 testId 仍有 column settings 残留需对账 | `PARTIALLY_CONFIRMED` | 表格 presenter 与 testId 词汇尚未完成最终收口；保留十列，不加隐藏入口，清理死常量并补反例 |
| 单一生产标签 | 商品 0..1，contract/owner/DB/copy/readback 强制单值 | item 保存、reference facts、partial unique index、migration single canonical relation 已闭合；`productionTagRefs` 在 copy coordinator/production owner 中表示一次多商品 copy closure 的标签引用集合，不等同商品字段多值 | `CONFIRMED`（reviewer 的“所有数组即违规”结论 `REJECTED_WITH_EVIDENCE`） | 不把跨商品复制计划数组误删成单值；继续检查每个商品 relation mapping 仍由 owner singular facts 约束，历史 migration/negative guard 中旧 plural 允许存在 |
| navigation productionTags | 生产标签作为目录树一级节点及其二级项，列表分支必须由 contract 明确返回 | generated schema 中 `productionTags` property 存在，但 navigation data `required` 与 design-byte policy 未包含它；decoder 缺失会转空数组 | `CONFIRMED_BLOCKING` | contract requiredness 与 decoder fail-closed 不一致；在 policy/generator 改 required，required read model 缺字段必须结构化失败，不以 `recordArray(undefined)` 补空 |
| acceptance operation identity | 每个场景 request 与宿主 annotation operation 完全一致 | `catalog.tag-navigation-and-filter` 宿主为 navigation，却同场景发 items 且使用旧 `tagRef`；新 category-candidate/SKU-page 场景未见于当前 acceptance source | `CONFIRMED_BLOCKING` | 场景夹具/注解未随新 contract 迁移；按最终合并表拆/迁 host，补两个新 read 场景，并保持总分母与旧断言 |
| L2 active profile | readiness 只能消费 execution profile；未激活必须 fail closed | 当前 profile 为 `FRAMEWORK_ONLY/[]`；validator 只在 active>0 时核 exact set；readiness 又直接覆盖成固定 24 并报 PASS，run 阶段才失败 | `CONFIRMED_BLOCKING` | readiness 与 run 使用两套 active source；profile 必须是唯一来源，readiness 直接要求 `INCREMENTAL + exact 24`，禁止固定覆盖 |
| L2 fixture oracle | 24 case 每个必须有 pre/expected/unchanged/action facts，缺失在浏览器前失败 | runtime 对四项全部使用 `??` 通用默认值；另有 policy fixture validator，但 runtime 未在物化前强制调用同一 required validator | `CONFIRMED_BLOCKING` | 默认值掩盖契约缺口；去除默认，按 fixtureId/caseId 报缺项，物化前 fail closed，并接入现有 validator，不建第三套分母 |
| L2 action→request→DB join | 每个 action/testId/operation/request/completion/DB section 可关联 | spec 只写 CASE_START/HTTP_COMPLETION/CASE_COMPLETE；response event 把 controlKeys 当 testIds，没有 actionId/generated operation；join 只按 case/requestId 聚合 | `CONFIRMED_BLOCKING` | 日志边界在 case 而非 action；为每个声明 action 写 actionId/testId/operationId，join 缺任何 start/complete/request/backend/db 都点名失败 |
| L2 progress | 每个 case 开始/结束即时输出，显示 total/completed/remaining；缺事件不得假绿 | stdout 与 jsonl 已有 case start/complete；但结果分母来自 Playwright JSON，progress 不入门；join 不要求 CASE_COMPLETE，删除它仍可能 24/24 | `PARTIALLY_CONFIRMED_BLOCKING` | 可见性改善已存在，但完整性门缺失；progress、CASE_START/COMPLETE、active exact-set 纳入 manifest/join gate，逐 case 点名缺失 |
| L2 oracle | 成功/失败后读 owner 事实，失败 version/核心事实不变 | fixture 有 readback fields，但当前 spec 主要断言 UI/error/draft，未对每个写 case执行真实 owner readback | `CONFIRMED_BLOCKING` | UI 可见性被误当业务 oracle；每类写场景统一 action 后 owner readback，失败核 version/事实未变，恢复核目标事实 |
| seed coverage | 深分类、停用既有绑定、新候选排除、十列长短空值、九区段长短空值 | seed executor 创建 category 时统一 `parentCategoryRef:null`；生产标签只创建/readback，未见停用既有绑定与候选排除闭环；十列/九区段 readback 不形成明确 strict assertions | `CONFIRMED_BLOCKING` | seed 只覆盖 happy/reference materialization，未把最终 UI 观察事实做成唯一 seed/executor readback；补生成源与 executor，不手改 generated fixture |
| testId 单一住址 | `catalogTestIds.ts`→组件→locator→L2，所有可交互控件有 testId，差集为零 | 中央模块存在，但 Drawer/Dictionary/Workbench/L2 spec 仍散写动态 testId；`tableColumnSettings` 仍留而设计已禁止该入口 | `CONFIRMED_BLOCKING` | testId contract 没有成为单一 producer；集中声明/动态构造器也必须从模块导出，locator/L2 exact-set 做红变异 |
| 日志与脱敏 | run/case/action/request/completion/DB section 结构化关联，敏感值不出 artifact | backend completion/DB 事件静态具备脱敏链；browser action join 缺字段，缺事件可能只在最终汇总暴露 | `PARTIALLY_CONFIRMED_BLOCKING` | 后端日志本身不是根因；补 browser action/log schema 与 fail-fast，保持敏感值禁录 |

## 2. 第二轮静态反例结果

| 反例 | 结果 | 可证伪事实 |
| --- | --- | --- |
| 删除 `categoryPathLabels` | `CONFIRMED` | decoder 将缺失转为空数组，Table 随后从 navigation.tree 猜一级名称 |
| 单行业务文字超长 | `CONFIRMED` | `businessLines` 仅在行数超过 max 时包 Tooltip；单行 CSS ellipsis 无全文入口 |
| 删除 required `productionTags` | `CONFIRMED`（导航 contract requiredness 同时为 `CONFIRMED` gap） | 导航当前 contract 允许省略；详情 required 字段仍被 decoder 的 `recordArray` 转空数组 |
| 删除一个 progress 或 `CASE_COMPLETE` | `CONFIRMED` | 24 结果来自 Playwright JSON；join 只看 start/completion，不要求 complete；progress 文件不参与结果门 |
| 删除 fixture `expectedReadback` | `CONFIRMED` | runtime `??` 默认 version/tag/result，缺失不会在 browser 前失败 |
| `FRAMEWORK_ONLY/[]` readiness | `CONFIRMED` | validator 接受空 active；readiness 固定写 24 并报 PASS；run 才检查 profile exact-set |
| 将跨商品 copy closure 的 `productionTagRefs[]` 当商品字段多值 | `REJECTED_WITH_EVIDENCE` | brand copy selectedItemCodes 是集合；production owner 以 refs 集合预检多件商品的定义，商品绑定仍由 catalog singular relation/partial unique 约束 |

## 3. 根因分组与集中修复顺序

1. **事实/分母没有一个可消费的 owning source**：P2 仍旧 56/14；manifest 仍旧 navigation；L2 active 在 profile、常量、readiness 三处重复。先收敛生成源、required schema、profile sole source。
2. **默认值和 fallback 掩盖缺失事实**：分类路径、required arrays、fixture oracle、L2 join 缺事件都被补空或后置汇总。统一改成最早边界 fail closed，并输出结构化缺失字段/case/action。
3. **新 owner read 已有但 consumer 未接入**：category candidate 与 SKU page backend 已存在，前端仍使用旧 navigation/不完整 SKU row。先补 read model，再改 shared hook/presenter。
4. **前端事实呈现与设计未收口**：表格和详情仍保留旧 monolith/散写 testId。集中完成 table presenter、九事实族 View/Editor、typed draft/config/state 三层与 testId exact-set。
5. **测试覆盖停留在“能渲染/能返回”**：acceptance operation identity、L2 owner readback、action join、seed readback 还没有形成闭合链。最后补测试与 fixture，并使失败条件在测试启动前可定位。

## 4. 当前停止边界

在上述确认缺陷集中修复并完成第二次静态源码复核前，不运行任何测试或动态环境，不用一次次首败推动修复，不启用 `FRAMEWORK_ONLY` profile，不修改 generated fixture，不用 fallback/兼容层或降低 oracle 止血。

## 5. 第三轮静态对抗复核 intake（Nash，作者逐条重开）

本节不是采信 reviewer 自报，而是对其每条 finding 重新打开 owning source 后的处置记录。该轮仍未执行编译、测试、HTTP、migration、DEV、reset、seed 或 browser L2。

| finding | 处置 | 当前边界与修复要求 |
| --- | --- | --- |
| `M-01 CONTRACT_GENERATION_ARTIFACT_DRIFT` | `CONFIRMED` | P1 已声明 `CatalogNavigationView.data.productionTags` 必填，而当前 OpenAPI/TS 仍可选且 decoder 把缺失转为空数组；必须走官方生成链并让 decoder 对 required read model 缺失 fail closed，不能手改产物或以空数组补齐。 |
| `M-02 EDITOR_DRAFT_STRUCTURE_NOT_CLOSED` | `CONFIRMED` | Surface router 已拆出，但 `CatalogItemEditorDrawer.tsx` 仍承载九类事实族，draft 仍是整单泛型 payload，未拥有 typed section dirty/error/active；必须继续拆事实族 View/Editor，并让 `useCatalogItemDraft` 成为 typed section 状态唯一住址。 |
| `M-03 DISABLED_FORM_USED_AS_DETAIL` | `CONFIRMED`，已修复首个断点 | 查看抽屉原先调用 `CatalogInventoryBomWorkbench editing={false}`；已新增纯 `CatalogInventoryBomView.tsx` 并切换查看抽屉，后续需以静态源码确认查看树不再依赖编辑工作台。 |
| `M-04 L2_ORACLE_NOT_OWNER_READBACK` | `CONFIRMED` | L2 fixture 事实已要求存在，但 spec 仍需统一执行成功后的 owner readback、失败后的 version/核心事实不变、十列表格结果事实断言；元素存在或错误出现不能代替业务 oracle。 |
| `S-01 PRODUCTION_TAG_NAVIGATION_ACCEPTANCE_MISSING` | `CONFIRMED` | 必须补真实 navigation → production tag 节点 → items filter 的 acceptance，断言父商品去重、SKU 展开、总数与普通商品标签不串用。 |
| `S-02 DISCOVERY_SELECTION_SELF_EVIDENCE` | `CONFIRMED` | readiness/run 不能从同一个 result array 同时推导 discovered 与 selected；两者必须来自独立 discovery manifest 与 selection manifest，并做 exact-set 对账。 |
| `S-03 L2_TESTID_ACTUAL_TOUCH_MISSING` | `CONFIRMED` | CASE_START 中声明的 controlKeys 不是实际 locator/action 触达证据；必须记录真实 locator resolution 与 action touch，按 testId 集合做双向差集门，并保留独立红变异。 |
| `S-04 SKU_CHILD_PARENT_DETAIL_NAVIGATION` | `CONFIRMED`，已修复入口 | SKU 子行不应成为独立编辑对象；已让 SKU 名称点击打开父商品查看抽屉并聚焦 `sku-specifications-pricing` 区段，需静态确认 testId 与 workspace task focus 链闭合。 |
| `S-05 SELECTED_CATEGORY_ANCESTOR_CHAIN` | `PARTIALLY_CONFIRMED`，已修复主要断点 | 分类候选 hook 原先把已选深层分类作为平铺禁用节点；已改为按已有路径名称构造嵌套祖先链并阻止对合成祖先再次发请求，仍需确认真实候选返回时不会以平铺 fallback 覆盖 owner 树语义。 |
| `S-06 L2_PROGRESS_WATCHDOG` | `CONFIRMED` | 已有逐 case start/complete 输出，但 heartbeat 尚未表达 active case/index/remaining/budget/watchdog；需补 run-scoped budget 驱动的每 case 超时与可读心跳，禁止只等最终心跳。 |
| `N-01 FIXED_UPDATE_TIME` | `CONFIRMED`，已修复 | 表格已从 locale-dependent `Intl.DateTimeFormat` 改为固定 `YYYY-MM-DD HH:mm`，Tooltip 保留 ISO；需在静态检查中确认没有同列旧格式路径。 |
| `N-02 CATEGORY_TESTID_DUPLICATION` | `CONFIRMED`，已修复 | 分类字段原先在外层容器和 TreeSelect 重复挂同一 testId；已保留实际 TreeSelect 的 testId，移除外层重复值。 |
| `N-03 SEED_STRICT_READBACK` | `CONFIRMED` | seed 必须严格比对分类路径、价格/粒度、单位、规格/选项、属性、制作信息、库存/BOM、状态/来源及 SKU 子行，不得只做结构存在断言。 |

### 5.1 修复后的禁止测试边界

在 `M-01` 至 `M-04`、`S-01` 至 `S-03` 以及 `S-06` 关闭并完成下一次 fresh 静态复核前，仍禁止进入任何测试或动态环境。生成链只能使用官方入口；L2 execution/profile、fixture、locator bindings 与 generated fixture 不能手改或以空集合激活。当前仍为 `STATIC_GO=NO-GO_STATIC`、`BUSINESS=NOT_RUN`、`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。
