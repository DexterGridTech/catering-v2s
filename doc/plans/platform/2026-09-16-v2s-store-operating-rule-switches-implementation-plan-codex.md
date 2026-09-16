# 门店经营规则开关 · 实施计划

STATUS=IMPLEMENTATION_IN_PROGRESS
DESIGN_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-implementation-design-codex.md  
REQUIREMENTS_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md  
MAPPING_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md  
IMPLEMENTATION_AUTHORITY=true
EXECUTION_THIS_TURN=AUTHORIZED

## 0. 执行规则

P0 到 P9 是一个原子批次的内部顺序，不是可被拆成独立交付/授权的子项目。每个 P 写入前，实施者须重开需求、详设、Journey、交互、IA、六维 memory、前后端规范和 owning source；写入后用同一材料回读，并由 fresh 独立只读 reviewer 做“需求 + 详设/IA + memory”三维对账。结果只能 MATCHED 或 OPEN；OPEN 必须先根因修复并复查。

本计划已获 Dexter 授权执行 source modification、generator、build、test、backend acceptance、reset、DEV、seed；browser L2、UAT、deploy 仍不在授权内。命令结果必须以实际日志、业务断言和 cleanup 结果报告，不得以计划文字代替证据。

## P0 · 施工前重新确认分母、权限和输入

**写入范围：无。**

1. 重读当前 requirement、Journey、interaction、IA、详设和 mapping source hash；确认 12 项/两根/四层、STRING 空串默认、R-10.6 四实体范围、显式 Store-target operating-rule 读取口径、视觉确认状态。
2. 用 registry 当前字节重算新增 Store-target read 后的分母；预期为 270 = 89 STORE target possible + 181 non-store，且 89 = 34 READ + 3 PREFLIGHT + 52 MUTATION；如果任一数字变，先重建 mapping，再继续。
3. 打开每条 52 row 的 adapter、真实 path component、target resolver 和 owner command，记录“目标在何处成为 STORE”。不得把 registry owner 名当作 target 类型证据。
4. 重新核实 Store role 不能获得 BC-ORG-STORE-EDIT 的 role create、role update 和任何生成/import 赋权路径；若发现第三路径，停止并回设计。
5. 验证 collaboration 的外部 provider catalog 仍不提供供 Store 选择的 developer/ISV identity；若当前字节出现权威实体，回 Dexter 决定 STRING 是否改候选。

**完成判据：** P0 产生 current-source reconciliation note；明确新 Store-target read operation 与 52 条 mutation 分母，且没有把旧 PROJECT-target detail 当作规则事实。  
**独立对账：** current bytes 与每个 P 的 owning source 一致，才允许 P1。

## P1 · 单一 rule catalog 与生成链

**计划文件：**

- 新增 contracts/catalog/store-operating-rule-switches.json；
- 新增 contracts/catalog/store-operating-rule-switches.schema.json；
- 新增 scripts/generate/store-operating-rule-catalog.mjs 及其 focused test；
- 新增 generated OpenAPI component：contracts/openapi/components/organization/store-operating-rule-schemas.generated.json；
- 新增 generated Java catalog：modules/organization/.../domain/generated/StoreOperatingRuleCatalog.java；
- 新增 generated operations TS catalog：apps/frontend/operations-admin/src/app/api/generated/storeOperatingRuleCatalog.ts；
- 修改已有 generator entry/check wiring，使 catalog 先于 edge OpenAPI generation 校验。

**实现要求：**

1. 输入只含 key/label/type/default/parent/order；所有 12 个条目只写在这里一次。
2. generator 检查 duplicate、unknown parent、non-BOOLEAN parent、cycle、default/type mismatch、order duplicate，并按 `BOOLEAN`、`NUMBER`、`STRING` 三成员闭集在合法输入上生成固定排序、source hash 和无手写树的 evaluator。
3. --check 对 source、三个输出和 wire component 都 fail closed；未来 codegen 必须先跑它再跑 edge-codegen。
4. focused red mutation 至少涵盖缺 default、缺 parent、环、STRING parent 和 NUMBER 默认/值类型不匹配；同时有合法 input 正向生成，防止“永远失败的 checker”假绿。

