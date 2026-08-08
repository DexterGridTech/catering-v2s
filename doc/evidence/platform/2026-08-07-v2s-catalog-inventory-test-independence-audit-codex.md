# 商品目录与轻库存 API / L2 独立性审计

## 结论

当前实现已经把三件事分开：

1. API 是后台接口验收链；它在自己的受管 fresh namespace 中由 owner HTTP fixture 创建对象，生成自己的 API report。
2. L2 是前端可见性验收链；它在另一条独立命令和 fresh namespace 中由自己的 owner HTTP fixture 创建浏览器事实，只消费自己的 fixture sidecar/private env。
3. `catalog-inventory` seed 只用于最终 DEV 体验，不进入 API 或 L2 的输入，也不参与两者的通过判定。

API/L2 仍复用四域 workspace、账号、角色和组织节点的 owner bootstrap，这是运行前提而不是 catalog seed 数据；每次独立 stage 都重新创建，不共享数据库对象、cookie、报告或版本。

## 依赖矩阵

| 层 | 独立入口 | 允许输入 | 禁止输入 | 自己产出的运行时事实 |
|---|---|---|---|---|
| 后端单元/契约 | Gradle catalog/inventory test tasks；Testcontainers 类需受管远端 runner | 源码、契约、测试 fixture | DEV seed、L2 report | 测试结果与日志 |
| API HTTP 接口 | `scripts/test/r5-joint-remote-l2.mjs --catalog-api-only` | managed manifest、静态 contract fixture、自己的 owner HTTP fixture、自己的账号/节点 bootstrap | catalog seed report、L2 sidecar、L2 report | `results/catalog-inventory-api/` report、自己的对象与调用日志 |
| L2 前端可见性 | `scripts/test/r5-joint-remote-l2.mjs --catalog-l2-only` | managed manifest、静态 locator/scenario、自己的 owner HTTP fixture、自己的 `private.env` | API report、catalog seed report、API 创建对象 | `catalog-inventory-l2-test-fixture.json`、Playwright结果、自己的对象与日志 |
| DEV 体验 | `scripts/dev/reset` 后显式 `scripts/dev/seed --profile catalog-inventory` | catalog seed plan、真实资产字节、owner HTTP 命令 | API/L2 report 作为授权或成功依据 | DEV seed report、readback、人工体验状态 |

## 代码级边界

- API runner 的 `fixtureDatasets` 来自 `contracts/policy/catalog-inventory-fixture-catalog.json`，只作为静态形状/读回预期；它不从 DEV seed report 或 L2 sidecar 取得对象 ID。
- L2 fixture 的 `SEED-*` 字符串是静态 fixtureRef，不是运行时 seed 读取；真实对象由本次 L2 owner HTTP fixture 直接创建，并把精确 item/target ref 写入 L2 sidecar。
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts` 只读取 `results/catalog-inventory-l2-test-fixture.json` 和 locator policy；不读取 API report 或 seed report。
- `scripts/test/catalog-inventory-backend-unit.mjs` 先运行 catalog/inventory owner module tests，再经受管 remote Testcontainers runner 运行两个 app-level contract/authority tests；它不启动 API HTTP cases，也不读取 seed。
- catalog-only stage 会跳过历史 `r5-full` seed report finalization；`seed-report.mjs` 在 API/L2 中仅提供 generated operation registry/path helper。
- 联合兼容模式固定为 API → L2；API-only 在 API fixture 结束后退出，L2-only 在自己的 fixture 后写最小 private env 并退出，均不继续旧域 fixture。

## 已建立的机械防线

`scripts/check/catalog-inventory-test-independence.mjs` 检查：

- API/L2 源码没有跨层 report 或 catalog seed executor 输入；
- 两个独立入口存在且 stage 会在旧域 fixture 前终止；
- 联合模式的可执行调用标签顺序为 API → L2；
- self-test 的红变异会拒绝 API/L2 顺序交换。

最近一次静态结果：

```text
CATALOG_INVENTORY_TEST_INDEPENDENCE_SELF_TEST=PASS
BASELINE=PASS
RED_MUTATION=ORDER_REJECTED
```

## 验收口径

“独立”不等于“没有任何运行前提”：数据库、edge、账号和数据节点必须由本次受管 run 自己准备；但它们必须是本 run 的 bootstrap 事实，不得来自 Seed/API/L2 的上一轮结果。后端 JUnit/契约测试、API HTTP 100 cases、L2 43 cases 和 DEV seed 仍分别记业务与 cleanup 状态，不能以一层的 PASS 替代另一层。
