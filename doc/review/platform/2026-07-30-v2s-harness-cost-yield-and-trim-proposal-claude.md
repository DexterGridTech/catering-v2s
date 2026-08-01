---
title: 治理机制成本/产出评估与收缩方案（Claude，供 Codex 执行）
reviewTarget: PROCESS
scope: hook / receipt / package-exit / 工件体量的成本与缺陷检出产出评估，及收缩方案
verdict: PROPOSAL
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 本文件是评估与方案建议；任何控制的删除/降级须由 Dexter 批准后执行，且不授权在批准前改动任何 gate、hook、tool 或 evidence 结构
createdAt: 2026-07-30
---

# 治理机制成本/产出评估与收缩方案

> **本文件的立场**：这是一份**净删除**方案。任何"为了修复过度工程而增加工程"的建议都不写进来。
> 我在上一轮曾建议把 pre-receipt 升级为记录"写前读过哪些文件"，**该建议在本文件中撤回**，理由见 §2.3。

---

## 1. 背景

### 1.1 Dexter 的观察

> "现在 codex 开发效率非常非常的低，可能花了 80% 的时间在 harness 上，20% 的时间是在做业务实现，
> 但是也没觉得质量有多高，还是错误百出，还是要经常回头去改。"

本文件的目的是把这个观察**量化**，找出成本落在哪里、产出落在哪里，然后给出可执行的收缩方案。

### 1.2 体量事实（本会话实测）

| 项 | 实测 |
| --- | --- |
| `doc/evidence/platform/rm1/p6` | **213 文件 / 2.1M** |
| `doc/review/platform` | **268 文件 / 3.5M** |
| **治理工件合计** | **≈ 481 文件 / 5.6M** |
| `platform-admin/src` 生产源码（不含 test） | 278 K |
| P6 相关后端（`app/edge` + `platform-admin-iam` + `workspace-iam`） | 701 K |
| **生产源码合计** | **≈ 979 K** |
| 治理工具本体（5 个 cli.mjs） | **526 K**，其中 `tools/compliance-control/cli.mjs` 单文件 **234 K** |

**治理工件是其所治理的生产源码的约 5.7 倍**；单个合规控制器（234 K）比整个 platform-admin 前端（278 K）还大。

### 1.3 与仓内自定标尺的冲突

`CLAUDE.md` 的右尺寸标尺原文：

> 当前阶段是一人 + 两个 AI（Codex 实现、Claude 评审）快速迭代……
> 工程建议按"**分钟级、零基建、防回归**"过滤。

234 K 的合规控制器、每包 89 条带 hash 的双向 exact-set 收据、prewrite baseline、correction audit
——**没有一项通过这条自定标尺**。机制已经偏离了它自己写下的尺寸约束。

### 1.4 产出分析：哪些控制真的抓到过错

我把本会话（P6-1 / P6-2 / P6-3 设计与实现共十余轮复审）中发现的全部缺陷回溯了来源：

**有产出的控制**

| 来源 | 实际抓到的缺陷（举例） |
| --- | --- |
| **直接读源码** | `WorkspaceRoleService:66` generic update 绕过状态命令；`OperationsContractController:48` 把 assignment/visibleDataNode 丢弃导致 contract 无法按任职授权；门店/品牌列表筛选实际在 edge 而非 owner；`HeadCompanyBrandAuthorizationInUseException` 塌缩为 `PLATFORM_COMMON_VERSION_CONFLICT`；`overlayLock`/`observedBaseQuery` 两个 foundation 不存在的导出名（88 处）；切上下文不重置分页；IA04 第 72 行与另三处自相矛盾；2 处 package/目录不一致；U04 再生成打断 operations typecheck |
| **带真实红变异的机器门** | `edge-codegen` 的 ROLE_HOME 两条红；`capability-invariants` 的 20 条自测红；`frontend-architecture` 的候选 loading 失败态红 |
| **focused test** | U06 的 proof 自身最初失败——断言了不存在的 `platformPasswordOtpLogin` |
| **typecheck** | operations 侧 bulk-replace 调用与生成契约不一致 |
| **scratchpad 红变异**（人工） | 证明 granularity checker 对 D2–D6 只做形状检查（四类假绿） |

