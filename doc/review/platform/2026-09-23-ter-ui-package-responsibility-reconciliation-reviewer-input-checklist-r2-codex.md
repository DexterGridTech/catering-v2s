# TER UI 五包公共导出边界：第二次逐代码对账独立复查清单

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION`  
`REVIEW_ROUND=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`REVIEW_ROUND_LIMIT=NOT_APPLICABLE_FOR_RECONCILIATION`  
`READ_STATUS=PENDING_FRESH_REVIEWER`  
`BLIND_SEQUENCE=SOURCE_AND_REQUIREMENT_FIRST; AUTHOR_LEDGER_AND_PRIOR_REVIEW_AFTER`

## 复查任务与边界

这是全新只读复查者，不能复用第一位 reviewer 的结论作为本轮准入。目标是独立核验详设 §§3–8 的逐代码对账表、S-1 元数据快照以及 `OPEN → MATCHED` 状态轨迹；不是整批 implementation GO。必须先从当前需求、详设、计划、源码/测试和本清单所列 project-memory 输入形成初步 finding；此时不要打开作者对账记录、remediation evidence、先前 reviewer 报告或 Claude review。形成并返回初步 finding/verdict 后，才打开 deferred 材料，逐行核对。不得写文件、运行 Git、测试、构建、Web/Metro、设备或截图。

复查的唯一范围仍是 Claude 复评的 S-1/S-2/S-3/N-1：完整 part 元数据快照，计划 §7 的逐代码对账及真实 OPEN→MATCHED 记录，详设/计划中的非 key/non-surface 元数据红变异，以及“零运行时/APK 字节变更、设备记录是基线观察”的限定。生产源码、导出面、依赖、脚本、构建产物和设备证据都不得改动或重跑。

## 启动与适用规则

请先校验并读取当前字节：`AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/active-document-index.json`、`doc/platform/roadmap-program-registry.json`、registry 选出的 Roadmap 授权字段、`project-memory/index.md`、`project-memory/required-inventory.json`、`scripts/README.md`。按 AGENTS 的 Roadmap 规则只读授权字段，不从已删除的 CURRENT 字段推断任务。

另读 `project-memory/decisions/deterministic-context-only.md`、六个 kernel、`project-memory/decisions/independent-subagent-adversarial-review.md`、`project-memory/operations/terminal-coding-standard.md`、`project-memory/operations/implementation-source-reread-discipline.md`，以及下列两条 memory route 的**全部命中项**。仓库中退役的 standards-coverage matrix 不得复活为准入条件。

本轮业务 corpus 检索词沿用：`sample.desk.member-form`、`TER Admin`、`TER UI`、`公共导出`、`wallpaper-picker`、`displayModes`、`包职责`。逐词执行/读回命中结果；只有实际无匹配才能报告 `NO_CORPUS_ENTRY_MATCHED`。

## 六维 memory 路由原始命令与命中分母

两条查询必须从当前仓库重新运行；除 `impact` 外五维相同。保存并在回复中逐项列出 `.refs[].path` 和所有 `.refs[].sourceRefs[]` 的实际输出；不得仅凭这份期望表声称已经复跑。所有下面列明的 route hit 都必须逐个打开并记录 read status。每个命中的 applicable owning `sourceRefs` 必须打开；不适用项须注明不适用理由，不得静默遗漏。

```sh
scripts/memory/query --task-kind implementation --domain admin-ui --consumer-face platform-admin --owner frontend-platform --impact evidence --trigger implementation
scripts/memory/query --task-kind implementation --domain admin-ui --consumer-face platform-admin --owner frontend-platform --impact governance --trigger implementation
```

当前复算结果为 evidence 23 hits、governance 27 hits、union 35 unique hits。下表 SHA-256 是本清单生成时对实际命中路径复算的值；reviewer 应检查当前值并报告任何漂移。`E`/`G` 表示对应 route hit。

