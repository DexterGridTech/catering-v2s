---
title: catering-v2s 全工程代码评审 · 合并终稿（Claude 甄别 + 合并 Codex 独立报告）
reviewTarget: CODEBASE
scope: 前后端代码、契约、脚本、治理工具；合并 Claude 与 Codex 两份独立报告
severityScheme: P0–P3 优先级（按 Dexter 2026-08-05 裁定，不设门禁结论）
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 本终稿是设计与修复输入；不授权任何实现、契约/schema 改动、DEV/seed/reset、动态运行或 Roadmap 变更
createdAt: 2026-08-05
inputs:
  - doc/review/platform/2026-08-05-v2s-full-engineering-code-review-claude.md
  - doc/review/platform/2026-08-05-v2s-whole-engineering-codex-review.md
---

# 全工程代码评审 · 合并终稿

## 0. 合并规则、口径与我对自己报告的更正

### 0.1 Dexter 的四项裁定（本稿据此成文）

| 议题 | 裁定 |
| --- | --- |
| 严重度口径 | **统一 P0–P3 优先级，不设门禁结论** |
| 673 处枚举字面量 / 4 份声明 | **全量收敛**（比我原建议的"只改分支判定处"更彻底） |
| 日志方案规模 | **根治彻底**。原话：「我没说过零基建。我们现在才建设了 5% 的功能，现在不把基础打好，后面更难走。问题考虑的必须长远，根治必须彻底。」 |
| 后续动作 | 终稿 + 建议的修复批次划分（不授权实施） |

**由此产生的标尺更正**：CLAUDE.md 的「分钟级、零基建」针对的是**治理/CI 工具**
（原文语境：CI 平台、备份演练、密钥轮换、指标监控），**不适用于产品底座**。
区分标准是**是否被产品代码长期依赖**：可观测性、封闭类型、共享 primitive → 底座，建彻底；
package exit 校验、receipt、分母对账 → 治理，按分钟级过滤。
我在初稿中把日志按"零基建"降级为最小方案，是**误用标尺**，本稿已按根治口径重写。

### 0.2 我对 Codex 9 条 M 的独立甄别结果

**8 条独立验证为真，1 条需要更精确表述，0 条被证伪。**

| Codex | 我的裁定 | 我的独立证据 |
| --- | --- | --- |
| M1 三分母失配 | **确认** | registry **154** / `SCENARIO_FACT_GROUPS` 展开 **144** / 测试断言 **147** |
| M2 日志不完整 | **确认，与我 P0-1 独立收敛** | 见 `§1.1`；它另给两点我漏了 |
| M3 bootstrap 自由 stdout | **确认** | `logging-boundaries` 实测 `R4_LOGGING_FREE_CONSOLE` |
| M4 host binding 自哈希 | **确认** | `?? sha256(host)` 后只验 `sha256(host)===hash`，重言式 |
| M5 cleanup 漏子进程 | **确认，但需更精确** | 见 `§2.3` —— 信号确实发给进程组，缺口在**证明侧**；`--no-daemon` 限制了实际暴露面 |
| M6 projectId strict-parse | **确认** | `OrganizationStoreCreateRequest` 无 `projectId` 且 `additionalProperties:false`，两 runner 仍在发 |
| M7 name/code AND 搜索 | **确认，真实用户可见缺陷** | 见 `§1.3` |
| M8 提交中可遮罩关闭 | **确认** | `maskClosable` 无条件；局部 `submitting` 未喂 lifecycle |
| M9 catalog/UI 漂移 | **确认** | `frontend-architecture` 实测 FAIL |

### 0.3 我对自己初稿的更正（必须记录）

1. **我用了 8 月 1 日的门快照，且没有声明这一点。** Codex 在 8 月 5 日 fresh 复跑，
   发现两道门已转红。我**根本没跑** `scripts/check/logging-boundaries`（该门存在且现在是红的），
   也没重跑 `frontend-architecture`（8/1 PASS，现在 FAIL）。**这是方法缺陷，不是口径差异。**
2. **我把前端日志描述为"生产整体关闭"，不够准确。** 实际是
   `safeLogger.ts:78` `if (!enabled && level === 'DEBUG') return;` ——
   **INFO/WARN/ERROR 仍写入内存环形缓冲**（`maxEvents` 默认 100），只是**永远不出港**。
   Codex 的「保留每实例最多 100 条不可读取内存事件」是更准确的表述。
3. **我怀疑"门失败却 exit 0"是系统性问题 —— 不成立。** 实测两道红门退出码均为 1，
   我先前是子 shell 读错。**主动撤回。**
4. **M7/M6/M8 这三条用户可见缺陷我全部漏掉。** 我的探针偏结构与系统性，
   Codex 的探针偏运行时与功能路径。这是本次两份报告最有价值的互补。

### 0.4 规模基线（我实测，排除 node_modules/build）

手写生产代码约 **23K 行**（backend owner 9.8K + backend edge 4.0K + 两个 App 8.5K + foundation 0.8K）；
generated 13K；治理工具 8.8K；契约 35K。

---

# P0 —— 底座级，必须根治

## 1.1 全链路可观测性缺失：业务失败在生产环境不留任何痕迹

> **来源**：Claude P0-1 与 Codex M2 **独立收敛**。这是两条独立审查线得出同一结论的唯一一条，
> 也是本次评审优先级最高的问题。

### 证据（我实测 + Codex 补充，均已复核）

**后端**

```
生产 Java 文件（非 test / 非 generated）      188 个
声明 Logger 的                                 1 个
全仓 log.info/warn/error/debug 调用点           0 处
```

唯一 Logger 是 `modules/foundation/.../Slf4jSecurityDiagnosticRecorder.java`，
只接收 `PublicSecurityDiagnosticInterceptor` 的事件，而该拦截器**只覆盖
`@PublicSecurityOperation` 标注的公共安全路由**（登录/OTP/找回/邀请）。
`HttpRequestMetricsInterceptor` 是诊断 run 的 JSONL sink，**default-off**
（Codex 引 `HttpRequestMetricsInterceptorTest` 为证）。

**结论：154 个 operation 中占绝大多数的已认证业务面，成功与失败都不写一行日志。**

**前端**

- `PlatformApi.ts:7` / `OperationsApi.ts:9`：`createSafeLogger({enabled: import.meta.env.DEV})`
- `safeLogger.ts:78`：非 DEBUG 级别仍入内存环形缓冲（`maxEvents` 默认 100），**但无任何出港通道**
- `logger.*` 显式调用点 **各 0 处**；`console.*` **各 0 处**
- **`AdminErrorBoundary` 提供 `onError?`（`:13` 定义、`:38` 调用），两个 App 都只传
  `resetKeys`/`fallback`，未接 `onError`**（`PlatformApp.tsx:172-175`、`OperationsApp.tsx:360-363`）
  → **每一次 React 渲染崩溃都被边界吞掉，用户看到"页面暂时无法显示"，系统没有任何记录**

### 可复现失效场景

运营管理员作废合同撞并发：`ContractCommandService.java:115` 的 CAS
`... WHERE status='ACTIVE' AND version=?` 返回 0 行 → `throw new ContractConflictException()`。
**服务端零日志、前端零日志、错误边界不记录。** 只看得到一个 409。
谁在并发、撞的哪条合同、expectedVersion 是多少 —— 全部不可知。

### 根因

**观测能力被建成了"诊断期设施"而不是常驻底座。** 三套机制
（`HttpRequestMetricsInterceptor` / `SeedRequestMetricsInterceptor` / `SecurityDiagnosticRecorder`）
各自为受管诊断 run 或公共安全面服务，**没有一套是应用日志**。
于是"可被追踪的调用"= 公共安全路由 ∪ 诊断 run 期间，而不是全部调用。

**与仓内自定纪律直接冲突**：`project-memory/pitfalls/log-first-failure-retry.md`
要求"失败先读日志再重试"——**业务失败没有日志可读**。
作为 AI-first 工程，这切断了 AI 最主要的排障输入。

### 根治方案（按 Dexter 裁定，不做最小止血作为终态）

**一、后端常驻 request-completed 结构化事件**

