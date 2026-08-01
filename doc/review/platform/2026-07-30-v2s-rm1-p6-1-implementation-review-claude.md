---
title: RM1 P6-1 实现独立复审（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P6-1 current bytes（edge session/diagnostic、ContractProblemAdvice、PlatformAuthenticationController、runner、capability-invariants、run evidence）
verdict: NO-GO
findings: M=1 / S=2 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅审查 RM1 P6-1 已批准实现及其证据；不授权 P6-2/P6-3、UI 开发、DEV、seed/reset、Roadmap 状态变更或其他范围扩张
createdAt: 2026-07-30
---

# RM1 P6-1 实现独立复审

## 0. 结论

**NO-GO**，`M=1 / S=2 / N=3`。

**业务与技术目标基本达成，且达成方式是真的**——公开 OTP 不泄漏验证码、诊断不携带原始请求事实、
runner 的停滞检测在**真实运行中被触发一次并正确放行**。这些我都用生产字节和最终证据验证过，不是采信作者说明。

**NO-GO 的唯一阻塞项是 `M1`**：P6-1 改了一个 project-memory kernel 文件，
但没有重冻结 P6 implementation-facing design manifest 的 D1 绑定，
导致承载 P6-1/P6-2/P6-3 准入的那份 manifest **现在被既有生产门直接拒绝**。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 已验证为"真"的部分（不得回退）

### 1.1 `testCode` 与 `debugVerificationCode` —— 核验重点 ①

- `testCode` 在 `apps/backend/.../src/main` 与 `contracts/openapi` 中 **0 次命中**。
- `debugVerificationCode` 由 `application.yaml:11`
  `debug-code-exposure: ${CATERING_OTP_DEBUG_CODE_EXPOSURE:false}` 单独控制，**默认 false**；
  owner 侧 `PlatformAuthenticationService:76,129` 为 `debugCodeExposure ? code : null`。
- **字段省略而非空串**：`OtpDispatchWireSerializationConfiguration` 对
  `PlatformOtpDispatchResponse`、`WorkspaceOtpSendResponse`、`PublicInvitationOtpSendResponse`、
  `OperationsPasswordRecoveryOtpSendResponse` 四个 wire 类型加 `@JsonInclude(NON_NULL)` mixin，
  全局 mapper 策略不变；schema 侧 `nullable: true` 且不在 `required` 内。
- `capability-invariants --self-test` 的 `RED_OTP_OPENAPI_EXPOSURE`、
  `RED_OTP_GENERATED_WIRE_EXPOSURE`、`RED_OTP_OWNER_ESCAPE` 三条红控本会话实跑全 PASS。

### 1.2 Servlet 边界与请求事实 —— 核验重点 ②

- `app/edge/**` 中引用 `jakarta.servlet` 的文件**只有 4 个**，全部在适配层：
  `EdgeRequestContextArgumentResolver`、`PublicSecurityDiagnosticInterceptor`、
  `PublicSecurityDiagnosticRequestState`、`ContractProblemAdvice`。**没有任何 controller 直接依赖 Servlet API。**
- 原始 IP 在 `EdgeRequestContextArgumentResolver:45-52` 即被折叠为 SHA-256 指纹，
  owner 侧 `PlatformAuthenticationService:378` 再 `hmac("SOURCE:"+…)`；HMAC 密钥缺省为空且
  构造器 `:55` **fail-closed** 抛 `IllegalStateException`。2 参测试构造器在 `main/` **零使用**（已全量 grep）。
- 诊断上下文 `RequestDiagnosticContext(correlationId, requestId, operationId, routeTemplate, owner)`
  只带 **route 模板**，不带原始 URI，也不带 IP。

> **披露**：我最初担心"未加盐 SHA-256 的 IPv4 可穷举反查"。复核 owner 侧后确认它会被
> HMAC 再处理且密钥 fail-closed，**这不是缺陷**，我已撤回该判断。

### 1.3 公共错误 correlation 与 problem 映射 —— 核验重点 ③

- correlation 来自 `X-Correlation-Id`，经 `PublicSecurityDiagnosticRequestState:84`
  白名单 `[A-Za-z0-9._:-]{1,128}` 过滤，非法即回落服务端 `corr-<uuid>` → **无日志注入、无长度失控**。
  同一个值同时用于 wire Problem 与诊断事件，不产生第二真相。
- `completeOnce:60` 用 `completed.compareAndSet(false,true)` 保证**恰好一个 terminal 事件**；
  未被 advice 映射的异常降级为 `PLATFORM_COMMON_RESULT_UNKNOWN`，**不泄漏异常明细**；
  `freeze:79` 对 status/errorCode 做范围与 `[A-Z0-9_:-]{1,128}` 校验。
