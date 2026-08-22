# 商品库存与 BOM 优化 · Codex 实施指令说明

```text
INSTRUCTION_KIND=SELF_IMPLEMENTATION_DISPATCH
INSTRUCTION_STATUS=READY_PENDING_EXPLICIT_IMPLEMENTATION_AUTHORITY
REVIEW_TARGET=IMPLEMENTATION
DESIGN_VERDICT=CLAUDE_GO_M0_S2_N2_TEXT_FINDINGS_REMEDIATED
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=false
SEED_EXECUTION_AUTHORITY=false
GIT_AUTHORITY=Dexter
SERIAL_PLAN=doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md
```

## 0 · 这份指令的用途

这是一份给当前 Codex 实施会话自己的派活说明，不是实现结果，也不自动打开实现授权。详设已经获得 Claude `GO`，但该专题串行计划仍明确 `IMPLEMENTATION_AUTHORITY=false`；只有 Dexter 的新明确指派才可以把本指令从“准备好”切换为“开始实施”。在切换前不得修改业务代码、contract/generated、migration、test、seed source，不得运行测试、DEV、reset、start、seed、browser L2、UAT 或部署。

本指令的业务目标是：把商品库存与 BOM 从三个互不闭合的 flat payload 收束为 contract 约定、catalog 重派生合法 owner、inventory 原子拥有扣减定义的单一模型；七种 shape、三类节点和三种扣减方式在 contract、catalog owner、inventory owner、operations-admin、acceptance 与 seed 中遵守同一矩阵。

用户真正要解决的是：运营人员在商品详情中只能看到与商品 shape 相符的库存/BOM 配置，不再面对“普通商品、SKU 商品、点单选项、原料、套餐/服务/权益”混在同一张卡片里的错误选择；保存后的 readback、库存消费与历史事实必须仍由 owner 统一解释。

Dexter 的阶段意图是一次性完成一个内部串行交付，CP 只是依赖顺序和证据门，不是按模块拆开的业务交付。相比保留旧 flat payload、fallback 或双写兼容层，本指令采用 contract 先定 shape、owner 再校验、旧住址删除的方案，因为已接受需求明确要求消灭第三真相、单位漂移和伪准入；不为未批准的未来语义预留复杂兼容层。

## 1 · 正式输入与阅读顺序

开始实际实施前，按下列顺序完整读取；不得用本指令、聊天摘要、旧 review 或端口状态代替原文：

1. `AGENTS.md`、`PLATFORM-BLUEPRINT.md`。
2. `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json`、所选 program 的 Roadmap 授权字段，以及 `scripts/README.md`。
3. `project-memory/index.md` 全部 kernel；再按本节的三条六维 route 执行 `scripts/context/recall-memory`，逐份重开返回的 repository-relative memory 与每个 `sourceRefs`。
4. `project-memory/decisions/deterministic-context-only.md` 对应原文，以及 memory 路由命中的 owner、事务、集合形态、acceptance、frontend capability、cache invalidation、日志与 managed runtime 约束。
5. 正式需求：`doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`。
6. Journey：`doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-journey.md`。
7. 交互与线框：`doc/decisions/2026-08-22-v2s-catalog-inventory-bom-configuration-ui-interaction.md`、`doc/plans/platform/wireframes/2026-08-22-v2s-catalog-inventory-bom-configuration.svg`。
8. IA：`doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-information-architecture-codex.md`。
9. implementation-facing design：`doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-implementation-design-codex.md`。
10. 串行计划：`doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md`。
11. review 与 intake：`doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-claude.md`、`doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-review-intake-codex.md`。
12. 实施纪律正本：`doc/platform/implementation-task-template.md`；backend acceptance 主动规范：`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`；backend/frontend coding standard。

### 1.1 六维 memory route

当前专题跨 backend、contract、admin-ui 三个 implementation surface；不得把一个 route 的命中误称为全部 memory。实施会话至少执行以下三条 route，并记录每条 route 的 JSON、命中 path、`sourceRefs` 与文件 SHA-256：

