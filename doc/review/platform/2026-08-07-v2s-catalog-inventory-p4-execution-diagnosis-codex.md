# 商品目录与轻库存 P4 执行诊断（Codex）

> 状态：DIAGNOSTIC_INPUT_FOR_CLAUDE_REVIEW
>
> 本文只整理当前执行链路、证据和根因，不把未完成的 API/L2/DEV 运行宣称为 PASS，也不改变 P4 的授权边界。

## 1. 先给结论

这次目标拖长，不是单个接口用例本身需要十小时，而是执行链路同时存在三类问题：

1. **L2-only 的实现并不真正独立**：父 runner 有 `--catalog-l2-only`，但 owner fixture 在 `R5_JOINT_CATALOG_STAGE=L2` 时仍先调用完整的 `catalog-inventory-api.mjs`，API 失败会阻止 L2 启动。这违反了已冻结的“API → L2 顺序只适用于联合模式；单独入口必须各自可运行”的要求。
2. **API fixture 首败后没有在 fixture 前置阶段 fail-fast**：BOM upsert 首次失败后，100 个 case 继续运行；依赖同一 void fixture 的 006-02…006-10 重复进入半初始化 helper，并产生二次 409 噪声，掩盖首因并显著放大耗时。
3. **后台存在真实 owner 缺陷**：`InventoryOwnerService.saveCatalogProductBom` 使用没有 conflict target 的 `ON CONFLICT DO UPDATE`，PostgreSQL 直接返回语法/推断错误。这个缺陷与 DEV seed 无关，但它使 API 独立验收无法完成。

因此当前正确状态是：

```text
backend unit/contract：此前受管运行 PASS（独立于 seed）
API HTTP 100 cases：未完成；当前 run 首败为 BOM upsert，业务 FAIL/未完成
L2 43 cases：尚未取得真正独立运行证据；当前实现仍被 API 调用链耦合
DEV catalog-inventory seed：尚未作为最终独立体验交付完成
```

## 2. 已完成的工作（按层而不是按文件罗列）

### 2.1 契约与静态门

- P1 契约、generated wire、读模型、场景与 fixture catalog 已落地；case-level `polarity`、`expectationKind`、`conditionToProblemRef` 已形成机器可检查的分母。
- P2 owner/API 实现已落地，包含 catalog、inventory、production-tag、copy/preflight、multipart asset、typed problem、幂等和版本校验。
- P3 operations-admin UI、L2 场景、locator bindings 和 IA 对账已落地；P3 静态复核最终 GO。
- `scripts/check/catalog-inventory-test-independence.mjs --self-test` 当前 PASS，但它只检查源文本中的入口、禁止引用和联合模式标签顺序，尚未检查 L2 分支是否实际跳过 API 调用。

### 2.2 API/L2 运行入口改造

- `scripts/test/r5-joint-remote-l2.mjs` 已增加 `--catalog-api-only`、`--catalog-l2-only`，每次运行使用 fresh managed namespace、自己的 credentials、自己的 owner/workspace bootstrap 和独立 cleanup。
- API runner `scripts/test/catalog-inventory-api.mjs` 只读取静态 contract/fixture catalog，并通过 owner HTTP 创建自己的商品、库存、资产和复制测试事实；没有读取 DEV seed report 或 L2 report。
- L2 fixture `scripts/test/catalog-inventory-l2-test-fixture.mjs` 通过 owner HTTP 创建自己的浏览器事实，L2 spec 只读取自己的 sidecar/private env 和 locator policy；没有读取 API report 或 DEV seed report。
- catalog seed executor/DEV seed 不在 API/L2 运行入口中调用；最终 seed 被设计为单独的 DEV 体验动作。

### 2.3 已取得的动态证据

- backend unit/contract 阶段此前取得 PASS，报告位于各 run 的 `results/catalog-inventory-backend-unit-tests.json`；该层声明 `seedRuntimeInput=false`。
- 本轮 API-only run：
  - run 目录：`.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1786106837015-80830-a370469f`
  - `LOCAL_MANAGED_START`、readiness、独立性静态门与 fixture bootstrap 均曾 PASS。
  - 首个业务破坏点：`CI-API-006-01` 保存 BOM 时后端返回 500。
  - 旧 runner 被受控停止；本机 PID 树和远端 database/role/asset prefix 均按 manifest 精确读回清理完成。手工补充证据：`evidence/manual-owned-runtime-cleanup.json`。
