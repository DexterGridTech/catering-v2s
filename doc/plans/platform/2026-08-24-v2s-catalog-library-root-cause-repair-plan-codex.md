# 商品库工作台根因修复计划

- 日期：2026-08-25
- 状态：`AMENDED_AFTER_L2_FRAMEWORK_METHOD_DATA_RECONCILIATION`
- `REVIEW_CYCLE_ID=CATALOG_LIBRARY_ROOT_CAUSE_REPAIR_PLAN_20260824`
- `REVIEW_ROUND=2_AUTHOR_INTAKE_COMPLETE`
- `REVIEW_ROUND_LIMIT=2`
- `SKILL_USED=cs-writing-plans@721904d1e1eea7724e4f3301a1a32ced983e55a0a84884f37c6f4bdaf51d811f`
- 批准目标：商品库业务、用户 Journey 与 UI 交互优化的完整实施与验收；本文件只把已授权目标收敛为可一次实施的根因修复顺序，不新增业务语义。
- 当前执行边界：两轮计划审查与作者 intake 已完成；最近一次完整受管 L2 已逐项执行 24/24，留下 21 PASS、3 FAIL 的 terminal event，business FAIL、cleanup PASS。三项首败已按共享可变 fixture、真实 mutation 后状态、用户筛选语义三个根因闭合，并经 P1/L2 runtime/前端/Node/仓级静态链复核；不得按 case 逐个止血。本次已完成逐文档逐维对账与 fresh 静态代码审查；Dexter 已授权在 L2 框架/方法/数据链修复后重新执行 L2。仍禁止手改 generated 产物；reset、DEV start、seed 只在 L2 business 与 cleanup 均 PASS 后执行。

## 0. 精确输入清单、用户任务与替代

本计划只消费下列已接受材料；同日期、同主题的讨论稿或被 `SUPERSEDED` 的材料不是执行输入。

1. `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`：商品工作台、十列表格、配置抽屉、L2/seed 需求。
2. `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`：八类用户 Journey 和失败/恢复路径。
3. `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`：surface、线框、控件级联和用户文案。
4. `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`：控制权、state/invalidation、不可见维度和观察句。
5. `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md`：owner/contract/路径、§9b 锚点、验证与停机条件。
6. `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md`：批准的 CP 顺序及验收边界。
7. `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md`：仍有效的 identifier、制作单显示名称、时长、说明、选项增量与 migration 边界；其生产标签多值部分已由上列商品库正式需求覆盖。
8. `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md`、`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-interaction-design-codex.md`、`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-ia-design-codex.md`、`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-implementation-design-codex.md`、`doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-serial-plan-codex.md`：只在第 7 项仍有效范围内交叉对账。
9. `doc/platform/implementation-task-template.md`、`doc/platform/frontend-coding-standard.md`、`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`、`scripts/README.md`：实施、前端、acceptance 和生成/运行入口规范。

维护者的实际任务不是“填满技术字段”或“让表格能渲染”，而是在同一工作台中可靠地查找、看懂、建立、编辑、配置、批量处理、复制和治理商品，并在失败后知道事实是否未改变、如何继续。最小可行替代是保留现有散落抽屉、旧 navigation fallback 与 L2 结果统计，再逐个修 failing case；它成本看似低，但会继续产生第二事实住址、把缺失字段显示成空、并让每次运行成为需求发现工具。推荐方案以已有 owner read、foundation drawer 和 P1 生成链为中心收敛事实，不新建独立商品页面、平行 L2 DSL 或生产路由，成本集中在一次性删除旧路径和建立可证伪门，因而更小且可维护。

## 1. 修复目标与方法

本轮不再按一次测试暴露一个症状的方式推进。问题的共同根因是：同一商品库事实在生成源、owner read、前端呈现、fixture/L2 oracle 中没有被同一个声明完整地传递和消费；缺字段时又被空数组、默认对象、旧 navigation 树或泛化断言掩盖。因此，本计划以“模型事实 → 契约声明 → owner read/write → generated consumer → 前端 state/presenter → fixture/oracle → 动态证据”逐层闭合。

### 1.1 本轮的不可变业务结论

1. 商品级生产标签是 `0..1`，用于未来生产路由分类；本批不实现生产流程、生产工作台、队列、默认路由或推测性 fallback。
2. `productionTagRefs` 可以作为跨商品复制预检中的定义引用集合存在；它不得重新成为任一商品、SKU 制作覆盖或点单选项制作影响的多值商品事实。
3. 商品标准价可为空；商品列表、详情、编辑都以中性“未设置”表达，不把菜单项必须定价的规则回灌为商品 owner 的风险、禁用或缺陷事实。
4. 分类是树。新建、编辑、批量移动商品、分类挪父只能使用 owner task read 返回的树形候选与 `selectable/disabledReason`；UI 可以将 owner rows 组织为树，但不能推导资格、禁用原因或分类路径。
5. 商品列表保留冻结的顶部工具区和结果域；主表固定十列且全部默认可见。SKU 是父商品的同表子行，不计入父商品列表分母。
6. View 与 Editor 是两个 surface：View 不得把禁用表单当详情；编辑草稿与服务端事实不得混住。
7. L2 的业务 oracle 是 owner readback、错误原文、草稿/焦点恢复和失败后事实不变；可见元素、静态 proof、DEV seed 均不能代替。

### 1.2 事实判定口径

| 分类                     | 当前事实                                                                                                                                                                                                                                                                                                                                                                                                        | 处置                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `CONFIRMED`              | `CatalogItemSkuPage` 已有 SKU 属性、制作、库存摘要字段；`CatalogNavigationView` 的 `productionTags` 当前 P1 schema 已为 required；L2 runner 已有逐 case start/complete、remaining 和 heartbeat 输出。                                                                                                                                                                                                           | 不重造接口/进度文案；后续检查 producer、decoder、consumer 与 gate 是否同源。                                     |
| `CONFIRMED`              | P1 `catalogLibraryFixtureGraph` 已声明八个丰富 L2 library graph，但生成后的 `contracts/policy/catalog-inventory-fixture-catalog.json` 中这八项仍是两对象、零边，产物与唯一生成源漂移。                                                                                                                                                                                                                          | 只改 P1 与其 validator，随后走官方生成链重生并 exact-check；不手改 fixture。                                     |
| `CONFIRMED`              | 已退役的 `CatalogItemEditorController.tsx` 不再是当前入口；`CatalogItemEditorWorkspace.tsx`（184 行）与 `CatalogItemEditorSectionAssembler.tsx`（271 行）是装配边界，`useCatalogItemEditorWorkspaceState.tsx` 已从 1,025 行缩至 762 行。`CatalogDictionaryDrawer.tsx` 已是首层装配，但真实配置状态与渲染仍共同位于约 2,100 行的 `CatalogDictionaryDrawerState.tsx`；`CatalogWorkbenchPage.tsx` 也仍是超大宿主。 | 按事实族拆 state adapter/presenter/原子任务；首层 wrapper 的变小不构成重构完成，不得以改名转移巨型宿主。         |
| `CONFIRMED`              | 表格及 read model有 fallback/呈现不一致风险：`skuChildrenByItem` 以 item code 缓存，分类缺路径时会给出“分类信息暂不可用”，标签/长文本与 Tooltip 规则未由一个 presenter 统一；旧 testId/设置遗留需做精确分类。                                                                                                                                                                                                   | 让 owner 摘要为唯一业务事实，建立单一 table presenter 与 query identity，删除死设置/技术文案，而非扩充前端猜测。 |
| `CONFIRMED`              | L2 spec 的 `assertStrictOwnerReadback` 是通用 item map 断言，不能表达 create、batch、config、copy、失败 no-change 等不同 owner read target。                                                                                                                                                                                                                                                                    | 替换为每 case 的判别式 oracle，不放宽断言。                                                                      |
| `REJECTED_WITH_EVIDENCE` | “`FRAMEWORK_ONLY`/空 active 本身就是实现缺陷”不成立；它是 readiness 未完成时的闭锁状态。                                                                                                                                                                                                                                                                                                                        | 不手动把 profile 改成 24；仅在所有 static readiness 成功后由唯一 P1 生成逻辑原子激活。                           |
| `REJECTED_WITH_EVIDENCE` | “所有 `productionTagRefs` 字面都违反单标签”不成立；copy closure、seed definition-ref map、migration/red mutation 不等于商品字段。                                                                                                                                                                                                                                                                               | 建立正向商品模型零残留扫描，明确允许的离线/negative/copy context，禁止机械全局替换。                             |

## 2. 根因族、有限分母与退役边界

