---
title: catering-v2s R3 全范围 implementation-facing 详设与实施计划
status: READY_FOR_CLAUDE_REVIEW
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
roadmapRef: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
authorizationRef: doc/decisions/2026-07-24-v2s-r3-specialized-design-authorization.md
implementationAuthority: false
---

# R3 全范围 implementation-facing 详设与实施计划

R3 是一次性完整交付单元：本计划一次性覆盖 R3 全范围设计；实施完成后，R3-C01、R3-TECH、U01-U07、双 App、契约、数据库、测试与 evidence 必须作为一个整体一次性复核，不拆出 C-01 或其他子范围单独交付 review。

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

## 0. 结论、范围和不可越过的边界

本计划把 R3 的完整可开发范围收敛为一条业务 Journey 与其不可省略的技术底座：

```text
部署期外部受控的系统服务提供者访问
  -> platform-admin（独立 app）
  -> 集团空间列表 / 详情
  -> 独立录入商业集团编码和名称
  -> platform-workspace 协调 + organization owner command（同一 REQUIRED 事务）
  -> 唯一商业集团 owner readback

operations-admin（第二个独立 app）
  -> 只证明独立构建、路由、壳与代理入口
  -> 不产生、不登录、不验收任何运营用户
```

- **唯一业务 Journey**：`R3-C01`。它的四项前提均为 Dexter 已裁决的部署期外部受控事实；本计划绝不以默认账号、root、seed、C-01 内隐式创建空间或 operations 账户补齐它们。
- **R3-TECH 同批覆盖**：Gate 0、反向代理/边缘身份、一个 deployable、一个 PostgreSQL/一份 Flyway history、双 app、OpenAPI face/codegen、五命令、受管 walking skeleton、测试与 evidence。
- **本计划不恢复**：`R3-J01`、`R3-J02` 和 `R3-C02`。尤其不画、不实现、不声称 operations-admin 真实登录。
- **当前授权只允许详设、manifest、自审和 Claude review**；本文件及其 manifest 不是实现许可。不得现在创建 `apps/**`、契约、迁移、运行环境、seed/reset 或 Git 写入。

## 1. 方案合理性先行

### 1.1 业务用户的真实任务

系统服务提供者的目标不是“调用一个初始化接口”，而是在确认**目标集团空间**后，明确建立该空间唯一的商业集团，并立即看到自己独立录入的商业集团编码和名称。空间原本为空是长期合法状态；成功不应附带组织树、账号、角色、任职、门店或 operations 登录事实。

### 1.2 Dexter 的阶段和成本立场

R3 要证明一条真实、可启动、可撤收的最薄链，不批量迁移业务，也不把 all-v2 的七服务、内部 HTTP client、outbox/MQ、投影和前端追平重新带入。一次性完成 R3 详设是为了在进入开发前让 owner、事务、契约、UI、脚本和证据有同一个可 review 的分母；不是把单一 C-01 膨胀成后续组织/IAM/门店范围。

### 1.3 比较过的替代方案

| 方案 | 判断 |
| --- | --- |
| 只写 C-01 页面，再在编码时临时补代理、数据、契约和测试 | 拒绝。会重演“线框/页面看似存在、前提和读回不闭环”的问题。 |
| 复制 all-v2 的平台账号、workspace 创建、内部调用和 operations session | 拒绝。它既突破 C-01 的外部前提，也把已被 v2s 拒绝的分布式拓扑重新带入。 |
| 让 C-01 自带一个账号密码登录页和默认集团空间 | 拒绝。凭证语义、账号生命周期及空间创建均不是已批准 Journey。 |
| **外部受控身份在反向代理处完成，v2s 只验证可信边缘上下文；C-01 通过单体 owner command 完成** | **采用**。这正好匹配 Dexter 已裁决的前提，且把本仓必须负责的安全边界、真实页面、事务与证据留在 R3。 |

### 1.4 外部前提的实现化边界

`EXTERNAL_PLATFORM_ACCESS` 是 R3 的部署契约，而不是 C-01 的产品功能：部署入口先完成系统服务提供者认证，删除客户端伪造的 forwarded/correlation/auth 头，再向业务 app 注入可验签、短时、face 固定为 `PLATFORM_ADMIN` 的 `X-Edge-Auth`。app 只接受代理网络的该上下文并 fail-closed；它不保存凭证、不显示登录表单、不生成 root。

