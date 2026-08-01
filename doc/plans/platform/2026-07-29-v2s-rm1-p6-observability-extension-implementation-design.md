---
title: RM1 P6-1 受管 runner 可观测性与认证恢复安全诊断实施详设
status: PREPARED_FOR_INDEPENDENT_DESIGN_REVIEW
reviewTarget: DESIGN
reviewCycleId: RM1-P6-U01-OBSERVABILITY-EXTENSION-DESIGN-20260729
implementationAuthority: false
---

# RM1 P6-1 受管 runner 可观测性与认证恢复安全诊断实施详设

## 1. 业务问题、原始需求与边界

P6-1 的原始用户任务是让未认证者安全登录或以“账号 + 本人手机号 + 验证码”恢复密码；运营入口还要显示所属集团空间名称、Logo 与运营后台标题。原始业务来源是 [P6 三步详设](../evidence/platform/rm1/p6/rm1-u09-implementation-facing-design-and-three-phase-plan.md) `§3.1--§3.2`（回指 G-01/G-02/G-03/G-04/G-05/G-07/G-09/G-10、P-U1...P-U5、ST-2/ST-6/ST-11 与 IA-01...IA-05）。

Dexter 的统一裁决要求每个脚本与实际运行边界能追踪问题、判断阶段/效率，且测试**实际读日志**后才可验收；认证链又不能泄露 password/hash、OTP、token、cookie、手机号、登录名、原始 IP 或 payload。当前 `scripts/test/r5-remote-testcontainers.mjs` 同步等待 SSH 返回，远端 Gradle 的输出直到结束才回收：运行时没有本地可读日志、阶段、PID 或停滞回收。P6-1 public auth/recovery edge 也没有统一、安全的诊断入口。这是同一“运行边界不可诊断”根因的 S01/C01 两个表现，不能分别补几条临时输出。

本 extension 同时修复 agent 发现的 contract projection：`contracts/openapi/edge.openapi.yaml` 保留 7 条指向不存在 target 的旧 workspace-user `$ref`；真实 owner path document 已有 5 target × 7 shape = 35 路径/40 operation。不得用 controller-local 日志掩盖这个错误，edge 只能投影 owner/contract 的既有真相。

本文件只定义后续 implementation package：不改已接受 UI、用户可见成功/失败语义、owner 业务事实、数据业务模型或 Roadmap；P6-2/P6-3 仍等待 P6-1 implementation review GO。

## 2. 安全诊断契约

### 2.1 foundation 唯一入口

在 `platform-foundation` 新增不可变 `RequestDiagnosticContext`、`SecurityDiagnosticEvent`、`SecurityDiagnosticRecorder` 与 field whitelist/secret rejector。唯一允许字段：`timestamp,level,service,environment,event,correlationId,requestId,traceId,operationId,routeTemplate,owner,phase,outcome,durationMillis`；终态仅可增加 `status,errorCode`。无请求上下文用 `unassigned`，不得伪造。

`correlationId` 只接受长度/字符白名单后的 `X-Correlation-Id`，否则 edge 生成；它只是可碰撞的查询键，绝非认证/授权输入。`requestId` 由 edge 生成；外部 request/trace/parent-event 值一律不信任、不透传。diagnostic API 不接收 `EdgeRequestContext`、`HttpServletRequest`、headers、cookies、URI 或 request/response body。foundation 是唯一 SLF4J structured key-value 写入口；service/controller/advice/runner 不得自建 logger、MDC、手工 JSON。

### 2.2 精确 P6 operation 与一次终态

app edge 以固定 annotation/registry（不从 raw URI、pageKey、session、参数或异常文本推导）声明下列 22 个 operation：

| owner | operationId |
| --- | --- |
| platform-iam | `platformPasswordLogin`, `sendPlatformLoginOtp`, `verifyPlatformLoginOtp`, `startPlatformPasswordRecovery`, `sendPlatformPasswordRecoveryOtp`, `verifyPlatformPasswordRecoveryOtp`, `completePlatformPasswordRecovery` |
| workspace-iam | `operationsWorkspacePasswordLogin`, `sendOperationsWorkspaceOtp`, `verifyOperationsWorkspaceOtp`, `getOperationsWorkspaceLoginEntry`, `startOperationsPasswordRecovery`, `sendOperationsPasswordRecoveryOtp`, `verifyOperationsPasswordRecoveryOtp`, `completeOperationsPasswordRecovery` |
| workspace-iam | `getPublicInvitationView`, `acceptPublicInvitation`, `sendPublicInvitationOtp`, `verifyPublicInvitationOtp`, `savePublicInvitationCredentials`, `completePublicInvitation`, `getPublicInvitationCompletion` |

