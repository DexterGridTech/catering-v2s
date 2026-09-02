# v2s 销售菜单 SM-06/SM-07 步骤级独立对账留痕

- 日期：2026-09-02
- `STEP_RECONCILIATION_ID=SM06-SM07-20260902`
- `REVIEW_TARGET=STEP_RECONCILIATION`
- 范围：SM-06 shared image primitive + operations-admin model/route；SM-07 单页 IA 与前端 focused/static closure。
- 性质：进入下一实施步骤前的步骤级三维对账输入与处置记录；不构成整批 `REVIEW_TARGET=IMPLEMENTATION`，不替代 Claude review，也不构成 browser L2、DEV、seed 或 UAT 证明。
- `REVIEW_ROUND_LIMIT=2`

## 输入

本步骤前后双读使用同一组原文与 owning source：

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/roadmap-program-registry.json` 与选定 Roadmap 授权字段
- `project-memory/index.md`、`project-memory/decisions/deterministic-context-only.md` 及 implementation / frontend / UI 路由命中原文
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuReadModel.ts`
- `apps/frontend/operations-admin/src/features/sales-menu/model/salesMenuModel.ts`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.test.tsx`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchNavigationTree.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemBasicEditor.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogConfigurationDrawerSurface.tsx`
- `apps/frontend/operations-admin/src/app/api/catalogNavigationTree.ts`
- `libraries/frontend/admin-ui-foundation`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemCategoryFacts.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogSalesMenuTaskReadTest.java`
- `contracts/openapi-source/sales-menu.schemas.json`

UI 复用核对是本步骤的明确输入：先读取 Catalog 工作台的分类树、Catalog 的 Drawer lifecycle/focus、现有 image editor 与 foundation API，再核对销售菜单是否接入这些现有能力；不以销售菜单为理由重新实现同一行为。

## 第一轮独立复核

- `REVIEW_ROUND=1`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `BLIND_REVIEW=true`
- reviewer：fresh 独立只读 verifier（Confucius，agent id 由会话协调记录保存）
- 动作：未修改源码、未运行 Git、未启动动态服务或浏览器；独立读取上面的需求、IA、详设、memory、owning source 与当前 proof。

独立 verifier 原始结论：

```text
STEP_RECONCILIATION=NO-GO
M/S/N=M2/S4/N1
OPEN_FINDINGS=SM06-M-01, SM07-M-02, SM07-S-01, SM07-S-02, SM07-S-03, SM06-SM07-S-04, SM06-SM07-N-01
ROUND_FINAL_DECISION=SELF_DECIDED
```

## Findings intake 与当前处置

以下是作者在重新打开 owning source 后对第一轮 findings 的处置，不是第二轮独立 verdict。

### SM06-M-01：候选选择缺少完整分类树

- 第一轮状态：`CONFIRMED`。
- 根因：候选 Drawer 之前只提供延迟候选查询与选择控件，没有已批准的左侧完整分类层级，不能证明空分类、嵌套分类与候选过滤的关系。
- 当前修复：销售菜单候选区域改为左侧完整 Catalog navigation `<Tree>` + 右侧服务端 cursor candidate table；使用 `getOperationsCatalogNavigationCategories` 的 generated read，不自动 drain 全量候选。
- 复用边界：新增的 `apps/frontend/operations-admin/src/app/api/catalogNavigationTree.ts` 只负责通用层级构造；`CatalogWorkbenchNavigationTree.tsx` 与 `SalesMenuPage.tsx` 共同复用它。Catalog 的 richer model/presentation 仍由 Catalog feature 持有，销售菜单没有直接 import Catalog feature model。
- 当前证据：`SalesMenuPage.test.tsx` 验证嵌套 child 与空分类保留；operations-admin typecheck、focused tests、architecture tests 均通过。
- 第二轮核验结果：独立 reviewer 认可共享 builder 复用；作者随后补齐纯循环分量作为确定性根节点，并由 `CatalogWorkbenchNavigationTree.test.tsx` 与销售菜单分类树测试覆盖孤儿/循环保留、排序和原有 Catalog 行为边界。`SM06-S-01` 的修复证据见第二轮处置。

### SM07-M-02：编辑 Drawer 生命周期未显式收敛

- 第一轮状态：`CONFIRMED`。
- 根因：编辑表单缺少与仓内既有 Catalog Drawer 相同的关闭、脏状态、提交锁、遮罩/Esc 与焦点恢复边界。
- 当前修复：销售菜单 item editor、create、rename、schedule 均使用 `useDrawerFormLifecycle`；提交期间显式锁定 mask/keyboard/closable 与取消；脏表单关闭交给 lifecycle；打开后的触发控件焦点通过既有恢复模式处理。状态/确认 Modal 在 busy 时同样锁定关闭入口。
- 复用依据：模式对照 `CatalogItemCreateDrawer.tsx`、`CatalogConfigurationDrawerSurface.tsx`、`useCatalogItemEditorWorkspaceState.tsx`；image end 使用 foundation `AdminImageCollectionEditor`，没有在 app 内复制 image/overlay primitive。
- 当前证据：`SalesMenuPage.static.test.ts` 对四类 Drawer/Modal 的生命周期锚点、锁定和焦点恢复做分段断言；focused tests、typecheck、format、architecture 均通过。
- 第二轮核验结果：`SM07-S-01` 被独立 reviewer 确认为真实缺口；作者已将候选 Drawer 也接入同一 `useDrawerFormLifecycle`，补齐 dirty、提交锁、mask/Esc/closable 锁、成功关闭和触发控件焦点恢复，并重跑 focused/static/typecheck。

### SM07-S-01：UI denominator 只有宽泛 source anchor

- 第一轮状态：`CONFIRMED`。
- 根因：原静态 test 的 UI trace 主要使用整页 `toContain`，同名文本或移动到错误组件仍可能通过，不能逐点证明批准 IA 的行为形态。
- 当前修复：`SalesMenuPage.static.test.ts` 将 31 个 UI trace 绑定到实际 component/function segment，逐点检查 exact controls、columns、actions、candidate tree selection/cursor reset、page-20/page-21 navigation、hidden selection 与 lifecycle；新增真实 `salesMenuCategoryTreeData` 行为测试，验证 child nesting 与 empty category。
- 当前证据：operations-admin focused unit suite 为 35 files/205 tests PASS；architecture test PASS（40 pass、4 TODO、0 fail）。
- 第二轮核验结果：独立 reviewer 仍要求逐点分母证据；作者将静态 trace 锚点修正为实际 component/function 片段，补充选择/隐藏选择、candidate lifecycle、分类树 cycle/orphan 与默认价行为测试，并以当前 `35 files/208 tests` 和 `scripts/verify --validate-only` 复核。

### SM07-S-02：渠道判断曾回退到 name

- 第一轮状态：`CONFIRMED`，已修复。
- 根因：以渠道名称推断 `DINE_IN`/`TAKEAWAY` 会把未知 code 的同名对象错误纳入销售菜单。
- 当前修复：`isSalesMenuChannel` 只接受显式 generated `channelCode`；测试加入 unsupported code + `堂食` name 的反例并断言为 false。
- 第二轮核验结果：独立 reviewer 未发现其他 name fallback；当前 model 测试保留 unsupported code + 同名中文文案反例。

### SM07-S-03：weighted 约束下界为 0

- 第一轮状态：`CONFIRMED`，已修复。
- 根因：起售量与倍数输入允许零，不符合批准的正数约束。
- 当前修复：两个 weighted numeric controls 均使用 `min={1}`，并由静态 test 计数核对两处。
- 第二轮核验结果：独立 reviewer 未发现 weighted 约束回归；当前 owner 仍从 Catalog 结构化 fact 读取 salesUnit，前端未增加 unit 输入或请求字段。

### SM06-SM07-S-04：生成链证据未形成当前步骤完整留痕

- 第一轮状态：`PARTIALLY_CONFIRMED`。
- 当前处置：候选 contract 的 `categoryNames`、`defaultPriceCents` 已在 source schema、Catalog owner API/readback、wire mapper、generated Java/TypeScript 与测试中同步；materialize/codegen/binding checks 已通过，operations-admin typecheck 已通过。
- 证据边界：本步骤后端 focused read test 已通过受管 remote Testcontainers；该步骤没有新增运行产物 digest manifest，因此第二轮只判定现有 generator/check 输出能否证明当前生成物来自 owning source，不把作者陈述视为 digest 证据。作者后续重新执行了 materialize、edge codegen、operation binding `--check`，并把输出写入本次收口证据。

### SM06-SM07-N-01：上一轮 verifier artifact 不可定位

- 第一轮状态：`UNVERIFIED_REQUIRES_EVIDENCE`。
- 当前核查：在当前仓库 `doc/review/platform`、`doc/evidence/platform` 与相关 `rg --files` 结果中，没有找到第一轮提及的 Boyle artifact/path；不虚构文件名或路径，也不将缺失 artifact 解释为源码已通过。
- 当前处置：本文件保留第一轮原始 verdict、finding、输入清单和当前证据边界，作为可复查的 durable context；第二轮 verifier 需独立判断这是否足以关闭历史 artifact 缺口，或将其保留为 `OPEN`。

## 第二轮独立复核

- `REVIEW_ROUND=2`
- `REVIEW_ROUND_LIMIT=2`
- `REVIEW_TARGET=STEP_RECONCILIATION`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `BLIND_REVIEW=true`
- reviewer：Zeno，fresh 独立只读 verifier；第二轮为本步骤最终独立轮次，不再召集第三轮。
- 输入：与第一轮相同的需求/IA/详设/memory/owning source/proof 清单，以及第一轮处置后的当前源码。

独立 verifier 的完成 payload（由当前会话协调记录接收并逐字转录；仓内没有另存的 raw agent 文件）为：

```text
STEP_RECONCILIATION_ID=SM06-SM07-20260902
STEP_RECONCILIATION=NO-GO
M/S/N=1/3/1
REVIEW_TARGET=STEP_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
BLIND_REVIEW=true
ROUND_FINAL_DECISION=SELF_DECIDED
```

第二轮确认的输入 findings：

- `SM07-M-01`：静态门仍命中操作列字面量；原因是静态 test 中保留了 gate 禁止的 exact source literal，而非产品要求错误。作者改为 generated-independent 的运行时常量与测试构造，不删除用户可见“操作”列。
- `SM07-S-01`：候选 Drawer 仍缺 shared lifecycle；作者已补齐并在当前 focused/static 中验证。
- `SM07-S-02`：UI denominator 仍需行为级证据；作者补齐实际分段锚点、选择/分页/生命周期/边界测试。
- `SM06-S-01`：分类树纯 cycle/orphan 边界需保留；作者修复 builder 并补 test。
- `SM06-SM07-N-01`：上一轮 raw artifact 不可由仓内路径定位；作者不虚构路径，保留该事实并将其作为本次 provenance 的证据边界。

以上是**修复前的独立第二轮 verdict**，不等于修复后的状态。

## 第二轮后作者处置与步骤收口

作者重新打开上述 findings 的 owning source 后完成以下最小修复，并以当前字节复核：

1. 操作列继续保持产品需要的“操作”用户可见文案，但生产代码统一消费 `SALES_MENU_OPERATION_COLUMN_TITLE`，授权与 operation identity 统一消费 generated constants；静态测试不再以禁止的 exact literal 触发架构门。
2. 候选 Drawer 不再由父层提前关闭；成功/失败、dirty、提交锁、mask/Esc/closable 与焦点恢复均由 foundation lifecycle 负责。
3. 销售菜单与 Catalog 工作台共同复用 `buildCatalogNavigationCategoryTree`；纯循环分量不丢失，孤儿节点保持确定性根节点；销售菜单不 import Catalog feature 私有 UI/model。
4. 草稿/详情/称重单位/编辑器的名称+编码呈现统一复用 foundation `NameCodeText`，不在销售菜单重复实现 name/code 展示。
5. 候选 `categoryNames` 与 `defaultPriceCents` 沿 Catalog owner scoped readback → source contract → generated wire → SalesMenu owner readback → operations-admin UI 同步，未新增菜单数据模型或 unit 写入语义。

当前复核结果：

```text
R5_EDGE_MATERIALIZE_CHECK=PASS
R5_EDGE_CODEGEN_CHECK=PASS (FILES=361)
BP_U02_BINDING_CHECK=PASS (FILES=30)
NAME_CODE_DENSITY=PASS
OPERATIONS_ADMIN_FOCUSED=PASS (35 files, 208 tests)
OPERATIONS_ADMIN_TYPECHECK=PASS
OPERATIONS_ADMIN_ARCHITECTURE=PASS (40 pass, 0 fail, 4 TODO)
FORMAT=PASS
BACKEND_COMPILE_AND_PMD=PASS
R5_VERIFY_VALIDATE_ONLY=PASS (EXECUTED=18/18)
```

步骤收口采用现有两轮上限下的 `SELF_DECIDED` 规则：

```text
INDEPENDENT_ROUND_2_VERDICT=NO-GO_BEFORE_REPAIR
AUTHOR_POST_REPAIR_RECONCILIATION=PASS
AUTHOR_POST_REPAIR_M/S/N=0/0/0
STEP_RECONCILIATION=PASS
ROUND_FINAL_DECISION=SELF_DECIDED
ROUND_3=FORBIDDEN_BY_REVIEW_ROUND_LIMIT
```

`SM06-SM07-N-01` 的关闭含义仅为：缺失 raw agent 文件已被明确记录为 provenance/evidence boundary，当前步骤不以虚构 raw 文件作为证明；它不把该缺失转述为生产行为已动态验证。第二轮独立 payload 与作者修复后的当前 proof 仍然是两个分开的证据层。

## 当前可复核证据

### 前端静态/编译/聚焦

以下结果均来自当前字节，且不包含浏览器、DEV 或 seed 结论：

```text
yarn test:architecture                         PASS (40 pass, 0 fail, 4 TODO)
yarn typecheck                                 PASS (operations-admin)
yarn test:unit <SM06/SM07 focused set>         PASS (35 files, 208 tests)
yarn format:check                              PASS
node scripts/check/name-code-density.mjs       PASS
scripts/verify --validate-only                 PASS (18/18)
```

focused set 包含 `salesMenuModel.test.ts`、`SalesMenuPage.test.tsx`、`SalesMenuPage.static.test.ts` 与 `CatalogWorkbenchNavigationTree.test.tsx`。

### 后端与生成链

- Catalog scoped category/default-price readback 的准确模块测试经受管 remote Testcontainers 运行通过：`CatalogSalesMenuTaskReadTest`；业务场景不适用，但容器/卷 cleanup PASS。
- 当前步骤相关生成链已执行 owning source → materialize → edge codegen → operation binding；`--check` 与 compile/typecheck 结果已通过。
- 三次受管 calibration run 已形成 `268/268` exact operation projection，业务/cleanup 均 PASS；该证据用于关闭前置 `BUDGET_PROJECTION_OPERATION_MISSING`，不替代 SM06/SM07 browser L2。

### 未证明边界

本步骤当前仍未证明：

- operations-admin 在真实浏览器中的用户可见 SM-06/SM-07 行为；
- SM-08 runner、SM-09 browser L2、DEV lifecycle、reset/seed；
- 全批 acceptance、CP-05 normal projection、全批三维对账与正式 `REVIEW_TARGET=IMPLEMENTATION`；
- 生产 owner 逻辑的完整真实 HTTP 行为超出本步骤已运行的 scoped Catalog read test。

因此本文件记录的是：第二轮独立 verifier 在修复前给出 `NO-GO`，作者依据同一组原文逐项修复并完成当前 proof 后，以 `SELF_DECIDED` 规则收口为步骤 `PASS`。这只允许进入 SM-08 的实施，不构成 browser L2、DEV、seed 或 UAT 证明。