| 根因族                        | 有限分母/入口                                                                                | 唯一事实住址                                                                                    | 必须退役的旧形态                                                                                                                                                                 | 反例与失败条件                                                                                                                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1 模型与生成链漂移           | P1 schema/fixture/manifest/budget declarations → tokens → M1 → bindings → P3 的全部 consumer | `scripts/generate/catalog-inventory-p1.mjs` 及其导入的共享 budget validator                     | 手改 policy/OpenAPI/TS/RTK/fixture，第二份 operation 或 L2 activation registry                                                                                                   | P1 richer graph 未物化、任一 operation/budget/tag/binding missing/extra、生成后正向 schema 出现 retired field 均 FAIL。                                                                                                                    |
| F2 owner read 未被完整消费    | 分类候选、父商品页、SKU 子页、navigation 生产标签、详情/列表 decoder                         | owner/API 的 typed read response，RTK `currentData`                                             | navigation eligibility/path fallback、逐 SKU detail/N+1、前端重新定义扣减方式                                                                                                    | owner 少字段、decoder 把 required 字段静默转空、列表改从 navigation 拼 path/扣减均 FAIL。                                                                                                                                                  |
| F3 前端 state 与 surface 混住 | Workbench、View、Editor、Create、Config、Copy、Batch、Governance 任务；九事实族              | RTK `currentData` / `useCatalogItemDraft` / 最近 UI component 三层                              | 多个 first-layer `open` boolean、disabled Form View、index identity、草稿外溢                                                                                                    | 新增一字段需改宿主、关抽屉丢失草稿、子任务写 parent 草稿或 View import Form 均 FAIL。                                                                                                                                                      |
| F4 用户呈现与控制权漂移       | 十列表格、四类分类选择、所有交互 testId、用户文案                                            | IA/interaction 约束 + generated action availability/candidates + `catalogTestIds.ts`            | 技术术语、列设置隐藏十列、平铺分类、基于 index 的测试/回写                                                                                                                       | 用户操作可用性由 UI 猜测、业务文案泄露内部词、非 owner row 可选均 FAIL。                                                                                                                                                                   |
| F5 旧模型退役不精确           | 正向 contract/model/decoder/owner/write/seed/readback 与允许例外清单                         | P1 retire declarations + owner rejects + migration/negative guards + Schema required 集合完整性 | `missingPriceCount`、item `productionTagRefs`、SKU `skuBarcode`、generic profiles 的正向运行使用，或同一 required 字段因旧新模型叠加重复                                         | 任一正向模型重入、任一 schema required 重复，或 copy closure/红夹具被错误删除均 FAIL。                                                                                                                                                     |
| F6 业务验收和 seed 与实现脱节 | 80 annotation、P1 seed definition、seed executor、80 scenario requests                       | host operation + typed owner readback + P1 `catalogDefinitionSeed`                              | annotation operation 与真实 HTTP 不一致、手改 fixture/seed、空泛结构断言                                                                                                         | 任何 scenario 没有目标 readback/no-change oracle，或 seed 不能证明十列/单标签/停用语义均 FAIL。                                                                                                                                            |
| F7 L2 运行证据不是业务闭环    | 26/65 blueprint、47 TEST datasets、24 active set、testId/action/join/secret/cleanup          | P1 policy + runtime shared validator + runtime event stream                                     | 默认 fixture value、只声明不物化的 fixture object/edge、跨 scope 的环境内置来源、错误的先停用后绑定时序、复制的 active set、controlKey 冒充 actual touch、只看 Playwright result | 缺 pre/action/expected/unchanged，任一 TEST graph 对象未有符号→实际 ref/code/scope 绑定、任一边未由 owner command/readback 验证、绑定停用值时未先形成既有关系、缺一个 action event 或 DB completion，或 progress 不闭合均在浏览器前 FAIL。 |

**F2 关系事实投影反例（2026-08-25 收口补充）**：`catalog_item.sections` 已按模型退休 `skuVariantDimensions`；SKU 规格轴只由关系 owner 保存。`hydrateItemSummaryFacts` 若只回填 `skus` 而不回填 `skuVariantDimensions`，列表的 `derivedSkuFacts` 会把规格摘要派生成空，详情读却仍能从关系事实显示规格，造成同一商品两个互相矛盾的投影。唯一修复是 owner 在列表 hydrate 边界与详情读边界同样回填规格轴，再派生摘要；不得在前端补规格、向 raw JSON 回写退役字段，或为列表单独重算。反例由 `CatalogCategoryOwnerIntegrationTest` 中“规格属性改名后 `readItems().skuDimensionSummary` 同步变更”的断言覆盖。

### 2.1 首次 L2 失败的根因冻结（不作为逐 case 修补清单）

首次受管 L2 运行的首败保留为 `catalog-view-success` 请求“SKU规格与价格”而实现和交互稿均为“规格与价格”；最终结果为 4/24 PASS、20/24 FAIL、cleanup PASS。20 项失败收敛为以下七个同根边界，后续修改必须按整族完成并以静态反例验证，不能只让当前 case 变绿。

| 根因边界                      | 受影响 case 集合                                        | 根因与一次性修复                                                                                                                                                                                                                                                                                                                                                                                   | 反例/防回归                                                                                                         |
| ----------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 用户术语与形态驱动页签        | view 成功/失败/恢复、edit 成功、config 三态             | 测试脚本仍硬编码已退役的“SKU规格与价格”，且未以 owner 返回页签为准；编辑/配置 fixture 的普通商品不能假定 SKU 页签。统一消费 `catalogTabLabels` 的业务文案，并让每个 Journey 的 fixture 与其所需页签 admission 一致。                                                                                                                                                                               | 将 SKU 形态 fixture 改为普通形态或将业务 label 改回技术词，静态 verifier 必须失败。                                 |
| 交互控件的可定位性与菜单层级  | view 失败/恢复、batch 三态、governance 三态             | View error Alert/重试未挂中央 testId；父行 selection checkbox 没有业务码 testId；生命周期菜单项在下拉菜单关闭时被当成可见入口。补各自真实交互控件（错误面、重试、行选择、更多动作 trigger）的 central testId，L2 先触发菜单再按 owner actionAvailability 选择动作。                                                                                                                                | 删除任一 testId、把动态行退回 index、或直接查隐藏菜单项，静态 control/action gate 必须失败。                        |
| 受控输入与草稿恢复            | edit failure/recovery                                   | `typeSequentially` 已按用户输入约定清空，但测试传入了“原值+后缀”，造成原值重复；恢复路径没有写命令却继承了 SAVED_ITEM readback。用替换输入值，且 recovery 只断言 pre-state owner readback。                                                                                                                                                                                                        | 将替换恢复为追加，或让无保存恢复要求 save reader，fixture protocol validator 必须失败。                             |
| owner readback 捕获与目标协议 | create 成功/恢复、copy 三态、所有 future write/recovery | response listener 只按 baseline reader 收样，未取 expected/unchanged reader 并集；错误 HTTP 也被当作 copy execution；copy execute response 没有“原 preflight digest”这个契约字段却被错误要求。捕获三份 descriptor 的 reader 并集且只将 2xx 作为成功 readback；copy oracle 改为“execute request 携带 captured preflight digest + execution created codes”，失败断言无 2xx execution/no new object。 | 移除任一 descriptor reader、把 409 当执行成功、或把 request token 关系降为 DOM 文案，oracle red mutation 必须失败。 |
| 配置入口与状态级联            | config 三态                                             | 配置 Journey 打开编辑后没有先进入制作信息区段，故生产标签管理入口不存在；测试又把“SKU 销售属性”作为用户文案。抽出“打开制作信息→进入配置抽屉→恢复原锚点”的唯一 helper，改用正式业务词“规格属性”。                                                                                                                                                                                                   | 不切换到制作信息即访问管理入口，或恢复后不回到原区段，静态 Journey validator/focused proof 必须失败。               |
| 生命周期可用性与 fixture 事实 | governance 三态                                         | fixture 一律 DRAFT 且有入站引用，脚本却强制“作废并重建”；同时 action testId 绑定到隐藏菜单项。按每个 success/failure/recovery state 声明可用/阻断动作和预期 owner receipt，UI 仅执行 owner 公布的动作。                                                                                                                                                                                            | 把可用动作从 fixture 删除、用本地 status 重新推断、或成功 case 仍用阻断引用图，fixture validator 必须失败。         |
| 首败可追溯与动态节奏          | 全部 24                                                 | 运行逐 case 输出已具备，失败却没有在运行前用静态 action/readback/fixture cross-check 阻断。把 case→fixture shape/tab/action/readback/control 的 cross-check 置于 readiness 前，并输出 case、已完成、剩余和当前 boundary。                                                                                                                                                                          | 让声明控件不存在、形态不含目标页签或 reader 未在 protocol 中，readiness 必须在浏览器前 FAIL。                       |

### 2.2 L2 框架、方法与数据复盘补充（本次动态证据）

本节只吸收已重开生成源、fixture runtime、Playwright spec、progress/join artifact、实际 HTTP event 与详设
§11c--§11d 后能复现的事实。它不是第二份 policy：运行时仍只消费 P1 产物，以下表只决定修复和静态
防回归的位置。