在 edge 建一条**始终开启**的 completion 通道，字段沿用现有五元组并补齐：
`{runId?, correlationId, requestId, operationId, owner, routeTemplate, consumerFace,
httpStatus, outcome, errorCode?, durationMs, databaseOperationCount, databaseDurationMs}`。
`HttpRequestMetricsInterceptor` 已经在算这些值，**改的是出口不是采集**：
现在只写诊断 JSONL，应同时以 INFO 级结构化日志常驻输出。

**二、后端 owner 失败的 typed 上下文**

所有 owner 通过 typed exception 失败，在既有 `@ControllerAdvice`
（`ContractProblemAdvice` 等）集中补 `errorCode` + 关键上下文
（`expectedVersion`、目标 id、CAS 命中行数），**改一处覆盖全部写命令**。
这一步是上面第一条的补充，不是替代。

**三、前端出港通道 + 错误边界接线**

- `SafeLogger` 增加 sink：生产保留 WARN/ERROR 并回传（或至少 `sendBeacon` 到 edge 的诊断入口）；
  DEV 全开。**保持现有 `blockedKeys` 脱敏边界不变**（`safeLogger.ts:57-64` 已实现字段级剔除）。
- 两个 App 为 `AdminErrorBoundary` 接上 `onError`，把渲染崩溃送进同一 sink。
- `createObservedBaseQuery` 已在 RTK 层观察到全部请求，出港后即成为完整前端链路。

**四、脱敏红线（必须同时建立）**

禁止落盘：密码、OTP、token、cookie、Authorization、手机号、登录名、raw payload、stack。
`SafeLogger` 的 `blockedKeys` 是既有实现，后端侧需要等价机制并配真实红变异测试。

### 与 M3 的关系

`ManagedInvitationBootstrap.java:50` 的 `System.out.println` 正是"没有正规通道所以自己 print"
的直接产物 —— 它有受控私有 output 文件却仍用自由 stdout。
**建成常驻通道后，M3 自然消解**；在此之前它是 `logging-boundaries` 门红的直接原因。

---

## 1.2 契约演进到 154 之后，分母与发送方都没跟上（M1 + M6 同一根因）

> **来源**：Codex M1 + M6。**两份报告都把它们当独立项列，实际是同一根因** —— 这是本次合并的新增判断。

### 证据

```
generated route registry              154 operations
SCENARIO_FACT_GROUPS 展开             144 operationId（84 组）
rm1-http-diagnostic.test.mjs:105/134  断言 declared === 147
```

`http-diagnostic-scenarios.mjs` 的 exact-set 校验因此抛
`HTTP_DIAGNOSTIC_SCENARIO_FACT_SET_INVALID`，**所有 workload 在首个请求前失败**。

同一根因的另一面：`OrganizationStoreCreateRequest` 的 schema
（`additionalProperties: false`，属性为 `brandId/tenantId/headCompanyId/code/name/notes/extensionValues`）
**已无 `projectId`**，而 `r5-platform-admin-l2-fixture-seed.mjs:133` 与
`http-diagnostic-workload.mjs:417` **仍在发送 `projectId`** ——
项目范围已改为 session 真相，strict parsing 必然拒绝。

### 为什么这是同一根因

契约从 147 → 154 演进时，**下游三类消费者没有一个被强制跟随**：
场景事实表（144）、测试断言（147）、runner 请求体（仍带已删字段）。
`edge-codegen --check` 保证的是 root OpenAPI ↔ generated registry 的一致
（我在 U13-C01 复审中验证过它对删引用/错指/路径 typo 三类变异都真红），
**但它管不到 scenario 表、测试常量与 runner body**。

### 根治方向

> **2026-08-05 重要修订（Codex 反驳成立，我原方案会破坏一条刻意的设计不变量）**：
> 我原写"场景事实表从 generated registry **派生**"。**这是错的**，而且恰好是该文件明令禁止的做法。
> `http-diagnostic-scenarios.mjs:6-7` 的注释原文：
> **"Every member is written explicitly. … no operation name, method or route is used to invent a scenario."**
> 每条 fact 携带 `businessTask`、**≥2 条真实 `sourceRefs`**（controller/service 类名）、
> `ownerReadback`、`prerequisiteHandles`、`oracle` —— **这些语义 registry 里根本不存在，无法派生。**

**修正后的方案（采用 Codex 的形状）**：

1. **registry 只提供强制 operation 分母**（"哪些 operation 必须被覆盖"），
   **不生成任何场景语义**；每个 operation 必须有**手写的 workload fact**
   或**显式且有证据的 disposition**。当前缺的 10 条（154−144）按此逐条补齐。
2. 测试断言改为读同一分母来源，**删除 `147` 这个硬编码常量**。
3. runner 的 request body 应由 generated 类型约束
   （现在是手写 object literal，所以契约删字段不会报错）——
   这是让 M6 类问题"编译期就红"的唯一结构性办法。

---

## 1.3 品牌授权搜索把"名称或编码"实现成了 AND（用户必然踩到）

> **来源**：Codex M7。**Claude 初稿完全漏掉** —— 这是两份报告互补价值最高的一条。

### 证据（我逐行复核）

`HeadCompanyBrandAuthorizationActionAdapter.ts:41-42` 把**同一个** `queryText`
同时写进两个字段：

```ts
name: queryText?.trim() || undefined,
code: queryText?.trim() || undefined,
```

owner 侧 `BusinessEntityService.java:467` 的谓词用 **AND** 组合：

```sql
(CAST(? AS text) IS NULL OR lower(name) LIKE ?) AND (CAST(? AS text) IS NULL OR lower(code) LIKE ?) AND ...
```

**后果**：品牌「春风 / CF-01」搜「春风」→ 要求 `name LIKE '%春风%' AND code LIKE '%春风%'` → **永远为空**。
只有名称与编码**同时**包含搜索词的品牌才搜得到。

### 根因

前端把"一个搜索框"翻译成"两个筛选字段"，而契约与 owner 从未定义过 name-or-code 语义。
这是 **UI 意图与 owner 谓词之间没有契约**的典型后果。

### 根治方向

在 **owner/contract 定义单一 `queryText`** 的 name-or-code 语义并重生成 consumer。
**不要**在前端发两次请求求并集（那会把语义留在客户端，且分页无法正确合并）。
需要补 name-only / code-only / 两者都不匹配 的 focused test。

---

## 1.4 组织节点封闭集合有 4 份声明 + 316 处裸字面量

> **来源**：Claude P0-2。**Codex 明确不认为这是问题**（其 N 段判定受管固定值属正确使用）。
> **Dexter 裁定：全量收敛。**

### 证据

生产 Java 中五类节点字面量：`PROJECT 104 / STORE 100 / GROUP 99 / HEAD_COMPANY 89 / REGION 85`
（业务枚举字面量合计 673 处；其中 SQL 内嵌仅 4 处，**Java 分支逻辑 316 处**）。

> **2026-08-05 修订（Codex 反驳成立，我已复核）**：我初稿写的"**4 份等价声明**"**不准确**，
> Dexter 的「全量收敛」裁定是基于这个有瑕疵的前提做出的，**请重新裁定**（见 `§6.1`）。
> 修正后的事实是 **2 份活的全量声明 + 1 份死代码 + 1 份业务子集**：

| # | 位置 | 形态 | 修正后的判断 |
| --- | --- | --- | --- |
| 1 | `app/edge/generated/wire/ServiceNodeType.java` | generated enum | 活，edge 层 |
| 2 | `app/edge/catalog/OrganizationNodeType.java` | 手写 enum，与 #1 同值 | **死代码** —— 我实测全仓**零生产引用**，应**删除**而非收敛 |
| 3 | `WorkspaceRoleService.java:39` | `Set.of(五值)` | 活，与 #1 真重复 |
| 4 | `OrganizationHierarchyService.java:25` | `List.of("REGION","PROJECT")` | **不是重复** —— 这是"组织树节点"的**业务约束**（只有大区/项目构成树），与"服务节点"是不同概念 |

**Codex 的语义修正是对的且很重要**：需要先建立「服务节点类型 vs 组织树节点类型」两个**不同**的
类型模型，再谈收敛。把 #4 当成 #1 的子集来"统一"会抹掉一条真实业务约束。

### 根因（这一点决定了修法）

`app` → `modules:*` 是**单向依赖**（`build.gradle.kts:9-16`）。
两个 enum 都住在 **app/edge 层**，owner 模块**架构上不可能** import 它们。
owner 只能自己再声明或直接写裸串。

