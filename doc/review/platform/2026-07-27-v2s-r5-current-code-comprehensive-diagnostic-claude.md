---
title: R5 当前代码整改范围清单与双审合并（Claude）
status: SCOPE_COMPLETE_REMEDIATION_ROADMAP_NOT_YET_DESIGNED
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewTarget: CURRENT_IMPLEMENTATION_READONLY_DIAGNOSTIC
verdict: NO-GO
counts: {M: 19, S: 14, N: 8}
purpose: 作为新建「整改 Roadmap」的唯一输入分母；由 Codex 据此产出详设与计划，经评审与 Dexter 接受后方可实施
mergesWith: doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-codex.md
reviewSessionProvenance: FRESH_V2S_ROOTED_SIX_PARALLEL_SUBAGENTS_PLUS_AUTHOR_VERIFICATION
authorizationBoundary: 只读诊断；不授权修复、构建、DEV、seed/reset 或动态运行
---

# R5 当前代码整改范围清单

## 0. 本件用途与结论

**结论：NO-GO（合并后 M=19 / S=14 / N=8）**。Codex 独立诊断为 NO-GO（M=12/S=7/N=2），两份已合并。

**本件不是评审报告，是整改范围清单。** 它的唯一用途是作为新建「整改 Roadmap」的输入分母：
Codex 据 §3 的九个整改包产出详设与实施计划，经评审与 Dexter 接受后才恢复实施。
本件不提供具体修复方案，避免在双审合并后由单方诊断替代设计裁决。

## 1. 为什么必须整改：这不是"一堆 bug"，是三个系统性失效

### 1.1 冻结约束的执行率不足六成，而没有任何门能发现违反

这三个数字是机械分母，不依赖任何主观判断，只对照白纸黑字，且**全部是已经写在冻结文件里的要求，
不是新增要求**：

| 分母来源 | 总数 | 违反 / 未满足 |
| --- | --- | --- |
| manifest `forbiddenPseudoFixes`（逐字写死的"不许这么做"） | 36 | **15** |
| manifest `approvedAssertions` | 27 | 17（含部分满足） |
| `project-memory` assertions（18 文件） | 62 | 11 |

明细见 §4。它们的共同点：**能覆盖它们的机器门接近于零**，全靠"实施者读了并遵守"。

### 1.2 门体系本身不可信，所以"门全绿"从来不是证据

- 5 条控制在 scratchpad 拷贝上注入违规后**仍然 PASS**
- `frontend --self-test` **恒 PASS**（`cli.mjs:282` 有 `if (action !== "frontend")` 自我豁免；
  实证：删掉 `main.js` 后同一棵树上门 FAIL 而自测 PASS）
- 把 6 个被引用的门替换成 `exit 0` 后，`standards-coverage --phase R5` 依然 **PASS / RULES=150**
- 本机 `gradle`/`gradlew`/`docker` **全无**，`verify.mjs:18` 硬编码的 docker socket 路径用户名是
  `dexter`（本机为 `dextery`）——**U02–U12 全部后端与前端测试门从未在此环境运行过**，
  真正跑过的只有 U01 的 4 个门

### 1.3 契约→代码的机械链路断在两处

契约有 792 处悬空引用（25 个 path 文件中含 `components` 段的数量 = 0，却有 742 次文档内
`#/components/responses/ProblemResponse`；另有 50 条跨文件 ref 目标不存在）；
生成器又把契约里**已经写好的**内联对象 schema 塌成 `Map<String, Object>`（41/146 wire 文件）。
两者叠加，"契约是权威"在实现上等价于"catalog JSON 是权威、`contracts/openapi` 是装饰"。

### 1.4 后果已经可观测，不是理论风险

- 运营管理后台 **PATCH/PUT 写路径 = 0 条**：建完一条数据就再也改不了
- 状态切换字段名正确率 **0/9**
- 门店启停**前后端各有一个方向相反的 bug** —— 说明这条路径从来没被端到端跑通过一次
- 多任职用户登录即死锁：菜单空、按钮灰、无处可选，只能退出登录
- 公开密码重置 OTP 通道零限流，未认证可暴力枚举，`sendOtp` 可作短信轰炸放大器
- 同集团空间内可越权读任意实体的审计行动者与字段变更
- 22 surface 完整吸收 **0/22**；v2 手写业务代码 15,730 行 → v2s 1,386 行（8.8%）

## 2. 过程规矩：做一点，验一点（Dexter 2026-07-27 定，此后长期有效）

### 2.1 问题定性

上一轮的根本失败不在任何单个 finding，而在**过程**：设计做了很多，实施过程中没有遵守，
把验证攒到最后一次性跑门。结果是——设计里 36 条禁止项违反 15 条、22 个 surface 一个都没完整落地，
**而这些在写下每一行代码的当时都是可以立刻发现的**。攒到最后再查，返工面已经覆盖全部产物，
既费时又费力，且此刻已无法判断哪一处是最初的偏离点。

