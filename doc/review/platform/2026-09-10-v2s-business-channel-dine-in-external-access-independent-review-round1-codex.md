# 独立 DESIGN 盲审报告（Round 1）：经营渠道“到店点餐允许外部接入”

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=BC-20260910-DINE-IN-EXTERNAL-DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B_DOCUMENT_EXTRACTION
BLIND_REVIEW_DECLARATION=本轮不继承作者结论、历史 review 或旧 PASS；结论按 checklist、当前字节与同根扫描独立形成。
VERDICT=NO-GO
M/S/N=0/1/2
EVIDENCE_TIER=STATIC_DESIGN_ONLY
RUNTIME_EXECUTION=NOT_RUN
```

## 1. 独立 reviewer 原始结论摘要

`L1_ENGINEERING=NO-GO`：核心业务方向基本成立，但 active error/generated 的 source catalog 清单不完整，可能使实施者只改 materialized OpenAPI、generated TS/Java 或 runtime enum，而遗漏下一次生成会重新产出旧错误的 source。

`L2_USER_VISIBLE`：当前 O2 UI 确实在 DINE_IN 时强制 INTERNAL、禁用 EXTERNAL 并清空 provider；分析已识别 UI、foundation 和 L2 影响，但本轮未运行 UI/L2。

`L3_UNVERIFIED`：未启动 DEV、reset、seed、backend acceptance、browser L2、UAT；真实 provider 是否支持 DINE_IN、D-01/D-04，以及 PROJECT 是否也允许 EXTERNAL+DINE_IN，仍需 Dexter/provider 决策。

`SAME_ROOT_SCAN`：已覆盖 policy、template/channel create、DB CHECK、collaboration catalog/schema/source、provider enablement、binding policy、OpenAPI source/materialized、generated TS/backend enum、operations feedback、sales-menu owner API/service/edge support/tests、seed plan/executor、历史 IA/UI/implementation design 与 sales-menu design。独立 reviewer 未发现销售菜单被外部 DINE_IN 放开，也未发现 TAKEAWAY 被错误当作 DINE_IN。

## 2. Findings 与主 agent 处置

### S-01 · active generator source 未列入影响闭包

```text
severity=S
status=PARTIALLY_CONFIRMED（finding 已确认；文档修正已完成，等待 round 2 定向复核）
```

独立 reviewer 指出：

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json:570-603` 保存 operation error set；
- `doc/plans/platform/2026-07-26-v2s-r5-error-code-disposition-catalog.json:150-170` 保存 error active disposition；
- `scripts/generate/r5-edge-materialize.mjs:11-15,340-394` 从上述 source 物化 OpenAPI；
- `scripts/generate/edge-codegen.mjs:17-24` 参与 generated 输出闭包；
- 当前 materialized/generated/feedback 仍含 `DINE_IN_MUST_BE_INTERNAL`。

主 agent 已重新读取上述当前字节，确认 source 事实成立，并在需求变更分析的当前版本中：

1. 新增 source catalog + materializer/codegen 的事实表行；
2. 在必须实施清单中明确 source-first 更新，禁止只改 generated/materialized 输出；
3. 在 Contract 影响和实施顺序中明确先从两个 R5 source catalog 退役/移除 active operation 语义，再物化/生成；
4. 保留“是否完全删除 runtime enum”作为生成闭集策略下的显式处置问题，不擅自删产物。

处置状态：`RESOLVED_PENDING_ROUND2`。本处置只改需求分析文档，没有实现授权。

### N-01 · 真实 DINE_IN provider 与适用 operator 范围尚未裁决

```text
severity=N
status=DEXTER_DECISION
```

当前 catalog/schema/runtime capability source 无 DINE_IN，现有 provider 只有 TAKEAWAY/GROUP_BUY。分析没有把现有 provider 改成 DINE_IN，也没有把 TAKEAWAY 当别名；但在 D-01/D-04 未决前，只能批准影响面，不能声称真实 external DINE_IN 已可创建。D-02 还需要明确新规则是否同时适用于 PROJECT 和 STORE。

处置状态：`OPEN_REQUIRES_DEXTER_DECISION`。不通过文档假设替代产品/能力决策。

### N-02 · O2 UI 与 L2 尚无动态证据

```text
severity=N
status=UNVERIFIED_REQUIRES_EVIDENCE
```

当前任务明确不进入实施和动态执行，因此 provider 空态、form 选择、错误恢复、foundation 接入、unique TestIds 与 L2 控件分母尚无运行证据。它们已列为后续 implementation-facing 详设和实施验证义务，不被分析文档当作 PASS。

处置状态：`OPEN_DEFERRED_TO_IMPLEMENTATION`，不在本轮启动 DEV/L2。

## 3. 已被证伪的问题

- `BusinessChannelPolicy.java:40-65`、模板/渠道 owner 路径覆盖不足：未成立；分析已区分旧耦合与必须保留的 form/provider/scope 校验。
- 销售菜单会被外部 DINE_IN 放开：未成立；`BusinessChannelOwnerService.java:353-420,423-439` 仍是 STORE + INTERNAL + DINE_IN/TAKEAWAY，分析明确保持不变。
- 以 TAKEAWAY 替代 DINE_IN：未成立；分析明确拒绝该替代，当前 catalog 也没有 DINE_IN capability。

## 4. Round 1 结论边界

Round 1 的 `NO-GO` 主要由 S-01 文档闭包缺口与 D-01/D-04 未决共同构成，不是对销售菜单当前实现的失败判定。本轮动态证据统一为 `NOT_RUN`。按独立审查治理，只能再做一次定向 round 2；不得以换文件名、换 reviewer 或局部措辞重置轮次。

独立 reviewer 建议 round 2 定向核验：

1. S-01 是否真的补齐 active generator source/error disposition/catalog 与生成顺序；
2. D-01/D-04/D-02 是否仍明确标记为 Dexter/provider 决策；
3. 修正是否引入新的产品语义或误放宽销售菜单。