| route hit path | route | SHA-256 |
| --- | --- | --- |
| `project-memory/decisions/confirmed-business-language-corpus.md` | E,G | `335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d` |
| `project-memory/decisions/http-crud-efficiency-design-redlines.md` | E | `f0a075710211cbd62147d53a4bac6f7f9404755bf9d5b52f206e66c15f8ec34e` |
| `project-memory/kernel/01-workspace-and-roadmap.md` | E,G | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| `project-memory/kernel/02-service-shape-and-owner.md` | E,G | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | E,G | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | E,G | `4c68d6154af8edaf54fc2069f6cdd111433c231ae9df701b3bf94408337dc8bc` |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | E,G | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` |
| `project-memory/kernel/06-heritage-and-change.md` | E,G | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| `project-memory/operations/browser-l2-execution-standard.md` | E | `443559f0703324d788230db9a18e22b97d17c7f6b22d7e49edae0a91ced93117` |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | E,G | `d362c4f78c5fc0cb1225a7a4465f82ebbd0c41b886535d69b9f698ea162cd7a9` |
| `project-memory/operations/implementation-source-reread-discipline.md` | E,G | `6944ae47f0e059a52e75096b17620a3c43852e52a9b44e69737554ac646293ce` |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | E,G | `f1023569982f92bc2cfa1e3ce475b08164eb20cc1d756bda025251af65de1bce` |
| `project-memory/operations/test-closed-loop.md` | E,G | `0459c5bd0d0e69366e3d8234fe16033f086ee137cccba7862adefb3fcfc65dc7` |
| `project-memory/operations/execution-economics-and-failure-family-closure.md` | E,G | `033f43201d185e8bac32e424097f475bd54252346dadbd3c2400dea96984b7e0` |
| `project-memory/operations/owner-cas-version-source.md` | E | `b639b906c28b4ad5874058ffb3b97e147ceacfcefa8e66e41f782b04cdd51f6e` |
| `project-memory/operations/verification-governance.md` | E,G | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` |
| `project-memory/pitfalls/after-state-not-checked-against-other-gates.md` | G | `439e3d8ed01fb14931b56e0a4489d489aef26aad00333cec71dfc757f53b9f1a` |
| `project-memory/pitfalls/check-repo-before-authoring.md` | G | `17f7f1dced088689ecfe20b4de2cded1b40238383ef61580d49b730663c1544c` |
| `project-memory/pitfalls/claim-versus-behavior.md` | E | `818038f3c54b70e5df7d68d1219b0c3ad250b83ea99e4630f422bdac04b28703` |
| `project-memory/pitfalls/count-without-member-list.md` | E | `61e238bfdc55261156617d7a38023dbf6032ed68983080ff4de66a99c5016f8f` |
| `project-memory/pitfalls/criterion-degraded-into-list.md` | G | `f07ba6ef4c4b375382ca540f8fa16e906dd86d68a4019dfaa36092280b46b6e3` |
| `project-memory/pitfalls/green-by-existence-check.md` | E,G | `1d984aa79933cc6f396a049c0ac2767805386bd00ba1a1f37cdaa9f48ce0d234` |
| `project-memory/pitfalls/line-number-as-anchor.md` | G | `83df4a9b40913329a4292efb28c275bba2128cce25f4513c8634b832309526d7` |
| `project-memory/pitfalls/machine-gate-selftest-format-fragility.md` | E,G | `6b0d276882a3488f6dade4885ec4c78fa23e4bb4d23cf720e14268346c46ab5a` |
| `project-memory/pitfalls/negative-universal-claim.md` | E | `f06221b0894c551b794984f28f5c7938dc921829be70f23fd04e5472fda90f0e` |
| `project-memory/pitfalls/probe-narrower-than-criterion.md` | G | `3684adac3ff9d6b9bd6f9d41bf90eb810f5ca79eb1fb82a670f17fefe67c4364` |
| `project-memory/pitfalls/repo-rule-cited-against-dexter.md` | G | `8e84343d5a0dc27806f80f45efd45162349db71a8078c89acf1e583d0200d8fc` |
| `project-memory/practices/atomic-group-expected-error.md` | G | `a7b918b3e62fbe8bae40d4561a113aa8a98eafba07775d7ebcce452a3c964b49` |
| `project-memory/practices/backend-acceptance-route-fixture-oracle-integrity.md` | E | `24ecafd9693ea087d514a36548f21ca10222ee4b8a9c74233ebc33b5beec415e` |
| `project-memory/practices/business-channel-list-scope-and-validity-display.md` | G | `f517a0b3956716db484e1a84e29d8f2c3670deaeb387379c367f550385ea3823` |
| `project-memory/practices/content-tab-unified-refresh-lifecycle.md` | G | `fe3cc9f025e2c9b10de803890158843e89e3a529e3c2b7a44590bd3068d1a30d` |
| `project-memory/practices/detail-drawer-action-menu.md` | G | `d1d4d22c717203f77de95bff14276c7225a51f2c97a65632720212f2def6da4f` |
| `project-memory/practices/drawer-form-lifecycle.md` | G | `aa7fe921a450ce4490656aee6132a4fa76aa058a7a51552929766a18a6afb0e4` |
| `project-memory/practices/external-collaboration-readback-display-and-detail-surface.md` | G | `9ecf5909f0d4bae15d8a0bd950233a1b4e508a55e7d9a98e5b34230b85524208` |
| `project-memory/practices/gate-four-pieces.md` | E | `5b37e2d44f9307b26ea3e805372d1e6cc9e1a84fc4155ae5791646fe86f2df3b` |

## 盲审前要直接重开的任务材料

至少逐字读取以下当前文件，并在报告中列实际 SHA-256 与读取状态。除特别标注外，需评估详设 §3 至 §8 每一行/子条款；不得只抽样。