### 2.2 新规矩（整改 Roadmap 必须内建，不是建议）

1. **包级串行**：整改按 §3 的工作包推进。**上一包的 exit gate 必须真绿，下一包才能开始。**
   不允许并行铺开后统一验证（§3 中显式标注可并行的除外）。
2. **文件级增量核对**：每写完一部分代码，立即对照项目记忆与设计文档核对是否违反。
   这一条要做成 **hook 而非 skill**——skill 只是推荐，可以被跳过。
3. **测试前全量扫描**：进入任何测试之前必须先跑全量合规扫描，不通过即不得进入测试。
4. **红先于绿**：任何新增或修复的门，必须先在 scratchpad 拷贝上证明它能被真实变异打红且
   失败原因精确命中，才允许把它算作有效控制。`--self-test` 不得有任何自我豁免分支。
5. **不得以"最后统一验证"替代过程验证**。若某项确实只能在终态验证，必须在计划中显式登记
   为例外并说明原因，不得默认。

### 2.3 「验一点」验的是合规，不是"代码能不能跑"（Dexter 明确）

**这条必须先说清楚，因为作者上一稿理解错了。** 「做一点验一点」验的是
**这段代码是否满足项目记忆与设计文档的要求**，不是"测试能不能通过"。两者是不同的东西：

| | 合规核对（本规矩所指） | 测试执行 |
| --- | --- | --- |
| 依赖 | 纯静态读源码，**不需要 gradle、不需要 docker** | 需要 JVM 工具链与远端容器 |
| 时机 | 每写完一部分代码立即做 | 阶段性 |
| 分母 | manifest `forbiddenPseudoFixes`、`approvedAssertions`、project-memory assertions、设计原文 | 测试用例 |
| 现在能不能做 | **能，立刻就能** | 需先补 wrapper 与远端接线 |

所以 W00 的合规闸口**没有任何前置阻断，应当第一个落地**。上一稿把 gradle/docker 当成
"做一点验一点"的前提，是作者的理解错误，此处更正。

**测试可执行性是另一件独立的事**（见 W08），且比作者上一稿描述的轻：
Dexter 确认本机 gradle 环境没问题、由 Codex 补 wrapper；Docker 在**远端**，
仓内也**本来就是远端设计**——`scripts/test/r5-remote-testcontainers.mjs` 的文件头注释自己写着
「只把 Docker 的 UNIX socket 转发给本地 JVM 是不够的：Testcontainers 会把容器的远端发布端口
返回给本地 JVM」，`scripts/dev/r5-dev-runner.mjs:61-77` 也是 `ssh` + `docker exec` + SSH 隧道。
真正的缺陷是：`verify.mjs:18` 把 `DOCKER_HOST` 指向一个**本机 colima socket 绝对路径**
（且用户名 `dexter` 与本机 `dextery` 不符），并且 verify **从不引用那个远端脚本**——
即 verify 违背了仓内自己已写明的远端设计。这是接线错误，不是"缺 Docker"。

## 3. 整改范围：九个工作包

包 ID 用中性编号，实际 Roadmap step 命名由 Codex 在详设中提出、Dexter 裁定。
每包给出：范围、为什么必须整改、完成判据、增量验证点（即"做一点验一点"的具体挂载点）。

---

### W00 ｜合规闸口（静态，无前置依赖，必须第一个落地）

> 本包**不需要 gradle、不需要 docker**，纯静态。它就是 §2「做一点验一点」的执行载体。
> 测试工具链的接线在 W08，两者不互为前置。

**范围**
- 修复 5 条假绿控制：`code-layout`（前端无 allowlist、capability tree 无检查）、
  `security-boundaries`（仅覆盖 3/106 operation、2/29 controller，且读的还是 R3 registry）、
  `logging-boundaries`（正则只匹配变量名紧邻赋值）、`database-boundaries`
  （对 `bytea/base64/object_key/bucket_name` 检查命中 = 0，控制不存在）、
  `affected-l2`（0 字节空文件即 PASS，`--list` 全仓 0 命中）
- 删除 `cli.mjs:282` 的 `frontend --self-test` 自我豁免；`code-layout --self-test` 改用仓库拷贝
  而非 `mkdtempSync()` 空临时目录
- `standards-coverage` 增加"被引用的门必须真实可失败"的校验（当前把门换成 `exit 0` 仍 PASS）
- **新建 `PostToolUse` 与 `PreToolUse` 两个 hook**（见 §2.2 第 2、3 条），首批检查项见下
- 砍掉纯关键词伪门（`ui-wireframe-traceability`、`business-terminology-traceability`、
  `codex-self-review`、`claude-review-handoff`、`admin-boundaries` 的中文文案断言），
  按矩阵 schema 降级为 `UNENFORCEABLE_BY_MACHINE` + `reviewChecklistRef`

