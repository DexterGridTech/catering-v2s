---
title: R5 合规整改候选 Roadmap、详设与计划 Claude review
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
reviewTarget: DESIGN
reviewRound: POST_REMEDIATION_CLAUDE_RECHECK
verdict: NO-GO
counts: {M: 1, S: 1, N: 2}
reviewSessionProvenance: FRESH_V2S_ROOTED_THIS_SESSION
reviewTargets:
  roadmap: {path: "doc/roadmaps/platform/2026-07-27-v2s-r5-compliance-remediation-roadmap.md", sha256: "e08202cc20657ac5d405f32cfb88187d5e46babf900e986ad9fac6f60be3054f"}
  design: {path: "doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md", sha256: "2640cdbec609f14d022117c441a1fa9a4a5ae5cc0284d18ad3d5d41ca91f9248"}
  manifest: {path: "doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json", sha256: "498dfa90174b58312c704f6de2a0b8627e853f17d0e73f69326575da46183b90"}
---

# R5 合规整改候选 Roadmap、详设与计划：Claude review

## 0. 结论

**NO-GO（M=1 / S=1 / N=2）**，但性质与前几轮完全不同：**结构、分母、resolver 契约与串行拓扑
全部独立复算通过**，唯一 M 是一个局部但要害的缺口——整条强制链的**最顶端一环没有红证明**，
且它失效时不可被检测。修复是设计内的加法，不改架构、不改九包、不改任何分母，
**不需要第三轮独立子 agent**。

## 1. 独立复算：全部通过

以下每一项都由作者在本会话内用独立脚本重算，不采信文档自报。

| 核验项 | 声明 | 我的实测 | 结论 |
| --- | --- | --- | --- |
| standards 分母 | 150 = 104 + 46 | 遍历 matrix：`UNENFORCEABLE_BY_MACHINE`=104；`GATE`43+`ARCHUNIT`2+`NEGATIVE_FIXTURE`1=46，总 150 | ✅ |
| enforcement 分区 | 逐组 review/machine 拆分 | B.5→`JOURNEY_INTERACTION_REVIEW`、D.1/D.3 全 machine 且 checklist 为 null，逐组与 matrix 一致 | ✅（上一 cycle 此处曾错，本次正确） |
| surface / pageDesignKey | 22 + 25 exact 归 U06 | manifest 22 surface + 25 pageKey，owner 集合 = `{R5-CR-U06}` 单元素；与 carry-over source 双向差集均为空 | ✅ |
| 六维 route | 10 unit 各有合法 `complianceRoute` | 10/10 单元 `taskKinds/domains/consumerFaces/owners/impacts/triggers` 六维齐全 | ✅ |
| 六类 package-exit 分母 | 每 unit 逐项可判 | 10/10 单元 `sourceComplianceDenominators` 六项齐全，各带 `sourcePath/selector/applicability/missingEntryFails` | ✅ |
| 声明的 source hash | 4 处外部 source | `required-inventory.json`、`frontend-asset-carryover-manifest.json`、`standards-coverage-matrix.json`、design 本体，**逐个复算全部相等** | ✅ |
| memory 分母 selector | `/entries/*/requiredAssertions/*` | 实解：18 entries，**71 occurrences / 69 unique**，与设计声明逐字吻合 | ✅ |
| 远端 Testcontainers 绑定 | `r5-remote-testcontainers.mjs@a0aa5028…` | 复算 sha256 **完全相等**；runner receipt 字段、六类红夹具、host/hash 必填、task registry 限定均已写死 | ✅ |
| 七 owner schema | 7 项，`platform-access` 非第八 | 设计 §4.5 明确列出七项并把 registry 的 `platform_access` ownerSchema 更正为 null，三方双向对账（registry↔Flyway↔datasource） | ✅ |
| 严格串行 | CR00→…→CR09 无并行 | Roadmap §3 显式撤销清单里"W03 可与 W01/W02 并行"的例外，理由是 Dexter 更晚更明确的裁决 | ✅ |
| active Roadmap 一致性 | design-only pause | 07-24 Roadmap 已改为 `CURRENT_STATUS=WAITING_R5_COMPLIANCE_REMEDIATION_DESIGN_REVIEW`、`R5_IMPLEMENTATION_AUTHORIZED=false`，并显式声明旧的 `true` 已被取代 | ✅ |
| 候选 Roadmap 不夺权 | 未入 registry | 候选文件**无 `CURRENT_*` 块**，registry 仍只有一个 program 且 stateOwner 指向 07-24 | ✅ |
| Part B/C/D 命中表 | 章节级对照 | 18 个章节行（B.1–6 / C.1–4 / D.1–8）齐全 | ✅ |

