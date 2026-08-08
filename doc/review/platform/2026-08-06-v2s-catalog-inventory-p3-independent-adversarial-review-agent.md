---
title: 商品目录与门店轻库存 P3 frontend/L2 implementation 独立对抗审查 Round 1
REVIEW_CYCLE_ID: CATALOG-INVENTORY-P3-IMPLEMENTATION-20260806
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
findings: M=5 / S=2 / N=1
authorizationBoundary: 仅静态 P3 frontend implementation 独立审查；不授权源码修复、OpenAPI/P1 contract redesign、backend/database/migration、seed/reset、DEV/UAT/managed L2 execution、部署或 Git
createdAt: 2026-08-07
---

# P3 frontend/L2 implementation 独立对抗审查 Round 1

## 0. 盲审声明、范围与输入

本轮由 fresh independent subagent 以“找出当前实现为什么不成立”为立场，先独立回读当前生产源码、冻结 contract、IA、P3 manifest、generated client、foundation、L2 scripts 与 evidence receipt，再形成 findings/verdict；随后才对照 P3 review intake/evidence 的声明。未读取作者预设 verdict，也未把静态 gate PASS 当作行为结论。本文是独立审查产物，不是作者 remediation 或 Claude verdict。

`reviewerKind=INDEPENDENT_SUBAGENT`  
`reviewerInputChecklist={path,sha256}`  
`blindReviewDeclaration=先独立 verdict，后对照作者 intake/evidence；不以作者预设结论引导 findings`  
`authorMaterialReadAfterIndependentVerdict=true`  
`ROUND_FINAL_DECISION`：本轮为 Round 1；未作第二轮 final decision。

本轮确认已回读 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、Registry 解析出的唯一 active Roadmap `CURRENT_*`（`CURRENT_STEP=RM1-P6-3`）、全部 project-memory kernel、六维 recall 命中的 business/verification/source-reread/independent-review 原文、`scripts/README.md`、standards matrix 与相关 `doc/decisions/` 标题/全文。业务 corpus 命中为 catalog/inventory、owner boundary、generated consumer、IA/L2 evidence；未使用“无 corpus 命中”作为豁免。

### Reviewer input checklist（path + SHA-256）