- 该 run 没有产生完整 API terminal report，因此不能宣称 API business PASS；它只能作为首败诊断证据。

## 3. API/L2/Seed 独立性审计

### 3.1 应当成立的边界

| 层 | 可读取 | 不得读取 | 本层自己创建/产出 |
|---|---|---|---|
| 后端 unit/contract | 源码、契约、Testcontainers 测试上下文 | DEV seed、API/L2 report | 测试结果和受管 runner 日志 |
| API HTTP | 静态 scenario/fixture、自己的 managed manifest、自己的 owner HTTP bootstrap | DEV seed report、L2 sidecar/report、上一轮 API report | API 对象、API report、调用/错误日志 |
| L2 | 静态 locator/scenario、自己的 managed manifest、自己的 owner HTTP fixture、自己的 sidecar/private env | API report、DEV seed、API 创建对象 | 浏览器事实、L2 sidecar、Playwright 结果 |
| DEV seed | catalog-inventory seed plan、真实 multipart 资产、owner commands/readback | API/L2 report 作为前置或成功依据 | DEV 体验数据、seed report、readback/cleanup |

四域 workspace、账号、角色和组织节点的 bootstrap 可以在每个 fresh run 内重新创建；它是运行前提，不是商品目录 seed，也不允许跨 run 复用。

### 3.2 当前实际代码的独立性缺口（核心）

`scripts/test/r5-joint-remote-l2-fixture.mjs` 当前调用链是：

```text
catalogStage=L2
  -> P4_CONTROL_RECONCILIATION
  -> CATALOG_INVENTORY_API   <-- 当前仍会执行
  -> CATALOG_INVENTORY_L2_TEST_FIXTURE
```

证据：该文件在 API command 处只有 `label: 'CATALOG_INVENTORY_API'`，随后仅用
`if (catalogStage === 'API') process.exit(0)` 截断；没有 `catalogStage !== 'L2'` 的 API guard。
因此 `--catalog-l2-only` 并不是独立 L2：它会等待 API 100 cases，并受 API 首败影响。

已有独立性 checker 没抓到它，原因是 checker 只断言：

- L2 入口字符串存在；
- API/L2 label 顺序正确；
- API-only 有 `process.exit(0)`。

这些是必要条件，不是充分条件。需要把“L2 stage 不得执行 API command”作为真正的机械断言，并用红变异证明。

### 3.3 不属于独立性缺陷的内容

- API 读取 `catalog-inventory-fixture-catalog.json` 中名为 `seedDatasets` 的静态定义，不等于读取 DEV seed；它只提供形状与 readback 期望。名称容易误导，但当前不是运行时依赖。
- L2 fixture 中的 `SEED-LATTE`、`SEED-CAESAR` 等是 fixtureRef，不是从 DEV seed 查询的对象；实际 code/ref 由本轮 HTTP 创建并写入 sidecar。
- API 和 L2 各自需要登录、workspace、data node、brand、store 等 bootstrap 事实，这是各自 fresh namespace 的合法前置，不应被误删为“零依赖”。
- 联合模式 API → L2 的顺序本身是正确的；问题是独立 L2 入口错误地复用了联合模式的 API 子步骤。

## 4. 首败与耗时放大链

### 4.1 首败：BOM upsert

`apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java` 的
`saveCatalogProductBom` 使用：

```sql
ON CONFLICT DO UPDATE
```

没有 inference specification 或 constraint name。当前 schema 的 BOM 身份还包含可空的 `sku_code`/`option_value_code`，并已有表达式唯一索引 `ux_stock_bom_owner_identity`。因此这不是测试数据偶发问题，而是 owner 写路径没有实现合法的冲突目标。

### 4.2 次生噪声：fixture 重试污染