```sh
scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face operations-admin --owner backend --impact database --trigger implementation
scripts/context/recall-memory --task-kind implementation --domain contract --consumer-face operations-admin --owner contract --impact contract --trigger implementation
scripts/context/recall-memory --task-kind implementation --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact session --trigger implementation
```

每一个实际变更点还必须使用 provider-free code recall：

```sh
scripts/context/recall-code --query '<当前变更点的精确符号或字符串>'
```

search 输出只是 locator；必须打开真实 owning source，并在可用时用编译器/LSP确认。每个点写入前后都要重开同一组 IA/原始业务条目、memory、owning source、详设约束和可复用先例，形成前读与 focused proof 后读；缺任何一项不得宣称该点闭合。

## 2 · 实施派活话术正本

以下代码块逐字复制自 `doc/platform/implementation-task-template.md` 的“实施派活话术 · 正本”。不得改写、重排、摘录；本文件后面的内容只是本批附加范围，不替代这段正本。

```text
每进入一项之前:按该项 RECALL 走一遍。字段为空 ⇒ 停下来问。
⚠️ 走完 RECALL 是你拥有自主权的前提 —— 没走完,下面的自主权不成立。

━━ 你可以自行决定的 ━━
在**不变量全部满足**且**不违反 FORBID** 的前提下,**实现形态由你定**。
工单给的是「必须同时满足什么」,不是「必须怎么写」。
发现更好的写法就直接用,不必回来问 —— 只需在报告里**登记一行理由**:
「我选了 X 而不是 Y,因为 Z」。

━━ 必须停的四类(只有这四类)━━
1. 不变量之间**互相冲突** —— 满足这条就违反那条
2. 不变量**说不清** —— 失败条件写不出来
3. 不变量**与源码不符** —— 工单说的前提在代码里不成立
4. 满足不变量**必须动 FORBID 的东西**

⚠️ 第 2–4 类里,上游(详设 · 评审 finding · 我给的分母与数字 · 任何"权威"结论)
   都是**待验证输入**。⛔ 不因为它来自设计方或评审方就采信;**以源码为准**。

停的时候不要做这四件事:
  自己选一个"合理的"做法**绕过不变量** · 加兼容层 / fallback / TODO 绕过 ·
  缩小范围报完成 · 改业务行为去迎合门。
报告给三样:你看到的原文事实 · 两种候选理解 · 你倾向哪个及为什么。
只说"卡住了"会多走一个来回。

━━ 完成之后 ━━
1. 用 RECALL 里那份原文逐项回读:做出来的,和它写的是同一件事吗?
2. 跑相关编译与门,贴真实输出。不接受「预期会绿」。
   ⚠️ 注意解释器:scripts/check/ 下有 bash 也有 node,按 shebang 选,判红绿用退出码。
3. 声明证据档位:编译 / 静态门 / 容器 / 浏览器。⛔ 低档不得说成高档。
4. 报告里出现「全仓 / 唯一 / 零 / 只有」时,先跑搜索,把条数写进句子。
   写不出条数,就不许用这些词。
5. **凡自行决定的形态,逐条登记理由**(一行即可)。
```

## 3 · 批次范围：CP-00 至 CP-08

按 `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-serial-plan.md` 的唯一串行路径执行，不并行跨越依赖，不把 CP 拆成独立业务交付：

