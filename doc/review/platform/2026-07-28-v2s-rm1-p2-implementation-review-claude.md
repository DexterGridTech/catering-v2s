---
title: RM1 P2（RM1-U06）实现复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P2 / RM1-U06 current bytes
verdict: NO-GO
findings: M=1 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审 RM1 P2 当前静态实现与证据；不授权 P4、动态环境、DEV、seed、reset、迁移或业务行为修改
createdAt: 2026-07-28
---

# RM1 P2（RM1-U06）实现复核

## 0. 结论

**NO-GO**，`M=1 / S=1 / N=3`。

按 Dexter 要求，本评审**先回到 P2 的目的**再看证据。三条目的中**两条达成得很好**，
一条被**证据体系的盲区**放过了。

| P2 的目的 | 达成情况 |
| --- | --- |
| ①`libraries/backend` 在单 app 拓扑下名不副实 → 迁回 app 并重新规划结构 | **达成**。10 个模块全部就位、三处改名落实、5 层依赖分层完整保留、编译期边界机制未丢 |
| ②`Membership`→`User`（没有会员业务） | **达成**。八类词形全仓残留 **0**，含 `.member()` / `.Member` / `WorkspaceMember*` |
| ③P-C3 POST 新布局验证 | **达成**。changed-surface 红与 RM2-expiry 红均保留，另新增布局派生红 |

**但 M1 是这次搬迁最大的技术风险，而它恰恰没有被任何证据覆盖**——
不是因为漏检，而是因为 P2 声明 `business = NOT_APPLICABLE`、`dynamicEvidence` 完全缺失，
**本轮零编译、零测试**。搬迁把 8 个 DB 集成测试的 Flyway 相对路径全部打断，
而那 8 个测试正是用来证明"搬迁没改变行为"的东西。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。
不采信 round-1/round-2 的结论，直接重开源码与结构判断。

**授权边界**：仅复审 RM1 P2 当前静态实现与证据。
不授权 P4、动态环境、DEV、seed、reset、迁移或业务行为修改。

---

## 1. M（必须修复）

### M1 ｜8 个 DB 集成测试的 Flyway 相对路径在搬迁后全部失效，且本轮无任何动态证据覆盖

**owning source**（8 个文件，均在 `apps/backend/catering-business-server/modules/*/src/test/**`）

```
OrganizationOwnerServiceTest.java        ExtensionDefinitionServiceTest.java
PlatformAssetServiceTest.java            ContractCommandServiceTest.java
PlatformAuthenticationServiceTest.java   WorkspaceRoleServiceTest.java
WorkspaceInvitationPublicFlowTest.java   WorkspaceUserTaskScopeTest.java
```

**问题**：8 个文件仍写着搬迁前的深度：

```java
.locations("filesystem:../../../apps/backend/catering-business-server/src/main/resources/db/migration")
```

`../../../` 是按旧位置 `libraries/backend/<module>`（离仓根 3 层）算的。
新位置是 `apps/backend/catering-business-server/modules/<module>`（离仓根 **5** 层），
`../../../` 只上溯到 `apps/backend`，于是解析成
`apps/backend/apps/backend/catering-business-server/src/...` —— **不存在**。

**可复现反例（本会话逐模块实测，6/6 全部失败）**：

```
$ cd apps/backend/catering-business-server/modules/organization
$ cd ../../../apps/backend/catering-business-server/src/main/resources/db/migration
  → 解析失败
（organization / workspace-iam / store-contract / extension / platform-admin-iam / asset 同）

正确前缀应为：../../src/main/resources/db/migration
$ cd apps/backend/catering-business-server/modules/organization && cd ../../src/main/resources/db/migration
  → /Volumes/idea/catering-v2s/apps/backend/catering-business-server/src/main/resources/db/migration
```

**为何运行时确实会断（已排除三种"其实没事"的可能）**：

1. Flyway 的 `filesystem:` 按**运行时工作目录**解析；
2. Gradle `Test` 任务的 `workingDir` 默认是 `project.projectDir`，即模块目录。
   本会话检索根 `build.gradle.kts`、app 与 10 个模块的 `build.gradle.kts`：
   **无任何 `workingDir` / `systemProperty` / `environment(` 覆盖**，
   根脚本的 `tasks.withType<Test>` 块只有 `useJUnitPlatform()`；
3. 受管 runner `scripts/test/r5-remote-testcontainers.mjs` 的 `cwd: root`
   是给 gradle **进程**的，不改 `Test` 任务的 workingDir。

**为何没被发现 —— 这才是要点**：

```
rm1-u06-package-exit.json:
  business          = "NOT_APPLICABLE"
  businessReason    = （缺失）
  dynamicEvidence   = 不存在（该键在 exit 中出现 0 次）
  staticVerifications = 仅两个 JSON 证据文件的 hash，无 compile、无 test
  "compile" 在整个 exit 中出现 0 次
```

