---
title: v2s R6 结构重组与整改 Roadmap（候选，Claude 起草）
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-28
programId: V2S_W0_W4_EXECUTION
roadmapId: R6-RESTRUCTURE-AND-REMEDIATION
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
inputDenominator: doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md
---

# v2s R6 结构重组与整改 Roadmap（候选）

## 0. 状态与用途

本件是**候选** Roadmap，未写入 program registry，不改变现行 Roadmap 的历史状态。
Dexter 接受前不授权实施。

**唯一输入分母**：`doc/review/platform/2026-07-28-v2s-r6-problem-inventory-claude.md`。
Codex 据本 Roadmap 产出详设，**不得绕过清单自行取舍范围**；清单里的每条问题都必须在某个包里
有归属或有显式 `NOT_APPLICABLE` + 理由。

## 1. 前一条 Roadmap 的处置（R-2）

CR00–CR08 那条整改 Roadmap **就地终止，不再推进**。

- **已完成的代码保留，不回滚**。§13"已知正面事实"列出的成果（typed client、9/9 字段名、
  跨 owner 归零、catalog 生成链、`items_json` 迁移、legacy audit DROP、pageDesignKey 编译期穷举等）
  是真实产出，本轮不得回退
- **未闭合项全部并入本 Roadmap**，不做"上一条的尾巴"式追赶
- CR00–CR06 的 package-exit receipt 作为历史记录保留，**但不再作为"已验证"的依据**
  —— 其中 CR05/CR06 无 compile/test receipt、无红变异产物（P-C4）

## 2. 为什么这一轮的第一件事是结构，不是功能

上一条 Roadmap 的失败模式是：**在错误的结构上修功能**。三个证据：

1. `libraries/backend/` 在单 app 拓扑下名不副实（P-A1）——所有业务 owner 在 app 外面，
   app 里只剩 `bootstrap/configuration/edge` 三层
2. 门的分母与仓库布局脱节（P-C3：12/30 条 path 指向不存在的目录）——**而本轮重组会再次改变所有后端路径**，
   若先修功能后重组，这批分母要脱节两次
3. 同一件事在多处判断（§11 的 12 条 ST）——功能整改若在此之上做，只会长出更多第二真相

因此顺序是：**单一真相收敛 → 结构重组 → 门真实化 → 功能整改**。

## 3. 包与严格串行拓扑

```
R6-P0  →  R6-P1  →  R6-P2  →  R6-P3  →  R6-P4  →  R6-P5  →  R6-P6  →  R6-P7  →  R6-P8
```

包级串行，上一包 exit gate 真绿才能开始下一包。包内按文件或 capability 小步串行，
完成一个增量核对后才进入下一个。

每包只有两种控制状态：`ACTIVE_RED_VERIFIED`（生产控制先在 scratchpad 仓库拷贝上被真实变异打红，
失败原因精确）或 `OUT_OF_SCOPE_THIS_PACKAGE`（写明 owning package 与理由）。
**禁止 `PENDING`。**

### 四个不可绕过的过程闸口（承接 R-16）

1. **文件级增量合规**：写前确认当前包与受保护范围；写后从冻结 source 动态加载适用断言，
   对本次改变的文件立即静态核对。**纯静态，不需要 gradle/docker。**
2. **测试前全量扫描**：任何 typecheck/单元/集成/L2/DEV/seed 运行前先全量扫描，红则不进入测试。
   扫描分两层且**都要绿**：source-derived compliance aggregate + 从 gate catalog 动态解析的独立静态门
   （aggregate 的 PASS **不得覆盖**独立门的 FAIL）
3. **红先于绿**：新增或修复控制先做 production-path red mutation。
   **`--self-test` 的 baseline 必须是未经改写的当前树**（P-C1 的直接教训）
4. **包级 exit receipt**：`actualChangedPaths` 由**工作树独立枚举**（不读 hook 自报），
   与非空 `incrementalChecks` 做 exact set equality；缺/多/空/越界各有具名红

---

## R6-P0 ｜单一真相收敛（语义源先行）

> **不改任何业务行为**，只把"多处判断"收敛成"一处判断"。这是全 Roadmap 的地基。

**范围**（对应 §11 的 ST 表）：

