# Claude 定向复核请求：final catalog contract / fixture-DAG design POST_REMEDIATION_V1

请对以下 **POST_REMEDIATION_V1 定向设计修复** 做独立静态复核，并输出 `GO` 或 `NO-GO`，按
`M / S / N` 分级逐项给出源码或制品证据。请先自行重开仓根材料与当前字节，再读作者结论。

## 背景与目标

最终后台性能验收仍处于静态设计阶段，尚未启动动态环境。396 条观测分母不变：U05=78+5、
U04=79+38、U07=196；其中 route value 分母为 592（462 path + 130 required query），113 条命令。
此前设计把 catalog owner response 修复和完整 fixture-DAG materialization 混入一个五文件单元，且
manifest 引用了一个已改名的设计标题。独立 Round 1/2 已分别发现并停止该问题。

本次最小修复只请求批准一个 **6 路径、静态、owner-contract/edge-handoff** 单元：

1. catalog `CatalogOwnerService`；
2. category owner integration test；
3. 新 temporary-promotion owner integration test；
4. 新 temporary-promotion operations edge integration test；
5. operations `CatalogItemDrawer`；
6. `CatalogManagementPage` focused test。

它修复两项既有 owner/contract drift：

- category delete 返回已声明的 `categoryRef/deletedSubtreeSize/deletedCategoryCodes`，不再返回
  `deletedCount`；同-key delete replay 的真实策略必须显式选择且验证，不能在 owner recheck 前全局提前 receipt；
- temporary promotion preflight 返回单层 `{revision,requestId,data:<detail>}`，UI 消费
  `response.data`，不再依赖历史 `response.data.data`。

临时外部订单商品必须在 final run 的正常 owner HTTP 生命周期中创建：create → save
`EXTERNAL_ORDER_TEMPORARY/GOVERNANCE_TODO` → detail → preflight → execute。同一 operations STORE/HC
会话、明确 `dataNodeRef`、live `EDIT_*_CATALOG` capability、server grant、owner recheck、`REQUIRED`
事务均不得改变。不得使用 terminal fixture、SQL、RM1/R5 runtime/seed、或新产品 API/能力。

完整 592-binding / 113-builder fixture-DAG、catalog/checker/materializer/workload/adapter 转换 **已明确拆出，
不属于本轮 6 路径实施承诺**；它将在本单元得到静态 implementation evidence 后另行 detailed design。

## 必读制品（仓根相对路径与 SHA-256）

| 制品 | SHA-256 | 核验重点 |
| --- | --- | --- |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-intake.md` | `898fcd19b36aaed040fc73bb4e4269077b3e901cb96f53553f86b995ea8c2b4e` | 业务角色、6 路径、split boundary |
| `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-input.md` | `d91040b09efed953d69ed33d9df5a00c43a1036551de0a0439cd2cf2c2b1f022` | design-only authority |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-granularity-manifest.json` | `331fe824ac7edb31ae9ae49432d6a406d5d63b7a27236bf58dea7a07dba58611` | six exact surfaces、POST_REMEDIATION binding |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-review-round1.md` | original Markdown retained | Round 1 NO-GO history |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-review-round2.md` | original Markdown retained | Round 2 NO-GO history / hard stop |
| `doc/review/platform/2026-08-10-v2s-backend-performance-final-catalog-contract-dag-design-author-intake.md` | `b56018bb51b56fbdf393c56f2e1945d9a9d399409f862bc6b5035c2c3adda2de` | M-000/M-001/S-001/M-002 disposition |
| `doc/evidence/platform/2026-08-10-v2s-backend-performance-final-fixture-dag-false-green-problem-family.json` | `096201ec0ad9502944464ef901ed781f0eec43f3bc6de6118ff4aac4fed598ea` | FFDG-01..08 prevention closure |

请重开并核验下列 owner/contract/consumer，而不是只读设计：

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `contracts/openapi/catalog-inventory.openapi.yaml` 与 byte-coverage/generator inputs
- catalog coordinator、operations edge controller、workspace command token/capability 输入
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `scripts/test/catalog-inventory-l2-test-fixture.mjs` 中 normal temporary owner-HTTP shape
- `scripts/check/implementation-design-granularity --manifest ...catalog-contract-dag-design-granularity-manifest.json --review ...catalog-contract-dag-design-review-round2.json`

## 独立复核重点

1. POST_REMEDIATION 的唯一代码/设计变化是否确实只是将 manifest source anchor 对齐到已存在的
   `## Finite executable-DAG follow-on boundary`，无 source surface、分母、权限或动态范围扩大？
2. 六路径划分是否足以证明 owner→operations edge→grant/context→owner 的完整 promotion handoff，且没有
   漏列应变文件？
3. category delete 与 promotion preflight 的 canonical raw response 结论是否与 OpenAPI/owner/consumer 一致？
4. `IDEMPOTENT_SAME_KEY` delete replay 风险是否被诚实保留为实施时必须选择/证明的契约项，而不是被假定关闭？
5. 临时商品 normal owner HTTP 生命周期是否保持 platform-admin / operations-admin、session、capability、
   `dataNodeRef`、owner transaction 的业务边界？
6. 不得把 396/592/113 baseline、静态 gate PASS 或此前 R5 技术证明描述成动态性能成功。

## 当前机械证据

`implementation-design-granularity` 对当前 manifest 与保留 Round 2 JSON 已 PASS，模式为
`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`；problem-family self-test 与 standards coverage (`R5`) 均 PASS；
`.runtime/backend-performance/` 为空。

## 授权边界

本请求仅为静态设计 POST_REMEDIATION 复核。即使 `GO`，也只允许将六路径纳入独立静态 implementation
package；**不授权**动态环境、DEV、reset、seed、Testcontainers、L2/UAT、部署、手工 SSH/SQL、RM1/R5
runtime 复用或任何 SQL 数值优化成功声明。完整 fixture-DAG 仍需另行详设与独立复核。