| 根因                                                    | 有限分母与证据                                                                                                                                                                                             | 唯一事实住址 / 一次性修复                                                                                                                                                                                                                  | 明确禁止的止血                                                                                                  | 静态反例                                                                                                                                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| case 业务身份冲突                                       | 8 个本批 TEST dataset、24 case；`catalog-create-success` 的主 fixture code 与 create success code 同为 `L2-CREATE-SUCCESS`                                                                                 | `browser-l2-runtime.mjs` 导出的 case identity plan；fixture primary、success create、deliberate duplicate failure 都从同一 plan 取值，并在 owner materialization 前验证“success 与 existing 不同、failure 与 existing 相同、全 run 无重复” | 在 spec 临时换字符串、忽略 duplicate、让 runtime 根据失败重命名                                                 | 把 success code 改回 primary code 必须报 `L2_OWNER_FIXTURE_CASE_IDENTITY_COLLISION`                                                                                                                             |
| case identity 与 request-stage identity 语义混用        | 24 active case，以及它们生成的 fixture reference、`caseId + itemCode` 和 request stage 全集；严格 case-ID helper 曾被复用到后两类合法非-case 值，readiness 必然报 `L2_OWNER_FIXTURE_CASE_IDENTITY_INVALID` | `catalogLibraryCaseIdentityPlan` 只接受 generated catalog case ID；独立 `l2FixtureStageSuffix` 只规范化任意非空 fixture/stage 标识。所有 fixture request-stage 只使用后者，二者不得互换                                                    | 放宽 case-ID regex、把 fixtureRef 改造成伪 case ID、在每个 request 手写新 suffix 或忽略 invalid identity        | 空 stage 必须报 `L2_OWNER_FIXTURE_STAGE_IDENTITY_INVALID`；fixtureRef 传给 strict case plan 必须仍报 `L2_OWNER_FIXTURE_CASE_IDENTITY_INVALID`；真实 fixture bootstrap 使用 generic stage helper                 |
| public artifact 的动态 operation key 与敏感字段扫描冲突 | 24 case 的 observed HTTP operation 全集；`getOperationsWorkspaceLoginEntry` 是合法 operation value，却因被序列化为 JSON property name 命中 `login` 敏感 key 规则，导致 `L2_SECRET_LEAK_DETECTED`           | join artifact 的 observed operation 以 `{operationId,count}` 行数组表达；安全扫描继续拒绝敏感字段名与敏感值。任何 post-run artifact validator 失败必须被结算为 business FAIL，同时继续统一生成 execution/cleanup evidence                  | 放宽 `login` 敏感扫描、把 operation 重新做动态 JSON key、捕获异常后只退出而不 cleanup                           | 含 `getOperationsWorkspaceLoginEntry` 的 join artifact 必须可安全生成；真实 `token`/`authorization` key 仍必须报 `L2_SECRET_LEAK_DETECTED`；join build 抛错时 execution manifest 与 cleanup manifest 都必须留下 |
| L2 locator template 降级 testId factory                 | 动态父行、父行选择和复制来源行三个 code/ref 入口；`catalogTestIds.ts` 用 UTF-8 hex 维护稳定 identity，但 locator binding/手写 spec 将其退化为 `${itemCode}`，造成真实控件永远找不到                        | dynamic locator binding 只声明 `testIdFactory`，由 spec 直接调用 `catalogTestIds.ts` 的对应 factory；复制来源行只调用 `catalogTestIdControls.copy.sourceRow`。模板只保留无需转换的普通 facts                                               | 在 policy 或 spec 手拼 `catalog-...-${code}`、改 UI identity 为 raw code、为每个 case 增加 selector fallback    | factory key 缺 itemCode、未知 factory、binding 改回 raw template 各自静态 FAIL；同一 code 的 UI factory、binding resolver 与 action touch 必须相等                                                              |
| write Journey 使用错误 readback 关系或关闭语义          | create success/recovery、edit/config、batch/copy/governance 写路径；新建对象与 duplicate-negative baseline 不存在版本因果关系，create failure 后的 dirty close 也必须先经用户 discard                      | P1 `CREATE` readback 只声明正整数初始版本；编辑/配置通过 real tab role 切换；create failure 按统一 dirty confirmation → discard 再关闭。版本、tab、关闭均由 shared helper 消费                                                             | 让 create 比较无关 fixture version、以 Escape 静默丢草稿、用 label subtree 代替 role=tab 或以可见性代替动作完成 | create version 为 0/非整数必须红、恢复 `AT_LEAST_BASELINE` 必须红、dirty failure 直接隐藏 drawer 必须红、tab role 未 active 必须红                                                                              |
| generated network 与真实 Journey 脱节                   | 13 个已开始 case 的 request event；edit 三态均实际调用 `listOperationsCatalogUnits` 而 P1 未声明，config 还缺 item/unit reader；多处 fresh envelope 计数低估                                               | P1 的 `network.requests` 是唯一声明；以可组合的 fresh/workbench/detail/editor/config flow 生成，每个 case 只选择 flow 与 action；spec/runtime 只消费生成结果并逐 case 验证 observed operation multiset 不超声明                            | 只提高 timeout、把未声明请求写进 `backgroundAllowed`、在 spec 再抄一份请求表                                    | 从 edit flow 删除 `listOperationsCatalogUnits` 或让 observed count 超出 `maxRequestCount` 必须在该 case 结束时 fail closed                                                                                      |
| timeout 与观察不是同一契约                              | 现有 watchdog 使用 generated timeout，但生成的请求 envelope 不完整，故 17 秒中断不能说明业务超时                                                                                                           | timing 只由 P1 generated network × generated DB budget × topology baseline + local action probe 推导；runtime report 透传 operation multiset 与组成，并以同一 case budget watchdog                                                         | 逐 case 加时、无上界 heartbeat 等待、用固定整场时长覆盖 case budget                                             | 缺 operation budget、缺 flow、report 与 runner case timeout 不同均必须独立真红                                                                                                                                  |
| abnormal exit 丢失结果分母                              | watchdog 后 Playwright JSON 未写完，13 个 progress/join terminal 中已有 7 PASS、6 FAIL，但 selection manifest 错报 selected/results=0                                                                      | active exact set 在 candidate/profile；terminal results 首选 Playwright JSON，缺报告时由 CASE_COMPLETE join fallback；两者同时存在必须逐 case/outcome 相等。manifest 分列 selected set、terminal result set、result source 与缺失集合      | 用 JSON 空结果覆盖 progress、把 selected 从结果倒推、将部分 run 伪报 0/0                                        | 模拟 JSON 空而 join 有 terminal、或 JSON/join outcome 不同，必须分别精确失败                                                                                                                                    |
| locator anchor 冒充真实交互控件                         | `catalogItemTabTestId` 当前挂在 Tabs label 内部 span/Space，`openTab` 点击该结构 node；edit/config 超时落在这一边界                                                                                        | `catalogTestIds.ts` 保持唯一 token producer；L2 复用一个 composite-tab resolver，从 token anchor 精确解析唯一 `role=tab` 后点击真实 control 并记录 resolved control；组件不能把 label node 记为实际 control                                | `force` click、加等待、给 label 增嵌套 button、让 testId 散写                                                   | anchor 找不到/多于一个 role tab、或 resolver 直接点击非 role tab，均必须静态失败                                                                                                                                |
| editor hydration 把“未标脏”误作“每次都应重置”           | edit/config 共 6 个 case，以及任何有 controlled Select 的编辑区段；实际 `catalog-edit-success` trace 在切换制作信息时记录 `BROWSER_REACT_UPDATE_DEPTH`                                                     | `shouldHydrateCatalogItemDraft` 只在初次打开另一商品或显式 `forceHydrate` 时允许替换草稿；`markSavedForHydration` 与 shell content refresh 是唯一 force producer。session callback 只依赖稳定的 `replace` action，不依赖整份 draft object  | 将 clean draft 当作可随渲染覆盖、在 Select/组件上加局部 guard、以 timeout 掩盖更新循环                          | 同商品、clean、非 force 必须返回 false；同商品 force 或不同商品必须 true；L2 join 收到 `BROWSER_RUNTIME_ERROR` 后必须不完整                                                                                     |
| 写动作只点击、不等待 generated command completion       | 本批 create/edit/batch/copy 的 12 个写分支；此前成功/失败 UI 断言可在 owner command 尚未完成前继续，导致 readback 与用户操作不在同一 action window                                                         | spec 的 `clickGeneratedCommand` 只从 generated operation registry 取 method/path，先 arm response waiter、再点击、最后返回真实 completion；create/save/batch/brand-copy preflight/execute 一律复用，状态切换保留同一语义                   | 手写 path、每 case 各自 wait、以 Modal/Alert 可见代替 completion、只加测试延迟                                  | 缺生成 operation、未收到 completion、成功分支非 2xx、预期失败分支为 2xx 都必须 FAIL；join completion 必须处于 declared action window                                                                            |
| write Journey 缺真实 UI owner readback                  | create 成功/恢复只进入 Editor，未通过 UI 重开新商品；失败也未在 UI 上验证原事实；最终 oracle 因缺 `getOperationsCatalogItem` 误报，掩盖 duplicate 根因                                                     | generated `expectedReadback/unchangedReadback` 决定 reader；spec 通过同一工作台的搜索、打开和详情 read 实现 post-action readback，禁止 `page.evaluate(fetch)`。fixture protocol 与 network flow 同步声明该读                               | 直接 fetch 补一条 GET、移除 owner reader、把 DOM 成功文案当 owner readback                                      | 删除 post-action UI read 或把 success create 改为不产生 detail read 时，protocol/network validator 必须失败                                                                                                     |
| Playwright 产物逃逸 run scope                           | 最新受管运行的 trace 在 `apps/frontend/operations-admin/test-results/` 形成 build gate 扫描输入；trace 内含同一 `l2-...` runId，mtime 位于该 run 的执行窗口                                                | `browser-l2-runtime.mjs` 的 `playwrightArtifactDirectoryForRun(runDirectory)` 是唯一产物路径 producer；runtime 注入绝对 `R5_L2_PLAYWRIGHT_OUTPUT_DIR`，config 无默认回落，state/manifest/cleanup 都复核并记录该 run-scoped evidence path   | 保留 config 默认 `test-results`、在 build gate 排除 L2 产物、把 trace 搬回 app 目录、清空所有未知测试目录       | 传入 app `test-results` 或 state 中另一目录必须报 binding failure；config 缺 env 或给相对路径必须在 Playwright 启动前失败                                                                                       |