- **ST-5**：`contracts/catalog/admin-catalog.json` 补 `workspaceRequirement`
  （`REQUIRED` / `GLOBAL_OR_OPTIONAL`，照 v2）
- **ST-4**：platform catalog 补 `menuOrder`；platform 侧停止用对象字面量书写顺序
- **ST-3**：页面标题唯一来源为 catalog；移除页面内硬编码标题
- **ST-1**：定义 `dataNodeCandidates`（后端授权事实）与 `requiredDataNodeType`（前端 UI 事实）
  两个字段的归属与形状。**本包只定契约与 catalog 字段，实现在 P-5**
- **ST-7**：门内所有硬编码分母改为从 catalog/契约派生（含 `security-boundaries` 的 `!== 106`）
- **ST-6**：审计 `fieldLabels` 定单一来源
- **ST-12**：逐端点核实服务端能力校验是否齐备；**缺口按安全问题登记**，不按一致性问题处理

**完成判据**：
- 上述字段在 catalog 中存在且被生成物消费；**第二份手写来源为 0**（机械扫描证明）
- 门内硬编码分母 = 0
- ST-12 的核实结果落成一张逐端点表，缺口有 owning package

**增量验证点**：每收敛一个 ST 项即跑一次"第二真相扫描"（该语义在仓内出现次数必须 = 1）。

**为什么必须最先**：ST-5 不做，P-5 的前端就必然再手写一份"哪些页需要选空间"；
ST-1 不做，切换器补得再漂亮还是三处判断。

---

## R6-P1 ｜结构重组（R-1）

**范围**：

- 7 个 owner 模块从 `libraries/backend/` 迁入 `apps/backend/catering-business-server/.../app/owner/`
- `audit-contract`、`platform-access`、`platform-foundation` 迁入 `.../app/shared/`
- `libraries/backend/` 整个消失（`libraries/frontend/admin-ui-foundation` **保留**——两个真实消费者）
- Gradle 子项目从 9 个塌缩为 1 个（加 TDP 占位）；`settings.gradle.kts` 与 46 处
  `:libraries:backend:` 引用同步
- **边界执行迁移**（P-A2）：owner 边界从 Gradle 依赖图迁到 ArchUnit 包规则
- `module-dependency-registry.json` 的 `commandApiPackages` 全量更新；补登 `platform-foundation`（P-A3）
- `code-layout` / `backend-boundaries` / `verify-gates` 的路径与 allowlist 同步
- 活文档（`doc/plans/`、布局 decision）更新；**历史 review/evidence 36 个文件不追溯改写**
- 清理 `libraries/backend/*/build/`（含旧 `WorkspaceRoleCatalog` 编译残留）与 `.gradle/` 缓存

**顺序（不可颠倒）**：

1. **先**写 ArchUnit 包边界规则，并在 scratchpad 拷贝上证明它能被真实变异打红
   （注入跨 owner import、注入跨 schema SQL 字面量，各自精确红）
2. 再执行物理搬迁
3. 搬迁后立即复跑边界对账，证明"跨 owner 未声明直读 = 0"仍然成立

**完成判据**：
- `libraries/backend/` 不存在；`apps/backend/.../app/` 下 owner/shared 分层成立
- ArchUnit 边界规则有真红证明；跨 owner 未声明直读 = 0（与重组前持平）
- Java 包名与目录一致（不允许"包名没改只挪物理位置"）
- 全部门在新路径下可跑

**需 Dexter 裁决**：Java 包名的目标形状——`com.catering.v2s.app.owner.organization.*`
（与目录一致，改动大）vs 保留 `com.catering.v2s.organization.*`（包与目录不一致）。
**本 Roadmap 推荐前者**，理由是倾向 0：包名是模块归属的单一真相，与目录不一致等于两份真相。

---

## R6-P2 ｜门真实化

> **在本包完成前，任何"门全绿"都不得作为证据**（含本 Roadmap 后续各包的 exit）。

**范围**：

- 删除 `prepareSelfTestClean()`（P-C1）；baseline 改为未经改写的当前树，baseline 不绿即 FAIL
- `code-layout --self-test` 的三处 `mkdtempSync()` 空目录改为仓库拷贝
- `standards-coverage` 增加"被引用门必须能被打红"的校验（P-C2）；
  **必须先证明它能拒绝 `exit 0` 桩再算数**
