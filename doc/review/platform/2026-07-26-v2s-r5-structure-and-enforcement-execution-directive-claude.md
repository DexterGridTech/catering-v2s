---
title: R5 结构与防复发一次性执行指令(Claude 代 Dexter 决策)
type: review
subtype: execution-directive
status: DELIVERED_FOR_CODEX_EXECUTION
reviewer: Claude
decisionBasis: Dexter 2026-07-26「你帮我做决策，现在还是早期，做什么都是成本最低的。我只要最优最长期的方案」
createdAt: 2026-07-26
supersedesRecommendation: doc/review/platform/2026-07-26-v2s-r5-enforcement-and-sequencing-recommendation-claude.md
sourceFindings: doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-checkpoint-review-claude.md
authorizationBoundary: 在既有 R5_IMPLEMENTATION_AUTHORIZED=true 内执行；不新增业务能力、Journey、contract 语义、schema 行为；DEV/seed 仍按 Phase D 门槛
---

# R5 结构与防复发:一次性执行指令

## 0. 这份文件的性质

Dexter 授权我代为决策并直接产出给 Codex 的执行指令。下述 D1-D6 是**已决事项**,Codex 按 Phase A→D 顺序执行,不需要逐项再确认;只有明确标注 `需 Dexter` 的才回头请示。checkpoint review 的 4 M / 6 S / 3 N 全部并入本指令,不另行处置。

判断基准是 Dexter 的原话:**现在是早期,改动成本最低,要最优最长期的方案**。因此本指令不追求最小改动,而追求**让后续 22 个 owner 域、5 个契约面长出来时不必返工的形状**;但仍受既有右尺寸标尺约束(分钟级、零基建、门只判一行机械事实、不建 CI 平台类生产化设施)。

## 1. 已决事项

### D1 `required-inventory.json` 保持冻结,不为补 pitfall 开治理 batch

冻结分母本身就是"project-memory 不能被悄悄加料"成立的原因;为加一条"不要悄悄堆积"的记忆去解冻它,方向是反的。记忆与蓝图是软层,机器门才是承重层。Codex 此前发现加不进去后选择停手并如实登记,**这个反射是对的,予以确认,不要覆盖**。蓝图 §14 已承载该禁令,足够。将来若因其它原因开治理 batch,该 pitfall 可搭车,不单独开。

配套必做:①披露方案在 Claude GO 之后被静默修订(`d5ca6bf5…` → `306c596f…`,§6 第 4 条被移除)——修订实质我同意,但不披露不能成为惯例;②改掉 `doc/evidence/platform/2026-07-26-v2s-r5-code-structure-s0-baseline.md:54` 的 "PENDING S4 / must be added before R5 closure",它与新 §6.4 冲突,会误导后续 agent 去动冻结分母。

### D2 守卫先行:控制不得以 PENDING 跨越它所守卫的工作

这一轮的根因不是少了一条记忆,是**守卫被排在了它要守卫的工作之后**,而且这已经是第二次(§3.2 反思过"先让 operations 有路由,置于先建立稳定承载之前",这次换成"先搬迁,门稍后激活")。散文级顺序约束对 agent 无效。

因此:蓝图 §14 增一条硬停——**一个控制不得以 `PENDING` 状态跨越它所守卫的工作;要么在该工作开始前 red-verified,要么该工作等待**。并给它机械形态:S0-style baseline 的控制表状态收敛为闭集 `ACTIVE_RED_VERIFIED | OUT_OF_SCOPE_THIS_PACKAGE`,**不允许 `PENDING <本包内后续 step>`**。这是纯字符串闭集判定,并入既有 evidence/granularity 校验,不新建 checker。

### D3 S2/S3 判定锚更正(Claude 上一轮定错,由 Claude 更正)

上一轮我把 S2/S3 这个**重构包**挂到了 22 surface / 25 pageDesignKey 的**完备性分母**上。重构搬不动从未建过的东西(`PLATFORM-PASSWORD`、`OPERATIONS-PASSWORD`、`PG-STORE-PROFILE`、5 个 `HOME-*` 从未存在),判定不可达才逼出证据措辞软化(`nine existing`)。**不可达的判定是缺陷判定,根因有我一份。**