**而 `modules/execution-context` 被 app 与各 owner 共同依赖，且是 `api(...)` 传递导出
（`workspace-iam/build.gradle.kts:6`）—— 它就是这个封闭集合的天然住处，现在什么都没放。**

### 典型伤害

`OrganizationHierarchyService.java:486` 一行内联了 4 个封闭集合：

```java
if (!List.of("NAME","CODE","UPDATED_AT").contains(safeSort) || !List.of("ASC","DESC").contains(safeDirection)
    || (type != null && !NODE_TYPES.contains(type)) || (status != null && !List.of("ENABLED","DISABLED").contains(status))
    || (projectId != null && !"PROJECT".equals(type))) throw new OrganizationValidationException();
```

新增节点类型需人工找齐 4 份声明 + 316 个使用点；漏一处 `switch` 的 `default -> false`
就是**静默的授权/可见性缺口**，且没有任何门能发现。

### 根治方案（Dexter 裁定：全量）

> **2026-08-05 两处修订**：
> (1) Codex 指出我原写的"edge generated enum 从 execution-context 的 Java 类型派生"**机制上不可执行**
> —— `edge-codegen.mjs` 是 **Node 从契约生成 Java**，不能反向以 Java 类型为源。**方向搞反了，已改。**
> (2) **Dexter 已裁定采用 (a) 全量收敛。** 但我在准备执行计划时查出一个必须前置的事实，见下。

### ⚠ 执行前必须知道：316 处**不属于同一个集合**

`"HEAD_COMPANY"` 这一个字面量，在生产代码里至少分属 **5 个语义不同的封闭集合**：

| 集合 | 取值 | 声明处 |
| --- | --- | --- |
| **服务节点类型**（任职/授权目标） | `GROUP, REGION, PROJECT, HEAD_COMPANY, STORE` | `ServiceNodeType.java` / `WorkspaceRoleService.java:39` |
| **组织树节点类型**（只有这两种构成树） | `REGION, PROJECT` | `OrganizationHierarchyService.java:25` |
| **审计 entityType** | `ORGANIZATION_NODE, BRAND, TENANT, HEAD_COMPANY, STORE, BUSINESS_ENTITY, WORKSPACE_ROLE, WORKSPACE_ACCOUNT, WORKSPACE_INVITATION`… | `OrganizationAuditHistoryService.java:14` 等 |
| **业务实体类型**（**不含 STORE**） | `BRAND, TENANT, HEAD_COMPANY` | `BusinessEntityService.java:35` |
| **扩展字段宿主类型**（8 值） | `BRAND, TENANT, HEAD_COMPANY, STORE, CONTRACT, COMMERCIAL_GROUP, REGION, PROJECT` | `ExtensionDefinitionService.java:26` |

**按字符串全局替换会把这 5 个集合合并成 1 个** —— 那是**不可逆的语义损失**，比现状更糟。
这与 `§2.4` 的 `statusLabel` 是同一教训（**同名不同义**），只是规模放大到 316 处。

### (a) 全量收敛的真实执行形状

**不是"替换 316 个字符串"，而是"先归类、再建型、后替换"：**

1. **逐处归类**：把 316 处字面量归入上述 5 个集合之一
   （或发现第 6 个）。**这一步是人工语义判断，不能用正则**；
   产出一张 `文件:行 → 所属集合` 的对照表，作为后续所有步骤的分母。
2. **确定中立规范源**：`ServiceNodeType.java` 头部已声明
   *"Generated from accepted R5 OpenAPI components"* —— **OpenAPI component 已经是 edge 侧的规范源**。
   扩展 `edge-codegen.mjs`，让它从**同一个** component **同时**生成
   owner 侧类型（落在 `execution-context` 或 `foundation`，两侧均可依赖）与 edge 侧 enum。
   其余 4 个集合各自确定规范源（审计/实体/扩展宿主的规范源可能不在 OpenAPI，需逐个裁定）。
3. **删除死代码** `OrganizationNodeType`（零生产引用）。
4. **分集合替换**，每个集合独立成一个可回滚的步骤，**先做服务节点类型**
   （它含唯一那处静默 `default -> false`，见下）。
5. **优先修的一处**：`WorkspaceAuthenticationService.java:244` 的
   `enterable(...)` 是全仓**唯一**按节点类型分支且静默兜底的地方
   （其余 6 处 `switch` 都是 `default -> throw`，本就 fail-closed；3 处是无害的 SQL 字段默认）。
   建议它改为 fail-closed，**这一处可以先于全量收敛单独落地**。
6. **可选门**：owner 生产代码出现裸字面量即红 ——
   必须**按集合分别建门**（否则又会把 5 个集合当成 1 个），
   且**需要真实红变异证明**才成立。

**风险提示**：第 1 步的归类质量决定整个批次的成败。
归类错一处，就是把一个集合的值悄悄塞进另一个集合的类型里，
而**编译器不会报错**（都是同名常量）。建议归类表由 Codex 产出后单独接受一次独立复核，
再进入第 2 步。

---

# P1 —— 正确性与一致性

## 2.1 提交进行中 Drawer 仍可被遮罩关闭

> **来源**：Codex M8。

`HeadCompanyBrandAuthorizationDrawer.tsx:103` 的 `maskClosable` **无条件为真**
（同行 `:104` 的 `keyboard={!submitting}` 反而是守住的）。
组件用**自己的** `useState` `submitting`（`:31`），而 `lifecycle.requestClose`
守的是 foundation 内部的 `submittingRef`（`useDrawerFormLifecycle.ts:145`）——
**两个 submitting 从不互通**，所以提交期 `requestClose` 直接放行。

**后果**：提交进行中点遮罩关闭页面，随后 owner readback 更新的是已隐藏的状态。

**根治**：以 lifecycle 的 submitting 为唯一真相（把提交状态交给 `useSubmissionLifecycle`），
提交期同时禁用 mask / keyboard / footer close，并补组件状态机测试。
**这是 P1.4 抽象缺口的一个实例**，建议一起处理。

## 2.2 远端 host 绑定是自哈希，等于没有绑定

> **来源**：Codex M4。

`scripts/dev/r5-dev-environment.mjs:31`：

```js
V2S_DEV_REMOTE_HOST_SHA256: env.V2S_DEV_REMOTE_HOST_SHA256 ?? crypto.createHash("sha256").update(host).digest("hex")
```

缺 hash 时**由同一 host 串现算**，而 `:41` 的校验只验
`sha256(host) === hostHash` —— **重言式，恒真**。
唯一实质防线是 `productionLike()` 的 `prod|production` 正则，
任何不含该字样的错误 alias 都能携带自己的 hash 通过。

**根治**：expected binding 从**受控 non-production allowlist / fingerprint source** 读取，
runner 只能比对并记录 readback，不得现算。

## 2.3 cleanup 的存活证明只覆盖组长进程

> **来源**：Codex M5。**我的表述比 Codex 更精确**（见下）。

`http-diagnostic-runner.mjs:163-172`：信号**确实**发给进程组
（`process.kill(-pgid, 'SIGTERM')`），且强制每个受管进程必须是组长
（`pgid !== pid` 即抛 `HTTP_DIAGNOSTIC_PROCESS_IDENTITY_DRIFT`）——
**这两点比 Codex 描述的更强**。

**真实缺口在证明侧**：存活轮询只查 `pidAlive(processValue.pid)`（组长），
调用 `setsid()` 脱离进程组的孙进程（Gradle daemon 是典型）会在组长死后存活，
而 cleanup 报 PASS。`rm1-http-diagnostic.mjs:181` 的 bootstrap 用
`spawnSync(..., timeout: 120_000)` 且**无 identity/log/heartbeat 记录**；
不过它带 `--no-daemon`，**限制了这一条的实际暴露面**。

**根治**：抽 managed-child helper，记录 PGID / start token / log / heartbeat，
以**整棵明确拥有的进程树为空**作为 cleanup 条件，而非组长 PID 不存活。

## 2.4 两个 App 各造了 14 个同名轮子，其中 4 个是业务真相

> **来源**：Claude P1-1。

两个 App 各自独立定义同名 helper 共 **14 个**：
`action, activeControllers, adminCatalog, expandPath, extensionFields, extensionValue, field,
hierarchyNameCollator, hierarchySearchMatches, logger, menuIconByKey, problem, statusLabel, time`

