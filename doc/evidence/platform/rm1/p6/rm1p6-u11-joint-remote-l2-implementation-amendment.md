# U11 direct joint local-execution, remote-middleware L2

## Direct denominator


U11 只证明 P6 已接受的 22 个前端 business surface：P6-2 十个 surface 由九个既有 platform spec 覆盖，P6-3 十二个 surface 由十个 operations spec 覆盖。它不新增页面、菜单、route、测试专用 UI、数据库业务直写或 reset。
当前受管浏览器 L2 的执行面固定在本机：受管 tunnel、本机 Spring Boot、`platform-admin`、`operations-admin` 与 Playwright 均从本 checkout 启动；远端非生产环境只承载每 run 隔离的 PostgreSQL/对象存储 namespace。远端 Testcontainers 技术验证不等于浏览器 L2；UAT 才是全远端部署。

## 2. 本机生命周期、远端中间件与可观测性

1. 本机以配置的非生产 host hash 建立受管 tunnel；远端创建并回读唯一数据库/asset namespace。本机不复制 checkout 到远端，也不在远端启动 app、Vite 或 Playwright。
2. 本机启动 tunnel、business-server、platform-admin、operations-admin；每个记录 PID/PGID、boot id、start ticks、command hash、log path。远端只记录 namespace identity。
3. 本机依次验证 edge、platform URL、operations URL；固定 deadline，不延时重试。首次失败立即读取本机三份 app 日志与 tunnel 日志，记录 firstFailure、lastKnownGood、brokenBoundary。
4. fixture 只在 readiness PASS 后通过本机 edge 的 owner HTTP command 创建既有可达事实；所有原本依赖已退役 platform invitation HTTP 的 fixture invitation，都由短生命周期、`WebApplicationType.NONE` 的受管 owner bootstrap 创建。bootstrap 只能先以 `WorkspaceAdministrationService.requireEnabled` 重读空间，再调用 `WorkspaceInvitationService.create(...)` 的单一、显式 `GROUP`/`REGION`/`PROJECT`/`HEAD_COMPANY`/`STORE` intent；`EdgeWebConfiguration` 的 MVC-only mapping-validation runner 必须以 servlet 条件排除在 non-web context 外，其他被 controller 依赖的 diagnostic beans 仍保留，不得以启动 servlet listener 规避该条件。不得注册 Controller、暴露 OpenAPI、直写业务 SQL 或输出 token。它只把 token 写到 run-scoped `0600` 私密文件，fixture 读取后继续既有 public invitation flow，并输出仅含标签、路由 key 与非秘密测试变量的 redacted fixture。
5. 本机 Playwright 按精确 19-file list 执行，两个 base URL 均为本机受管 URL；fixture 必须从 exact platform/operations spec-required environment union 生成测试输入，并把每一键连接到已建立事实的 owner readback 或明确私密凭据输入；缺失、无 owner 来源或未被测试消费的输入均是 FAIL。缺失或空 spec 是 FAIL。
6. 每个受管子进程（local start、fixture、两个 Playwright、local stop）在结束后、写 phase 前，将其 stdout/stderr 写为 run-scoped `0600` redacted diagnostic artifact；phase 记录该路径、sha256 与字节数。fixture 自己还必须在每一个 owner HTTP、owner bootstrap 或可观察业务阶段同步追加 `0600` JSONL phase artifact，不能等到全部 fixture 完成才汇总；其 exact-set failure 只输出 missing/extra key names，绝不输出任何 value。写入前按子进程环境逐值遮蔽 password、OTP、token、cookie、Authorization、secret、手机号、登录名和其他 account identifier，绝不把 private env 本文或 raw payload 直接落盘。runner self-test 必须以传入的 synthetic secret 证明该值不能出现在 artifact。
7. finally 先保存 terminal manifest/evidence digest，再按本机 PID/PGID identity 关闭 tunnel 与三个进程、确认无 live descendant；并从远端回读后移除唯一数据库/asset namespace。business 与 cleanup 分别判定；任一失败均非 PASS。

## 3. Owner fixture 与秘密边界

