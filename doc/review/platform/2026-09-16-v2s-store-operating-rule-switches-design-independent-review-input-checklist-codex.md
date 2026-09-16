# 独立对抗评审输入清单：门店经营规则开关需求

REVIEW_TARGET=DESIGN  
REVIEW_CYCLE_ID=V2S_STORE_OPERATING_RULE_SWITCHES_DESIGN_20260916  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT

## 评审边界

本清单供 fresh 独立只读 reviewer 使用。评审对象是需求稿，不是实现；必须以“找出为什么不成立”为立场，不能把作者在需求稿第 12 节的自审结论当成事实或已验证输入。不得修改仓库，不得运行构建、测试、代码生成、DEV、reset、seed、UAT、部署或浏览器动作，不得执行 Git 控制动作。

Dexter 已冻结且本轮不得推翻的七项产品裁决：规则树业务选项不质疑，只查开关关联；开关都有默认值且最终 reset；终端本期不接；商品数量上限已删除；不做门店用户能力总览；抽屉只呈现开关本身；所有门店信息变动都要审计。已知边界（collaboration 域 ISV 实体、字符串 null/空串）不重复记为 finding。

## 必须按此顺序读取

### 1. 仓内执行入口与评审治理

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：仅读取授权字段，不从 Roadmap 推导当前任务
- `project-memory/index.md` 的全部 kernel 链接
- 使用六维路由重新读取全部命中原文：
  `scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner product --impact governance --trigger review`
- `project-memory/decisions/deterministic-context-only.md`
- `doc/platform/review-standard.md`
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`
- 由六维路由命中的 review、需求、组织、审计、前端 foundation 与验证治理 memory 原文及其 `sourceRefs`

### 2. 冻结输入（先读源码，需求稿最后读）

- 需求正本：`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`
- 讨论稿（工作材料，最后读取，仅用于对撞）：`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-discussion-claude.md`

评审开始时核对以下当前字节 SHA-256；若发生漂移，停止把旧 hash 当事实并报告漂移：

| 输入 | SHA-256（本清单建立时） |
|---|---|
| 需求正本 | `5f1564b43ce866dd25188dcc71877f4f0ccd6f82a2d0debf15675de913b27a62` |
| 讨论稿 | `88b2ff70eb42900a0a299e835342e69f9fdef6d8da21dd2b98f6e5e6649c646a` |
| `contracts/openapi/components/extension/extension.schemas.json` | `c83c14f0c073d5d151c34fcf6eb90f36e614e1894d07dc127c61a9df9d988036` |
| `contracts/openapi/components/organization/store.schemas.json` | `31e552d6a2628b23ca6c865e4e80e3f9f4a0fe6e22fc5ccb8f3b786e879db7d2` |
| `contracts/registry/operation-handler-bindings.json` | `13d8477b5fb813485072fa14fae9cbaedb502d28078ef129837de5af05d7ee57` |
| `contracts/catalog/admin-catalog.json` | `edc4939bd118bfa94177745e165b55d3e894bed570e2ec597bc2364f18ae80bb` |

### 3. 源码核验面

先独立建立事实清单，再打开需求稿逐条对撞。至少读取以下 owning source 及其直接调用/路由者；不要以文件名搜索结果替代代码阅读。

#### R-9.2：门店商品、库存、销售菜单写入闭包

- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuAssetController.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerScopeSupport.java`
- `contracts/registry/operation-handler-bindings.json`
- `contracts/catalog/admin-catalog.json`
- catalog-management、inventory-management、sales-menu 下全部 page、command hook、action modal、drawer 与 API 入口；尤其核对 create/save/status/batch、copy/preflight/execute、promotion、inventory count/increase/adjust/configuration、asset stage/release，以及销售菜单 item/section/copy/publish/activation/sold-out/restore/asset/update 全部目标为 STORE 的分支
- 对每个发现的入口区分：真实写入、只读、只做 preflight、对 STORE 的目标约束、已有 owner grant、开关应在何层生效；不得把“存在路由”直接等同于“已漏 gate”

#### ExtensionFieldType 单一声明与生成链