> **2026-08-05 大幅修订（Codex 反驳成立）—— 这条我原来的方法有缺陷，降级为 P2。**
>
> Codex 指出「**同名不等于同义**」。我复核后确认它是对的，而且我的取证方式本身站不住：
> **我用正则匹配标识符名就推断"重复"，没有打开两份实现比对**。这正是我在别处一直警惕的
> "猜字段名"错误类，这次自己犯了。

**实测反例（推翻我原来的核心论据）**：

```ts
// platform-admin/.../PlatformInvitationPanel.tsx:16   —— 邀请状态显示映射
const statusLabels = {ACTIVE:'有效', CANCELLED:'已取消', EXPIRED:'已过期', COMPLETED:'已完成'};

// operations-admin/.../BusinessEntityDetailDrawer.tsx:157 —— 按钮动作文案
const statusLabel = selected?.status === 'ENABLED' ? '停用' : '启用';
```

**两者语义完全不同**：一个是"状态显示"，一个是"点下去会做什么"。
它们描述的甚至不是同一组状态。我原来说的"两个后台可能对同一状态给出不同中文"**不成立**。
`problem` 同理，两端分母混有不同业务状态与不同用户提示，**不能一刀切上收**。

**修正后仍然成立的部分（我实测确认，Codex 也认同）**：

```ts
// 两个 App 完全相同的构造，用途同为组织树名称排序
const hierarchyNameCollator = new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'});
//   platform-admin/.../PlatformReadPage.tsx:32
//   operations-admin/.../OrganizationStructurePage.tsx:21
```

**修正后的结论（P2）**：
- **可收敛**：`hierarchyNameCollator`（字节级相同）、审计展示格式。
- **必须保持 App-local**：`menuIconByKey`、`adminCatalog`、`extensionFields`、App API 状态 ——
  两个后台的主题与路由边界本就不应合并。
- **需要逐个判定、不得按名收敛**：`statusLabel`、`problem`、其余同名项。

## 2.5 `pageSize > 100` 被复制 6 份

> **来源**：Claude P1-2。

> **2026-08-05 修订（Codex 反驳成立）**：我说 6 处，**实际 14 处**（我数少了）；
> 而且它们**抛的 typed error 各不相同**，我原来提的统一 `PageRequest.bounded()`
> 会抹平 owner 各自的错误语义。**改用 Codex 的方案。**

实测 **14 处**，跨 6 个 owner，错误类型至少 4 种：

```
IllegalArgumentException(不同 message) × 9   OrganizationValidationException × 1
RoleValidationException × 1                  AccountNotFoundException × 1   其余 2 处内联条件
```

**修正后的方案（P2）**：只抽**共享上限常量**或**窄校验工具**，
**保留 owner 自己的 typed error 语义**；不引入通用 `PageRequest` 改写全部调用点。

**副产物新发现（两份报告原本都没有，由本轮对抗产生）**：
`WorkspaceUserService.java:363` 把**分页参数违规**抛成
`WorkspaceAccountService.AccountNotFoundException` ——
客户端传 `pageSize=200` 会收到"账号不存在"而不是校验错误。

> **2026-08-05 定级修订（Codex 建议成立）**：**列 P2，不随本项立即改。**
> 改动异常类型会改变 edge 的 problem mapping 与 HTTP 状态码，
> **必须先确认所有调用方的安全语义**（是否有地方刻意用 404 掩盖存在性），
> 再引入专门的参数校验异常。

## 2.6 总公司列表无条件物化全部品牌授权

> **来源**：Codex S1。

`OperationsBusinessEntityController.java:97` → `BusinessEntityService.java:297`
为**每个**总公司读取并物化全部授权，但列表 UI（`BusinessEntityManagementPage.tsx:70`）不显示。
这与我在 U13 报告中定位的两处 page 扇出（workspace logo、head-company authorizedBrands）是同族。

**根治**：拆分 list / detail read model；补"集合不放大 page response"的测试。

---

# P2 —— 健壮性与可维护性

## 3.1 审计 JSON 的写入真相不唯一

> **来源**：Codex S3。

`AuditChangeJson.java:13` **只有 reader**，各 owner 各自复制 `StringBuilder + escape`
（如 `BusinessEntityService.java:579`）。手写 JSON 转义是经典缺陷源（控制字符、null、引号）。
**根治**：在 `audit-model` 集中 strict writer，补 round-trip / null / 控制字符测试。

## 3.2 OpenAPI 声明了 owner 不会产生的 error code

> **来源**：Codex S2。

`edge-operation-projections.mjs:66` 把已退役 bulk operation 的 `...AUTHORIZATION_REQUIRED`
投影到 add/remove。契约声明了永不出现的错误码，消费者会为不可能的分支写处理。
**根治**：删除无 owner exception 支撑的声明，或补窄异常 + HTTP mapping + 端到端 proof。

## 3.3 `findFirst()` 承载唯一性假设

> **来源**：Claude P2-1。

> **2026-08-05 收窄（Codex 反驳成立）**：我原来的范围太宽，**不得全量替换**。

我复核了 Codex 举的反例，**它是对的**：
`JdbcGroupWorkspaceRepository.java:65` 的查询是 `WHERE gw.group_workspace_key = ?`，
而迁移 `V20260725_170000_000__platform_workspace_and_commercial_group.sql:11` 有
`CONSTRAINT uq_group_workspace_key UNIQUE (group_workspace_key)` ——
**数据库唯一约束已经保证唯一，这里的 `findFirst()` 是正确的**。
多数 catalog 值又来自 codegen 且已有基数断言（role-home lookup 已被生成器改为重复即抛）。

**修正后的范围（P2，很窄）**：只审计**既无 codegen 基数断言、又无数据库唯一约束**的
一对一 lookup，逐个改为"恰好一条否则抛"。**不做全仓机械替换。**

## 3.4 吞异常且无日志兜底

> **来源**：Claude P1-3。

> **2026-08-05 修订（Codex 反驳成立，我撤回其中一半）**：
> 我把 `PlatformCommercialGroupController.java:125` 的
> `catch (RuntimeException ignoredAgain) {}` 列为"吞异常且无日志兜底"，**这是错的**。
> 我复核了 `Slf4jSecurityDiagnosticRecorder.java:29-35`：`recordWriteFailure` **内部就写 WARN**
> （`event=DIAGNOSTIC_WRITE_FAILED` + `operationId`）。外层那个 catch 只在 **WARN 本身再抛** 时触发，
> 是**刻意的防递归设计**，注释也写明了 "deliberately a distinct foundation-owned fallback"。
> **这一半撤回。**

**仍然成立的一半，且应升为 P1**（Codex 判断，我认同）：

`MinioAssetObjectStorage.java:67` 的 `exists()` 把**不存在、认证失败、网络故障**
统统折叠成 `false`，**会把依赖不可用伪装成资源不存在** ——
调用方据此认为"资产不在"，可能走出完全错误的业务分支。

**根治**：只有明确的 NotFound 返回 `false`，其余抛既有的 unavailable 异常。

## 3.5 超长单行方法

> **来源**：Claude P2-2。

`ContractCommandService.java:88/:115`、`BusinessEntityService.java:586`、
`OperationsWorkspaceInvitationController.java:60` 均为单行内联 SQL + 条件 + 抛错（400+ 字符）。
**架构层职责分离是清楚的**（owner 主权、edge 只编排、跨模块 typed command 都成立），
问题只在行内密度。对 AI-first 工程尤其伤 diff 与定位。
**根治**：优先把内联 SQL 提为命名常量（同时改善 P0-1.1 的日志上下文），其余接触即改。

## 3.6 治理工具右尺寸

> **来源**：Claude P2-3。

`tools/` 8,784 行，4 个文件占 6,344 行（`compliance-control` 2,542 —— 全仓最大单文件）。
Dexter 已在 7/31 裁定过一轮 trim（我当时复审 GO，实测净删 −17.7%），
**本稿不重开该结论**；建议按既有 `CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES`
判据检查 `compliance-control` 内部哪些分支"最近五个 package 从未变红"。

## 3.7 standards-coverage 的 phase 词表与 Roadmap 不通

> **来源**：Codex M9 后半 + 我此前多轮 N。