| path | sha256 |
|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` |
| `scripts/README.md` | `64b5def5f1d04c2ac1fdec71b9c20e8642bc23c33c204c58b62a78a3dd6df106` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `3dba1c80579d4a0eca281efd59d27fbfb20aa86572648f8e36c83a68a603b4f3` |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | `80efcb002dde542c9cbcc08f19b0cec62f20e66c54d6d581650809ef8f33c876` |
| `project-memory/decisions/incremental-compliance-hook.md` | `a75469c7eb945b35f06d95cead2e11c368cc4a47dca851f32652556546985f81` |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/implementation-source-reread-discipline.md` | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `72c60ae9235079d5b9f3c17052394343723a7f51409b2bd28a3aca391df0fd21` |
| `project-memory/operations/verification-governance.md` | `e424bf923f1368381b26ef0e22a379a5cdd7bc8b7de887cc2c4e78250f2e0f18` |
| `contracts/policy/standards-coverage-matrix.json` | `3ccb1f7c1913e86a36fc6f39e3b1155478654a3cf41e5531d9bcbb79be2825a8` |
| `.runtime/compliance-control/active-package.json` | `ccc8c532cbab0cdef6f300bb0670942e345c82b83d5cbc51870e0bbe18b3737e` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md` | `a31a558b19bf41f6eed48093bc86895e01d1c400adae0c4185e633c00742f00b` |
| `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md` | `08be6b7b232e5bc220d5e2e79841e6a4dee0a7df965dbc71e49ceb3942101354` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-manifest.json` | `583272664b214892a07975fc743718c49bf207794b6779ab8f83e14ddb1244b8` |
| `doc/review/platform/2026-08-06-v2s-catalog-inventory-p3-independent-review-intake-codex.md` | `46884715c7408b6c5d45e75816a70dd58f4a4c747b8f7b3be3b36e7a3f23e6e4` |
| `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json` | `619c0f4cd79f75028832716f5179d9df692297c7a1a1dff2263a2e1daf80b814` |
| `contracts/catalog/catalog-inventory-edge-contract.json` | `4b71089a0ef2ff3ff561403fcc2ea6e703471856f2a5b222bafb56cd1fe7de02` |
| `contracts/openapi/catalog-inventory.openapi.yaml` | `d906a93de2f6de2a7c611741b8fddd5b9ebec4c23cc4f89de3c96e842a93e3a1` |
| `contracts/policy/catalog-inventory-l2-scenarios.json` | `4c4ce9cc448b226cc9251994ef7c7f2ce1ad19715aa7dd82204ae18d4b9ebe67` |
| `contracts/policy/catalog-inventory-l2-locator-bindings.json` | `6dc424ee97378159c52327cc0dde262f8a595f5601b465d6e2d614c490b11d45` |
| `contracts/policy/catalog-inventory-fixture-catalog.json` | `4833d1444ec328754c83d0b4e7e2c443fc8058bee85c481ec72d573f73a9b57b` |
| `scripts/generate/catalog-inventory-p3-frontend.mjs` | `dcde9e49b483af5801611372495c5e6d6d26585337341cf2a0baaf91d94d83c0` |
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` | `e0989088cdbef1ef4850b846a6eadbf76817d7ff51a301c3d9a6b5d401ce3154` |
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts` | `fc84e7e091b59cfcd7d0489e32bf30a0e7e96e72e087a2ebd66df92a9402d257` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx` | `dabd27c6407deb68cc3358b6d7badc989b68742228aaf0201831c0178a34a9a1` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | `5cff4263e2368b2f98edd26da3fcdf10879841e301a8ae0d8f1b017155e0e85f` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx` | `80909d82b0a5a7f2ae9be0e0937f4b058abcc6dd7847975fb7e08c3ad4b2ee64` |
| `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts` | `4ea11edb8fee2abf16d80f5d3a5c44f3437fe7848c75d6d983527aa13e8389fd` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx` | `cf1f56cfdccc28593a499917381cd22826990238fe449cd4ac968a9a58082d82` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx` | `28451c966baa932d564f86ffb13de4db254d9b54c6b2b34595b8e9aa6bdb211c` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx` | `9ba3448bde292f12886de277b44f699ad99f5b8260ee75912045e282ab510977` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/inventoryManagementModel.ts` | `1553ab815a61f5f97a1eb2b7c9e9331f87651d47c46c06c8402d3f96e67493f9` |
| `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogManagementPage.test.tsx` | `fa269272ba2465f365e07b4def1e3d1eae8f121770355921426c79a9fb080801` |
| `apps/frontend/operations-admin/src/features/inventory-management/ui/inventoryManagement.test.ts` | `3ae59dc2d2dc03a22108ae618d869564b45be34855172ddde55a7da967c3ecab` |
| `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` | `71dcb5b18131f7f7509609df1f38b98e7984d2956b7536da6e186a2d43e75965` |
| `libraries/frontend/admin-ui-foundation/src/overlay/drawerSurface.ts` | `ef449ef28a3f912fe2b04f4d1251ebe2d8173beffa9f1774066888d7e8b22060` |
| `libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts` | `96a7419261a192a595b40f94c93a005266500b7a961ff988e49451d5102f0589` |
| `tools/catalog-inventory-p3/cli.mjs` | `01fe50868ddc22883b7e74a61723f2d1ed45543cf6ba96c973d1f43b7894cf2f` |
| `scripts/test/catalog-inventory-l2.mjs` | `1f0899a1e1635085d57e2ae9026aaf2e011431112f4491760317f1eb05a89bdb` |
| `scripts/test/catalog-inventory-l2-fixture.mjs` | `4170603efbfccf61a46aa8bc98ebefce52b3585bd3268db71464e1e1961914e5` |

## 1. 结论

**NO-GO — M=5 / S=2 / N=1。**