`PublicInvitationController` 既然在 source set 内，其全部 7 条公开 operation（含 credentials/complete/completion）必须同一 registry/annotation denominator 覆盖；没有“只记录 OTP”的例外。任何新增该 controller 的 public operation，OpenAPI/route-registry/annotation exact-set 测试必须立即红。

Spring `HandlerInterceptor` 在 `preHandle` 只为这些 operation 建 context 并写 `REQUEST_STARTED`。`ContractProblemAdvice.problem(...)` 和 P6 controller-local helper 只在同一 request state 标记已冻结 status/errorCode，不可记录 exception text、账号存在性、mobile/login、flow/grant/cookie/token。request state 以 servlet request attribute 的一个 typed object 保存，并在 normal/error dispatch 复用同一 instance；`afterCompletion` 用 compare-and-set `completeOnce` 写**恰好一条** `REQUEST_SUCCEEDED` 或 `REQUEST_FAILED`。未标记异常为固定 `PLATFORM_COMMON_RESULT_UNKNOWN`。diagnostic 写失败不得改变 HTTP response/owner transaction，而是受控地产生 `DIAGNOSTIC_WRITE_FAILED`。`EdgeRequestContext*` 必须收窄 raw header/cookie 集合可见性，仍只供 owner-local HMAC rate limiting 与 session cookie 解析。

## 3. runner 状态机

`r5-remote-testcontainers.mjs` 改为受管状态机，禁止再以“同步 SSH + 远端静默重定向”作为执行模型。

| phase | 本地 run-scoped evidence | 远端约束 |
| --- | --- | --- |
| `PREPARED` | manifest：runId、task、开始时间、remote scratch/host alias、log path、profile、source hash；无 credential。 | 创建受限 `/tmp/r5-tc-*` 与 before-container set。 |
| `SOURCE_SYNCED`,`GRADLE_SYNCED` | sequence/timestamp/elapsed/outcome phase event。 | 完整传输后才可 launch。 |
| `PROCESS_STARTED` | PID、process-group、boot/start identity、command hash、首段 log。 | `setsid` 启动 Gradle；**先原子写 remote control record，再允许 SSH ack**；禁止按端口/名字 kill。 |
| `RUNNING` | 远端每 ≤15 秒 heartbeat；本地每 ≤30 秒增量同步 log/phase，报告 elapsed、liveness、log byte growth。 | heartbeat 必须匹配 PID identity。 |
| `STALL_DIAGNOSING` | 第一个无进展窗口：tail、`ps` identity、container labels、lastKnownGood/firstFailure/brokenBoundary。 | 不延长 timeout、不盲重试。 |
| `TERMINATING`,`REAPED` | 第二个停滞窗口：TERM、限定等待、必要 KILL、PGID 已回收证明。 | 只处理此 run 的 group。 |
| `COLLECTED`,`CLEANUP` | log、XML、container diff、logInspection、runner result、cleanup result。 | 收集后才删 scratch；business/cleanup 分账。 |

remote control record 的唯一位置是 `$remoteRoot/results/control.json`，以同目录临时文件 + rename 原子发布；字段为 `runId,remoteRoot,pid,pgid,bootId,processStartTicks,commandSha256,phase,logPath,phasePath`。本地在 launch 前已知 remoteRoot；SSH 在 ack 前断开时只能重连该 root，读取 control record 并逐项对 live `/proc`/`ps` identity 验证后才可 tail、TERM、KILL 或 reap。record 缺失、runId/root/identity 不匹配、或 SSH 无法重连均为 `ENVIRONMENT_BOUNDARY` + cleanup FAIL：不得按 PID/name/port 猜测杀进程，也不得删除可能仍含 process 的 scratch。PID reuse 由 `bootId + processStartTicks + commandSha256 + pgid` 联合阻止。

runner PASS 除 Gradle status 外还要求 phase 闭合、PID 已回收、日志实际已读，并在 manifest 给出 `firstFailure,lastKnownGood,brokenBoundary,logInspection,business,cleanup`。连接/rsync/Docker 无法使用时为 `ENVIRONMENT_BOUNDARY`，不得把静态绿升级成动态 PASS。

## 4. 精确实现面、测试及红变异