**为什么必须整改**
这是"做一点验一点"的**执行载体**。§1 证明了 36 条禁止项违反 15 条、62 条 memory assertion
未满足 11 条，而能覆盖它们的机器门接近于零——全靠"实施者读了并遵守"，结果就是本轮的全面偏离。
仅靠再写一遍文档不会改变结果；上一轮的教训正是"设计做了、过程不守、攒到最后跑门"。
同时现有静态门本身不可信（注入违规不红、自测自我豁免、把门换成 `exit 0` 仍全绿），
所以修门与建闸口必须同包完成，否则新规矩会变成第二次形式主义。

**完成判据**
- 五条假绿控制各自有一条真实 scratchpad 变异能打红，且失败原因精确命中具名 code
- 把任一被引用门替换为 `exit 0`，`standards-coverage` 必须变红
- 两个 hook 各有真实 red mutation 证明
- 用本报告 §4.1 的 15 条已知违反做回归：hook 必须能全部命中（这是现成的红夹具，不用另造）

**增量验证点**
每修一条控制立即做该条的红变异；不允许"五条一起改完再统一验证"。

**hook 首批检查项**（全部来自本报告已证实的违反，纯机械、亚秒级）
feature 目录内 `/api/` 字面量；列表列定义中 `title: '操作'`；generated wire 中 `Map<String, Object>`；
前端 `Date.now()`；edge 层 `JdbcTemplate`/`DataSource`；`context.externalSubject()` 审计写入；
路由集是否为 25 个 pageDesignKey 的子集；`ConfigProvider` 是否带 locale；
Table 是否 `pagination={false}` 或无 `total`；跨 owner schema 字面量是否在
`module-dependency-registry` 中有对应边。

**两条硬要求**：(a) 检查项清单必须从冻结文件读取（manifest `forbiddenPseudoFixes`、inventory、
25 pageDesignKey），不得硬编码——别重蹈 `database-boundaries` 硬编码 15 个 migration 文件名的覆辙；
(b) 这是合规闸口不是上下文注入，与 `PROMPT_RECOMMENDS_ONLY` 不冲突，但须在详设中显式说明该区分
并在 memory 中登记新 assertion，不得默默扩大 hook 职责。

---

### W01 ｜契约可解析 + 生成器产出真实类型

**范围**
- 742 处 `#/components/responses/ProblemResponse` 改为跨文件引用（或每个 path 文件自带
  `components.responses`）
- 50 条目标不存在的跨文件 ref 改为真实相对路径
  （`./platform-time.schemas.yaml`×40、`./workspace-iam.schemas.yaml`×7、`./platform-workspace.schemas.yaml`×3）
- **删除 `edge-codegen.mjs:89-90` 的按 schema 名字兜底解析**——兜底正是掩盖问题的那个东西
- `openapi` 门增加真正的递归 `$ref` 解析（约 20 行）
- **生成器为内联 object schema 产出具名类型**，消除 41/146 wire 文件中的 `Map<String, Object>`
- 删除重复的 R3 `contracts/openapi/components/problem.schemas.yaml`（当前按目录字典序，
  名字兜底会优先选中它 —— 一条已上膛的静默降级路径）

**为什么必须整改**
契约声称是 source of truth，实际只对本仓 bespoke 生成器成立，任何交接、第三方 codegen、
Swagger UI、契约测试都无法消费。更关键的是：**契约本身是有类型的**——
`GroupWorkspacePage.items` 在 `components/platform-workspace/group-workspace.schemas.yaml` 中
写为 `items: {type: array, items: {type: object, required: [...], properties: {...}}}`，完整规定。
类型丢失发生在生成器。**跳过这一步，W02 拿到的仍是 `Map<String,Object>`，W05 的字段名问题
也无法被编译器拦住。**

**完成判据**
- 全仓 `$ref` 悬空数 = 0，用独立脚本重算，不采信门的自报
- generated wire 中 `Map<String, Object>` 出现次数 = 0
- 把任一 `$ref` 路径改错，`openapi` 门必须变红

**增量验证点**：每修一批 ref 立即重算悬空数；生成器改完立即重算 wire 中 Map 计数。

---

### W02 ｜前端契约消费接线

**范围**
- 补 `rtk-codegen.config.cjs`（v2 有现成范本，指向已修好的 `contracts/openapi/edge.openapi.yaml`）
- 两个 app 的 `package.json` 加回 `generate` 并挂到 `typecheck`/`build` 前置
- 删除 `OperationsApi.ts` / `PlatformApi.ts` 中的通用 `request(path, init)` 逃生舱，
  改为 typed `injectEndpoints`