| 顺序 | 批次 | 主要 owning source / owner | 必须同时闭合的事实 | 当前动作边界 |
|---|---|---|---|---|
| 1 | CP-00 | P1 generator、acceptance scenario source/catalog、owner API/service、coordinator、Drawer | 现取 operation、token、scenario、非法 fixture、legacy payload、consumer 分母；实际 discovery 必须证明 `annotated == discovered == selected` | 获授权实施后才运行；当前不执行 |
| 2 | CP-01 | `scripts/generate/catalog-inventory-p1.mjs` 及 tokens、M1/bindings、P3 generator | P1 → tokens → M1/bindings → P3 的 contract/generated 闭合；新 candidate GET、57 operations、37 commands；不手改 generated | 只改唯一生成源及 executor/source tests |
| 3 | CP-02 | inventory migration、`InventoryOwnerApi`、`InventoryOwnerService`、candidate query | additive migration、active/history definition、锁、owner recheck、A-05、BOM 五条件、单位快照与 cursor shape | 不跨 schema 读 catalog；不重解释余额/流水 |
| 4 | CP-03 | `CatalogOwnerService`、`CatalogInventoryCoordinator`、catalog API | shape×node×mode 由 catalog 服务端重派生；whole-save 在同一 `REQUIRED` 事务内最多一次 inventory replace | 不恢复三次补偿写，不让前端成为准入真相 |
| 5 | CP-04 | `CatalogItemDrawer.tsx`、新 workbench/hook、foundation、generated RTK | 普通/称重/MATERIAL 直接详情；SKU_VARIANT 左树右详情；OPTION_VALUE 仅组件耗用；前端不发明准入 | 不建独立详情页，不复制 foundation |
| 6 | CP-05 | `CatalogAcceptanceScenarios.java`、显式 scenario catalog、runner | 基线 77 → 新增 3 → 80；63 矩阵、A-05 八 case、组件六 red、option 三分支、单位精度和 no-write | 不删断言、不改分母、不恢复非法普通/称重 SKU |
| 7 | CP-06 | P1 `catalogDefinitionSeed`/`seedDatasets`、`catalog-inventory-seed-executor.mjs`、seed static tests | 七 shape、三 mode、SKU 各自 BOM、选项正负、公共组件、盘点有/无、单位历史、丰富 readback | 不手改 generated fixture；当前不执行 seed |
| 8 | CP-07 | generator checks、owner focused tests、compile/typecheck、Node health runner、静态全链 | 保留 first failure；按退出码闭合所有静态/focused 门；静态 cleanup 为 `NOT_APPLICABLE_STATIC_ONLY` | 未全绿不得进入动态 |
| 9 | CP-08 | 受管 Testcontainers、DEV、reset/seed、browser L2 | 每项另有 Dexter 明确授权；manifest、日志、business 与 cleanup 分开 | 当前不授权、不执行 |

### 3.0 关键 owning source 精确路径

实施时使用下列精确路径；类名、文件名或浏览器 URL 不能替代 owning source path：

| 面 | 精确路径 |
|---|---|
| P1 contract/seed source | `scripts/generate/catalog-inventory-p1.mjs` |
| seed executor/plan | `scripts/dev/catalog-inventory-seed-executor.mjs`、`scripts/dev/catalog-inventory-seed-plan.mjs` |
| catalog owner/coordinator/API | `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`、`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`、`apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` |
| inventory owner/API | `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`、`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java` |
| operations-admin | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`；新 workbench/hook 必须落在同一 feature 目录并使用稳定 capability 名称 |
| acceptance/catalog | `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`、`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java` |

### 3.1 CP-01 生成链顺序

实施期先按当前源码和 `scripts/README.md` 现取命令参数，再按以下依赖顺序执行；不得从旧输出猜 expected：

```text
catalog-inventory-p1.mjs
  → catalog-inventory-workspace-command-tokens.mjs
  → backend-performance-m1-command-execution-bindings.mjs
  → operation-handler-bindings.mjs
  → catalog-inventory-p3-frontend.mjs
