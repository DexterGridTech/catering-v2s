# CP-INV-7 · 跨界 JSON 字段名盘点

状态：`COMPLETED_STATIC_INVENTORY_WITH_PROOF`

日期：2026-08-17

适用详设：`doc/plans/platform/2026-08-17-v2s-b1-实施详设-claude.md` §CP-INV-7

本产物只做盘点与证伪，没有修改生成器、契约、后台生产源码或前端源码。

## 1. 盘点口径

盘点范围是 `apps/backend/catering-business-server` 下全部 716 个 `*.java`，包括 `src/main` 和 `src/test`；扫描器先去除 Java 注释、字符字面量和文本块，再按字段构造形态取值。相同文件、同一字符串字面量位置、同一字段值只计一次联合 occurrence，字段值只纳入 `[a-z][A-Za-z0-9]*` 的 lowerCamel 集合。

覆盖的三类形态与实现口径如下：

1. `.path(`、`.put(`、`.has(`、`.withArray(`、`.putArray(` 的字符串实参；该类同时用详设历史正则复算，确保旧基线可重现。
2. `Map.of(`、`Map.entry(`、`Map.ofEntries(`、`ImmutableMap` 同名工厂，以及 `Collections.singletonMap(` 的键字面量；`Map.ofEntries` 的键由其嵌套 `Map.entry` 取出。
3. `writeValueAsString` 直接序列化的 `Map`/record：Map 的键由第 2 类取出；record 先枚举 Java record component，再只沿实际 `writeValueAsString` 调用解析直接 `new` 或同文件已声明的 record 类型变量，取其 JSON 字段名。

仅扫描一种实现标识符不能作为否定式结论。本次同时覆盖 ObjectNode 写法、不可变 Map 工厂写法和 record 序列化写法；`Map.of` 的 `ManagedInvitationBootstrap` 是实际反例。

## 2. 后端分母

下表的 category occurrence 允许因同一字符串同时属于多种形态而重叠；`联合` 已按源位置去重。

| 形态 | 不同字段值 | occurrence |
|---|---:|---:|
| ObjectNode 方法（历史基线） | 455 | 4569 |
| 不可变 Map 键字面量 | 83 | 342 |
| record 序列化字段 | 45 | 87 |
| 三类联合去重 | **501** | **4998** |

旧详设采用的 `455 / 4569` 仍然是 ObjectNode 子集的正确基线，但不是扩展后的完整分母。联合集合比旧集合新增 46 个不同字段值；因此本批不把旧 `455 / 4569` 冒充为新分母。

## 3. `ManagedInvitationBootstrap` 自检

`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/bootstrap/ManagedInvitationBootstrap.java` 的旧 ObjectNode 方法扫描在该文件内对五个字段均为 0；扩展扫描通过 `Map.of` 在以下位置全部命中：

| 字段 | 扩展形态 | 源位置 |
|---|---|---:|
| `invitationId` | `Map.of` key | 95 |
| `status` | `Map.of` key | 97 |
| `invitationToken` | `Map.of` key | 99 |
| `failureType` | `Map.of` key | 109 |
| `failureMessage` | `Map.of` key | 111 |

这五个字段的实际消费者是 bootstrap 脚本，不因没有前端消费者而从后端分母删除。

## 4. 前端与生成物交集

前端扫描范围是 `apps/frontend` 下全部 193 个 `*.ts`/`*.tsx`，以 TypeScript AST 的 `Identifier` 集合代表当前前端实际引用字段。生成物覆盖范围只取以下四个非 RTK wire 类型文件的 `PropertySignature`；`.rtk.ts` 是运行包装，不是字段声明，排除它：