> **2026-08-05 修订（Codex 反驳成立，我撤回原表述）**：我原写"checker 与 Roadmap 不通"，
> 暗示 checker 失效 —— **这是错的**。

实测：矩阵自身声明 `currentPhase = "R2"`、`roadmapStep = "R2"`；
`--phase R2` **PASS**（`RULES=150`），`--phase R5` 也 **PASS**。
**checker 工作正常。** 只有传入 `RM1-P6-3` 才 `UNKNOWN_PHASE`，
而 `CLAUDE.md` 的原文指令本身写的就是 `--phase <R2|R3|R4|R5|R6>` ——
**传 `RM1-P6-3` 是错误输入，不是 checker 缺陷。**

**实际存在的（很轻）问题**：矩阵 `status: IN_REVIEW`、`currentPhase` 停在 `R2`，
而 Roadmap `CURRENT_STEP=RM1-P6-3`。两套 phase 词表并存且**没有记录映射关系**，
所以每轮 review 都要重新判断"该传哪个 phase"。

**降级为记账项**：在矩阵或 memory 中记一行两套词表的对应关系即可，不需要改 checker。

---

# P2.9 ｜`infra/` 目录已删除（2026-08-05，Dexter 授权执行）

> 这是本报告中**唯一一处已执行的仓库改动**，其余全部仍是设计输入。
> Dexter 明确指示「没有存在必要就标记到文档里，清理掉」。

## 删除前的必要性核验（三项独立检查，全部支持删除）

| 检查 | 结果 |
| --- | --- |
| 生产代码是否引用 | **零引用**。全部引用都在 `doc/evidence` 与 `doc/plans` 的**历史 R3 记录**里 |
| 后端是否仍实现该方案 | **否**。`README` 描述的 `R3_EXTERNAL_ACCESS_PROVIDER` + `X-Edge-Auth` 在 `apps/backend` 中**零命中**，方案已被 cookie/session 取代 |
| 是否有门依赖它 | **否**。`code-layout/cli.mjs:32` 的 `infra` 是**顶层目录允许清单**（与 `.idea`/`.runtime`/`node_modules` 并列），不是"必须存在"；`r3-u02-skeleton-evidence.json` 虽绑定其 sha256，但**无任何门复算该文件** |

## 删除内容（快照留档）

```
infra/r3/README.md                      87ef50f8add70411   5 行
infra/r3/access-provider-contract.json  f69d8284243193ab  18 行
infra/r3/nginx.conf                     ba57dd490a34d29a  26 行
infra/r3/operations-admin-route.conf    3018afa35cd444aa  10 行
infra/r3/platform-admin-route.conf      e8afb7369424f9da  10 行
                                                  合计 5 文件 / 69 行
```

## 删除后验证

```
code-layout        仍为删除前那条老红（EMPTY_SOURCE_DIRECTORY:…/publicentry/passwordreset），
                   非本次删除引起
backend-boundaries R4_BACKEND_BOUNDARIES=PASS
heritage-registry  HERITAGE_REGISTRY=PASS
```

## 必须显式记录的一项后果（不静默）

`doc/evidence/platform/r3-u02-skeleton-evidence.json:40-43` 绑定了其中 4 个文件的 sha256。
删除后**该历史 evidence 的 hash 不再可就地复验**。

按本仓惯例，evidence 是**过去状态的冻结记录**，其对象被后续阶段清理属正常演进；
但必须**显式记录而非静默删除** —— 本节即为该记录。
无门复算这些 hash，因此不产生任何红。

## 顺带发现（未处置）

`scripts/run/platform-commercial-group-skeleton` 是 `X-Edge-Auth` 的**最后一个消费者**
（`:142-150`），而后端已不实现该 header。它同样只在历史 review/evidence 文档中被提及，
无任何 live 脚本或 manifest 调用它。**建议一并评估退役**，但本轮未动。

---

# P3 —— 记录（做对了 / 不建议现在动）

1. **前端手拼 API 路径 0 处** —— 462 处 `/api/...` 全在 generated 客户端内，
   生产特性代码与测试代码各 0。**契约→客户端单向投影纪律守住了，应记为不得回退。**
2. **owner 边界与事务纪律成立** —— 跨模块写走 typed command 并入同一 `REQUIRED` 事务；
   extension values 写在宿主自己 schema，无跨 schema DML；edge 不自行拼装授权事实。
   这些我在前几轮 review 中逐处验证过，本轮复查未见回退。
3. **受管 runner 中的固定值属正确使用** —— loopback 地址、端口、run-scoped 时间/identity、
   测试 fixture 是**正确的固定值**（Codex 判断，我认同）。
   真正的误用集中在：已删除的 contract 字段、手写 route/error/audit JSON 规则、自造 host binding。

---

# 4. 建议的修复批次划分（不授权实施）

| 批次 | 内容 | 合并理由 / 必须单独走的理由 |
| --- | --- | --- |
| **B1 可观测性底座** | P0-1.1 全部四项 + `ManagedInvitationBootstrap` 的自由 `System.out`（M3） | **必须一个包**：后端 completion 事件、前端 sink、错误边界接线、脱敏红线是同一套机制；分开做会出现"半条链路"。`System.out` 归此包，因为它正是"没有正规通道所以自己 print"的产物。**不含任何吞异常项**（诊断半条已撤回，MinIO 见 B4b） |
| **B2 契约分母对齐** | P0-1.2（M1 + M6） | **必须一个包**：分母强制、测试断言去硬编码、runner body 类型化是同一根因；改一半会让诊断继续红。**注意 B2 不得"从 registry 派生场景事实"**，见 `§1.2` 修订 |
| **B3-0 归类表**（前置） | 316 处字面量 → 5 个封闭集合的对照表 | **必须单独走且先做**：人工语义判断，产出 `文件:行 → 所属集合`；**建议单独接受一次独立复核**再进入 B3-1。归类错误编译器不会报错 |
| **B3-1 服务节点类型收敛** | 规范源生成两侧类型；删死代码；替换服务节点类型那一组 | 含唯一那处静默 `default -> false`（`WorkspaceAuthenticationService:244`）；**该处可先于本批单独落地** |
| **B3-2…n 其余集合** | 组织树 / 审计 entityType / 业务实体 / 扩展宿主，各一步 | **每个集合独立成可回滚步骤**，不得合并；各自的规范源需逐个裁定 |
| **B4a 品牌授权 Journey 缺陷** | P0-1.3（AND 搜索）+ P1-2.1（Drawer 遮罩） | 同一条 Journey、同一批 focused test；AND 搜索需 owner/contract 改动，Drawer 需前端状态机改动，但验收面共享 |
| **B4b 资产 owner 故障分流** | P2-3.4 的 MinIO `exists()` | **必须与 B4a 拆开**（Codex 正确）：owner 不同（asset）、契约面不同、验收面不同，捆绑会让包过大且回归难定位 |
| **B5 前端窄收敛** | 仅 `hierarchyNameCollator` 等**字节级相同**项 | 已按 `§2.4` 收窄；`statusLabel`/`problem` **不进此包**，需逐个判定 |
| **B6 运行时安全与 cleanup** | P1-2.2（host binding）+ P1-2.3（managed-child） | 可合一个包：都在 `scripts/dev` 受管运行边界 |
| **B7 零散收敛** | P1-2.5（含 `WorkspaceUserService:363` 错误类型）、P1-2.6、P2-3.1、P2-3.2、P2-3.3、P2-3.5、P2-3.7 | 接触即改，不必单独排期 |
| **B0-a 分类 `scripts/check/`**（建议**最先做**，见 `§4.5.3b`） | 把 38 个条目分为四类：**真门 / 报告工具 / 需参数的门 / 已关闭阶段模式**；合并 `query-boundaries`+`database-operation-budget` 这对别名；给需参数的门定默认调用形式 | **必须先于接线** —— 目录里混着门与报告工具（`canonical-performance-ledger` 是 262KB 的 JSON 扫描器，不是门），"38 个全接进 verify"是错的 |
| **B0-b 门接线** | 把**分类为真门**的那些接进 `scripts/verify`；补一条"门必须接线或显式豁免"的自指 check | **成本几乎为零、收益是一批现成的门**。`logging-boundaries` 长期红没人知道就是因为它不在 verify 里。接线后按既有退役判据处置长期不红的门 |
| **B0-c 清红** | 处置去重后的 **7 类**真实红（不是 11 道） | `contract-face`/`production-conformity` 同源，其 U01 catalog 121→154 **并入 B2**；`module-dependency-registry` 的未声明跨 schema 读需单独裁定（声明 or 改走 owner API）；`gate-0` 只需标注不接线 |