- 补 cache tag / `providesTags` / `invalidatesTags`；context 与 authorizationRevision 变化时的失效扇出
- session 从 `useState` 迁入 store；接上从未被调用的 `workspaceSessionEntry`，实现刷新后会话重建
- 补 `*ProblemFeedback.ts`（v2 有 133 行与 248 行两份范本），消除 24+ 处
  `${errorCode}：${detail}` 直出用户
- 消除 16 个 feature 文件的 60–78 处手写 `/api/` 字面量

**为什么必须整改**
generated 产物零消费、`request` 是伪装成 RTK endpoint 的通用逃生舱、返回值 `as T` 硬转，
导致字段名靠猜且**已经猜错**（见 W05）。这也是 `RolesPage` 12 keys 与 registry 11 definitions
已经漂移的直接原因——契约与 UI 之间没有任何机械关联时，补得越多欠得越深。
**必须先于补 surface。**

**完成判据**
- feature 层手写 `/api/` 字面量 = 0
- generated typed endpoint 消费率 > 0 且覆盖全部已实现 surface
- 前端业务模型中 `Record<string, unknown>` / `any` 承载 = 0

**增量验证点**：每迁移一个 surface 的调用即跑一次 hook 增量检查 + typecheck，不允许批量迁完再验。

---

### W03 ｜安全三项（可与 W01/W02 并行）

**范围**
- `WorkspacePasswordResetService` 接入 `WorkspaceOtpRateLimitService`（purpose `PASSWORD_RESET_VERIFY`），
  并把 `:58` 的 `@Transactional` 改为带 `noRollbackFor`（当前 `:66` 的 `attempt_count+1` 会被回滚，
  连计数都不落盘）
- 审计读取继承宿主详情 read 权限：`OperationsAuditHistoryController` 改为先调用宿主 detail 的
  task read（同 scope 与 context 校验）成功后才允许审计读，或 owner reader 签名加入 assignment scope
- `InvitationsPage` 展示的 `mobileNormalized` 改为 `maskedMobile`；edge 改为映射到 generated wire
  而非直吐 owner 内部 readback
- A-3 最后管理员守卫加 advisory lock（当前 `FOR UPDATE` 只锁目标行，双管理员并发禁用可归零）
- A-4 幂等补齐 workspace-iam / extension / platform-asset 三个 owner（当前收 key 后丢弃）
- 幂等重放不得多写审计（`PlatformWorkspaceService.java:65-75` 当前无条件写）

**为什么必须整改**
`/api/public/.../password-reset` 未认证可达、10⁶ 空间可暴力枚举、可作短信轰炸放大器；
审计读只验会话不验授权，同集团空间内可越权；平台后台列表直接展示未脱敏完整手机号——
而仓内明明有 `mask()` 实现并在别处产出 `maskedMobile`。这三条都是外部或跨租户可观测的真实风险，
不依赖任何后续包，应尽早修。

**完成判据**：每条各有一个真实红用例（限流阈值、越权读被拒、脱敏后 readback）。

**增量验证点**：每修一条立即补该条的 focused test 并证明它在修复前为红。

---

### W04 ｜owner 边界与数据形态

**范围**
- 消除 5 条未声明的跨 owner 直读：`StoreCandidateTaskReadService.java:17`（organization 直读
  `workspace_iam.role_assignment` 解析授权）、`BusinessEntityService.java:329` 与
  `OrganizationCommandService.java:114,134,151`（跨 schema 读作为写入前置）、
  `WorkspaceAdministrationService.java:84,89`、`WorkspaceMembershipService.java:29,33`
  （**该类已注入 `OrganizationNodeLookup`/`OrganizationEntityLookup`，API 就在手边没用**）
- `module-dependency-registry` checker 增加代码事实对账：扫描 `libraries/backend/**/src/main/**.java`
  中的 `<otherOwnerSchema>.<table>` 出现，必须在 registry 有对应边（当前 checker 只 `readFileSync`
  那一个 JSON，registry 是纯文档）
- 删除 `OrganizationCommandService.java:57,80,89` 的 `context.externalSubject()` 写入，改为接收 `AuditActor`
- 合同货号 `items_json` JSONB：新增列 + named check + 迁移 + 重复 normalized code typed precondition
  + DROP 旧表；`:131` 的重复判定改为 `strip-lower`
- status 闭集具名 CHECK（18 个 status 列中仅 3 个有、且 0 个具名）；
  同类 normalized name unique（设计点名 brand/tenant/head-company/store，实际只有 brand）
- 8 张 legacy `*_audit` 表：typed precondition + DROP（cutover 已完成，收尾未做）
- `OrganizationHierarchyService` 补 `ORGANIZATION_NODE` 的 audit writer
  （读端已暴露该类型，用户点操作历史永远拿到空列表）
- 集团空间自身（创建/改名/启停）补 audit writer