静态 page/order、18 definitions/43 case denominator、生成文件存在性和 foundation wide-surface 字符串检查可以通过，但它们不能证明 contract-consistent consumer、批准 IA 行为或 managed browser L2。当前 P3 仍有两个 stop-ship 级问题：generated client 将所有 operation 降级为可选 `JsonValue`，并且没有任何 fresh managed business/cleanup evidence；商品编辑、品牌复制、库存列表与四动作又存在可复现的实现/契约偏差。因此本轮不输出 GO，也不把 `CATALOG_INVENTORY_P3_STATIC=PASS` 或 fixture PASS 升级为 runtime/business PASS。

## 2. Findings

### S-01｜Generated client 不是 typed DTO，且 42 个 operation 的 owner metadata 全部丢失

**状态**：`CONFIRMED`  
**轴**：Owner contract / generated consumer / safety。  
**证据**：

- `scripts/generate/catalog-inventory-p3-frontend.mjs:23-33` 对每一个 operation 固定生成 `request: JsonValue`、`response: CatalogInventoryEnvelope`、`requestRequired: false`，路径、query、headers 也都是通用 `Record`。
- 同一 generator `:24` 读取不存在的 `operation.ownerModule`；冻结 contract 使用 `initiatingOwner`（例如 `contracts/catalog/catalog-inventory-edge-contract.json:20-31`）。因此 generated `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:5-46` 明确出现 `owner: undefined`。
- generated envelope `:49-50` 将 `data/result` 设为 `JsonValue`；feature decoder `catalogModel.ts:76-151` 与 `inventoryManagementModel.ts:60-83` 再把缺失/错型值静默降为 `''/0/false/[]`。这不是 required read model 的 typed validation。
- active package 的禁止项明确排除“用 generic untyped payload 替代 required read model fields”。当前弱类型正是 Catalog save、brand copy 和 inventory write 能带着错误 body 编译的根因。

**影响**：任何 required body、`additionalProperties:false`、typed response、owner metadata 漂移都无法在编译或 generator gate 阻断；已观察到的 S-02/M-02/M-04 contract drift 会被错误地当成合法 consumer 代码。

**最小处置建议**：P3 在当前 generated surface 修复并重新生成 OpenAPI-derived request/read models（或明确将该 P3 package 退回“不具备 typed consumer admission”）；补充 required-field/extra-field red mutation 和 owner exact-set 检查。不得以手工 `JsonValue` cast 或静态字符串检查替代。

### S-02｜P3 业务与 cleanup evidence 仍未启动，43 个 L2 test 只有根页面可见性

**状态**：`CONFIRMED`  
**轴**：Evidence / L2 / runtime disclosure。  
**证据**：