**建议顺序**：**B0-a 修门 → B0-b 接线 → B0-c 清红** → B2（先让诊断能跑）→ B1（可观测性底座）→ B4a（用户可见缺陷）→ B4b（资产故障分流，很小）
→ **B3-0 归类表 → B3-1 → B3-2…n**（Dexter 已裁定全量；放 B1 之后是因为这是全部批次里回归面最大的一组，
需要日志辅助定位）→ B5 → B6 → B7。

> **可提前单独落地的一小项**：`WorkspaceAuthenticationService.java:244` 的静默
> `default -> false` 改为 fail-closed。它是全仓唯一真正静默的节点类型分支，
> 改动极小，不必等整个 B3。

> **本表已按 2026-08-05 第 5 轮对抗修订**（B1 去重、B2 去除错误的派生方案、B3 方向修正、B4 拆分）。
> Codex 的结论是"问题事实大部分可采纳，批次划分需按五点修订后才适合进入设计"——
> 五点已全部落实，**本表现在可作为设计输入**。

---

# 4.5 防复发建设：让剩下 95% 的功能不再重犯

> **本节回答 Dexter 的追加要求**：这些问题是建设过程中**累积**出来的；
> 即使这次一次性优化掉，后续 95% 的功能建设仍可能重犯。
> 所以必须写明**该建什么项目记忆、设计规范、门**。

## 4.5.0 总原则：先接线，再建门（这是本节最重要的一条）

**实测事实**：

```
scripts/check/ 下的门          38 道
串入 scripts/verify 的          10 道
未串入的                        28 道（74%）
```

**未串入的 28 道里包括**：`logging-boundaries`（**本次实测为红，没人知道**）、
`security-boundaries`、`capability-invariants`、`module-dependency-registry`、
`code-layout`、`query-boundaries`、`database-operation-budget`、
`production-conformity`、`business-terminology-traceability`、`ui-wireframe-traceability`……

**`logging-boundaries` 之所以能一直红着没人发现，就是因为它不在任何人会跑的那条命令里。**
（对比：`frontend-architecture` 是串入的那 10 道之一，所以它的红是可发现的。）

**因此防复发的第一优先级不是新建门，而是把已建成的防线接上电。**
这也符合本仓自己的标尺：新增门要过「反复发生、纯机械、维护成本小于返工」三问，
而**接线的成本几乎为零、收益是 28 道现成的门**。

**同时必须配套执行既有退役判据** `CONTROL_RETIREMENT_AFTER_FIVE_PACKAGES`：
接线后若某门连续五个 package 从未变红，按既有规则显式处置，避免 verify 变慢变钝。

## 4.5.1 逐问题类的防复发落点

下表对每一类问题给出**手段类型**与**落点**，并逐条过三问。
**故意留了"不建门"的结论** —— 不是所有问题都该机械化。

| 问题类 | 根因 | 防复发手段 | 具体落点 | 三问结论 |
| --- | --- | --- | --- | --- |
| **契约演进后下游不跟随**（154/144/147、已删 `projectId` 仍在发） | 分母校验只在诊断**运行时**触发，不在门里 | **机器门（强）** | `http-diagnostic-scenarios.mjs` 的 exact-set 校验**抽成独立 check 并串入 verify**；runner request body 由 generated 类型约束 | ✅ 反复发生 ✅ 纯机械（集合相等）✅ 成本极低 —— **最该建的一道** |
| **可观测性缺口** | 没有"每个业务 operation 必须可追踪"的规范 | **项目记忆 + 扩展既有门** | 新增 `decisions/observability-contract.md`；`logging-boundaries` 扩展为"completion observer 必须无条件注册"并**串入 verify** | ✅✅✅ —— 但**门只能验"注册了"，不能验"日志有用"**，后者归 review |
| **同名不同义 / 封闭集合分裂** | 没有"封闭集合唯一声明"的规范；且同名值分属 5 个集合 | **项目记忆（现在）+ 分集合门（B3-0 之后）** | 新增 `decisions/closed-set-single-source.md`；门必须**按集合分别建**，且在归类表存在后才可能 | ⚠ 现在**不纯机械**（需语义归类）→ 先记忆、后建门 |
| **UI 意图与 owner 谓词无契约**（AND 搜索） | 前端把"一个搜索框"自行翻译成"两个筛选字段" | **设计规范 + review checklist** | 写入 `http-crud-efficiency-design-redlines.md`：筛选/搜索语义必须由 owner/contract 定义，前端不得自行组合谓词 | ❌ 不纯机械（"同值写入两字段"可机械检测但误报高）→ **不建门** |
| **foundation 已有能力却在 App 内重造**（Drawer submitting） | 没有"有 primitive 就必须用"的检查 | **扩展既有门** | `frontend-architecture` 增加一条：Drawer 组件不得自行维护 `submitting` 状态 —— **复用已验证可红的 `destroyOnHidden` 控制形状** | ✅✅✅ —— 形状已被证明可红，成本低 |
| **受管运行边界自证**（host binding 自哈希、cleanup 只验组长） | 没有"绑定必须来自独立来源"的原则 | **项目记忆 + runner self-test** | 新增 `pitfalls/self-attested-binding.md`；cleanup 改为"整棵拥有的进程树为空" | ⚠ 目前只发生一次 → **暂不建门**，先记忆 + self-test |
| **依赖故障被降级成业务结果**（MinIO `exists()`、pageSize→`AccountNotFound`） | 没有"依赖不可用 ≠ 资源不存在"的 typed outcome 规范 | **设计规范 + review checklist** | 写入 `decisions/typed-failure-taxonomy.md`：依赖不可用、无权限、不存在必须是不同 typed outcome | ❌ 不纯机械 → **不建门** |
| **门存在但没接线** | `scripts/verify` 与 `scripts/check/` 长期脱节 | **机器门（自指）** | 新增一条极小的 check：`scripts/check/` 下每道门要么在 verify 中、要么在一份显式豁免清单里 | ✅✅✅ —— 一行机械事实，**防止这个问题本身复发** |

## 4.5.2 建议新增的 project-memory 条目（3 条，不多建）

**只建 3 条**，且都指向"未来设计时必须回答的问题"，不是流程负担：

1. **`decisions/observability-contract.md`**
   `assertions: ["EVERY_OPERATION_TRACEABLE", "SENSITIVE_NEVER_PERSISTED"]`
   —— 新增任何 HTTP operation / owner 命令时，必须回答：它的完成与失败在生产环境
   如何被追踪？哪些字段绝不落盘？

2. **`decisions/closed-set-single-source.md`**
   `assertions: ["CLOSED_SET_SINGLE_DECLARATION", "SAME_NAME_IS_NOT_SAME_MEANING"]`
   —— 引入任何封闭取值集合前，必须回答：规范源在哪？谁生成？
   **是否与既有集合同名不同义**（本次已确认至少 5 个集合共享 `HEAD_COMPANY` 等值）。

3. **`decisions/typed-failure-taxonomy.md`**
   `assertions: ["DEPENDENCY_FAILURE_IS_NOT_ABSENCE", "VALIDATION_IS_NOT_NOT_FOUND"]`
   —— 定义 typed outcome 时，必须回答：依赖不可用、无权限、参数非法、资源不存在
   是否各自有**不同**的 typed 结果。

**为什么只有 3 条**：本次发现的其余问题（重复 helper、超长单行、`findFirst`、
`pageSize` 上限）都属"接触即改"的工程卫生，写进记忆只会增加每次任务的必读量，
**不产生防复发收益**。这与我在 P2-3.6 的立场一致 —— 不因为发现了问题就必然要加规则。

## 4.5.3 明确"不建议建门"的清单（防止过度治理）

- **裸字面量门**：在 B3-0 归类表产出**之前**不得建 —— 现在建必然把 5 个集合当 1 个。
- **"搜索语义"门**：可机械检测"同值写入多个 query 字段"，但**误报率高**，归 review checklist。
- **"每个 catch 必须记日志"门**：会与刻意的防递归 fallback 冲突
  （本次 Codex 已举出 `Slf4jSecurityDiagnosticRecorder` 这个正当反例）。