**为什么必须整改**
模块 owner 主权、事务边界与未来拆分能力被跨 owner 直读破坏，且 registry 与代码之间没有任何
机械对账——这类错误必然复发。货号 JSONB 是设计 §5.1 整行工作缺失。`ORGANIZATION_NODE`
零 audit writer 而读端已上线，是"门绿、契约通、业务空"的典型。

**完成判据**：registry 对账门可用且能打红；`items_json` 迁移后旧表已 DROP 且有 precondition 记录；
每个已暴露的 audit entityType 都有真实 writer。

**增量验证点**：每消除一条跨 owner 直读即跑一次对账门。

---

### W05 ｜写路径修复与 UI 一致性

**范围**
- 字段名对齐（**由 W01/W02 的 typed model 自动强制，不要逐个手改字符串**）：
  `status`→`targetStatus`（0/9 正确率）、`version`→`revision`、`pageAccessKeys`/`actionCapabilityKeys`
  →`capabilityKeys`、新建管理员请求体、`WorkspaceScope` 的 page 对象误当数组
- `BusinessEntityService.java:124` 的 `transitionEntityStatus` 补 `"STORE"` 特判
  （同文件 `:268`/`:275` 已有该写法）
- **antd / UI 一致性——这三条是冻结原文已要求、实施未做，不是新需求**：
  - 设计 §6.2:232「列表不新增操作列；优先使用 admin-ui-foundation、**ProTable**、Descriptions、
    Drawer/Modal 的既有组合」→ `@ant-design/pro-components` 已在两个 app 的 `package.json`
    声明（版本与 v2 完全相同）而 `import` 次数 = 0；列表操作列 8 处；
    `AdministratorsPage.tsx:75` 把**初始密码**放在列表页行内表单里
  - 设计 §3.1:102 与 carry-over inventory §3 均点名 **theme/shell**
    → `find -iname "*theme*"` 返回空；v2 有 `platformAdminTheme.ts` 与 `operationsAdminTheme.ts`
- 无明文但属 `ADAPT` 隐含要求的一组：`ConfigProvider` 补 `zhCN` locale
  （当前列表空态显示英文 "No data"）、`loading={!rows}` 10 处误用改为真实请求状态
  （当前空列表与请求失败都永远转圈）、平台端 7 个列表的 `pagination={false}` 改为服务端分页、
  补业务化 `emptyText`、rowKey 消除 `''` 与 `JSON.stringify(row)` 兜底、
  `window.alert` 改用 `App.useApp()`
- 补 eslint 与 stylelint 并挂到 build（v2 的 build 含 `lint:architecture --max-warnings=0` 与 `lint:style`）

**为什么必须整改**
写路径已经全废而不是"可能漂移"：状态切换字段名正确率 0/9，门店启停前后端各有一个方向相反的
bug（说明从未端到端跑通过一次）。UI 一致性三条有冻结原文可指。
**服务端分页这条与 Dexter 的 seed 裁决直接耦合**：前端所有 Table 都是客户端分页且请求不带 page
参数，seed 补到 55 条也翻不出分页——两项必须一起做。

**完成判据**：全部状态切换与写操作各有一条端到端红→绿证据；`pro-components` 消费率 > 0；
两个 app 各有独立 theme；`ConfigProvider` 带 locale；无 `loading={!x}` 形态。

**增量验证点**：每修一个页面即跑该页的 L2 与 hook 增量检查。

---

### W06 ｜业务能力补齐

**范围**
- 七个 operations 业务 feature 的编辑能力（当前运营后台 **PATCH/PUT = 0 条**）：
  实体编辑、总公司品牌授权 replace、合同编辑与设置失效、组织节点编辑与项目跨大区 reparent
  与分期编辑器、门店编辑与品牌作用域候选、邀请创建、任职撤销、邀请取消/重发
- 动态扩展字段表单（当前三条创建路径都发 `expectedDefinitionVersion` 但 `extensionValues` 硬编码 `{}`，
  是"接了线没通电"）
- 角色切换 **R-15（Dexter 已裁决）**：多任职登录后出选择框 → 进 shell → shell 内常驻角色切换器；
  按 v2 outcome 模型（`HOME`/`SELECT_IDENTITY`/`SELECT_SCOPE`/`EMPTY_WORKBENCH`）实现；
  候选任职须给业务可读名（v2 形如"门店店长（河畔茶里店）"，不是裸 UUID）；零任职须有独立提示态。
  此项扩张既有 session response（加 `outcome` + `candidates`），**不新增 operation，106 分母不变**
- 数据节点候选集改为按当前任职可见范围过滤（当前拉整个集团空间的 `/hierarchy` 再让服务端拒绝）
- 22 surface / 25 pageDesignKey 落位：4 个完全缺失（平台改密、运营改密、门店档案、5 个 `HOME-*`）、
  2 个空壳（`PLATFORM-WORKSPACE-OVERVIEW` 路由被占用；五个 `PG-IAM-*` route 与 column 逐字相同）