**完成判据：** generated output 可重现，声明支持 `BOOLEAN`、`NUMBER`、`STRING` 三成员闭集；当前 12 项仍为 11 个 BOOLEAN、1 个 STRING、0 个 NUMBER；backend/operations evaluator 对同一 parent false/child true 和 parent true/child true 得到同一结果。  
**独立对账：** 树、标签、默认值、类型逐项与 requirement §3.1 相等；没有第二份 hand-written relation。

## P2 · Store schema、存储与 owner command

**计划文件：**

- 修改 contracts/openapi/components/organization/store.schemas.json 和 edge root ref；
- 修改 `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json`（含 `closure.v2sNativeCodeCount`、`closure.v2sNativeActiveTargetCount`、`closure.totalActiveTargetCount`）及活动 edge implementation catalog 的 `operationErrorAugmentations`，并通过既有 materializer 物化 operation closed set；
- 由既有 edge generator 更新对应 Java/TS generated wire；
- 新增 additive Flyway migration，命名为 V20260916_...__store_operating_rule_switches.sql；
- 修改 StorePersistence、StoreServiceSql、StoreService、OperationsStoreCommandApi、Store readback/persistence record 及直接 unit tests；
- 修改既有 Store controller/edge adapter 仅以 generated request/response 接线。

**实现要求：**

1. Store response 和 Create/Update request 使用 generated fixed-key values component：component 的 `required` 恰为 12 key，故 values object 一旦出现即由 schema/binding 拒绝 unknown/missing key/type，并返回既有 contract validation 400；Update request 还必须 `required` operatingRuleSwitches，是 whole configuration save；Create omission 由 owner default 为 empty object，seed 的非默认值必须显式完整 map。通过 schema 的请求若仍违反 owner 语义/声明不变量，才映射到 `ORGANIZATION_STORE_OPERATING_RULES_INVALID`（422）。
2. DB 仅新增 organization.store.operating_rule_switches JSONB object column，default empty object；没有 index、backfill、secondary table 或跨 owner write。
3. StoreService 在既有 REQUIRED transaction 内做 validation → content-derived idempotency canonicalization → insert/CAS update → extension replacement → audit candidate → authoritative readback；保留 current scope/grant/relationship/definition revision order。
4. Store owner readback 返回 resolved complete map；历史 empty map 使用 catalog defaults，不在 DB 读取时偷偷写回。
5. 新增/调整 test 覆盖 create/update/readback、CAS、schema 层 unknown/missing/type 的 400、owner 层语义不变量的 422、parent false child true retained、default resolution 与 content idempotency。
6. 在 disposition catalog 登记 422/403 metadata；在活动 edge catalog 的 `operationErrorAugmentations` 仅为 create/update Store 添加 422、为 mapping 52 mutation 添加 403，并用 `r5-edge-materialize.mjs` 后再由 edge-codegen 生成 54 operation 的 x-error-codes/typed error outputs；同步 closure 计数为 `79/79/157` 并做计数复核；不得手改派生产物。

**完成判据：** Store command 的所有原有保护仍在，且 rule 保存是同一 CAS 原子组而非第二 mutation；error disposition closure 的三个字段实测并复核为 `v2sNativeCodeCount=79`、`v2sNativeActiveTargetCount=79`、`totalActiveTargetCount=157`。  
**独立对账：** P2 与详设 §3-4、IA-SOS-01 逐项 MATCHED。

## P3 · 审计的可辨别标量表示

**计划文件：**

- 修改 modules/audit-model 的 AuditChange、AuditChangeJson、AuditChangePolicy、相关 result reader 与其单元测试；
- 修改 contracts/openapi/components/common/common.schemas.json 及 edge generated types；
- 修改 organization 的 BusinessEntityValueSupport、四个 business-entity owner service、StoreService、OrganizationAuditHistoryService 的相关 audit mapping；
- 修改两个前端 audit-history Modal 与其 type/render tests。

**实现要求：**

