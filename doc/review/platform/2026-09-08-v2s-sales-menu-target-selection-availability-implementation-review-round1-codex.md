# 销售菜单目标选择与细粒度沽清 · IMPLEMENTATION independent review Round 1

```text
REVIEW_CYCLE_ID=R5-SM-TARGET-SELECTION-AVAILABILITY-IMPLEMENTATION-20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
```

## 独立性与范围

本报告由 fresh independent subagent 以证伪优先形成；reviewer 先完成当前仓库字节与 owning source 的盲审，再对照作者材料。reviewer 未写文件、未使用 Git、未启动或停止 DEV、未 reset、未 seed、未执行 backend acceptance、browser L2、UAT 或部署。本轮没有实现 blocker；本报告不授权任何动态动作。

审查输入包括入口与授权、`doc/platform` 三份编码/基础/复核规范、独立审查治理 decision、本批 Journey/requirements/interaction/implementation design/plan、Claude follow-up design review、六个 project-memory kernel 与 review/verification/business corpus 相关 memory，以及以下当前 owning source：

- `apps/backend/catering-business-server/modules/sales-menu/` 的 domain、owner service、API、migration 与测试；
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/` 的 Catalog/SalesMenu scenarios；
- `apps/frontend/operations-admin/src/features/sales-menu/` 与 `src/tests/l2/sales-menu.spec.ts`；
- `contracts/openapi-source/sales-menu.schemas.json`、generated edge output、SalesMenu L2 blueprint/bindings/scenarios；
- `scripts/generate/sales-menu-p1.mjs`、`scripts/test/browser-l2-runtime.mjs`、`scripts/test/sales-menu-l2-fixture.mjs`；
- `scripts/dev/sales-menu-seed-plan.mjs`、`scripts/dev/sales-menu-seed-executor.mjs`；
- Catalog fixture/generator/owner bridge 与 `libraries/frontend/admin-ui-foundation/` 复用能力。

## 逐点结果

| 业务事实 | 结论 | 当前证据 |
| --- | --- | --- |
| 同一 Catalog 商品可形成多个 SalesItem，各自选择 SKU 子集且每 SKU 有独立菜单价 | 未发现 blocker | `SalesMenuAcceptanceScenarios.java` 的重复 `catalogRef`、双 SalesItem、单 SKU 发布与 1599/1799 readback 断言 |
| 普通商品可保存 required/optional 选项值子集，optional 可为零 | 未发现 blocker | `SalesMenuAcceptanceScenarios.java` 的 required 1 值、optional 0 值 draft/published readback |
| ITEM/SKU/ORDER_OPTION_VALUE 人工沽清为独立目标事实 | 未发现 blocker | `SalesMenuOwnerService.requirePublishedManualTarget`、目标级 current/event key、SKU/option sold-out/restore 与 operation record 断言 |
| 库存自动不可售、销售项人工状态、子目标人工状态相互独立 | 未发现 blocker | acceptance 中 ITEM manual、库存 auto unavailable、SKU/option child 状态的独立 readback |
| DISABLED/VOIDED SKU 不进入候选，保存与发布重新校验 | 未发现 blocker | Catalog `ENABLED` candidate projection、SalesMenu update/publish revalidation、VOIDED/DISABLED HTTP negative scenario |
| 发布移除 child target 不产生 detach event，重新加入不复活旧状态 | 未发现 blocker | `removeUnpublishedChildManualStatuses` 与 publish detach/no-resurrection scenario |
| 前端 SKU/选项选择与 target status 控件 | 未发现 blocker | Drawer/Modal 使用 `salesMenuTestIds` 真实 checkbox/radio/input/button，并复用 foundation lifecycle/overlay 能力 |

Same-root scan 未确认新增遮蔽式 fallback、旧 item-only status action、generated drift、shape 混用静默丢弃、target membership 绕过或跨 owner 写入。inventory dependency-absent 的 `UNKNOWN/READ_UNAVAILABLE` 是既有 guard，未发现其覆盖本批 manual facts 的证据。

## Evidence layering

- `L1_ENGINEERING`：静态 source、契约/generated、migration、generator、frontend architecture/typecheck、backend compile/testClasses 与 focused/unit tests 已形成当前可复核证据。
- `L2_USER_VISIBLE`：生产源码与 L2 locator source 已证明控件形态和绑定设计；本轮尚未执行真实浏览器，因此不能把静态控件证明升级为浏览器行为 PASS。
- `L3_UNVERIFIED`：backend acceptance/Testcontainers、browser L2、DEV/seed/reset 与 seed executor business/cleanup、UAT 尚未执行。reviewer 的 LSP 工具调用返回 `Transport closed`，因此本报告不把 LSP 当作已证据；主 agent 的仓库 typecheck 另行记录。

## Verdict block

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS_STATIC_WITH_DIAGNOSTIC_GAP: source-level backend/frontend/contract/migration/generator alignment reviewed; lsp_diagnostics unavailable because omx_code_intel returned Transport closed
L2_USER_VISIBLE=PASS_STATIC_AND_L2_SCRIPT_SOURCE: UI exposes SKU subset/price, option value subset, target-level status controls via approved testIds; browser execution not run in this review
L3_UNVERIFIED=backend acceptance not executed; browser L2 not executed; DEV/runtime/seed/UAT not executed; LSP/typecheck not executed due tool failure
SAME_ROOT_SCAN=no confirmed same-root omission/fallback/old-status/generated-drift blocker; notable non-blocking guard: inventory owner absent returns UNKNOWN/READ_UNAVAILABLE rather than hiding manual facts
DESIGN_GAPS=none confirmed in implementation review
EVIDENCE_TIER=static source + focused test source present; no current-turn HTTP/browser/runtime proof
```