- 移除第 23 个 surface `/platform/invitations`（新路由 + 新菜单，违反 `new dashboard or page key`）
- `actionSummary` 与两个 app 的中文文案映射（当前用户看到 `BRAND_STATUS_CHANGED`）

**为什么必须整改**
inventory 21 行标 `ADAPT`，每行 focused evidence 逐词点名 `update`/`invalidate`/`revoke`/
`invitation`/`authorization`/`phase-tree`/`extension-fields`/`five-user-pages`——这些词在 v2s 代码里
**全部落空**，而 `doc/decisions/` 无任何一条把它们标为裁掉。**缺口是无声的，不是被裁决过的。**
22 surface 完整吸收 0/22。

**需 Dexter 裁决**：D-1（是否接受通用 registry 取代五个独立 surface）与 D-2（编辑能力 R5 内闭合
还是分批）——两者是同一件事的两面，建议一起裁；D-3（四个缺失 surface 哪些进 `HANDOFF.md`）。

**增量验证点**：每补一个能力即补对应 focused test 与 L2，不允许攒到包尾。

---

### W07 ｜seed 与 DEV 可用

**范围**
- 实现 seed executor（当前 `scripts/dev/seed:17` 无条件 `REFUSED`，
  而 verify 只登记 `--dry-run` 路径，属假绿）
- DEV 固定 OTP issuer（三条件同时满足才装配：namespace + profile + non-production），
  否则设计的"任职重放邀请接受链"主路径不可执行
- seed fixture 提升为正式 profile 数据（当前消费 `status=PROPOSED_REVIEW_ONLY` /
  `implementationAuthority=false` 的旧文档）
- **数据量（Dexter 已裁决：有列表的实体至少能翻一页）**，按 controller 实测默认 pageSize：
  品牌 / 实际经营租户 / 总公司各 **25**；门店 / 合同（运营端）各 **30**；
  平台管理员 / 运营账号 / 集团空间 / 合同总览 / 组织总览各 **55**
- `cg-boreal` 现为空树，补一条完整 大区→项目→门店 分支
- fixture 中角色与账号补中文业务名（库中 `name`/`display_name` 必填，当前只有 `role-group` 这类 key 与手机号）
- 实体名中不得再写测试用途（"山景无合同店""河畔麦香筹备店"等 8 处），测试语义放 `key` 与 `purpose` 字段
- 补 4 个真实图片 fixture（当前引用的 PNG 在仓内不存在）
- `dev reset` 补前后 readback 与对象命名空间清理；`V2S_DEV_REMOTE_HOST_SHA256` 缺失时 fail-closed
  而非自算；`dev stop` 确认进程退出后才 PASS，MinIO 容器纳入 manifest
- bootstrap 补 owner readback（当前 `AUDIT=PASS; RECEIPT=PASS` 是无条件字符串）

**为什么必须整改**
当前全库只有 1 个 `root` 账号，两个 App 无任何业务数据可点；`scripts/verify` 却全绿。
seed fixture 的中文命名与关系图质量本身不错（零悬空引用），问题是它**只是一份文档**，
且体量按"够跑通"而非"够看懂"设计。

**依赖**：本包依赖 W05 的服务端分页——否则补到 55 条也只是一次性渲染 55 行。

---

### W08 ｜测试与证据

**范围**
- 19/23 已声明的 L2 spec 不存在，须补齐或从 registry 移除（registry 不得声明不存在的 target）
- 两个 app 的 `package.json` 加 `test:l2`，把 `src/tests/l2/` 接进 runner
  （当前 `test` 脚本只跑 `src/tests/architecture/*.test.mjs`）
- `affected-l2` 改为以 `playwright test --list` 输出为分母
- 仅存的 1 个 L2 spec 断言在成功与失败下同真，须重写
- **测试工具链接线**（与 W00 无依赖关系，此处才需要）：补 Gradle wrapper 并让 `verify.mjs:9-13`
  改调 `./gradlew`；删除 `verify.mjs:18` 指向本机 colima socket 的硬编码 `DOCKER_HOST`，
  改为走仓内已有的远端路径——`scripts/test/r5-remote-testcontainers.mjs` 的文件头已写明
  「只把 Docker 的 UNIX socket 转发给本地 JVM 是不够的」，而 verify 从不引用它。
  Docker 在远端、本机不装；`V2S_DEV_REMOTE_HOST` 与 SSH 隧道机制
  （`r5-dev-runner.mjs:61-77`）已存在，接上即可
- `r5-dev-environment.mjs:30` 在 `V2S_DEV_REMOTE_HOST_SHA256` 缺失时**用 host 自己算出来填上**，
  `:44` 再拿它比对——默认路径下该校验恒真，声明的负面控制永远打不响；须改为 fail-closed