更正后的判定分离为两类,分别归 Phase C 与 Phase D:
- **形状判定(Phase C)**:存量 surface 全部落 feature 目录、零 generic 兜底、路由层存在、mutation 全部经 lifecycle、feature 具备 `api/model/ui/automation`;
- **完备性判定(Phase D)**:22 surface / 25 key 全部有承载。

措辞软化本身仍是独立缺陷(不因判定错而免责):evidence 中把 10 写成 `nine existing`、把"必须经 foundation lifecycle 取稳定重放键"写成"app client 补一个生成的 Idempotency-Key",两处都必须改回原判定用词。

### D4 契约唯一暴露真相必须机器可证(最高优先)

`EdgeRouteRegistryCoverageTest` 只断言 `registry ⊆ runtime`,不断言反向,因此 5 条契约外活端点(`/api/operations/auth/{password-login,session,context,logout}` + `GET /api/platform/group-workspaces/administration`)长期暴露无人发现,其中一条是**无 workspace 作用域的运营登录入口**,与 R5 冻结的 workspace-scoped 模型并存。

这是全批性价比最高的一处:**改一次、永久生效、且随 face 增多而增值**。v7 要新增 `terminal` face、v6 还规划 customer 端,每多一个 face 该断言的价值线性上升,成本不变。

### D5 wire 类型体系现在建,不推迟到"S5 一起做"

当前 70 个 inline record 散在 18 个 controller,另有 40+ 个 owner `XxxService.Nested`/`XxxReadback` 直接充当 wire 返回类型;`edge/generated/` 里**根本没有 request/response 类型**。这是"早期做最便宜"的典型:104 个 operation 时重建是可控的,长到 22 个域、数百 operation 后重建是灾难。

生成输入已经冻结齐备(contract catalog 104 op + 140 component + file-placement catalog 的 `requestComponentFile`/`responseComponentFile`),所以这不是发明,是补上生成器缺口。归 Phase B,**排在 U01 契约物化之后、controller 采纳之前**。

### D6 前端 substrate 先于前端 completeness

现状:两个 app **完全没有路由层**(`react-router` 声明了但全仓 0 import,用 `useState` 三元链切页)、11 个 feature 全部只有 `ui/`、generated facade 是死代码、11 个 PG key 由一张 generic 表驱动、5 个 `PG-IAM-*` 渲染逐字同构、幂等 6/22。

在这个底座上再建 6 个缺失 surface,等于建完再重写。**顺序锁死:先修底座(Phase C),再建缺失 surface(Phase D)**。这正是 §3.2 反思过的错误,不能第三次发生。

## 2. 执行顺序(Phase A→D,严格串行)

每个 Phase 的完成判定必须逐条 red-verified 后才可进入下一 Phase。**任一控制未 red-verified,后续 Phase 不得开工**(D2)。

### Phase A — 防复发控制全部激活(先于一切)

| # | 内容 | 完成判定 |
|---|---|---|
| A1 | `EdgeRouteRegistryCoverageTest` 增反向断言:runtime 路由集扣除 error/actuator 白名单后必须 ⊆ registry | 真实变异:注入一条 registry 外的 `@GetMapping` → 测试红且报出该路径 |
| A2 | backend ArchUnit 补 `EDGE_DOES_NOT_TOUCH_PERSISTENCE`(edge 禁 JDBC/DataSource/Repository/`java.sql`) | fixture controller 注入 `JdbcTemplate` → 红 |
| A3 | backend ArchUnit 补 capability 单向依赖(`app.edge.<face>.<capability>` 之间不得互相依赖;`<face>.session` 显式豁免——16 份 controller 依赖 `<Face>SessionResolver` 是设计使然) | fixture:`operations.contract` 依赖 `operations.organization` → 红;依赖 `operations.session` → 绿 |
| A4 | 现有 cookie 规则扩为 servlet API 全面禁令(`jakarta.servlet..` 整包,含 `HttpServletRequest`) | fixture controller 接收 `HttpServletRequest` → 红 |
| A5 | `frontend-architecture` 补"catalog required mutation 必须经 lifecycle idempotency helper" | 删掉任一 `lifecycle.getIdempotencyKey()` → 红(当前删光 4 个仍绿) |
| A6 | `code-layout` backend app 根改**白名单**(仅 `bootstrap/configuration/edge/generated`) | 真实树新增 `app/service/` 或把 controller 复制回 app 根 → 红(当前两者皆放行) |
| A7 | security self-test 变异对象改为 base 真读输入(route registry 或 R3 path fragment);同步修正 `contracts/policy/r4-gate-catalog.json` R4-G01 与 `tools/verify-gates/red-fixtures/README.md` 的失实声明 | `security --self-test` 由当前 `R4_GATE_SELF_TEST_RED_NOT_DETECTED` 转绿,且变异真实输入时确红 |
| A8 | `logging` 正则收窄到值侧字面量(现误伤 `private static final String COOKIE = "V2S_OPERATIONS_SESSION"`,属 CLAUDE.md 明禁的关键词伪装 checker) | 门转绿;注入真实明文密码字面量 → 红 |
| A9 | 蓝图 §14 增 D2 硬停条款;baseline 控制表状态收敛为闭集 | evidence 中不再出现 `PENDING <本包后续 step>` 形态 |

