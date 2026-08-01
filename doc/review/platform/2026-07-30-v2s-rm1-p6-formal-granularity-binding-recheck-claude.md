---
title: RM1 P6-1 formal granularity-gate binding 整改后独立复核（Claude）
reviewTarget: DESIGN
scope: RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730 current bytes（design、manifest、author intake、R1/R2 verdict）
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 implementation-facing design recheck；不授权任何源码、契约、生成物、动态运行或 Roadmap 状态变更
createdAt: 2026-07-30
---

# RM1 P6-1 formal granularity-gate binding 整改后独立复核

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。**本 GO 仅代表静态 implementation-facing design admission。**

### 这份工作到底解决什么问题、解决了没有

它声称的问题是：**现有生产 gate 对 D1 是真判，对 D2–D6 只看形状**——
声明一个不存在的 source、一个陈旧 hash、一个重复/缺失的 Markdown 锚点或一个无效 JSON 指针，
门仍然绿。这是"假绿"，不是笔误。

**我没有采信这个说法，而是在 scratchpad 完整拷贝上做了红变异实测**：

| 变异 | `scripts/check/implementation-design-granularity` 结果 |
| --- | --- |
| D3 `FORBIDDEN_PSEUDO_FIXES` → 不存在的路径 + 全零 hash + 无法解析的 selector | **PASS**（假绿） |
| D6 `DUE_STANDARDS_RULE_IDS` → 陈旧 hash | **PASS**（假绿） |
| D5 `OWNED_SURFACE_AND_PAGE_KEYS` → 无效 JSON 指针 | **PASS**（假绿） |
| D2 `APPROVED_ASSERTIONS` → 缺失 Markdown 锚点 | **PASS**（假绿） |
| D1 `PROJECT_MEMORY_ASSERTION_OCCURRENCES` → 删掉一条 routed source | **FAIL** `D1_ROUTED_SOURCE_SET_MISMATCH:RM1P6-FORMAL-GRANULARITY-U01` |

源码层面也对得上：`tools/implementation-design-granularity/cli.mjs:280-307`
的 `validateUnitSourceCompliance` 只对 `PROJECT_MEMORY_ASSERTION_OCCURRENCES` 调
`validateD1OwningSourceSet`（`:255-279` 会从 `project-memory/index.json` **重算**并做有序集合相等），
其余五项只校验字段非空、`applicability` 不含 `PENDING`、`missingEntryFails===true`、
`owningSourceSet` 非空数组——**从不打开文件、不复算 SHA、不解析 selector、不做 owning-source 比对**。

**所以：问题是真的，四条假绿是我自己造出来的，不是作者的说法。**
方案（扩展既有 checker、显式禁止另建旁路、定义有限 selector 文法、为五类失败各配红夹具）是最小且正确的；
更小的替代（散文清单或宽松 checker）作者在 `§1` 已明确排除，理由成立。
**这不是凑 GO，是把一处真实假绿写成了可执行契约。**

### 五个核验重点

| 重点 | 结论 |
| --- | --- |
| ① D1 六维 route exact owning-source set | **CONFIRMED**：实跑 `design/backend/backend/platform/governance/implementation` 返回 **12** 条，与 manifest `owningSourceSet` 的 12 条**路径逐条相等**；12 个 source hash 全部复算一致 |
| ② 扩展既有 checker、不另建旁路 | **CONFIRMED**：`changeSurfaces` 第一条即 `tools/implementation-design-granularity/cli.mjs` `update`；`§3` 与 `forbiddenPseudoFixes` 双处禁止"second relaxed checker / bypass"；`§2.3` 明确要求 reopen + 真实 SHA + selector 校验 + 归一化 owning-source 集合相等，并要求五类真实红夹具 |
| ③ no-UI 绑定 | **CONFIRMED**：selector 为 `json:/surfaces,json:/pageDesignKeySurfaceCrosswalk`，两个 RFC6901 指针我逐个解析，**均 resolve 到非空值**；`applicability=APPLICABLE_NO_UI_SCOPE` |
| ④ R2 两个重复 Markdown selector | **CONFIRMED 已修**：D3/D4 已改绑两句唯一规范句；我对三条 `md:` 字面量逐个计数，**全部 exact-once**（原 `## 3. …`/`## 4. …` 各出现两次的问题不再被用作 selector） |
| ⑤ 不伪称已实现、不扩大范围 | **CONFIRMED**：全文无"already implemented / now validates"式表述；`§2.3` 明写"must therefore be extended **as part of the later authorized implementation**"；`dataEvolution` 与 `uiAndTerms` 均为 `notApplicableReason`；`§2.1` 明确不授权 UI、生成物手改、migration、DEV、seed/reset、Roadmap |

