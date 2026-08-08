# 双后台 ProTable 紧凑密度实施独立对抗复核（Round 1）

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=DUAL-ADMIN-PROTABLE-COMPACT-20260805
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=NOT_APPLICABLE

## Review identity

- `REVIEW_CYCLE_ID`: `DUAL-ADMIN-PROTABLE-COMPACT-20260805`
- `REVIEW_TARGET`: `IMPLEMENTATION`
- `REVIEW_ROUND`: `1`
- `REVIEW_ROUND_LIMIT`: `2`
- `reviewerKind`: `INDEPENDENT_SUBAGENT`
- `ROUND_FINAL_DECISION`: `NOT_APPLICABLE`（第一轮，未触发第二轮硬停止）
- `reviewerSession`: fresh v2s-rooted independent subagent
- `blindReviewDeclaration`: 我先独立读取冻结入口、真实生产源码、checker 与可执行输出，以“找出实现为什么不成立”为立场完成攻击并形成 findings/verdict，之后才对照 focused proof、exit evidence 与作者输入清单；没有把作者自评或 finding 处置当作前提。

## 最小输入清单与复现

### 入口与冻结输入

| 输入 | SHA-256 / fresh output | 结果 |
|---|---|---|
| `AGENTS.md` | `4d64bfb2bb435326a13c2ccb7955dbbbef621259030693e64db3cbf6a0bd9fda` | READ |
| `CLAUDE.md` | `8b12b36e0c852f3a55f40f29d3d21101b9acb113b969ff5f8a9c2152c2aec50f` | READ |
| `PLATFORM-BLUEPRINT.md` | `3b90bd602eb682c4718d6c51f399501c34f804cddd96da82d59495e60b115a8d` | READ |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f5038f02ad40b19150a377a2188f313350d965460c3a07ab4c1c3f4eb73` | READ; `CURRENT_STEP=RM1-P6-3`, `CURRENT_STATUS=RM1_P6_3_IMPLEMENTATION_IN_PROGRESS`, `IMPLEMENTATION_AUTHORITY=true` |
| `scripts/README.md` | source reopened | READ |
| `contracts/policy/standards-coverage-matrix.json` | `80aa25c1d87c8d3e53443619475b133eb377e463141aa67b87e9f587d0dfa460` | READ; `scripts/check/standards-coverage --phase R5` = `STANDARDS_COVERAGE=PASS`, `RULES=150` |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | READ |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | source reopened | READ |
| `doc/decisions/2026-07-25-v2s-frontend-foundation-consumption-rule.md` | source reopened | READ |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | source reopened | READ |
| `doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md` | source reopened | READ |

All six `project-memory/kernel/*.md` were read. Their hashes were:

```text
01-workspace-and-roadmap.md       f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63
02-service-shape-and-owner.md     45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032
03-transaction-data-and-dependencies.md f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44
04-contract-consumer-and-admin.md 1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d
05-evidence-runtime-and-git.md    f5e219652484338467f0fc03be2bd02d96e09a4a27b812308200673ef720c736
06-heritage-and-change.md          5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c
```

The routed review command named by the author input used an invalid vocabulary value:

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face frontend --owner platform --impact governance --trigger task-start
PROJECT_MEMORY=FAIL
REASON=unknown or non-specific route: consumerFaces:frontend
```

I corrected it to the two actual consumer faces and read every returned hit:

```text
scripts/context/recall-memory --task-kind review --domain platform --consumer-face platform-admin --owner platform --impact governance --trigger task-start
scripts/context/recall-memory --task-kind review --domain platform --consumer-face operations-admin --owner platform --impact governance --trigger task-start
```

The routed sources read included `decisions.deterministic-context-only`,
`decisions.independent-subagent-adversarial-review`, confirmed business corpus/adoption policy,
`decisions.incremental-compliance-hook`, Claude handoff, verification governance,
phase-retrospective/systemic-repair and implementation-source-reread discipline. The full
repository `doc/decisions/` title listing was also reviewed; the applicable UI, verification,
foundation, compact-standard and independent-review sources were reopened in full.

The author input artifact itself was read and hash-checked:

```text
doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-independent-review-input.md
36f1aa3ce6454a4ff5977232e262c6aadb97f832ed7bafe3f115d085db4380a6
```

### Reviewed object hashes

```text
doc/plans/platform/2026-08-05-v2s-dual-admin-protable-compact-implementation-design.md
250d8b7fd92ce8bdf0ba60b0db637d6a8da7eb65508cb337cb6feaae35402941
scripts/check/protable-compact.mjs
b0a03bd9a38e82df572f2fffbfa3275de826f91571cd97ea2607cedf54ed142f
doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-focused-proof.json
872b55dd0b63df345f39474a1bfc92dc85ca5c7ab093a36597bf60057e0fe3df
doc/evidence/platform/2026-08-05-v2s-dual-admin-protable-compact-exit.json
4db66a3484712db6985a170083d7307fe90e61180a3e4a0fd91f78e38cf44a44
```

## 用户任务

业务用户在双后台使用列表时需要统一的紧凑密度；成功标准是 13 个实际渲染实例全部显式传入
Ant Design `size="small"`，且查询、分页、排序、owner 与两后台边界不变。

## Dexter 立场

Dexter 要求本包保持静态 UI 标准实施、分钟级、零运行时基建、防回归；不借此扩大 Journey、后端、
契约、数据库或 DEV/UAT 范围。业务与 cleanup 维持 `NOT_APPLICABLE_WITH_REASON`。

## 替代方案

更小替代是仅设置 ConfigProvider/全局 CSS 的默认表格密度；它会让密度依赖 Provider/主题，
不能在组件级审查中证明后续列表不漂移。本包采用逐实例显式属性和纯机械 gate，避免 wrapper
和 shared foundation 扩张。

## 方案合理性

显式 `size="small"` 是直接、可读、可静态验证的 Ant Design 语义 API，复杂度与视觉收益匹配，
没有发现过度设计、造轮子或跨 app 合并。

## UI 与交互

`NOT_APPLICABLE_WITH_REASON`：不涉及新的 UI 操作或交互；本包只改变列表视觉密度，不新增或改变用户操作、Journey、反馈、
权限、owner readback 或恢复路径；因此不把浏览器业务 PASS 偷换成静态 checker PASS。

## 1. 方案合理性与用户任务

用户任务是让两个独立后台的所有 ProTable 列表在视觉上更紧凑；成功结果是每个实际渲染的
ProTable 直接收到 Ant Design 的 `size="small"`，查询、分页、排序、owner、契约和两后台
边界保持不变。

我构造的更小替代是只设置 ConfigProvider/全局 CSS 的默认表格密度。它改动更少，但会让密度
依赖 Provider/主题上下文，无法在组件级审查中证明新增列表不会漂移。显式逐实例属性没有新增
wrapper 或 foundation 责任，且用一个纯机械 gate 防回归；对当前阶段是更小且更可审计的方案。

该任务没有新的业务操作、Journey、owner 或权限语义，UI 用户任务判断为
`NOT_APPLICABLE_WITH_REASON`（只改变列表密度，不改变用户操作路径或结果）。方案复杂度与
收益匹配，没有发现过度设计、造轮子或跨 app 合并。

## 2. 生产源码分母的独立复算

独立 `rg`/脚本扫描得到 13 个实例、12 个文件，分布 `platform-admin=8`、
`operations-admin=5`，与设计一致。全部 13 个首属性均为 `size="small"`：

```text
platform-admin:
  ExtensionsPage.tsx#1
  PlatformReadPage.tsx#1-2
  AdministratorsPage.tsx#1
  AccountsPage.tsx#1
  PlatformInvitationPanel.tsx#1
  RolesPage.tsx#1
  WorkspaceManagementPage.tsx#1
operations-admin:
  BusinessEntityManagementPage.tsx#1
  ContractManagementPage.tsx#1
  StoreManagementPage.tsx#1
  WorkspaceInvitationPanel.tsx#1
  WorkspaceUserPage.tsx#1
```

全仓 frontend 生产源码中的 `ProTable` 使用扫描也只返回上述 13 个实际渲染点；未发现
alias、`EditableProTable` 或 `.jsx` 隐藏实例。普通 `Table`、Tree、Descriptions 与
configuration-order/详情表不属于本规范分母，且没有被误改。

## 3. Checker 与红变异攻击

新鲜执行：

```text
node scripts/check/protable-compact.mjs --self-test
PROTABLE_COMPACT_SELF_TEST=PASS
RED_MISSING_SIZE=PASS

node scripts/check/protable-compact.mjs
PROTABLE_COMPACT=PASS
PROTABLE_INSTANCES=13
PROTABLE_FILES=12
PLATFORM_ADMIN=8
OPERATIONS_ADMIN=5
```

我把仓库拷贝到 `/tmp` scratchpad，仅在拷贝中将
`AdministratorsPage.tsx` 的一处 `size="small"` 改为 `size="medium"`。生产 checker
输出：

```text
PROTABLE_COMPACT_MISSING:apps/frontend/platform-admin/src/features/platform-administration/ui/AdministratorsPage.tsx#1
PROTABLE_COMPACT_FAIL:instances=13:missing=1
```

因此 red mutation 真实失败。扫描范围是两个 app 的生产 `.tsx`，排除 test/spec fixture；
总实例固定 13，新增或漏改实例会 fail closed。checker 只做计数和属性形状，不冒充业务语义
判断，符合验证治理的机械边界。

## 4. Typecheck/test 与证据诚实性

独立执行结果：

```text
platform-admin: yarn typecheck => PASS (exit 0)
operations-admin: yarn typecheck => PASS (exit 0)
operations-admin: yarn test => PASS (16 architecture tests; 28 Vitest files / 76 tests)
platform-admin: yarn test => 7 pass, 2 fail
```

platform-admin 的两项失败为既有 architecture assertions：
`commercial-group-boundary.test.mjs` 仍寻找旧的 extension key spread 形状，
`platform-read-boundary.test.mjs` 仍寻找旧的 `gridTemplateColumns` 形状。为了证伪它们是否由
本次 compact 改动引起，我在独立 scratchpad 拷贝中移除全部 `size="small"` 后重跑这两项，
仍然得到完全相同的 2 failures；故它们不计为本包 finding，也不能被本包报告成全绿。它们是
仓内既有测试漂移，应在所属 owner 包中单独处理。

focused proof 与 exit evidence 的静态结果、13/12 分母和 `NOT_APPLICABLE_WITH_REASON`
业务/cleanup 边界与当前字节一致。exit 当前状态仍是
`IMPLEMENTATION_PENDING_INDEPENDENT_REVIEW`，这是送本轮复核前的诚实状态，不是已闭合伪造。

## 审查意见复核

本轮先独立复算生产源码、checker、红变异和测试，再读取 focused proof 与 exit evidence；
作者材料中的 invalid routed command、静态-only 证据边界和既有平台测试失败均保留为下方
findings/说明，没有因作者结论而自动接受或拒绝。逐条状态为
`PARTIALLY_CONFIRMED`、`UNVERIFIED_REQUIRES_EVIDENCE` 与 `CONFIRMED`；每条均重开了源码/证据，
检查了反例与适用边界，并比较了更小修复与过度设计成本。

## 实施代码核验

已重开 12 个生产源码文件中的全部 13 个 `<ProTable>`，执行 checker/self-test、scratchpad
red mutation、两个 app typecheck 与测试；同时复查了当前 focused proof、exit evidence 和
业务用户行为边界。结果与下方闭环核验一致。

## 闭环核验

源分母（13/12）、`size="small"` 属性、checker self-test/red mutation、typecheck、两 app
测试结果与 evidence 当前字节均已逐项核对；platform-admin 两个既有失败另以无 compact 属性
的 scratchpad baseline 复现。该闭环只证明本包静态事实，不扩展到运行时或浏览器 L2。

## 5. Findings

### N-01 — 作者 routed-command 示例使用不存在的 `frontend` consumer face

- 状态：`PARTIALLY_CONFIRMED`
- 证据：`independent-review-input.md` 记录的命令返回
  `PROJECT_MEMORY=FAIL / unknown or non-specific route: consumerFaces:frontend`。
- 影响：若复核者只照抄该命令，会得不到 required routed hits，最小输入清单的复现性不足。
- 处置：本轮已用合法的 `platform-admin` 与 `operations-admin` 两条路由独立重跑并读取全部
  命中原文，因此没有遗漏本实现适用的 memory；这不是生产代码缺陷，也不阻断本轮实现 verdict。
- 最小建议：后续输入清单把 `frontend` 改为两个真实 consumer face，或明确使用
  `consumer-face all`，并保留命令输出；不要新增 alias vocabulary。

### N-02 — 没有浏览器视觉证据，但没有越界宣称动态 PASS

- 状态：`UNVERIFIED_REQUIRES_EVIDENCE`（非阻断 note）
- 事实：本包只提供静态 checker、typecheck 和 test；没有 screenshot/L2 逐屏证明实际行高。
- 适用边界：`size="small"` 是直接的 Ant Design API，AntD CLI fresh 输出确认 `Table.size`
  合法值为 `large | medium | small` 且默认 `large`；因此源代码映射是明确的。但当前证据
  不能证明 live browser 的最终 CSS/主题没有覆盖它。
- 处置：focused proof 和 exit evidence 明确写了业务/cleanup N/A，没有把静态结果冒充浏览器
  PASS；若 Dexter 要求视觉验收，应另开受管 UI proof，不应扩大本包的业务分母。

### N-03 — focused proof 未附 typecheck/test 输出

- 状态：`CONFIRMED`
- 事实：focused proof 只保存 checker 两条命令；本轮独立补得两个 typecheck、operations
  全绿测试，以及 platform 两项与本改动无关的既有失败。
- 影响：原 evidence 不能单独回答编译/既有测试状态，但不影响 13/13 compact 事实；平台两
  项失败也已用 scratchpad baseline 复现，不应被隐藏。
- 最小建议：在 evidence 后续修订中追加上述命令与 baseline 分离说明；不需要为本视觉标准
  新建运行时或数据库证据。

## 结论

本轮独立 implementation verdict 为 `GO | M=0 / S=0 / N=3`。
VERDICT=GO

## Verdict

```text
GO | M=0 / S=0 / N=3
```

实现确实覆盖了设计声明的双后台全部 13 个生产 ProTable，显式 `size="small"` 与用户的
compact 意图一致，checker 有真实 red mutation，typecheck 通过；未发现漏项、错误密度值、
业务/owner/契约越界或过度设计。N-01/N-03 是输入/证据可复现性改进，N-02 是诚实的视觉证据
边界，不构成实现 NO-GO。

## Authorization boundary

本 verdict 只覆盖 `DUAL-ADMIN-PROTABLE-COMPACT-20260805` 的静态双后台 ProTable 密度实施、
checker、typecheck/test 与证据诚实性。它不授权后端、契约、数据库/migration、DEV/UAT、
HTTP/L2、seed/reset、runtime deployment 或任何 Git/仓库控制动作；platform-admin 的两项
既有测试失败仍需在其所属包另行处理。