`EXTERNAL_EXISTING_GROUP_WORKSPACE` 由部署/受管测试 run 在 C-01 之前明确提供。生产业务路由、DEV start/restart、C-01 页面和 C-01 command 都不能创建该空间；受管测试的 manifest 必须记录它的提供者、groupWorkspaceKey 和清理 owner，不能把隐式 SQL fixture 写成“用户已创建空间”。若实施时无法取得这种外部前提，R3 动态 business evidence 维持 `NO_GO`，而不是加 seed 或默认数据。

## 2. 目标形态与所有权

### 2.1 运行拓扑

```text
browser
  -> standard reverse proxy / external access provider
       - platform-admin public route
       - operations-admin public route
       - strips then overwrites trusted headers
  -> one Spring Boot business deployable (private app port)
  -> one PostgreSQL database / public.flyway_schema_history
       platform_workspace schema
       organization schema
```

无自研 gateway deployable、内部 HTTP/OpenAPI client、MQ、outbox、polling、TDP、Redis 或第二数据库。operations-admin 是独立前端 app，但在 R3 不拥有 business endpoint、session 或用户数据。

### 2.2 模块、事实和事务

| module | schema / owning fact | 对外窄 API | R3 责任 |
| --- | --- | --- | --- |
| `platform-workspace` | `platform_workspace.group_workspace`；集团空间键、名称、存在性 | `platformworkspace.api.ExistingGroupWorkspace` judgment/ref；C-01 task query | 列表/详情、把外部既有空间转成可信 `GroupWorkspaceRef`、发起协调 |
| `organization` | `organization.commercial_group` 与同事务 audit | `organization.api.InitializeCommercialGroup` command；`CommercialGroupSummary` judgment | 商业集团唯一性、字段不借用、创建、审计、typed conflict/readback |
| `platform-access` | **无业务 schema/无账号事实** | trusted `PlatformExecutionContext` adapter | 验签边缘上下文并只允许 `PLATFORM_ADMIN` face；不实现产品登录 |

`platform-workspace` application coordinator 是零资产 coordinator：在一个 `REQUIRED` 事务内解析一次 trusted context，先在自身 owner 内取得 `GroupWorkspaceRef`，再调用 `organization.api.InitializeCommercialGroup`。organization command 只写自己的 schema、以唯一约束和条件写承担“每空间至多一个”，并返回 owner readback。它不能 import platform repository/domain 或跨 schema DML。`organization.commercial_group(group_workspace_key, group_workspace_id)` 由 organization migration 建立到 platform schema 的 immediate composite FK；该 `SCHEMA_FK` 与 `platform-workspace -> organization` 的 `COMMAND` 边分别登记、分别保持 DAG。

### 2.3 数据和不变量

`platform_workspace.group_workspace` 是 R3 需要读取的外部预先存在事实，最小字段为 `id`、`group_workspace_key`、`name`、`created_at`、`revision`；不在 R3 给它添加创建、启停、展示品牌、账号或组织树行为。

`organization.commercial_group` 最小字段为 `id`、复合 workspace reference、`commercial_group_code`、`commercial_group_name`、`revision=1`、`created_at`、`created_by_platform_subject`。规则为：

1. 每一 group workspace 最多一条，由具名唯一约束保护；冲突一律映射为 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`。
2. 编码和名称只接受去首尾空白后的非空值；采用 Heritage 已有的技术上限 `code<=64`、`name<=120` 作为 wire/DB 防护，**不**推导代码全局唯一、名称唯一、格式、展示品牌或状态机。
3. commercial group 创建后 C-01 只读回；解绑、替换、重建、编辑和删除均无 API、无页面入口、无 migration 预留。
4. 创建和 `COMMERCIAL_GROUP_INITIALIZED` audit 在同一事务；任一失败整体回滚。无 outbox、listener 或后补写。

## 3. 契约、边缘和生成面

### 3.1 Edge OpenAPI 分母

唯一 wire 真相是 `contracts/openapi/edge.openapi.yaml`；每个 operation 必有闭集 `x-consumer-faces`。R3 的业务面只有下列 platform-admin 三项，operations-admin 的 generated slice 明确为空：

| operationId | method/path | face | 结果 |
| --- | --- | --- | --- |
| `listPlatformGroupWorkspaces` | `GET /api/platform/group-workspaces` | `PLATFORM_ADMIN` | 有页码的候选列表：名称、`groupWorkspaceKey`、商业集团初始化摘要 |
| `getPlatformGroupWorkspaceDetail` | `GET /api/platform/group-workspaces/{groupWorkspaceKey}` | `PLATFORM_ADMIN` | 详情与商业集团摘要；无业务动作推断 |
| `initializeCommercialGroup` | `POST /api/platform/group-workspaces/{groupWorkspaceKey}/commercial-group` | `PLATFORM_ADMIN` | `201` 商业集团 owner readback |

初始化 request 为 `{commercialGroupCode, commercialGroupName}`；每次提交携带标准 `Idempotency-Key`。同 key、同一规范化请求可重放相同 owner readback；同 key、不同请求返回 typed idempotency conflict；重复初始化始终是 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`。`groupWorkspaceKey` 是 URL 中只定位集团空间的稳定技术拼写，绝不构成授权。详情/列表/初始化的 401、403、404、409、422 和 5xx 都走统一 typed Problem，客户端不渲染内部类型或 DB 文案。Problem `code` 是 OpenAPI components 的闭集枚举；codegen 在服务端与两个前端目标各生成 typed 常量，生产代码禁止手写错误码字符串。