### 其他机械复算

- manifest 的 `design` / `authorization` / checker `script` / checker `tool` **4 处绑定 hash 全部复算一致**
- `postRemediationDeclaration` 的 `reviewSha256`、`intake.sha256` **复算一致**；
  `reviewedManifestSha256`（`7e45b05f…`）与当前 manifest（`5774eae9…`）**不同**，
  正确表示"当前字节是 R2 之后的整改字节"，未冒充已审
- `currentBytesNotReviewedByAdversarialReviewer=true`、`claudeRecheckRequired=true`、
  `implementationAuthority=false` 均保留；R2 `roundFinalDecision=SELF_DECIDED`、
  `reviewRound=2/2`，**未开第三轮**
- checker 实跑当前 manifest：`PASS / UNITS=1 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；红变异全部在 scratchpad 拷贝上做，用后即弃。

---

## 1. S1 ｜`md:` 字面量含逗号，与本设计自己的"逗号分隔 selector 列表"文法冲突 —— `CONFIRMED`

**owning source**：design `§2.3`（`:44-48`）定义的有限文法：

> - `md:<literal anchor>` means the literal exists **exactly once** in a UTF-8 text source;
> - `json:<RFC 6901 pointer>` …;
> - **a comma-separated selector list requires every member to resolve**, and is normalized in declared order.

**当前字节**：manifest `FORBIDDEN_PSEUDO_FIXES` 的 selector 为

```
md:Formal prohibition completion invariant: a source binding is never replaced by prose, a scanner result or an exit code.
```

该字面量**自身含一个逗号**（`…by prose，␣a scanner result…`）。

**反例（我在解析时实际撞到）**：按 `§2.3` 的第三条规则做逗号切分，这条 selector 会被拆成两个 member：

1. `md:Formal prohibition completion invariant: a source binding is never replaced by prose`
2. ` a scanner result or an exit code.` —— **没有 `md:`/`json:` 前缀，不是合法 member**

未来 checker 有两种实现，都不理想：严格实现会因第 2 个 member 无前缀而报文法错误；
宽松实现会把它当裸字符串做子串匹配——它恰好存在，于是**偶然通过**，而"偶然通过"正是本设计要消灭的东西。
另外两条 `md:` 与两条 `json:` 均不含逗号，**本条是唯一冲突项**。

**适用边界**：这不影响当前 gate（D2–D6 还没被 reopen），也不影响 `§2.3` 的方向；
它是**文法规范自身的自洽缺陷**，只在有人真去实现文法时爆发——而那正是本设计的交付物。

**最小修复**（二选一，都不动交互或范围）：

- **(a) 推荐**：把 D3 绑定改为该节内一句**不含逗号**的唯一规范句，
  例如把 `§3` 的不变量句改写为"Formal prohibition completion invariant: a source binding is never
  replaced by prose or by a scanner result or by an exit code."，并同步 manifest selector；
- (b) 在 `§2.3` 补一条转义/引号规则（例如"`md:` 字面量若含逗号必须整体加引号"），
  并把该 selector 改成带引号形式。

**(a) 更小**：不引入转义语法，也就不需要为转义再写红夹具。

---

## 2. N（观察项，不阻塞）

**N1 ｜被 R1-M-002 判死的非法标签 `pageDesignKeys` 仍残留两处**

R1-M-002 的结论是"`frontend-asset-carryover-manifest.json` 没有顶层 `pageDesignKeys`，
实际结构位置是 `pageDesignKeySurfaceCrosswalk`"，`§3` 也把它写成明文禁止项
（`:60` "use an informal field label such as `pageDesignKeys` when the owning JSON has a different
actual structured location"）。**selector 已正确修复**，但同一标签仍存在于：

- design `§2.2` 第 5 项（`:35`）："`contracts/policy/frontend-asset-carryover-manifest.json`
  `surfaces and pageDesignKeys`" —— 设计正文与自己 `§3` 的禁止项、`§2.3` 的正确绑定三处不一致；
- manifest `deliveryUnits[0].uiAndTerms.termSource`（`:165`）：
  "…frontend-asset-carryover-manifest.json **surfaces and pageDesignKeys**"。

无门后果（`termSource` 与 `§2.2` 散文都不是 selector，当前 checker 也只做形状校验），
但这正是本 cycle 已判定的错误标签仍留在其两份权威工件里。
同类还有 `§2.2` 第 6 项写"`rules enforcement phase R5`"，而 manifest 实际绑 `json:/rules`
（RFC6901 无法表达 phase 子集，绑整个 `/rules` 是诚实的，phase 过滤由
`scripts/check/standards-coverage --phase R5` 另行承担）。

**最小修复**：`§2.2` 第 5/6 项与 `termSource` 改为与 `§2.3` 一致的实际 JSON 位置写法。

**N2 ｜更新 `cli.mjs` 会同时打断 4 个已绑定单元的 checker 自绑定，ordered chain 未提**

`cli.mjs:346-350` 的 `validateArtifactBinding(root, checker.script, …)` 会**校验 checker 自身的
script/tool hash**。而本 manifest 与 `rm1-u09-implementation-design-granularity-manifest.json`
（`RM1P6-U01/U02/U03` 三个单元）**绑的是同一个 tool hash `b58042387875e9b0…`**（我已比对确认）。

因此未来实现 `§4` 要求的 D2–D6 reopening 时，一旦修改 `cli.mjs`，
**本 cycle 的 1 个单元 + P6 的 3 个单元、共 2 份 manifest 会同时因 tool-hash 漂移而 FAIL**。

**这不是假绿**——它会立刻显性失败，实施者必然发现；但本设计的 `orderedChain` 与
`dependencyAndSerialBoundaries` 恰恰是用来写这类前后置关系的，此处漏了一步。
**最小修复**：在 `orderedChain` 里补一步"更新 checker 的同一变更内，重新冻结所有绑定其
script/tool hash 的 manifest"，或在 `§4` 点名这两份 manifest。

---

## 3. 方案合理性判断

**问题对不对**：对，且已由我的红变异独立证实（四条假绿）。
`§1` 对"delivery user 是 P6 实施/评审操作者"的界定也准确——这确实是控制面问题，不是产品 Journey。

**方案优不优**：优。关键取舍是"扩展既有 checker 而不是另建"，
并把"另建旁路"写进 `forbiddenPseudoFixes`——这防的是最容易发生的偷懒路径。
selector 文法**刻意有限**（只有 `md:` 与 `json:` 两种）也是对的：足够表达五类绑定，
又不至于引入一个查询语言。

**代价配不配**：配。零新基建，一份 manifest + 一次 checker 扩展 + 五类红夹具；
`§2.1` 明确不扩大到 UI/migration/DEV/seed/Roadmap，`dataEvolution` 与 `uiAndTerms` 都是 N/A 且理由具体。

**一个值得记的正面细节**：R2 的结论没有把"D2–D6 尚未 reopen"当作**当前**设计失败
（"The design honestly leaves D2–D6 source reopening to its later authorized implementation,
so that absence is not treated as a present design failure"），只就当前字节能判定的
selector 唯一性提 M。这个边界拿捏是对的——**否则会把"未来要做的事"误判成"现在做错了"**。

---

## 4. 处置与授权边界

`M=0 / S=1 / N=2` → **GO**。

- **无需 Dexter 产品裁决**。S1 是改一句不含逗号的规范句 + 同步 selector；
  N1/N2 是标签统一与补一步 ordered chain。**均不改范围、不改交互、不动源码。**
- **建议 S1 与本轮其他修订一并处理**：它是本设计交付物（selector 文法）自身的自洽缺陷，
  留到实现期才发现会连带影响红夹具设计。
- **本 GO 的含义**：该 formal binding 的静态设计可进入后续**单独授权**的实施请求；
  D1 已实证 fail-closed，D2–D6 的 reopening 是**尚未实现的未来义务**，当前工件也如实这样声明。
- **本 GO 不代表**：checker 扩展已完成、D2–D6 已被约束、历史独立审查复绿，或任何实施授权。
  `VERDICT=NO_GO` 与 `currentBytesNotReviewedByAdversarialReviewer=true` 仍是 manifest 当前事实，应保留。

**本复核不授权**：任何源码、契约、生成物修改，动态运行、DEV、seed/reset、
Roadmap 状态变更或仓库控制操作。