**Phase A 边界(防镀金)**:只做以上 9 项,**不新增门类别**,每条仍只判一行机械事实,`scripts/verify` 保持分钟级。**self-test 绿不算数**——A7 已证明 self-test 可以是 no-op 变异,每条必须在 scratchpad 拷贝上做真实变异证明会红。

### Phase B — 后端 substrate

| # | 内容 | 完成判定 |
|---|---|---|
| B1 | U01 契约物化(若未完成):按 file-placement catalog 产出 `paths/<face>/<capability>.paths.yaml` 与 `components/<owner>/<family>.schemas.yaml`,单文件非空行 ≤500 | 104/104 落位唯一、0 unresolved、0 ambiguous |
| B2 | 生成器补 request/response Java 类型,消费 `requestComponentFile`/`responseComponentFile` | `edge/generated/` 含全部 request/response 类型;生成物零手工编辑 |
| B3 | 24 个 controller 采纳 generated wire:**70 个 inline record 清零**;40+ owner `XxxService.Nested`/`XxxReadback` 不再直接充当 wire 返回类型;3 处 `Object` 返回按 catalog response schema 定型 | grep:edge 下 `record ` 计数 0;`Object` 返回 0 |
| B4 | 引入 `HandlerMethodArgumentResolver` 消除 servlet 类型穿透(cookie 语义已在 `<Face>SessionResolver`,这是最后一层);cookie **写入**也收进同一组件(现 3 个 controller 手拼 `Set-Cookie` 字符串,读写不对称,每个未来 face 都会复制这个不对称) | A4 规则在真实树上绿;controller 签名零 servlet 类型 |
| B5 | 闭集改 typed catalog constant(`Set.of("BRAND","TENANT","HEAD_COMPANY")`、`"UPDATED_AT"/"DESC"`、`"AUTHENTICATED"/"NONE"` 等 ≥9 份) | edge 下业务闭集字符串字面量 0 |
| B6 | 退役 5 条契约外端点;`EdgeOperationRegistry`(117 行、0 Java 消费者)与 `generated/edge-route-face-registry.json` 两套并行 registry 收敛为一套 | A1 断言绿;死代码清零 |
| B7 | `OperationsOrganizationController`(29 op / 83 行 / 横跨 6 个契约 capability)按 placement catalog 的 capability 粒度拆分;同时恢复正常可读格式(现为单行极限密度) | 单 controller 不横跨多个 placement capability |

### Phase C — 前端 substrate(形状,不含新建 surface)

