# 测试健康闭环整改 DESIGN round-1 作者复证与处置

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=TEST_DELIVERY_PROCESS_REMEDIATION_DESIGN_20260811`  
`REVIEW_ROUND=1 / REVIEW_ROUND_LIMIT=2`  
`DEXTER_SCHEDULED_ACTUAL_DESIGN_ROUNDS=1`  
`REVIEWER_KIND=INDEPENDENT_SUBAGENT`  
`REVIEW_VERDICT=NO_GO`

本文件是作者对独立 finding 的 source-reopen 处置，不改写 reviewer verdict，不把处置本身当作 DESIGN GO，也不授权实施或动态环境。

## 逐条复证

| finding | 结论 | owning source 复证 | 有限分母与最小处置 |
|---|---|---|---|
| `THCL-M-001` | `CONFIRMED` | `tools/implementation-design-granularity/cli.mjs:433-437` 只接受独立行 `implementationAuthority: false`；详设现为反引号中的 `implementationAuthority=false`，故 `scripts/check/implementation-design-granularity --manifest … --review …` 实测返回 `DESIGN_IMPLEMENTATION_AUTHORITY_NOT_FALSE`。 | 单一 hash-bound 详设及依赖它的 THCL-U01…U06。将设计首段改为 checker 可解析的精确字段，重算 manifest design hash；不得放宽 checker、不得以 prose 替代。该变更会使 round-1 reviewer 输入失效，须由后续获准的独立 review 复核。 |
| `THCL-S-001` | `CONFIRMED` | `tools/verify-gates/verify.mjs:12-36` 逐条 spawn command，但不产生 receipt；`scripts/check/standards-coverage:350-365,588-593` 的 `executeActive` 会再次 spawn 并仅返回内存 ref 数组。现有设计没有跨进程 receipt schema 或唯一 execution owner。 | `43 ACTIVE GATE rules -> 16 refs`：`scripts/verify` 是唯一 `VERIFY_ROOT`；11 个 `VERIFY_CHILD` 与独立 `ARCHUNIT_SELECTOR` 不得重复执行或混入。最小修正是保留 catalog 为唯一 map，让 root 唯一执行 child，原子写入 root-owned immutable receipt；U12 仅作 pure receipt validator。receipt 必含 schema/version、root run identity、sequence、ref、catalog dependency digest、exit result、逐 marker result；fail-fast 后不写 success receipt。红变异覆盖 root-as-child、duplicate、missing、extra、substituted、stale、dependency drift、marker missing。不得新建平行 execution map。该变更同样需后续独立 review。 |
| `THCL-S-002` | `CONFIRMED` | `scripts/test/backend-performance-final-acceptance.mjs:22-26,105-142` 私有定义 canonical/HMAC 并在 `V2S_DB_OPERATIONS_HMAC_KEY` key boundary 使用 `timingSafeEqual`；`scripts/test/backend-performance-testcontainers-196.mjs:257,330` 仅检查 43 字符格式。当前 THCL-U04 change surface 未包含原 owner 或可共享 helper，直接 import 不可行。 | 分母是 196 completion 的 `serverEvidenceHmac`、相联 database row 的 `serverOperationHmac`，以及 final-acceptance 的同一 verifier。最小修正是从 final-acceptance 抽取唯一 shared evidence-HMAC module，由其保留既有 canonical byte order（completion：runId/managedDevRunId、correlationId、requestId、operationId、fixtureId、area、database count、logical statement count；database：runId、correlationId、requestId、operationId、seq、section、kind、action、statementId）与 base64url HmacSHA256。final-acceptance 和 196 consumer 都只能 import 它；secret 只在 `V2S_DB_OPERATIONS_HMAC_KEY` verification boundary 解码，产物只输出 non-secret verification receipt。把 existing owner、shared helper、196 consumer 与两侧 tests 列入 prospective change surface；wrong MAC、wrong key、changed canonical payload 三条 red mutation 必须精确失败。不得复制私有实现，也不得把格式检查称作 authenticity。该变更需后续独立 review。 |

## 结论与节奏约束

本轮 1M/2S 均为 `CONFIRMED`，没有可拒绝或仅局部采纳的 finding。它们分别阻断 design-only mechanical admission、C3 的单次执行事实、以及 196 evidence 的真实性；不能进入 implementation package。

Dexter 已在本 intake 后明确授权最小修订及一次只覆盖这三项的 fresh round-2。作者已将修订写入 current design/manifest，但不得把它伪称为 round-1 已审版本；round-2 是唯一允许的定向复核，之后不再启动 Codex round-3。只有 round-2 对 current hash-bound design 给出 GO，才可生成 Claude DESIGN handoff；即使如此仍不构成 implementation authority。

授权边界：本 intake 只处理静态 DESIGN finding；不授权或证明 Testcontainers、DEV、L2、seed、reset、browser、UAT、部署、业务、cleanup 或性能结果。

## round-2 定向复证结果

`REVIEW_ROUND=2 / REVIEW_ROUND_LIMIT=2` 的 fresh independent verdict 为 `NO_GO (M=1,S=1,N=0)`；该 reviewer 确认 `THCL-S-002=CONFIRMED_CLOSED`，但以下两项仍阻断。

| finding | 作者复证 | 最小后续修复（未执行） | 不可接受替代 |
|---|---|---|---|
| `THCL-M-001` authorization half | `CONFIRMED`。authorization 第 7 行为 `implementationAuthority=false`，而 `tools/implementation-design-granularity/cli.mjs:433-437` 对 design 与 authorization 都要求 `implementationAuthority: false`；manifest-plus-review 实测为 `AUTHORIZATION_IMPLEMENTATION_AUTHORITY_NOT_FALSE`。 | 只将 authorization 声明改为 colon form，重算 manifest authorization hash。 | 放宽 checker、用详设字段替代授权字段、或宣称文字语义等价。 |
| `THCL-S-001` stale receipt | `CONFIRMED`。现设计虽有 receipt 内 `runId` 与 `--validate-active-receipts <receipt-path>`，但 U12 没有由当前 root invocation 传入的 expected runId/nonce；旧 receipt 可自洽重放。 | root 在执行 child 前生成一次 runId/nonce；receipt path 从该 identity 导出；root 以 `<receipt-path> + --expected-root-run-id <identity>` 调用 pure U12 validator，validator 精确相等；加入有效旧 receipt 替换的 red mutation。 | timestamp heuristic、validator 自行信任 receipt 的 runId、U12 重新执行 child、第二 execution map/gate。 |

同一 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批准范围` 已用尽 `REVIEW_ROUND_LIMIT=2`，`furtherCodexAdversarialRoundAllowed=false`。作者不得执行上述未审后续修复、不得创建或宣称 Claude handoff 已通过、不得启动 round-3 或 implementation。需要 Dexter 的新 review-cycle/批准范围裁决后才可继续。