**零产出的控制**（本会话每一轮都跑，**每一轮都是 PASS / 0 不符**）

- `actualChangedPaths == incrementalChecks` 双向 exact-set（跑过约 6 次）
- `afterSha256` 逐条复算（跑过约 6 次，累计数百条）
- `sourceComplianceDisposition` hash 绑定
- prewrite baseline、correction audit
- 逐点预读纪律的**记录**要求（不仅零产出，同族已**失败三次**）
- `hookInvocationCanary`

**唯一的例外，且很说明问题**：granularity checker 抓到过一次 `D1_ROUTED_SOURCE_SET_MISMATCH`
（我在 P6-1 实现复审报的 M1）。但它抓到的是——改了一个 project-memory 文件，
导致另一份 manifest 里绑定的 hash 陈旧。**它抓的是记账机制自己制造的问题，不是业务风险。**

### 1.5 诊断：为什么 80% 的投入换不来质量

**因为这 80% 结构上就看不见那些错。**

收据机制证明的命题是"我列出的文件就是我实际改的文件"和"hash 对得上"。
而实际发生的缺陷全部是**语义 / 契约层**的：owner 方法不接收这个参数、异常落到父类映射、
声明的符号在 `index.ts` 里不存在、OpenAPI 声明了但 controller 没有转发。
**这些缺陷无论收据跑多少遍都是绿的。**

更严重的是，**体量本身在制造缺陷**，且有两个已确证的实例：

1. `overlayLock` / `observedBaseQuery` 两个不存在的 foundation 导出名共 88 处，
   **恰恰出现在为满足 import-equality 分母而新写的那份工件里**——
   而同期 94 个 IA screen 的 `FOUNDATION_PRIMITIVE` 声明**零错误**。
   错误是被"再写一份分母"这个动作引入的。
2. IA04 第 72 行的多选草稿残留能存活，是因为同一事实写在三处，改了两处漏一处。

**工件越多，互相矛盾的面越大；而互相矛盾恰恰是机器最难发现的一类。**

### 1.6 根因：只有"加门"的规则，没有"减门"的规则

`project-memory/operations/verification-governance.md` 对**新增**机器门定了三问
（反复发生、纯机械、维护成本小于返工），并要求以 production 驱动和真实 red mutation 证明能拒绝错误行为。

**但没有任何规则规定一个控制在什么条件下应当被降级或删除。**
于是控制只增不减，每个 finding 都倾向于产出一个新工件或新分母。这是体量失控的结构性原因。

---

## 2. 方案

### 2.0 总原则

- 这是一次**净删除**。收缩后工件总量应显著下降，工具总字节数应下降，不得以新增控制替代。
- **不得削弱任何曾经变红的控制。** 判据见 §2.4。
- 分阶段执行，每阶段可独立回滚；不与 P6-3 业务实现并行，避免混淆归因。

### 2.1 保留（有实测产出，且符合"分钟级"）

**这些一条都不要动**，它们是本会话全部缺陷检出的来源：

- `typecheck`（前后端）——成本最低、产出最高的一条
- **sibling focused test**（`*.test.tsx` / owner service test）
- 带**真实红变异**的机器门：`capability-invariants`、`edge-codegen`（含 `--check` 与 drift）、
  `frontend-architecture`、`security-boundaries`、`openapi-contracts`
- generated 输出的 drift 检查与 `do not edit` 头
- 契约与 owner 的 exact-set 类不变量（如 22 条 public security operation 的启动校验、
  34 ACTION 的 target/face/角色子集）

### 2.2 大幅收缩（零产出，但保留最小形态）

**package-exit 的六类分母与收据链**：

- 保留**一条**：本包实际改了哪些文件（`git status` 级别即可，供人工与评审定位）。
- **删除**：`actualChangedPaths` 与 `incrementalChecks` 的**双向 exact-set 校验**、
  每条的 `afterSha256` 记录与复算、`sourceComplianceDisposition` 的 hash 绑定。
  理由：本会话累计复算数百条，**零命中**；它们证明的命题不是任何一次真实缺陷的成因。