- 映射齐全（`ContractProblemAdvice`）：`:183` OTP/登录限流 → 429；
  `:189` 平台 `OtpInvalidException` + `RecoveryFlowInvalidException` → 401
  `PLATFORM_IAM_INVALID_CREDENTIALS`（两者合并为同一响应，符合反枚举）；
  `:194` 运营 OTP 无效 → 422；`:200/:205` 重置/找回流程状态 → 409。
- 22 条公开安全操作：registry 22 条 = `@PublicSecurityOperation` 注解 22 处；
  `EdgeWebConfiguration:52-55` 以 `ApplicationRunner` 在启动时做 exact-set + route template + HTTP method
  三重校验，失配抛具名异常；测试用**真实 controller 的 `getDeclaredMethods()`** 枚举而非 fixture 清单。

### 1.4 Runner 与最终证据 —— 核验重点 ④⑤

`run-manifest.json`（`r5-tc-1785349020357-8225`，权威工件）：

```
business  {status: PASS, remoteGradleStatus: 0}
cleanup   {status: PASS, reaped: true, output: 'REAPED=PASS_REMOTE_SCRATCH_CLEANUP=PASS'}
phases    PREPARED, SOURCE_SYNCED, GRADLE_SYNCED, PROCESS_STARTED, RUNNING,
          STALL_DIAGNOSING, COLLECTED, CLEANUP        ← 7 个 requiredPhases 全在
lifecycle LAUNCHED → RECONNECTED_CONTROL → COLLECTED_ARTIFACTS（有序）
heartbeats 24  |  stallDiagnostics 1
logInspection {readCount: 14, observedBytes: 6867, status: READ}   ← 日志不是静默
controlRecord verified=true, reusedAfterReconnect=true             ← 控制身份可复用
firstFailure null | lastKnownGood CLEANUP | brokenBoundary null
```

**最有价值的一条：停滞检测在生产路径上被真实触发并正确放行。**
`phase.jsonl` 显示心跳 `logBytes` 在 `18:20:38 → 18:22:09` **连续六次停在 6230**，
`stallDiagnostics` 记了 1 次诊断，但 run 仍以 PASS 结束——说明
`workloadObservationKey`（`scripts/test/r5-remote-testcontainers.mjs:393`）用
`testResultBytes/workloadSha256` 识别出了真实进展，只有 `stalls >= 2` 才 `TERMINATING`。
这不是自测，是**日志静默期与真实进展并存时的正确判别**，
`RED_WORKLOAD_PROGRESS_NOT_TREATED_AS_STALL` 在生产路径有效。

> **披露**：我最初读到 `control.json` 的 `"phase":"PROCESS_STARTED"`、`phase.jsonl` 终止于
> `COLLECTED`、且 `.runtime/r5` 全域 `grep "BUSINESS="` **零命中**，一度准备报
> "`BUSINESS=PASS` 无证据"。复核后确认：`control.json` 是启动身份记录、
> `phase.jsonl` 是**远端**发出的账（`CLEANUP` 是本地阶段）、`BUSINESS=PASS` 走 stdout（`:386`），
> 权威在 `run-manifest.json`。**是我看错了工件，不是缺陷**，已撤回。

### 1.5 其他机器门（本会话实跑）

`capability-invariants` PASS（`P3_A_TYPED_PROBLEM_OWNER_EXACT_INVENTORY=EXACT_SET=83`）、
其 `--self-test` 20 条红控全 PASS、`security-boundaries` PASS、
`openapi-contracts` PASS（`OPERATIONS=149`）。

---

## 2. M1 ｜P6-1 改了 kernel 记忆，未重冻结 P6 design manifest 的 D1，既有生产门现在 FAIL —— `CONFIRMED`

**owning source**：
`doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json`
的 `deliveryUnits[0] (RM1P6-U01) .sourceComplianceDenominators.PROJECT_MEMORY_ASSERTION_OCCURRENCES`

**证据（本会话实跑）**：

```
scripts/check/implementation-design-granularity \
  --manifest doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json \
  --review   doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-adversarial-review-round2.json

IMPLEMENTATION_DESIGN_GRANULARITY=FAIL
REASON=D1_ROUTED_SOURCE_SET_MISMATCH:RM1P6-U01
```

同日早前我对同一组参数实跑得到的是 `PASS / UNITS=3 / VERDICT=NO_GO`。**是 P6-1 的字节让它转红。**

**根因（已精确定位）**：路径集**没有**变（recall 现值 10 条 = manifest 声明 10 条，双向差集为空），
变的是 hash——

| | `project-memory/kernel/05-evidence-runtime-and-git.md` |
| --- | --- |
| P6 manifest 声明 | `101a8d9952efff6b…` |
| 当前实际 | `d0d75e547400145e…` |