- `affected-l2-registry.json` 的 `paths` 按 **P1 重组后的实际布局**重建（P-C3）；
  L2 target 要么建文件要么从 registry 删除声明
- `database-boundaries` 补 `bytea|base64|object_key|bucket_name` 的 migration 扫描（P-C4，现为零实现）
- `security-boundaries` 从"类名在文件里出现"收紧到"handler 方法体内出现调用"
- 补 `gradlew` + wrapper；`verify.mjs` 改调 `./gradlew`，删除本机 colima 绝对路径，
  改走仓内已有的 `scripts/test/r5-remote-testcontainers.mjs`；cleanup 移入 `finally`
- `provider-free-context` 的 skill 分母订正（蓝图"五个"→ 实际 8 个）

**完成判据**：
- 每条修复的门各有一条真实 scratchpad 变异能打红且失败原因精确命中
- 把任一被引用门替换为 `exit 0`，`standards-coverage` 必须变红
- `scripts/verify` 在本机可完整跑完（远端 Docker，本机不装）
- 用 P-B1/P-B2/P-C4 等已知缺陷做回放，适用门必须命中

---

## R6-P3 ｜功能阻断与安全

**范围**：

- **P-B1** `ck_invitation_status` 闭集补齐（以 service 为唯一分母，不反向改代码）
- **P-B2** 门店启停 `"STORE"` 特判（一行）
- **P-D1** 邀请令牌不入 receipt（需 Dexter 裁决"管理员是否需重新获取同一链接"）
- **P-D2** Problem advice 补 403 分组 + typed 兜底 handler；组织节点补 `DuplicateKeyException` 捕获
- **P-D3** `extension`/`platform_asset` 换 advisory lock（同时消解 R-11 的 budget 红）
- **P-D4** 资产回滚删除只在"本次新建"时执行
- **P-D5** MinIO 上传移出事务 + 客户端超时
- **P-D6** 重置限流前置、登录 OTP 补 SOURCE 维度、OTP subject 改 `account.id()`、
  宿主 detail 读的存在性 oracle
- **ST-12** 的服务端能力校验缺口（若 P0 核出）

**完成判据**：每条各有 focused test 并**证明修复前为红**。
P-B1/P-B2 必须有端到端红→绿证据——这两条的特征是"前后端都写了、从没跑通一次"。

---

## R6-P4 ｜效率（R-11）

**范围**：

- **P-E1** 补 7 条已被真实查询证明必需的索引（**不做投机性索引**，倾向 5）
- **P-E2** 门店列表去 O(N²)：`overview.page` 改真分页；`store()` 不逐行重取 detail；
  `derivedStoreStatus` 改批量
- **P-E3** 角色 JSON 改 Java 侧解析；`list()` 单条批量映射；`session()` 请求作用域缓存
- **P-E4** `useDrawerFormLifecycle` 加 `useMemo`（一处修复覆盖三处无限循环）
- **P-E5** 会员列表批量化、合同总览加分页上限、平台管理员列表改真分页

**完成判据**：每个列表给出"改前/改后查询次数"对照；不接受"看起来快了"。
**方法论**：查询次数用日志或计数器实测，**不用 EXPLAIN 猜**。

---

## R6-P5 ｜前端架构（R-4 / ST-1 / ST-9）

**范围**：

- RTK 改真 `build.query` + `tagTypes` + `providesTags` / `invalidatesTags`
- 一次性解决四件事：`workspaceContextChanged` 缓存扇出、`WorkspaceScope` 重复拉取、
  写后重拉（19 处）、401 的 `resetApiState`
- platform 会话恢复：接 `getCurrentPlatformSession`，刷新不掉线，登录后回到原页
- 401 统一拦截（`createObservedBaseQuery` 一处覆盖两个 app）
- 写后刷新三种做法收敛为一种
- `contextScopedQueryArgs` 的两处恒等调用删除；`queryContext` 加 `useMemo`
- Error Boundary；失败态不再永久 loading；换页失败保留上一成功页；generation guard

**完成判据**：`providesTags`/`invalidatesTags` 覆盖全部已实现 surface；
写后重拉与详情重取的请求数降为 0；刷新页面会话可重建。

