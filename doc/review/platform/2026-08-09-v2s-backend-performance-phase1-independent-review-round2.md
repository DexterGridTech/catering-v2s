# BP-U01 / BP-U02 整体第一阶段独立实施复核（Round 2）

| 字段 | 值 |
| --- | --- |
| REVIEW_TARGET | IMPLEMENTATION |
| REVIEW_CYCLE_ID | OVERALL_PHASE_1_BP_U01_U02_20260809 |
| REVIEW_ROUND | 2 |
| REVIEW_ROUND_LIMIT | 2 |
| reviewerKind | INDEPENDENT_SUBAGENT |
| ROUND_FINAL_DECISION | SELF_DECIDED |
| 盲审声明 | 本轮以证伪为起点，直接核验生产源码、门、受管运行证据与 package-exit；未以作者结论替代代码和证据判断。 |

## 输入范围

本轮范围仅为整体第一阶段 BP-U01（可观测性与证据）和 BP-U02（196 operation 的静态绑定）。不涉及 BP-U03～BP-U07、DEV/reset/seed/L2/UAT、SQL 合并或业务优化。

| 输入 | SHA-256 | 用途 |
| --- | --- | --- |
| `doc/plans/platform/2026-08-08-v2s-backend-performance-refactor-implementation-design.md` | `587a3a4faa91ccdac99342f8d3da8e58efc73d12c8754219d540164f8a950eca` | 已批准详设和第一阶段退出判据 |
| `doc/review/platform/2026-08-09-v2s-backend-performance-refactor-bp-u01-u02-remediation-recheck-round2-claude.md` | `f23c211eeb0ddbadff71c4ed351f9938846011d571607dd8c1dc2caffe16e019` | 上轮定向复核输入 |
| `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-input.json` | `f548da16559fbd4bd4d37ac5c1df0f7c031503a310c1a1cab018ec0d8689d776` | 第一阶段 package 输入与六类 source 分母 |
| `doc/evidence/platform/2026-08-09-v2s-backend-performance-phase1-package-exit.json` | `c32508dca75d3e4ba42c18dcdc85ca0963a673f8a528ffd3d464d66494811df2` | 第一阶段 package-exit 与 receipt 对账 |
| `scripts/check/backend-performance-evidence-snapshot` | `09a4b9f2164e8a4a16a5919612edb4d128962155af861a7d0aec378c757324f7` | BP-U01 snapshot 门 |
| `scripts/check/backend-performance-observability` | `b08dc6d3b72f99fe371e4cc779b61036c0414eb9a35caf43c39e45f5baf824df` | BP-U01 phase/section 观测门 |
| `scripts/check/operation-handler-bindings` | `734a8a153a45b3ecf76ac078ec950b2b33287259d596d803d378bac3f832dae1` | BP-U02 exact-set、生成输出和红夹具门 |
| `doc/evidence/platform/2026-08-09-v2s-operation-handler-binding-input.json` | `f3638b461b558770fef3bb07c61a067aa01c15bc242be3e3b135523868ac4ef7` | 196 operation binding 输入真相 |

## Round 1 finding 处置

### M-02：已关闭

第一轮指出 Phase 1 缺少可审计的 active package、package-input、package-exit 和 receipt set-equality。复核时已具备：

- `.runtime/compliance-control/active-package.json` 指向 `BACKEND-PERFORMANCE-PHASE1-20260809`，且明确绑定上述 Phase 1 input/exit；
- `validate-package-exit` 实际输出 `PACKAGE_EXIT=PASS`，`CHANGED=40`，并以已有的 `TRIM_OBSERVATION_PATH_LIST_ONLY` 机制说明观察路径裁剪；
- package-input 覆盖 six package-exit source denominators，package-exit 含非空 incremental receipts 与 source set 对账。

因此 M-02 不再阻断本轮结论。

## Findings

### M-01：44 道门的 `EXISTING_VERIFY` 处置在复核边界未验证真实接线

**证据。** 本轮判定时，`scripts/check/backend-performance-gate-dispositions`（历史 SHA-256 `d09fc63c907dd6f9cef35e5b1914c553d9a48b6ea86024be9f20488d3104af76`，由 `.runtime/compliance-control/hook-events/exec-3928cf90-e5e4-4eab-ade9-2701f3ac2dc1.post.json` 留痕）只校验 disposition 文字属于允许类别；它没有从 `tools/verify-gates/verify.mjs` 解析当前实际执行的 check 集合，也没有对 ledger 的 `EXISTING_VERIFY` 集合做 set equality。

同一时点的 disposition ledger（历史 SHA-256 `478d53627a5084e2f2a01673c85110c80c931bf9b9f00e7d0f49108df16d3ee8`）把 `admin-boundaries`、`business-terminology-traceability`、`logging-boundaries`、`security-boundaries`、`ui-wireframe-traceability` 标为 `EXISTING_VERIFY`；而 `tools/verify-gates/verify.mjs` 的实际命令列表未接入这些 gate。门本身通过，只能证明 ledger 完整，不能证明“已在 verify 链”的声明为真。

**影响。** 详设要求对 44 道原有门作真实 disposition，而不是把未接线门以字符串标记伪装为 verify-chain 覆盖。该缺口会使后续 Phase 1 package 以错误的 gate 接线状态收口，故为 M。

**最小修复。** checker 必须从 `tools/verify-gates/verify.mjs` 得到实际 check 集合，并对 ledger 内 `EXISTING_VERIFY` 精确集合做机械 set-equality；同时加入 mutation，证明 verify 脚本中的一条接线漂移会使门红。

## 已重开且未构成本 finding 的证据

- snapshot 受管证据位于 `.runtime/r5/snapshots/a296fc19a9f5d6caf6f8afb593e75c498c3b61f74f510aa6b060c51b69d651bb`：`optimizationStatus=MEASURABLE`、`missingPhases=[]`、`unclassifiedRatio=0`、173 request/event join 无孤立 tuple；
- BP-U02 受控门输出的 196 exact-set、83 read / 113 command、12 JSON 与 12 Java 生成物、context-kind 红夹具均可被当前门报告；`runtimeIntegration=DEFERRED_TO_BP_U06` 是已声明延期，不能冒充本阶段已接入，也不构成本阶段 M；
- 这两项不能弥补 M-01：它们证明 BP-U01/BP-U02 的局部交付物可观测、可生成，不证明 44 门 ledger 的 verify 接线陈述真实。

## 本轮结论

**NO-GO（M=1，S=0，N=0）。**

此结论严格对应本 Round 2 finding 被提出时的字节和执行边界。Round 2 是本 `REVIEW_CYCLE_ID` 的第二且最后一次独立对抗复核；不得通过更换 reviewer、改名或局部修订开启 Round 3。

M-01 提出后，作者会话已修改 gate-disposition checker 和 ledger。该修改发生在本独立 verdict 形成之后，未纳入本文件的 verdict。按照 `ROUND_FINAL_DECISION=SELF_DECIDED`，作者可凭该修复的实际输出、red mutation 与既有 evidence 自行作后续处置；如需新的独立对抗复核，须由 Dexter 改变实质批准范围或建立新的 review cycle，而不是延续本 cycle 的第三轮。

## 授权边界

本复核仅覆盖 BP-U01/BP-U02 的整体第一阶段实施与验收证据；不授权进入 BP-U03～BP-U07、DEV/reset/seed/L2/UAT、SQL 合并、业务优化或任何仓库控制动作。
