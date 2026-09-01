# TER `kernel.base.contracts` DESIGN adversarial review · Round 2

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN |
| REVIEW_CYCLE_ID | TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830 |
| REVIEW_ROUND | 2 |
| REVIEW_ROUND_LIMIT | 2 |
| ROUND_FINAL_DECISION | SELF_DECIDED |
| reviewerKind | INDEPENDENT_SUBAGENT |
| reviewerInputChecklist | `doc/review/platform/2026-08-30-v2s-terminal-kernel-base-contracts-design-review-r2-input-checklist-claude.md` |
| reviewerInputChecklistSha256 | see checklist file; final artifact SHA was not known before writing this artifact |
| baseline | `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md` SHA-256 `31f2da6756b0ac8df91330acbbe26d33c1e2885bf8f99a00e64e615b18bfc886` |
| blindReviewDeclaration | PARTIAL_DISCLOSURE: an early broad search output exposed a few `§12` intake lines before the final R2 judgment. I did not read Round 1 review before forming the refreshed R2 judgment, and the full Round 1 review plus full `§12` intake were read after that judgment for difference notes. |
| authorMaterialReadAfterIndependentVerdict | true |

## 0. 结论

`GO` for DESIGN after targeted Round 2.

Round 1 的两项阻断在 refreshed baseline 中已闭合：

1. T-6 现在一致收窄为 `ResolvedParameter.source` 三值 closed discriminant：只证明 `default` / `catalog` / `catalog-fallback` 可构造且 `catalog-fallback !== default`；invalid-remote resolver 行为明确留给未来 resolver owner，不在 contracts 新增 resolver，也不再把 T-6 PASS 写成 resolver 行为已实现。
2. `§4.11` 当前恰好 74 个 unique symbol，每项都有共享词汇理由、已知/未来消费者类别、状态与覆盖；状态列经 baseline refresh 后只保留 `CONFIRMED` / `UNVERIFIED_TER_NEED`，`CommandRouteContext` 额外保留 `LOCAL_ONLY` 附注。

未发现 exact export 总数、TR-05 A/B/C、T/F 夹具、四门/support、TER verifier 或五 adapter CP-3 命令因本次修订漂移。

## 1. Action 1-B 提取结果

### 1.1 模板缺项

- `implementation-design-template` 中 operation/path/face、owner write、migration、seed、UI/L2 等整组写为 `NOT_APPLICABLE`，理由是本批纯 TER contracts 和 TER-local tooling/adapters 收口，无 HTTP、数据库、业务 Journey 或用户界面；该折叠与当前授权相符。
- Round 1 指出的 C-4 per-export 清单缺口已由 `§4.11` 补齐。当前表头为 `symbol / 组 / 为什么必须是共享词汇 / 已知/未来消费者类别 / 状态 / 覆盖`，满足需求 C-4 对逐 export review 的可审性。

### 1.2 文档矛盾

- T-6：requirements 当前 `§4.1` 与 `§8.3` 都写明本包不实现 resolver，invalid-remote 行为未来 owner 验证；design `§4.4`、`§6 CP-1`、`§10` 与 plan CP-1/CP-4 同步一致。
- §4.11：requirements 要求逐项 C-4，design 当前已有 74-row table；plan CP-4 要重核七组/74 名/排除项，未与 design 冲突。
- 未发现本次修订导致 T/F、门、adapter 命令或授权边界出现新矛盾。

### 1.3 无出处数值/枚举

- 74 exports：`§4.1-§4.8` 分组计数为 `3+23+14+5+7+7+7+8=74`；`§4.11` 实际 74 rows、74 unique symbols、0 duplicates。
- TR-05：requirements 的 13 处 `Record<string, unknown>` + 1 处 `any`，design `§5` 处置为 A=7/B=7/C=0；A 组由 F-4 和 C-4b 覆盖，B 组删除/擦除，C=0。
- C-6：七处闭集、基数和门控来自 requirements C-6，并在 design CP-2 中保留 TypeChecker exact-set gate。

## 2. Targeted Recheck

### 2.1 T-6 source closed discriminant

分类：`CONFIRMED_CLOSED`

