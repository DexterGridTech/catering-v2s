---
title: 全工程修复 S2 implementation-facing 详设：RP-04/RP-05/RP-06 可观测性闭环
status: IMPLEMENTED_STATIC_PROOF_PENDING_REVIEW
programId: V2S_W0_W4_EXECUTION
goalId: WHOLE_ENGINEERING_REMEDIATION_20260805
implementationAuthority: true
runtimeAuthority: false
seedResetAuthority: false
reviewTarget: IMPLEMENTATION
reviewCycleId: WHOLE-ENGINEERING-S2-OBSERVABILITY-20260805
reviewRoundLimit: 2
---

本 S2 是 Dexter 对合并工程 review 中可观测性问题的实施包，原子范围为 RP-04 → RP-05 → RP-06。目标不是增加业务接口，而是让每个已映射 edge operation 有一次永久、无 payload 的完成事件；让两个 admin app 的安全日志可以出港且 ErrorBoundary 不再静默；让 managed invitation bootstrap 不再使用自由 stdout。

## 1. 逐点重新打开的原始依据

- 原始任务与 findings：`doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` §1.1（后端只覆盖 public security、metrics 是诊断型；前端 sink 只在内存/DEV console；两个 ErrorBoundary 未接 onError；bootstrap 有 System.out）。
- 已接受详设：`doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md` §S2/RP-04/RP-05/RP-06。
- owning standards：`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`、`doc/decisions/2026-07-24-v2s-verification-governance.md`、`project-memory/decisions/deterministic-context-only.md`、`contracts/policy/standards-coverage-matrix.json`。
- 业务/edge 真相：生成的 `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`、`EdgeRouteFaceRegistry`、现有 `RequestDiagnosticContext`/`DatabaseOperationTracker`、两个 App 的 `SafeLogger` 与 `AdminErrorBoundary`。

## 2. 有限 source denominator 与 owning source

| 类别 | 有限分母 | owning source / 对账谓词 |
| --- | --- | --- |
| memory/assertion | 上列原始 review、详设、observability standard、deterministic-context、standards matrix | 逐点前后双读；S2 只覆盖 RP-04/05/06 |
| original/standard | observability acceptance、verification governance、logging boundary、bootstrap test 约束 | payload-free、脱敏、run-scoped output、business/cleanup 不冒充静态 PASS |
| approved assertions | 154 generated edge routes；所有非 public-security mapped business requests；两个 App 的 logger/sink/ErrorBoundary；bootstrap main success/failure | 每个 route 仅一个 consumer face；每次请求最多一个 completion event；frontend INFO 在生产不出港，WARN/ERROR 出港 |
| forbidden pseudo-fixes | controller 逐个手写 logger、加入业务 OpenAPI telemetry endpoint、记录 raw payload/secret、只保留内存 ring buffer、继续 System.out、以 audit/exit code 代替日志 | 任何替代都不能改变 owner、契约或隐私边界 |
| owned source/change surface | foundation diagnostic event/recorder；edge registry/state/interceptor/config/advice；bootstrap；foundation safeLogger/index/boundary；platform/operations Api/App；focused tests 与本包证据 | `S2 delivery manifest` 的 changedPathSet 必须与 hook receipt 集合相等 |
| due standards | `standards-coverage --phase R5`、`logging-boundaries`、OpenAPI/contract-face/codegen/materialize 不回归、Java/TS focused proof、package-exit | 无 runtime、DEV/UAT、HTTP/L2、seed/reset、Git 权限 |

## 3. 实施决策与最小替代比较

RP-04 采用一个 edge `HandlerInterceptor` 读取已生成 route-face registry，而不是在 154 个 controller 中复制日志。这样 operationId、owner、routeTemplate、consumerFace 仍由生成真相提供，未解析 route 只使用安全 `route.unresolved`，不从请求 payload 推断身份。completion 复用已有 edge `DatabaseOperationTracker`，不创建嵌套 collector，避免遮蔽既有 metrics observer 的数据库计数。public security handler 保留既有 security observer；managed diagnostic/seed 只有在既有 metrics interceptor 已通过 secret/run-id 校验并写入 request attribute 时才跳过新事件，原始请求 header 不能形成观测绕过。

RP-05 复用 foundation `SafeLogger` 的现有 ring-buffer 与脱敏逻辑，新增可选 beacon/fetch sink；观测 base query 对 public invitation path 的 bearer-like token 做字段值脱敏，并优先采用 backend `X-Request-Id`，缺失时才保留本地 fallback。两个 App 仅提供 sink URL 配置和 ErrorBoundary `onError` 回调，不合并 app-owned shell、router、theme 或文案。生产仅 WARN/ERROR 出港，开发可按现有 enabled 语义出港；sink 失败不能影响用户操作。

RP-06 只把 bootstrap 成功/失败改为 SLF4J 结构化事件，保留 manifest/private failure 文件作为受管输出，不把异常 message、token、密码或原始 payload写入日志。

## 4. 红变异与 focused proof

1. 删除 `recordCompletion` 或移除 interceptor 注册，`RequestCompletionDiagnosticInterceptorTest` 的 correlation/operation/face/status/outcome 断言必须失败。
2. 将 completion event 的 status、owner、consumerFace 改为自由 Map/任意输入，`RequestCompletionEventTest` 的 typed/非法值断言必须失败。
3. 让 production INFO 进入 sink 或让 `password` 存活，`safeLogger.test.ts` 必须失败。
4. 移除任一 App `AdminErrorBoundary onError` 或恢复 bootstrap `System.out`，`logging-boundaries`/typecheck 与 source scan 必须失败。
5. 每一实际变更文件必须有 non-empty hook pre/post receipt；package exit 只接受 exact path set。

## 5. 排除与证据边界

本包不新增 OpenAPI operation、不修改 owner business semantics、数据库/migration、部署变量的运行值，不启动 DEV/UAT/HTTP/L2，不 seed/reset，不执行 Git。`VITE_FRONTEND_LOG_SINK_URL` 只是既有部署配置的可选 sink 地址；没有该配置时仍保留内存 snapshot，静态 proof 不宣称远端 sink 可用。业务与 cleanup 均为 `NOT_APPLICABLE_WITH_REASON`，不能从编译或单测 PASS 推导环境 PASS。
