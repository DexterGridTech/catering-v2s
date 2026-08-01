---
title: RM1 P6-2 U04 管理后台目录真相迁移独立实施对抗审查
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-IMPLEMENTATION-20260730
REVIEW_TARGET: IMPLEMENTATION
REVIEW_ROUND: 1
REVIEW_ROUND_LIMIT: 2
reviewerKind: INDEPENDENT_SUBAGENT
scope: RM1P6-ADMIN-CATALOG-TRUTH-U04 static catalog/generator/generated-output/role-home migration only
verdict: NO-GO
findings: M=1 / S=1 / N=1
createdAt: 2026-07-30
---

REVIEW_CYCLE_ID=RM1P6-ADMIN-CATALOG-TRUTH-IMPLEMENTATION-20260730
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT

# RM1 P6-2 U04 管理后台目录真相迁移独立实施对抗审查

## 用户任务

业务用户是平台管理员和运营端角色治理的使用者；用户任务是让可配置的 PAGE/ACTION、导航关系和
ROLE_HOME 从一份静态目录得到一致的可授予/可显示关系，不能因为 catalog、generated consumer 和
手写首页映射漂移而得到不同结果。

## Dexter 立场

Dexter 已授权这一精确 static-only package，目标是收敛目录关系真相而非扩大 IAM、路由或动态验证；
Dexter 保留 P6-3、operations `.tsx`、运行环境、seed/reset、L2 与产品语义的独立授权。

## 替代方案

替代方案是保留 tuple/map 与手写首页 switch、只修标题，或把动态 owner/session facts 一并放入 catalog。
前者不能消除多源关系，后者越过 owner 边界；因此不选。node model 的取舍是以有限静态投影换取可验证
exact set，而继续把动态事实留给原 owner。

## 方案合理性

当前方案解决的问题是静态目录关系分裂；其收益是 generator 可同时投影双 app 与 Java lookup，代价是必须
维护严格的 discriminator、生成对账和 receipt。复杂度仍小于维护多张平行关系表，前提是禁止字段和
package-exit controls 真正 fail closed。

## UI 与交互

NOT_APPLICABLE：本 package 明确无 UI/交互生产写入，operations `.tsx`、router 行为和 L2 不涉及；理由是
它们需另一个带 IA admission 的 package。已回读 IA01/IA02/IA03 与 UI baseline，只用来确认静态 title/
pageKey 投影不得冒充用户操作或 Journey 业务结果。

## 审查意见复核

NOT_APPLICABLE：未收到 U04 作者 finding disposition，且独立 reviewer 按治理规则不代写 author intake；
本文件的 CONFIRMED finding 仅是独立 verdict，作者后续须以 owning source、反例/适用边界与更小修复成本
另行复核。

## 实施代码核验

已重开实际源码 `admin-catalog.json`、generator、两份 generated catalog、Java authorization catalog 和
`WorkspaceAuthenticationService`。codegen/self-test 与 frontend architecture/self-test 均已运行；业务用户
行为/Journey 未运行，因为本包无动态业务结果，证据仅可写 `NOT_APPLICABLE_STATIC_ONLY`，不能把静态
evidence 写成 L2 或 business PASS。

## 闭环核验

静态集合、generated output 和 role-home lookup 已复核，但 required capability/authority controls 仍 FAIL，
U04 package exit 与 receipt set equality 也不存在；故 package closure 尚未形成。

## 0. 审查身份、盲审声明与边界

本记录由 fresh independent subagent 在 `catering-v2s` 仓根完成。先从原始业务语言、IA、冻结
carry-over 基线、U04 授权/详设以及当前 production source 重算分母并主动寻找反例；没有读取任何
U04 作者 implementation disposition、package exit 或作者结论（当前亦不存在 U04 package exit）。指定的
Claude model recheck 是外部 DESIGN 输入，不替代本轮 IMPLEMENTATION verdict，也没有被当作 finding
authority。本记录不写作者 intake/disposition。

`BLIND_REVIEW_DECLARATION=本轮独立以证伪为目标；下列 finding 均由当前 owning source、实际代码和可复现实跑结果得出，而非采纳任何审查意见。`

授权只覆盖静态目录迁移：catalog、generator、两份 generated TypeScript、生成的
`WorkspaceAuthorizationCatalog` 和 `WorkspaceAuthenticationService.homePage` lookup。它不授权 operations
`.tsx`、P6-3、DEV、seed、reset、L2 或动态业务声明。