| 面 | 允许的实现 | 禁止 |
| --- | --- | --- |
| `modules/foundation` | typed envelope/recorder、SLF4J dependency、whitelist/rejector 与纯单测。 | servlet、route/owner/业务事实、raw request。 |
| `app/edge/diagnostic` + `EdgeWebConfiguration` | annotation/registry、request state、interceptor；复用 recorder。 | controller-local logger、MDC、动态推导。 |
| `EdgeRequestContext*`,`ContractProblemAdvice` | 收窄原始集合，标记 existing Problem status/error；保持 wire 与 75 typed Problem mappings。 | 改 error code/detail/status 或记录 exception。 |
| 三个 P6 auth/recovery controller family | 固定 operation annotation。 | service logging、owner/transaction/cookie/response 改动。 |
| runner | manifest/heartbeat/incremental log/reaper/parser/self-test。 | 无限等待、port/name kill、无日志重试。 |
| edge root + invariant | 7 legacy root refs 替换为 35 target root refs；35 path/40 operation equality。 | 删除 path、恢复 generic root、手改 generated。 |

正向证明必须包括：foundation event capture；22 operation 的 start/success/failure fixed-set；known/unknown/disabled/mobile-mismatch/invalid-OTP 的 event shape 相同而 HTTP 语义不变；75 typed Problem mapping exact set；`SecurityDiagnosticInterceptorMvcTest` 对 success、global advice、controller-local advice、unhandled/error dispatch 四种路径断言 exactly-one terminal；runner 的**生产执行路径**调用 `parseAndValidateRunManifest` 验证 phase/control-record/PID/log-path/log-read/business/cleanup；远端 focused run 读真实 log/XML/container/cleanup；`validateP3CEdgeRootProjection` 被 `validateCapabilityInvariants` 调用，联合验证 edge root 35 refs 与 path document 35 paths/40 operations。

真实 red mutation：

1. 注入 `otp,Authorization,cookie,mobile,loginName,rawPayload` 或 raw IP 字段必须被 rejector 拒绝；
2. 以 `EdgeRequestContext`/servlet raw header 构造 event 必须不能通过 API/contract test；
3. 移除 operation、把 operationId 换 pageKey、或双 terminal 必须红；
4. unknown/disabled/OTP-invalid event 增加主体存在性字段必须红；
5. fixture 删除 heartbeat、篡改 atomic control-record 的 boot/start/PGID/hash、删 log path/logInspection、或模拟 SSH ack 前断线/PID reuse/Gradle 成功但 cleanup 失败，`parseAndValidateRunManifest` 必须红；
6. fixture 改回同步静默 SSH 或取消 incremental collection，runner lifecycle harness（实际 launch/reconnect/collect state transition，不是 source string）必须红；
7. 在临时 OpenAPI fixture 删除一条 edge target root 或插回 generic legacy root，实际 `validateP3CEdgeRootProjection` 必须红。

后续 package exit 必须使 actual changed file = pre/post receipt = non-empty incremental checks，并提供 22 operation set、75 Problem set、secret/terminal 红验、runner log-read/reaper/cleanup、projection invariant、generation 与 R5 standards。`LOG_NOT_AVAILABLE`、`MISSING_PHASE`、unreaped process 或 cleanup 非 PASS 均不可交付。

## 5. 取舍与复读

没有选择“每个 service 加 logger”：它复制记录器并扩大秘密面；也没有只在 `ContractProblemAdvice` 打一条异常日志：成功、controller-local failure、phase 与性能无法闭合。foundation typed recorder + edge interceptor 是最小覆盖 P6 public security route、又不侵入 owner service 的形状。

没有选择“继续等 SSH 返回”：它正是本次无日志停滞的根因。实施前/后都必须重开本文件 §1 的业务来源、统一标准、冻结 logging standard 与 extension manifest，验证诊断确实帮助定位，又未改变匿名恢复反枚举、品牌 owner truth 或 P6 串行闸门。

## 6. R1 finding disposition

`RM1-P6-U01-OBS-DESIGN-R1-M-001`：**CONFIRMED**。全量重开 PublicInvitationController 和 route registry 得到 7 条 public operation，原 18 条确实漏 4 条。已以最小修复将同 controller 的全量 7 条纳入，形成 22 条；不改变 invitation wire/owner 语义。

`M-002`：**CONFIRMED**。现 runner 没有可在 SSH drop 后验证的持久 identity；仅写“PID/PGID”无法抵御 ack 前断线/PID reuse。已增加 atomic remote control record、reconnect 验证与 absence/mismatch cleanup FAIL 规则。

`M-003`：**CONFIRMED**。现 runner `--self-test` 是源码字符串探测，现 capability invariant 不读 edge root。已指定三条实际 production-path validator/test：interceptor MVC 四路径终态、runner parser/lifecycle harness、edge-root joint validator；每条 red fixture 都调用未来 package-exit 同一入口。

`N-001`：**RETAIN_AS_BASELINE**。18/7/35/40 是 R1 当时的可复算现状，不是安全/运行闭环证明；修订后的 target 是 22 operation 和 root 35/40 projection。