唯一允许的 SQL 是既有 frozen root bootstrap。其余事实依序为：root 登录→workspace/logo→commercial group→extension definition→role/action grants→受管 owner bootstrap invitation/匿名 OTP/credential completion→operations session→region/project→brand/tenant/head company/逐项 brand authorization→store→四态 contract→五类 target assignment 与可恢复独立账号。每一步必须验证 owner readback 的 id、显示名、revision/状态或关系，再向下一步推进。根 OpenAPI 必须删除全部四条已退役 platform invitation pointer；operations/public invitation 合同是明确保留反例。
Cookie、密码、OTP、invitation token、grant、asset bind grant、手机号、登录名及其他 account-identifying test value 只在本机受管进程或 `0600` 私密环境中短暂存在，不进入公开 fixture/result/log。fixture 的公开 JSON 只暴露页面需要的非敏感 owner-returned label 与 route locator；任何测试写命令使用 owner readback，未知结果先 readback。

## 3.1 Generated JSON transport runtime compatibility

The U11 contract-create first failure proved that the generated edge DTO type for OpenAPI object-valued fields must match the Spring Boot 4 HTTP converter's Jackson 3 `tools.jackson.databind.JsonNode`. `com.fasterxml.jackson.databind.JsonNode` remains legitimate inside owner modules that explicitly use the Jackson 2 dependency, but it is not a compatible controller request/response type. The minimal root repair changes the established edge code generator and regenerates its complete affected wire denominator; every edge mapper that accepts or emits those generated DTOs changes to the same transport type. No controller catch-all, error-shape suppression, fixture payload omission, endpoint-specific workaround, or hand edit of generated files is permitted.

## 3.2 Owner receipt Java-time serialization compatibility

The next fresh L2 reached `ContractCommandReceiptService` after the command completed and therefore proved a separate owner boundary: its Jackson 2 mapper already calls `findAndRegisterModules()`, but `store-contract` did not declare `jackson-datatype-jsr310`, so a `StoreContractReadback` containing `LocalDate` could not be persisted as the exact idempotent terminal readback. The finite receipt denominator is seven owner receipt services: this contract receipt is the sole current serializer whose returned readback contains Java-time fields; the other six either manually encode their values or have current return types without Java-time fields. The minimal repair is the direct Java-time module dependency in the `store-contract` owner module. It does not change wire transport, controller behavior, owner commands, receipt schema, retry semantics or the six counterexample receipt services. Focused proof must cover successful contract command receipt serialization and replay, then the fresh managed L2 must show that the command passes the owner receipt boundary.

## 3.3 Platform administrator default-list optional filter binding

IA03 `ADMIN-LIST` explicitly permits an unfiltered initial owner page and defines filters as optional user inputs. The fresh owner-readback fixture exposed that `PlatformAuthenticationService.pageAdministrators` reused nullable values in PostgreSQL `? IS NULL OR ...` expressions without an explicit SQL type; PostgreSQL therefore rejects the absent first filter before the page can be read. Once typed SQL binding was repaired, the same default path exposed the second null-hostile layer: `List.of(values)` rejects the nullable values before pagination can bind them. The finite denominator is this one owner list predicate, the directly derived pagination bind collection, and all three nullable filter pairs (`userName`, `loginName`, `status`); mandatory paging and sort inputs are counterexamples because they are never absent. The minimal repair binds every nullable predicate placeholder with an explicit text cast and copies its parameter array through a null-tolerant collection while retaining the same owner-side filtering, total predicate, ordering and pagination. A focused owner test must prove omitted filters return the default page; the joint browser L2 must then prove the real platform administrator list path.

## 3.4 Shared generated-client JSON request media type

IA01 login and every approved generated command require the app-owned generated-client transport to deliver an OpenAPI `application/json` request body; the page must not invent a per-operation fetch/header workaround. The fresh platform browser L2 proved that both `platform-admin` and `operations-admin` independently JSON-stringified non-multipart bodies without setting `Content-Type`, so RTK emitted `text/plain;charset=UTF-8` and Spring rejected every JSON login before owner authentication. The finite denominator is the two app-owned generated-client adapters and their complete generated operation closure; `FormData` asset uploads are the counterexample because the browser must supply their multipart boundary. The minimal reusable repair is one foundation helper that serializes a non-multipart body and sets `application/json` only when the caller did not declare a content type, while preserving an explicit caller header and leaving multipart headers untouched. Both app adapters use that one helper; its focused proof covers JSON, multipart and explicit-header behavior, and the fresh joint L2 proves both app faces through their approved user paths.