1. 新 audit event 记录 fieldKey、fieldLabelSnapshot、before/after state 和可选 scalar；新状态只为 MISSING/NULL/CLEARED/VALUE，legacy 事件明确显示为未区分空值状态。
2. 一个 normalizer 用 canonical type value 和 Unicode code point 上限处理 2000 截断，追加“已截断”；业务 persistence 绝不因 audit display bound 失败。
3. AuditChangePolicy 接收静态 key 加此次 definition 得到的精确 dynamic key 集，禁止任意 prefix/bypass。
4. Brand/Tenant/HeadCompany/Store 都经同一 ExtensionAuditContext 产出 notes/extension diff；Store 另加 generated rules diff。每条 dynamic/change 都保存当前 label snapshot。
5. 两端 audit UI 的 label fallback 相同：snapshot → 既有固定 core map → 字段（key）。经营规则新事件总有 snapshot，platform-admin 不导入 operations generated rule catalog；两端在各自 feature 做 generated state 的穷尽 typed switch，并用同一组四状态 fixture 断言相同显示。不得继续以 value-or-dash 吞空串或新增规则 label map。

**完成判据：** R-10.1 至 R-10.12 有正反 fixture；旧 JSON 可读且不假装能区分历史空；definition 改名/删除后新的历史行仍显示事件时标签。  
**独立对账：** P3 与 requirement §7.2.1、IA-SOS-03、详设 §5 逐项 MATCHED。

P3 是一次共享审计契约变更，不是 Store 局部改动；完成前必须确认既有审计 JSON/行仍可读取，既有固定字段标签、历史分页与读取授权行为不变，四类实体既有审计生产者/读者没有回归。

## P4 · 52 条 STORE mutation 的后端 gate

**计划文件：**

- 新增 organization public gate/read API 与 focused tests；
- 修改 mapping 附录列出的 52 个 command adapter/operation entry；
- 修改活动 edge implementation catalog 的 52 条 `operationErrorAugmentations`、错误码 disposition catalog，并经 `r5-edge-materialize.mjs` 生成真实 OpenAPI path components 的 x-error-codes；再更新 generated EdgeProblemCode、ContractProblemAdvice、operations/platform feedback map；
- 新增/扩展适当的 owner and backend-acceptance scenarios。

**实现要求：**

1. 先保留每条 operation 的已有 grant/scope/target resolver；获得真实 STORE target 后、第一次 owner mutation 前调用唯一 gate。
2. gate 使用 organization Store owner current rule effective 值；Store read/parse failure fail closed；target 非 STORE return 原有路径。
3. gate 的单 Store owner read 必须使用显式 `readOnly` 事务边界，使每个合法连接借用都有对应事务事实；该只读事务结束后，资产 staging 才能进行对象存储 I/O，不能以外层事务包住 staging。
4. 专用规则聚合 GET 的 session、Store-target scope、organization detail/entity、规则 owner read 与 contract status read 必须在 controller 的单一 `readOnly` 请求事务中复用同一只读连接/快照；该边界不得覆盖 command 或资产对象存储 I/O。
5. READ 34 条和 PREFLIGHT 3 条不接 gate；mapping 的其余 181 non-store 行不接 gate。不得为了减少清单而在全局 HTTP filter 用 route-name 猜目标。
6. 新 403 capability code 逐条作为 52 个 operation 的 augmentation materialize 到 x-error-codes；Store create/update 的 422 是 P2 的独立两条 augmentation。两者均不能覆盖或取代原 owner lifecycle/capability/scope typed problems。
7. 每条 mapping row 写入 implementation reconciliation，含 exact adapter symbol、target resolution symbol、gate call symbol、path x-error-code；漏行即 OPEN。

**完成判据：** 52/52 mutation 无法由 UI 绕过；批量、三条复制、资产、库存、生产标签和 19 个销售菜单写入口均在 mapping 对账中。  
**独立对账：** P4 以 mapping 的全 270 行为分母，并与 requirement §6 R-9.2a-c 三维 MATCHED。

## P5 · operations UI、共同 empty surface 与 audit UI

**计划文件：**