复盘结论：L2 的“数据来源”仅有三层且职责不可重叠：蓝图声明 Journey 与 execution-suite metadata、P1 派生
policy/fixture/network/timing/candidate、受管 runtime 物化 owner TEST facts 并执行/核验。Playwright spec 不拥有
case set、业务码、network/timing 或 owner expected facts；它只执行 generated case 的用户动作并记录观察。该分层既
避免用 DEV seed，也避免在 runtime 或 spec 创造第二个 truth source。

### 2.3 L2 framework/method/data 静态对账记录（本轮运行前）

本节是 RCP-05A 的实施记录，不是供 runtime 消费的第四份策略。逐项复核结果如下；动态浏览器证据仍为
`UNVERIFIED_REQUIRES_EVIDENCE`，不得把本表或任何 Node test 称为 L2 PASS。

| 维度                             | 唯一声明/实现住址                                                                                               | 消费者与禁止项                                                                                                                                                                                                                                                                                                                                     | 静态结果                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Journey 分母和启用候选           | `contracts/policy/catalog-inventory-l2-case-blueprint.json` 的 `executionSuite`，由 P1 生成 candidate           | fixture/runtime/spec 只验证 candidate/final profile；禁止 spec/runtime 固定 24 case 列表                                                                                                                                                                                                                                                           | 8 scenario × 3 = 24，candidate 顺序与 generated scenario 一致；execution-suite 删除 red mutation 已拒绝                                                                                                                                                                                                                                                                                      |
| fixture 数据与身份               | P1 fixture catalog 的 8 TEST dataset；runtime `catalogLibraryCaseIdentityPlan` 只从 generated caseId 派生物理码 | fixture validator 从 candidate 读取 fixtureRefs；禁止 DEV seed、手写八 fixture 清单、成功创建与主 fixture 同码                                                                                                                                                                                                                                     | 主 fixture、成功创建、故意重复失败三种码已分离；identity collision 和 candidate fixture set 均有独立 red proof                                                                                                                                                                                                                                                                               |
| 网络、预算与 timeout             | P1 组合式 `l2NetworkFlows` + operation budget registry                                                          | runtime 只读 generated `parameter.network` 并比对 observed operation multiset；禁止 spec 手写请求表、background 无界放行或逐 case 手调 timeout                                                                                                                                                                                                     | 24 case 均有 bounded requests；编辑流必须包含 `listOperationsCatalogUnits`，删除后 red mutation 拒绝                                                                                                                                                                                                                                                                                         |
| 用户动作与控件                   | `catalogTestIds.ts` → P1 locator bindings → generated control keys；Playwright 的 `runCase` 只承载动作编排      | 语义 label testId 通过唯一 composite-tab resolver 找 `role=tab`；禁止 force click、给 label 另造 button、index 身份                                                                                                                                                                                                                                | resolver 断言唯一真实 tab 和 `aria-selected`；新建三态均经工作台重新打开 owner detail，不用 fetch/evaluate                                                                                                                                                                                                                                                                                   |
| business oracle 与失败语义       | fixture `expectedReadback` / `unchangedReadback` + owner HTTP completion                                        | spec 捕获真实 owner reader，并由 runtime join 严格对账；写命令先等待 generated completion，随后等待该 Journey 已声明的 UI reader；禁止 DOM 可见性、DEV seed 或直接 HTTP fetch 代替                                                                                                                                                                 | 创建成功/失败/恢复均已产生 `getOperationsCatalogItem` 的 UI 读回路径；编辑/治理会关闭并重开 View，批量等待 workbench 自身 refresh，配置等待 production-tag list，失败保留 original owner fact                                                                                                                                                                                                |
| 结果、进度、日志、产物与 cleanup | candidate active set、Playwright result、CASE_COMPLETE join events、受管 runtime manifest                       | reporter 正常时取 JSON；异常未落盘时只用 terminal join fallback；运行强制 `--workers=1` 保证 run-scoped action context 与有序进度；trace/output 只能写 runtime 目录并作为保留证据，禁止回落 app `test-results`；禁止从 pass count 反推 selected、丢失已完成失败 case                                                                               | JSON/join 不一致、join 重复、异常空 JSON、progress 次序、owner mutation 或输出目录越界均有真红；manifest 区分 selected/result/passed/failed/source 与 run-scoped artifact path                                                                                                                                                                                                               |
| 写动作完成与 surface 转换        | generated operation metadata、`CatalogWorkbenchPage` 的保存后 `EDIT → VIEW` 状态机、L2 `runDeclaredAction`      | 所有写动作先由 `waitForGeneratedOperation` 以 operationId 建立 completion waiter，再执行用户 click；批量、配置、编辑和治理必须再等待其 generated owner reader。成功后只验证批准 Journey 的目标 surface，持久化事实仍由 generated owner readback 判定。禁止手写 `/api` 路径谓词、成功后继续在已关闭 editor 寻找控件、或把 fixture 常量复写到 spec。 | 2026-08-25 的 edit case 证明手写旧 `/catalog/items/.../status` 谓词会把真实 200 误报为 timeout；同次运行证明 whole-save 后 editor 已关闭、view detail 才是用户可见 readback。批量 reader 必须在 click 前注册，复制 stale mutation 只能改 preflight 的目标投影；静态门要求 lifecycle helper 复用 generated waiter，edit-success 消费 runtime fixture 的标签名并验证 view readonly presenter。 |

本轮 source audit 以 generated current tree 复算为：`ACTIVE=24`、`FIXTURES=8`、`CONTROLS=43`、每个 active case 都有
network、single declared action、TEST fixture 和 locator binding。`browser-l2-runtime.test.mjs` 35/35、fixture self-test 与
runtime self-test 均通过；输出目录的 run-binding、禁止 fallback 与 manifest 保留证据亦有独立 red proof。这只证明框架静态闭合，真实浏览器、远端命名空间、HTTP/DB join 和 cleanup 尚未重新运行。

### 2.6 真实运行后的 L2 框架复盘与重整（2026-08-25）

首次完整 run 的用户场景为 `24/24 PASS`、cleanup 为 `PASS`，但 join artifact 为 `INCOMPLETE`。这不是可忽略的
报告噪声：它证明“案例声明、真实用户动作、浏览器请求、owner completion、DB section”的单链事实尚未闭合，不能
以 Playwright 绿灯替代。根因按唯一住址收敛为三类，后续 fresh run 前必须一并修复并加入红变异。

| 根因层                 | 已观察事实                                                                                                                                                                         | 根本修复与唯一住址                                                                                                                                                                                     | 禁止项                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 控件声明—动作          | view/governance blueprint 声明 `CATALOG_ITEM_VIEW_DRAWER`，但动作编排以较宽泛的 `CATALOG_ITEM_DRAWER` 记录触达                                                                     | 由 blueprint 的 controlKey 驱动 `openCatalogItem` 的精确 surface；不删除 view 声明，也不放宽 join 的 declared-control gate                                                                             | 不把缺失控制项从 blueprint 删除，不以相同 DOM 外观视为等价                                           |
| 跨 BrowserContext 诊断 | version drift 必须经第二个隔离 context 做真实 whole-save；该 context 的请求没有进入主 page 的 route/event 采集，导致 mutation requestId 无 HTTP/DB join                            | 抽取一个共享的 generated-HTTP observer，在主 page 与每个受控 secondary page 安装同一 header、request/response、action 关联协议；secondary context 也用 source scope→principal 映射认证                 | 不手写 mutation completion、不用 response header 假装 HTTP/DB 已关联、不回退 lifecycle transition    |
| P1 网络流声明          | failure flows 仍声明退役的 lifecycle mutation；真实 whole-save 是 `saveOperationsCatalogItem`。edit 成功漏 `getOperationsProductionTags`；configuration 的请求上限未经真实动作验证 | `scripts/generate/catalog-inventory-p1.mjs` 的组合 flow 是唯一网络声明：建立 `VERSION_DRIFT_WHOLE_SAVE` flow，failure/recovery 使用它；把实际详情编辑依赖纳入 flow；只在共享 flow 内以实测多集更新上限 | 不在 generated scenario/fixture 手改请求表，不在 runtime 增加 allowlist，不为了绿灯删除 network gate |