---

## R6-P6 ｜UI 与 v2 吸收

**范围**（全部已由 Dexter 裁决）：

- **R-3** Problem 文案照 v2 两份模块（18 个操作上下文、四段分级、三态判别联合、`retryAfterSeconds` 插值、
  字段级路由）
- **R-7 / P-U3** 两个集团空间页：写能力归位；总览改选中制 + 未选空态 + 只读；标题对齐 catalog
- **R-12 / P-U4** 切换器：右上角常驻任职切换器（不整页接管）+ 左下角 `menuFooterRender` 数据范围切换器
  （层级 Cascader + 按 `requiredDataNodeType` 裁深度 + dirtyGuard + 侧栏收起隐藏）
- **R-9** `maskClosable: true` + `onClose` 走 `lifecycle.requestClose`；platform 侧编辑 Drawer 补 dirty guard
- **R-8** ProTable 按 surface 定（v2 是 13 关 3 开，不一刀切）
- **R-10** 五个 `HOME-*` 照 v2 补真内容
- **P-U5** 扩展字段通电（共享 `ExtensionValuesFormItems`，5 个创建路径复用）；
  `loading={!x}` 18 处改真实请求状态；`RolesPage` 创建角色一步到位
- **R-5** 删 `InvitationsPage.tsx`；5 个 operation 从 106 退役（**分母修订走显式流程**）
- 从 v4 吸收 2 条：页面级 `requiredDataNodeType` 驱动切换器深度（已在 ST-1）、
  切换后缓存失效收敛到 store 监听器（已在 P5）

**需 Dexter 裁决**：106 分母修订后的新 face closure 数字（当前 39/56/11）。

---

## R6-P7 ｜死代码清除（R-6）与 seed

**范围**：

- §12 死代码清单全表删除
- seed executor 实现；DEV 固定 OTP issuer；fixture 提升为正式 profile 数据
- **R-14** 数据量：品牌/租户/总公司各 ≥25；门店/合同各 ≥30；平台管理员/运营账号/集团空间/
  两个总览各 ≥55；`cg-boreal` 补完整 大区→项目→门店 分支；角色与账号补中文业务名；
  实体名不写测试用途
- 补 4 个真实图片 fixture；`dev reset` 前后 readback + 对象命名空间清理；
  `dev stop` 确认进程退出后才 PASS

**依赖**：数据量目标依赖 P-4 的服务端分页与 P-5 的 tag 化——否则补到 55 条也翻不出页。

---

## R6-P8 ｜全范围实施复核

CR/P0–P7 全部 exit receipt 真绿后，**一次** `REVIEW_TARGET=IMPLEMENTATION` 全范围复核：
fresh 独立子 agent 两轮上限 → Claude review → Dexter acceptance。
中途 receipt 不是 GO，不建立独立 review cycle。

## 4. 完成定义

同时成立才算完成：

1. P0–P7 每包 exit receipt 真绿且顺序无跨越
2. §11 的 12 条 ST 各自"该语义在仓内出现次数 = 1"（机械可证）
3. 冻结分母（32 scenario / 22 surface / 25 pageDesignKey / 7 owner schema）不漂移；
   106 的修订走显式流程并同步 face closure
4. §13"已知正面事实"全部未回退
5. DEV business 与 cleanup 均 PASS
6. `HANDOFF.md` 只承载 Dexter 明确裁掉或后置的事项，不承载本轮漏做

## 5. 需 Dexter 裁决清单

| # | 事项 | 阻断包 |
| --- | --- | --- |
| D-1 | Java 包名目标形状（`app.owner.*` vs 保留现名） | P1 |
| D-2 | 邀请链接是否需要"创建后重新获取" | P3 |
| D-3 | 106 分母修订后的新 face closure 数字 | P6 |

裁定前对应包保持 `BLOCKED_BY_DEXTER_DECISION`，不得用默认值开工。

## 6. 授权边界

本件是候选 Roadmap，不授权 implementation、业务源码、契约、migration、测试、脚本、构建、DEV、
数据库、远端运行或 seed/reset。Dexter 接受后仍需另行给出 implementation exact authorization，
且只能从 P0 开始。
