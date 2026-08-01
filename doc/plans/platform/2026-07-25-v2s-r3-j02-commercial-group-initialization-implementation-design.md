---
title: catering-v2s R3-J02 商业集团显式初始化 implementation-facing design
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
goalId: R3-J02-COMMERCIAL-GROUP-INITIALIZATION
implementationAuthority: false
recoveryStatus: PENDING_RECOVERY
---

# R3-J02 商业集团显式初始化 implementation-facing design

## 1. Scope and reset trigger

这是由 Dexter 于 2026-07-25 接受 `R3-J02` 触发的新 `DESIGN` cycle。它不重开旧 `R3-SPECIALIZED-DESIGN` 的两轮审查，也不把旧 `R3-J01` 查询设计改名为新 Journey。

用户任务是：已登录平台管理员在“集团空间管理”找到一个已启用且尚未初始化的集团空间，先理解当前空间，再明确地填写**独立的**集团编码、集团名称，初始化唯一商业集团并读回。它不是注册状态查询、空工作台、health 或 CRUD 展示任务。

### Explicit exclusions

- 不创建集团空间；不在创建空间时隐藏初始化；不创建商业集团之下任何节点、账号、角色、门店或总公司。
- 不实现解绑、替换、重建商业集团；这些仍是 `待裁决`。
- 不增加运营后台组织页、跨 app 共享页面/路由/store/session，也不以 `/me`/health 冒充页面。
- 不进入 Java/Spring/Node 版本下载、编译、应用、contract、migration、测试、DEV、seed/reset、数据库或动态运行。

## 2. Product path and UI contract

`platform-admin` 独占这一业务入口：全局“集团空间管理” Content Tab → 名称链接 → 右侧详情 Drawer → “初始化商业集团”动作；动作先关闭详情 Drawer，再打开初始化 Drawer。初始化 Drawer 只显示不可编辑的所属集团空间摘要；“集团编码”“集团名称”均为空白、必填且独立输入。

列表不提供“初始化”操作列，已初始化空间只展示读回的商业集团摘要，不再显示动作。未初始化是明确空态，不用 404、space 字段或前端局部状态伪造商业集团。正常 success、字段校验、disabled、already-initialized/concurrent、timeout、unknown 必须各自可区分；timeout 先查询 summary 再决定重试。

`operations-admin` 只有独立的登录、current-session、退出和无业务页 shell；它不消费初始化按钮、root query 或平台 cookie。

## 3. Contract denominator and face exposure

一个 OpenAPI 文档是单一 server operation truth，所有 operation 必须有 `x-consumer-faces`，但该字段不授权。

| face | operations | purpose |
| --- | ---: | --- |
| platform-admin | 6 | open session、current session、close session、集团空间管理列表、空间初始化摘要、初始化商业集团 |
| operations-admin | 3 | open session、current session、close session |
| **total** | **9** | 两个独立 app 的会话事实 + 一个已批准平台业务 Journey |

平台 read 操作只暴露管理任务所需的最小字段；初始化 browser request 为 `workspaceRef + groupCode + groupName + idempotencyKey`，不接受或派生 `groupWorkspaceKey/name` 作为 group 输入。`groupWorkspaceKey` 是服务器 readback/ExecutionContext 的隔离坐标，不是用户可编辑的集团字段。detail summary 返回 `initialized` 与可选 root 摘要，空根不是 error。operation 的精确 HTTP path、schema 名、Problem 格式、generator 版本留给获得 implementation authorization 后的 GATE_0 contract unit；本设计冻结的是领域、owner、错误及 denominator，不抢跑物化。

## 4. Owners, transaction, data evolution

R3 最小 owner topology 是四个 owner schema/module，而非旧 J01 的三模块计数：

| owner | fact / command | prohibited shortcut |
| --- | --- | --- |
| `platform-identity` | platform principal、platform session、platform action authorizer | 不借用 operations principal/session |
| `operations-identity` | operations principal、operations session | 不消费 platform cookie 或 root business page |
| `platform-workspace` | GroupWorkspace lifecycle/status，管理列表/summary 编排 | 不持久化 CommercialGroup，也不写 organization table |
| `organization` | CommercialGroup、`workspaceRef` unique、group code/name、idempotency/audit | 不反查或复制 GroupWorkspace state |

初始化由 `platform-workspace` application coordinator 在同一 `REQUIRED` transaction 中用其**自身** row lock/CAS 线性化 `ENABLED + workspaceRevision`，并构造不可由 browser 伪造的 typed `WorkspaceEligibilityGrant(workspaceRef, groupWorkspaceKey, workspaceRevision, ExecutionContext)` 后调用 `organization.api.initializeCommercialGroup`。同一 owner 的停用动作必须使用同一 row/revision guard，故它不能在 eligibility grant 已取得后穿透该命令。organization 不反查 workspace、不接收裸 boolean；只验证 service identity、grant provenance/shape、`PF-WORKSPACE-INITIALIZE` 的 trusted ExecutionContext，并复核自身 unique/idempotency/audit。platform-workspace 不跨 schema DML。

