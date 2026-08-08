# P4 final implementation/runtime review input

REVIEW_CYCLE_ID: CATALOG_INVENTORY_P4_FINAL_20260808
REVIEW_TARGET: IMPLEMENTATION_AND_MANAGED_RUNTIME_EVIDENCE
reviewerKind: INDEPENDENT_REVIEW_REQUEST

请对当前 catering-v2s P4 最终字节与受管运行证据做独立 review，结论使用 `GO` 或 `NO-GO`，并给出 `M=<数量> / S=<数量> / N=<数量>`。不要把静态 PASS、API PASS、L2 PASS 或 DEV seed PASS 互相替代；分别核验业务与 cleanup。

## 本轮交付与证据

- 最终汇总：`doc/evidence/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-codex.json`
- 需求、IA、三阶段详设：
  - `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`
  - `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`
  - `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`
- API-only：`.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1786110744015-60959-f538d843/`
  - 26 scenarios / 100 cases，100 PASS / 0 FAIL，business PASS，cleanup PASS；seed 与 L2 runtime dependency 均为 false。
- L2-only：`.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1786125146298-78393-092a363f/`
  - 43/43 PASS，business PASS，cleanup PASS，API/seed dependency 均为 false。
  - `evidence/catalog-inventory-l2-progress.log` 有 43 条 START、43 条 PASS、0 条 FAIL；最后为 `completed=43/43 current=CI-L2-018-01 status=PASS`。
- 最终 DEV：
  - reset：`.runtime/r5/reset/r5-reset-7f69d8d4-f8f4-4ee3-8308-c30b567ef1c4/`
  - r5-full：`.runtime/r5/seed/rm1-seed-1b0d9c48-722e-499d-b515-ce693c636709/`
  - catalog seed：`.runtime/r5/catalog-inventory/seed/catalog-seed-3dcd3347-02be-4259-ad9e-daf76bb6582f/`
  - 真实 HTTP 459/459 为 200，73 个源商品中创建 72 个、排除 1 个，34 张媒体资产，五个 representative dataset 与 BOM/详情 readback PASS；business PASS，cleanup 为明确的 `PASS_PRESERVED_DEV_STATE`。

## 本轮重点核验

1. `scripts/dev/catalog-inventory-seed-executor.mjs`：总公司登录继承唯一品牌；target index miss 时使用 owner detail readback；canonical option-value BOM 的 stage/idempotency key 是否包含 `optionValueCode`，是否仍有同根 stage 碰撞；`PASS_PRESERVED_DEV_STATE` 是否与 reset 的破坏性清理职责一致。
2. `scripts/test/r5-joint-remote-l2-fixture.mjs` 与 `scripts/check/catalog-inventory-test-independence.mjs`：L2 分支是否真正跳过 API；独立性门是否有真实 red mutation；L2 每个 case 是否有 START 与终态日志。
3. `tools/catalog-inventory-p4/cli.mjs --self-test`：native DOM、L2 progress、错误场景触发、brand copy source 等门是否仍能拒绝对应错误变异；本轮 self-test 应为 PASS。
4. `InventoryOwnerService.java` 的 expression conflict targets 是否与 NULL-normalizing unique indexes 一致，并以 focused/backend/API evidence 证明重复写不会 42601/42P10/幂等冲突。
5. 业务边界：API 与 L2 不读 DEV seed、不读对方报告；DEV seed 只服务 Dexter 的本机体验；没有 UAT/生产或 runtime deployment 声称。

## 输出要求

每个 finding 请写明 path、证据类型（仓内事实/运行证据/推论/产品判断）、影响、最小修复建议；若只是证据边界或未来增强请标为 N，不要把明确的未执行范围误报为失败。请保留 API、L2、DEV 的 business/cleanup 分账。

授权边界：本 brief 仅请求 P4 最终 implementation/runtime evidence review；不因 review 自动授权新的 reset、seed、数据库/migration、UAT、部署或 Git 操作。任何新的产品语义与范围变化交 Dexter 决策。