- `doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-implementation-evidence-codex.json:6-19` 仍为 `status=IN_PROGRESS`、`businessStatus=NOT_STARTED`、`cleanupStatus=NOT_STARTED`、`l2.locatorBindingStatus=PENDING`、`ia.status=PENDING`，且无 checks/artifacts。
- `tools/catalog-inventory-p3/cli.mjs:19-47` 只验证 page keys、18/43 denominator、locator caseId exact-set、目录和字符串存在；没有验证 locator 对真实 `data-testid/role/name` 的绑定、交互行为、generated DTO 或 IA 语义。
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts:12-397` 的 43 个 test 都是登录→路由→`expect(page.getByTestId(rootTestId)).toBeVisible()`，没有搜索、树切换、stale、创建、页签、库存动作、复制预检、键盘、错误焦点或 HTTP absence assertion。
- `node scripts/test/catalog-inventory-l2.mjs` 只输出 `CATALOG_INVENTORY_L2_FIXTURE=PASS` 与 `MANAGED_RUN_REQUIRED=true`；非 managed fixture 不是业务 evidence，也没有 managed run 的 business/cleanup 分账。

**影响**：静态 gate 绿不能说明 18/43 green；当前没有任何可接受的 browser business PASS 或 cleanup PASS。按 P3 exit requirements，不能完成 package。

**最小处置建议**：保持 NO-GO；将每个 locator 绑定到真实行为 assertion，使用一次受管本机 app/browser + remote middleware L2，保留 run-scoped manifest、日志、PID/tunnel/remote cleanup，分别记录 business 与 cleanup，首败不靠重试掩盖。

### M-01｜Catalog create/edit 主路径不闭环，且 save body 违反冻结 CatalogItemSaveRequest

**状态**：`CONFIRMED`  
**轴**：IA / contract / user task。  
**证据**：

- `CatalogWorkbenchPage.tsx:100-103` 的“商品字典”和“新建商品”按钮没有 `onClick`，没有 create/dictionary Drawer 或页面；CI-L2-007/008/010/018 的入口行为不存在。
- `CatalogItemDrawer.tsx:41-50` 只编辑 `displayName/shortName`；save body 使用 `sections.catalogDraft.basicInfo`，缺少 required root `itemCode`，也缺少 `catalogDraft.name/shapeKey/attributes/images/productionTagRefs/categoryRefs`、`inventoryConfiguration.nodes` 与逐对象 `expectedInventoryVersions`。冻结 schema 位于 `contracts/openapi/catalog-inventory.openapi.yaml:7003-7144`。
- `CatalogItemDrawer.tsx:67-100` 仅 basic tab 有表单，其余 SKU/ordering/options/attributes/production/inventory-BOM/composite/media 多数是 read-only 或 `EmptySection`；IA/implementation design 要求的 manifest fields、SKU matrix、gallery、quickManage、BOM/production surfaces 未实现。

**影响**：同一 Drawer view/edit、七形态 create state、不可变 code/shape、production profile、inventory/BOM、media 与 catalog quickManage 无法通过；即使点击保存，也会发出不符合 frozen body shape 的请求。

**最小处置建议**：先补 create/dictionary 入口与完整 manifest-driven detail/edit surface，再仅通过 generated typed operation 提交完整 `CatalogItemSaveRequest`；失败保留 form、成功回读并返回触发焦点。

### M-02｜Brand copy preflight/execute 省略 required target scope，并发送 schema 禁止的 confirmations

**状态**：`CONFIRMED`  
**轴**：Contract / owner scope / IA。  
**证据**：

- `BrandCatalogCopyDrawer.tsx:28-35` 的 preflight body 只有 `selectedItemCodes`，遗漏 required `targetDataNodeRef`。
- `BrandCatalogCopyDrawer.tsx:37-42` 的 execute body 同样遗漏 required `targetDataNodeRef`，并额外发送 `confirmations`；冻结 `additionalProperties:false` request schema 与 required fields 在 `contracts/openapi/catalog-inventory.openapi.yaml:7876-7931`。
- `BrandCatalogCopyDrawer.tsx:41` 从 `objectVersions` 取 source/target version 的 max，而不是消费 typed canonical source/target version；`:43-46` 在 stale 时清空 preflight/confirmation 并回到选择，未保留设计要求的安全选择。
- `BrandCatalogCopyDrawer.tsx:76-78` 将预检 rows 原样 `Object.entries` 拼成文本，缺对象类型、判定、差异、目标匹配与处置控件；`:60-70` 只有一个全局 checkbox，不能满足 IA 五页签逐类差异/阻断处置。

**影响**：消费者不符合 frozen contract；即使后端通过 query/session 容忍 omission，也不能作为 P3 consumer PASS。来源→目标 scope、逐类差异、STALE 保留安全选择、owner readback 未形成可审计 UI。

**最小处置建议**：P3 只修 consumer 以匹配现有 frozen request schema；不在本轮自行改 P1/OpenAPI。实现 typed target scope、source/target versions、逐类 preflight read model 与可处置 rows，STALE 后保留安全选择并要求刷新预检。

### M-03｜Inventory 状态视图只过滤当前页，counts/total/pagination 会产生错误事实

**状态**：`CONFIRMED`  
**轴**：IA / read model / pagination。  
**证据**：

- `InventoryManagementPage.tsx:22-27` 请求只发送 `dataNodeRef/keyword/cursor/pageSize`，没有 stock view 或 category filter。
- `InventoryManagementPage.tsx:29-31` 从当前 `page.items` 本地执行 `matchesStockView` 并计算全部状态 counts；分页 `total` 仍使用后端全体 `page.total`。
- IA 明确要求名称/编码、分类、低库存/无库存/负库存/未知、需处理的全结果语义（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:693-702`）。当前页面没有分类筛选，且跨页状态计数不代表完整结果集。

