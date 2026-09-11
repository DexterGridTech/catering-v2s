# 独立 DESIGN 盲审最终报告（Round 2）：经营渠道“到店点餐允许外部接入”

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B_DOCUMENT_EXTRACTION
BLIND_REVIEW_DECLARATION=本轮只对 Round 1 S-01 与 checklist 指定路径做最终定向复核；不继承作者自报，未写文件，未动态执行。
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/2
EVIDENCE_TIER=STATIC_DESIGN_ONLY
RUNTIME_EXECUTION=NOT_RUN
```

## 1. Round 2 定向复核结果

### S-01 已闭合

Round 1 指出的 active generator source 清单缺口已修正。当前需求分析已明确：

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:570-603` 是 operation error set source；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:150-170` 是 error active disposition source；
- `scripts/generate/r5-edge-materialize.mjs:11-15,340-394` 负责 materialized OpenAPI；
- `scripts/generate/edge-codegen.mjs:17-24,60-66,199-203,233-237,978-982` 参与 Java/TS closed-set生成；
- source 必须先更新，再 materialize/codegen；禁止只修改 generated/materialized/feedback；
- `DINE_IN_MUST_BE_INTERNAL` 是否完全删除 runtime enum 仍由生成闭集处置决定，分析没有擅自替代该决策。

最终状态：`REJECTED_WITH_EVIDENCE_AS_CURRENT_DEFECT`。当前分析无需再为 S-01 修改。

### 未发现新的 M/S finding

Round 2 未发现修订引入 TAKEAWAY 替代 DINE_IN、provider 虚构、销售菜单放宽、既有菜单事实改写、新 owner/operation/字段或其他 S/M 问题。

## 2. 保留的 N 项与未验证边界

### N-01 · 真实 DINE_IN provider 与范围决策

```text
status=DEXTER_DECISION
```

当前 external catalog/provider 仍无 DINE_IN capability。D-01/D-04 需要 Dexter/provider 明确真实 external system/provider、支持哪些 `dineInForm`，以及本批是形成可用 provider 闭包还是只解耦模型规则。D-02 需要明确新规则是否同时适用于 PROJECT 和 STORE。未决前不能声称 external DINE_IN 已可用。

### N-02 · UI/动态证据

```text
status=UNVERIFIED_REQUIRES_EVIDENCE
```

本轮按授权未启动 DEV、reset、seed、backend acceptance、browser L2 或 UAT。O2 Drawer 的 provider 空态、DINE_IN form、错误恢复、foundation/TestIds/L2 行为以及后端 runtime 闭包必须留到 implementation-facing 详设与实施验收证明。

## 3. 三维结论

```text
L1_ENGINEERING=PASS_FOR_S01
L2_USER_VISIBLE=GO_WITH_UNVERIFIED_UI
L3_UNVERIFIED=N-01 DEXTER_DECISION; N-02 UNVERIFIED_REQUIRES_EVIDENCE
```

销售菜单边界已重新核对：`BusinessChannelOwnerService.java:353-456`、`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md:162-182`、`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md:775-791` 仍只认 STORE + INTERNAL + DINE_IN/TAKEAWAY。外部 DINE_IN 只能作为经营渠道语义在 provider capability 闭包成立时存在，不能成为销售菜单候选或直接资格复核目标。

## 4. Round 2 终止边界

本轮声明 `ROUND_FINAL_DECISION=SELF_DECIDED`。同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 的两轮已全部使用；不得召集第三轮。D-01/D-04/D-02/D-03 的产品、能力和 active error 处置继续交 Dexter/Claude 处理；若 Dexter 实质改变 Journey、provider、范围或授权，应建立新的设计输入/cycle，而不是重置本 cycle。