即：**本轮搬迁 103 个 java 文件、改 10 个 Gradle 坐标、改 package 名、
做 `Membership`→`User` 全量改名，零编译、零测试**。
round-1 / round-2 均 GO、`code-layout` PASS、`backend-boundaries` PASS——
这些都是**静态**门，无一会执行那 8 个测试。

候选 Roadmap 的 P2-5 判据 4 原文已写死这一条
（「8 个测试文件的 Flyway 相对路径必须同步改……不改则全部 DB 集成测试找不到 migration 而失败
——而那正是你要用来证明搬迁安全的测试」）。**判据写了，未执行。**

**最小修复**

1. 8 个文件的前缀改为 `../../src/main/resources/db/migration`
   （或改用 classpath / 由 Gradle 注入绝对路径，避免再次与目录深度耦合）；
2. **本轮必须给出真实动态证据**：至少把这 8 个测试所属的 module test suite 跑一遍，
   `business` 改为如实值并附 `dynamicEvidence`（runner / suite / result / cleanup /
   currentSourceHashes / log）；
3. **加机械控制**（防复发）：断言任何 `filesystem:` 位置从其**模块目录**可解析，
   不可解析即具名红。红变异 = 把前缀改回 `../../../`，门必须红。
   没有这条，下次任何目录深度变化都会重演。

**是否需要 Dexter 产品裁决**：**否**。纯技术缺陷。

---

## 2. S（应修复）

### S1 ｜`business = NOT_APPLICABLE` 用在一次触及 103 个后端源文件的重组上

**owning source**：`doc/evidence/platform/rm1/p2/rm1-u06-package-exit.json`

`business = "NOT_APPLICABLE"`，且 **`businessReason` 缺失**（P1 的 U05 至少给了理由）。
`actualChangedPaths` 有 **325** 条，其中包含全部 103 个后端 java 文件的搬迁。

P2 确实是"行为中性的重定位"，这个判断本身**可以成立**——
但它恰恰是**需要证明**的命题，而不是可以用来免除证明的前提。
M1 就是这个循环的代价：因为宣称行为中性，所以不跑测试；因为不跑测试，所以行为是否中性无人知道。

对照 P1（U05）：同样是控制类变更，但 U05 给了 `businessReason`，
且其保行为性可由「40/40 capability 值与权威一致」独立证实。
P2 没有等价的独立证实。

**最小修复**：与 M1 第 2 项合并——给出编译与 module test suite 的真实动态证据后，
`business` 按实际结果填写；若确要保留 `NOT_APPLICABLE`，必须补 `businessReason`
并说明"行为中性"由哪一条独立证据支撑（例如编译通过 + 8 个 DB 测试全绿）。

---

## 3. 达成的部分（不得在整改中回退）

### 3.1 目的一：结构重组真实完成

```
libraries/backend 下非 build 文件      : 0
libraries/backend 下生产 java          : 0
libraries/backend 下空 src 目录        : 0
（仅剩 derived build output，符合核验点 2）
```

新位置 10 个模块齐备，**三处改名全部落实**（与候选 Roadmap P2-1 的映射表一致）：
`platform-foundation→foundation`、`platform-access→execution-context`、
`audit-contract→audit-model`、`contract→store-contract`、
`platform-workspace→workspace`、`platform-asset→asset`、`platform-iam→platform-admin-iam`。

Gradle 坐标全部迁至 `:apps:backend:catering-business-server:modules:*`（10 条 `include`）。

**编译期边界机制未丢**——这是当初论证保留 Gradle subproject 的唯一理由，
实测依赖分层与 P2-2 定义的 5 层完全一致：

| 层 | 模块 | 依赖 |
| --- | --- | --- |
| L0 | `foundation` / `execution-context` / `audit-model` | 零 `project()` 依赖 |
| L1 | `asset` / `extension` / `platform-admin-iam` | 仅 L0 |
| L2 | `organization` | + `extension` |
| L3 | `store-contract` / `workspace` | + `organization` |
| L4 | `workspace-iam` | + `workspace` |

`scripts/check/code-layout` 本会话实跑 **PASS（EXIT=0）**。

### 3.2 盲审预言②被防住，且防法优于本评审的建议

第三轮盲审曾预言：`walk()`/`walkFiles()` 对不存在路径返回 `[]`，
搬迁后跨 owner 直读强制层等门会**静默对空列表迭代并报绿**。

实测**未发生**，且防法比候选 Roadmap 建议的"合计 98 文件正分母断言"更精确：