**影响**：用户会看到与 `total` 不一致的页数和 status count；切换状态后可能只有当前页结果，无法证明 CI-L2-012/016 的完整筛选、分页、刷新保持。

**最小处置建议**：将状态/category 作为 owner query 的 typed filters 并返回稳定 counts，或在明确完整数据集边界后做受控聚合；不要把当前页本地过滤伪装成全结果视图。

### M-04｜四个 inventory actions 缺输入/preview/result/focus 闭环，CONFIGURE 直接拒绝提交

**状态**：`CONFIRMED`  
**轴**：IA / contract / write lifecycle。  
**证据**：

- `InventoryActionModal.tsx:24-37` 将 CONFIGURE 标记为 `contractGap` 并显示“未发送请求”；这不是批准的四动作闭环。
- `InventoryActionModal.tsx:43-48,73-78` 的 COUNT/INCREASE/ADJUST 只提交 quantity/direction/reasonCode，缺盘点/消耗单位、换算、COUNT=0 二次确认、before→after preview、受控 reason candidate、ADJUST 必填 remark 与 allowNegative 阻断/警告。IA 要求见 `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:704-740`。
- 冻结 request schema 目前只接受各自 required fields（`contracts/openapi/catalog-inventory.openapi.yaml:8063-8177`）；generic JsonValue 让上述遗漏不被编译器发现。
- `InventoryActionModal.tsx:60-72` 用 Modal 内 Descriptions 作为结果；`InventoryDetailDrawer.tsx:43-47,104-106` 的 `refreshAll` 只 refetch detail zones，没有 parent list refresh 或 success focus return。

**影响**：CI-L2-014 的四动作输入/预览/失败保留/统一结果面不能通过；写入成功后列表仍可能展示旧库存，焦点和用户劳动保护未闭合。

**最小处置建议**：先确认/修复 frozen configuration contract 的可消费字段，再实现四动作完整 surface；统一结果 Drawer、失败保留、expectedVersion/idempotency、列表+详情+流水刷新与触发按钮回焦。不能用“contract gap”隐藏批准动作。

### M-05｜Inventory detail 打开时一次性请求五个区，违背六区按需加载边界

**状态**：`CONFIRMED`  
**轴**：IA / network behavior / performance。  
**证据**：

