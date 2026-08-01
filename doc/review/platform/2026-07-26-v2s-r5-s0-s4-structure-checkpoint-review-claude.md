---
title: R5 S0-S4 内部代码结构整改 checkpoint Claude 独立复核
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-26
reviewTarget: R5_S0_S4_STATIC_STRUCTURE_REMEDIATION
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
blindReviewSource: doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-remediation-adversarial-review-round-1.json
blindReviewVerdict: NO_GO(M=2/S=1/N=1)
reviewedPlanSha256Prefix: 306c596fd65798c2
priorClaudeGoPlanSha256Prefix: d5ca6bf50e691dd2
authorizationBoundary: STATIC_STRUCTURE_CHECKPOINT_ONLY_NOT_R5_ACCEPTANCE_NO_DEV_NO_SEED
---

# R5 S0-S4 结构整改 checkpoint Claude 独立复核

## 0. 结论

```text
VERDICT=NO-GO
M=4  S=6  N=3
```

一句话:**结构搬迁本身是干净的、分母零漂移、证据边界总体诚实——但 S0 自己声明"随 S1-S3 补齐"的那套防复发控制至今没建成,于是 S1-S4 的绿灯有一部分是空转;前端 S2/S3 的完成判定没达成却被证据措辞改写成达成;另有 5 条契约外活端点长期暴露而唯一能拦它的门是单向的。**

必须先说清楚做对了什么(修复时不要连坐):24/24 controller 落位 `edge/<face>/<capability>` 且 app 根零 `.java`;104 catalog operation **0 缺失 0 改写**;cookie 解析真正收敛到 2 个 `SessionResolver`(全仓 `getCookies` 仅剩这 2 处、21/21 接入零绕过);edge 内 `IllegalArgumentException`/`ResponseStatusException` 抛出 0 处;edge 内 JDBC/repository 0 命中;`Date.now()` 造业务时间已清零;逗号 TextArea 编辑闭集已改为 `Select` 闭集;裸 JSON detail drawer 已清除;`affected-l2` 的红被诚实保留且无 stub 伪绿。

## 1. 会话出处与方法

续接会话,如实声明。我本体亲读全部 24 个 controller 中的代表、两个 App 与 registry、ArchUnit、`EdgeRouteRegistryCoverageTest`、security 门源码,并 fresh 复跑门与 self-test;另派三路只读证伪 agent(后端职责、前端 registry、门与 self-test),其变异实验全部在 scratchpad 拷贝完成。**本仓零写入**(除本文件)。未启动 DEV、未 seed/reset。四项盲审发现我逐条重开 owning source,**未转述采信**,并对其中两条做了实质修正。

## 2. 分母核验(交办第 5 项)——全部零漂移

我用独立脚本重算:`operations` **104** 唯一;face **38/55/11**;owner **41/33/10/10/5/3/2**;`scenarioOperationCrosswalk` **32**;`frontend-asset-carryover-manifest` surfaces **22**、pageDesignKeys **25**(12 `PG-*` + 5 `HOME-*` + 8 platform);`r5-u01-edge-placement-resolution.json` closure 104 与 face 分布逐字吻合。24 个 controller 与整改计划 §4.2 映射表逐行对上。**分母未被本次整改触碰。**

## 3. 四项盲审发现的独立裁定

| 盲审 | 我的裁定 | 关键修正 |
| --- | --- | --- |
| M-01 controller 残留 servlet/手写 wire | **成立,维持 M**(见 M-1) | 盲审规模低估一个数量级:不是"前两份 session controller",是 **21/24**;并遗漏 `OperationsContractController.java:33` 第二处 `Object`。同时盲审未给 cookie 收口与 typed Problem 的分——这两项确已达成 |
| M-02 operations generic registry 违反 capability-first | **成立,维持 M 且更重**(见 M-2) | "动态推导 columns"**不成立**(列来自静态 `columnsByPage`);Drawer 是 4 个不是 3 个;`OperationsApp` 也不只渲染 registry(登录/公开入口已独立)。但盲审漏报三项更实质的:`OperationsPageRegistry.tsx:72` 按 JSON key 拼 UI 仍在、5 个 `PG-IAM-*` 渲染完全同构、**两个 app 根本没有路由层** |
| S-01 security self-test 假红 | **成立但定性须纠正,判 S**(见 S-1) | 盲审说"变异后仍 PASS…属假红"。实测:`contracts/openapi/edge.openapi.yaml` 中 `x-consumer-faces` 出现 **0 次**,该变异是 **no-op**;而 self-test **当前就以 `exit 1` 大声报红**(`R4_GATE_SELF_TEST_RED_NOT_DETECTED:security`)。**这不是假绿**,没有任何 GO 建立在它之上;base 门本身强壮(7 类真实输入变异全部真红且错误码精确) |
| N-01 affected-l2 如实未完成 | **成立,维持 N,证据诚实** | fresh 复跑确红(`R5_AFFECTED_L2_TARGET_MISSING`);我独立重算 registry:25 surface 行、23 个 distinct test target、缺 18 存 5,逐个 `existsSync` 复核**无空 stub 无占位**;S0 baseline 的数字与我重算精确一致,且明写"不得由 path-only stub 转绿" |