新边缘不是 all-v2 `workspaceKey` contract 的兼容层：旧请求/旧 generated code/旧内部 commercial-group API 都不搬运。server route-face registry、platform-admin typed slice、operations-admin empty generated receipt 均由同一 OpenAPI 生成；不得有手写 allowlist 或跨 app wire import。

### 3.2 trusted edge context

反向代理必须覆盖写入 `X-Edge-Auth`、forwarded 与 correlation headers；app 直连、缺失/过期/签名错误/face 不符的 context 均在任何 controller 前拒绝。context 最小承载稳定外部 subject、expiry、`PLATFORM_ADMIN` face 与 correlation；它不是账号、角色、任职、页面准入或 operations access 的替代模型。浏览器同源访问，不配置 credentialed CORS；unsafe initialize request 走 exact Origin/fetch-metadata 防护。安全具体库/API 在 U02 的版本 spike 后按锁定版本实现，不凭旧 Spring API 猜测。

## 4. 前端与交互落地

platform-admin 严格以已接受 interaction artifact 的四屏为准：列表 → 未初始化详情 Drawer → 初始化 Drawer → 已初始化详情 Drawer。列表无直接初始化按钮；详情确认目标后才可发起；Drawer success 必须先收到 owner readback、关闭，再显示成功反馈；失败保留安全草稿，未知提交结果先重读详情而非盲重发。用户文案只用“集团空间”“商业集团”“商业集团编码/名称”，不显示 aggregate/owner/workspaceKey/internal error。

R3-C01 的三个 all-v2 对应页面是 carry-over-first 候选而非现在可复制的资产。U05 首先把 source path/hash 写进 heritage registry 并冻结副本；随后才可按清单 `ADAPT` 页面壳、列表/详情载体和 Drawer lifecycle。旧平台账号、空间创建/编辑/启停、operations entry、old endpoint/idempotency envelope 与旧业务文案都为 `NOT_CARRIED`。generated API 永远从本 R3 OpenAPI 重生。

operations-admin 只持有自身 `index.html`、Vite/route registry、theme、store 和“本阶段未开放运营业务”的 fail-visible boundary。该用户可见静态页已在 C-01 interaction artifact 的 `operations-r3-boundary` 附录线框中获 Dexter 接受；没有用户认证控件、current-session、menu/business page、generated business operation 或对 platform app 的 import。其独立存在以 build/artifact/proxy route/architecture test 证明，而不伪造真实运营用户登录。

## 5. 实施单元与严格顺序

### R3-U01 — Gate 0 与实施入口

**先决**：Dexter 已接受本总设计与 Claude verdict，并已给出 R3 implementation exact authorization。

**实施**：创建 `scripts/check/gate-0`、`r3-contract-face`、`r3-flyway-layout`、`r3-production-conformity` 的共用 production validator 和 self-test；D.1 既有 `code-layout` 同时纳入。Gate 0 在 `apps/**`、`contracts/openapi/**`、migration 仍为空时只验证门 wiring、真 red fixtures、空 business-source inventory 和目录布局。Gate 0 已 PASS，直接进入 U02；任何仓库控制动作均不构成设计、实现或验收前置条件。

**禁止伪修复**：在 Gate 0 前创建 contract/app/migration；只让 fixture 变红却不走 production validator；用工作区状态或时间点替代真实门输出；在 R4 再补写以追认。

### R3-U02 — 一个 deployable、外部访问契约和五命令骨架

