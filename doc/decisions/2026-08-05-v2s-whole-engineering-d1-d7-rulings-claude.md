---
title: 全工程修复程序 D1–D7 裁决与后续两批范围
status: active
decisionOwner: Dexter（2026-08-05 明确委托 Claude 代裁）
authoredBy: Claude
programId: V2S_W0_W4_EXECUTION
goalId: WHOLE_ENGINEERING_REMEDIATION_20260805
sourcePlan: doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md
implementationAuthority: false
runtimeAuthority: false
createdAt: 2026-08-05
---

# D1–D7 裁决与后续两批范围

## 0. 授权来源与边界

Dexter 于 2026-08-05 明确委托 Claude 代其裁决 D1–D7（原话：「你替我裁决吧，我相信你」）。
本文件是该委托下的裁决记录。

**本文件不产生 implementation authority。** 每个受影响单元仍须按既有流程取得自身范围授权、
implementation-facing 详设、独立对抗审查与证据闭环。裁决只解除"因决策未定而无法开工"的阻塞，
不替代任何一项评审。

裁决依据是当前字节与既有 kernel/red line；凡涉及产品语义处已在条目内注明其边界。

---

## D1 ｜常驻可观测性架构

**状态：追认 S2 既成事实 + 明确登记三项推迟。**

S2 在 D1 未裁的情况下已完成实施，其实际选择为：

- **sink**：复用既有 `Slf4jSecurityDiagnosticRecorder`，以 SLF4J `INFO` 输出结构化 key-value；
- **常开性**：`EdgeWebConfiguration:45` 无条件注册 `RequestCompletionDiagnosticInterceptor`，
  `@Bean` 无任何 `@ConditionalOn*` —— 与 default-off 的诊断型 `HttpRequestMetricsInterceptor` 不同；
- **脱敏**：`RequestCompletionEvent` 用**字段白名单**承载（仅低基数元数据），
  结构上无法容纳 payload/token；
- **edge 接收面**：**不新增**。前端 sink 指向外部 collector URL（`VITE_FRONTEND_LOG_SINK_URL`），
  仓内未新增日志摄取 controller。

**裁定：以上四项予以追认。** 这是 D1 未裁下最保守且正确的形态，
未擅自建新基建，也未把常驻通道做成 default-off。

**明确推迟、不在本程序内建设**（登记到 `HANDOFF.md`）：

- 日志**保留期**
- 日志**访问主体**与权限
- **成本控制与采样策略**

理由：三者都依赖真实部署形态，当前单机开发期无法给出有意义的取值；
现在建设会违反"治理/基建按分钟级过滤"的标尺。
但必须显式记录为**已知推迟**，不得被后续会话读成"已解决"。

---

## D2 ｜remote host 信任源

**裁定：采用仓内受控 allowlist，不引入外部安全配置。**

**问题**：`scripts/dev/r5-dev-environment.mjs:31` 在 hash 缺失时由**同一 host 串现算**
`sha256(host)`，而 `:41` 的校验只验 `sha256(host) === hostHash` —— **重言式，恒真**。
唯一实质防线是 `productionLike()` 的 `prod|production` 正则，任何不含该字样的错误别名都能通过。

**做法**：仓内维护一份受控的 non-production host allowlist，
每条记录含 host、fingerprint、维护人、轮换时间；runner **只比对并记录 readback，不得现算**。
轮换走正常评审流程。

**理由**：引入外部安全配置会在单机开发期增加运维依赖，与当前阶段不匹配；
仓内受控清单已足以消除"自证"这一根本缺陷。

**红证据要求**：攻击者同时提供 host 与其 hash 必须失败；
合法轮换、未知 host、错误 fingerprint 三种情形各需一条证明。

**解除阻塞**：RP-10。

---

## D3 ｜五个语义集合各自的规范源

**裁定：分两类。**

**(a) 服务节点类型**（`GROUP/REGION/PROJECT/HEAD_COMPANY/STORE`）
→ 规范源为 **OpenAPI component**，由 `edge-codegen` 从**同一个 component** 同时生成
owner 侧类型与 edge 侧 enum。
依据：`ServiceNodeType.java` 头部已声明 "Generated from accepted R5 OpenAPI components"，
规范源事实上已经存在；且该集合是**唯一**跨 edge 与 owner 双向使用的集合。

**(b) 组织树 / 审计 entityType / 业务实体 / 扩展宿主**
→ 规范源为**各自 owner 模块内的常量声明**，**不上 OpenAPI**。
依据：这四个是 owner 内部封闭集合；把它们塞进 OpenAPI 会将内部语义升格为对外契约，
是过度设计，且会让 owner 无法独立演进自己的取值域。

**共同约束**：
- 必须保留"同名不同义"边界 —— `HEAD_COMPANY` 等值同时属于多个集合，**禁止全局替换**；
- 不建立"万能 NodeType"；
- 每个集合各自的迁移必须有自己的 red mutation。

**解除阻塞**：RP-12a..n。

---

## D5 ｜非法 `pageSize` 的错误语义

**裁定：改为参数校验错误；账号可见性的 concealment 保持不变。**

