---
title: 商品目录与门店轻库存 P3 frontend/L2 implementation 独立对抗审查 Round 2
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P3-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 2
REVIEW_ROUND_LIMIT: 2
ROUND_FINAL_DECISION: SELF_DECIDED
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=6 / S=3 / N=1
authorizationBoundary: 仅静态 P3 frontend implementation 独立审查；不授权源码修复、OpenAPI/P1 contract redesign、backend/database/migration、seed/reset、DEV/UAT/managed L2 execution、部署或 Git
createdAt: 2026-08-07
---

# P3 frontend/L2 implementation 独立对抗审查 Round 2（最终轮）

## 0. 盲审声明、范围与输入

本轮是同一 `REVIEW_CYCLE_ID` 的第二且最终一轮，由 fresh independent subagent 以证伪为立场，在回读当前生产源码、当前 receipt、IA/详设、Round 1 产物之后定向核验新增的 43 个 locator binding、position/wireframe、locator-source red mutation、本库复制、自由属性、生产标签 quickManage 与临时商品转正入口。作者的 remediation 结论只在独立核验完成后读取；本轮不修改生产源码，不把静态 PASS 或 fixture PASS 升级为业务/cleanup PASS。

`reviewerKind=INDEPENDENT_SUBAGENT`  
`reviewRound=2`  
`reviewRoundLimit=2`  
`ROUND_FINAL_DECISION=SELF_DECIDED`  
`blindReviewDeclaration=先独立回读 owning source、IA、contract、receipt 与行为证据，再对照 Round 1/作者材料；不得把作者声明当作行为证明`  
`authorMaterialReadAfterIndependentVerdict=true`

### Reviewer input checklist（path + SHA-256）

| path | sha256 |
|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| `scripts/README.md` | `64b5def5f1d04c2ac1fdec71b9c20e8642bc23c33c204c58b62a78a3dd6df106` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `contracts/policy/standards-coverage-matrix.json` | `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8` |
| `.runtime/compliance-control/active-package.json` | `ccc8c532cbab0cdef6f300bb0670942e345c82b83d5cbc51870e0bbe18b3737e` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `a31a558b19bf41f6eed48093bc86895e01d1c400adae0c4185e633c00742f00b` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | `08be6b7b232e5bc220d5e2e79841e6a4dee0a7df965dbc71e49ceb3942101354` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json` | `583272664b214892a07975fc743718c49bf207794b6779ab8f83e14ddb1244b8` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-independent-review-intake-codex.md` | `798667db33954d6e0538679fde61db96635ce81e3a9d50fee0f22bd0b29c001a` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json` | `7943d4e5db4bf34f64d611c2a2b061add1fc8badaa7d15a67d27d64bea99dbd7` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json` | `03ed57bff8042263c8d8ee5921b529cd12ef57827cd800f6f566adb8a97e623b` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-independent-adversarial-review-agent.md` | `f718baad3add687b61f6a808f42cd13fd23599baacad46a9b01d98cf9b977516` |
| `contracts/catalog/catalog-inventory-edge-contract.json` | `4b71089a0ef2ff3ff561403fcc2ea6e703471856f2a5b222bafb56cd1fe7de02` |
| `contracts/openapi/catalog-inventory.openapi.yaml` | `d906a93de2f6de2a7c611741b8fddd5b9ebec4c23cc4f89de3c96e842a93e3a1` |
| `contracts/policy/catalog-inventory-l2-scenarios.json` | `4c4ce9cc448b226cc9251994ef7c7f2ce1ad19715aa7dd82204ae18d4b9ebe67` |
| `contracts/policy/catalog-inventory-l2-locator-bindings.json` | `42f787be26852e101fc7a643f3d543fe9d51e83363ea0323f68bad95de6a91ac` |
| `scripts/generate/catalog-inventory-p3-frontend.mjs` | `9852ced7e174049718f0656aa3aef1990ccb9a254df97c3fc056392b870dce06` |
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` | `ae0f36aa0a484b55e65b5ea76049f1fcbc4b85704540748ad5371738457ed72c` |
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts` | `b15bb2fc1050eb8170d0d4fbbd353f971807c35bd2ac7d9fc743d320451507b5` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx` | `5e3d165816e2c781d6a5f0dcdc7ecc7dfc358bf7b13677c41eb4d899e8238118` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `715a11286f341617139610f80d6cfa0b22b7f65e25c728dfee6f6a811a16e3ef` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx` | `8e57a5402d7403ca688c45660a304ba76266da796f280c527e1efda4c49f7dd0` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx` | `adf1becf1faade020a8e2710518707876c714c64c832596627ba7320f2a352c8` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemCreateDrawer.tsx` | `c0e7f6dd26a694cc0cd767f49b982f636ba5fc8f638925b04f9bf9f497167830` |
| `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts` | `f6014d9146a135b7805c32f64e7b6ffca5ffd7869552b8f1624e02673fea99d5` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx` | `29d1a82b1cf50613034d179e7c222379fa476917777313a2784e28fcbb9d73da` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx` | `cf1f56cfdccc28593a499917381cd22826990238fe449cd4ac968a9a58082d82` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx` | `28451c966baa932d564f86ffb13de4db254d9b54c6b2b34595b8e9aa6bdb211c` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx` | `9fd1332d1d0e06cfc745c0ad6649bdd4b01f4f2af1d2b6dddff38fc1729ffb73` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/inventoryManagementModel.ts` | `c1e103cc64b95917de74f5d9ae3b122ea780cb4ecb0a42a35d5cdd8a29cccaa8` |
| `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` | `71dcb5b18131f7f7509609df1f38b98e7984d2956b7536da6e186a2d43e75965` |
| `tools/catalog-inventory-p3/cli.mjs` | `37e29e263f257c8a85d83d2935bfe89727847c5b7729a9b33a46eeee501bacc5` |
| `scripts/test/catalog-inventory-l2.mjs` | `1f0899a1e1635085d57e2ae9026aaf2e011431112f4491760317f1eb05a89bdb` |