## 4. Findings

### M(4 项)

**M-1 职责修复未随迁移完成,违反计划 §4.1.1 与其"不得先搬后修"的自订禁令**
- owning:`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/**`
- 证据:①**21/24** controller 的 handler 方法直收 `HttpServletRequest`(`OperationsOrganizationController` 单文件 37 处);②**70 个 inline record 散在 18/24 文件**;③`Object` 返回 3 处 2 份(`OperationsOrganizationController.java:60,61`、`OperationsContractController.java:33`);④字符串闭集 ≥9 份(`OperationsOrganizationController.java:61` 的 `Set.of("BRAND","TENANT","HEAD_COMPANY")`、`OperationsWorkspaceLoginEntryController.java:35-38` 等);⑤generated wire 类型体系 0 建立——`edge/generated/` 里根本没有 request/response 类型,24 个 controller 中仅 `PlatformCommercialGroupController:3` 导入 1 个 generated enum;⑥另有 40+ 个 owner `XxxService.Nested`/`XxxReadback` 直接充当 wire 返回类型。
- 影响面:§4.1.1 逐条点名禁止的形态仍在;wire 形状由 24 份手写 record 而非契约决定,S5 的 contract 对账将无锚点。
- 最小修复:补 argument resolver 消除 servlet 类型穿透(cookie 语义已在 resolver,这只是最后一层语法糖);闭集改 typed constant;3 处 `Object` 按 catalog response schema 定型;generated wire 体系与 S5 contract 对账同批完成,但**必须先有门拦着**(见 M-3),否则 §4.1 约束 1 形同虚设。

**M-2 前端 S2/S3 完成判定未达成,且证据措辞把判定改写成达成**
- owning:`apps/frontend/*/src/**`、`doc/evidence/platform/2026-07-26-v2s-r5-code-structure-s0-baseline.md:85,89`
- 证据:①**S3 判定"17 key 均有明确 feature 或 `CARRY_ROUTE_BOOTSTRAP_ONLY` app route" → 实测 11/17**:`PG-STORE-PROFILE` 与 5 个 `HOME-*` 共 6 个 key 零承载;②22 surface 实测独立承载 10、generic 兜底 6、模糊 2、**完全缺失 4**;③**两个 app 完全没有路由层**——`react-router` 在两个 `package.json` 中声明但**全仓 0 import**,用 `useState` 三元链切页,故 `CARRY_ROUTE_BOOTSTRAP_ONLY` 这一 disposition 当前**无从满足**;④**S2 判定"10 platform surface 均有归属" → 实测 9**(`PLATFORM-PASSWORD` 无承载),而 evidence:85 写 "its **nine** existing capability surfaces",**用措辞把分母从 10 改成 9**;⑤**幂等 6/22 用 lifecycle**,evidence:89 把"app client 给每个非安全请求补一个随机 `ui-<uuid>`"表述为 "closes the former easiest-path omission"——随机键**每次重试都是新键,零重放保护**,与 §4.1.1 要求的 lifecycle 稳定重放键语义相反;⑥`OperationsPageRegistry.tsx:72` 仍 `Object.entries(readback).map(...)` 按 JSON key 拼 UI 并把原始 key 当中文标签,是 §4.1.1 该禁令的现存实例;⑦11 个 feature 目录**全部只有 `ui/`**,`api/`/`model/`/`automation/`/`index.ts` 各 0 个;generated facade 全仓零业务 import(死代码);⑧5 个 `PG-IAM-*` 指向同一 URL、列定义逐字相同。
- 可复现失败:`RolesPage.tsx:23` 已可授予 `PG-STORE-PROFILE`,授予后 `OperationsApp.tsx` 以原始 key 作菜单名、registry 返回"没有已批准页面"——**当前即可复现的断链**。`RolesPage`/`AdministratorsPage`/`WorkspaceAdministrationPage` 三处**无 expectedVersion 的创建**配随机幂等键:超时重试必然重复建实体。
- 最小修复:补 `PG-STORE-PROFILE` 与 5 首页承载(或按 manifest `CARRY_ROUTE_BOOTSTRAP_ONLY` 建真实 route);引入路由层否则该 disposition 不可满足;三处无版本创建改走 lifecycle 稳定键;`:72` 改按 typed readback 字段渲染;evidence 的两处措辞改回 manifest 分母(10 而非 nine;lifecycle 而非 transport 随机键)。**证据措辞改写判定这一项本身即为独立缺陷,不因代码补齐而自动消失。**