**问题**：`WorkspaceUserService.java:363` 将 `pageSize > 100` 抛为
`WorkspaceAccountService.AccountNotFoundException` ——
客户端传 `pageSize=200` 会收到"账号不存在"。

**理由**：404 concealment 的正当用途是**隐藏资源存在性**。
分页参数越界与资源是否存在**无关**，用 404 掩盖它不增加任何安全性，
只让客户端得到误导性信息、并使真实的 not-found 无法与参数错误区分。

**边界**：本裁决**只**改分页违规的错误类型；
该方法中与账号可见性相关的 concealment 语义**不动**。
实施前须逐个确认调用方是否有依赖该 404 的安全语义（若有，单独提出）。

**解除阻塞**：RP-16。

---

## D6 ｜不可达的 OpenAPI error code

**裁定：先证实、再删除；不预设方向。**

针对 `edge-operation-projections.mjs:66` 投影到 add/remove 的
`...AUTHORIZATION_REQUIRED`：

1. **先证实** owner 是否确实永不产生该失败（重开 owner service、problem advice、调用方）；
2. **若证实不可达** → **删除契约声明**。
   理由：保留一个永不出现的错误码会让消费者为不可能的分支写处理逻辑，是负资产；
3. **若证实可达** → 补齐 owner 行为、HTTP mapping 与端到端 proof，**不删**。

**禁止**：只删 UI 分支而保留错误契约声明（那会让契约继续说谎）。

**解除阻塞**：RP-15。

---

## D7 ｜跨 schema audit read

**裁定：在 module-dependency-registry 中显式声明 task-read，不改走 owner API。**

**问题**：`OrganizationAuditHistoryService.java:38` 有一条真实的跨 schema JOIN
（`organization.commercial_group` JOIN `platform_workspace.group_workspace`），
未在 registry 中声明，`module-dependency-registry` 因此报 `SOURCE_TASK_READ_UNDECLARED`。

**理由**：kernel 的 `TASK_READ_JOIN` **本就允许**显式任务型跨 schema 读，缺的只是声明。
改走 owner 公开 API 会为一次审计读引入跨模块调用与额外事务边界，代价不匹配收益。

**约束**：声明必须写明该 task read 的用途与边界，**不得**在 gate 接线时顺手加以求变绿。

**解除阻塞**：RP-19a。

---

## 1. 后续两批的范围与节奏

Dexter 要求"S2 之后两次实现、两次 review 完成全部剩余优化"。按证据类型切分如下。

### 第一包 · 静态语义收口

`business` / `cleanup` = `NOT_APPLICABLE_WITH_REASON`。

**范围**：RP-09（MinIO 故障分流）、RP-12-pre、RP-12a..n（五集合）、
RP-13～RP-18、RP-19a/b/c/d、RP-20，
外加 **S2 的 S-01**（给 `SecurityDiagnosticEvent` 补 DB metrics 或显式登记盲区）。

**前置**：RP-12 的归类表（`文件:行 → 所属集合`）先产出，**并单独接受一次独立复核**，
再进入任何替换。归类错误编译器不报，只能靠人比对。

**内部检查点**（一次 exit、一次最终 review，但按集合分检查点）：
组织树 → 服务节点 → 扩展宿主 → 业务实体 → 审计 entityType。
顺序依据是文件重叠度由低到高：44 个含集合字面量的生产文件中有 15 个同时含 ≥2 个集合，
其中 4 个同时含 3 个集合，最后做审计 entityType 时剩余归属最清楚。

**服务节点集合内优先项**：`WorkspaceAuthenticationService.enterable(...)` 的静默
`default -> false` 改为 fail-closed。它是全仓唯一真正静默的节点类型分支
（其余 6 处 `switch` 均为 `default -> throw`，3 处为无害的 SQL 字段默认）。

### 第二包 · Journey + 受管运行

带 `business` / `cleanup` 双证据。

**范围**：RP-07（品牌 queryText）、RP-08（Drawer 提交期关闭）、
RP-10（host trust source）、RP-11（cleanup tree proof）。

**RP-07 归此包而非第一包的理由**：它会改契约与 generated wire，
而第一包的服务节点集合按 D3(a) 也会动 codegen。
**两次生成面改动不放同一个包**，否则出漂移无法归因。
RP-07/RP-08 同属品牌授权 Journey，focused test 可共用。

### 不放进这两包的

- **S1 遗留**：`contracts/` 当前仍有三个 modified 文件（mtime `17:13:27`），
  属 S1 package，须在其自身 exit 内收口，不并入后续两包；
- **D1 推迟的三项**（保留期/访问主体/采样）：登记 `HANDOFF.md`，不在本程序建设。

---

## 2. 本裁决不改变的既有边界

- 不授权任何实现、契约/schema 改动、generated artifact 手改、DEV/UAT、runtime、
  HTTP/L2、seed/reset、数据库/migration、Roadmap 状态变更或 Git 操作；
- 每个单元仍须独立对抗审查与 Claude 复核，**不得借用本裁决的状态**；
- 静态 PASS 不得被推导为环境或业务闭环 PASS。
