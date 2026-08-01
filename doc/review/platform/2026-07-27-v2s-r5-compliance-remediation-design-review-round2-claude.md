---
title: R5 合规整改候选 Roadmap、详设与计划 Claude recheck（round 2）
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
reviewTarget: DESIGN
reviewRound: POST_REMEDIATION_CLAUDE_RECHECK_2
verdict: GO
counts: {M: 0, S: 0, N: 2}
supersedes: doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-review-claude.md
reviewSessionProvenance: FRESH_V2S_ROOTED_THIS_SESSION
reviewTargets:
  delegatedDecisions: {path: "doc/decisions/2026-07-27-v2s-r5-compliance-remediation-delegated-decisions.md", sha256: "3624fe4f319b21d04ef8b6953eed9f049667ed2c857850bbe520176d8609dd56"}
  design: {path: "doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md", sha256: "56a6fcaf8e42d80de04693940624f27071fcc2303b18b6826805637c07ed68ab"}
  manifest: {path: "doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json", sha256: "e05265666c82c40398b0c991e285cda6a56183807196ce65e85364df334dea0d"}
  intake: {path: "doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-post-remediation-intake.md", sha256: "15c544a7b20203f1f5b1776d55e2ab7b947659d478e29e29e19d7f6765443020"}
---

# R5 合规整改候选 Roadmap、详设与计划：Claude recheck（round 2）

## 0. 结论

**GO（M=0 / S=0 / N=2）**。

上一轮的 M-1、S-1、N-2 全部真实关闭，且关闭方式**精确命中要害**——尤其 M-1 不是靠加一句
承诺，而是把"证明客户端触发"与"证明引擎会红"在设计层面显式区分并互不替代，同时补了一条
不依赖 hook 自报的独立兜底探测器。两条 N 是登记项，不构成接受障碍。

四份核心文件 sha256 逐个复算，**与请求给出的值完全一致**。

## 1. 上一轮 findings 的逐项复验

### M-1（强制链最顶端无红证明）→ **CLOSED**，两个子缺口都补上了

**（1）canary 证明的是客户端真实触发,不是引擎会红** —— 核验点 1 ✅

`design:151-155` 明确写：`.codex/hooks.json` 当前只证明既有 `SessionStart/UserPromptSubmit/Stop`
的客户端 parser 兼容性，**"不能外推" `PreToolUse/PostToolUse` 也被支持**；并**逐项列出禁止的
替代证明**——JSON schema 静态解析、直接调用 hook 脚本、引擎 self-test，三者均不得冒充客户端
触发证明。这正是我上一轮指出的混淆点，被显式钉死。

canary 协议（`:157-164`）六步，关键在第 2 步：**"通过真实 Agent 文件写动作改变一个受保护
canary path，不直接执行 hook 命令"**——证明对象是"调用发生"，不是"引擎能红"。
第 4–5 步是真正的负向夹具：在第二份 scratch copy 删除/改错 `PostToolUse` 注册、重复同一真实写
动作，必须以 `HOOK_INVOCATION_RECEIPT_MISSING:<path>` 精确红。第 6 步恢复注册后重跑 PASS 并
单独记录 cleanup。clean→red→clean 三态齐全。

**（2）unsupported hook event 确实阻断 CR00** —— 核验点 2 ✅

`design:166-168`：若当前 Codex client 不支持该事件或无法给出可绑定的事件输入，
CR00 必须 `FAIL / CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED`，并明写
**"不得靠包尾扫描把'做一点验一点'降级为'做完再验'。包尾独立 set equality 是兜底探测，
不是 hook 的替代。"** 这句话堵死了唯一可能的降级路径——正是我上一轮担心的那条。
`CR00 ordered chain :330` 亦为独立步骤"运行真实 Codex client invocation canary……未证明即红"。

**（3）actualChangedPaths 独立于 hook 自报，且与 incrementalChecks 非空 exact set equality**
—— 核验点 3 ✅

`design:266-271`：每包入口在任何包内写入前对受治理仓库树创建独立 baseline
（`path + kind + sha256|ABSENT`），枚举器从 manifest change surfaces 与 repository governance
include/exclude contract 派生，**"不读取 Git 状态、不依赖 hook 自报"**。
出口先重新枚举再生成 receipt。

这个设计有一个我要特别肯定的副效果：它**同时绕开了本仓"`apps/` 未被 git 跟踪、无 commit
基线"这一既有事实**（我在诊断件中标为 `UNVERIFIED` 的那条）。若枚举依赖 git，兜底本身会失效。

`:290-291`：`set(paths(incrementalChecks)) == set(paths(actualChangedPaths))`，
且 CR00～CR08 集合必须非空，CR09 至少包含本轮 review/evidence 新产物。

**（4）空、缺、多、越界四类都有具名红** —— 核验点 4 ✅