证据：

- requirements `§4.1` 写明 `ResolvedParameter.source` 三值服务于未来 resolver 可区分结果，本包不实现 resolver。
- requirements `§8.3 T-6` 当前反断言为 `catalog-fallback` 与 `default` 是不同闭集成员，并写明不声称远端非法行为已实现。
- requirements `D-3` 说明不在 contracts 新增 resolver，因为 POC 行为属于 `definition-registry`，TER 对应 owner 尚未落地。
- design `§4.4` 与 `§6 CP-1 T-6` 同步为 closed discriminant only，并禁止 test-owned helper 冒充生产能力。
- POC `definition-registry` 分析确认 invalid-remote decode/validate/fallback 是 resolver owner 行为；TER build-order 决定取消该包，不把它提前搬进 zero-dependency root。

后果判断：当前设计不会出现“contracts 全绿就声称 invalid-remote resolver 已实现”的话术路径；它只允许声称 discriminant 闭集和可区分性已实现。

同根全集扫描：

- 扫描项：requirements 参数协议/T-6/D-3；design `§4.4`、`§6 CP-1`、`§7 source 闭集`、`§10 未决项`；plan CP-1/CP-4；POC contracts/definition-registry；current contracts skeleton。
- 结果：没有生产 resolver export 加入 contracts；没有 T-6 PASS=resolver 行为 PASS 的 current wording；future resolver owner 被标为未来同批验证。

### 2.2 `§4.11` 74-symbol C-4 table

分类：`CONFIRMED_CLOSED`

Fresh extraction:

```text
ROWS=74
UNIQUE=74
DUP_SYMBOLS=0
STATUS_VALUES=48 CONFIRMED / 25 UNVERIFIED_TER_NEED / 1 UNVERIFIED_TER_NEED · LOCAL_ONLY
EMPTY_REASON_CONSUMER_STATUS_COVERAGE=0
```

核验结果：

- 每行都有共享词汇理由，不只是组级概括。
- 每行都有已知或未来消费者类别；`future ...` 被允许，因为需求 `§2.1` 明确判别性质而不是当前消费者数量，但 future-only/future-uncertain 项必须诚实标档。
- 参数协议、定义工厂、模块描述符、request 生命周期大部分 future-only 项当前均标为 `UNVERIFIED_TER_NEED`；没有把这些项冒充为已由 current TER consumer 动态验证。
- `CommandRouteContext` 保留 `UNVERIFIED_TER_NEED · LOCAL_ONLY`，并在 design `§4.7` 和覆盖列保留 serialization review boundary。
- `CONFIRMED` 行虽包含若干 future consumer（例如 ID family convenience creators），其理由与覆盖来自统一 ID/错误/transport shared vocabulary、T/F/C gates 和 POC/current category evidence；未发现单包内部结构被无理由放入根包。

同根全集扫描：

- 扫描项：`§4.1-§4.11` 全 74 symbols、requirements C-4/C-6/交付物、plan CP-1/CP-4、POC contracts and definition-registry notes、current skeleton graph。
- 结果：74 名与 exact export denominator 一致；排除项 `formatTimestampMs`、validators、wire envelopes、protocol exit、empty application/features/selectors/hooks/supports 未回流。

### 2.3 TR-05 A/B/C

分类：`CONFIRMED_NO_DRIFT`

requirements 分母为 13 处 `Record<string, unknown>` + 1 处 `any`。design `§5` 当前处置：

- A=7：`AppError.args`、`CreateAppErrorInput.args`、`renderErrorTemplate(args)`、三处 request result、`listDefinitions` 约束。
- B=7：六处 metadata 删除、`AppModule.parameterDefinitions<any>` 改为 `readonly ParameterDescriptor[]`。
- C=0：不保留开放扩展点。

F-4、C-4b 和 metadata absent row 覆盖这些处置；本次 `§4.11` status-label normalization 未改变 A/B/C。

### 2.4 T/F/gates/adapter commands

分类：`CONFIRMED_NO_DRIFT`

