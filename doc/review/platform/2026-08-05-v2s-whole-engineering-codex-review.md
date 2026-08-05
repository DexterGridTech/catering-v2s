# catering-v2s 全工程 Codex 独立代码审查

## 审查元数据

- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_CYCLE_ID=2026-08-05-whole-engineering-codex`
- `REVIEW_ROUND=1`，`REVIEW_ROUND_LIMIT=2`
- 覆盖后端、双前端、OpenAPI/生成代码、迁移、scripts、tools 与 `.agents`；回读当前 Roadmap、项目记忆和 G01--G12 业务语料；另有后端/契约、前端/foundation、脚本/控制面三条独立盲审线。
- 结论：`NO-GO`。

## 已执行验证

| 检查 | 结果 |
| --- | --- |
| `scripts/check/remediation-compliance static-scan` | PASS；仅 RM1 静态 admission，不代表业务/runner 正确。 |
| `scripts/check/frontend-architecture` | FAIL：`operations-stores`、`operations-contracts` 的 filter-column 目录分母漂移。 |
| `scripts/check/logging-boundaries` | FAIL：`ManagedInvitationBootstrap` 有自由 stdout。 |
| `scripts/check/standards-coverage --phase RM1-P6-3` | FAIL：checker 仅接受 `R2`--`R6`，与当前 `CURRENT_STEP` 指令矛盾。 |
| diagnostic Node tests | 9 PASS / 4 FAIL；场景事实 exact-set 已失配。 |

## M：必须先关闭

### M1. HTTP diagnostic 的真相分母失配，所有 workload 在首个请求前失败

生成 registry 为 154 operations，`SCENARIO_FACT_GROUPS` 仅 144；[exact-set 校验](../../../scripts/test/http-diagnostic-scenarios.mjs#L100) 因此抛 `HTTP_DIAGNOSTIC_SCENARIO_FACT_SET_INVALID`，而 [测试仍断言 147](../../../scripts/test/rm1-http-diagnostic.test.mjs#L105)。这是生成契约、场景事实、workload、测试和 evidence 分母不同步，不是简单计数错误。逐个缺失 tuple 必须补真实 workload/source-bound fact 或有证据的 disposition；禁止只改总数。

### M2. 前后端常态调用不具备完整、可读取的受管日志

后端 HTTP completion metrics 仅在 seed/diagnostic profile 激活，[interceptor](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/HttpRequestMetricsInterceptor.java#L21) 和 [default-off 测试](../../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/configuration/HttpRequestMetricsInterceptorTest.java#L19) 可证；公共安全日志只覆盖标注的 public operation。[范围](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/PublicSecurityDiagnosticInterceptor.java#L10)。前端 logger 只在 DEV 输出，其他环境仅保留每实例最多 100 条不可读取内存事件。[foundation](../../../libraries/frontend/admin-ui-foundation/src/observability/safeLogger.ts#L65)、[platform](../../../apps/frontend/platform-admin/src/app/api/PlatformApi.ts#L7)、[operations](../../../apps/frontend/operations-admin/src/app/api/OperationsApi.ts#L9)。两 app 也未接 `AdminErrorBoundary.onError`。[platform root](../../../apps/frontend/platform-admin/src/app/PlatformApp.tsx#L172)、[operations root](../../../apps/frontend/operations-admin/src/app/OperationsApp.tsx#L360)。应建设脱敏 request-completed 事件与前端 run-scoped sink；记录 route/correlation/error category，禁止密码、OTP、token、cookie、手机号、raw payload、stack。

### M3. logging gate 已红：bootstrap 以自由 stdout 输出

[ManagedInvitationBootstrap](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/bootstrap/ManagedInvitationBootstrap.java#L50) 使用 `System.out.println`，实测 logging gate 报 `R4_LOGGING_FREE_CONSOLE`。它已有受控私有 output 文件，应删除 stdout 并使用结构化、脱敏 recorder 记录 phase/outcome/correlation。

### M4. remote host binding 是自哈希而不是目标绑定

[r5-dev-environment](../../../scripts/dev/r5-dev-environment.mjs#L22) 缺 hash 时由同一 host 字符串计算；[校验](../../../scripts/dev/r5-dev-environment.mjs#L41) 只验证两者相等。任意不含 prod 字样的错误 alias 可携带自己的 hash 通过。应从受控 non-production allowlist/fingerprint source 读取 expected binding，runner 只能比对并记录 readback。

### M5. cleanup 只检查 launcher PID，可能漏掉受控子进程

[runner](../../../scripts/dev/http-diagnostic-runner.mjs#L163) 向 process group 发信号，却只轮询 leader PID，[轮询](../../../scripts/dev/http-diagnostic-runner.mjs#L170)；[invitation bootstrap](../../../scripts/test/rm1-http-diagnostic.mjs#L173) 还以 120 秒 `spawnSync` 运行，缺 child identity/log/heartbeat。Gradle/Vite 子进程脱离 leader 后可造成 cleanup 假 PASS。应抽取 managed-child helper，记录 PGID/start token/log/heartbeat，并以整个明确拥有的 tree 为空作为 cleanup 条件。

### M6. 两条 runner 对 strict OpenAPI 继续发送已删除的 `projectId`

Store create schema 为 `additionalProperties: false` 且不含 `projectId`，[contract](../../../contracts/openapi/components/organization/store.schemas.yaml#L494)；[L2 fixture](../../../scripts/test/r5-platform-admin-l2-fixture-seed.mjs#L133) 与 [diagnostic](../../../scripts/test/http-diagnostic-workload.mjs#L417) 仍发送它，前者还未选择项目 data node。项目范围已改为 session 真相，strict parsing 将拒绝请求。先选 session data node，再删除 create request body 中的 project 字段，补 schema-negative/runner readback proof。

### M7. 品牌授权搜索将“名称或编码”错误实现为 AND

[adapter](../../../apps/frontend/operations-admin/src/features/business-entity-management/application/HeadCompanyBrandAuthorizationActionAdapter.ts#L32) 将同一输入同时写入 `name`/`code`，[owner predicate](../../../apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java#L455) 以 AND 组合。品牌“春风 / CF-01”搜索“春风”必为空。应在 owner/contract 定义单一 `queryText` 的 name-or-code 语义，重生成 consumer；不得由前端双请求拼并集。

### M8. 品牌授权提交中 Drawer 仍可由遮罩关闭

[Drawer](../../../apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx#L31) 的局部 `submitting` 未接入 [lifecycle close guard](../../../libraries/frontend/admin-ui-foundation/src/behavior/useDrawerFormLifecycle.ts#L144)，并保持 `maskClosable`。[证据](../../../apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx#L103)。请求中关闭页面后 readback 会更新隐藏状态。应以 lifecycle 的 submitting 为唯一真相，提交期禁用 mask/keyboard/footer close，并补组件状态机测试。

### M9. 两项 AI-first control 当前不能作为 green evidence

`frontend-architecture` 目录仍将 `projectId` 登记为列表筛选，[catalog](../../../contracts/policy/crud-presentation-standard-catalog.json)，但 [Store 页面](../../../apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx#L47) 已将它变为 session scope；实际 gate FAIL。另仓规要求以 `<CURRENT_STEP>` 调用 standards coverage，而 checker 不认识 `RM1-P6-3`。[phase map](../../../scripts/check/standards-coverage#L13)。应同步 catalog/UI 语义，令 checker 可确定性解析 Roadmap step，并各补 production red mutation。

## S：下一批收敛

1. **总公司列表无条件携带完整品牌授权集合。** [Controller](../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsBusinessEntityController.java#L97) 和 [service](../../../apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java#L297) 会读取/物化每公司全部授权，但列表 UI 不显示。[UI](../../../apps/frontend/operations-admin/src/features/business-entity-management/ui/BusinessEntityManagementPage.tsx#L70)。拆分 list/detail read model，并加大集合不放大 page response 的测试。
2. **OpenAPI 声明了 owner 不会产生的 error code。** [generator augmentation](../../../scripts/generate/edge-operation-projections.mjs#L66) 将 retired bulk operation 的 `...AUTHORIZATION_REQUIRED` 投影到 add/remove。删除无 owner exception 的声明，或补窄异常、HTTP mapping 与端到端 proof。
3. **审计 JSON 读写真相不唯一。** [AuditChangeJson](../../../apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangeJson.java#L13) 只有 reader，多 owner 复制 `StringBuilder + escape`，如 [organization](../../../apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java#L579)。在 audit-model 集中 strict writer，并补 round-trip/null/control-character 测试。
4. **品牌授权 focused tests 固化错误请求，且不覆盖生命周期。** 需要 name-only/code-only、分页、mask-close、known 4xx、unknown-outcome readback/replay 测试。

## N 与固定值结论

品牌授权 Drawer 重复注册 overlay lock；当前未见遗留锁，删除外层重复调用即可。受管 runner 中 profile/run-scoped 的 loopback 地址、端口、bootstrap fixed time/identity 与测试 fixture 属于正确固定值；真正误用是已删除 contract 字段、手写 route/error/audit JSON 规则及自造 host binding。优先抽象：managed-child 生命周期、request-completed observability、AuditChangeJson writer、contract-owned candidate search。
