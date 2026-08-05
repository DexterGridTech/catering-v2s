---
title: WHOLE-ENGINEERING-S0-DESIGN-20260805 POST_REMEDIATION_V1 current-byte recheck（Claude）
reviewTarget: DESIGN
scope: S0 current-byte implementation-facing 详设与 baseline
verdict: NO-GO
findings: M=2 / S=2 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复核 S0 current-byte 详设；不授权源码、契约/schema、脚本行为、runtime、DEV、seed/reset、HTTP/L2、Roadmap 或后续单元实施
createdAt: 2026-08-05
---

# S0 post-remediation current-byte recheck

## 0. 结论

**NO-GO — `M=2 / S=2 / N=1`。**

三项指定核验中，**RP-12-pre 的 `NOT_APPLICABLE` 是诚实且成立的**（`§1`），
但 **P6-1 observability source map 并未真正闭合**（原 `M2` 未关闭，见 `§2`），
且 design/baseline **声明了治理明令禁止的 `implementationAuthority: true`**（`§3`）。

两条 `M` 的修订量都很小（一处改两个布尔值、一处补 8 个文件与 hash），
但都不能靠"读者自行理解"绕过：它们分别是**授权越界**与**Round-2 finding 未闭合**。

我不改写 Round 2 的历史 `NO_GO`，也未创建第三轮独立审查。

## 1. RP-12-pre 的 `NOT_APPLICABLE` —— 诚实、成立、可接受 ✓

**这是本轮做得最好的一项。**

design `:76` 与 baseline `:17` 的理由是
「`WorkspaceAuthenticationService.enterable(...)` 已用 `default -> false`，调用方随即拒绝，
未知服务节点不存在可进入的生产路径」。

**我独立验证了这条调用链**（未采信自述）：

```java
// createRawSession
List<Assignment> enterable = availableAssignments(workspaceUuid, key, assignments);
Assignment selected = enterable.size() == 1 ? enterable.getFirst() : null;
… current_assignment_id = selected == null ? null : selected.id()
```

未知 `serviceNodeType` → `enterable(...)` 返回 `false` → **被 `availableAssignments` 过滤掉**
→ 不可能成为 `selected` → 无法获得进入上下文。
**这在安全轴上确实是 fail-closed，不存在 fail-open 路径。** ✓

`:76` 拒绝"把等价 `false` 改成 `throw`"的理由也是对的：
`throw` 会让任何持有陈旧 assignment 类型的用户**整个登录失败**，比现状更糟。

**并且它满足了 Round-2 `M1` 的全部要求**：
从 baseline 的 `redProofs` 分母中排除（`:16` 确实不含该项）、
另立 `notApplicable` 条目并记录 source、反例与**未来重开条件**
（`:17` "A future typed-failure/audit distinction requires a new Dexter decision"）。

> **一点边界澄清（不是 finding）**：我在全工程终稿里对该处的关注点是
> **静默性/可观测性**（角色悄悄消失且无日志），不是 fail-open。
> 本设计把它按"无 fail-open"判为 `NOT_APPLICABLE` 是**正确的范围收敛**，
> 而可观测性那一面已正确路由到 RP-03/04 的 completion event，未被丢弃。

## 2. M1 ｜P6-1 observability source map 未闭合，且与设计自述直接矛盾

**位置**：`s0-implementation-design.md:66` 对 `s0-baseline.json:13`

design `:66` 原文：

> "P6-1 exact source set 包含 registry/controller/session/cookie/owner/runner/App 的**逐文件 hash**，
> **见 S0 baseline `S0-C`**；其中至少覆盖 `PublicSecurityOperationRegistry.java`、
> `PlatformAuthenticationController.java`、`OperationsPasswordRecoveryController.java`、
> 两个 session resolver、`EdgeSessionCookieWriter.java`、platform/workspace authentication services、
> `r5-remote-testcontainers.mjs` 与两个 App 接线文件。"

**baseline `S0-C` 的实际内容（我逐条比对）**：

```
sourcePaths 共 7 条，字段仅 {id, scope, sourcePaths} —— 无任何 hash 字段
```

| design 点名的 P6-1 source | 是否在 baseline S0-C |
| --- | --- |
| `PublicSecurityOperationRegistry.java` | **缺** |
| `PlatformAuthenticationController.java` | **缺** |
| `OperationsPasswordRecoveryController.java` | **缺** |
| 两个 session resolver | **缺** |
| `EdgeSessionCookieWriter.java` | **缺** |
| platform / workspace authentication services | **缺** |
| `r5-remote-testcontainers.mjs` | 在 |
| `PlatformApp.tsx` / `OperationsApp.tsx` | 在 |

**8 类点名 source 缺失，且"逐文件 hash"在 baseline 中完全不存在。**