- T-1/T-2/T-9 仍覆盖 ID prefix/brand/uniqueness；T-3/T-4/T-8 覆盖 error template/AppError/fake clock；T-5/T-7 覆盖 definition factory/pure deterministic paths；T-6 如上收窄。
- F-1/F-2/F-3/F-4 仍要求 public-surface typecheck fixture，且 4c scratch negative control 必须红。
- CP-2 仍是 C-2/C-4b/C-5/C-6 四门 + exact-export support check，support 不冒充第五道业务规则门。
- `tools/terminal-skeleton/verify.mjs` drift 已被设计覆盖：必须从 dry-run test 改为 true filtered `turbo run test`，owner exact-set=contracts+5 adapters，marker=1 real + 5 `NO_TEST_FILES`。
- CP-3 adapter commands 仍固定为五个 adapter cwd、ESM runner、`npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile`、首包写入面确认、root `yarn install` convergence；本次修订未改变。

## 3. Round 1 / §12 Difference Notes

Full Round 1 review and full design `§12` were read after the refreshed R2 judgment.

- Round 1 M-1 (`T-6 literal false green`) is closed by requirements D-3 plus design/plan wording: the reviewed behavior is now discriminant only, not resolver behavior.
- Round 1 S-1 (`C-4 group-level only`) is closed by refreshed `§4.11` 74-row table.
- The later parent update mechanically normalized nonstandard `§4.11` status labels. R2 re-read the refreshed baseline and did not use the pre-refresh design hash for verdict.
- No new issue was introduced by the normalization because consumer/reason/coverage columns still preserve the important distinction between current/POC evidence and future/unverified TER need.

## 4. Unverified Inventory

静态已证：

- 当前 design baseline hash and targeted line content.
- `§4.11` count/unique/status-column extraction.
- T-6 wording consistency across requirements/design/plan.
- TR-05 A/B/C denominator and design mapping.
- Current source/tooling skeleton state relevant to design drift.

测试已证：

- None in this R2 review; dynamic/typecheck/test execution was not authorized or needed for DESIGN verdict.

未验证但已诚实标注：

- `UNVERIFIED_TER_NEED` symbols in parameter/factory/module/request groups, including `CommandRouteContext LOCAL_ONLY`.
- Future invalid-remote resolver behavior.
- CP implementation evidence: T/F tests, gates, adapter installs, TER verify markers, scratch cleanup.

## 5. Same-root Scan

- T-6 family checked across requirements `§4.1/§8.3/D-3`, design `§4.4/§6/§7/§10`, plan CP-1/CP-4, POC `definition-registry`, and current contracts skeleton. Remaining related T assertions were checked for false-green wording; no sibling blocker found.
- C-4/export family checked across all 74 `§4.11` rows, `§4.1-§4.10`, requirements C-4/C-6/交付物, plan CP-1/CP-4, and explicit exclusions. Remaining 74 rows checked.
- TR-05 family checked across all 14 source positions and design A/B/C table. Remaining A/B/C rows checked.
- Tooling/adapters family checked across CP-2/CP-3 plan and current skeleton verifier/adapter runner shape. No drift from the Round 2 remediation found.

## 6. Verdict block

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
ACTION_1_VARIANT=1-B
VERDICT=GO
M=0
S=0
N=1
L1_ENGINEERING=PASS
L2_USER_VISIBLE=NOT_APPLICABLE reason=本批纯 TER contracts/tooling/adapters design，无 UI、浏览器、用户 Journey、可见页面或交互验收面
L3_UNVERIFIED=UNVERIFIED_TER_NEED symbols and future resolver/implementation evidence are explicitly marked; none is promoted to runtime/DEV/L2/UAT proof
SAME_ROOT_SCAN=COMPLETED T-6/source-discriminant; 74-symbol C-4 table; TR-05 A/B/C; T/F/gates/verifier/adapters
DESIGN_GAPS=none
EVIDENCE_TIER=STATIC_REPO_SOURCE+POC_ANALYSIS_SOURCE+CURRENT_DESIGN_BASELINE; no dynamic install/test/runtime evidence claimed
PROCESS_NOTE=N-1 partial blind-contamination disclosure from early rg snippet; did not change design verdict
```