| 情形 | 具名红码 | 出处 |
| --- | --- | --- |
| 缺项 | `INCREMENTAL_CHECK_MISSING:<path>` | `design:292` |
| 多项 | `INCREMENTAL_CHECK_UNKNOWN:<path>` | `design:292-293` |
| 空集 | `INCREMENTAL_CHECKS_EMPTY` | `design:293` |
| 越界 | `UNAUTHORIZED_CHANGED_PATH:<path>` | `design:294` |

另加一条我上一轮没想到、但确有必要的：`:295` 要求每个 incremental check 的 `afterSha256`
必须等于 exit 期枚举值——堵住"hook 报了一个陈旧 hash"的旁路。
`:297` 收口："`actualChangedPaths` 在 receipt 期独立计算，所以即使 PostToolUse 完全没有触发，
包尾也必然红。"`:298` 处理了 receipt 自引用。

### S-1（15 条充当分母）→ **CLOSED** —— 核验点 5 ✅

`CR00 ordered chain :331-332`：「由 accepted source 派生规则集**重新扫描当前树**，得到当前
forbidden 违反集合并逐条命中；诊断报告的 15 条**仅作交叉核对，差异写 receipt，
不作为分母或完备性声明**」。措辞与我建议的最小修复一致，且与 §1.1"数字是时点快照、
只冻结零漂移目标与复算算法"自洽。

全文检索确认："15" 现仅剩三处，均非分母用途：`:68`（描述 checker 旧的硬编码缺陷）、
`:332`（交叉核对）、`:428`（`R-15` 决策编号，无关）。

### N-2（provider-free-context 归包与双层准入）→ **CLOSED** —— 核验点 6 ✅

`design:240-245` 把"测试前全量扫描"固定为**两个顺序层，二者都绿才允许启动测试**：

1. `remediation-compliance --scope repository --through <current-package>`（source-derived aggregate）；
2. 从现有 gate catalog **动态解析**所有 `phase <= R5` 且标记为静态 test-admission 的独立门并执行，
   **包括 `provider-free-context`**，且明写**"不得用 compliance aggregate 的 PASS 覆盖独立门 FAIL"**。

`:247-249`：蓝图 project-skill 分母订正与 `CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` 登记
**双双前移到 CR00**，CR00 exit 前必须 production path 真绿；
明写"它不再归 CR08，也不会把 CR01～CR07 的 typecheck/test 永久阻断"。
`CR00 ordered chain :335` 有对应独立步骤。我上一轮提出的两难（红门阻断 vs 假绿）被正面解掉。

## 2. 其余核验点

### D-1～D-7 精确传导 —— 核验点 7 ✅

`delegated-decisions.md`（sha256 `3624fe4f…`，与请求一致）逐条给出裁决与理由；
`design §5:485-500` 已把该表从"候选/推荐"改写为**"已裁决"**并声明"以下结果是本设计冻结输入，
不再是默认推荐"，manifest 亦绑定该文件的 sha256。

| ID | 请求声明 | 决策文件 | 详设 §5 | 一致 |
| --- | --- | --- | --- | --- |
| D-1 | B | B（拆独立 capability surface） | **B** | ✅ |
| D-2 | A | A（R5 本轮全部闭合） | **A** | ✅ |
| D-3 | A | A（全部纳入整改） | **A** | ✅ |
| D-4 | A | A（organization） | **A** | ✅ |
| D-5 | A | A（additive 恢复 `workspace_uuid`） | **A** | ✅ |
| D-6 | B | B（不做猜测性索引） | **B** | ✅ |
| D-7 | B | B（登记历史不合规，从 CR00 重建 baseline） | **B** | ✅ |

三处实施约束值得记录，它们防住了裁决被扩大解释：D-1 "不新增第 23 个 surface，
在 U06 的 22/25 分母内归位"；D-2 "仍只做一次 whole-scope review"；
D-5 "只新增 migration，不改已执行字节，不恢复 external-sync 语义"。

**关于 D-4**：这是我上一轮唯一与 Codex 取向不同的一项（我此前倾向采纳单源简化）。
Dexter 已全权委托 Codex 裁定，结果为 A（organization 拥有审计事实），
理由是"边界纯度优先于局部接线简度"。该理由在 owner 主权上成立，我接受该裁决，
不再保留异议；相应地 `platform-workspace` 只可任务型读取，CR04 需承担一个跨 owner 窄 reader
的实现成本，这一点已在决策文件中写明，不构成隐藏代价。

### 冻结分母与拓扑无漂移 —— 核验点 8 ✅

- `design:33-34`：`106 = 39 + 56 + 11`、`32 scenario、22 surface、25 pageDesignKey、7 owner schema` 原样冻结
- manifest 独立复算：**22 surface + 25 pageDesignKey，owner 集合均为单元素 `{R5-CR-U06}`**；
  与 carry-over source 的对称差集为 **NONE**
