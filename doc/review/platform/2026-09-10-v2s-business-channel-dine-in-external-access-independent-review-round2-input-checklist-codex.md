# 独立 DESIGN 定向复核输入清单（Round 2）：经营渠道“到店点餐允许外部接入”

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B_DOCUMENT_EXTRACTION
BLIND_REVIEW=true
IMPLEMENTATION_AUTHORITY=false
RUNTIME_EXECUTION=NOT_RUN
HASH_LEDGER=RETIRED_NOT_USED
```

## 1. 复核任务

这是同一 DESIGN review cycle 的最后一轮定向复核，不是新的 cycle，也不是第三轮。请只读重开当前仓库字节，验证主 agent 对 Round 1 S-01 的文档处置是否真正闭合，并检查修正有没有引入业务漂移。不得写文件、修改代码/文档、启动 DEV、reset、seed、backend acceptance、browser L2 或 UAT。

Round 1 报告：

- `doc/review/platform/2026-09-10-v2s-business-channel-dine-in-external-access-independent-review-round1-codex.md`

当前需求分析：

- `doc/plans/platform/2026-09-10-v2s-business-channel-dine-in-external-access-requirements-change-analysis-codex.md`

## 2. 必须定向验证的事实

### 2.1 S-01 source-first 闭包

重新读取并逐项核对：

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:570-603`；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:150-170`；
- `scripts/generate/r5-edge-materialize.mjs:11-15,340-394`；
- `scripts/generate/edge-codegen.mjs:17-24`；
- analysis 当前版本关于 active contract/error surface、Contract 影响和实施顺序的对应段落。

判断标准：分析必须明确两个 catalog 是 source of truth，必须 source-first 更新后再 materialize/codegen，不能只改 materialized/generated/feedback；同时不能无授权擅自断言完全删除 runtime enum，必须保留一致生成闭集的处置点。

### 2.2 D-01/D-04/D-02 决策边界

核对 analysis 的决策表和能力闭包：

- 当前外部 catalog/provider 没有 DINE_IN 是 `CONFIRMED`；
- 真实 provider/system、是否实际提供 DINE_IN、支持哪些 form 仍是 `DEXTER_DECISION_REQUIRED`；
- 是否同时放开 PROJECT 与 STORE 是显式待确认，不得暗中扩大；
- 未使用 TAKEAWAY 代替 DINE_IN，未承诺无 provider 时可用。

### 2.3 销售菜单不变边界

重新读取：

- `apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/application/BusinessChannelOwnerService.java:353-456`；
- `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md:155-190`；
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md:775-791`。

判断标准：候选和 direct owner revalidation 仍只认 STORE + INTERNAL + DINE_IN/TAKEAWAY；外部 DINE_IN 是合法经营渠道候选（在 provider capability 闭包成立时）但不是菜单候选；不新增菜单字段、operation、target 或可售语义。

## 3. 输出要求

必须输出：

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_DECLARATION=...
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=...
L1_ENGINEERING=...
L2_USER_VISIBLE=...
L3_UNVERIFIED=...
SAME_ROOT_SCAN=...
DESIGN_GAPS=...
EVIDENCE_TIER=STATIC_DESIGN_ONLY
RUNTIME_EXECUTION=NOT_RUN
```

只报告 Round 2 新发现和对 Round 1 S-01 的最终判断；不要重复大段未变化内容。每条 finding 要有 severity、状态（`CONFIRMED`/`PARTIALLY_CONFIRMED`/`REJECTED_WITH_EVIDENCE`/`UNVERIFIED_REQUIRES_EVIDENCE`/`DEXTER_DECISION`）、相对路径/行号、事实、后果、最小修复。Round 2 后禁止建议第三轮；仍需 Dexter 决策的事项直接标明。