**三条门 fresh 复跑**：

```
STANDARDS_COVERAGE=PASS  RULES=150
CLAUDE_REVIEW_HANDOFF=PASS
IMPLEMENTATION_DESIGN_GRANULARITY=PASS  UNITS=10  FINDINGS=3  VERDICT=NO_GO  REVIEW_ROUND=2
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
PROVIDER_FREE_CONTEXT=FAIL  REASON=skill denominator is not five   ← 如实，见 N-2
```

`VERDICT=NO_GO` 是对终轮盲审字节的机械复现，`DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`
正确表达"当前字节未被终轮 reviewer 审过"。round-2 verdict 实为 `NO_GO`、
`reviewerKind=INDEPENDENT_SUBAGENT`、1M/0S/2N，与请求描述一致；
`ROUND_FINAL_DECISION=SELF_DECIDED` 且 `furtherCodexAdversarialRoundAllowed=false`，两轮硬上限成立。

**R2-M-001 的 post-remediation 已真实落地**：六维 route 补齐（10/10）、applicability 固定为
"任一维含 all 或与 unit 该维有交集，六维全满足"、22+25 全部精确归 U06 并要求 set equality /
no overlap / no unknown 与 `SURFACE_OWNER_DRIFT|DUPLICATE|UNOWNED` 具名红。
自引用 hash 用 `sourceSha256Binding=CURRENT_MANIFEST_BYTES` 处理，是诚实且正确的做法。

## 2. M-1｜强制链最顶端一环无红证明，且失效时不可检测

**这是本轮唯一 M，也是整份设计唯一一处"自己的核心主张没有被自己的标准检验"。**

设计的全部价值在于：让偏离在**文件产生时**被发现，而不是攒到最后。这条链是

```
写文件 → PostToolUse 触发 → tools/compliance-control 引擎 → 红/绿
```

§2.5 的 red-first 协议、§4.1 的 15 类回放、各 unit 的 `discriminator`——**红证明全部指向引擎**，
证明的是"引擎被调用时会红"。**没有任何一条红夹具证明"调用真的发生"。**

两个具体缺口：

1. **`.codex/hooks.json` 的客户端 hook 契约未被验证，也未被登记为未验证**
   （`doc/plans/…-implementation-design-and-plan.md:143`）。本仓恰恰有处理这种情况的先例：
   因为"未验证真实 Claude client hook 契约"，项目显式登记了 `CLAUDE_ENTRY_INTENTIONAL`
   并要求人工证明入口链已回读。同一风险在 `.codex/hooks.json` 上没有对应登记。
   若该契约名称/形状不被客户端支持，**每一次写入都会静默通过，引擎从不被调用，
   而引擎自测始终绿**。

2. **`package-exit.json` 的 `incrementalChecks` 没有非空与集合相等要求**
   （同文件 `:237`）。全文检索 `incrementalChecks` 仅此一处，没有任何条款要求它
   等于本包实际变更文件集。§3:246 只写"所有适用字段闭合"——**空数组可被视作已闭合**。
   于是 hook 从不触发的后果是：`incrementalChecks: []`、`fullComplianceScan: PASS`、
   package exit 绿。

**影响面**：Dexter 明确要求的"必须做一点验一点"退化回"最后统一验证"，而且**没有任何信号**。
这正是本次整改要消灭的假绿模式，在控制链最顶端被原样复制。九个包的 exit receipt 会全部绿。

**最小修复**（设计内加法，不改架构）：

- `package-exit.json` 增加 `incrementalChecks` 与**本包实际变更文件集**的 set equality 要求，
  变更集由 receipt 期独立枚举（不依赖 hook 自报）；空数组、缺项、多项分别具名红。
  这一条同时是 hook 不触发的**兜底探测器**——即使契约错误，包尾也必然红。
