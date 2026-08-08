# Catalog / Inventory P3 current-byte review disposition (Codex)

status: `REMEDIATION_IMPLEMENTED_AWAITING_CLAUDE_RECHECK`
reviewTarget: `IMPLEMENTATION`
historicalReview: `doc/review/platform/2026-08-07-v2s-catalog-inventory-p3-current-byte-implementation-review-claude.md`
reviewBoundary: static P3 only; no API/HTTP runtime, database/migration, seed/reset, DEV/UAT, managed L2, deployment or cleanup claim

本文件是作者对 Claude current-byte review 的逐条 intake 与整改收据，不重写历史 verdict，也不创建第三轮独立子审查。历史两轮 independent-subagent review 已到上限；当前字节需要 Claude POST_REMEDIATION current-byte recheck。

## Disposition

| finding | disposition | owning source / evidence | smallest complete repair |
|---|---|---|---|
| S-01 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/catalog-inventory-p3/ia-reconciliation.mjs`、`doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p3-ia-control-reconciliation-codex.json`、`tools/catalog-inventory-p3/cli.mjs` | 契约级 IA-ID 的 locator 改为 `NOT_APPLICABLE`；checker 允许且只允许该值，并用红变异拒绝散文 locator；UI-ID 仍逐项在声明 sourceFile 内解析 |
| S-02 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RECHECK` | `tools/capability-invariants/cli.mjs`、`.runtime/compliance-control/hook-events/edge-codegen-p3-catalog-projection.{pre,post}.json`、`scripts/check/edge-codegen` | capability inventory 跳过 `P1_DEFINITION_ONLY` grouped catalog definition 与 `catalog-inventory-openapi-path-shard` projection；保留 canonical IAM surface；加入 projection 标记删除的真实红变异，重新生成唯一受影响的 WorkspaceAuthorizationCatalog |
| N-01 | `CONFIRMED` → `REGISTERED_HANDOFF` | `scripts/check/frontend-architecture` fresh output、`HANDOFF.md` | 记录七条旧页面 REQUIRED_EXPRESSION baseline；本域新表已不在失败集合，未把旧债并入 P4，也未借此修改旧页面 |
| N-02 | `CONFIRMED` → `CLOSED_STATIC_PENDING_RUNTIME` | `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`、`contracts/policy/catalog-inventory-l2-scenarios.json` | 复制向导断言 source→selection→preflight 状态推进；库存成功 fixture 断言提交后 before/change/after/ledger readback，负库存 fixture 断言具体阻断与输入保留；临时商品断言占用正式编码预检失败后输入仍保留 |
| N-03 | `CONFIRMED` → `EVIDENCE_PROVENANCE_RECORDED` | P1 query contract repair for M-03; P3 evidence authorization boundary | 在 P3 evidence 明确记录 CatalogItemPageQuery 扩展来自已批准的 P1 upstream repair，本轮只消费该修复，没有把它冒充 P3 新授权 |

## Static proof run

- `node tools/capability-invariants/cli.mjs --self-test`：PASS，包含 `RED_GENERATED_OPENAPI_PROJECTION=PASS`。
- `scripts/check/edge-codegen --self-test`：PASS。
- `scripts/check/edge-codegen`：PASS，254 generated output checks。
- `node tools/catalog-inventory-p3/cli.mjs --self-test`：PASS，包含 `P3_RED_MUTATION=CONTRACT_LOCATOR`。
- `node tools/catalog-inventory-p3/cli.mjs`：PASS，3 pages / 18 scenarios / 43 cases / 43 locators。
- operations-admin typecheck：PASS；L2 spec TypeScript check：PASS。
- `scripts/check/standards-coverage --phase R5`：PASS（150 rules）。
- `scripts/check/frontend-architecture`：仍为既有七条 REQUIRED_EXPRESSION baseline FAIL；CatalogWorkbenchPage 与 InventoryManagementPage 的新表不再出现。

上述结果全部是静态或编译层结果。P3 `businessStatus`、`cleanupStatus`、managed L2 与 89 个控件 runtimeStatus 仍保持未执行/未核验，不得升级为业务 PASS。

## Generalized prevention

1. **typed locator 与 source-of-truth 分离**：只有渲染控件才有可解析 locator；契约、生成物或 policy 断言必须使用 `NOT_APPLICABLE` 加 sourceFile/position 说明，checker 不再接受 prose locator。
2. **OpenAPI projection 不进入 IAM inventory**：定义文件、shard、edge root 的 canonical/projection 角色必须由机器可读标记表达；projection 复制或删除标记都必须有真实红变异。
3. **状态级 L2 分母**：业务-bearing scenario 至少要证明一个状态转换或 readback，不得仅以 locator 可见性代表行为；动态执行仍由 P4 负责。
4. **授权来源留痕**：跨包消费的已批准 upstream repair 要在当前 evidence 的 authorizationBoundary 中写出来源、范围与“非本轮新增”的归因。