## 1. 最终结论

**NO-GO — S=3 / M=6 / N=1。**

Round 1 的 generated owner/typed request-response 缺失已部分修复，商品创建、自由 map 属性提交、本库复制入口、生产标签入口和临时商品预检/执行入口也已出现在源码；这些事实不能被夸大为完整 IA journey。第二轮确认：43 个 L2 case 仍只是根页面可见性；locator/position/wireframe 只是全局字符串与非空元数据；本库复制、production-tag 回填和临时商品转正均未完成批准交互。当前 receipt 仍明确 `businessStatus=NOT_STARTED`、`cleanupStatus=NOT_STARTED`、`managedL2=NOT_EXECUTED_REMOTE_GUARD`，故本轮硬停在 NO-GO。

## 2. Round 1 findings disposition

| Round 1 finding | Round 2 disposition |
|---|---|
| `S1` generated client owner 丢失、所有操作为 `JsonValue` | `PARTIALLY_CONFIRMED_CLOSED_STATIC`：当前 descriptor 已恢复 42 个 initiating owner，request/response component 与 required POST body 已生成，typed-schema red mutation 通过；但 query/path/header 仍是通用 Record，且 feature decoder 把 typed envelope cast 回无参数 `CatalogInventoryEnvelope`，见新 `S-01`。 |
| `S2` 无 managed business/cleanup L2 | `CONFIRMED`：receipt 仍为 NOT_STARTED；43 个 spec 仍只有登录、路由、root `toBeVisible`，见 `S-02`/`S-03`。 |
| `M1` create/edit 主路径缺失 | `PARTIALLY_CONFIRMED`：create drawer、typed save、自由属性 textarea 已补入；完整 SKU/选项/BOM/media/category/field-ownership/回读仍未闭合，见 `M-01`。 |
| `M2` brand copy request 漂移 | `REJECTED_WITH_EVIDENCE`（原始 omission/extra confirmations 已修复）：当前 preflight/execute 均发送 `targetDataNodeRef`，未再发送 `confirmations`；仍无 managed proof，且执行后直接 `onCompleted` 丢失可见 readback，不把原 finding 当作 GO。 |
| `M3` inventory 当前页过滤与计数 | `CONFIRMED`：query 仍只有 keyword/cursor/pageSize，状态/需处理仍在当前页本地过滤与计数。 |
| `M4` inventory 四动作不闭环 | `CONFIRMED`（CONFIGURE 的字段缺口属于 upstream contract boundary，但 COUNT/INCREASE/ADJUST 仍缺 IA 输入、预览和劳动保护）。 |
| `M5` inventory 五区 eager loads | `CONFIRMED`：打开 Drawer 仍无条件启用 current/changes/history/references/ledger 五个 query。 |
| `N1` foundation 部分复用 | `PARTIALLY_CONFIRMED`：catalog/brand Drawer 复用 foundation；inventory detail 仍只用 `useOverlayLock`，缺统一 lifecycle/focus proof。 |