- **代码行长度门**：纯风格，不防任何缺陷。

## 4.5.3b 门体系本身需要调整的地方（我把 38 道门全跑了一遍）

**接线之前必须先修门本身** —— 否则 B0 会把一批坏门接进 verify。

### (1) 当前实际为红的门：11 道

| 门 | 报错 | 性质 |
| --- | --- | --- |
| `contract-face` / `production-conformity` | `R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID` | **契约演进的第四个受害者**，见下 (2) |
| `module-dependency-registry` | `SOURCE_TASK_READ_UNDECLARED` | **真实 owner 边界漂移**，见下 (3) |
| `logging-boundaries` | `R4_LOGGING_FREE_CONSOLE` | 已知（M3） |
| `frontend-architecture` | `R5_CRUD_PRESENTATION_FILTER_COLUMN_COVERAGE` | 已知（M9） |
| `database-operation-budget` / `query-boundaries` | 均为 `R4_DATABASE_SELECT_STAR` | **两道门查同一条规则**，见下 (4) |
| `code-layout` | `EMPTY_SOURCE_DIRECTORY:…/publicentry/passwordreset` | 空目录，真实但小 |
| `flyway-test-locations` | `R5_FLYWAY_TEST_LOCATION_DENOMINATOR_DRIFT` | 分母漂移 |
| `authority-source-ledger` | `P1_LEDGER_ROW_INVALID:ST-11` | 已知继承债务 |
| `roadmap-control-plane-transfer` | `HERITAGE_HASH_MISMATCH` | 需单独判定 |
| `gate-0` | `R3_PRODUCTION_APP_SOURCE_NOT_EMPTY` | **不是坏门** —— 是同一 validator 的 pre-implementation 模式，见下 (5) |

> **注**：下表的 11 道"红门"里，`gate-0` 属于**用错模式**（按设计实施后必红），
> `production-conformity` 的红**由 `contract-face` 引起**（同一根因），
> `query-boundaries` 与 `database-operation-budget` 是**同一条命令**。
> 因此**独立的真实红只有 7 类**，不是 11 道。

### (2) 契约演进的第四个受害者（应并入 B2）

我实测当前四个分母：

```
root OpenAPI 展开        154  ✓
generated route registry 154  ✓
U01 placement report     154  ✓
U01 implementation catalog 121 ✗   （faces 50/59/12）
```

**契约从 147 演进到 154 时，root、registry、U01 report 都跟上了，唯独 U01 catalog 停在 121。**
这与 `§1.2`（M1 场景表 144、测试断言 147、runner 发已删字段）**是同一根因的第四、第五个实例**。
**建议并入 B2 一起收口**，并把"分母一致性"做成一道能覆盖全部五个消费者的门。

### (3) 真实的 owner 边界漂移（新发现，两份报告都没有）

`module-dependency-registry` 报：

```
SOURCE_TASK_READ_UNDECLARED:
  organization/…/OrganizationAuditHistoryService.java : platform_workspace.group_workspace
```

我打开源码确认属实 —— `OrganizationAuditHistoryService.java:38` 有一条真实的跨 schema JOIN：

```sql
SELECT commercial_group.group_workspace_id FROM organization.commercial_group commercial_group
JOIN platform_workspace.group_workspace workspace ON workspace.id=commercial_group.group_workspace_id …
```

kernel 的 `TASK_READ_JOIN` 允许显式任务型跨 schema 读，**但必须在 registry 里声明**；这一条没有。
**这道门是对的，红得也对** —— 它只是从没被人看见（不在 verify 里）。
**处置**：要么在 registry 声明该 task read 边，要么改为走 owner 公开 API。

### (4) 真正的重复：两个名字，同一条命令

```bash
scripts/check/query-boundaries          → exec node tools/verify-gates/cli.mjs budget "$@"
scripts/check/database-operation-budget → exec node tools/verify-gates/cli.mjs budget "$@"
```

**不是"覆盖同一规则"，是同一条命令的两个别名**（除路径写法外逐字相同）。
接线时保留一个即可。

### (5) `gate-0` / `production-conformity` 的关系（我上一版说错了，已更正）

> **对抗复核更正**：我原写"`gate-0` 是陈旧门应退役"、"`production-conformity` 疑似只是委托
> `contract-face`"。**读了实现后两条都不准确。**

实际是**同一个 validator 的两种模式**：

```js
"gate-0":     validateProductionConformity            // 无 --post-gate-0
production:   validateProductionConformity(root,true) // scripts/check/production-conformity 传 --post-gate-0
```

- `gate-0` 走 **pre-gate-0 分支**（要求生产源码为空）——
  它**按设计**只在实施开始前为绿。现在红是**用错了模式**，不是门坏了。
  正确处置：**标注为已关闭阶段的准入模式、不接入 verify**，而不是"退役一个坏门"。
- `production-conformity` 是**超集不是重复**：它先 `assertInventory`、
  检查 backend 非空，**再**调用 `validateContractFace` 与 `validateFlywayLayout`。
  它的红是**由内部的 contract-face 红引起的** —— 修好 contract-face 两者同时转绿。

### (6) 需要参数的门（约 7 道），接线前必须定调用形式

```
claude-review-handoff   codex-self-review        foundation-standard-actions
implementation-design-granularity                provider-free-context
remediation-compliance  baseline-closure
```

bare 运行返回 exit=2 / usage。**B0 必须给每道门一个默认调用形式，或列入显式豁免** ——
不能假装它们"跑过了"。

### (7) `scripts/check/` 里混着"门"和"报告工具"（我上一版判断错误）

> **对抗复核更正**：我原写"`canonical-performance-ledger` exit=0 但无任何输出"。**这是错的。**

它**不是无输出，而是输出了 262KB 的 JSON 扫描报告**
（`kind: "canonical-performance-candidate-scan"`，含 roots 与逐行 rows）。
我上一版之所以看成"零输出"，是因为我的探针只 grep `=PASS|=FAIL`，
而**它根本不是 PASS/FAIL 门，是报告工具**。

**真正的结论**：`scripts/check/` 目录混放了**门**与**报告工具**。
这直接影响 B0 —— **"把 38 个都接进 verify"是错的**，
接线前必须先把目录分类为「门 / 报告工具 / 需参数的门 / 已关闭阶段模式」。

### (8) 一处我无法复现的测量差异（不作为门的缺陷主张）

我在 `10:57` 实测 `contract-face` 为 `R5_CONTRACT=PASS`，
`12:47` 连跑三次均稳定 FAIL，而依赖文件 mtime 都停在 `08-04`。

我做了两项排查并**排除了污染假说**：
`writeScratchFile` 写入的是 `mkdtempSync(os.tmpdir(),…)` 临时目录，**不触碰仓库**；
且当前失败有清晰算术解释（catalog 121 vs report/registry 154）。

**因此我不主张"该门非确定性"** —— 现有证据同样支持"**我 10:57 的那次测量不可靠**"。
如实记录该差异，建议接线前顺手验证一次同输入同输出即可，**不作为 finding**。

## 4.5.4 节奏建议（最小）

不建议新增周期性流程。**建议只加一条**：
每个 **R 收口时**跑一次**全部 38 道门**（而不只是 verify 的 10 道），
并做一次跨 App 重复符号扫描。这两件事本次都是**手工**做的，
成本是分钟级，但正是它们暴露了 `logging-boundaries` 长期红和 14 个同名 helper。

---

# 5. 对抗性复核留痕

本终稿在成文过程中经历三轮自我证伪，记录如下：

**第 1 轮 —— 对 Codex 全部 9 条 M 逐条独立证伪。**
方法：不读 Codex 的推理，只按其引用的 file:line 重开源码自行判断。
结果：8 条确认、1 条（M5）需更精确表述、0 条证伪。
`§0.2` 是该轮产物。

**第 2 轮 —— 对我自己初稿的证伪。**
发现四处问题并全部写入 `§0.3`：门快照过期且未声明、
前端日志表述不准确、"门失败 exit 0"的猜测不成立（主动撤回）、
三条用户可见缺陷全部漏检。