- 补 testId / locators 模块（v2 有 17 个 `automation/locators.ts` 与 430 处 testId，v2s 31 处、0 个模块）
- 敏感字段"注入候选 → 断言持久/readback/Modal 三处均不出现"的 focused evidence（当前一个都没有）
- evidence assembly 的 104/38/55/11 改为 106/39/56/11
- `project-memory/kernel/01` 更新（**当前仍写 R2/R3 期状态、"禁止 W1 业务实现与 runtime"，
  而 Roadmap 已是 `CURRENT_STEP=R5`；它是每个 fresh 会话的入口**）
- `PLATFORM-BLUEPRINT.md:19` 的"五个 project skills"更新为 8
  （`provider-free-context` 门当前因此为红）
- Roadmap 与设计 frontmatter 的三方状态矛盾收敛（H-1/H-2/H-3）

**为什么必须整改**
`kernel/01` 陈旧这条比表面严重：任何按 `AGENTS.md` 恢复上下文的新会话，读到的都是 R3 设计期状态。
L2 声明了不存在的 target 且无 runner 会跑，是"声明即完成"的假绿。

---

### W09 ｜全范围终验

**范围**：全部 W00–W08 完成后，一次性 whole-scope implementation review。
不得把中途 phase evidence 伪装为中途 GO；不得按 Journey/模块/文件/App/单项 gate 拆成独立 review。

---

## 4. 分母明细（整改 Roadmap 的可核查附录）

### 4.1 `forbiddenPseudoFixes` 违反的 15 条

| 单元 | 禁止项原文 | 证据 |
| --- | --- | --- |
| U01 | `self-test-only green` | 控制基线 evidence 全表 8 行红证明均为 `--self-test PASS` |
| U01 | `keyword semantic verdict` | `verify-gates/cli.mjs:236-247` 等 5 个门为中文子串匹配 |
| U01 | `pending control after protected work` | P1 未闭即入 P2/P3/P4 |
| U02 | `manual client HTTP shapes` | 16 文件 60–78 处手写 `/api/` |
| U02 | `generic business error collapse` | `${errorCode}：${detail}` 直出；`EDGE_PROBLEM_CODES` 零 import |
| U03 | `untyped JSON map persistence` | 41/146 wire 文件含 `Map<String, Object>` |
| U04 | `receipt header validation only` | workspace-iam / extension / platform-asset 三 owner 收 key 后丢弃 |
| U04 | `sensitive candidate only asserted outside persisted/readback/modal triplet` | 该三处断言 focused test 一个都没有 |
| U04 | `direct externalSubject audit write` | `OrganizationCommandService.java:57,80,89` |
| U06 | `feature handwritten HTTP client` | `request(path, init)` 通用逃生舱 |
| U07 | `new dashboard or page key` | `/platform/invitations`（`PlatformApp.tsx:24,32,42`） |
| U07 | `entity list operation column` | 8 处 |
| U07 | `raw JSON/technical audit details` | `STORE_CONTRACT / <uuid>`、`BRAND_STATUS_CHANGED`、`fieldLabels[key] ?? key` |
| U07 | `page-local HTTP or overlay primitive` | page-local HTTP |
| U08 | `undiscovered L2/L3 declaration` | 19/23 不存在；`--list` 0 命中 |

**未违反的 21 条（如实登记）**：edge JDBC 0；audit empty JSON 0；前端 `Date.now` **0**；
无 app 内重复实现 foundation primitive；两 app session/store 完全独立；grant 只存 hash 从不展示；
public 静态读确实免鉴权；`dev start` 绝不 seed；直接 INSERT 仅 bootstrap 4 行且在 allowlist 内；
audit 是 Modal 不是 Drawer；契约按 family 拆分无巨型单文件；两个 audit operation 是 scalar face；
extension 关联表未被重建；无新增 timestamp 业务事实。

### 4.2 `approvedAssertions` 未满足 / 部分满足 17 条

未满足 10：`generated wire is the only frontend/backend boundary`、
`audit facts remain owner-local and task reads inherit host access`、
`contract items become a normalized JSONB array`、`22 surfaces and 25 pageDesignKeys remain fixed`、
`pages carry/adapt v2 before inventing new UI`、`eight baseline controls precede every guarded work item`、
`only mechanical rules become gates and each has a real red mutation`、
`no control can remain pending inside this package`、`seed is explicit and owner-command first`、
`business and cleanup are separate completion facts`。

部分满足 7：security six（A-2/A-3/A-4 半实现）、each app owns router/store/session/API facade
（theme 缺、router 内联、session 在 `useState`）、server time and idempotency originate outside
feature components（幂等 key 在 query 函数体内现场生成）、operation history in twelve existing details
（store-profile 无宿主页）、platform-asset owns images **and videos**（视频写侧被拒）、
mutation/receipt/audit share REQUIRED transaction（幂等重放多写审计）、
`contract sources are capability/face/schema-family files`（成立但契约不可解析）。