## 3.5 Workspace-management default-list optional filter binding

IA02 permits a default enabled workspace candidate list for the platform selector and a default workspace-management list; all name, key and operations-title filters are optional. After the media-type repair, the fresh platform browser L2 showed that `WorkspaceAdministrationService.list` uses the same PostgreSQL `? IS NULL OR ...` form with untyped absent text filters. Its first null prevents the owner from returning the IA-approved enabled workspace, so neither the selector nor the management page can proceed. The finite denominator is this owner list's three nullable text filter pairs and the nullable status pair, for both count and sorted page queries; mandatory page, page-size and sort inputs are counterexamples. The smallest correct repair adds explicit text casts to every nullable predicate placeholder while retaining the owner predicate, total, ordering, pagination and status semantics. A focused owner test proves the unfiltered default list binds nullable values safely; the next fresh joint L2 proves the actual selector and workspace-management paths.

## 3.6 Shared-identity browser-L2 concurrency and rendered-control locators

The fresh platform browser phase launched the nine platform specs in seven Playwright workers while every one used the same fixture-created platform credential and local source. `PlatformAuthenticationService` correctly serializes that identity/source through transaction advisory locks around BCrypt verification and session creation; two login submissions consequently remained in-flight beyond the L2 helper's fixed shell assertion. The operations batch has the same finite shape: its exact ten specs reuse fixture-created workspace identities whose workspace login rate-limit service also serializes identity/source buckets. The runner, not production authentication, therefore invokes each app batch with `--workers=1`. This does not relax a lock, rate policy, timeout or product behavior, and no extra accounts are created.

The same run separately proved two test-automation boundary defects: the shared platform selector helper addressed a hidden Ant Design virtual-list semantic option instead of a rendered visible option, and the workspace detail L2 proof expected an absent Drawer automation anchor although the approved name-link-to-detail flow had opened it. The finite denominator is the shared platform select helpers and the one IA02 workspace detail surface. The minimum repair scopes option lookup to a non-hidden dropdown and visible option, and exposes the existing drawer through its approved `testId`; it does not alter user-visible copy, list actions, owner reads, route, drawer lifecycle or command surface. Focused type/static proof and the next fresh managed L2 must cover the corrected helpers and drawer.

## 3.7 IA03 extension-field entry proof

The next browser trace showed that the extension-field page correctly renders the IA03 fixed business-object selector before the definition surface, while the proof attempted to open a definition by treating the selected entity as a page button. This is a test-flow defect, not a product defect: IA03-EXTENSION-PAGE requires selecting one of the fixed five sidebar categories before reading the corresponding definition and opening its editor. The finite denominator is the single extension-field spec and the shared IA03 page entry. The minimal repair selects the owner-returned entity label through the semantic menu item, then asserts the existing `extension-definition-edit` test-id and the editor surface; it adds no page control, route, or fallback copy and does not infer an entity from technical keys.

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

## 5.1 Owner scope-resolution transaction boundary

The operations store-candidate run exposed a second backend root cause after the status command was corrected. `StoreCandidateTaskReadService.visibleScope` tried `GROUP`, `REGION`, `PROJECT`, `HEAD_COMPANY` and `STORE` by invoking the throwing single-target `OrganizationTaskPathLookup.requireTaskPath` from one `REQUIRED` transaction and catching every `RuntimeException`. A normal not-found for four non-matching target families still marked the owner transaction rollback-only; when the valid family was eventually found, commit surfaced `UnexpectedRollbackException`. The finite denominator is this visible-scope resolver and every equivalent closed target-family probe in the current owner consumers. The counterexamples are owner APIs that expose non-throwing availability or bounded batch reads, and absence handling performed wholly inside the owner. The minimal fix uses `availableTaskTargets` to select exactly one family, then one bounded `requireTaskPaths` read and the existing scope predicate. It does not add retries, `REQUIRES_NEW`, broad swallowing, frontend fallback, or a new edge contract. Focused compile/static proof and a fresh candidate endpoint/readback observation are required before L2 can be called green.