**M-3 §6 防复发控制链未建成,导致 S1-S4 的部分绿灯是空转**
- owning:`apps/backend/.../src/test/java/architecture/BackendModuleBoundariesTest.java`、`tools/verify-gates/cli.mjs`、`tools/code-layout/cli.mjs`
- 证据(均经真实 red mutation,非读码推断):①**ArchUnit 只落实 1/3**——`EDGE_CONTROLLERS_DO_NOT_READ_SESSION_COOKIES`(`:35-37`,只 ban `Cookie` 类,不含 `HttpServletRequest`)有真 red fixture;**"capability package 单向依赖"整条不存在**;**"edge 禁 JDBC/repository"整条不存在**;②**frontend-architecture 只落实 2/3**——跨 feature 私有 ui import 与裸 `fetch` 两条真红已验;**"catalog required mutation 必须经 lifecycle idempotency"整条不存在**,变异证明:删掉 registry 里全部 4 个 `lifecycle.getIdempotencyKey()` → 门仍 **PASS**;③**code-layout 对 backend app 根不设防**,变异证明:把一份 controller 复制回 `com/catering/v2s/app/StrayController.java` → `CODE_LAYOUT=PASS`;把整个业务页(Table+Form+Drawer+POST)复制进 `src/app/BrandTable.tsx` → 同样 PASS。
- 影响面:S1 完成判定"ArchUnit 通过"之所以绿,是**因为规则不检查计划要求它检查的东西**——这正是 manifest Part 0.1 的假绿模式。代码残留可在 S5 补,缺失的门保证下一轮同样退化无人拦截,直接落空 Dexter"以后不能再让开发 agent 犯这个错误"的要求。
- 公道话:S0 baseline `:52,:53` **如实**把 frontend-architecture 与 ArchUnit 标为 `PENDING OWNER MIGRATION`,并写明"须随 S1-S3 的源码搬迁同批激活"。**声明是诚实的;问题是 S1-S3 已提交而激活没发生**,前置控制的承诺被逾期。
- 最小修复:补 ArchUnit 两条规则(servlet API 全面禁令 + edge 禁 JDBC/repository + capability 单向依赖,`session` 需显式豁免——16 份 controller 依赖 `<Face>SessionResolver` 是设计使然)各配真 red fixture;frontend gate 补幂等断言;code-layout 的 backend app 根改**白名单**(只允许 `bootstrap/configuration/edge/generated`),现为黑名单六个目录名。

**M-4 5 条契约外活端点长期暴露,且唯一能拦它的 coverage test 是单向的——违反"x-consumer-faces 是暴露面单一真相"红线**
- owning:`apps/backend/.../app/edge/operations/session/OperationsAuthenticationController.java`、`apps/backend/.../src/test/java/edge/EdgeRouteRegistryCoverageTest.java:66-80`
- 证据:代码解析得 109 条 `(method,path)`,catalog 104 条**全部存在**(零缺失),但另有 **5 条不在 104 分母、也不在 `contracts/openapi/` 中**:`POST/GET /api/operations/auth/{password-login,session,context,logout}` 与 `GET /api/platform/group-workspaces/administration`。它们带 `@RestController`,是**活路由**;前端全仓 0 引用(孤儿)。其中 `/api/operations/auth/password-login` 是**无 `groupWorkspaceKey` 作用域的运营登录端点**,与 R5 冻结的 workspace-scoped 登录模型(`/api/operations/group-workspaces/{key}/password-login`)并存,构成同能力双入口。
- 机制根因(我独立发现,盲审未报):`EdgeRouteRegistryCoverageTest` 是真测试(起真 Spring + Testcontainers,非文本检查),但只断言 `expected(registry) ⊆ runtime`(`missing.isEmpty()`),**不断言 `runtime ⊆ expected`**——按定义无法发现契约外的多余路由。而本可承担该断言的 `EdgeOperationRegistry.java`(117 行、含完整 104 条 face 映射)**全仓 0 个 Java 消费者**,是死代码。
- 影响面:`AGENTS.md:17`/`PLATFORM-BLUEPRINT.md:11` 的红线是"`x-consumer-faces` 是 HTTP 暴露面的单一真相";5 条未声明端点(含一条未认证登录入口)使该红线当前不成立,且无门可测。
- 最小修复:`EdgeRouteRegistryCoverageTest` 增反向断言(runtime 路由集减去 error/actuator 白名单后必须 ⊆ registry),并把这 5 条端点按 S5 retirement 清单显式退役或登记例外。这是**分钟级、纯机械**的补强,且直接消灭一整类未来漂移。