| 生成文件 | 唯一字段声明数 |
|---|---:|
| `apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts` | 418 |
| `apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts` | 295 |
| `apps/frontend/operations-admin/src/app/api/generated/public-edge.ts` | 64 |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts` | 259 |
| 四文件联合唯一字段 | 804 |

结果：

| 口径 | 后端字段值出现在前端 AST | 其中被生成字段声明覆盖 | 未被生成物覆盖 |
|---|---:|---:|---:|
| 旧 ObjectNode 子集 | 381 | 367 | 14 |
| 本次三形态联合集合 | **409** | **383** | **26** |

因此详设中要求重算的旧 `381 / 77 / 304` 不能继续沿用。本次在明确的四个 generated edge 类型文件与 AST `PropertySignature` 分母下，当前可复核值是 `409 / 383 / 26`；没有把另一种生成物文本正则的结果混入本表。

这 26 个未被生成物覆盖的字段仍只是“保护缺失”的盘点事实，不授权据此扩展生成器或契约。

## 5. 十个随机负变异 proof

抽样规则：对“出现在前端 AST 且未出现在四个 generated edge 类型文件”的候选字段按字段名排序，使用固定种子 `0x20260817` 的 xorshift32 取 10 个样本。每个样本都在独立 `/tmp/cp-inv-7-proof.lYDAZi/<n>/` 后端副本中把字段名改成带 `__cp_inv_7_<n>` 后缀；原仓源码没有被修改。

| 样本 | 字段 | 形态 | 后端源锚点（副本对应原文件） |
|---:|---|---|---|
| 01 | `versions` | `putArray` | `modules/fulfillment-production/.../ProductionTagOwnerService.java:746` |
| 02 | `runId` | `put` | `src/main/.../HttpRequestMetricsInterceptor.java:163` |
| 03 | `ref` | `path` | `modules/catalog/.../CatalogInventoryCoordinator.java:1215` |
| 04 | `discovered` | `Map.of` key | `src/test/.../BackendAcceptanceTest.java:563` |
| 05 | `phase` | Map-shaped diagnostic payload | `src/main/.../HttpRequestMetricsInterceptor.java:257` |
| 06 | `consumerFace` | `put` | `src/main/.../HttpRequestMetricsInterceptor.java:170` |
| 07 | `targetId` | `path` | `modules/workspace-iam/.../PlatformWorkspaceInvitationTaskReadService.java:248` |
| 08 | `problemCode` | `put` | `modules/fulfillment-production/.../ProductionTagOwnerService.java:765` |
| 09 | `commercialGroupName` | record component，实际序列化调用在 receipt service | `modules/organization/.../CommercialGroupReadback.java:10`；`CommercialGroupCommandReceiptService.java:92` |
| 10 | `creditCode` | record component，实际序列化调用在 receipt service | `modules/organization/.../OrganizationEntityReadback.java:14`；`BusinessEntityCommandReceiptService.java:126` |

每个变异分别运行：

```text
yarn --cwd apps/frontend/platform-admin typecheck
yarn --cwd apps/frontend/operations-admin typecheck
```

真实输出（无标准输出、无错误输出）：

```text
PROOF sample=01 app=platform-admin
RESULT sample=01 app=platform-admin exit=0
PROOF sample=01 app=operations-admin
RESULT sample=01 app=operations-admin exit=0
PROOF sample=02 app=platform-admin
RESULT sample=02 app=platform-admin exit=0
PROOF sample=02 app=operations-admin
RESULT sample=02 app=operations-admin exit=0
PROOF sample=03 app=platform-admin
RESULT sample=03 app=platform-admin exit=0
PROOF sample=03 app=operations-admin
RESULT sample=03 app=operations-admin exit=0
PROOF sample=04 app=platform-admin
RESULT sample=04 app=platform-admin exit=0
PROOF sample=04 app=operations-admin
RESULT sample=04 app=operations-admin exit=0
PROOF sample=05 app=platform-admin
RESULT sample=05 app=platform-admin exit=0
PROOF sample=05 app=operations-admin
RESULT sample=05 app=operations-admin exit=0
PROOF sample=06 app=platform-admin
RESULT sample=06 app=platform-admin exit=0
PROOF sample=06 app=operations-admin
RESULT sample=06 app=operations-admin exit=0
PROOF sample=07 app=platform-admin
RESULT sample=07 app=platform-admin exit=0
PROOF sample=07 app=operations-admin
RESULT sample=07 app=operations-admin exit=0
PROOF sample=08 app=platform-admin
RESULT sample=08 app=platform-admin exit=0
PROOF sample=08 app=operations-admin
RESULT sample=08 app=operations-admin exit=0
PROOF sample=09 app=platform-admin
RESULT sample=09 app=platform-admin exit=0
PROOF sample=09 app=operations-admin
RESULT sample=09 app=operations-admin exit=0
PROOF sample=10 app=platform-admin
RESULT sample=10 app=platform-admin exit=0
PROOF sample=10 app=operations-admin
RESULT sample=10 app=operations-admin exit=0
```

实际结果：10/10 个后台字段变异均未触发前端编译错误；两个 App 共 20/20 次 typecheck exit 0。该 proof 证明当前生成类型链对这些后台侧字段改名没有编译期保护，不证明运行期接口行为，也不把它升级为 HTTP、DEV、seed、L2 或 UAT 证据。

批量执行初始尝试曾因 zsh 的只读特殊变量名 `status` 在第一个样本前中止；该编排错误没有产生 proof 结论，改用 `rc` 后从样本 01 重新执行，以上 20 项是有效结果。

## 6. 反例与边界

- `ManagedInvitationBootstrap` 的五个 Map key 被扩展扫描抓到，但它的脚本消费者不在前端 generated edge 交集内；这证明“未被前端契约覆盖”与“不是业务字段”不能混为一谈。
- 前端 typecheck 对后台 scratchpad 的修改本身不可见；这正是本 proof 要验证的边界：后台字段单侧改名不会让当前生成 TS 编译失败。它不是完整 HTTP 或运行期契约 proof。
- 测试目录中的 JSON shape 仍计入本次分母，因为原始 ObjectNode 盘点也覆盖 `apps/backend/catering-business-server` 全部 Java；本批没有通过单文件例外缩小分母。
- 本批不修改 `runtime-environment-keys`、D-3/CP-INV-3、生成器、契约或任何运行环境。

## 7. S-1 处置记录

S-1 已撤回，状态为 `REJECTED_WITH_EVIDENCE`（reviewer 原缺陷结论被当前源码反证）。`ContractCommandReceiptService`、`WorkspaceCommandReceiptService`、`PlatformCommandReceiptService` 均在 replay `SELECT` 之前通过内联 `pg_advisory_xact_lock` 获取事务级锁；本批没有修改三个服务。

## 8. CP-INV-7 数据流重判（2026-08-17）

### 8.1 候选名单重建

本节按 Dexter 新授权，只复用上一版已经使用过的候选扫描实现与判定条件：后端 JSON 字段值出现在前端 AST，且不出现在四个 generated edge 类型文件。没有重跑、改写或重新解释 `501 / 4998` 的全量分母结论；本次仅把此前未落盘的候选成员恢复出来。

重建结果为 **26 项**，与上一版统计的 `409 / 383 / 26` 中最后一个数字一致。该数字现在有可逐条使用的成员名单；它仍然只是按名字取交得到的超集，不能直接当作真实跨界字段集合。`ManagedInvitationBootstrap` 的 `invitationId`、`status`、`invitationToken`、`failureType`、`failureMessage` 属于后端到脚本的另一对跨界，本节按裁定不纳入。

### 8.2 逐项数据流判定

判定规则只有一条：候选 JSON 是否作为后端生产 HTTP **响应体**到达前端。测试结果文件、诊断/度量落盘、数据库聚合 JSON、owner 私有 envelope、请求体、资源配置和脚本侧落盘均不算本节的前端跨界。

| # | 字段 | 候选 owning source / 构造形态 | 实际去向 | 是否经 HTTP 响应体到达前端 | 未覆盖原因 / 判定 |
|---:|---|---|---|---|---|
| 1 | `area` | `modules/extension/src/test/.../ExtensionDefinitionServiceTest.java:229` · `Map.of` | 扩展定义单测的测试字段值 fixture | 否 | 测试载荷；非生产响应，不构成前端跨界 |
| 2 | `business` | `src/test/.../BackendAcceptanceTest.java:791` · `Map.of` | backend acceptance 自身的结果证据 JSON | 否 | 测试结果字段；非生产响应，不构成前端跨界 |
| 3 | `commercialGroupCode` | `modules/organization/src/main/.../CommercialGroupCommandReceiptService.java:92` · record 序列化 | `organization.commercial_group_command_receipt.response_json`；HTTP mapper 改名为 `groupCode` | 否 | 回执持久化字段；HTTP 生成类型声明的是 `groupCode`，不是该内部 record 名 |
| 4 | `commercialGroupName` | 同上 · `CommercialGroupReadback` 序列化 | 回执 `response_json`；HTTP mapper 改名为 `groupName` | 否 | 回执持久化字段；HTTP 生成类型声明的是 `groupName`，不是该内部 record 名 |
| 5 | `consumerFace` | `src/main/.../edge/diagnostic/HttpRequestMetricsInterceptor.java:170` · `ObjectNode.put` | run-scoped metrics/diagnostic event，写入本地事件落盘文件 | 否 | 诊断证据载荷，不是 HTTP 响应体 |
| 6 | `contract` | `src/test/.../BackendAcceptanceTest.java:789` · `Map.of` | backend acceptance 结果证据 JSON | 否 | 测试结果字段；非生产响应，不构成前端跨界 |
| 7 | `creditCode` | `modules/organization/src/main/.../BusinessEntityCommandReceiptService.java:126` · record 序列化 | `response_json` 重放在 `BusinessEntityCommandReceiptService.java:63` 反序列化为 `OrganizationEntityReadback`；edge controller 再在 `OperationsBusinessEntityController.java:171-194` 调 `BusinessEntityWireMapper.tenant()`，输出 `Tenant.unifiedSocialCreditCode` | 否（候选 key） | replay 不把 `OrganizationEntityReadback` 直接作为 HTTP body 返回；edge 重新映射，生成 Java/TS wire 字段是 `unifiedSocialCreditCode` |
| 8 | `digest` | `modules/fulfillment-production/src/main/.../ProductionTagOwnerService.java:459` · `path` | owner 私有预检 envelope 的 `data.digest`，由 coordinator 消费 | 否 | owner-to-owner 内部 readback；外部 HTTP 预检字段是生成的 `preflightDigest` |
| 9 | `discovered` | `src/test/.../BackendAcceptanceTest.java:563` · `Map.of` | acceptance discovery 证据文件 | 否 | 测试发现载荷；非生产响应，不构成前端跨界 |
| 10 | `failure` | `src/test/.../BackendAcceptanceTest.java:832` · `Map.of` | backend acceptance 失败结果证据 JSON | 否 | 测试结果字段；非生产响应，不构成前端跨界 |
| 11 | `failureMessage` | `src/main/.../app/bootstrap/ManagedInvitationBootstrap.java:111` · `Map.of` | bootstrap failure sidecar JSON，属于 backend→script/seed 侧落盘 | 否 | 另一条后端→脚本跨界；本批按裁定已知未覆盖、不扩范围、不修改该文件 |
| 12 | `groupLabel` | `modules/organization/src/test/.../OrganizationOwnerServiceTest.java:385` · `Map.of` | 组织 owner 单测的扩展值 fixture | 否 | 测试 fixture；非生产响应，不构成前端跨界 |
| 13 | `hidden` | `modules/extension/src/test/.../ExtensionDefinitionServiceTest.java:229` · `Map.of` | 扩展定义单测的测试字段值 fixture | 否 | 测试载荷；非生产响应，不构成前端跨界 |
| 14 | `itemCodes` | `modules/catalog/src/main/.../CatalogOwnerService.java:2402` · `request.path` | catalog owner 读取的请求体/内部查询参数 | 否 | 请求侧输入；HTTP 响应使用 typed `items` 等字段，不是该候选响应字段 |
| 15 | `json` | `src/test/.../BackendAcceptanceTest.java:847` · `Response` record | acceptance 测试 helper 保存解析后的 HTTP 测试响应 | 否 | 测试 helper 的 record component；不是后端产生的响应字段 |
| 16 | `limits` | `modules/catalog/src/main/.../CopyLimitPolicy.java:15` · `policy.path` | classpath 中 `catalog-inventory-copy-policy.json` 的运行时配置 | 否 | 资源配置读取；不进入 HTTP 响应体 |
| 17 | `lineSign` | `modules/catalog/src/main/.../CatalogOwnerService.java:5570` · `entry.has` | catalog BOM 写入/内部 JSON 形状 | 否 | 请求/owner 内部字段；外部 detail wire 使用 typed BOM 字段，不是该候选响应字段 |
| 18 | `phase` | `src/main/.../edge/diagnostic/HttpRequestMetricsInterceptor.java:256` · `ObjectNode.put` | database-operations diagnostic event，写入本地度量落盘文件 | 否 | 诊断度量载荷，不是 HTTP 响应体 |
| 19 | `problemCode` | `modules/fulfillment-production/src/main/.../ProductionTagOwnerService.java:765` · `ObjectNode.put` | production owner 私有 `compatibilityResults` JSON | 否 | owner 内部预检字段；外部 generated contract 使用 `reasonCode`，没有同名响应字段 |
| 20 | `ref` | `modules/catalog/src/main/.../CatalogInventoryCoordinator.java:1215` · `path` | coordinator 的内部 closure/reference plan 兼容读取 | 否 | 内部兼容读取；外部 wire 使用 `sourceRef`/`targetRef` 等明确字段 |
| 21 | `rows` | `modules/inventory/src/main/.../InventoryOwnerService.java:1790` · `request.path` | inventory BOM 写入请求的行集合 | 否 | 请求体输入；外部响应使用 `inventoryBom` 等 typed 字段 |
| 22 | `runId` | `src/main/.../edge/diagnostic/HttpRequestMetricsInterceptor.java:163` · `ObjectNode.put` | run-scoped diagnostic event，写入本地事件落盘文件 | 否 | 诊断证据载荷，不是 HTTP 响应体 |
| 23 | `targetId` | `modules/workspace-iam/src/main/.../PlatformWorkspaceInvitationTaskReadService.java:248` · `path` | 数据库聚合的 invitation intent JSON，供 task read service 解析 | 否 | 后端内部 DB JSON；外部 wire 不声明同名响应字段 |
| 24 | `updated` | `modules/workspace-iam/src/main/.../PlatformWorkspaceAccountTaskReadService.java:353` · `path` | 数据库聚合的 assignment JSON，供 task read service 解析 | 否 | 后端内部 DB JSON；外部 wire 使用 `updatedAt` |
| 25 | `valueJson` | `src/main/.../edge/extension/ExtensionSubmissionWireMapper.java:45` · `path` | 扩展提交请求的 legacy JSON 字段，映射到 owner submission | 否 | 请求侧 legacy 输入；不是响应字段 |
| 26 | `versions` | `modules/fulfillment-production/src/main/.../ProductionTagOwnerService.java:746` · `putArray` | `preflightCopy` 在 `ProductionTagOwnerService.java:842` 将它放入 owner result；`CatalogInventoryCoordinator.java:1010` 读取 owner `versions` 并写入合并结果的 `objectVersions`，最终由 edge 返回 generated `BrandCatalogCopyPreflight.objectVersions` | 否（候选 key） | snapshot 不进入回执，也不是 `versions` 原名 HTTP 字段；它作为 owner-to-owner 内部 envelope 中间值被消费并重映射为 `objectVersions` |

### 8.3 结果与边界

本次 26 项逐条判定中，**真实后端 HTTP 响应体到达前端的字段：0 项**。因此当前没有可授权的生成器或契约修复项；把这 26 个名字直接扩进前端契约会把测试载荷、诊断载荷、内部 JSON 和请求字段误当成用户可见响应。

### 8.4 收口补充核验

- `creditCode`：幂等 replay 的确会返回已存的 `OrganizationEntityReadback`，但只返回到 owner/应用层；`OperationsBusinessEntityController` 对新执行与 replay 统一调用 `BusinessEntityWireMapper.tenant()`/`headCompany()`，由生成的 `Tenant`/`HeadCompany` 以 `unifiedSocialCreditCode` 序列化 HTTP body。`creditCode` 这个候选 key 没有直达前端。
- `versions`：`ProductionTagOwnerService` 先把 `snapshot.versions` 用于 digest，并把同一数组放入 owner result；`CatalogInventoryCoordinator.appendOwnerArrays()` 读取它，转换成合并预检的 `objectVersions`。它不写 command receipt，也不以 `versions` 原名进入 HTTP body。

这不是「跨界 JSON 字段名已盘清」：本节只完成按授权范围的后端→前端候选超集重建与数据流排除；后端→脚本的 `ManagedInvitationBootstrap` JSON 对仍登记为已知未覆盖，未做重扫、未做修复。

本节只新增静态证据，没有修改任何生产代码、契约、生成器或运行环境，也没有新增 HTTP、DEV、seed、浏览器 L2 或 UAT 结论。
