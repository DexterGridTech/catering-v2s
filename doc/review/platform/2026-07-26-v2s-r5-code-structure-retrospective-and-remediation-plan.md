---
title: R5 代码目录结构反思与整改计划
status: STRUCTURAL_REMEDIATION_READY_FOR_R5_IMPLEMENTATION_INTAKE
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
reviewTarget: IMPLEMENTATION_STRUCTURE
scope: apps-and-libraries-source-organization-only
authorityBoundary: No new business capability, contract, schema, migration, DEV/seed behavior, or separate R5 review cycle is authorized by this document.
remediationIntake: doc/review/platform/2026-07-26-v2s-r5-code-structure-plan-finding-intake.md
claudeRecheckReceipt: 2026-07-26 Dexter-transferred GO(M=0 / S=0 / N=2); S0-S5 remain inside the existing R5 implementation authorization and one whole-scope review cycle.
---

# R5 代码目录结构反思与整改计划

## 1. 结论

Dexter 指出的问题成立，而且是实施方式失职，不是“单体天然如此”。当前 v2s 虽已把 owner
application/domain/api 放入 `libraries/backend/*`，却把 24 个 HTTP controller（另有 advice、boot/config
与 generated 文件）、两套 app shell、
路由、页面和 feature 行为以短期交付方便为由集中平铺。结果是业务 deployable 是一个，源码入口也
几乎变成一个“万能目录”；这既不利于维护，也违背 R5 已接受的模块 owner、双 admin 独立 app、
前端 feature 和 foundation 消费边界。

本计划采用 **v2 的“app 壳 + feature/module”组织方法**，但绝不复制 v2 的八个业务服务、MQ、
投影或多库拓扑。v2s 继续是一个 deployable、一个数据库、七个 owner schema；整改只恢复源码的
能力归属和可定位性。

在本计划得到 Dexter 与 Claude 认可前，R5 的 DEV/seed 线保持暂停；本次已有的受管运行已通过
`scripts/dev/stop` 停止，未 seed、未 reset。

## 2. 本次实测分母