## 1. 先于结论的独立事实重算

- 当前 `admin-catalog.json` 只有允许的 metadata 加 `nodes`；重算为 25 PAGE（platform 8、operations
  17，其中 ROLE_HOME 5、BUSINESS 12）、34 ACTION、4 NAVIGATION_GROUP、4 ACTION_GROUP、10 个
  user-management purpose relation。25 PAGE 和 34 ACTION 分别与 carry-over manifest 的 page/action
  exact set 相等。
- generator 从节点投影两个 TypeScript facade、Java authorization catalog、10 条 binding、5 条
  role-home relation；`WorkspaceAuthenticationService.homePage` 只调用
  `WorkspaceAuthorizationCatalog.homePageForRoleNodeType`，动态的 `enterable(...)`、组织路径描述 switch
  仍在 owner 内，未被目录吸并。
- `scripts/check/edge-codegen`、`scripts/check/edge-codegen --self-test`、
  `scripts/check/frontend-architecture`、`scripts/check/frontend-architecture --self-test` 和
  `scripts/check/standards-coverage --phase R5` 当前通过。codegen self-test 的 cross-face ACTION、缺
  INVITE/ROLE_REVOKE pair、重复 operations navigation order、ROLE_HOME 加 pageAccess 四个 red mutation
  均实际触发。
- 但是 package input 把 capability/authority static proof 列为必要 exit 证据，而 current bytes 的
  `node tools/capability-invariants/cli.mjs check` 和 `node tools/authority-source-ledger/cli.mjs check` 均
  fail closed；U04 source-compliance record 仍是模板，且 package exit 不存在。

## 2. Findings

### M-01｜U04 所要求的 capability/authority 静态闭环当前不可通过

**状态：CONFIRMED；阻断 static package GO。**

**证据与适用面**

- U04 package input 要求 `scripts/check/edge-codegen`、`scripts/check/frontend-architecture`、
  `scripts/check/standards-coverage`，并在 package exit 证明 `authority/capability static checks`；U04
  manifest 同样把 static source/receipt checks 列在 independent review 之前。
- 本轮实跑 `node tools/capability-invariants/cli.mjs check` 失败：
  `P3_A_TYPED_OWNER_EXCEPTION_FROZEN_COUNT_DRIFT:88`。工具当前冻结的 exact denominator 是 83，故它
  不能作为 PASS evidence。
- 本轮实跑 `node tools/authority-source-ledger/cli.mjs check` 失败：
  `P1_LEDGER_ROW_INVALID:ST-11`。`authority-ledger.json` 的 ST-11 仍 pin
  `frontend-asset-carryover-manifest.json` 为
  `c3b42d0f9f851ffd2dbbca2bbf5f184aeb410683ae1f61d77d9c1ad257658af0`，实际 manifest 是
  `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974`。
- U04 package exit 文件不存在，source-compliance record 也尚未提供 actual-change/receipt set equality，
  所以不能以“已有 codegen PASS”补足上述两项 required evidence。

**反例/归因边界**：这不是把 88/83 或 ST-11 stale hash 归因给 node catalog 本身；本轮不能从当前
source 确认其由 U04 引入。它仍是 U04 规定的 package-exit static proof 无法成立的确定事实。修复应由
拥有相应 frozen denominator/authority ledger 的已授权最小包完成，之后在 current bytes 重跑；不可降低
U04 exit 标准或把失败工具略过。

### S-01｜ROLE_HOME 的禁止字段只部分 fail closed，仍可静默容纳 platform-only `workspaceRequirement`

**状态：CONFIRMED；静态模型约束缺口。**

**证据与适用面**

- semantic-copy model §5 规定 ROLE_HOME 必须没有 `pageAccess`、`workspaceRequirement` 或可授予
  role type；U04 manifest 的 discriminator 也要求 role-home misuse 在生成前拒绝。
- `edge-codegen.mjs` 对 ROLE_HOME 只拒绝 `pageAccess` 或缺少 `roleHomeForNodeType`；它未拒绝
  `workspaceRequirement`。因此给 `HOME-GROUP` 加上 platform-only
  `workspaceRequirement: "REQUIRED"` 会被接受并在投影时静默丢弃。
- 当前 self-test 仅构造 ROLE_HOME 加 `pageAccess` 的反例；不能证明上述禁止字段也会红。