```

每个 generator 必须同步 expected、check、self-test 与真实 red mutation；生成输出只能由源重新生成。`--check`、`--self-test` 的解释器按 shebang 选择，红绿按退出码判定。

### 3.2 backend acceptance 三个新增场景

所有新增/修改 HTTP operation 的 acceptance 设计必须满足主动规范的 `identity`、`fixture`、`request`、`businessOracle` 四项非空，并落在 `CatalogAcceptanceScenarios.java`，由 `BackendAcceptanceScenarioCatalog` 显式发现；focused/full runner 以仓内当前 `scripts/test/backend-acceptance` 为准。

| scenario | identity | fixture | request | businessOracle |
|---|---|---|---|---|
| `catalog.inventory-rule-admission-matrix` | 受 scope 约束的 catalog item 与 owner identity | 合法/非法的 63 个 shape×node×mode case，普通/称重商品不带 SKU | 真实 catalog whole-save request，包含合法和篡改 owner input | 断言 typed problem、catalog version、inventory definition/status/version、owner tree 与失败后的 no-write；不以 HTTP status alone 作为业务真值 |
| `catalog.inventory-component-option-and-unit-semantics` | item/SKU/option value 与 component target 的真实 owner refs | 五条件逐条 red case、option 加珍珠/换燕麦奶正负行、actual quantity、盘点有/无、0.3567kg | 真实候选读取、whole-save、option value save/readback | 断言 scope/usable/BOM_COMPONENT/StockTarget/单位完整/self 条件、正负 actual quantity、源/目标 precision、向零截断、readback 与历史快照不重解释 |
| `catalog.inventory-mode-switch-guard` | 单一商品 owner definition 与命令前历史状态 | balance、ledger、BOM reference、pre-existing DISABLED definition 四维八 case | 真实首次切换与第二次反向切换 request | 断言首次切换允许、第二次 typed problem `INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED`、`blockingFacts`、catalog/inventory version no-write 与 transaction boundary |

完整 acceptance 运行前必须先通过 CP-00/CP-05 的 discovery 对账；不得把静态注解计数、单文件 node test 或 seed readback 冒充全量 acceptance。

## 4 · 不变量与 FORBID

以下是执行中不可自行改变的业务边界；若与真实源码、契约或迁移事实冲突，按 canonical 话术停机，不自行补语义：

- 商品销售单位单值，基础计量单位单值；SKU 可覆盖或清除覆盖并继承商品默认。
- 原料可无销售单位，但必须有基础计量单位才能作为 BOM/StockTarget 消耗对象。
- 库存消费单位来自商品/SKU 基础计量单位快照；`measureMode` 只表达计量方式。
- 盘点单位只用于录入换算，不改变余额消费单位；无盘点单位时源单位就是消费单位。
- 源数量按源单位 precision 截断，结果按目标消耗单位 precision 截断；precision 为 0 表示整数；向零截断，不四舍五入。
- 单位库最多 99 个；被引用单位不可删除但可停用；历史引用保留快照；被引用后仅名称可改。
- U-UNIT-DESIGN-01 采用已裁定的安全守卫；U-UNIT-DESIGN-02 采用源/目标单位 precision 规则；不得重新发明语义。
- 普通销售/称重商品不建立 SKU；SKU 只存在于合法 SKU shape；不要误伤商品标签、SKU 销售属性、点单选项。
- 直接扣本品、按 BOM 扣组件、不参与库存的准入只看已批准的 shape×node×mode 矩阵；usage capability 不直接决定扣本品准入。
- 删除 `salesUnitRefs`、`SALES_UNIT` item reference、自由 counting/consumption unit 字符串、`measureMode` 作为消费单位，以及旧 flat payload/fallback；不保留双写兼容层。

禁止：手改 generated 文件；跨 schema 读 catalog 或由 read edge 推导写入/锁/事务/FK；前端单独实现准入；静默同步会重解释历史余额的单位；销售链路未经另行契约裁定引入 kg↔g 销售换算；生产配方、采购/WMS、任意单位两两换算引擎、库存专用单位库、新详情面、默认账号或外部依赖。

## 5 · 四类停机的本批实例

除 canonical 话术的四类停机外，本专题遇到以下事实必须原地停机并报告原文事实、两种候选理解、推荐及理由：

1. 详设矩阵与当前 contract enum、migration 现存数据或真实 owner 分支不一致。
2. 普通/称重商品出现 SKU，或普通商品与 SKU 级 target/BOM 同时存在，且无法按已批准迁移形态安全处置。
3. inventory 无法在同一 public command/事务内完成锁、校验、替换和 readback；或 catalog save 与 inventory owner 事实出现不可解释的版本差异。
4. 发现新的历史定义事实源，与 A-05 的 command-start pre-existing `DISABLED` 事实不可兼容。
5. 静态注解、discovery、selected、场景 identity/fixture/request/oracle 或 operation exact-set 的实际分母与设计不一致。
6. 解决问题需要 fallback、兼容层、旧 API 双写、静默历史重解释，或需要新增产品/Journey 语义。
7. 任务需要改变标签、SKU 销售属性、点单选项原有 owner，而详设没有授权。
8. 需要 reset、seed、DEV、Testcontainers、browser L2、UAT、部署或数据操作而本 instruction 没有对应 Dexter 明确授权。

## 6 · 证据与进度报告

每个实际变更点都要保留：

- 写前 RECALL：需求/IA/详设条目、memory 路径与 hash、owning source、可复用先例、当前分母；
- focused proof：真实命令、退出码、stdout/stderr 或结构化日志路径；
- 写后回读：同一组原文与源码对照，说明实现是同一事实而非止血；
- 形态理由：凡选择了实现形态，登记“我选了 X 而不是 Y，因为 Z”；
- 失败链：first failure、last known good、broken boundary、business 结果、cleanup 结果；
- evidence level：编译、静态门、focused test、Testcontainers、DEV、browser L2、UAT 分开，不越级表述。

持续任务按 `AGENTS.md` 的六行格式每 60 秒汇报；动态受管运行超过 30 秒每 30 秒汇报。任何首败先保留日志，第二次同 signal 前调用 `cs-systematic-debugging`，检查 runner、PID/container、manifest、日志与源码边界；禁止增加 timeout、盲重试、按端口杀进程或用 magic wait 止血。

静态阶段必须用退出码判断；`scripts/verify --validate-only` 只能作为静态验证，cleanup 写 `NOT_APPLICABLE_STATIC_ONLY`。动态阶段只有受管入口可执行，并必须分别得到 business PASS 与 cleanup PASS；业务 PASS 不覆盖 cleanup FAIL。

## 7 · 完成、review 与交接

本批实现完成的必要条件是：

1. CP-00 至 CP-07 依序闭合，P1/generated、migration、inventory owner、catalog coordinator、operations-admin、acceptance、seed source/executor 的静态链一致。
2. 相关 compile/typecheck/focused tests/Node health/static full chain 真实 exit=0；分母、discovery、selected、legacy sibling search 都有实际输出。
3. 不把任何静态或 focused 证据写成 Testcontainers、DEV、browser L2、UAT 或部署证据。
4. 之后新开 `REVIEW_TARGET=IMPLEMENTATION` cycle，由 fresh independent subagent 重新打开真实生产源码、测试/运行 evidence 和用户行为；详设 GO 或“按设计实现”不能替代 implementation review。相同 IMPLEMENTATION cycle 最多两轮，不用换文件名、换 reviewer 或局部修订制造第三轮。
5. implementation review 后按 `doc/platform/claude-review-handoff-template.md` 与 `project-memory/operations/claude-review-handoff-standard.md` 生成可复制中文 brief，给 Dexter 与 Claude review；不得只给链接，不得把审查前状态写成最终 GO。

完成报告必须列出实际变更文件、删除的旧路径、保留的业务边界、真实命令及 exit code、证据档位、business/cleanup、未验证项与下一授权点。不要执行 Git 操作，也不要把 Git 状态当成完成条件。

**当前自检结论**：本文件已按 `cs-writing-plans` 的实施派活正本和 `cs-spec-to-plan` 的 source-first/owner/transaction/evidence 要求编写；本文件自身不执行实施。下一步只有在 Dexter 明确授权 implementation 后，才从 CP-00 重新读取现场分母并开始。