P6-1 修改了这份"证据/运行时"kernel 记忆（正是 runner 可观测性工作会触及的那份），
`validateD1OwningSourceSet` 做的是 `(path, sha256, selector)` 的**有序集合相等**，因此判红。

**对照证明这是遗漏而非有意**：2026-07-30 的 formal-binding manifest **已经**用新 sha
`d0d75e547400…` 并纳入了新增的 `project-memory/decisions/incremental-compliance-hook.md`
（其 D1 为 12 条，我实跑 recall 亦为 12 条且逐条相等）。
**作者重冻结了新 manifest，漏了 P6 那份。**

**影响面**：承载 P6-1 / P6-2 / P6-3 全部准入的那份 manifest 现在被自己的生产门拒绝。
任何"P6-1 已通过既有 granularity 门"的表述都不成立。
这与核验重点 ⑥ 相关但比它更严重：不仅不能声称历史绿灯，**当前连门都过不去**。

**严重性理由（为何是 M 而非 S）**：它不是文档笔误，而是使 P6 全包的准入证据当前**不可用**，
且由 P6-1 的改动直接造成；在它闭合前，P6-1 的实现无法主张已被既有门约束。

**适用边界**：不影响任何运行时行为、不影响本报告 `§1` 已验证的安全与 runner 结论。

**最小修复**：把 P6 manifest 中该条的 `sha256` 更新为当前值并重跑门；同时对该 unit 的
其余 9 条与 U02/U03 一并复算，确认没有第二处漂移。
**不要**回改 memory 文件去迁就旧 hash——那会把真实的记忆更新回退掉。

---

## 3. S1 ｜恢复流 token 以裸 `@CookieValue` 进入 controller，与本次为 session token 建立的隔离不对称 —— `CONFIRMED`

**owning source**：`PlatformAuthenticationController.java` 的
`sendPasswordRecoveryOtp`、`verifyPasswordRecoveryOtp`、`completePasswordRecovery`
三个方法，均以
`@CookieValue(value = RECOVERY_FLOW_COOKIE, required = false) String flow` 直接接收原始 cookie 值。

**反例/对照**：同一个文件里，**session** token 被刻意挡住了——
`EdgeRequestContext.java:22-23` 的 `platformSessionToken()` / `operationsSessionToken()` 是
**包私有**访问器，controller 只能拿到 `EdgeRequestContext`，必须经 `PlatformSessionResolver` 才能取值。
而恢复流 token 是**能力更强**的凭证（它直接授权改密码），却是普通 controller `String` 参数。

**适用边界**：**不外泄给客户端**（响应体不含它，`PlatformPasswordRecoveryStartResponse` 只有
`"OTP_REQUIRED"`），也不构成当前可利用缺陷。风险是该原始句柄现在处于 controller 作用域，
后续任何 controller 代码、日志语句或异常消息都能直接触达它，而 session token 已被结构性阻止。

**严重性理由**：本次改动的核心不变量就是"凭证不进入 controller-visible context"。
最强的那枚凭证例外，属于不变量本身的缺口，但无现存泄漏路径，故 S 而非 M。

**最小修复**：与 session 同形处理——在 `EdgeRequestContext` 增一个包私有
`platformRecoveryFlowToken()`，并加一个 `PlatformRecoveryFlowResolver`（同包）供 controller 调用；
controller 签名不再出现 `@CookieValue`。

---

## 4. S2 ｜两个 session resolver 用"包声明与目录不一致"换取包私有访问，副作用是两个 face 落入同一包 —— `CONFIRMED`

**owning source**：

| 文件路径 | 声明的 package |
| --- | --- |
| `app/edge/platform/session/PlatformSessionResolver.java` | `com.catering.v2s.app.edge.session` |
| `app/edge/operations/session/OperationsSessionResolver.java` | `com.catering.v2s.app.edge.session` |

**证据**：我对 `apps/backend/catering-business-server/src/main/java` 下全部 **287** 个 `.java`
做了 package 声明与目录一致性扫描，**不一致的只有这 2 个**，且正是让
`EdgeRequestContext` 的包私有访问器能被调用的那 2 个。它是编译得过的（Gradle 显式传入全部源文件），
但是全仓唯一的例外，不是既有约定。

**两个后果**：

1. **文件路径不再反映包归属**。我 grep 过 `scripts/check/code-layout` 与
   `tools/code-layout/cli.mjs`，**没有 package/目录一致性维度**，因此这条偏差无门可守。