`organization.commercial_group` 保存 `(group_workspace_key, workspace_ref)`，并以引用方 migration 建立 immediate composite FK 指向 `platform_workspace.group_workspace(group_workspace_key, id)`；引用端同时以该 pair 唯一，保证同一集团空间至多一根且拒绝隔离坐标错配。无反向 command/FK。集团空间名称或编码变化不回写商业集团字段，反之亦然。

同一 idempotency key + 同一 intent 重放相同 readback，不追加 audit；同 key 不同 intent 为 `PLATFORM_IDEMPOTENCY_CONFLICT`；不同 key 已有 root 为 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`。后两类 UI 都必须 GET summary/readback，绝不压成第二次 success。GroupWorkspace 名称或编码变化不回写 CommercialGroup，反之亦然。

## 5. Authentication and browser boundary

两个 face 维持独立 shell、route registry、store、cookie/session policy、generated client slice 与 L2/L3。server 管理每个 face 的 canonical origin；filter order 固定为 edge routing → browser-forgery check → face session/authz → input/owner command。Fetch Metadata 在提供时校验；缺失时 strict Origin fallback。无 CORS allow header、无双 CSRF、无前端 allowlist/runtime face filter。session valid/expired/revoked/cross-face/network failure 的 current-session readback 必须可区分，且 server 最终拒绝越权 command。

## 6. Delivery units and serial order

### R3J02-U01 — gate and version freeze

先执行 GATE_0 readiness：冻结 approved source、contract/generator/Java/Gradle/frontend version decision、source manifest、exact target paths、absence scan 与 managed-command ownership；不编译、不下载、不启动。`scripts/check/code-layout` 已作为 D.1.L01–L04 的机械 production gate 接线，production 与五类真实 red fixture 已 PASS；其余 GATE_0 决策及所有业务 source 仍未授权。

### R3J02-U02 — independent identities and app boundaries

物化两个独立 authentication/session owner、canonical face routing 和**属于 `platform-identity` 的**平台 action authorizer；它产出 typed `ExecutionContext`/capability，U04 只能消费而不能重算或拥有授权事实。它先于任何 platform business action，但不建立通用角色/权限模型。operations unit 至此闭合，不得因“补齐”而长出业务页。

### R3J02-U03 — workspace and commercial-group owner facts

物化四 schema 的 additive Flyway baseline、单 history、workspace `ENABLED`/revision eligibility 和 CommercialGroup unique/idempotency/audit owner fact。每一 migration 仅以 GATE_0 冻结的 `V<UTC秒_毫秒>__<owner>_<change>.sql` 命名；不得预占 `V001`–`V004`。migration 顺序固定为 identity owners → platform-workspace → organization composite FK; `organization` command/invariant test 先于 cross-owner integration。

### R3J02-U04 — platform orchestration and nine-operation contract

物化 OpenAPI 9-operation denominator、platform management list/summary/query、initialize command 和 typed Problems；实现 command chain `edge → platform-workspace coordinator → organization.api → owner readback`。禁止内部 HTTP client、MQ/outbox、REQUIRES_NEW、cross-schema write 或 workspace/group 双事实。

### R3J02-U05 — platform-admin task UI

物化一个 app-owned GroupWorkspace 管理 Content Tab、详情 Drawer 与初始化 Drawer；应用状态由 RTK Query，form draft 由 ProForm，shell/context 不共享给 operations。L2 必须证明从真实入口到独立输入/readback和每种恢复，而非截图或元素存在。

### R3J02-U06 — evidence and closure separation

由 managed scripts 分别运行 unit L1、proxy-only L2、real chain L3、业务结果和 cleanup。失败先保留日志并诊断；cleanup 非 PASS 不能关 R3。GATE_0 之前不允许任何生产代码。

## 7. Evidence and discriminators

| level | required proof | discriminating red behavior |
| --- | --- | --- |
| L1 | owner uniqueness, independent fields, idempotency/audit, no cross-owner DML | attempt workspace-field copy or second root must fail |
| L2 | platform entry → Drawer sequence → blank independent fields → success/readback; all error/recovery states | a prefilled name/key, action on initialized root, or browser-only success must fail |
| L3 | managed proxy → single app → one DB/Flyway history → four owners, duplicate/concurrent and cross-face negatives | second initialize, cross-face cookie, extra schema history, invalid eligibility grant/revision or composite-FK isolation mismatch must fail |
| business | one initialized root exactly once and correctly read back; operations independently signs in without business-page claim | fake lookup/health/current-session cannot satisfy business result |
| cleanup | managed resource ledger is zero after run | cleanup failure separately blocks closure |

## 8. Open decisions and readiness boundary

No product decision remains to choose the J02 task. Implementation remains blocked by: Dexter’s separate R3/W1 authorization, Claude `GO(0 M / 0 S / N*)` and the remaining GATE_0 checkpoint/version decision. Exact package versions are a design-ready GATE_0 decision, not a license to run a version spike now.

## 9. Source hierarchy

Business meaning comes from the confirmed corpus G-01/G-02 and Dexter’s J02 selection. D01-S05 and commercial-group-root are Heritage for flow/owner/invariant cross-check only, not current-state or implementation authorization. The R3 authorization, deterministic context policy, verification governance and current Roadmap control scope and delivery discipline.