- 修改 operations StoreEditDrawer、并新增 `apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts` 作为该 Drawer 和共享未开通 surface 的唯一 testId source；
- 新增 `apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx` 与其 renderer focused tests；该 app-local 领域 surface 由三个 feature host 共享，不允许从任一 feature 的私有 `ui/` 目录互相导入；
- 修改 catalog-management、inventory-management、sales-menu 三个 Store host；
- 修改 operations/platform audit-history Modal、generated state type 消费与两处平行 typed-render tests；
- 必要时修改 page refresh bindings，不新造 global rule store。

**实现要求：**

1. Drawer 增加单一“经营规则”分组，generated catalog 驱动顺序、缩进、form value、disabled parent semantics；保存沿用既有 lifecycle/expectedVersion/idempotency。
2. 在 `storeManagementTestIds.ts` 为 12 个动态规则控件、保存、取消和未开通 surface 的重试提供常量/稳定 key 函数；同时把 `StoreEditDrawer` 当前直接写入的可操作节点 testId 迁入该 source。每个 testId 挂到真实动作节点，禁用子项说明“请先开启上级功能”。
3. 三个 Store host 共用一个 business empty surface；scope missing、Store detail loading、Store detail failed、effective false、effective true 按 IA 优先级挂载。false/failed 时不 mount list/action subtree，不发 list request。
4. 三个 host 使用专用 `getOperationsOrganizationStoreOperatingRule` 显式 Store-target read，`storeId` 来自当前 `queryContext.scopeRef`；服务端以既有通用 `resolveTaskScope(session, STORE, storeId)` 复核 selected Store、selected Project 与 assignment path。context/scope switch 与 shell refresh 触发它重新读取，不能用 local/Redux mirror 或 stale data。
5. 两 app audit 模态按 P3 新 wire state/label 规则显示；不创建审计页面，不把 fieldKey 直接当成中文标签。

**完成判据：** UI 形态、关闭路径、失败留稿、shared surface、testId 和文案同 interaction/IA 一致。  
**独立对账：** P5 与 Journey、interaction §3-5、IA §1-4、frontend coding standard §3-K 逐项 MATCHED。

## P6 · 静态、focused 与真实 backend acceptance

**计划文件：**

- 扩展现有 generator/unit/frontend-focused/architecture tests；
- 在对应 *AcceptanceScenarios.java 扩展真实 HTTP scenarios；不把场景堆回入口类；
- 增加 52 行 mapping completeness test/reader，仅在有可证明 red mutation 时接入既有 minutes-level verifier。

**未来验证要求：**

1. Catalog generator invalid/valid cases；Store owner command/cas/idempotency cases；Audit four-empty/truncation/dynamic-label cases。
2. 每种 gate target 解析形态有 HTTP direct-call negative；同一 Store 开启后有 positive counterpart。mapping 静态 completeness 是 52 条全部对账，真实 HTTP 场景证明每个语义簇，不能拿样本说“全部运行过”。
3. 前端 focused 测试证明 full form value、child retention、failure holds Drawer、Store detail failed blocks child tree、false blocks list tree；存在性 source tests须配行为/否定保护。
4. 只在实施授权后，用受管 backend-acceptance 执行，读取 logs，按 CONTRACT/BUSINESS/DB_OPERATIONS 分开报告 business/cleanup。任何失败按日志首败诊断，不能以 timeout/重试冒充闭合。

**完成判据：** 最终 acceptance 在所有产码/测试改动之后，且 business PASS 与 cleanup PASS 独立成立。  
**独立对账：** P6 不代替 P9；它证明行为，不证明所有设计行已对齐。

## P7 · 受管 seed 的显式开通事实

**计划文件：**

- 修改 r5 full seed fixture 的每个可体验 Store；
- 修改 owner-command seed executor 的 Store create payload/readback assertion；
- 修改必要的 seed plan/test。

**实施要求：**

1. 每个可体验 Store 提供完整 rules map，catalogManagementEnabled 明确 true；其他 key 使用 catalog 默认或场景需要值。
2. request 后 owner readback 必须断言 capability true；不接受“默认应该会开”。
3. 只在 reset/DEV/seed 已单独授权时走 scripts/dev 受管入口；DEV start/restart 本身绝不 seed。