第二次 fresh run 进一步证明上述组合边界必须把“恢复”当成显式的第二次用户动作，而不是将普通 flow 的上限整体放宽：
`catalog-config-recovery` 先提交重复生产标签、在原抽屉修正后再次提交，故唯一 P1 网络 flow 在
`CONFIGURATION` 之外组合 `CONFIGURATION_RECOVERY_RETRY`（第二次 `createOperationsProductionTag`）；
`catalog-copy-recovery` 先因版本漂移得到拒绝，再重新检查并执行，故在 `COPY` 之外组合
`COPY_RECOVERY_RETRY`（候选刷新、replacement preflight、第二次 execute）。这两项只属于 recovery，
success/failure 不获得额外请求余量。普通复制自身包含打开来源、筛选来源与执行后刷新目标投影三次候选读取；
故 P1 self-test 固定 recovery 的创建=2、copy 候选=4、preflight=4、
execute=2，并以将第二次 execute 降为 1 的 red mutation 证明门会红。运行器继续只消费 P1 生成的
`network.requests`，禁止 spec、runtime 或 artifact 自行修正计数。

`catalog-view-failure` 的一次性详情故障同样有一个不可泛化的测试前置：先打开并关闭成功详情建立 owner/readback
基线，再 reload 以确保故障请求不能从 RTK cache 命中。该前置只多出一次 shape manifest 读取，P1 因此以
`VIEW_FAILURE_BASELINE_RELOAD` 专用 flow 声明 `getOperationsCatalogShapeManifest=1`；view success 与
recovery 不消费它。self-test 固定 failure 总数为 4，并以将其降回 3 的红变异证明该 setup 不会被通用上限静默吞没。

受管 seed 首次执行还发现 `SEED_CATEGORY_CANDIDATE_READBACK_INVALID` 的唯一错误住址：seed executor 将
owner 的 keyword candidate read 误解释为“命中父分类时返回整个后代子树”。owner 的 SQL 语义是“文本命中
candidate 行及其完整祖先路径的并集”；每行携带完整祖先 `path`，不由 seed 或 consumer 自行补后代。executor 的
readback 只按 owner 返回的完整 row set、行身份、父级、可选性和 `path` 验证；`path` 逐段比较分类引用、
编码、名称三项事实，不以 JSON/JSONB 对象键序作等值依据。若任一 predicate 不成立，
先记录不含业务值或原始响应的字段级布尔诊断与行数，再保留该 typed failure。静态反例禁止恢复
`matchedCodes → descendant` 投射。该修复不改变 category owner、API、UI 或 seed 数据，只使 seed 严格验证
已批准的单一 read contract。

**JSONB 等值通用规则（2026-08-25）**：同一 owner 事实可经 PostgreSQL `jsonb`（规范化对象键序）或
Jackson `ObjectNode`（写入键序）回到 seed。`sameJson` 的唯一实现以 Node `isDeepStrictEqual` 比较对象，
故对象键序不参与等值；数组顺序仍严格参与，继续保护 SKU 规格、制作说明和业务行的顺序。有限适用分母是
executor 中所有需要同时比较详情与列表/SKU-page 投影的两个调用点：`effectivePreparation` 与
`exactFactMismatch`。禁止恢复 `JSON.stringify` 对对象的键序比较；该写法会把序列化器差异误报为业务漂移。
规格子页的字段级诊断只记录 `mismatchedFact`，不记录业务值或原始响应。

重整后的验收顺序是：先以 P1 自检和 runtime red mutation 证明三个根因会红，再跑 static/typecheck；随后 fresh
readiness → exact-set generation → 24/24 L2。通过条件必须同时为 `discovered=selected=results=24`、每 case
`joinStatus=COMPLETE`、network multiset 完整、业务 `PASS` 与 cleanup `PASS`。只有届时才进入 reset、DEV start、seed。

#### RCP-05A.1 复盘后修订：overlay 与失效版本不是第二套事实（2026-08-25）

两次受管浏览器运行暴露的三个失败被重新归入同一原则，而非按 case 补 selector：

1. `Select` 与 `Dropdown` 的可见 portal 定位分别复用 `operationsL2.ts` 的公共 helper。L2 spec 不再用
   `[role=option]:visible` 或 `[role=menuitem]:visible` 重造一个跨 portal 的通用选择器；前者会命中隐藏
   accessibility mirror，后者不能表达 AntD menu portal 的生命周期。helper 只返回当前真实可交互项，仍由
   Journey 自己注册 generated HTTP completion 并完成 click，故不吞掉 action/request join 的职责。
2. 批量失败的唯一版本事实不是初始 fixture baseline，而是 fixture 为制造真实 stale request 所执行的
   `transitionOperationsCatalogItemStatus` typed command readback。P1 的 unchanged template 用
   `SAME_AS_FIXTURE_MUTATION` 声明此关系；spec 从同一 command envelope 的顶层/result 双 version 读出并要求一致，
   随后 owner list readback 必须精确相等。这样 batch 若额外写入版本必红，也不会把合法 fixture mutation 误判为失败。
3. 配置状态筛选继续由既有 `selectOperationsOption` 消费真实的 owner-returned Select option；production-tag
   duplicate 错误由 owner 约束返回 `DUPLICATE_CODE`，不由 UI 伪造。每条修订均有 runtime source proof，且不新增 case
   list、fixture list、HTTP path、timeout、DOM-only oracle 或 runtime policy。

这三条属于 RCP-05A 的实现澄清，不增加产品语义或 L2 机制；修订后的动态运行仍是唯一可以证明其浏览器行为、
HTTP/DB join 与 cleanup 的证据。

## 3. 实施工作包

每个工作包开工、写前和写后均按 `doc/platform/implementation-task-template.md` 重读其 RECALL、对应原需求/Journey/IA/详设、六维 memory 命中、owning source 与当前复用实现。任何新发现必须归入上述七族；不能归类时停止并提出 finding，而非临场加机制。

### RCP-00 · 事实冻结与差集清单

**RECALL**：正式需求 §4/§10、Journey、交互 §4、IA §2/§3/§8、详设 §5/§7/§9b/§11、串行计划 CP-00 至 CP-13、`project-memory/decisions/deterministic-context-only.md`。

1. 逐项重算详设 §9b 的 20 个锚点；重算 annotation、catalog operation、平台 operation、L2 scenario/case/dataset/active、catalog testId 和 locator 分母。
2. 对 F1–F7 每项记录 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，附唯一代码路径与消费端；不沿用历史 review 的数字。
3. 把允许的旧字面上下文列为精确路径：migration/preflight、红变异、copy closure、seed definition map。其余正向运行路径构成 retirement scan 的零集合。
4. 产出实施时使用的“源→产物→消费者”差集清单；该清单不是第二份 registry，不可由运行时消费。
5. 退役无调用者的历史字段级 `quickManage` 分支：当前正式路径是编辑草稿持久化→关闭编辑→对应配置库→工作台恢复编辑；不得用保留死分支、旧 testId 或回填 callback 冒充兼容。

**完成条件**：所有分母可复算、历史结论已重新判定；若分母不同，先修订本文和相关设计，尚不改代码。

### RCP-01 · 先收敛商品模型、读写契约和 owner 投影

**RECALL**：正式需求的生产标签/十列表格/分类条款，IA 控制权表与不可见维度，详设 CP-01/02/05/07，`CatalogOwnerApi`、`CatalogOwnerService`、`CatalogTaskReadService`、`CatalogInventoryCoordinator`、`CatalogItemReferenceFacts`、catalog migration。