## 3. New findings

### S-01｜Generated query contract 与 consumer cast 仍可隐藏 required filter/read-model drift

**状态**：`CONFIRMED`  
**轴**：generated consumer / contract safety。

- generator `scripts/generate/catalog-inventory-p3-frontend.mjs:64-67` 生成了 typed schema 名称，但 `:65,67` 仍将每个 operation 的 query、path、headers 降为通用 `Record`；`CatalogInventoryOperationOptions` 在生成输出 `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:167-170` 也没有绑定 operation-specific query type。
- OpenAPI 的 `CatalogItemPageQuery` 只允许 `dataNodeRef/keyword/cursor/pageSize`（`contracts/openapi/catalog-inventory.openapi.yaml:6920-6956`），但 `CatalogWorkbenchPage.tsx:54-62` 发送 `smartViewKey/shapeKey/categoryRef/includeSubCategories/status/governance/source`；`additionalProperties:false` 的边界被 generic query 类型绕过。该页的 `CatalogItemPageQuery` type 在 generated output 中存在却未被 `query` option 使用。
- `CatalogWorkbenchPage.tsx:66-68`、`CatalogItemDrawer.tsx:42`、`BrandCatalogCopyDrawer.tsx:22,32` 与 `inventoryManagementModel.ts:60-66` 将已参数化的 RTK response cast 回无参数 `CatalogInventoryEnvelope`，再在 `catalogModel.ts:80-125` / inventory model 中以 `text/0/false/[]` 静默降级。这样 required read-model 缺失不会阻断编译或被消费端显式处理。

**影响**：P1 当前未授权新增列表筛选/计数字段，P3 既不能声称这些筛选生效，也不能用类型检查证明没有发出 schema 外 query；生成 typed response 的修复仍未达到 typed-consumer admission。

**最小处置**：先由 P1/owner 决定列表 filter/read-model 是否扩契约；在未扩契约前删除 schema 外 query，不以客户端本地过滤冒充全结果。重新生成 operation-specific query/path/header options，并让 decoder 接受对应参数化 envelope；补 required/unknown-query red mutation。不得用 `JsonValue` 或手工 cast 绕过。

### S-02｜43 个 locator binding 不是 43 个可执行业务 binding

**状态**：`CONFIRMED`  
**轴**：L2 evidence integrity / locator traceability。