| # | 内容 | 完成判定 |
|---|---|---|
| C1 | 引入真实路由层(`react-router` 已在依赖中、0 import),按 manifest 的 `route` 字段注册;operations 全部带 `:groupWorkspaceKey` | `useState` 三元链切页清零;manifest 声明的 route 可达 |
| C2 | feature 骨架补齐 `api/model/ui/automation/index.ts`;`api/` 只 re-export generated per-face typed facade/query hook,**不得成为第二个手写 fetch 桶** | 11 个 feature 全部具备四目录 |
| C3 | 消费 generated facade(现为死代码,全仓 0 业务 import),URL 不再由 feature 手拼模板字符串 | feature 内 URL 字面量 0 |
| C4 | 拆解 generic registry:11 个 PG key 各归其 capability feature;5 个 `PG-IAM-*` 现渲染逐字同构,按其真实 capability 分离 | `OperationsPageRegistry` 删除;零 generic 兜底 |
| C5 | 全部 catalog-required mutation 经 foundation lifecycle 稳定重放键(现 6/22;其余 14 处由 app client 补随机 `ui-<uuid>`,**零重放保护**;`RolesPage`/`AdministratorsPage`/`WorkspaceAdministrationPage` 三处是无 `expectedVersion` 的创建,超时重试必然重复建实体) | A5 规则在真实树上绿;22/22 |
| C6 | `OperationsPageRegistry.tsx:72` 的 `Object.entries(readback)` 按 JSON key 拼 UI 并把原始 key 当中文标签——改为按 typed readback 字段渲染 | §4.1.1 该禁令现存实例清零 |
| C7 | 退役 `src/main.js`(R3 历史快照,Vite 实际加载 `main.tsx`,而 `frontend-architecture` 仍在为它的存在性把关) | 门不再为非运行文件把关 |

### Phase D — completeness 与动态证据(即原 S5/U12)

| # | 内容 |
|---|---|
| D-a | 在已修正的底座上新建 6 个无承载 key:`PG-STORE-PROFILE` + 5 个 `HOME-*`;补 `PLATFORM-PASSWORD`/`OPERATIONS-PASSWORD` 承载。此时 22 surface / 25 key 完备性判定才适用(D3) |
| D-b | 恢复 DEV/seed:`dev check → dev reset → dev start → seed --dry-run → seed → 双 admin/public L2/L3 → owner readback → dev stop → cleanup readback` |
| D-c | 五账证据齐备(L1/L2/L3/business/cleanup),`affected-l2` 的 18 个 focused L2 由真实文件与真实运行关闭,**不得 path-only stub**;`scripts/verify` 端到端可通过 |
| D-d | 进入唯一的 R5 whole-scope implementation review |

## 3. 全程红线(任一 Phase 都适用)

1. 104 operation / 32 scenario / 22 surface / 25 pageDesignKey / 7 owner schema 分母**不得漂移**;本轮已复算全部吻合,任何变化都是缺陷。
2. **(2026-07-26 更正,见 persistence-conflict-review §S-3)** HTTP path、operationId、error code、事务语义**不改**;**已执行 migration 的字节不得改写**。owner API 与数据形状仅允许在"精确执行已冻结契约"所需范围内**新增式演进**(additive migration + command/readback 补齐),不得借此扩大业务范围、恢复已裁退语义或改变 104/32/22/25/7 分母。B7 拆分仍只动 Java package,不动路由。
   ~~原文:HTTP path、operationId、error code、事务语义、owner API、migration 字节不改~~——原措辞过紧,会阻断合法的契约完备性修复,由 Claude 更正。
3. 不建 MQ/outbox/投影/Redis/TDP/内部 client/轮询;不把 v2 多服务拓扑搬回。
4. 证据只写真实执行结果:**不得用措辞改写完成判定**(D3 点名的两处必须改回);不得 stub 伪绿;门红就如实登记红(`logging` 与 `scripts/verify` 当前的红两份证据都漏登记,一并补上)。
5. 每个 Phase 的控制必须**真实变异验红**才算激活;self-test 绿不算数。

## 4. 需 Dexter 裁决的项

**无。** D1-D6 已由 Claude 在 Dexter 授权下决定;若 Dexter 不同意 D1(即仍希望开治理 batch 把 pitfall 提升为 routed anchor),只需单独告知,不影响 Phase A-D 的其余执行。

## 5. 授权边界

本指令在既有 `R5_IMPLEMENTATION_AUTHORIZED=true` 内执行,不新增业务能力、Journey、contract 语义、schema 行为或新 review cycle。Phase D 的 DEV/seed 仍以 Phase A-C 全部 red-verified 为前置。R5 仍只在全范围完成后由唯一一次 whole-scope implementation review 验收,本指令的执行结果并入该次分母。附带修复:Roadmap `:131-136` 的 "Current post-R4 status" 段落写 `R5_IMPLEMENTATION_AUTHORIZED=false`,与同文件 `:120` 状态块的 `true` 矛盾,会误导 fresh 会话,一并更正。