- 10 个 delivery unit `R5-CR-U00…U09` 齐全；六维 `complianceRoute` 与六类
  `sourceComplianceDenominators` **10/10 无缺项**
- standards 分母仍为 **150**
- `roadmap:67-70` 严格串行 `CR00 → … → CR09`，无并行例外；CR09 是唯一 whole-scope
  implementation review，中途 receipt 不产生 GO、不建立独立 review cycle

三条门 fresh 复跑：

```
STANDARDS_COVERAGE=PASS  RULES=150
CLAUDE_REVIEW_HANDOFF=PASS
IMPLEMENTATION_DESIGN_GRANULARITY=PASS  UNITS=10  FINDINGS=3  VERDICT=NO_GO  REVIEW_ROUND=2
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
```

`VERDICT=NO_GO` 是对终轮盲审字节的机械复现；`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`
正确表达"当前字节未被终轮 reviewer 审过"。intake `:17-18` 记录
`ROUND_FINAL_DECISION=SELF_DECIDED`、`furtherCodexAdversarialRoundAllowed=false`，
两轮硬上限成立，本轮未启动第三轮。

### 授权位仍全 false —— 核验点 9 ✅

`delegated-decisions.md`、`design`、`roadmap` 三份文件的
`implementationAuthority / runtimeAuthority / seedResetAuthority` **九个位全部 false**；
决策文件 `:21` 明写"本授权只解决候选详设中的 D-1～D-7，不等于接受整个设计，
也不授权 implementation……"。委托裁决未产生实施授权，这一点表述准确。

## 3. N 级（2 条，登记项，不构成接受障碍）

**N-1｜`CODEX_MUTATION_HOOK_CONTRACT_UNVERIFIED` 的结局仍是未知，属可接受的诚实未知**

设计已把"契约是否被支持"从**隐含假设**变成**必须先证明的显式前置**，这是正确处理。
但客户端是否真支持 `PreToolUse/PostToolUse`，在本轮只读约束下仍无法验证（标 `UNVERIFIED`）。
若 canary 失败，CR00 会 FAIL，**整条整改链在第一包即停**。这不是设计缺陷——恰恰是设计
要求的行为——但它意味着**存在一个当前无法预估的早期阻断风险**，建议 Dexter 知悉：
若 canary 失败，需要一次产品级决定（换客户端能力、改用其他强制点、或接受降级并明确记录），
届时属 `DEXTER_DECISION`，Codex 不得自行降级（设计已禁止）。

**N-2｜作者上一轮的分母错误，诊断件仍待回改**

我在 `2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md` 中把
`approvedAssertions` 写成 27（实为 **26**）、把 project-memory assertion 写成 62
（实为 **71 occurrences / 69 unique**）。本轮再次确认 Codex 的更正是对的。
该诊断件的 §1 与 §4 需按 26 / 71 / 69 回改。此项只影响分母表述，不影响任何 finding 的成立，
也不影响本次 GO。

## 4. 方案合理性

- **问题对不对**：对。本轮修订没有扩大范围、没有增加新机制，只把已有机制的**证明责任**补到位。
  M-1 的修法尤其克制：没有引入新门类别，而是（a）明确证明对象、（b）加一条不依赖被证对象的
  独立探测器。这是我能想到的最小且最强的修法。
- **方案优不优**：我独立构造的替代是"放弃 hook、改为在每次 package exit 做全量扫描"。
  它更简单，但恰恰放弃了 Dexter 明确要求的"文件产生时即发现"，把返工面从单文件放大回单包，
  因此更差。设计选择保留 hook 并为其补充兜底，取舍正确。
- **代价配不配**：CR00 变重了（新增 canary 与蓝图分母订正两步），但换来的是整条链的可证性。
  相对于上一轮"九包全绿而机制可能从未运行"的风险，这个成本是划算的。
- **UI 强制自问**：本轮 `NOT_APPLICABLE` —— 纯过程与控制面设计，不交付用户可操作界面。
  CR05/CR06 的 UI 合理性必须在各自 package 与 CR09 单独判定，本结论不覆盖。

## 5. 授权边界

本轮只复核 DESIGN。**GO 表示候选 Roadmap、详设、实施计划及委托裁决传导可交 Dexter 接受**。
不授权 implementation、业务源码、契约、migration、测试、`scripts/`、构建、DEV、数据库、
远端运行或 seed/reset。Dexter 接受后仍需另行给出 implementation exact authorization，
且只能从 CR00 开始。

两轮独立盲审已 hard stop，本轮未启动第三轮，亦不需要。

`UNVERIFIED`：Codex client 对 `PreToolUse/PostToolUse` 的实际支持（见 N-1）；
backend ArchUnit 与 route registry reverse coverage 仍需有 gradle + 远端 Docker 的环境 fresh 复跑。