- `contracts/policy/catalog-inventory-l2-locator-bindings.json` 有 43 条记录，但只有 14 个 unique locator；CI-L2-007 的 7 个 tab 行、CI-L2-009/011 的治理/媒体行、CI-L2-010 的两种复制/生命周期行分别复用同一个宽泛 Drawer/tab locator，而不是动作级 target。
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts:12-397` 的 43 个 test 只调用登录 locator 与动态 root locator；全文件没有 `getByTestId`/role/name 对上述 14 个业务 locator 的操作或断言。
- `tools/catalog-inventory-p3/cli.mjs:60-77` 把所有 operations-admin `.tsx/.ts/.json` 拼成一个字符串，只检查 locator 字符串在任意文件出现、position/wireframe 非空；`--self-test` 的 `LOCATOR_SOURCE` mutation 只证明一个完全新字符串不存在，不能证明某 case locator 出现在其 sourceFile、真实 DOM 或对应行为。

**影响**：`PASS_PAGES_3_SCENARIOS_18_CASES_43_LOCATORS_43` 与 `P3_RED_MUTATION=LOCATOR_SOURCE` 不能证明 43 个 case 的浏览器控制、IA 位置或 wireframe 对账，容易把测试 fixture/source 文本误当作真实 locator。

**最小处置**：每个 case 绑定一个实际渲染的 `data-testid`/role/name 与具体行为 assertion；checker 按 binding 的 sourceFile/AST 或渲染 fixture 验证唯一 target、position/wireframe 映射，并加入“locator 仅出现在测试文本/错误组件”红 mutation。只有 fresh managed L2 business/cleanup evidence 才能关闭。

### S-03｜当前 L2 spec 与 receipt 的 runtime boundary 仍为空

**状态**：`CONFIRMED`  
**轴**：runtime / business / cleanup evidence。

- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json:6-24,40-45` 当前为 `businessStatus=NOT_STARTED`、`cleanupStatus=NOT_STARTED`、`managedL2=NOT_EXECUTED_REMOTE_GUARD`。
- `scripts/test/catalog-inventory-l2.mjs` 无 `--managed` 时只运行 fixture 并输出 `MANAGED_RUN_REQUIRED=true`；`catalog-inventory.spec.ts` 没有 HTTP、业务动作、错误/焦点、无权限双 absence 或 cleanup 断言。
- 本轮静态命令只得到 fixture PASS；没有受管本机 app/browser、tunnel、远端数据库/资产回收、run-scoped manifest、脱敏日志或 first-failure/cleanup evidence。

**影响**：任何 catalog/inventory/quickManage/copy/promotion 的行为都仍是 UNVERIFIED，package exit 的 `business=PASS && cleanup=PASS` 前置条件不成立。

**最小处置**：按 active package 的运行边界执行一次受管 L2，分账记录 business 与 cleanup，首败读取日志并保留 PID/tunnel/remote resource identity；不得用 fixture、静态字符串或延长 timeout 代替。

### M-01｜Catalog detail/create 只补了骨架，IA 的形态页签与 owner/readback 仍不闭环

**状态**：`PARTIALLY_CONFIRMED`  
**轴**：IA / catalog owner / user task。

- `CatalogItemCreateDrawer.tsx:49-75` 现在可创建 code/name/shape/free attributes，并正确禁用 BENEFIT_SHELL；但没有 IA 基础资料所需的 category/tag/sales-unit/media/production/BOM 选择。
- `CatalogItemDrawer.tsx:114-154` 只对 basic/name 与 attributes 提供编辑；SKU matrix、identifiers/options、production profiles、inventory/BOM、composite、asset lifecycle 仍是 read-only `Descriptions` 或 `EmptySection`。IA 要求见 `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:448-555,628-647`。
- `catalogModel.ts:111-125` 丢弃 generated detail 的 `deniedFields`、`fieldOwnership`、`externalIdentity`、`voidAvailability`；AUTO_SYNC/TEMPORARY 的服务端字段主权因此没有进入编辑/动作判定。临时来源 banner 也没有 source order/raw snapshot 事实。