`ensureVoidObjectFacts` 在多个 CI-API-006 case 中被调用。首次调用在 BOM 保存处失败后，后续 case 再次创建分类时复用同一 idempotency key 但生成了不同 code，得到 `VOID_CATEGORY_CREATE_HTTP_409_IDEMPOTENCY_MISMATCH`。这些 409 是首败后的 fixture 重入噪声，不应被当成新的业务根因。

### 4.3 放大器：case loop 不在共享 fixture 失败时 fail-fast

API runner 将单 case 异常记录后继续执行剩余 case。对于独立、可复用的前置事实，正确策略应是：

1. 先一次性构造并 readback 共享 fixture；
2. 构造失败时立刻停止 API business run，保留首败、fixture phase、日志和 cleanup；
3. 只有共享 fixture PASS 后才进入 100 case loop；
4. case 内部的业务负例仍可继续跑完并逐条记账。

这样不会把一个 owner defect 放大成几十个重复失败，也能把 API 运行时间从“首败后仍继续”降到可诊断范围。

## 5. 已确认的根因分类

| 根因层 | 事实 | 处理方向 |
|---|---|---|
| runner wiring | L2-only 仍调用 API | 修 stage guard + checker red mutation |
| owner business | BOM upsert conflict target 非法 | 修 owner SQL，按现有 BOM identity 唯一索引实现 upsert |
| fixture lifecycle | 共享事实失败后反复进入 helper | promise/一次性 fixture barrier；共享前置失败 fail-fast |
| evidence/门 | 独立性门只验字符串存在和顺序 | 增加可执行 stage 分支检查，不以关键词替代行为测试 |
| 运行组织 | API、L2、seed 都被放在同一长期 goal 中多次重跑 | 固定三步：API unit/HTTP → L2-only → 最终 DEV reset→seed；每步 fresh run、各自 business/cleanup |

## 6. 最小收口顺序（建议给 Claude 诊断）

1. 先确认并修复 L2-only stage guard；更新独立性 checker，红变异必须证明“移除 guard 会失败”。
2. 修复 BOM upsert 的真实 owner SQL，并补最小 focused test/编译证据。
3. 将 API 共享 fixture 变成一次性 barrier，失败立即终止，不进入剩余 case；成功后再跑 100 cases。
4. 用全新 managed namespace 单独跑 backend unit/contract（如实现有改动则重跑），再跑 API-only；API business 和 cleanup 均 PASS 后才允许 L2-only。
5. 用另一个全新 managed namespace 跑真正的 L2-only，确认其运行目录没有 API report/API events，并取得 43 cases 的业务与 cleanup evidence。
6. 最后才执行一次独立 DEV `reset → start → seed --profile catalog-inventory`，回读 73 商品/34 图片及代表商品图、并将 DEV business/cleanup 分开记录。

## 7. 请 Claude 重点诊断的问题

请不要把本文当结论直接接受，按当前源码和证据独立核验：

- `--catalog-l2-only` 是否真的不执行 `catalog-inventory-api.mjs`；
- 当前独立性 checker 是否能拒绝“L2 分支偷偷调用 API”的红变异；
- BOM upsert 首败是否确为 owner SQL 根因，以及表达式唯一索引下的最小合法 upsert 方案；
- API 共享 fixture 失败是否应在 case loop 前 fail-fast，还是存在必须继续的业务理由；
- API/L2 是否读取了 DEV seed、对方 report 或跨 run object；
- 在不扩大范围的前提下，API → L2 → DEV seed 的最短可验收顺序。

请输出 `GO` 或 `NO-GO` 及 `M=<数量> / S=<数量> / N=<数量>`；每条 finding 写明章节、仓内证据、影响、最小修复和是否需要 Dexter 裁决。

## 8. 当前授权边界

本诊断阶段不启动新 API/L2/DEV run。后续修复与运行仍在 Dexter 已授予的 P4 范围内，但必须遵循：API 与 L2 各自 fresh namespace、API 先于 L2、seed 只在两者完成后用于 DEV 体验、每层分别记录 business/cleanup，不以静态门或另一层 PASS 代替本层运行证据。