**实施**：在 `apps/backend/` 建并列的 `catering-business-server`（当前唯一业务 deployable）与 `terminal-data-server`（未来 TDP 的空占位），在仓根 `libraries/backend/` 建 shared libraries 的 Java 21/Spring Boot 多项目 Gradle 结构，在 `infra/r3/` 建仅供受管入口使用的 proxy/compose templates，并在 `scripts/dev/{start,restart,stop,seed,reset}` 建五命令分权。start/restart 只 additive Flyway、绝不 seed；seed 是单独显式命令且不得成为 C-01/走查前提；reset 只按 manifest/allowlist 处理、二次确认、前后 readback，且不自动 seed。

**部署前提适配**：proxy template 要求外部 access provider 配置并验证 platform subject；R3 测试 runner 以明确的受控 provider/manifest 提供临时 subject 和既有 group workspace，不能在 browser/app 内制造。

### R3-U03 — OpenAPI、Problem、face registry 与生成 closure

**实施**：创建三项 platform operation 的 OpenAPI、commercial group/workspace/problem components、server route-face registry generator、platform-admin generated RTK Query slice 和 operations-admin empty-slice receipt。Problem `code` 必须是 OpenAPI components 的闭集枚举，codegen 在服务端和两个前端目标分别生成 typed 常量；生产代码不得手写错误码字符串。U03 后立刻运行 production conformity，断言 `OpenAPI face metadata ≡ server registry ≡ client generated closure`，拒绝遗漏/额外 operation、缺/未知 face、手写 route face、generated drift 和 app 间 import。

### R3-U04 — 后端 owner、单库 migration 与 C-01 原子命令

**实施**：按 `generated interface → web adapter → typed command → application transaction → framework-free domain → typed repository` 建 `platform-access`、`platform-workspace` 和 `organization`。创建全局 Flyway history、两个 owner schema/migrations、复合 FK、RLS/明确安全谓词、commercial group unique constraint 和 audit。列表/详情是 platform-workspace task query；初始化由 platform-workspace coordinator 调用 organization public command。所有写路径在同一 `REQUIRED` 事务，目标 owner 复查可信 context、workspace reference、唯一性和规范化输入；成功返回 organization owner readback。

**失败/恢复**：不存在/不可访问空间不暴露额外事实；重复初始化返回固定 typed conflict；唯一约束竞态不产生第二 group；任一 DB/audit/FK 失败全回滚；未知提交由 GET detail 重新读 owner 事实。不得以先查后写、跨 schema DML、REQUIRES_NEW、event/listener/outbox、默认 group 或自动组织树替代。

**DB 往返证据预算**：列表与详情各以 `databaseOperationCount` 在 integration/L2 断言 `≤3`；初始化写以同一计数断言 `≤5`。超出必须先在评审中说明原因，不能以拆分 surface 或删除审计/readback 规避预算。

### R3-U05 — platform-admin C-01 页面和受控 carry-over

**实施**：先登记/冻结三个 C-01 all-v2 source，再将已核验的静态壳按 manifest 适配到 `apps/frontend/platform-admin/`。实现 app-owned router/store/baseApi、C-01 list/detail/Drawer feature、typed locators、状态/错误/焦点/dirty guard/owner-readback feedback。列表/详情/初始化各自保持 interaction artifact 指定的 loading、empty、no-result、401/403/409、network 和 unknown-result恢复。

**错误文案闭集**：前端把生成的 Problem `code` 映射为业务文案时使用穷尽 `switch`，以 TypeScript `never` 作默认分支保底；契约新增错误码而前端未处理时，typecheck 必须失败。映射只输出批准的业务词，不回显 `workspaceKey`、aggregate、内部错误或“诊断”。

**不得继承**：group workspace create/edit/status、operations link、old platform authentication、old client codegen、all-v2 imports/build fallback 或“提交成功 toast 即成功”。

### R3-U06 — operations-admin 独立 app 边界

**实施**：创建独立 `apps/frontend/operations-admin/` 与独立 proxy route、store/router/theme/test config；只渲染 C-01 interaction artifact 附录 `operations-r3-boundary` 的 R3 boundary 页面并生成空 endpoint receipt。为两 app 写 architecture tests：禁止 shell/router/store/session/context/theme/page/business copy/generated 类型互相 import；platform 页面可用不代表 operations 登录可用。

### R3-U07 — 测试、受管 walking skeleton 与关闭证据