2. **两个 face 的 resolver 现在同包**。`OperationsSessionResolver` 在**编译层已可读**
   `platformSessionToken()`，反之亦然——"包私有"这道保护现在由两个 face 共享，
   而它原本要表达的是"只有 owner-local resolver 能解码自家 cookie"。

**适用边界**：我逐行确认两个 resolver **各自只读自家 token**
（`PlatformSessionResolver:19` 读 `platformSessionToken()`，`OperationsSessionResolver:24` 读
`operationsSessionToken()`），**不是现存越权**。风险是编译层不再有阻挡。

**严重性理由**：无现存缺陷、无运行时影响，但它把一条 face 隔离从"结构性保证"降级为"约定"，
且全仓唯一例外无门可守，故 S。

**最小修复**（二选一）：
(a) 把两个 resolver 物理移到 `app/edge/session/` 目录，使声明与路径一致——face 同包的事实至少变得显式可见；
(b) 保留物理位置，改为在 `edge.session` 暴露两个**分离的**窄接口
（如 `PlatformSessionTokenSource` / `OperationsSessionTokenSource`），各 face 只注入自己那个，
不再依赖包私有。**(b) 更贴合原意**，但成本略高。
无论哪种，建议给 `code-layout` 补一条 package/目录一致性检查，否则这类偏差会再次出现。

---

## 5. N（观察项，不阻塞）

**N1 ｜证据目录状态分散，`control.json` 的 `phase` 永久停在 `PROCESS_STARTED`**

一次 run 的状态分布在四处：`control.json`（启动身份，`phase` 不再推进）、
`phase.jsonl`（远端发出，止于 `COLLECTED`）、`remote-result.json`（`gradleStatus/containerCleanup`）、
`run-manifest.json`（唯一权威，含 `business`/`cleanup`）。
人工阅读证据时极易被 `control.json` 的 `PROCESS_STARTED` 误导（我本轮就先被误导了一次）。
建议 `control.json` 在终态时补写一次终态 phase，或在 run 目录放一行
`SUMMARY: BUSINESS=PASS CLEANUP=PASS`（stdout 已有该串，落盘即可）。

**N2 ｜一个测试产物文件名被损坏**

`TEST-co-UO0FBJ0RU9L7Q.catering.v2s.app.edge.operations.organization.OperationsHeadCompanyAuthorizationControllerTest.xml`
——`com` 被替换为 `co-UO0FBJ0RU9L7Q`。XML 内 `testsuite name` 是**正确**的
`com.catering.v2s.…`，所以损坏发生在采集/改名侧而非测试侧；
`compact()` 只作用于错误与 stdout 字符串，未触及文件名。
该文件名在 `r5-tc-1785257357220-66035` 等**多个历史 run** 中同样存在，
**非 P6-1 引入**，故仅登记；但它说明产物采集链存在一个未定位的改名路径，建议单独追。

**N3 ｜22 操作校验挂在 `ApplicationRunner`，端口已开放后才执行**

`EdgeWebConfiguration:52-55` 用 `ApplicationRunner` 跑 `validateMappings`。
Spring Boot 的 `ApplicationRunner` 在上下文刷新完成、内嵌容器**已开始接受连接**之后运行，
因此失配时存在一个极窄的"已可接单但校验未过"窗口。
改用 `SmartInitializingSingleton` 或 `ApplicationListener<ContextRefreshedEvent>` 可在端口开放前完成。
进程最终仍会失败退出，故不阻塞。

---

## 6. 处置

`M=1 / S=2 / N=3` → **NO-GO**。

- **M1 必须先闭合**，且只需更新一条 sha + 重跑门；请一并复算 U01 其余 9 条与 U02/U03，
  确认无第二处漂移。**无需 Dexter 产品裁决。**
- **S1/S2 在既有批准边界内**，但 S2 的修法涉及文件移动或新增窄接口，
  建议与 M1 一并处置，并给 `code-layout` 补一条 package/目录一致性检查。
- `§1` 已逐项验证为真的部分——`testCode` 零命中、debug code 省略而非空串、
  22 操作 exact-set 启动校验、诊断不带原始请求事实、恰好一个 terminal、
  correlation 白名单、HMAC fail-closed、runner 的 `business/cleanup=PASS` 与
  停滞检测的真实放行——**不得在整改中回退**。
- 核验重点 ⑥：`postRemediationDeclaration` 的
  `currentBytesNotReviewedByAdversarialReviewer=true`、`claudeRecheckRequired=true`、
  `implementationAuthority=false` 三项**仍然属实且应保留**；
  但请注意当前该 manifest 连门都不过（见 M1），**更不得**表述为历史绿灯。

**本复核不授权**：P6-2/P6-3、UI 开发、契约或生成物改动、DEV、动态运行、seed/reset、
Roadmap 状态变更或任何仓库控制操作。