1. 以商品级 nullable `productionTagRef` 为唯一 item 存储与 write/read 字段：whole-save、reference replace/read、导航筛选、copy per-item mapping、partial unique 与 seven-state guard 逐条对齐。保留 copy closure 的 definition-ref set，但在类型/命名/注释中明确它不表达单个商品绑定。
2. 清除 `missingPriceCount` 的正向 read/write/decoder/presenter 形态；保留 owner 对 retired input 的拒绝和 P1/migration red mutation。商品无价仍能返回、查看及编辑非价格事实。
3. 以 owner summary 一次性投影列表和 SKU 子页所需十列事实：category path、规格值的业务排序、价格与销售/基础单位、属性、制作信息、库存/BOM、更新时间、状态、来源。禁止从导航拼路径、从数量猜扣减模式、逐 SKU 拉详情。
4. 对分类候选明确只读 task read 的 `usage/currentCategoryRef/path/selectable/disabledReason/cursor` 语义。UI 可以 lazy fetch 指定 parent 与搜索页，owner 必须保有排序、资格和原因。
5. 三类简单库（商品标签、计量单位、生产标签）的名称/编码搜索与状态筛选同为 owner query facts：搜索输入在当前 library presenter 本地，提交后才更新 query；状态选择立即更新 query；二者改变均回到首页并进入 cursor identity。通用字典、生产标签按 cursor 集合筛选，单位即使最多 99 条仍由 owner 筛选；不得以当前已加载页 `filter` 充当完整结果。
6. 迁移/preflight 只处理设计点名的四个持久化点；Flyway transaction 内重跑同一 predicate。真 unknown、非等值冲突、SKU 显式清除非空 canonical 均 fail closed；不 pick-first、dual-read 或静默同步。

**静态失败条件**：SKU/option 能写 production tag、item 能写两标签、owner page 无十列源事实、前端需要合成资格/扣减、迁移 predicate 前后不一致、正向 model 重新出现 retired property，任一 FAIL。

### RCP-02 · P1 单一源、生成器自检与官方产物重生

**RECALL**：`scripts/README.md`、P1/tokens/M1/bindings/P3 README 与 self-test、详设 CP-01/03/10/11。

1. 把 RCP-01 的 contract/read model/operation metadata/fixture graph/active eligibility 全部落到 P1 或已经存在的共享 budget validator；不在 generated RTK 或 runtime/spec 另写等价事实。`contracts/policy/catalog-inventory-design-byte-coverage.json` 是 P1 的 versioned policy input 而非 generated 输出：必须迁到本批 schema/退休字段事实，更新其 design source/hash，并禁止继续引用 2026-08-06 的旧模型字段。
2. 将 P1 rich `catalogLibraryFixtureGraph` 的 object、edge、expected/readback 作为唯一 fixture 定义；补 self-test 证明八个 library dataset 不可退化为“2 objects/0 edges”，并对每个 Journey 的必要事实作最小精确断言。
3. 退役当前 `P1 activation manifest → INCREMENTAL execution profile → readiness` 的循环依赖，改成严格两阶段：
   - P1 无条件生成只读 `catalog-inventory-l2-activation-candidate`，其内容只含 approved 24 case exact-set、source revision、fixture/testId/locator/static candidate digest；它不是 execution profile，也不能启动 browser run。
   - managed readiness 只消费该 candidate，建立 TEST namespace、物化 fixture、验证 secret/process/timing/action/owner-readback 前置并产生 held readiness manifest；`FRAMEWORK_ONLY` 此时不得被当成运行启用，也不得阻断 readiness。
   - 仅 P1 在显式读取该 PASS held manifest 且 candidate digest/run binding/exact-set 全相等后，才生成最终 `INCREMENTAL` execution profile。browser L2 run 只能消费最终 profile；profile 仍禁止手改。
     这三个文件各有一个职责，不能以环境变量、固定 24 常量或 runtime 覆盖替代。
4. 退役 `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` 的 `EXPECTED_ACTIVE_CASE_IDS` 以及 `scripts/test/browser-l2-runtime.mjs` 的 `CATALOG_LIBRARY_CASE_IDS`/派生默认参数等运行时复制集合；spec/runtime/self-test 都只读取 generated candidate 或 final execution profile，并从其 `enabledCaseIds` 显式传递。candidate exact-set 只由 P1 producer 声明，runtime 只验证，不重述。不得建立第三份 case list。
5. 更新 generator red mutations：required field、single tag、retired positive field、fixture graph、operation budget/tag/binding、candidate/profile exact set、candidate digest/run binding 分别独立真红。
6. 仅在此工作包的源验证通过后，按官方链重生：P1 → workspace command tokens → M1 → operation-handler-bindings → P3。每一步的 missing/extra 是生成源首败，不回填产物。

**静态失败条件**：生成后 fixture 仍旧 graph、readiness/run 从固定常量取得 24、candidate 被当 execution profile、最终 execution 缺 PASS held manifest 或 binding 不同、生成物与 source exact-set 不同、任一 red mutation 不红，均 FAIL。

### RCP-03 · 前端三层 state、事实族拆分与无 fallback 读模型消费

**RECALL**：交互 CATUI-VIEW/EDIT/CONFIG、IA §2/§3/§4、详设 CP-04–CP-08、`frontend-coding-standard.md` §3-K、admin-ui-foundation。

1. `CatalogWorkbenchPage` 只装配首层 `CatalogWorkspaceTask`、RTK query identity 与焦点归还；first-layer View/Edit/Config/Copy/Create/Category/Batch/Governance 互斥，不能留下第二套 open state。
2. `useCatalogItemDraft` 成为整单 draft 的唯一住址：九个 typed section、dirty/error/active、session key（scope/brand/item/version）、恢复/放弃、known reject/unknown/stale version。服务端只由 RTK `currentData` 保存；子任务只向 parent draft Apply，不得即刻写 server。
3. 将 `useCatalogItemEditorWorkspaceState` 的九事实族 state adapter 与 `CatalogItemEditorSectionAssembler` 的 Editor 消费逐项拆清；View 必须保持独立九文件，禁止 View import `Form` 或 disabled editor workbench。`CatalogItemEditorWorkspace` 保持路由包装，非错误改造目标。
4. 统一由 `useCatalogCategoryCandidates` 消费 owner rows；删除 editor/workbench 中以 navigation tree 为候选/资格/路径 fallback 的路径。presenter 要保留 lazy child、search ancestor chain、load-more 和 IA 明定的上游变更清理。
5. `CatalogItemListTable` 只按 owner summary 顺序显示十列。SKU 子页缓存 identity 至少包含 scope、brand、query/list generation、parent item；树/filter/scope reset 后不得复用旧 child。loading/error/load-more 仅为同表宽度的子行。
6. 将单元格呈现收敛为纯 presenter：商品父行四行（名称、编码、分类、标签）；SKU 两行；商品形态列含 SKU 默认规格；价格/单位逐项带业务类型；规格或选项列逐条；属性、制作、库存/BOM 为简明业务行；时间短格式/完整 Tooltip；状态、来源独列。每格最多四行、单行长文本/溢出集合均有完整 Tooltip，不用“共 N 个”替代内容。
7. action availability、category disabled reason、owner typed problem 只做业务语言映射，不由 UI 重判；用户可见 DOM/aria/toast 不泄露 UUID、enum、operation、owner、SKU technical shorthand 等禁用术语。特别是计量单位 `isReferenced` 已由 owner 摘要声明时，删除控件必须在提交前禁用并说明“正在使用，不能删除；可以停用”，不得把预测性 409 留给用户。

**静态失败条件**：View 使用 disabled form、宿主需随 section field 扩展、UI 自造分类禁用/扣减、SKU 内容过期或用 index 作身份、十列缺列/隐藏入口/斜杠复合、技术词进入用户文案，任一 FAIL。

### RCP-04 · testId、日志与定位边界一次性收口

**RECALL**：IA L2/testId 条款、详设 §11b–§11d、`catalogTestIds.ts`、locator bindings、`OperationsTransport`、browser L2 runtime。

1. 以 `catalogTestIds.ts` 为唯一 producer：所有 surface、可交互控件和动态行均由常量/业务 code/ref/editorId 构造；禁止 index、散写字符串或旧 column-settings testId。structural noninteractive node 不能冒充可交互 control。
2. 建立 source scan + locator bindings + L2 actual action touch 三方双向差集门；实际 touch 必须来自 locator resolution/action event，不能把声明 `controlKeys` 当触达。
3. 定义 event chain：`caseId/actionId/testId → requestId → HTTP completion(operationId) → DB section`。每个 action 要有 start、locator resolved、request/completion 或 explicit no-request、terminal；缺任一必填事件在 join validator 中点名 `case/action/boundary`。
4. 把现有 `L2_CASE_START`、`L2_CASE_COMPLETE`、progress 与 heartbeat 纳入结果 gate：总数、completed/pass/fail/remaining、一 case 一 terminal、active index、预算和 watchdog 一致。保留当前即时 stdout，不靠盲等或最终 JSON。
5. 事件及 artifact 遵守脱敏禁录：不写密码/hash/OTP/token/cookie/Authorization/手机号/登录名/IP/raw payload；red mutations 检测 secret-shaped manifest/log key。

**静态失败条件**：一个交互控件无 central testId、实际 action 无 touch/event、进度不闭合、join 缺链却能 PASS、日志含敏感字段，任一 FAIL。

### RCP-05 · 验收、seed 与 L2 判别式业务 oracle

