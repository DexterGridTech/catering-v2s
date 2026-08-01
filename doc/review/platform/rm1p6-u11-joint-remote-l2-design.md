# U11 本机执行、远端中间件的 P6-2/P6-3 联合 L2 详设

## 1. 目的与边界

U11 只证明 P6 已接受的 22 个前端 business surface：P6-2 十个 surface 由九个既有 platform spec 覆盖，P6-3 十二个 surface 由十个 operations spec 覆盖。它不新增页面、菜单、route、测试专用 UI、数据库业务直写或 reset。
当前受管浏览器 L2 的执行面固定在本机：受管 tunnel、本机 Spring Boot、`platform-admin`、`operations-admin` 与 Playwright 均从本 checkout 启动；远端非生产环境只承载每 run 隔离的 PostgreSQL/对象存储 namespace。远端 Testcontainers 技术验证不等于浏览器 L2；UAT 才是全远端部署。

## 2. 本机生命周期、远端中间件与可观测性

1. 本机以配置的非生产 host hash 建立受管 tunnel；远端创建并回读唯一数据库/asset namespace。本机不复制 checkout 到远端，也不在远端启动 app、Vite 或 Playwright。
2. 本机启动 tunnel、business-server、platform-admin、operations-admin；每个记录 PID/PGID、boot id、start ticks、command hash、log path。远端只记录 namespace identity。
3. 本机依次验证 edge、platform URL、operations URL；固定 deadline，不延时重试。首次失败立即读取本机三份 app 日志与 tunnel 日志，记录 firstFailure、lastKnownGood、brokenBoundary。
4. fixture 只在 readiness PASS 后通过本机 edge 的 owner HTTP command 创建既有可达事实；所有原本依赖已退役 platform invitation HTTP 的 fixture invitation 均由短生命周期、`WebApplicationType.NONE` 的受管 owner bootstrap 创建。bootstrap 必须先 `requireEnabled` 重读空间、再调用 `WorkspaceInvitationService.create(...)` 的单一显式 `GROUP`/`REGION`/`PROJECT`/`HEAD_COMPANY`/`STORE` intent；无 Controller/OpenAPI/SQL，token 仅能进入 run-scoped `0600` 私密文件。
5. 本机 Playwright 按精确 19-file list 执行，两个 base URL 均为本机受管 URL；每个 app 的 spec batch 固定为单 worker。两边的 batch 都复用 fixture 创建的有限登录身份，并且 owner 对同一身份/来源的登录限流桶使用事务锁；L2 必须尊重该生产一致性边界，不能以并发超时、放松 owner 锁/限流或额外制造测试身份换取速度。缺失或空 spec 是 FAIL。
6. finally 先保存 terminal manifest/evidence digest，再按本机 PID/PGID identity 关闭 tunnel 与三个进程、确认无 live descendant；并从远端回读后移除唯一数据库/asset namespace。business 与 cleanup 分别判定；任一失败均非 PASS。

## 3. Owner fixture 与秘密边界

唯一允许的 SQL 是既有 frozen root bootstrap。其余事实依序为：root 登录→workspace/logo→commercial group→extension definition→role/action grants→受管 owner bootstrap invitation/匿名 OTP/credential completion→operations session→region/project→brand/tenant/head company/逐项 brand authorization→store→四态 contract→五类 target assignment 与可恢复独立账号。每一步必须验证 owner readback 的 id、显示名、revision/状态或关系，再向下一步推进。根 OpenAPI 的四条 retired platform invitation pointer 必须删除；operations/public invitation 是保留反例。
Cookie、密码、OTP、invitation token、grant、asset bind grant 只在本机受管进程或 `0600` 私密环境中短暂存在，不进入 fixture/result/log。fixture 只暴露页面需要的 owner-returned label、group workspace key、公开 route 和非秘密 locator；任何测试写命令使用 owner readback，未知结果先 readback。

## 4. 精确 browser 分母

| Surface | Spec | IA/owner proof |
|---|---|---|
| PLATFORM-AUTH, PLATFORM-PASSWORD | platform authentication | IA01 platform login/recovery; platform-IAM session/readback |
| PLATFORM-WORKSPACES, PLATFORM-WORKSPACE-OVERVIEW | workspace management/overview | IA02 name→detail and selected workspace readback |
| PLATFORM-ADMIN-USERS | platform-admin management | IA03 detail-gated governance |
| PLATFORM-ORGANIZATION-OVERVIEW, PLATFORM-CONTRACT-OVERVIEW | organization/contract overview | IA03 task-read list/detail |
| PLATFORM-ROLES, PLATFORM-WORKSPACE-ACCOUNTS | role/account management | IA03 owner capability/account readback |
| PLATFORM-EXTENSION-FIELDS | extension-field management | IA03 whole-definition owner revision |
| OPERATIONS-AUTH | operations authentication | IA01 entry branding then workspace session |
| PUBLIC-INVITATION | invitation-acceptance | IA01 anonymous invitation→OTP→credentials→complete |
| PUBLIC-ACCESS-RECOVERY | access-recovery | IA05 loginName/mobile/OTP→password→complete→login; no session |
| OPERATIONS-SHELL, OPERATIONS-PASSWORD, OPERATIONS-FIVE-HOME-BOOTSTRAPS | work-context | IA02 context/data-scope and IA05 self-password/five owner homes |
| OPERATIONS-ORG-STRUCTURE | organization-hierarchy | IA04 tree/detail-gated region/project/edit/status |
| OPERATIONS-BUSINESS-ENTITIES | business-entity-management | IA04 current BusinessEntity page and immediate brand add/remove; no legacy page |
| OPERATIONS-STORES | store-management | IA04 owner candidate cascade/detail/status |
| OPERATIONS-CONTRACTS | contract-management | IA04 selected-scope list/detail/approved entry |
| OPERATIONS-USERS | user-management | IA01 target invitation plus IA05 target assignment detail/revoke |
| OPERATIONS-STORE-PROFILE | store-profile | IA04 owner-returned current/pending/history/invalid contract views |

All nineteen spec paths are exactly the two phaseBusinessL2Obligations test sets in affected-l2-registry.json. A shared spec may cover multiple listed surfaces only where the table says so.

## 5. Completion

Before code, a fresh independent DESIGN review must verify the local lifecycle, remote namespace handling, mapping, fixture and cleanup. After implementation, independent IMPLEMENTATION review must reopen the exact source/spec/run-manifest/log hashes. Only a local 19-file PASS plus independent cleanup PASS proves joint L2 business/cleanup; static checks remain separate.