| 面 | all-v2 已验证组织 | 当前 v2s 已验证组织 | 判断 |
|---|---|---|---|
| 后端 deployable | `apps/backend/*-service` 八个独立服务，各服务内按 capability-first 再 `adapter/application/domain/config/security` 分层 | `apps/backend/catering-business-server` 一个 deployable；7 owner schema、8 owner registry module、9 backend library（含 access/foundation） | 单 deployable 是正确差异，不能退回 v2 服务拆分 |
| 后端 edge | controller 随 capability 的 adapter-in/feature 归位 | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/` 有 24 个 controller 平铺 | 不合理；edge adapter 应按 face + capability 归类 |
| 后端 shared | `libraries/backend/platform-foundation`、`platform-wire-model` | `libraries/backend/{platform-foundation,platform-access,platform-iam,platform-workspace,platform-asset,organization,extension,workspace-iam,contract}` | library 物理拆分已具备，但 app edge 未跟随能力归位 |
| 前端 app 壳 | 两个 app 都有 `app/{api,layout,routing,state,theme,...}`，feature 有独立 `ui/automation/model` | platform 主要集中于 `src/app/PlatformApp.tsx`；operations 集中在 `OperationsApp.tsx` + 泛化 `OperationsFeaturePage.tsx` | 不合理；当前是把 R5 104 operation 面压进少数巨型组件 |
| 前端共享 | `libraries/frontend/admin-ui-foundation` 被 app feature 消费 | 同名 foundation 已在 v2s，但只局部消费，feature 边界不清 | 需要在搬迁时按 feature 明确消费，不能在 app 内复制 foundation 行为 |

本次清点的可复现依据：

- all-v2 backend：`apps/backend/{platform-iam-service,platform-workspace-service,platform-asset-service,workspace-iam-service,organization-service,extension-service,contract-service,platform-gateway}/src/main/java`；
- all-v2 frontend：两个 `apps/frontend/*/src/app`，以及 `features/{authentication,workspace-management,role-management,...}`、`features/{organization-hierarchy,business-entity-management,contract-management,...}`；
- v2s backend：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/` 的 24 controller、advice、boot/config 与 3 generated class；
- v2s frontend：`apps/frontend/platform-admin/src/app/PlatformApp.tsx`、`apps/frontend/operations-admin/src/app/OperationsApp.tsx`、`src/features/OperationsFeaturePage.tsx`。

## 3. 根因反思

### 3.1 我把“一个业务 deployable”错误缩约成“一个 app 包”

设计正确地拒绝 v2 的分布式服务拓扑；实施却错误地把这个架构结论延伸为 edge adapter 全部放在
`com.catering.v2s.app`。一个部署单元只决定进程/运行拓扑，不决定 controller、route、feature 和
测试应失去能力归属。这个错误让 controller 的路径无法一眼回答：哪个 consumer face、哪个用户
任务、哪个 owner command、哪个 review evidence 对它负责。

### 3.2 我把“先让 104 operations 有路由”置于“先建立稳定承载结构”之前

R5 合同/接口、后端、前端的批次策略是合理的；但我没有在接口批结束时先建立 feature/module
骨架和路径表，而是把 controller/页面直接写进已有大文件。之后每一项功能都沿着最低阻力继续堆
叠，形成了可编译但不可维护的局部最优。

### 3.3 我只复制了 v2 的 UI foundation，没有复制其 app/feature 的组织纪律

v2 已明确展示了 app 负责 router、shell、state、theme，feature 负责页面、业务局部状态和
automation 的边界。v2s 已有 `admin-ui-foundation`，但我只使用了少数 Drawer/overlay/http helper，
没有让 feature 成为业务 UI 的唯一承载者，导致 `PlatformApp`、`OperationsApp` 变成 shell、route、
fetch、form、table 和业务规则的混合物。

### 3.4 这是系统性缺口，不能靠给平铺文件改名掩盖

问题不是三个 controller 或一个页面，而是 edge、app shell、feature、test 四层缺少共同目录契约。
因此整改必须先固定目标树和每个现存文件的去向，再搬迁；不能只做“拆一两个文件”，也不能新造
一套服务层或为了目录整洁复制业务代码。

## 4. 目标结构

### 4.1 Backend：一个 deployable，按 face 与能力组织 edge

`libraries/backend/*` 继续是 owner 的 domain/application/api/adapter-out 源码所在。业务 server app
只保留 boot/config 与 HTTP edge adapter；edge 不拥有业务事实，也不绕过 library public command API。

```text
apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/
  bootstrap/                         CateringV2sApplication, BusinessServerBoundary
  configuration/                     BusinessDataConfiguration
  edge/
    generated/                       EdgeOperationRegistry, generated problem definitions
    problem/                         cross-face ProblemAdvice only
    platform/
      session/                       platform login/logout/password/admin credential edge
      workspace/                     workspace administration + commercial-group initialization
      workspaceiam/                  role/account/invitation administration edge
      organization/                  platform organization overview
      contract/                      platform contract overview
      extension/                     extension-definition administration
      asset/                         platform asset staging
    operations/
      session/                       password/OTP login and session entry
      context/                       assignment/data-node selection
      organization/                  hierarchy/entity/store task edge
      contract/                      contract task edge
      access/                        invitation candidate/invitation edge
    publicentry/                      `public` is a Java reserved word; HTTP consumer face remains `public`
      asset/                         active asset content
      invitation/                    invitation acceptance chain
      passwordreset/                 password recovery chain
```

本结构的关键约束：

1. HTTP path、operationId、DTO wire shape、error code、事务语义、library owner API 和 migration
   字节均不改变；但 controller 职责必须在**同一次迁移**归位，不能用“先搬目录、以后再修”推迟。
2. 跨 owner 的 platform/operations task controller 留在 `app/edge/<face>/<capability>` 作为
   coordinator，但不得把 domain state、SQL 或 owner command 实现搬回 app。
3. `generated/` 只保存由 edge contract 生成且 server 必须注册的输入；不把 hand-written controller
   混入 generated。
4. 每个 controller 的 focused test 同时移动到同 face/capability 的测试包；全局 route coverage 保留
   在 `edge` integration suite。

这与 whole-scope design §3.2 的 `catering-business-server adapter.in.web` 一致：它是 app assembly
层，而不是 owner library 内的 web adapter。owner library 只保留 API/application/domain/persistence；
face 是 edge 的一等维度，不能混进多 face owner。

### 4.1.1 同次职责归位规则

| 位置 | 必须完成的职责修复 | 禁止 |
|---|---|---|
| backend edge | platform/operations session 只经 capability-scoped shared resolver/argument resolver 取得；controller 不直接读 cookie；request/response 使用当前 edge codegen 的 generated wire type；错误统一转 typed Problem；闭集使用 typed catalog constant | inline record/`Object` response、cookie loop、字符串闭集、`IllegalArgumentException` 充当 wire Problem、JDBC/repository 进入 controller |
| backend list/read | 每一 operation 严格服从 frozen catalog 的 response schema；catalog 为 page 的必须回 generated page envelope，catalog 为 bounded collection 的不得无依据改为分页 | 以“所有 List 都分页”或“现状 List 都保留”替代逐 operation contract 对账 |
| frontend transport | app per-face transport 只消费 generated operation types；feature `api/` 仅可导出 typed facade/query hooks；所有 mutation 经 foundation lifecycle 取得 idempotency key | feature/app 内联 `fetch`、重复 HTTP protocol、未带 idempotency 的 catalog-required mutation |
| frontend behavior | invitation expiry、业务时间和固定 clock 仅由服务端/DEV profile 提供；page/action capability 使用 closed-set selector，仍由一个 owner atomic command 提交 | `Date.now()` 造业务事实、逗号文本框编辑 capability、按 JSON key 自动拼 UI、裸 JSON detail drawer |

### 4.2 Controller 完整迁移映射

| 当前 family | 目标 capability | 现有文件 |
|---|---|---|
| 平台身份 | `edge/platform/session` | `PlatformAuthenticationController`、`PlatformAdminGovernanceController` |
| 平台空间与 C-01 | `edge/platform/workspace` | `PlatformWorkspaceAdministrationController`、`PlatformCommercialGroupController` |
| 平台空间 IAM | `edge/platform/workspaceiam` | `PlatformWorkspaceRoleController`、`PlatformWorkspaceAccountController`、`PlatformWorkspaceInvitationController`、`PlatformWorkspaceInvitationCandidateController` |
| 平台只读与定义 | `edge/platform/{organization,contract,extension}` | `PlatformOrganizationOverviewController`、`PlatformContractOverviewController`、`PlatformExtensionDefinitionController` |
| 平台资产 | `edge/platform/asset` | `PlatformAssetController` |
| 运营身份与入口 | `edge/operations/session` | `OperationsAuthenticationController`、`OperationsCatalogAuthenticationController`、`OperationsWorkspaceLoginEntryController` |
| 运营上下文 | `edge/operations/context` | `OperationsWorkspaceMembershipController` |
| 运营组织与门店 | `edge/operations/organization` | `OperationsOrganizationController`、`OperationsStoreProfileController` |
| 运营合同 | `edge/operations/contract` | `OperationsContractController` |
| 运营邀请 | `edge/operations/access` | `OperationsWorkspaceInvitationController`、`OperationsWorkspaceInvitationCandidateController` |
| 公开入口 | `edge/publicentry/{asset,invitation,passwordreset}` | `PublicAssetController`、`PublicInvitationController`、`PublicWorkspacePasswordResetController` |
| 全 face | `edge/problem` | `ContractProblemAdvice` |

### 4.3 Frontend：app 是壳，feature 是业务唯一承载者

两个 app 保持完全独立，但共享同一种目录语义。generated edge client 仍各自按 consumer face 生成；
不从 all-v2 runtime/build fallback。

```text
apps/frontend/<platform-admin|operations-admin>/src/
  app/
    bootstrap/ api/{client,generated}/ layout/ routing/ state/ theme/ shell/
  features/<capability>/
    api/ model/ ui/ automation/ index.ts
  tests/{architecture,l2,l3,traceability}/
```

platform features：`authentication`、`workspace-management`（含商业集团初始化）、
`platform-admin-governance`、`workspace-overview`、`workspace-role-management`、
`workspace-account-management`（含 invitation management）、`organization-overview`、
`contract-overview`、`extension-definition-management`、`password-management`。

operations features：`authentication`、`work-context`、`organization-hierarchy`、
`business-entity-management`、`store-management`、`store-profile`、`contract-management`、
`user-management`、`invitation-acceptance`、`access-recovery`、`entity-extension-values`、
`password-management`、`home-bootstrap`。

每个 feature 只负责自己的 page/drawer/form/selector/locators；app 只负责 route registration、
shell、session/context state、theme 和 generated base API。`admin-ui-foundation` 必须由 feature
显式消费其已有的 drawer lifecycle、overlay lock、HTTP protocol、context-scoped query 和 test-id
能力；不能在 feature 或 app 再复制这些 primitive。`features/<capability>/api` 是 v2s 对 v2 的
明确增强：它只可 re-export generated per-face type/facade/query hook，底层 transport 只能位于 app
per-face client，禁止成为第二个手写 fetch 桶。

## 5. 实施计划（R5 内部重构，不形成独立产品交付）

| 顺序 | 工作包 | 产物与范围 | 完成判定 |
|---|---|---|---|
| S0 | 冻结分母与真实控制前置 | 22 surfaces / 25 pageDesignKey → route/feature/controller/test 双向表；修复既有 layout/architecture 控制链与真实目录 red mutation | 零未归类 controller、route、page、L2/L3 **映射**；S0 的 entry PASS 后才可迁移。尚未实现的 L2/L3 文件仍在 S2-S4 依各自 surface 实现，不能被误报为 S0 test PASS。 |
| S1 | backend edge 归位与职责修复 | 按 face/capability 移动 package/import/test，并同次抽 shared resolver、generated wire、typed Problem、catalog response envelope；先 public/platform，再 operations | `EdgeRouteRegistryCoverageTest`、owner Testcontainers、ArchUnit 与 route registry 通过；零 endpoint/error/contract 漂移 |
| S2 | platform app 拆壳与 transport 修复 | `PlatformApp` 缩为 bootstrap/router/shell；按十个 platform surface 搬出 UI/API；删除 inline transport、客户端业务时间和文本闭集编辑 | 10 platform surface 均有归属；feature 不跨越 private ui import；所有 required mutation 使用 lifecycle idempotency |
| S3 | operations app 拆壳与 UI 职责修复 | 以 v2 page registry 为基线替代泛化 `OperationsFeaturePage`；`PublicEntry` 拆为 invitation/recovery feature | 12 operations surface、12 `PG-*` 与 5 `HOME-*`（共 17 key）均有明确 feature 或 `CARRY_ROUTE_BOOTSTRAP_ONLY` app route；context 切换仍清理旧 query/overlay |
| S4 | 测试和 evidence 归位 | architecture/traceability 留 app tests；迁移现有 locator/automation 的路径归属；格式化为正常可读组件；更新只受路径影响的 manifest/evidence | build、typecheck、static architecture、route-face crosswalk 与既有 focused test PASS；未运行的 L2/L3 明确登记，不得以路径或 stub 冒充行为 PASS |
| S5 | 恢复 R5 主线 | 在 S0-S4 的**结构性**判定通过后恢复 backend/UI completeness、remote DEV 与 rich seed；然后创建并运行全部 22 surface 的 focused L2/L3 | R5 的唯一 whole-scope implementation review 包含该结构整改，不单独开 R5 review |

S1-S4 是依赖顺序，不是新的 Journey、授权或验收切片。每一包完成后只作为 R5 内部证据继续，
不会请求 Dexter 逐包确认，也不会把同一 R5 拆成多个 review。

### 5.1 执行期一致性校正（Codex 决定）

原 S4 的“focused L2/L3 全 PASS”与同一表中“只有 S5 才恢复 managed DEV”互相依赖：R5 L2 是
真实浏览器任务，设计 §10.1 禁止用 mock 或 path-only stub 替代，故不可能在 DEV 明确暂停时真实运行。
本校正不降低 R5 验收分母：S4 只关闭源码组织、编译/静态控制和已存在测试的路径归属；22 surface 的
focused L2/L3、32 scenario、104 operation、business 与 cleanup 仍全部留在 S5/U12 的同一个 R5
whole-scope implementation review。`scripts/check/affected-l2` 在运行前保持可见红色，不能被重标为
PASS，也不能由空测试文件关闭。

## 6. 防止再次发生

不新增独立 checker 或门；但现有控制必须先从假绿修为真红，再作为 S0 前置：

1. `code-layout` 必须遍历真实 `apps/frontend/<app>/src` 与 `apps/backend/<app>/src`；backend app
   根只允许 `bootstrap/configuration/edge/generated`，frontend app 根不允许业务 page/form/table；
   self-test 使用同样两层路径并亲验 red mutation。
2. 既有 `frontend-architecture` gate 替换对巨型文件的 substring 断言，承接可机械的三项：feature
   不 import 其它 feature 的 private `ui` 路径；非 transport/generated 文件不得直接 `fetch`；catalog
   required mutation 必须经 lifecycle idempotency helper。它不判定用户语义。
3. 既有 backend ArchUnit 承接 capability package 单向依赖、controller 禁直读 cookie/servlet API、edge
   禁 JDBC/repository；真实 fixture 必须使每条规则红。
4. 开发蓝图 §14 已增加“app 根堆叠/职责下坠”禁令。`project-memory/required-inventory.json` 是独立
   冻结分母，现行 checker 明令拒绝未在 inventory 的 active routed memory；本次结构实施不得篡改
   inventory 或伪造 active memory。若未来治理 batch 变更该分母，再将同一禁令提升为 routed anchor；
   在此之前只以蓝图、真实 layout/architecture controls 和 whole-scope review 约束未来 agent。

上述均复用既有工具、test suite、memory 与蓝图，不建立新 gate、不对语义做关键词审判；用户任务和
v2 资产选择仍留 R5 whole-scope 对抗审查及 Claude review 判断。

### 6.4 GO 后修订披露与冻结 memory 边界

Claude 对本计划给出 GO 时审阅的字节前缀为 `d5ca6bf50e691dd2`。之后本计划修订为
`306c596fd65798c2`：原 §6 第 4 条中“新增 `project-memory/pitfalls/` 条目并接入 routed anchor”
被删除，改为保留 `required-inventory.json` 的冻结分母，并仅以开发蓝图、真实 layout/architecture
controls 与 whole-scope review 承担该约束。该技术修订本身不改变业务、contract、schema 或分母，
且避免为新增 pitfall 静默篡改 frozen inventory；但此前未披露该字节差异是治理缺陷，现已显式登记。
未来若因其它原因开启治理 batch，才可审议将同一 pitfall 提升为 routed memory；本整改包不得自行
解冻或改写 inventory。

## 7. 风险与非目标

- **风险**：批量 package move 可能造成 Spring component scan、generated registry、frontend dynamic
  import、Playwright locator 和 manifest hash 漂移。缓解是 S0 path map、按 face/capability 的小批
  move、每批真实编译和 focused tests，而不是一次性全仓移动。
- **非目标**：不把 v2 八服务搬回 v2s；不复制 MQ/Redis/outbox；不改变 owner schema、Flyway、
  contract、UI product behavior、seed fact 或 Journey；不重开已关闭 R3/R4 review。
- **停线边界**：远端数据库可以保留为 v2s 专属 namespace，但本计划评审期间不继续启动 DEV、
  不 seed/reset；恢复由当前 R5 implementation 授权范围内的 S5 执行。

## 8. 需要评审的判定

请重点判断：

1. backend edge 是否应采用本计划的 `app/edge/<face>/<capability>`，而不是复制 v2 的多 deployable；
2. platform/operations feature 清单是否完整覆盖 all-v2 已实现 R5 页面，并且没有以 generic page
   偷掉 capability 边界；
3. S0-S5 是否能在不改变 104 operation 与 32 scenario 分母的前提下恢复可维护结构；
4. “复用现有 code-layout / architecture test，不增加独立门”的控制是否足够且不过度设计。

## 9. 自我审视

从 Dexter 和未来维护者角度，当前结构的替代方案不是“维持平铺、靠搜索找代码”，而是本计划的
能力目录；后者一次性迁移成本高，但会消除未来 104 operation 持续集中到 2–3 个文件的必然返工。
另一种替代是照搬 v2 的服务目录，这会违背 v2s 单 deployable 的已批准架构，成本更高且不解决
edge 与 feature 归属。因此本计划选择“复用 v2 的组织纪律，保留 v2s 的部署边界”。

## 10. 长期适用性与命名对照

该结构不是短期兼容层：face 与 owner 是独立扩展轴，未来 terminal/customer 等 face 只新增
`edge/<face>`，未来 owner 只新增 `libraries/backend/<owner>`；若满足已接受的拆分触发条件，抽离
对应 owner library 与 edge capability 即可，不重写业务模型。`workspaceiam` package 对应
`workspace-iam` library，package 一律不用连字符。

| all-v2 feature | v2s feature | surface/pageKey 归属 |
|---|---|---|
| `workspace-management` | `workspace-management` | PLATFORM-WORKSPACES |
| `workspace-overview` | `workspace-overview` | PLATFORM-WORKSPACE-OVERVIEW |
| `role-management` | `workspace-role-management` | PLATFORM-ROLES |
| `extension-field-management` | `extension-definition-management` | PLATFORM-EXTENSION-FIELDS |
| `entity-extension-fields` | `entity-extension-values` | organization/contract feature sub-capability，按其宿主 surface |
| `user-management` | `user-management` | 五个 PG-IAM page key |

S4 还必须显式记录 v2 的 `tests/chrome` 与 v2s 测试目录差异：只迁移经批准 L2/L3/traceability
证据，不能临场发明第三类浏览器测试。`configuration/` 仅配置 datasource/Flyway/JdbcTemplate，
禁止包含业务 SQL。