- CR00 增加一条 **invocation canary 红夹具**：在 scratchpad 仓库拷贝上对受保护路径做一次真实写入，
  断言 receipt 中出现该 `path + beforeHash + afterHash`；缺失即红。证明的是"触发"，不是"引擎"。
- 若客户端契约确实无法机械证明，按本仓 `CLAUDE_ENTRY_INTENTIONAL` 先例**显式登记为未验证契约**，
  并写明补偿控制（即上一条 set equality）。不得默认它成立。

**是否需 Dexter 裁决**：否。属既有批准边界内的设计补全。

## 3. S-1｜CR00 的回放语料用了外部给定计数，与设计自己的"不硬编码分母"原则不一致

`…-implementation-design-and-plan.md:278`：CR00 第 8 步为
「用本次 **15 个**已知 forbidden 违反回放，适用项必须全部命中」。

设计在其余每一处都坚持"分母从 source 动态派生、不硬编码"（§2.2 表、§2.2:90
"引擎不得内置 36/26/69/25"），唯独此处把一个**外部给定的计数**当作回放语料的分母。
而这个 15 恰恰来自本轮已被证明存在计数错误的那份诊断（见 N-1：作者把 26 报成 27、
把 71/69 报成 62）。若 15 本身不全或含误判，CR00 的回归语料会继承该误差，
并以"全部命中"宣称完备。

**最小修复**：把第 8 步改为「以派生规则集**重新扫描当前树**得出违反集合，
逐条命中并记入 receipt；诊断报告的 15 条仅作交叉核对，差异写入 receipt，
不作为完备性声明」。这与 §1.1 已确立的"数字是时点快照、只冻结零漂移目标与复算算法"完全一致。

**是否需 Dexter 裁决**：否。

## 4. N 级（2 条）

**N-1｜作者自我更正：本轮我被对方在分母上纠正了两处，且对方是对的**

- `approvedAssertions` 实为 **26**，我的诊断报告写 27；
- project-memory assertion 实为 **71 occurrences / 69 unique**，我的报告写 62——
  我的统计只数了正文 `- \`NAME\`` 形态，漏掉了四个只在 frontmatter `assertions:` 数组中声明的文件
  （`confirmed-business-language-corpus` 2、`business-corpus-adoption-and-read-policy` 2、
  `business-corpus-parked-domain-intake` 2、`claude-review-handoff-standard` 3）。
- `forbiddenPseudoFixes` = 36 一致。

设计 `:59-61` 已把三者记为 `CONFIRMED_WITH_COUNT_CORRECTION` / `PARTIALLY_CONFIRMED` 并采用
occurrences 与 unique 双口径，**处置正确且优于我的原报告**。
`doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md`
的 §1 与 §4 需按 26 / 71 / 69 回改；本条不影响任何 finding 的成立与否，只影响分母表述。

**N-2｜`provider-free-context` 当前红被诚实登记，但归包与"测试前全量扫描"的关系需澄清**

该门实测 `FAIL / REASON=skill denominator is not five`（`.agents/skills/` 现 8 个 skill，
而 `PLATFORM-BLUEPRINT.md:19` 仍写"五个"）。intake `:26` 记为
`CONFIRMED_CURRENT_RED`、"不在设计期改措辞伪绿"——**处理是诚实的**，这一点应当肯定。

但修复被排到 CR08（§4.9 第 9 步的蓝图/kernel 状态更新），而它本质是一处文档分母订正，
与测试接线无关。更需要澄清的是：§2.4 的测试前全量扫描 `remediation-compliance --scope repository`
**是否包含既有独立门**（如 `provider-free-context`）。若不包含，则会出现
"compliance scan 全绿而一个真实门是红的"——与本设计要消灭的模式同源；若包含，
则 CR01–CR07 期间任何 typecheck/测试都会被这条红阻断。设计需二选一并写明。

建议：把该 doc 分母订正前移到 CR00（该包已在改 AGENTS/CLAUDE/skill 壳/memory），
并在 §2.4 明确既有门与 compliance 引擎的关系。

## 5. 方案合理性