**影响**：同 Drawer 的 view/edit 入口虽然存在，但不能证明批准的全部形态页签、按 owner 的字段可编辑性、保存错误焦点、写后 owner readback 与媒体保护；创建成功也不能完成 IA 资料闭环。

**最小处置**：保持已实现的 typed create/save/free-map path；按 P1 现有字段逐项补 shape-admitted tabs、server deniedFields/ownership、失败保留与 readback。若 P1 没有相应 command/DTO，标为 BLOCKED_UPSTREAM_CONTRACT，不在 P3 猜测字段。

### M-02｜本库复制 UI 不是批准的五步配置/映射/预览向导

**状态**：`CONFIRMED`  
**轴**：IA / copy safety / readback。

- `LocalCatalogCopyDrawer.tsx:59-81` 只有“选择目标商品→差异预检→复制结果”三个步骤；IA `IA-CAT-COPY-LOCAL-001..004` 要求来源范围、来源商品、复制范围、BOM 映射、预览确认五步（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:599-626`）。
- `:14,70-78` 只有 8 个 section checkbox，没有九类 scope 的依赖联选；没有 source keyword 搜索、unresolved/skippable 的“映射到/跳过并确认”选择、blocked 保护、字段级 before→after 的四组预览。
- `:50-51` execute 后立即调用 `onCompleted`；父 `CatalogItemDrawer.tsx:131` 关闭该 Drawer，`LocalCopyReadback` 没有被解析或展示，成功页几乎不可见。

**影响**：同库复制的 owner/version/digest 请求虽然是 typed 且静态存在，但用户不能核对配置覆盖、BOM 映射或 readback；reconciliation 将 `IA-CAT-COPY-LOCAL-001..004` 全标为 `IMPLEMENTED_STATIC` 过度声明，应至少为 PARTIAL_STATIC，直到 focused/runtime proof。

**最小处置**：保留现有 candidates/preflight/execute operation；补齐批准的五步和每行处置/四组差异，消费 typed readback，成功保持当前商品 Drawer/页签，STALE 保留安全选择并重新预检。算法与 owner 判断仍由 P2 提供，P3 不复制闭包逻辑。

### M-03｜Production-tag quickManage 仍合并了 surface，且创建后没有回填/选择

**状态**：`CONFIRMED`  
**轴**：owner boundary / IA / quickManage。

- `CatalogDictionaryDrawer.tsx:12-14,56-68` 把 `PRODUCTION_TAG` 放进与商品标签/销售单位/SKU 属性相同的 Tabs 和同一标题 Drawer；IA `IA-CAT-DICT-001/004` 明确要求 production-tag owner 的独立标题/独立 surface，不得作为商品目录字典第四 tab（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:337-379`）。HTTP owner 虽分别调用 `get/createOperationsProductionTag`，视觉与交互 owner boundary 仍不成立。
- `CatalogItemDrawer.tsx:153` 的“快速维护”只调用 `onOpenProductionTags`，没有传当前商品、当前节点或选中回填回调；`CatalogDictionaryDrawer.tsx:34-47` 创建后只 reset/refetch，不向调用页返回 created tag，也没有选择/挂接动作。
- production surface 只有创建与列表；IA 还要求改名、停用、重新启用、版本/引用计数和停用后的选择保护。非 production tab 打开时 `productionQuery` 仍在 `:25-26` 请求，扩大了无关/权限失败边界。

**影响**：CI-L2-008 的“分 owner 并回填”无法成立；用户创建标签后仍需离开当前商品自行寻找/绑定，且同一组件把两个事实层级混合。

**最小处置**：保留独立 production-tag generated operations；拆出独立 surface，quickManage 接收当前 field context，创建成功以 readback 选中并回填，补齐 lifecycle actions 或以明确 upstream blocked 记录，不用无关 query 掩盖。

### M-04｜临时商品有治理按钮，但不是 IA 要求的补全资料→预检→转正流程