**RECALL**：backend acceptance business scenario standard、串行计划 CP-10/11、P1 `catalogDefinitionSeed`、`scripts/dev/catalog-inventory-seed-executor.mjs`、`catalog-inventory.spec.ts`。

1. 以 `@AcceptanceScenario.operation` 为强制 host identity：逐 case 实际 request 必须同 operation；混用 navigation/items 的断言迁到正确宿主，不删语义；总 annotation 仍按 approved denominator 闭合。
2. 把 `assertStrictOwnerReadback` 改为判别式 oracle protocol，而非宽泛 map：每个 case 声明 `readTarget`、pre/expected/unchanged facts、version rule、成功/失败/恢复 terminal。create 读新商品、batch 读逐项 receipt+item、config 读 dictionary、copy 读 preflight/execution、find/view 读只读 projection；失败用 owner facts/version/no-new-object 而不是 UI 文案代替。
3. P1 `catalogDefinitionSeed` 与唯一 executor 覆盖深分类、父加三 SKU、无 SKU、十列长短/空值、九事实族空/非空、生产标签 0/1、停用既有可见/新候选排除；严格 readback 比对业务字段，不能把 seed graph 当 L2 fixture。
   source fixture 的 `headquarterTemplate` 是总部/门店分区的唯一谓词；创建、导航计数和所有商品列表 readback
   必须从同一 `sourceCatalogCodesForClientScope` 派生该 scope 的期望编码集，canonical dataset 才可在两个 scope
   同时出现。不得在某个读回点重新以全量 seedItems 拼期望集合；红夹具须证明门店服务商品不会被要求出现在总部列表。
4. L2 fixture runtime 在物化前调用唯一 required validator：`preState/actionInput/expectedReadback/unchangedReadback` 与 Journey 对应 action 不可缺，禁止 `??` 默认。TEST dataset 的每个声明对象和 edge 必须由 owner command 物化、记录其**符号→真实 ref/code/scope** 映射并读回验证；来源商品不能另由 runtime ambient 常量创建。跨 scope 对象必须在 P1 图中声明其 scope，并以对应身份和 scope 的 owner command 物化。停用但已绑定的值必须按“先在 enabled 状态形成既有绑定、再停用同一 ref”的合法时序建立，不能用新绑定停用值伪造历史。治理三态必须分别证明“无引用可执行 / 引用存在被阻断 / 先阻断后解除再可执行”，不能只检查 JSON 图。每个写 case 执行真实 owner readback；失败断言版本和核心事实不变。
5. 24 个新增 L2 case 的 timing 从 generated operation budget 与 42.7ms 基线计算；case timeout、watchdog 与 report 同源。secret、namespace、credential/session mode、cross-run、cleanup 各保持独立 red mutation。

**静态失败条件**：host 与 request 不同、generic oracle 不能辨识目标、fixture 缺字段使用默认值、seed/L2 共用运行数据、写失败无 owner no-change proof、timeout 是魔法值，任一 FAIL。

### RCP-05A · L2 framework/method/data 单链收口（RCP-05 的前置）

**RECALL**：详设 §11c.2--§11d、串行计划 CP-10 #4--#11、IA L2 控制权与日志条款、
`catalog-inventory-l2-case-blueprint.json`、P1、`browser-l2-runtime.mjs`、`catalog-inventory.spec.ts`、
`catalogTestIds.ts`、现有 L2 fixture/runtime tests 与本计划 §2.2。

1. 给本批 8 scenario 在**蓝图**增加唯一的 `executionSuite=CATALOG_LIBRARY_WORKBENCH` metadata；P1 从该 metadata
   派生 24 candidate case，不再按 scenario ID 正则和 24 个 case literal 作 selector。`24` 只保留为验证分母，
   candidate digest 继续防漂移；旧 41 case 不被宣称不适用，也不被运行时重述。
2. 在 runtime 建立并导出 case identity plan。所有 primary fixture、create success/recovery、intentional duplicate failure
   code 必须由其导出，且通过一个 validator 证明相等/不等关系和 run 内唯一性。业务 fixture 图仍由 P1 产生；identity
   plan 只把声明映射到本 run 实例，不制造第二份 fixture 图。
3. 将 P1 手写 `l2NetworkFor` 的 case map 收敛为可组合 flow（fresh login/workbench、detail、editor、dictionary、
   lifecycle、copy 等）和 Journey action；每个 `network.requests` 合并为唯一 operation multiset。P1 以该 multiset
   生成 expected event matrix、timing 和 timeout。runtime 在每 case terminal 对 observed operation/count 做 conformance
   校验，超集、漏 required、超次数、未知 operation 各有稳定失败码；background 只能是明确声明且有上界的观察。
4. 结果结算的 selected set 始终等于 activated candidate，不能从 reporter 推导；terminal result 首选 Playwright JSON，
   abnormal exit 时可由 CASE_COMPLETE join fallback，二者俱在必须一致。selection/execution manifest 必须分别保存
   selected/result identities、source、重复/缺失/意外集合和 pass/fail，不得把已完成 case 丢成 0。
5. 将 tab 定位封装为 composite-control resolver：token 来自 `catalogTestIds.ts`，动作落在唯一 `role=tab`，并在
   join 中记同一 token 与真实 role。其它复合 AntD control 复用同一 resolver，禁止每个 spec 再造 xpath。
6. create/edit/config 的 post-action owner readback 必须走批准 UI Journey：成功后从列表定位并打开目标；失败后重开
   原目标并读 unchanged facts；不允许直接 `fetch`、`page.evaluate` 或静态 HTTP helper 越过用户 surface。fixture
   expected/unchanged reader、spec helper 和 generated network 必须三方一致。
7. 扩展既有 `browser-l2-runtime.test.mjs`、P1 self-test 和 spec static guards；不新建平行 DSL/test harness。红变异
   至少覆盖 §2.2 六行，且每个变异只能触发其对应稳定码。

**完成条件**：蓝图→P1→candidate/profile→fixture/runtime→spec 的 case identity、network/timing、result、locator 和
readback 各只有一个 producer；静态检测在启动受管环境前能拒绝 §2.2 的全部反例。

#### RCP-05A 实施前完整复盘（2026-08-25）

本次复盘不把“24 case 能启动”视为框架正确。逐层重新核对后，保留既有受管 runner、Playwright spec、P1
生成链、owner-HTTP fixture 和 join validator，不新增 DSL、第二 runner、平行 fixture 或 DOM-only oracle。下表是
本批 L2 的唯一事实住址；任何消费者只能读取上游住址，不能复制或推断同一事实。

| 事实                   | 唯一 producer                                                                         | 允许 consumer                                          | 禁止形态                                                          |
| ---------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 24 个本批 case 身份    | blueprint 的 `executionSuite=CATALOG_LIBRARY_WORKBENCH`，由 P1 派生 candidate/profile | fixture identity plan、spec selection、runner manifest | scenario ID 正则、spec/runtime 手写 case list                     |
| 控件语义与可定位性     | `catalogTestIds.ts` + locator binding                                                 | spec `requireControl`/实际 touch、P1 exact-set gate    | 同一 testId 绑定全局错误和字段错误、裸 CSS/历史 overlay `.last()` |
| 业务事实与初始数据     | P1 fixture graph → owner HTTP materialization → owner readback                        | owner fixture、case oracle、L2 UI                      | DEV seed、ambient 常量、未读回的 create response                  |
| 网络/时长              | P1 composable network flow + generated operation budget                               | profile、timeout report、runtime conformance           | spec 自写 operation/path/timeout                                  |
| 业务 oracle            | fixture 的目标 readback descriptor + 用户可见 Journey read                            | spec、join result                                      | 元素存在、直接 fetch/evaluate、泛化 item map                      |
| case terminal/progress | Playwright result 与 case-scoped join 的一致结算                                      | runner manifest/stdout                                 | reporter 失败时把已完成 case 归零                                 |

实际运行的 7 个失败按同根合并为四项，而不是逐 case 改断言：

1. AntD 关闭后保留旧 portal，直接 `getByTestId`/`getByRole` 会选到隐藏实例；统一经 `visibleTestId` 与
   `visibleRole` 解析真实控件，生命周期 mutation、状态筛选共用该规则。
2. 配置 Journey 从商品编辑绕行配置抽屉，不触发工作台的商品字典入口；blueprint 由错误的
   `CATALOG_DICTIONARY` 改为真实字段与创建控件。字段级重复编码错误只由 code field 表达，`dictionaryProblem`
   仅保留给真正的任务级错误，消除一个 testId 两种语义。
3. 复制 stale mutation 必须操作 source item；source 名称不是 fixture 的第二住址，因此改为只以 source code 打开
   read surface，避免把 target 名称错误断言到 source 上。
