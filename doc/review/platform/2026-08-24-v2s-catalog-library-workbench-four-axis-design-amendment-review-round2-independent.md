# 商品库工作台四轴设计修订 · Round 2 定向独立 DESIGN 复验

```text
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_DESIGN_AMENDMENT_20260823
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
ROUND_LIMIT_REACHED=true
ARTIFACT=doc/review/platform/2026-08-24-v2s-catalog-library-workbench-four-axis-design-amendment-review-round2-independent.md
WRITE_MODE=TRANSPORT_ONLY_BY_AUTHOR_SESSION_VERBATIM
REVIEWER_WRITE_CAPABILITY=BLOCKED_BY_UPPER_READ_ONLY_CONSTRAINT
DYNAMIC_ACTIONS=NONE
SOURCE_OR_DESIGN_MUTATION=NONE
AUTHOR_MATERIAL_AFTER_VERDICT=NOT_RECONSIDERED
```

> 本文件是 Round 2 reviewer 已形成 verdict 的逐字 transport 产物。reviewer 因上层只读约束不能直接写文件，
> 已确认由作者会话仅作 transport 持久化；这不是新 review，不开启第三轮，也不改变 verdict。

## 0. Verdict

```text
VERDICT=NO-GO
M/S/N=0/1/0
L1_ENGINEERING=findings
L2_USER_VISIBLE=PASS_STATIC_DESIGN
L3_UNVERIFIED=non-empty
BUSINESS_RESULT=FAIL_DESIGN_REVIEW
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
ROUND_FINAL_DECISION=SELF_DECIDED
ROUND_LIMIT_REACHED=true
```

Round 1 的 `M-001` 根因主体已经闭合：browser L2 secret/credential/session 的 adapter owning path、复用边界、
secret 类、最小注入、manifest 敏感字段禁令、fail-closed 和 cleanup readback 均已落入修订稿。

但修订稿仍有 1 条 significant 缺口：它声明 malformed/format-invalid 与 stale/expired secret 必须 fail closed，
却没有把这两个 failure mode 纳入独立 red mutation。执行者仍可能只实现文档明列的红变异，漏掉格式错误和过期材料
的真红证明。

本轮没有执行测试、DEV、reset、seed、browser L2、UAT、migration、部署或任何数据动作；也没有修改需求、
设计、源码、契约或测试。后续修订未被 reviewer 采信，不得用后续修订改变本 artifact 的结论。

## 1. 输入路径与 hash

| path | sha256 |
| --- | --- |
| `AGENTS.md` | `5cbcb4984ffe19d664192b0cbd9ccea3dde28e37eb26cb6fb552a2a6e1ce5820` |
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` |
| `.agents/skills/cs-managed-runtime-execution/SKILL.md` | `fb949a17f2d1da846a2514b17d29ac1f9fe6e8a836806ba1df67753c93b1712d` |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` |
| `scripts/README.md` | `a7c0ccc893779729119fd0df9bd74d79f89d8680426b54fa11cba7446271d90b` |
| `doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-amendment-review-round1-independent.md` | `245232974db48c13cd193172d14bd7b77792d66c6305e7f891a8abf8089bfe59` |
| `scripts/dev/r5-dev-environment.mjs` | `765490256a874d3dcf0b33730e60906c2d90c9194ec537ca974690b0f4201058` |
| `scripts/dev/r5-dev-runner.mjs` | `7d4ad05e7231501be8d59905c053afc19a38776acd0d78c4c0e9fa3f65e3ce97` |
| `scripts/env/check-runtime-resource-budget` | `38ca7f32259bb303069efe0652e0e2f675ae8ae507e1d54b9fb5781f1c24752f` |
| `libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts` | `817de81f490ac11a4054df543218664a9def602c5dcc9b20d50dafc8a0f61549` |
| `libraries/frontend/admin-ui-foundation/src/observability/observedBaseQuery.ts` | `d97847e67b95d01eed15973581977498b589477c3a87d56129bdddbb43b9eece` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` | `e89021dbe8869e2c2afababc97e2e887fb6a11d811b86f43a6503d8b79fd2f42` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md` | `5af5f0351504a5c012fea659adbef525c32157cc9cbcc9bd2eff5ebc9726f114` |
| `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md` | `f5ace1bae941502d5f1a525e69646b711e25ad35e1b4c26cdcc19a68e7766b0b` |
| `doc/review/platform/2026-08-23-v2s-catalog-library-workbench-four-axis-design-audit-intake-codex.md` | `da1c40f34b863c09e03235fc55cbcaa23fc5c8ebf3d2d967ee3c0329957b3382` |

## 2. 盲审与定向复验方法

```text
blindReviewDeclaration=Round 2 仅定向证伪 Round 1 M-001 是否根因闭合；不继承作者结论为事实；owning source 与修订段落均已重开。
authorMaterialReadAfterIndependentVerdict=true
reviewScope=M-001 secret injection contract and required regression checks only
```

reviewer 重开 Round 1 artifact、DEV helper、resource-budget checker、frontend observability，以及修订后的 formal §9.3/
验收 35、implementation §11c.5/§11d/CP-10/12、serial CP-10/12 和 author intake；全程只作静态设计复验。

## 3. 已通过项