**完成判据：** reset 后的 seed 真实读回使三个 consumer page 可用；报告 business/cleanup，且不把静态 fixture JSON 当 runtime 通过。  
**独立对账：** P7 与 requirement V-9、详设 §9.1 MATCHED。

## P8 · 全批三维整体对账与实施后独立 review

**写入范围：** 实施记录、P9 对账文档和 Claude handoff 材料；不以此步骤补业务代码。

1. 逐条重开 requirement、详设/interaction/IA、memory/standards，跨 P1-P7 查树、wire、owner、error chain、gate、UI、audit、seed 是否同一个事实。
2. 对当前生产源码做 fresh independent adversarial review，REVIEW_TARGET=IMPLEMENTATION；reviewer 必须从详设找到每条判据和实现位置，不能复用作者自审 verdict。
3. finding 必须先由主 agent current-source 验证为 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION；只修 CONFIRMED 部分，并由新的 fresh reviewer 复查。

**完成判据：** 全批对账与 implementation review 无 OPEN；静态结论不升级 browser/runtime evidence。

## P9 · 逐代码与详设对账（交付前硬记录）

P9 的执行者是主 Codex agent；独立 reviewer 只读验证。每个实际改动文件必须在表内有一行，行号以改后字节为准；状态只能 MATCHED 或 OPEN。任何“未列文件”“模糊通配”“只写目录”均为 OPEN。下表是实施前的预置分母，执行时要展开新增文件和 mapping 的全部 52 adapter 行。

| 预置 scope | 对应详设 | 必须核对的行为 | executor | 初始状态 |
| --- | --- | --- | --- | --- |
| catalog JSON/schema/generator/three generated outputs | §3.1-3.2 | 12/2/4 tree、typed defaults、single source hash、invalid red cases | Codex | OPEN |
| Store OpenAPI schemas + edge generated wire | §3.3 | full typed values、schema 400 与 owner 422 边界、response readback | Codex | OPEN |
| Flyway + StorePersistence + StoreServiceSql + StoreService + public API + edge adapter | §4 | one JSONB fact、same transaction/CAS/idempotency/readback | Codex | OPEN |
| AuditChange/AuditChangeJson/AuditChangePolicy + OpenAPI + all producer/readers | §5 | label snapshot、four empty、truncate、legacy read、exact dynamic allowlist | Codex | OPEN |
| BusinessEntityValueSupport + Brand/Tenant/HeadCompany/Store services | §5.3 | four entities identical extension audit representation | Codex | OPEN |
| mapping 的 52 个 exact adapter symbols and 52 path error entries | §6 and mapping §3 | target resolution before mutation, gate present, x-error code present; no 33/3/181 false positives | Codex | OPEN |
| error disposition catalog + active edge catalog augmentations + materializer + EdgeProblemCode + ContractProblemAdvice + both feedback maps | §3.3, §6.1 | 422 为 create/update、403 为 52 mutation，54 materialized path closed set、closure 79/79/157 与中文 feedback chain | Codex | OPEN |
| StoreEditDrawer/testIds + shared disabled surface + three hosts | §7.1-7.2 | hierarchy, retain children, failure states, no-list-child mount, refresh, real testIds | Codex | OPEN |
| operations/platform audit modals | §5.4 and §7.3 | same label/state display behavior, no empty-string collapse | Codex | OPEN |
| unit/focused/acceptance/architecture tests | §9.3 and P6 | red/positive oracle boundaries; production versus test seam declared | Codex | OPEN |
| seed fixture/executor/seed tests | §9.1 and P7 | explicit catalogManagementEnabled true readback | Codex | OPEN |
| all implementation-added files not above | source + nearest design section | exact reason, owner, UI/contract/transaction impact | Codex | OPEN |

只有 P9 全部 MATCHED、P8 independent review 无未处置 CONFIRMED finding、以及已授权动态验证分别 business PASS/cleanup PASS 后，才可准备 IMPLEMENTATION Claude handoff。本轮仍处于文档阶段，以上所有 P 均未执行。
