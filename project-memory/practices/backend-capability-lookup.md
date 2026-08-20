---
id: practices.backend-capability-lookup
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["all"]
owners: ["backend","platform","contract"]
impacts: ["architecture","contract","owner"]
triggers: ["task-start","implementation","review"]
assertions: ["EXISTING_CAPABILITY_BEFORE_DESCRIBING_BEHAVIOR"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 我需要一个后端/契约能力 —— 先查这张表

**触发时刻**:准备设计一个 owner、授权、并发、凭证、跨模块协作或目录机制。

⛔ **描述之前先查。查到就接上它,不要另造一个平行机制。**

## 按意图查

| 我要 | 用这个 | 关键约束 |
|---|---|---|
| **运营侧写授权** | `organization.api.OperationsOwnerScopeGrant`(server-minted,edge 解析后传入事实 owner) | owner 须在 CAS/审计/replay **之前**复核 grant 的 workspace、group、target type、target reference、capability、operation purpose。⛔ 不得把一个 grant 泛化;⛔ 请求体/session 投影/UI capability 不是授权真相 |
| **平台侧写授权** | **无 capability 模型** —— 有效平台 session + platform owner 对已启用状态的最终复核 | 契约用 `x-required-platform-authorization`;**生成链与不变量门必须拒绝 platform-admin 的 `capabilityKey`**。亲验:`modules/platform-admin-iam` 下确无 capability |
| **跨 owner 写** | **edge 的 operation policy 显式列出有限 owner command**,同一 `REQUIRED` 事务 | 见 `contracts/registry/generated/operation-handler-bindings/`。⛔ 不要让 owner A 直接调 owner B 的 command —— 会形成模块环 |
| **跨 owner 读(避免依赖环)** | `organization.api.*Lookup` 一族(依赖倒置) | 由需要方声明接口、事实方实现 |
| 乐观并发 | `expectedVersion` + `version` 列 | 全仓统一 |
| 不透明凭证 / 引用 | asset 模块的 opaque ref 手法 | 主程序只持 opaque ref 与治理信号;token 不进主库 |
| **一份定义 × 多类宿主** | `extension` 模块:`ExtensionHostTypes` / `ExtensionDefinitionService` | `MANAGEMENT_HOST_TYPES` 恰 **8** 个(BRAND/TENANT/HEAD_COMPANY/STORE/CONTRACT/COMMERCIAL_GROUP/REGION/PROJECT);`definitions` 存**单列**、`replace(...expectedVersion...)` **整体原子替换 + CAS** ⇒ 这类聚合**物理上分不了页** |
| **订单上报商场 ERP 的映射** | `store-contract` 的**货号**:`Item(itemCode, itemName)` | G-09:一份合同可有多个、合同内编码唯一。⛔ 未来做订单同步**必须接它**,不得另造映射;G-09 已登记「多份有效合同的货号选择待裁决」 |
| 集合接口的形态判定 | `project-memory/practices/collection-boundary-modes.md` | 先判 Page/Cursor/Bounded/Detail,再写实现 |
| 目录类静态数据 | **checked-in 契约 JSON**,随代码交付、随发布生效 | ⛔ 不建 DB 表、不建后台维护页;判据:「加一个平台 = 部署适配器 + 一行目录数据,主程序零代码改动」 |
| 业务验收 | `backend-acceptance`(唯一能力) | 真 HTTP + 真容器 + 手写 fixture/request/businessOracle,产出分离的 `CONTRACT`/`BUSINESS`;DB 调用数**不设门**;总数上限 **80**。⚠️ 模块 Gradle test **不是** business PASS |

## 模块与 schema(2026-08-18 亲验)

`catalog` · `organization` · `inventory` · `store-contract`(schema `contract`)· `extension` ·
`asset`(schema `platform_asset`)· `fulfillment-production` · `workspace`(schema `platform_workspace`)·
`workspace-iam`(schema `workspace_iam`)· `platform-admin-iam`(schema `platform_iam`);
横切无 owner API:`audit-model` / `audit-read` / `execution-context` / `foundation`。

⚠️ **不存在名为 `workspace` 的 schema** —— `workspace` 与 `workspace-iam` 是**两个模块两个 schema**。

## 模块该不该拆(判据)

⛔ **不按管理后台拆** —— 后台是消费面,不是域。
✅ 按**域**拆,三条判据须同时成立:①两边能各自独立存在;②变化原因不同;③依赖单向。
⚠️ 「独立存在」「变化原因不同」对同一模块内的多个实体同样成立,**单独用不构成拆分理由**。
⚠️ **拆之前先确认依赖能保持单向** —— 若需要反向级联写,那不是两个模块,是一个 edge 编排。

- **判别式**:我正在设计的这个机制,**仓里真的没有吗**?我是按名字找的,还是按**意图**找的?