**状态**：`PARTIALLY_CONFIRMED`（入口已确认，完整流程缺口受 P1 contract 约束）  
**轴**：temporary governance / source snapshot / contract boundary。

- `CatalogItemDrawer.tsx:122-133` 已按 `source === 'TEMPORARY'` 显示“治理转正”，调用 typed preflight/execute 并在 `canPromote` 为 false 时禁用确认；这是对 Round 1 “完全没有入口”的关闭证据。
- 当前 Modal 只显示 item/source/status、blockedReasons 和静态说明；没有 IA 要求的形态选择、必填资料补全、编码/引用预检表单、失败保留输入或 source order/raw snapshot（IA `:416-430`）。generated `TemporaryPromotionPreflight` 只有 `item/blockedReasons/changes/digest/canPromote`，request 只有 `itemCode/expectedVersion`，不能由 P3 私造资料字段。

**影响**：按钮存在不等于 CI-L2-009-02 的治理旅程完成；若后端只能返回“可/不可”，前端无法让用户修复阻断。

**最小处置**：由 Dexter/P1 owner 决定是否重开 promotion contract；若 contract 保持窄范围，将本项明确登记 `BLOCKED_UPSTREAM_CONTRACT` 并只证明入口/预检/安全禁用；若授权扩契约，再实现补全/回读，不在 P3 伪造字段。

### M-05｜Catalog list 发出 schema 外 filters，且 inventory status/count 仍是当前页事实

**状态**：`CONFIRMED`（catalog filter drift；inventory aggregate gap）  
**轴**：query semantics / pagination / owner read model。