另有一处与 Round-2 `S1`（泛称/glob）同族的残留：
baseline `S0-C` 第 5 条是 **`libraries/frontend/admin-ui-foundation`（目录）**，
而 design 表 `:35` 点名的是确切文件 `safeLogger.ts`。

**影响面**：intake `:16` 声称 `M2 CONFIRMED` 且"已在 S0-C/source baseline 登记 exact source set"——
**该处置未实际落到 baseline 字节**。P6-1 是 RP-04/05/06 三个实现面的唯一 source 依据，
分母不全会直接传导到后续三个 package 的 change surface。

**最小修订**：
把上表 8 类缺失 source 的**确切文件路径**补进 `baseline.json` 的 `S0-C.sourcePaths`；
为 `S0-C` 增加 per-file `sha256`（design `:66` 已自称有）；
把 `libraries/frontend/admin-ui-foundation` 替换为 `safeLogger.ts` 等确切文件。

**是否需要 Dexter 裁决**：否。

## 3. M2 ｜design/baseline 声明 `implementationAuthority: true`，违反 POST_REMEDIATION_V1

**位置**：`s0-implementation-design.md:6`、`s0-baseline.json:8`

```
s0-implementation-design.md:6     implementationAuthority: true
s0-baseline.json:8               "implementationAuthority": true
s0-post-round2-intake-codex.md:4  implementationAuthority: false     ← 自相矛盾
s0-post-round2-intake-codex.md:21 "implementationAuthority 保持 false，需 Claude recheck"
```

**治理原文**（`doc/decisions/2026-07-26-v2s-post-remediation-review-binding-governance.md:45-46`）：

> "current bytes 仍必须交 Claude recheck，Dexter 接受前**不得称设计 GO，更不产生 implementation authority**。"

该治理文件自身 `:7` 与其 schema 示例 `:35` 也都是 `implementationAuthority: false`。

**当前三重冲突**：
(a) 独立 verdict 是 `NO_GO`；
(b) 治理明令 recheck 前不产生 implementation authority；
(c) 本包自己的 intake 写 `false`。
**而实施者真正会打开的两个文件（design + baseline）都写着 `true`。**

**影响面**：这不是措辞瑕疵。若有人只读 design/baseline（这正是实施者的入口），
会得出"S0 已授权实施"的结论，而实际状态是 NO_GO 且待 recheck。

**最小修订**：两处改为 `false`；待 Dexter 接受本 recheck 后，
再按既有流程另行授予实施授权，**不由设计文件自述**。

**是否需要 Dexter 裁决**：否（治理已明文规定）。

## 4. S1 ｜RP-00b 的机械可执行性仍不完整（原 `M3` 部分闭合）

**已闭合的部分**（我确认）：`executionClass` 五值、`VERIFY` 必须恰有一个 `scripts/verify` 引用、
非 `VERIFY` 必须有 source-bound 非空 reason、`ALIAS` 只指向 canonical —— 这些在
design `:52` 与 baseline `:18` 都有，**确实是可机械判定的谓词**。

**仍不完整的三处**：

**(1) `executionClass` 值域不自洽。**
design `:52` 声明 `executionClass=VERIFY|PACKAGE_ONLY|CLOSED_PHASE|REPORT|NOT_RUN`（**5 值，不含 ALIAS**），
而 baseline `:18` 的 `executionClassPredicate` 有 **6 个键，含 `ALIAS`**。
按 design 实现的 checker 会拒绝 `ALIAS`，按 baseline 实现则接受 —— **两份规范给不出同一个判定**。
（`ALIAS` 在 `:48` 属于另一套 `classification` 值域 `TRUE_GATE|REPORT|PARAMETER_GATE|PHASE_MODE|ALIAS`，
两套值域重叠但未声明关系。）

**(2) `aggregate` 谓词被引用但从未定义。**
design `:48` 要求每个 wrapper 记录"**是否允许 aggregate**"，
baseline `:16` 的 `redProofs` 含 `aggregate-reference-missing`，
但**全文没有任何一处定义 aggregate 的判定条件**。
一条 red proof 指向一个未定义的谓词，无法实现也无法验证。

**(3) red mutation 少于 design 自述。**
design `:52` 要求"至少四个 red mutation：新增 wrapper 未登记、**登记路径不存在**、
**VERIFY 未被 verify 引用**、非 VERIFY 被错误引用或缺理由"。
baseline `redProofs`（`:16`）中属于 S0-A 的只有
`wrapper-not-registered` 与 `aggregate-reference-missing` 两条 ——
**"登记路径不存在"与"VERIFY 未被 verify 引用"缺失**，且后者正是 `VERIFY` 谓词的核心红控制。