**第 3 轮 —— 对合并结论的证伪。**
- 检验"M1 与 M6 是同一根因"是否成立：确认——两者都是契约 147→154 演进后下游未跟随，
  且 `edge-codegen --check` 结构上管不到 scenario 表/测试常量/runner body。**保留该合并判断。**
- 检验"P1-2.1 Drawer 是 P1-2.4 抽象缺口的实例"是否成立：确认——
  局部 `submitting` 不喂 lifecycle，正是"机制已在 foundation、App 却自己再实现一遍"的同一模式。
- 检验我是否因 Dexter 的裁定而**过度扩大**方案：
  P0-1.4 的"补一条裸字面量门"是我新增的，**它需要真实红变异证明才成立**，
  已在正文标注该前置条件，不作为无条件建议。

---

**第 4 轮 —— Codex 对合并终稿的反向对抗（2026-08-05，本轮质量最高）。**

Codex 逐条反驳了我 8 条 finding。我对其中 6 条做了独立复核（不读它的推理，只按 file:line 重开源码），
**6 条全部成立，0 条被我推翻**。已据此修订正文：

| 我的 finding | Codex 反驳 | 我的复核结论 | 处置 |
| --- | --- | --- | --- |
| P0-1.4「4 份等价声明」 | `OrganizationNodeType` 无生产引用；`REGION/PROJECT` 是业务约束不是子集 | **成立** —— 全仓零引用；两者是不同概念 | 改为「2 活 + 1 死 + 1 业务约束」，**并请 Dexter 重新裁定**（见 `§6.1`） |
| P1-2.4「statusLabel 两份实现」 | 同名不等于同义 | **成立，且暴露我的方法缺陷** —— 一个是状态显示映射，一个是按钮动作文案 | 降 P2，大幅收窄；只保留 `hierarchyNameCollator` 等字节级相同项 |
| P1-2.5「pageSize 6 处」 | 不止 6 处，且 typed error 各异 | **成立** —— 实测 **14 处**、至少 4 种错误类型 | 改用「共享上限常量 + 保留 owner 错误语义」 |
| P2-3.4「吞诊断异常」 | recorder 内部已写 WARN，外层是防递归 | **成立** | **撤回该半条**；MinIO 半条升 P1 |
| P2-3.3「findFirst」 | DB 有唯一约束、catalog 有 codegen 断言 | **成立** —— 实测 `uq_group_workspace_key` | 收窄到「无 codegen 断言且无 DB 约束」的少数 lookup |
| P2-3.6「治理工具体量」 | 行数占比不是过度设计证据 | **成立**（我终稿其实已写"不重开该结论"，此处口径一致） | 措辞已对齐 |

**两条不构成真分歧**：Codex 对 P0-1 的反驳（"不应只塞进 ControllerAdvice，覆盖不了读请求与全部完成路径"）
针对的是我的**初稿**；本终稿在 Dexter 裁定后已改为**以 generated route registry 为分母的全路由 completion observer**，
与 Codex 的建议一致。

**本轮副产物（两份报告原本都没有）**：`WorkspaceUserService.java:363`
把分页违规抛成 `AccountNotFoundException`（见 `§2.5`）。

**第 5 轮 —— Codex 对修订稿的再对抗（2026-08-05）。**

Codex 认可修订稿的"问题事实"大部分可采纳，但指出**修复批次划分**尚不能进入设计，提 5 点 + 1 项定级。
我逐条复核，**5 点全部成立，0 点被推翻**：

| Codex 反驳 | 我的复核 | 处置 |
| --- | --- | --- |
| §3.7 说 checker 失效不成立；矩阵 phase 是 `R2` 且 `--phase R2` PASS | **成立** —— 实测矩阵 `currentPhase="R2"`、`--phase R2`/`R5` 均 PASS；且 `CLAUDE.md` 原文指令就写 `<R2..R6>`，传 `RM1-P6-3` 是**错误输入** | 撤回"checker 失效"表述，降为记账项 |
| B1 自相矛盾：仍写"两处吞异常"，而正文已撤回一半，MinIO 又在 B4 | **成立**，是我编辑时留下的内部不一致 | B1 只留可观测性 + `System.out` |
| B2 不应"从 registry 派生场景事实" | **成立且最重要** —— 该文件注释明令 *"no operation name, method or route is used to invent a scenario"*；每条 fact 带 `businessTask`/≥2 `sourceRefs`/`ownerReadback`，**registry 无从派生** | 改为"registry 只提供强制分母，每 operation 必须有手写 fact 或有证据的 disposition" |
| B3 的"edge enum 从 Java 类型派生"无可执行路径 | **成立** —— codegen 是 Node 从契约生成 Java，方向反了 | 改为"先定中立规范源，由它同时生成两侧" |
| B4 把 MinIO 与品牌授权 UI 捆绑，无共同 owner/契约/验收面 | **成立** | 拆成 B4a / B4b |
| `WorkspaceUserService` 分页异常应列 P2 | **成立** —— 改异常类型会动 problem mapping 与状态码，需先确认调用方安全语义 | 已降 P2 |

---

# 6. 两份报告的分歧与裁定记录

## 6.1 重裁结果：Dexter 选 (a) 全量收敛（2026-08-05 已裁定）

**裁定：(a) 全量收敛 316 处。**

我当时的建议是 (b)（只替换高风险处），依据是我复核出的真实风险规模：
全仓按节点类型分支共 10 处，其中 **6 处 `default -> throw` 本就 fail-closed、
3 处是无害的 SQL 字段默认、只有 1 处真正静默**。
**Dexter 在知悉该数据后仍选择 (a)**，理由与他此前的标尺一致
（「现在才 5% 功能，现在不把基础打好后面更难走，根治必须彻底」）。
**该决定已生效，本稿按 (a) 编写执行计划。**

**但执行形状与"替换 316 个字符串"不同** —— 我在准备计划时查出这 316 处
**分属 5 个语义不同的封闭集合**，全局替换会造成不可逆的语义合并。
详见 `§1.4` 的「(a) 全量收敛的真实执行形状」六步，
其中**第 1 步（逐处归类）是人工语义判断，且建议单独接受一次独立复核后再进入第 2 步**。

---

## 6.2 历史记录：该重裁请求的原始内容

**「全量收敛 4 份声明 + 316 处」这个裁定，是基于我一个有瑕疵的前提做出的。**

我当时给你的证据是"同一封闭集合被声明 4 次"。经 Codex 反驳与我的复核，
修正后的事实是：**2 份真重复（generated enum + `WorkspaceRoleService` 手写 Set）、
1 份死代码（`OrganizationNodeType`，零引用，应直接删）、
1 份不是重复而是组织树的业务约束（`REGION/PROJECT`）**。

这不改变"316 处裸字面量缺乏单一真相"的核心问题，但**改变了工作量与风险画像**：
需要先做「服务节点类型 vs 组织树节点类型」的类型建模，才能谈替换范围。

**请你在两个选项间重新裁定**：
- **(a) 维持全量收敛** —— 先建两个类型模型，再全量替换 316 处；
- **(b) 分两步** —— 先删死代码 + 建类型模型 + 只替换**授权/可见性分支**（漏改会静默走错分支的高风险处），
  其余裸字面量留待接触即改。

在你裁定前，`§4` 的批次表把 B3 标为**待定**。

| 分歧 | Claude | Codex | 裁定 |
| --- | --- | --- | --- |
| 673 处枚举字面量 | P0，建议下沉 | 不认为是问题 | **Dexter：全量收敛**（比 Claude 原建议更彻底） |
| 严重度口径 | P0–P3，不设门禁 | NO-GO + 9 M | **Dexter：统一 P0–P3，不设门禁** |
| 日志方案规模 | 最小方案（一处 ControllerAdvice） | 完整 request-completed + 前端 sink | **Dexter：根治彻底** —— Claude 的最小方案被否，本稿按 Codex 方向重写并补齐脱敏红线 |
| M5 表述 | —— | "只轮询 leader PID" | Claude 更精确化：信号发给进程组且强制组长身份，**缺口在证明侧**，`--no-daemon` 限制暴露面 |

---

**授权边界**：本终稿是评审与修复设计输入。
不授权任何实现、契约/schema 改动、generated artifact 手改、DEV/seed/reset、
动态运行、business/cleanup PASS 或 Roadmap 状态变更。
每个批次仍须单独授权、冻结详设并接受独立 review。