- 结果预期：单包 exit 从 89 条带 hash 的结构降为一份路径清单，
  `tools/compliance-control/cli.mjs`（234 K）应有可观削减。

### 2.3 删除（试图证明无法证明之事）

- **prewrite baseline**
- **correction audit**（逐点 pre/post 记录）
- **逐点预读纪律的"记录"要求**（纪律本身可以作为建议保留在 project memory，
  但不再要求产出证明其发生的工件，也不再作为 review 的阻断项）

共同问题：它们试图证明"人/模型在写之前想过什么"。这在原理上不可事后证明，
同族已经**失败三次**（`F-EXECUTION-CADENCE-AND-POINTWISE-REREAD` 及两条 `-RECURRENCE`），
这本身就是它不可行的充分证据。

> **撤回声明**：我在 U06 复审 §4 曾建议把 `PreToolUse` 的 pre-receipt 升级为记录
> "自上次写入该 path 以来读过哪些 IA/design 文件"。**该建议撤回。**
> 按 §1.4 的产出数据，那是在给一个从未造成业务缺陷的问题再加一层 harness，方向错误。

### 2.4 新增（唯一一条，且是为了减而不是加）

在 `project-memory/operations/verification-governance.md` 补一条**退役判据**，与既有"加门三问"对称：

> **控制退役判据**：一个机器门 / 分母 / 记录要求，若在**最近 5 个 package** 中
> **一次都没有变红**（即从未拒绝过任何一次错误行为），则必须在下一个 package 显式处置：
> 降级为人工 checklist、缩小到最小形态、或删除。
> 保留它需要写明"为何仍需保留"及其**预期拦截的具体失效模式**。

这条规则本身是零成本的（判据是"有没有红过"，本来就有记录），
但它把"控制只增不减"这个结构性问题堵住了。**这是本方案唯一新增的东西。**

### 2.5 执行顺序

1. **先做 §2.4**（写入退役判据）——它是后续删除的依据。
2. **再做 §2.3**（删除三项）——纯删除，风险最低，立刻释放 Codex 的时间。
3. **最后做 §2.2**（收缩收据）——需要改 `compliance-control` 与 exit schema，
   分两步：先停止**校验**，观察一个 package；无问题再删除**结构**。
4. §2.1 全程不动。

### 2.6 验收（不要为验收再造一套证据）

收缩完成的判据就三条，都可当场看：

- `tools/` 五个 cli 的总字节数**下降**（当前 526 K）；
- 单个 package 的 evidence 文件数与总字节**下降**（当前 P6 为 213 文件 / 2.1M）；
- §2.1 列出的门**全部仍 PASS，且其 `--self-test` 的红条目数不减少**。

第三条是关键：**它证明收缩没有削弱真正的防线。**
不要为这次收缩本身再产出 prewrite baseline、correction audit 或收据链——那会自相矛盾。

---

## 3. 需要 Dexter 裁决的点

1. **是否批准本方案的整体方向**（净删除，而非再加一层）。
2. **§2.2 收据保留到什么程度**：我建议只留"改了哪些文件"的清单；
   若你希望保留 hash 以便追溯历史，请明确说明**它要拦截的具体失效模式**——
   目前我找不到一个由它拦下的实例。
3. **§2.4 的"最近 5 个 package"是否合适**——这个窗口是我给的建议值，可调。
4. §2.3 删除后，`F-U06-POINTWISE-REREAD-APPLICATION-RECURRENCE` 一族的
   prevention 应改为**不设机器预防**（承认它不可机械化），还是保留为纯建议性纪律。

---

## 4. 一句话总结

**现在的机制在防"记账不实"，而实际风险是"语义不对"。防错了对象。**

本会话我找到的每一个缺陷，**没有一个需要 5.6 M 工件才能发现**——
全部来自打开文件读源码、跑 typecheck、或让一条真门变红。
收缩这些零产出的记账负担，不会降低质量；把省下的时间用于"把自己写的代码当陌生人的代码再读一遍"，
才是对 `错误百出、经常回头改` 的直接回应。