**最小修订**：统一 `executionClass` 值域（把 `ALIAS` 明确为 executionClass 之一，或在 baseline 中移出并声明它属 classification 轴）；
补 `aggregate` 的判定条件；把 design `:52` 的四条 red mutation 逐条落进 baseline `redProofs`。

**是否需要 Dexter 裁决**：否。

## 5. S2 ｜"完整六类 denominator"表实际只有六列中的五类 + 缺 `detail-design`

**位置**：`s0-implementation-design.md:29-36`（表）对 `:80`（§3）

`§3 :80` 声明后续 manifest **必须**声明七项：
六维 memory route、原始业务/标准 source、approved assertions、forbidden pseudo-fixes、
**detail-design/incremental criteria**、owned source/change surface、due standards rule IDs。

`§0.1` 的表（自称"每个 unit 的**完整六类** denominator"）只有六列：
`memory/assertion | original/standard source | approved assertions | forbidden pseudo-fixes |
exact source/change surface | due standards` —— **缺 `detail-design/incremental criteria`**。

**这不是措辞差异**：仓内 `tools/implementation-design-granularity/cli.mjs` 中
`detailDesign` 出现 **10 次**（另有 `detailDesignText`/`detailDesignSource`），
说明它是该 checker 实际要求的一类，**不是可省略项**。

**影响面**：`§0.1` 明写"后续 implementation manifest **必须保留这些** source/hash，
不得改成目录泛称或延后补齐"。被冻结的表缺一类，下游四个 unit 的 manifest 会集体继承该缺口，
且会在 `implementation-design-granularity` 处才暴露。

**最小修订**：`§0.1` 表补 `detail-design/incremental criteria` 列，四个 unit 各自填写；
或在表头明确说明该类由别处承载并给出落点。

**是否需要 Dexter 裁决**：否。

## 6. N1 ｜`S0-B`/`S0-D` 同样无 per-file hash

baseline 四个 unit **均只有 `sourcePaths`，无 hash**；
唯一的 hash 是 `scriptCheckPathEnumeration.sortedPathSha256`（`:19`，仅覆盖 S0-A 的 38 wrapper 枚举）。

`§0.1`（`:29`）要求"后续 implementation manifest 必须保留这些 **source/hash**"。
`S0-C` 的缺失已按 `M1` 处理（因 design `:66` 明确自称有）；
`S0-B`/`S0-D` 因 design 未对其声称 hash，故只作 `N` 记录：
建议一并补齐，否则"冻结分母"在字节层面不可复验。

## 7. 我确认为正确、不应回退的部分

- **RP-12-pre 的 `NOT_APPLICABLE`**（`§1`）：理由属实、调用链我已独立验证、
  从 redProof 分母排除、记录了重开条件。**Round-2 `M1` 已真正闭合。**
- **38 wrapper 分母可复算**：`:48` 给出精确命令
  `find scripts/check -maxdepth 1 -type f -perm -111 -print | LC_ALL=C sort`
  与 count/hash，baseline `:19` 一致 —— Round-2 `S1` 的这一半确已闭合。
- **三个分母不相加的边界**（`:48`）：38 wrapper / 23 verify 单元 / 16 catalog ref
  明确"三者不能相加"，与我在全工程终稿中的实测口径一致。
- **`scripts/verify --validate-only` 不得标为静态轻量门**（`:50`）——
  这是我未发现的边界，属本设计的实质增量。
- **RP-02a 不等 D4**（`:84`）：正是我在计划复审 `S2` 提出的解耦，已被采纳。
- **`673` 不得与 `477/320` 相减**（`:72`）：我在计划复审 `S1` 提出的分母单位混用已被更正，
  且改用 `NODE_TYPE_JAVA_TOKEN_OCCURRENCES=477` / `LINES=320` 的明确命名。
- **`SQL 4` 不得预填**（`:72`）：比我原始报告更严谨 —— 我那 4 是按行正则得到的，
  设计要求单引号 SQL literal 另行扫描，正确。
- **10 个缺 fact 的 operation 被逐个列名**（`:58`），而非"补齐缺失项"的泛称。

## 8. 处置

- **`M1`/`M2`** 必须在 Dexter 接受前修订：前者补 baseline `S0-C` 的 8 类 source 与 per-file hash，
  后者把两处 `implementationAuthority` 改为 `false`。二者都是字节级小改，无需重开设计。
- **`S1`/`S2`** 建议同批修订，均在既有边界内。
- **`N1`** 建议一并补齐。
- **本 recheck 不授权**源码、契约/schema、脚本行为、runtime、DEV、seed/reset、HTTP/L2、
  Roadmap 或任何后续单元实施。即使修订后转 GO，S0 之后的源码实施仍须单独 package、
  independent implementation review 与 evidence closure。
- 我**未改写** Round 2 的历史 `NO_GO`，**未创建**第三轮独立审查。