**反例边界**：当前 catalog 没有该字段，且此缺口不会授予动态权限；因此不是动态安全 defect，也不需
扩大到 owner/session。最小修复是让 ROLE_HOME 明确拒绝 `workspaceRequirement`（并对 operations
BUSINESS/Platform PAGE 的 mutually-exclusive 形状同样严格判别），再增加对应 production-path red
mutation。这样保持静态 package 和既有 owner 边界。

### N-01｜typed `userManagementFor(pageKey)` 已生成，但两个既有 feature 尚未消费

**状态：CONFIRMED；不阻断本 static-only package。**

`generatedAdminCatalog.ts` 已导出 `userManagementFor`；但 `WorkspaceUserPage.tsx` 和
`WorkspaceInvitationPanel.tsx` 仍在 generated compatibility projection 上遍历
`userManagementActionBindings`。这不是第二个 source of truth（该 projection 仍从 nodes 生成），但尚未
达到 model 所述的 typed consumer 形态。U04 amendment 明确禁止改动 operations `.tsx` 并把该接入留给
带独立 IA baseline 的后续 package，故本轮仅记录为该 future package 的有限分母，不把它误判为 U04
授权范围内的修复或动态/L2 结论。

## 3. Verdict

**NO-GO（M=1 / S=1 / N=1），仅针对 RM1P6-ADMIN-CATALOG-TRUTH-U04 的 static package。**

可确认的是：单一 node source、集合分母、生成 output 对账、role-home lookup replacement、动态 owner
switch 保留和 codegen red controls均有当前静态证据。不能确认的是 required capability/authority static
checks 和 package-exit receipt closure；因此不能签发 static package GO。没有进行任何动态运行，故业务为
`NOT_APPLICABLE_STATIC_ONLY`，cleanup 为 `NOT_APPLICABLE_NO_MANAGED_RUNTIME`，两者绝非 business/L2 PASS。

重新审查的最小前提：先让 M-01 的两项 required controls 在 current bytes 通过、补齐 S-01 的
production-path red mutation，并形成 U04 receipt/source-compliance/package-exit set equality。该动作属于
同一 `REVIEW_CYCLE_ID` 的 targeted `REVIEW_ROUND=2`，不得重置 cycle；N-01 仍须由后续 UI-bearing package
连同 IA admission 处理。

## 结论

VERDICT=NO_GO。M-01 阻断 static package closure；S-01 与 N-01 分别限定静态模型硬化和后续 UI package，
不构成动态业务判断。

## 4. Checked inputs and SHA-256