### 4.3 project-memory 未满足 11 条

作者亲验 3 条：`PROMPT_RECOMMENDS_ONLY`（skill 分母 5→8，门实测红）、
`kernel/01` 陈旧（`R1_ONLY`/`NO_R2_W1` 仍描述 R3 设计期状态）、
`MODULE_OWNER_SOVEREIGNTY`/`TASK_READ_JOIN`/`OWNER_RECHECKS_COMMAND`（跨 owner 直读）。

子 agent 报告、作者未逐条复验（标 `AGENT_REPORTED`）8 条：`MACHINE_GATES_MECHANICAL_ONLY`、
`SEMANTIC_QUALITY_INDEPENDENT_REVIEW`、`PRODUCTION_RED_MUTATION_REQUIRED`、
`GATE_ADMISSION_THREE_QUESTIONS`、`VERIFY_MINUTE_BUDGET`、`SMALL_BATCH_FREEZE_REVIEW`、
`BUSINESS_CLEANUP_SEPARATE`、log-first 首败诊断。

## 5. 双审对照与作者自我更正

**一致确认 8 项**：generated 零消费、五个用户页塌缩、`Problem.detail` 直出、货号仍是关系表、
商业集团审计越界、跨 owner 直读无对账、seed executor 不存在、seed 消费废弃 fixture。

**Codex 独有、作者复验成立 5 项**：审计越权、幂等重放多写审计、
`WorkspaceMembershipService` 已注入 lookup 却直查表、视频写侧被拒、evidence 分母陈旧。

**Claude 独有 11 项**：契约悬空引用与生成器类型塌缩、重置 OTP 限流、手机号泄漏、
写路径全废与门店死路、多任职死锁、antd 违反冻结设计、v2 吸收率、假绿控制与 L2 与门不可跑、
§4 全部三个机械分母。

**冲突裁定 2 项**：(a) 审计是否有宿主授权 → **Codex 对**；
(b) `openapi-contracts`/`security-boundaries`/`frontend-architecture` 门态 → **Claude 对**
（PASS 属实，但三者都证明不了各自声称的命题）。

**作者自我更正**：此前向 Dexter 转述"六个 owner reader 宿主鉴权先行"，采信了子 agent 措辞而未区分
"存在性检查"与"授权检查"。存在性只回答"这个实体在不在本集团空间"，不回答"这个会话能不能看它"。

**根因差异值得记录**：Codex 报告了 4 个门是红的；Claude 实测发现绿的那些里至少 5 个是假绿。
这不是能力差异，是**自审无法怀疑自己建的门**——这正是独立盲审存在的理由。

## 6. 需 Dexter 裁决（7 项）

| # | 事项 | 建议 |
| --- | --- | --- |
| D-1 | 是否接受通用 `OperationsPageRegistry` 取代 v2 五个独立业务 surface | **不接受**。代价是 1,671 行退化成 230 行，丢掉的全是编辑能力 |
| D-2 | 七个 operations 业务 feature 的编辑能力：R5 内闭合还是分批 | 与 D-1 是同一件事的两面，**建议一起裁** |
| D-3 | 四个完全缺失 surface 哪些进整改范围、哪些进 `HANDOFF.md` | — |
| D-4 | 商业集团初始化审计归 organization 还是 platform-workspace | 采纳实施的单源简化并同步改设计，但须解决字段越界 |
| D-5 | `extension_definition` 丢失 `workspace_uuid` 与复合 FK | 简化可接受，但设计 §5.1 的 `entity_ref_text` 规则因此无法遵守，需定谁改 |
| D-6 | 业务列表页二级索引本轮做不做 | **推 `HANDOFF.md`**，DEV 数据量下零收益 |
| D-7 | P1 未闭即入 P2/P3/P4 的顺序偏离是否可接受 | severity 归 Dexter |

已裁决、无需再问：**R-15**（多任职选择时机，W06）；**seed 量级**（W07）；
**做一点验一点的过程规矩**（§2）。

## 7. 授权边界

本件为静态只读诊断与整改范围清单，**不是** R5 的 `REVIEW_TARGET=IMPLEMENTATION` 全范围终验
（未附 manifest Part B/C/D 命中对照表）。不授权修复、实施、构建、DEV、seed/reset、数据操作
或下一 Roadmap step。

`UNVERIFIED`：backend ArchUnit 与 route registry reverse coverage 两条控制需在有 gradle + docker
的环境 fresh 复跑后才能定性；已执行 migration 的字节层不变性无 git 基线可证；
v1 的角色切换实现本轮未能从主干树确认。

下一步：Codex 据本件建立整改 Roadmap，产出详设与实施计划；经 Claude 评审与 Dexter 接受后
才恢复实施。