- 需求、详设、实施计划：`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md`（`9fca0272f326a9ee56b7182e70d512b38c398d09e28d2a219cbbacc55da8d751`）、`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md`（`530e45da60d2e4c29459c2deb5a6d389b198d42c7f0687db9eeef02396030ea3`）、`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md`（`6c4786bc8b112722567b03b895721cf0eb4ad53d654f492e9a6a02b14569eab9`）。
- 元数据类型/构造：`apps/terminal/ui/base/render/src/foundations/definePart.ts`。
- 五包的 `README.md`、`src/index.ts`、`package.json`、`terminal-invariants.json`、`test/publicSurface.test.ts`；两 integration 的 CSS export-map 子路径、Android 宿主 import 和 Metro 配置均要核。
- 当前 owner 源码与测试：`apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts`、`test/memberDesk.test.tsx`（测试当前 SHA `fca74b257eb0b34a06ec53cc48fb9db6252ee2187abdd5a35fec42d5a262b935`）；`feature/sample-staff-auth/src/parts/parts.ts`、`test/staffAuth.test.ts`（测试 SHA `a1ec60e5975d66c01e034dafe9a3d604eb2e0d3cc0dbebd737ccdfdc458a6dc3`）；`feature/sample-wallpaper-picker/src/parts/parts.ts`、`test/sampleWallpaperPicker.test.tsx`（测试 SHA `ae2be2dc6852e18f518f3eda71da2ab8c274b3b9fbe59729fd4ce68412498bb7`）；`integration/sample-console/src/assembly/assembly.tsx`、`test/sampleAssembly.test.tsx`（测试 SHA `ea49c5e6c74e5279feda2308e27efac4477831867f8700e161bd60907a2be37f`）；`integration/sample-wallpaper-console/src/parts/parts.ts`、`src/assembly/assembly.tsx`、`test/sample2Assembly.test.tsx`（测试 SHA `16b56a6e796c22061c514f5a9ea8e348f60528f3df5153dde78a0dfd16196796`）。
- 行为边界直接 owning source 至少包括 `sample-member-desk/src/hooks/useMemberForm.ts`、staff-auth 的 `src/foundations/systemFailureDismissal.ts`、各 feature 的 part/command owner 测试，以及两 integration 的 assembly/dependency/theme/platform surface source 与 tests。

元数据不得只看 testID、数量或由被测生产数据动态生成的自证 oracle。逐控件核对测试期望是否是显式冻结的精确集合，以及以下详设 §6 字段全部被覆盖：`partKey`、`rendererKey`、`containerKeys`、`displayModes`、`workspaces`、`instanceModes`、`title`、`surfaceForm`、`layerTier`、`layerGuard`。从 owning `parts.ts`/assembly 逐字段比对期望值。重点证伪 `sample.desk.member-form.displayModes: PRIMARY → PRIMARY+SECONDARY` 是否能由新快照变红；本轮无权也无需要改 `parts.ts`。`description` 不属于详设要求元组，不得把记录误述为完整 `UiCatalogEntry` 覆盖。

## 必须延后到独立初评之后的作者材料

独立初评提交后，才读取并核对：

- `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-codex.md`（作者逐代码 ledger；复查时现场取 SHA）。
- `doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-review-remediation-evidence-codex.md`、`doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-cp3-execution-evidence-codex.md`、`doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-dynamic/README.md`。
- `doc/review/platform/2026-09-23-ter-ui-package-responsibility-code-design-reconciliation-review-codex.md`（第一位 reviewer 报告及审计轨迹补充）。
- `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-design-diagnostic-review-claude.md` 与 `doc/review/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-review-claude.md`。

随后逐行验证 ledger 是否穷尽详设 §§3–8，状态只有 `MATCHED`/`OPEN`，证据路径能否支持每个结论；S-1 必须明确经历修订前 `OPEN`、修订后实施者 `MATCHED`、独立复核待定/最终 `MATCHED` 的时间顺序，不可倒写。核对 root export 71 个与 export-map 7 条无缩水；全部 scope-external OPEN 仍 OPEN；设备记录只称未变 APK 的基线观察。核验 S-3 两份设计文档要求的真实非 key/non-surface 元数据 red mutation；focused/变异结果只可从 evidence 读取，不得在本轮重跑。

## 报告格式

返回只读报告，包含：`reviewerKind=INDEPENDENT_SUBAGENT`、本清单路径与 SHA-256、盲审声明、`authorMaterialReadAfterIndependentVerdict=true`；初评先于作者材料；两条 query 的完整实际 `.refs[].path` 与每条适用 `sourceRefs`、逐项 SHA/read status；需求/详设/计划/项目记忆/源码的实际读取清单；详设 §3–§8 每行逐项 `MATCHED` 或 `OPEN`（实现偏差与产品/外部范围 OPEN 分列）；S-1 状态时间线、字段和值对账；S-2 对账记录完整性；S-3 判据和实际变异证据；N-1 设备基线限定。对任何 OPEN 写 first failure、last known good、broken boundary 与下一步。不可写文件，不得把这份 reconciliation 结果升格为整批 implementation GO。