- `InventoryDetailDrawer.tsx:20-27` 在 Drawer 打开时同时启用 current、changes、history、references、ledger 五个 query；diagnostics 仅按 capability skip。
- IA 六区要求区块可独立处理，普通用户第六区完全不渲染且无 request（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md:676-687`）；P3 design 进一步明确 L2 要验证“六区按需加载”（`doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md:676-685`）。

**影响**：打开详情会无条件发出五个 read request，不能证明逐区 loading/error/retry/on-demand，也增加首屏失败边界；无诊断权限的 skip 是正确局部行为，但不足以消除本 finding。

**最小处置建议**：以区级展开/可见性为 query gate，保留独立 loading/error/retry；维持 diagnostics capability fail-closed 和“无权限不渲染、不发请求”。

### N-01｜Foundation surface 部分复用已成立，但 Inventory detail 没有统一 drawer lifecycle/focus proof

**状态**：`PARTIALLY_CONFIRMED`，非单独 stop-ship；会影响 M-04 的结果/焦点证据。  
**轴**：Foundation reuse / accessibility。  
**证据**：

- `CatalogItemDrawer.tsx:2,32,69` 与 `BrandCatalogCopyDrawer.tsx:2,25,50` 使用 `adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle` 与 `afterOpenChange`；这部分复用成立。
- `libraries/frontend/admin-ui-foundation/src/overlay/drawerSurface.ts:16-27` 提供 1024px wide surface，`useDrawerFormLifecycle.ts:41-42,200-232` 提供 afterOpen/close-success lifecycle。
- `InventoryDetailDrawer.tsx:1,38-49` 仅使用 `useOverlayLock` + Drawer，未接 foundation drawer lifecycle/afterOpenChange/focus-return primitive；结果关闭焦点与成功回读未被证明。

**最小处置建议**：接入 foundation lifecycle 或写出明确、经批准的 app-local exception 与 focused proof；不能因为部分 Drawer 已复用就把全包 foundation/lifecycle requirement 写成 PASS。

## 3. 静态检查与非运行声明

本轮只执行了只读/静态命令：

- `scripts/check/catalog-inventory-p3`：`CATALOG_INVENTORY_P3_STATIC=PASS`，回显 `pages=3, scenarios=18, cases=43, locatorBindings=43`。
- `scripts/check/catalog-inventory-p3 --self-test`：`P3_RED_MUTATION=LOCATOR_EXACT_SET`、`CATALOG_INVENTORY_P3_SELF_TEST=PASS`；这只证明删绑定会被机械门拒绝。
- `node scripts/test/catalog-inventory-l2.mjs`：`CATALOG_INVENTORY_L2_FIXTURE=PASS`、`MANAGED_RUN_REQUIRED=true`；没有执行 managed browser、远端 middleware、业务动作或 cleanup。

没有执行 HTTP、数据库、Flyway、seed/reset、DEV/UAT、managed L2、远端应用/浏览器部署，也没有修改生产源码、契约、数据库或 runtime。本文本身是审查留痕，不构成 runtime/business/cleanup evidence。

## 4. Findings disposition boundary

以上每条 finding 是独立 reviewer 的待验证输入。作者/root 后续必须逐条重开 owning source、契约、IA 与证据，标注 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`，比较更小替代后再处置；不得把本轮 finding 自动等同于修复授权。当前独立 verdict 保持 `NO-GO`，第二轮上限为本 cycle 的 hard stop；若需第二轮，须由 fresh independent subagent 定向核验，不得由作者会话代写。

## 5. Generalized prevention set

| failure family | finite applicability denominator | root layer | prevention / red boundary |
|---|---|---|---|
| generic untyped consumer hides required-field/owner drift | 42 generated operations；P3 feature write/read consumers | generator/contract boundary | OpenAPI-derived request/read models、owner exact-set、required/extra-field red mutation；generic `JsonValue` 不得作为 package-exit proof |
| UI action exists as text but has no executable journey | 3 catalog surfaces、1 brand-copy flow、4 inventory actions | app IA/interaction layer | 每个批准入口必须有 real handler、typed body、success/error/focus evidence；静态 string presence 不能替代行为 |
| page-local filtering masquerades as complete read model | 1 inventory list + 6 status views + category filter | owner query/read model | server-side typed filter/count 或明确全数据聚合；page `items` 不能成为全局 counts 分母 |
| open Drawer fan-out bypasses zone-level boundaries | inventory six-zone detail，5 unconditional + 1 capability-gated query | UI query lifecycle | zone visibility/expand gate、独立 loading/error/retry、无权 diagnostics 的 DOM/HTTP 双 absence |
| static L2 denominator produces false green | 18 definitions / 43 cases | evidence runner | locator 必须绑定真实 role/name/testId 与具体行为 assertion；managed run 必须输出 business/cleanup 分账、first failure 与 cleanup identity |

## 6. Independent verdict

**NO-GO。** 需要先修复/处置 S-01、S-02 及 M-01–M-05，再进行 fresh focused proof；N-01 作为 foundation/focus evidence 的非阻断跟踪项保留。推荐下一步是由 `/root` 将本文件作为 Round 1 independent intake，完成逐 finding disposition 后，再按治理规则请求 Round 2 fresh 定向复核。