### S(6 项)

| # | owning / 位置 | 一句话 | 需 Dexter |
| --- | --- | --- | --- |
| S-1 | `tools/verify-gates/cli.mjs:68-90` vs `:246-249`;`contracts/policy/r4-gate-catalog.json` R4-G01;`tools/verify-gates/red-fixtures/README.md` | security self-test 变异 `contracts/openapi/edge.openapi.yaml`(该文件 `x-consumer-faces` 出现 0 次 ⇒ **no-op 变异**),而 base 门读的是 `paths/platform-admin/*.paths.yaml`;self-test 当前 `exit 1` 大声报红。**非假绿**(base 门 7/7 真实变异真红),但 gate catalog 仍登记其为 ACTIVE、red-fixtures README 声称覆盖 "consumer-face metadata"(失实)、S0 evidence 只报 base PASS 未披露 self-test 已红。最小修复:变异对象改为 base 真读的输入(如 route registry 或 R3 path fragment),同步修正 catalog 与 README | 否 |
| S-2 | `tools/verify-gates/cli.mjs:214`;`OperationsAuthenticationController.java:21` | **`logging` 门当前红且两份 evidence 均未披露**:`R4_LOGGING_SENSITIVE_LITERAL` 命中的是 cookie **名称常量** `private static final String COOKIE = "V2S_OPERATIONS_SESSION";`,由裸正则 `/(password|otp|token|cookie|authorization)\s*[=:]/i` 误伤。这既是未披露的红,也正是 CLAUDE.md 禁止的"用关键词匹配把语义伪装成 checker"。最小修复:正则收窄到值侧字面量,并把该红登记进 evidence | 否 |
| S-3 | `tools/verify-gates/verify.mjs:8-15` | `scripts/verify` 含 `U10-affected-l2` ⇒ **当前端到端必红**,两份 evidence 均未点明;且其 command list **不含** `code-layout`/`security-boundaries`/`logging`,而 §6 把 `code-layout` 定为 S0 前置——前置门不在唯一聚合入口,只靠人工单跑。最小修复:evidence 补一句"`scripts/verify` 因 affected-l2 端到端不可通过";把 code-layout 纳入 verify | 否 |
| S-4 | 方案文件 sha `306c596fd65798c2`(我 Part 2 给 GO 的是 `d5ca6bf50e691dd2`) | **已 GO 的方案在 GO 之后被静默修订**:§6 第 4 条从"新增 `project-memory/pitfalls/` 条目并接入 routed anchor"改为"只以蓝图约束,待未来治理 batch 再提升"。**技术理由成立且纪律正确**——`required-inventory.json` 是独立冻结分母,checker 明令拒绝未登记的 active memory(我方 agent 已在 scratchpad 独立复现 `PROJECT_MEMORY=FAIL: extra active memory`),Codex 拒绝篡改冻结分母是对的。但:①修订未在 intake 或 evidence 中披露,GO'd 字节 ≠ 当前字节;②Dexter"不管是项目记忆还是啥"的强制约束要求目前只由蓝图 §14 单点承担,治理 batch 未排期。最小修复:披露该修订;由 Dexter 决定是否排治理 batch 以放开 inventory | **是** |
| S-5 | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md:120` vs `:131-136` | 状态块写 `R5_IMPLEMENTATION_AUTHORIZED=true`,而"Current post-R4 status"段落在同一句里**引用该块为唯一真相却写成 `=false`**,并据此说"下一步只能等待 Dexter 精确授权"。该文件是唯一授权 owner,fresh 会话读到此段会得出相反结论。最小修复:该段落更新至现状(历史段已标 superseded,不受影响) | 否 |
| S-6 | `tools/code-layout/cli.mjs:8-15` | backend app 根用**黑名单**(`pages/components/shared/common/hooks/utils`)而非 §6.1 要求的**白名单**(只允许 `bootstrap/configuration/edge/generated`);当前树恰好合规,但新增 `service/`、`dto/` 等任意目录不会红(与 M-3③ 同源,单列以便一次改全) | 否 |

### N(3 项)

| # | 一句话 |
| --- | --- |
| N-1 | S0 baseline `:54` 写 "routed pitfall anchor / PENDING S4 / must be added before R5 closure",与同文件 `:90` 及方案 §6.4 的"推迟到未来治理 batch"直接冲突——会误导后续 agent 在 S4 去动冻结分母。改 `:54` 与 `:90`/§6.4 对齐 |
| N-2 | 死代码登记:`EdgeOperationRegistry.java`(117 行)0 Java 消费者、`cli.mjs:51-62` 的 `contractOperations()` 全仓无调用者、`tools/r3-frontend-boundaries/` 空目录。前两者随 M-4/S-1 修复自然回收 |
| N-3 | `frontend-architecture` 门仍为 `src/main.js` 的存在性把关,而 Vite 实际加载 `main.tsx`,`main.js` 已是 R3 历史 evidence 快照(门内注释自陈)——门在为非运行文件把关 |

## 4.5 评审者自我更正:M-2 的判定锚是我上一轮定错的

复核完成后我重新审视 M-2,必须更正其中一半:

我在 Part 2 复核里把 M-02 的修复批准为"改锚 manifest 的 22 surface / 25 pageDesignKey",**这是给一个重构包挂了一个完备性分母,是错的**。重构包只能被这样判定:"已存在的东西是否搬到了正确形状 + 有没有回归";"东西是否都存在"是 R5 completeness,属 S5/U12。`PLATFORM-PASSWORD`、`OPERATIONS-PASSWORD`、`PG-STORE-PROFILE` 与 5 个 `HOME-*` 从来没被建过——重构搬不动不存在的东西。

因此 M-2 应拆为两部分:
- **属结构、留在本包(维持 M)**:generic registry 以一张表驱动 11 个 PG key、5 个 `PG-IAM-*` 渲染逐字同构、两个 app 无路由层、11 个 feature 全部只有 `ui/`、generated facade 死代码、`OperationsPageRegistry.tsx:72` 按 JSON key 拼 UI、幂等 6/22 未走 lifecycle。这些是**形状缺陷**,与存在性无关。
- **属完备性、移交 S5(降为登记项)**:6 个 pageDesignKey 无承载、`PLATFORM-PASSWORD` 无承载。这些不该作为 S2/S3 的完成判定。

这条更正也解释了证据为何开始软化措辞(`nine existing`):**一个必须靠改写措辞才能宣称达成的判定,本身就是缺陷判定**。软化措辞仍是独立缺陷(不因判定错而免责),但根因有我一份。S2/S3 的完成判定应改写为:"存量 surface 全部落 feature 目录、零 generic 兜底、路由层存在、mutation 全部经 lifecycle";不含"所有 surface 都存在"。

## 5. 方案合理性(结构层)

结构选型本身仍是长期正确的,我 Part 2 的判断不变:`edge/<face>/<capability>` 与 `libraries/backend/<owner>` 是与 v6/v7 演进同构的两条正交轴(v7 冻结 5 个契约 face、v6/v7 冻结 22 个 owner 域),未来触发拆分时可成对抽出。`publicentry` 规避 Java 保留字合理。本轮的问题**不在选型,在执行完成度与控制激活**:计划把"控制先修真红、再作 S0 前置"写得很清楚,S0 也诚实地标了 PENDING,但 S1-S3 在控制未激活的情况下先行完成了搬迁——这恰是 §3.2 反思过的"先让功能有路由、再谈稳定承载"的同一个错误换了对象。

## 6. 授权边界

本 NO-GO **仅评价 S0-S4 静态结构整改**,既不接受完整 R5 implementation,也不构成其拆分验收;不授权 DEV、seed、reset、动态执行、新业务能力、contract/schema 行为或新 Journey。四个 M 与六个 S 均在既有 R5 implementation 授权内可修复,**仅 S-4 需要 Dexter 裁决**(是否排治理 batch 以放开 `required-inventory`,从而让"项目记忆"这一环真正落地)。修复后仍须在 S5/U12 完成全部动态 evidence 后,由唯一的 R5 whole-scope implementation review 一次性验收;本 checkpoint 的结论与证据并入该次分母。