```js
// tools/module-dependency-registry/check.mjs:95-98
const sourceRoot = path.join(root, module.sourceRoot, "src/main");   // ← 由 registry 声明，不再硬编码
assert(fs.existsSync(sourceRoot), "MODULE_SOURCE_ROOT_MISSING", module.sourceRoot);
const javaFiles = walkFiles(sourceRoot).filter((c) => c.endsWith(".java"));
assert(javaFiles.length > 0, "MODULE_SOURCE_ROOT_EMPTY", module.sourceRoot);   // ← 逐模块零文件即红
```

工具链中 `libraries/backend` 路径串残留 **0**
（检索 `tools/`、`scripts/`、`contracts/policy/`、app 的 `src/test/`）。
`node tools/module-dependency-registry/check.mjs` 实跑 **PASS**。

### 3.3 目的二：改名彻底

全仓（`apps`/`libraries`/`contracts`/`scripts`/`tools`，排除 `build`、`node_modules`）
八类旧词形残留：

```
Membership 0    membership 0    MEMBERSHIP 0
WorkspaceMember 0    .member() 0    .Member 0
```

**含核验点 1 特别点名的 `.member()` / `.Member`**，均为 0。
改名产物可见于 `WorkspaceUserTaskScopeTest.java`（原 `WorkspaceMembershipTaskScopeTest`）。

### 3.4 目的三：P-C3 POST 保护完整

`rm1-u06-affected-l2-post-verification.json` 的 `redProof` 声明三类红，
本会话**独立复跑逐条确认**：

| 保护 | 声明 | 本会话实测 |
| --- | --- | --- |
| changed-surface | `EXPECTED_FAIL:R5_AFFECTED_L2_DEFERRED_SELECTED_FOR_CHANGE` | self-test 中 `R5_AFFECTED_L2_SELECTED_CHANGE_RED=PASS` |
| RM2 到期 | `EXPECTED_FAIL:R5_AFFECTED_L2_DEFERRED_EXPIRED` | `--phase RM2` → `REASON=R5_AFFECTED_L2_DEFERRED_EXPIRED:…/authentication.spec.ts` |
| 新布局派生 | `R5_AFFECTED_L2_LAYOUT_DERIVATION_RED` | self-test `=PASS`（本轮新增，好） |

默认调用 `scripts/check/affected-l2` **EXIT=0**；
`boundary` 字段诚实声明"不宣称跑了 L2 浏览器、不关闭任何 RM2 legacy 债"。

### 3.5 核验点 4：exit 一致性

```
actualChangedPaths : 325
incrementalChecks  : 325
exact-set 相等     : True
afterSha256 与当前字节不符 : 0
```

### 3.6 核验点 5 的静态部分

本会话实跑：`edge-codegen --check` **EXIT=0**、
`frontend-architecture` **EXIT=0**、`backend-boundaries` **EXIT=0**。
operations 前端 architecture test 存在
（`static-boundary.test.mjs`、`public-entry-boundary.test.mjs`）。

**但这些都是静态检查**，不构成"重组风险已被覆盖"的证明——见 M1。

---

## 4. N（观察项）

**N1 ｜`gradlew` 不存在，本会话无法独立验证编译**
本机 `./gradlew` 不可执行，故 M1 的"运行时会断"是**由路径解析 + Gradle workingDir 语义推导**，
而非由一次失败的构建实证。三种"其实没事"的可能已逐一排除（M1 §2），
但仍标 `VERIFIED_BY_SOURCE_AND_SEMANTICS_NOT_BY_RUN`。
Codex 侧修复时应以一次真实的 module test 运行作为闭环证据。
（另：候选 Roadmap P0 曾要求"补 `gradlew` + wrapper"，当前仍缺，属 P0 遗留，登记不追。）

**N2 ｜`sourceComplianceDisposition.rows` 为 0**
exit 中该结构的 `rows` 长度为 0（P1 的 U05 为 33）。
未确认这是 P2 的合法形态（无适用规则）还是缺口，标 `UNVERIFIED`，建议作者说明。

**N3 ｜本评审未采信 round-1/round-2**
就所见事实，round-2 的 GO 与 M1 不相容。建议作者复核 round-2 是否
(a) 从模块目录实际解析过那 8 个 `filesystem:` 路径，
(b) 检查过本轮 `dynamicEvidence` 是否存在。

---

## 5. 处置与再复核条件

| finding | 性质 | 处置 |
| --- | --- | --- |
| M1 | 搬迁遗漏 + 证据盲区 | Codex 自主修复；不需要 Dexter 裁决 |
| S1 | 证据表述 | 与 M1 第 2 项合并处置 |
| N1–N3 | 观察 | 不阻塞 |

**再复核条件**：M1 三项（改 8 个前缀、给出真实编译与 module test 动态证据、
加 `filesystem:` 可解析性的机械控制并验红）闭合后可复评。

**本复核不授权**：P4、动态环境、DEV、seed、reset、迁移或业务行为修改。