| Input | SHA-256 |
| --- | --- |
| `AGENTS.md` | `e4e3c9af4fb0dc46ce5403edadb6704d1d4a60dea186efc9cbe22dd62fddb347` |
| `PLATFORM-BLUEPRINT.md` | `29bcd8930f9ce75627ca32902f7fabc40c2c93c611e15db6a416cf7d8e3fab4d` |
| `doc/platform/{README.md,roadmap-program-registry.json}` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e`; `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `dde1ef52a134bcb4134ce5b1c42886576a58853bae2593b8b0bb35ad38b8a2cd` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `d0d75e547400145ef7e764d735bc86e2fdaa5ea8a0b19ace213170b527d65a05` |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/decisions/{deterministic-context-only,independent-subagent-adversarial-review,confirmed-business-language-corpus,incremental-compliance-hook}.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20`; `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf`; `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503`; `0e0179020433b8948287f02b061cb1a7c456048b3cfeac0b8fc68a60e83af94d` |
| `project-memory/operations/{business-corpus-adoption-and-read-policy,business-corpus-parked-domain-intake}.md` | `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353`; `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` |
| `doc/decisions/2026-07-30-v2s-admin-catalog-semantic-copy-model.md` | `b566700d188dabc6cf5a02d474c66ff9a74b0ef7798a4388337e1ad15d11ea8c` |
| `doc/review/platform/2026-07-30-v2s-rm1-p6-2-admin-catalog-truth-model-recheck-claude.md` | `a1189f2ef391b83365653c0b553102b3bf78581e57404b48d2da791169b45f6a` |
| `doc/evidence/platform/rm1/p6/rm1p6-u04-admin-catalog-truth-{implementation-amendment.md,package-input.json}` | `d20f7bd482941bad72bb77bffb06d1f5f5394af610bd0042498e71221e6efc27`; `1b5d6179d7d1a7d8c6cc9d14b21ac6c5a0fed74d665f183bfe94e73f7d122695` |
| `doc/evidence/platform/rm1/p6/rm1-u09-implementation-design-granularity-manifest.json` | `4bd9fd4db37754f7373a94c4b56021cc33a4d6fb4f4f93a62418550f15b15c23` |
| IA `01`, `02`, `03` | `7e2ae73f810b8a7ad75a8f0a8800f873b5ea0c9f582648b8002d5258f6bb3a67`; `8d3821c8deaa5a7c0fa460e570b96247842d305daf387d6c59298d2fea442813`; `88a26ba14ad8f0f4d314eab85f8848f49eb32592dae908edaca932f0fdc45d17` |
| `doc/evidence/platform/rm1/p6/rm1p6-u02-ui-ia-implementation-baseline.json` | `e84c690704796bdc08a3f2e47279de42a1117648794446de2be187fe0f43c225` |
| `contracts/policy/{frontend-asset-carryover-manifest,standards-coverage-matrix}.json` | `6b531d3bba676f5cc24e3121f482f7920abfe0b4c476081c1ce0478a17ee3974`; `7d390eb692b627d876cdbfe34d03c140ce4f8450333c2d7618c849ced2fb55b3` |
| `contracts/catalog/admin-catalog.json` | `ce13179496deb134e8f017dbce9582c36915f2bada371c8aa437ffbe7389e190` |
| `scripts/generate/edge-codegen.mjs` | `83db70f02d8a096cf9de1f79090b170f937d214a751588367f8a3eed4eda6d70` |
| `tools/{capability-invariants,authority-source-ledger}/cli.mjs` | `e0971ae46b9d8eb9a0f2c35cb3548a841ef81fe2cf9271e0f316b0777939ebc8`; `3ef4e3b7e0d7e375cf8bf83a4079aa383504d32362cebd74bcbb6db295cb5142` |
| generated platform/operations catalogs | `ddcd3d146663a51f491219548d6579ee4a34734a5af261c8aa6032a8d7f4dffb`; `2262cdcc6dd9d3091614145fd5b40fc87d054035153db897ca840aa8dc0b3015` |
| platform/operations page registries | `7d180dd1fa636fe99a2f433b9c6e76c5fb96244ae43dec66a03c5774de30f635`; `2fb791cc286bb5d04b804c28522ca8208b5ad37417ce1727dd2320c5fd2ac541` |
| `WorkspaceAuthorizationCatalog.java` | `235d64fa9d4c66495865f9402827236e3aa14bdb2f060d1d38b0115af2a58ef3` |
| `WorkspaceAuthenticationService.java` | `66efa01f8387d003aa4b301535884c392ab5306240d05163f944289f2161b44c` |
| `WorkspaceUserPage.tsx`; `WorkspaceInvitationPanel.tsx` | `1d863f2376dbd65c45961fb0f9a9ebdf5f57d89cf2897f9ececc3b4fc0b4af87`; `77f6c4c733892bbc73629b788a87f57eace29fd0aff9389334f3a4cb2a12b6d4` |
| U04 problem-family/source-compliance records | `314ca2a9c441d06ff9ab6c2007ebdc730873fb61b048a441893d1eea374a1b05`; `c069daf055f35b2c62506707d331d92628ccf767311a4faa7f3ccce12ff1b3e0` |
| `doc/evidence/platform/rm1/p1/authority-ledger.json` | `91d482df0b5e73f02b1e6b59ecfca29a589ffd14c9e297d77310d6186e86ca7d` |

## 5. Commands and reproducible results

```text
scripts/check/standards-coverage --phase R5                     PASS (150)
scripts/check/edge-codegen                                      PASS
scripts/check/edge-codegen --self-test                          PASS (catalog red mutations included)
scripts/check/frontend-architecture                             PASS
scripts/check/frontend-architecture --self-test                 PASS
node tools/capability-invariants/cli.mjs check                  FAIL (P3_A_TYPED_OWNER_EXCEPTION_FROZEN_COUNT_DRIFT:88)
node tools/authority-source-ledger/cli.mjs check                FAIL (P1_LEDGER_ROW_INVALID:ST-11)
node tools/compliance-control/cli.mjs static-scan               PASS (32; RM1_STATIC_ADMISSION)
```