- `contracts/openapi/components/extension/extension.schemas.json`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/ExtensionFieldType.java`
- `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts`
- `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionFilterQuery.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`
- `libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts`
- `libraries/frontend/admin-ui-foundation/src/extension/invalidFilter.tsx`
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx`
- `apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionDefinitionEditDrawer.tsx`
- `scripts/generate/edge-codegen.mjs`

明确给出“声明/生成/硬编码校验/仅展示映射”的计数口径与逐文件行号；若需求稿的 7 处不能按一致口径复现，说明这会不会影响其设计结论。

#### 角色赋权路径

- `contracts/catalog/admin-catalog.json` 中 `BC-ORG-STORE-EDIT` 及 `EDIT_STORE_CATALOG`、`EDIT_STORE_INVENTORY`、`EDIT_STORE_SALES_MENU`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceRoleController.java`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceRoleService.java`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceInvitationService.java`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/persistence/WorkspaceInvitationPersistence.java`
- `apps/frontend/platform-admin/src/features/workspace-iam/ui/RolePermissionFields.tsx`
- `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`
- 全仓生产源码中 `createRoleAssignment(`、角色创建/更新/权限替换/邀请完成及任何 bootstrap/seed 赋权路径

把“不能获得门店编辑开关权限”与“能获得商品/库存/菜单编辑能力”分开核对；邀请完成的 assignment 不能未经分析就当成角色 permission mutation。

#### 审计链

- `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangePolicy.java`
- `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationAuditHistoryService.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java`
- 同模块 `BusinessBrandService`、`BusinessTenantService`、`HeadCompanyService` 及其测试
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/AuditChange.java`
- `apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangeJson.java`
- `contracts/openapi/components/organization/store.schemas.json`

验证 unknown field key、动态扩展值到审计 scalar 的长度/格式边界、共享 helper 对四类实体的行为影响、已有 policy allowlist 与既有测试语义；区分“代码当前事实”“需求推论”“产品范围判断”“缺证据假设”。

## 必须回答的七个攻击点

1. R-9.2 是否定义了一个可穷举、可逐入口验收的 STORE 写入闭包；列出完整入口族，标明哪些是实际 mutation，指出遗漏或未决分类。
2. 复核 `ExtensionFieldType` 的声明、生成、校验和展示散落位置；指出需求稿 §4.3 的“7 处”及 §4.6 的“4 份拷贝”是否能同时成立。
3. 复核角色创建、更新、权限替换、平台代理和邀请 assignment 是否存在绕过 `BC-ORG-STORE-EDIT` eligibility 的第三条赋权路径。
4. 复核审计未知键是否直接抛错、动态扩展键是否有第二个阻塞点，以及把共享审计 helper 扩到四类实体是否改变现有行为/测试。
5. 对 §8 的 V-1 至 V-12 逐条标记为可证伪行为判据、仅存在性判据或可被假实现蒙混的判据，并给出最小可操作 oracle。
6. 标记需求层必须冻结但被推给详设的业务边界，以及需求稿中越界到实现机制的内容；不要把合理的实现约束误报成产品缺陷。
7. 重算 §3.1 的 12 个开关、11 布尔 + 1 字符串、两个根、最大深度 4，并仅在与冻结输入不一致时提出 finding。

## 独立输出格式

先给 `VERDICT=GO|NO-GO` 与 `M/S/N=x/y/z`，再按严重性列 findings。每条必须包含：

- `STATUS=CONFIRMED|PARTIALLY_CONFIRMED|REJECTED_WITH_EVIDENCE|UNVERIFIED_REQUIRES_EVIDENCE|DEXTER_DECISION`
- `TYPE=仓内事实|推论|产品判断|尚缺证据的假设`
- 需求稿相对路径与精确“第 X 行”
- 源码相对路径与精确“第 X 行”
- 根因、影响、适用边界、反例
- 最小修复及为什么更小方案不足、为什么不需要过度设计

另列：确认的非 finding、被需求稿已知边界排除的事项、未执行的动态/构建/测试证据。末尾声明本轮为 fresh 独立盲审、未读取作者自审结论后再形成 verdict（若实际顺序不同必须如实说明），并声明没有写入仓库。