4. 新建生产标签遇到现有编码是唯一约束冲突，不是版本漂移。typed 与 legacy owner pre-receipt check 都只校验
   create payload 的必填性，统一让数据库唯一约束返回 `DUPLICATE_CODE`；owner integration test 覆盖不同名称的
   重复编码，L2 fixture 再以 `getOperationsProductionTags` readback 确认已物化的基础标签 ref/code/name/status。

复盘后的可证伪条件：隐藏历史 option、字段错误伪装成 task Alert、copy source 套 target 名称、同编码不同名称返回
`VERSION_CONFLICT`、或基础生产标签未被 owner list readback 确认，任一必须在 browser 前由 static/runtime/owner
测试拒绝。静态链通过不代称 L2；其作用仅是证明动态运行不再承担发现框架住址错误的职责。

5. **case 隔离、前置状态与真实 mutation 后事实**：版本漂移只能由真实 whole-save 改变可编辑事实及 `version` 产生；
   不得用生命周期操作制造它。原因是 batch 的目标本来就是停用，先停用会把 stale request 变成合法幂等 no-op；copy
   需要在 stale 后仍能重试同一启用源，先停用会破坏候选资格。失败 readback 必须保留原 lifecycle status 并精确匹配
   whole-save 后的 `version`。同一 fixture 的 success/failure/recovery 不得共享会被前置命令修改的对象；copy 三态分别
   声明 source fixture code 与实际 head-company scope，runtime 从同一 P1 mapping 按 case state 解析、物化、候选读回
   并传给 browser。source mutation 必须通过受管 secret allowlist 中的总公司测试身份在独立浏览器 context 完成；不得
   复用门店 cookie、把总公司权限投射到门店身份，或将凭据写进 fixture、join、manifest。运行顺序改变、任一
   source/scope/actor 缺失、mutation 未递增版本、或 batch 失败后状态偏离前置状态，
   都必须在 browser 前的 generated/runtime gate 中 FAIL。
6. **筛选后的创建观察**：配置库创建成功只失效 owner list，不静默篡改用户已有筛选。L2 若需观察新建条目，
   必须先通过同一 `Input.Search` 控件清除自己的查询条件，再断言刷新后的可见行与 owner readback；不得把
   “旧查询仍在”误判为创建或 readback 失败。
7. **SKU 父行库存摘要不是详情编辑零态**：`inventoryDeductionSummary.mode=null` 是已生成契约明定的
   SKU 粒度父行语义，表示“各规格分别设置”；它不能从详情 `inventoryRules` 中为了编辑完整性而补出的
   `ITEM/NONE` 节点推导。所有 list oracle 必须先按 parent/SKU 关系裁定 grain：有 SKU 且校验父行时固定
   `SKU/null/null/null`，SKU 子行才读取匹配 SKU owner，非 SKU 商品才读取 ITEM owner。HTTP acceptance 与
   seed readback 均须断言这条边界；禁止把详情零态复制回列表或为让校验通过而改变 owner coordinator。

### RCP-06 · 文档逐条回读与 fresh 静态代码审查

**RECALL**：正式需求、Journey、交互、IA、implementation design、serial plan、本修复计划及 `doc/platform/implementation-task-template.md`。

1. 建立逐文档对账表：逐项覆盖本计划 §0 的正式需求、Journey、交互、IA、**原 implementation-facing design**、serial plan 及仍有效 CIPG 条款。每一个可实施要求只能标为 `IMPLEMENTED`、`NOT_APPLICABLE_WITH_REASON` 或 `PROHIBITED_RETAINED_FOR_NEGATIVE_GUARD`，并指向 source/test/validator。不得用“已做类似功能”填充；原详设每条必须有 one-to-one 行，实施后对账为动态前不可跳过的单独 PASS 门。
2. 以 F1–F7 作为 review checklist 做 fresh 静态审查：独立地验证模型→契约→generated→owner→frontend→oracle 的正向链，且验证退役字段的允许例外未扩展。
3. 对账不是“功能相似”检查。每一个组件与每一条设计要求必须逐维逐字核验：**行为、形态、动作、关系、位置、用户文案、限制、状态所有权、控件级联、失败与恢复、可访问/焦点、数据来源与失效边界**。任一维不一致即该行不能标 `IMPLEMENTED`，必须修改实现或明示 `NOT_APPLICABLE_WITH_REASON` 并由原条款允许。
4. 静态 review 必须含反例：删 required producer、删 owner summary、改单标签为两值、让 UI 推资格、删 action completion、删 no-change oracle、退化 fixture graph、把 fixture graph 的对象改成 runtime ambient 常量、将跨 scope 对象放到错误 owner、先停用后创建绑定、散写 testId、让 fixture 形态不含 Journey 所需页签、让恢复 case 要求未发生的 write reader，各自要对应真实会红的检查。
5. 任一文件对账、静态 review 或静态 gate 未通过，返回对应 F 族根因修复；禁止先跑测试获得新的随机首败。

### RCP-07 · 分层验证与受管动态执行

**RECALL**：`scripts/README.md`、managed runtime skill、AGENTS Testcontainers/DEV 联动、详设 CP-12。

1. 仅在 RCP-06 PASS 后运行静态生成链、compile/typecheck、focused、node static gate；失败先以 F1–F7 定位并修根因，再 fresh 重跑同一层。
2. 静态层全 PASS 后，根据已授权边界调用 `cs-managed-runtime-execution`，先执行 managed Testcontainers。若当前 manifest-owned DEV 存在，按强制联动 stop，记录 `DEV_WAS_RUNNING`；business 与 cleanup PASS 才恢复 DEV，失败不自动 start。
3. Testcontainers 必须 `discovered=selected=results=80`、business/cleanup 双 PASS，并给 migration/preflight、scenario operation、owner readback 证据。
4. Testcontainers PASS 后执行受管 browser L2：只激活本批 generated exact 24，独立 TEST namespace，24/24 PASS，双 testId 分母清零、event join 完整、local/remote cleanup readback PASS。任一失败保留首败并按 systematic debugging 做同族根因扫描，不摘 case、不降 oracle。
5. L2 PASS 后，按已授权且受管的 `reset → DEV start → seed` 顺序一次执行。start 不隐式 seed；seed 只走 P1+executor，分别保留 reset/start/seed 的 manifest、business 与 cleanup、单标签/十列/停用语义 readback。

## 4. 实施序列与闸门

```
RCP-00 facts freeze
  → RCP-01 model/contract/owner projection
  → RCP-02 P1 + generated-chain source
  → RCP-03 frontend state + consumer
  → RCP-04 testId/log/action evidence
  → RCP-05 acceptance/seed/L2 oracle
  → RCP-05A L2 framework/method/data single-chain reconciliation
  → RCP-06 document reconciliation + fresh static code review
  → RCP-07 static gates → Testcontainers → browser L2 → reset/start/seed
```

RCP-01 and RCP-02 may have source-only work in parallel after their exact ownership boundary is fixed; no generated output is written until their combined source self-tests pass. RCP-03–RCP-05 must consume those finalized declarations. Dynamic validation is last and may not become a discovery mechanism for missing design implementation.

## 5. 两轮独立计划审查

### PR-01 · 全面证伪审查

Fresh independent reviewer reads this plan, formal requirement/Journey/interaction/IA/design/serial plan, P1, owner reads, affected frontend, acceptance, seed and L2 runtime. It must identify: omitted problem families, incorrect current facts, duplicate fact homes, unsafe legacy deletion, missing explicit denominator, plan steps that could still lead to test-driven patching, and any unauthorized dynamic action. Reviewer records `M/S/N`, exact source evidence, and a smaller alternative if proposed.

Author then reopens every cited owning source and records `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`; only confirmed items amend this plan.

### PR-02 · 定向封口审查

A second fresh independent reviewer reads the amended plan and PR-01 intake, then tries to falsify the repaired plan using counterexamples: copy closure versus item singularity, generated source versus artifact, required versus optional decoder behavior, owner projection versus UI fallback, write failure versus no-change oracle, L2 progress/action join versus final result, and static/dynamic authorization order. It must verify every PR-01 confirmed finding has one exact prevention destination and no new product semantics.

After PR-02, author performs the same evidence-based intake and stops this review cycle. Dexter 的“若仍未通过可第三轮”授权在本仓两轮硬上限下不需要使用：本轮没有保留产品或实施计划缺口，唯一治理冲突已由作者删除。若未来出现新的已授权实质 scope，按其 scope 建立新的 review cycle；未决产品语义仍交 Dexter。

## 6. Completion evidence

The final implementation report must separately state `FIRST_FAILURE` (or `None`), `LAST_KNOWN_GOOD`, `BROKEN_BOUNDARY`, `BUSINESS`, and `CLEANUP`; include the source/generated exact-set outputs, document reconciliation table, static review verdict, static exit codes, Testcontainers 80/80 manifest, L2 readiness and 24/24 manifest with join sample, red mutation records, reset/start/seed manifests, seed readback, and any remaining UI/UAT evidence boundary. No static or focused proof may be described as browser L2, DEV, seed, or UAT proof.