- **问题对不对**：对。上一轮失败的根因不是任何单个 bug，是"设计没有在文件产生时被执行"。
  本设计把过程规矩、控制真实性与实现偏离三者放在同一条依赖链上，且把 CR00 定为纯静态、
  无前置——这修正了作者上一稿把 gradle/docker 误当"做一点验一点"前提的错误，判断正确。
- **方案优不优**：§9 列了两个替代（逐条修补 + 末尾跑 verify；整体重写 R5）并给了拒绝理由，
  推理成立。作者独立构造的第三个替代——"先补 codegen 接线再修契约"——已被设计 §4.2 的顺序
  否定且否定得对：契约不可解析时 codegen 指过去也解不开，CR01 先于 CR02 是唯一正确顺序。
- **代价配不配**：CR00/CR01 成本集中，但换来的是后续七包的偏离在写入时即被发现。
  按当前阶段（一人 + 两 AI）标尺，`§2.3.1` 把 package-exit 逐项 disposition 提升为
  **既有** `implementation-design-granularity` 的准入而不新建门类别，是正确的克制。
- **UI 强制自问**：本轮 `NOT_APPLICABLE`——纯过程与控制面设计，不交付用户可操作界面。
  CR05/CR06 的 UI 合理性必须在其各自 package 与 CR09 单独判定，本结论不覆盖。

## 6. 七项 DEXTER_DECISION 的推荐是否合理

| ID | Codex 推荐 | 我的独立判断 |
| --- | --- | --- |
| D-1 通用 registry | B（拆独立 surface） | **同意**。与我在诊断件的建议一致，理由更完整（face/capability 语义、typed endpoint、编辑与 L2 无法由通用 Record registry 承载） |
| D-2 七个编辑能力 | A（R5 内闭合） | **同意**。它们已在 22 surface 的 `ADAPT` 分母内，后置等于 R5 scope 未闭。与 D-1 是同一件事的两面，建议 Dexter 一起裁 |
| D-3 四类缺失 surface | A（全部纳入） | **同意**，但请 Dexter 注意这是范围扩张的主要成本来源；若要压缩，五个 HOME 是最可后置的一项（设计已限定 HOME 只做业务 bootstrap、不发明 dashboard） |
| D-4 集团初始化审计 owner | A（organization） | **推荐合理，但与我诊断件的倾向相反，需 Dexter 明确**。我此前倾向"采纳实施的单源简化并改设计"（少一个跨 owner reader）；Codex 选 A 的理由——commercial group 是 organization fact、coordinator 不得重复拥有审计事实——在 owner 主权上更正确。两者都自洽，取舍在"边界纯度 vs 实现简度"，属 Dexter 裁定 |
| D-5 extension workspace identity | A（additive 恢复 workspace_uuid） | **同意**。只新增 migration、不改已执行字节，同时解除设计 §5.1 `entity_ref_text` 规则无法遵守的矛盾 |
| D-6 二级索引 | B（推 HANDOFF，只保留已证必需） | **同意**，与我建议一致 |
| D-7 历史顺序偏离 | B（记为历史不合规，从 CR00 重启） | **同意**。不回滚既有字节但重建真实 baseline，是唯一不制造第二次假绿的选项 |

七项在裁定前均标 `BLOCKED_BY_DEXTER_DECISION`、不得用默认值开工，这一条正确。

## 7. 授权边界

本轮只评审 DESIGN。本 NO-GO 仅表示：在 M-1 与 S-1 修订前，候选 Roadmap、详设与计划
**尚不宜作为最终接受版本**；修订后可直接交 Dexter 接受并裁定 D-1～D-7。
本结论不授权 implementation、业务源码、契约、migration、测试、`scripts/`、构建、DEV、
数据库、远端运行或 seed/reset。

M-1 与 S-1 均属既有批准边界内的设计补全，**不需要第三轮独立子 agent**（两轮硬上限已达成，
`SELF_DECIDED` 收口有效），由作者做受限 post-remediation 后再交 Claude recheck 即可。

`UNVERIFIED`：`.codex/hooks.json` 的客户端 hook 契约本轮无法在只读约束下验证（即 M-1 的成因）；
backend ArchUnit 与 route registry reverse coverage 仍需有 gradle + 远端 Docker 的环境 fresh 复跑。