### 3.1 Adapter owning path 与 DEV 隔离

`PASS_STATIC_DESIGN`。唯一 runner-local adapter 为 `scripts/test/browser-l2-credentials.mjs`；只复用非 secret host
trust/allowlist、随机 secret、0600 文件和远端 PostgreSQL/MinIO bootstrap 形态；明确禁止读取长期 DEV manifest、
credential、namespace 或 session。

### 3.2 Secret 类与最小注入

`PASS_STATIC_DESIGN`。六类有限 secret 完整覆盖：远端 SSH host boundary、每 run DB app role、资产存储访问、
应用 HMAC/诊断、TEST 登录/OTP、浏览器 session。

- Spring Boot 接收 DB、object-storage 与 HMAC/diagnostic secret；
- Vite 只接收本机 HTTP proxy target/port；
- Playwright worker 只接收 base URL 与其 project storageState 路径；
- provision/cleanup 接收 DB/asset namespace 与 host access boundary；
- HTTP/asset tunnel 只走受管 SSH identity，不发明 token/password；
- 每个 child env 独立 allowlist 投影，禁止整体 spread credential 或打印 environment dump。

### 3.3 权限、绑定、manifest 与 cleanup

`PASS_STATIC_DESIGN_WITH_RED_MUTATION_GAP`。

- `.runtime/browser-l2/<runId>/` 为 `0700`，credential/storageState/session 为 `0600`；
- binding metadata 包含 runId、DB namespace、asset prefix、host fingerprint、created/expires epoch、key exact-set/digest；
- manifest 只记路径、mode、存在性、key-set digest、binding metadata 与 cleanup，不记 raw secret、secret digest、
  password/hash、OTP、login name、token、cookie、Authorization、signed URL 或 storageState 内容；
- 失败码闭集含 required/mode/missing/extra/format/stale/run-binding/namespace-binding/leak；
- 任一失败禁止 browser business，但仍 cleanup；cleanup 覆盖 session/credential、本地 process/tunnel、远端 DB/role/
  asset prefix 与零残留 readback。

### 3.4 当前 L2 事实与计数未冒充

```text
CURRENT_L2_BASELINE=18 scenario / 41 case
CURRENT_L2_ACTIVE_CASES=0
CURRENT_TEST_DATASETS=39
CURRENT_MANAGED_BROWSER_L2_RUNNER=ABSENT
L2_EXECUTION_READY=false
CROSS_CUTTING_MECHANISM_ROWS=17/17
CHANGE_ANCHORS=16/16_UNIQUE
L2_TARGET_CASES=24
L2_TARGET_TEST_FIXTURES=8
USER_VISIBLE_COPY_FORBIDDEN_TECHNICAL_TERMS=0
```

## 4. Finding

### S-001 — Secret fail-closed 声明覆盖 malformed/stale，但 red mutation 未完整覆盖

```text
severity=S
status=CONFIRMED
axis=managed browser L2 secret injection
findingType=verification-rigor-gap
```

证据：formal §9.3、serial CP-10 与 implementation §11c.5 均要求 malformed 与 stale fail closed，失败码也包含
`L2_SECRET_FORMAT_INVALID` 和 `L2_SECRET_STALE`；但 red mutation 明列只有 required-missing、undeclared-extra、
non-0600、old-run、wrong-namespace 与 secret-shaped leak，没有独立覆盖格式非法值和过期 expires epoch。

反例一：credential key 存在，但 DB password、asset access key 或 HMAC value 格式非法；runner 可能直到 downstream
provision/Spring 阶段才失败，未以 `L2_SECRET_FORMAT_INVALID` 在 fixture 前 fail closed。反例二：expires epoch 已过期，
但 runId/namespace/key-set 仍正确；实现只查 cross-run 不查 expiry，现有红变异仍可能全绿。

最小修复：

1. `malformed-secret-value`：required key 保留、value 改为格式非法；必须在 browser business 前精确命中
   `L2_SECRET_FORMAT_INVALID`，并继续 owned cleanup。
2. `expired-secret-binding`：只把 expires epoch 改为过去，runId/namespace/key-set 保持正确；必须精确命中
   `L2_SECRET_STALE`，并继续 owned cleanup。

不得通过扩大 secret 类、引入新 secret manager、复用 DEV credential 或新增 App/business secret 能力修复。

## 5. L3 未验证清单

- browser L2 未执行，当前 runner 仍不存在；
- 24 case 与 8 TEST fixture 尚未实现/运行；
- secret adapter、session/credential cleanup、远端 DB/asset 零残留未动态证明；
- action-request-completion-DB join、no-new-log、firstFailure/lastKnownGood/brokenBoundary 仍为设计义务；
- DEV、reset、seed、Testcontainers、browser L2、UAT、migration、deployment 均未运行；
- 本轮没有 compile/typecheck/focused/acceptance proof。

## 6. Final Round 2 closure

```text
ROUND_FINAL_DECISION=SELF_DECIDED
ROUND_LIMIT_REACHED=true
NO_THIRD_ROUND=true
FINAL_VERDICT=NO-GO
M/S/N=0/1/0
BLOCKING_FINDING=S-001
```

Round 2 到此硬停止。作者应基于本 finding 做 SELF_DECIDED intake 与最小修订，不得召集第三轮。