**实施**：在 R3 受影响分母内落下 unit/architecture、Testcontainers migration/integration、contract/codegen、platform L2 与 run-scoped walking skeleton。L2 从 externally provided platform subject 和 group workspace 开始，执行 list → detail → initialize → owner readback，并覆盖 duplicate conflict、字段独立、无下游对象、伪造/缺失 edge context、直连 app 拒绝、两 app import 隔离。列表与详情各以 `databaseOperationCount` 断言 `≤3`，初始化写断言 `≤5`，并同时进入 integration/L2。C-01 四屏 L2 正向断言只出现“集团空间 / 商业集团 / 编码 / 名称”；禁用 `workspaceKey`、aggregate、内部错误文案和“诊断”。dynamic runner 必经 proxy、输出 run manifest、business/cleanup 分账；cleanup 未 PASS 不得宣称 R3 完成。

## 6. 交付路径与 carry-over 清单

| 单元 | create/update/retain 路径（实施期） | Heritage/边界 |
| --- | --- | --- |
| U01 | `scripts/check/{gate-0,r3-contract-face,r3-flyway-layout,r3-production-conformity}`；`tools/r3-gates/**`；`doc/evidence/platform/r3-gate-0-*.json` | retain 既有 `code-layout`；无业务代码前先过 Gate 0 |
| U02 | `{settings.gradle.kts,build.gradle.kts}`；`apps/backend/{catering-business-server/**,terminal-data-server/**}`；`libraries/backend/platform-access/**`；`infra/r3/**`；`scripts/dev/{start,restart,stop,seed,reset}` | create；仓根 Gradle 多项目结构对齐 all-v2；business server is the only R3 deployable; TDP path is placeholder only; 不复制 all-v2 account/session services |
| U03 | `contracts/openapi/{edge.openapi.yaml,components/**}`；`scripts/generate/r3-edge-*`；`apps/frontend/*/src/app/api/generated/**` | generate，不搬运旧 wire；operations receipt is intentionally empty |
| U04 | `libraries/backend/{platform-workspace,organization}/{api,domain,application,adapter}/**`；`apps/backend/catering-business-server/src/main/resources/db/migration/V<utc-millis>__*.sql`；`contracts/policy/module-dependency-registry.json` | create；platform workspace source fact与organization command 分离 |
| U05 | `doc/heritage/{registry.json,required-inventory.json,frozen/catering-all-v2/**}`；`apps/frontend/platform-admin/**` | source hash recheck then `ADAPT` only: `WorkspaceManagementPage.tsx@0af9…63dc`、`WorkspaceDetailDrawer.tsx@f573…52a`、`CommercialGroupInitializationDrawer.tsx@3b40…c6c` |
| U06 | `apps/frontend/operations-admin/**`；`infra/r3/operations-admin-route.conf` | create independent boundary; no Heritage business feature carry |
| U07 | `apps/backend/**/src/test/**`；`apps/frontend/platform-admin/src/tests/{architecture,l2}/**`；`apps/frontend/operations-admin/src/tests/architecture/**`；`scripts/run/r3-walking-skeleton`；`doc/evidence/platform/r3-*.json` | no mock-only completion; all dynamic resources are run-scoped |

The abbreviated hashes in the table are explanatory only; the execution manifest records full path+SHA-256 before any carry. Placeholder versioned migration paths are resolved only after Gate 0 and are never pre-created in this design phase.

## 7. Evidence, red controls and completion definition

| layer | required proof |
| --- | --- |
| L1 | production validators, Gradle/TypeScript compilation, generated-byte check, static architecture/import checks; every new gate has a shared-core self-test and behavior-changing red mutation |
| L2 | Testcontainers clean migration; FK/unique/audit rollback; typed conflict; external-context/route-face rejection; platform UI real action and owner readback；列表/详情 `databaseOperationCount≤3`、初始化写 `≤5`；C-01 四屏正向/禁用文案断言 |
| L3 | two independent app builds/routing and no cross-app imports; no operations login claim |
| business | proxy-mediated platform access + external precondition → list/detail → independent data entry → exactly one commercial group readback; no automatic downstream object |
| cleanup | runner manifest records and removes containers/processes/temporary credentials/data; no active resources; business PASS and cleanup PASS separately |

R3 is ready to close only after the accepted plan is implemented under the current exact authorization, all five evidence layers are fresh and `WALKING_SKELETON_READY` criteria are met. This design/review itself cannot set that marker.

## 8. Explicitly deferred / not inferred

- platform credential UX, credential lifecycle, platform administrator governance and external IdP selection;
- group workspace creation, modification, status, deletion and provisioning UX;
- commercial group edit/unbind/replace/rebuild; organization tree and all downstream data;
- operations users, accounts, roles, employment, sessions and business pages;
- R4 full gate set and R5 business migration.

Each requires a separate approved Journey or Dexter decision. The R3 implementation may only consume the stated external access/workspace preconditions, never turn them into a silent product feature.