- `CatalogWorkbenchPage.tsx:54-62` 的 `smartViewKey/shapeKey/categoryRef/includeSubCategories/status/governance/source` 不在冻结 `CatalogItemPageQuery`；generic query options 使其绕过 `additionalProperties:false`。这是上游 filter contract 缺口与当前 consumer 同时存在的双重问题。
- `InventoryManagementPage.tsx:22-31` 请求没有 `stockView/category`，`rows` 与 `counts` 均从当前 `page.items` 本地派生；IA 要求全结果的分类、低/无/负/未知/需处理语义（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:651-674`）。

**影响**：catalog 结果域可能被服务端拒绝/忽略未知 query；inventory 的 counts 与分页 total 不同分母，跨页筛选不是真实工作台事实。

**最小处置**：P1 owner 先确认/提供 typed filter/count read model；在此之前删除 schema 外字段，不能用当前页本地过滤声称全结果。保持此 finding，不将其全部归因于 P3。

### M-06｜Inventory actions/detail 仍不能证明四动作与六区 lifecycle

**状态**：`CONFIRMED`（部分字段为 upstream blocked）  
**轴**：write safety / query lifecycle / foundation。

- `InventoryActionModal.tsx:33-48,73-78` 的 COUNT/INCREASE/ADJUST 仍缺消耗/盘点单位与换算、COUNT=0 二次确认、受控 reason candidates、ADJUST remark、before→after preview；CONFIGURE `:35-38,60-64` 直接拒绝提交，因为 frozen request 没有所需字段。
- `InventoryDetailDrawer.tsx:20-26` 打开即发 current、changes、history、references、ledger 五个 read request；只按 capability gate diagnostics，未按区展开/可见性按需加载。`refreshAll` `:43-44` 也没有 parent list readback/focus proof。
- `InventoryDetailDrawer.tsx:1,48-104` 仍使用 `useOverlayLock` + Drawer，而非 catalog/brand 已使用的 foundation lifecycle/afterOpen/focus return primitive。

**影响**：CI-L2-012/013/014 不能证明四动作、统一结果面、失败保留、按区 retry 和无诊断权限的严格 DOM/HTTP absence；业务写入字段缺口需上游决定，不能以本地 disabled 当作完成。

**最小处置**：P1 owner 先闭合 action/filter DTO；P3 只消费 generated fields，补四动作 preview/result/readback 与区级 query gate；foundation exception 若保留须有 focused proof。

## 4. 上游/运行边界（不冒充 P3 已修复）

当前 receipt 仍记录：`frontendArchitecture=FAIL_BASELINE_POLICY_GAPS_PLUS_NEW_UNREGISTERED_TABLES`、`openapiContracts=FAIL_PRE_EXISTING_STRICT_POINTER_BASELINE_110`、`edgeCodegen=FAIL_DUPLICATE_STANDALONE_CATALOG_COPY_OPERATION`、`managedL2=NOT_EXECUTED_REMOTE_GUARD`。本轮没有把这些失败静默归因给 P3，也没有重开 OpenAPI/backend/database；但它们与上面的 query/filter、inventory action、temporary promotion 缺口一起阻止 package exit。任何后续修改必须重新核对 active package、source denominator 与两轮 review hard limit。

## 5. 静态检查与非运行声明

本轮只执行了只读/静态命令：

- `node tools/catalog-inventory-p3/cli.mjs`：`CATALOG_INVENTORY_P3_STATIC=PASS`，`pages=3, scenarios=18, cases=43, locatorBindings=43`。
- `node tools/catalog-inventory-p3/cli.mjs --self-test`：`P3_RED_MUTATION=LOCATOR_EXACT_SET`、`LOCATOR_SOURCE`、`TYPED_SCHEMA`、`IA_CONTROL_EXACT_SET`，随后 `CATALOG_INVENTORY_P3_SELF_TEST=PASS`。这些 red mutation 只证明所写机械条件，不能证明真实 DOM/行为。
- `node scripts/test/catalog-inventory-l2.mjs`：`CATALOG_INVENTORY_L2_FIXTURE=PASS`、`MANAGED_RUN_REQUIRED=true`；没有执行 managed browser、远端 middleware、业务动作或 cleanup。

没有执行 HTTP、数据库、Flyway、seed/reset、DEV/UAT、managed L2、远端应用/浏览器部署，也没有修改生产源码、契约、数据库或 runtime。本文仅是最终独立审查留痕。

## 6. Generalized prevention set

| failure family | finite applicability denominator | root layer | prevention / red boundary |
|---|---|---|---|
| generated schema exists but operation options/consumer casts erase it | 42 catalog/inventory edge operations；当前 3 个 page + 5 个 decoder | generator/consumer boundary | operation-specific query/path/header options、parameterized envelope、unknown-query red mutation；禁止 generic cast 作为 package exit |
| locator exact-set and non-empty metadata masquerade as executable browser proof | 18 definitions / 43 cases / 14 unique locators | L2 evidence runner | case→real DOM target→behavior assertion exact-set；checker 绑定 source/AST/rendered fixture；managed business+cleanup only |
| write surface exists but misses IA decision points/readback | catalog 7-shape detail、local copy 4 IDs、production quickManage 5 IDs、temporary promotion 2 IDs | UI journey/owner boundary | each approved journey must show full controls, typed request, error retention, owner readback and focus return; partial must remain PARTIAL/BLOCKED |
| page-local aggregation pretends to be full-result semantics | catalog result filters + inventory 6 views/counts | owner query/read model | server-side typed filters/counts or explicitly bounded aggregation; current page cannot be global denominator |
| unconditional Drawer fan-out bypasses zone lifecycle | inventory detail 6 zones, 5 unconditional queries | UI query lifecycle/foundation | visible-zone query gate, independent loading/error/retry, diagnostics DOM+HTTP absence, foundation lifecycle proof |

## 7. Independent final verdict

**NO-GO。**

Round 2 is the hard final review round for this cycle. The owner may intake each finding with the required `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` disposition, but may not summon a third independent round under this cycle. Before any GO claim, close S-01/S-02/S-03, re-open the partial IA controls, obtain fresh managed business and cleanup PASS, and re-run current-byte receipt/evidence reconciliation. 