## 5.2 L2 data-flow coverage boundary

The current governed browser denominator is 19 real spec files and 19 non-empty tests covering 22 approved business surfaces. Those tests prove rendered controls, route/overlay transitions, selected owner labels and several write-after-readback outcomes; they do not and should not inspect Redux internals through `store.getState()`. The audit found that only a subset explicitly asserts the command request method/path/body/header and that focused feature tests are primarily source-contract checks rather than mounted RTK cache tests. This is a coverage limitation, not permission to couple business acceptance to Redux implementation details. Before final U11 exit, each changed write surface must have the minimum observable chain `control -> generated client request -> owner readback or subsequent GET -> rendered state`; generated hook/tag wiring remains a focused proof concern. Any added assertion must use existing IA-approved controls, test ids and owner data, with no new test-only page or hand-written transport.

## 5.3 Public recovery request-body proof

The IA05 public recovery surface has four ordered owner writes: start with the user-entered login name and mobile, send the opaque OTP request, verify the entered code, and complete with the new password. The previous L2 only proved the rendered route and final navigation, so a form-to-client binding regression could leave the page visibly populated while the generated client received an empty or stale body. The minimum observable chain is now explicit in `apps/frontend/operations-admin/src/tests/l2/access-recovery.spec.ts`: each request is captured from the browser, its expected body is asserted (`loginName`/`mobile`, empty OTP-send body, `code`, `newPassword`), and its required idempotency header is asserted without exposing secret values. This remains a user-observable transport proof, not a Redux-internal assertion; the owner response and subsequent rendered route remain the business readback.

## 5.4 Deferred-obligation closure

The package input originally carried `JOINT_MANAGED_L2_AFTER_P6_3_IMPLEMENTATION_BY_DEXTER_SEQUENCE_DECISION` because Dexter explicitly deferred business and cleanup evidence until P6-3 was implemented. P6-3 is now implemented and the fresh managed run has independently produced both business and cleanup PASS. The input therefore transitions to the existing dynamic-evidence obligation `REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY`; this is an obligation-state closure, not a new machine gate. The package exit must bind the latest run report and current source hashes, while retaining the explicit boundary that this is local browser L2 against isolated remote non-production middleware, not UAT or a Roadmap status change.

## 5.5 IA05 revoke-detail interaction reconciliation

Claude's review noted that `platform-admin` selects one active assignment in the account detail table before opening the revoke confirmation, while `operations-admin` places a revoke button beside each assignment inside the user detail Drawer. Reopening IA05 §3 and the two owning sources confirms these are both detail-first, target-fixed paths: neither renders a list operation column, neither changes the page target, and both show the organization and role before owner revalidation. The platform account surface can contain several assignment rows and therefore requires an explicit radio selection; the operations user surface already renders each assignment as a distinct reviewable row and therefore keeps the row-local detail action. This is an interaction-shape difference within the approved detail task, not a second business capability or a fallback path. Future changes must preserve the IA05 rule that revoke starts from the detail surface and is rechecked by the owner against the page's fixed target.

The accepted current-byte run is `.runtime/r5/joint-local-l2/rm1p6-joint-local-l2-1785531940251-78105-88376fed/evidence/terminal-report.json@b098e5619f905ee8b9378248204f03ce102f0c62d72ac5f7fe98e310c8f45a23`. It records the exact nineteen governed specs, `PLATFORM_PLAYWRIGHT=PASS`, `OPERATIONS_PLAYWRIGHT=PASS`, `business.status=PASS`, `cleanup.status=PASS`, readable run-scoped logs, local process exit and removal of the isolated remote database, role and asset prefix. A previous attempt is retained as a diagnosed transient tunnel-boundary failure and is not counted as business or cleanup evidence; its signal is covered by `MANAGED_L2_TUNNEL_FAILURE_MUST_BE_DIAGNOSED_AT_THE_BOUNDARY`. This package still does not claim UAT, Roadmap status change, Redux-internal acceptance, or the unavailable Docker-backed workspace-iam runtime test.
