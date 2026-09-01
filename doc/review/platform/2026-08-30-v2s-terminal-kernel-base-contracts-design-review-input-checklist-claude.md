# TER `kernel.base.contracts` DESIGN review input checklist · Round 1

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN |
| REVIEW_CYCLE_ID | TER_KERNEL_BASE_CONTRACTS_DESIGN_20260830 |
| REVIEW_ROUND | 1 |
| REVIEW_ROUND_LIMIT | 2 |
| reviewerKind | INDEPENDENT_SUBAGENT |
| review artifact | `doc/review/platform/2026-08-30-v2s-terminal-kernel-base-contracts-design-review-claude.md` |
| blindReviewDeclaration | 先独立形成 findings/verdict 后才对照任何作者处置材料 |
| authorMaterialReadAfterIndependentVerdict | true（本轮没有作者处置材料） |

## 1. 读取完整性声明

本轮只读审查。除本 checklist 与对应 review artifact 外，未修改需求、详设、计划、源码、配置或其他文件。`git` 仅用于只读状态/差异查看；未执行任何仓库控制动作。

## 2. 仓库入口、skill、授权与治理输入

| path | SHA-256 | 完整读取 | 结论 |
|---|---:|---|---|
| `.agents/skills/cs-review/SKILL.md` | `5533b184854b47441e41f549a10724cc3ec5b0eea76a7fbf907a4022e34b3c42` | YES | DESIGN 必须走 Action 1-B；空提取无效；每条 finding 要有位置、事实、后果、最小修复、同根扫描与分类。 |
| `AGENTS.md` | `5caa9b1724eb678dfe5ebb48a96a8290ae8747d36920c072fdc404fa9009dcc6` | YES | 当前任务真相源是 Dexter 直接指派；Roadmap 不推断当前状态；review cycle 最多两轮；本轮为独立子 agent。 |
| `CLAUDE.md` | `5d6ca2f45578c8664b3e8f3743be17c99c1de9c67f764a1382cb89e2219e26c5` | YES | Claude/review 输出需可独立核验，不能以作者结论代替审查。 |
| `PLATFORM-BLUEPRINT.md` | `b5b9b5110c9e7d8642b81ea885cbe8580aef2e1f042c710dc5bce590538f6fe7` | YES | 平台边界与 owner/source-first 约束适用。 |
| `doc/platform/README.md` | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` | YES | roadmap registry 为授权入口。 |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | YES | 选出 platform roadmap。 |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` | PARTIAL: 授权字段完整读取 | Roadmap 只记录授权；当前 contracts 详设、实施计划与实施由 Dexter 直接授权，Roadmap 不作当前任务状态推断。 |
| `doc/platform/review-standard.md` | `0fbd59cbec9b849b232b522fde390c97867efb17d5d4815e01f9cbfcc7578aaf` | YES | review artifact 必须结论先行、证据分层、同根扫描。 |
| `doc/platform/terminal-coding-standard.md` | `bb0dee642294a141a9fa423d72cd5195f47acd8b009d80d916e5b6b57c05f30c` | YES | TR-05/TR-06/TR-09 为本轮核心判据。 |
| `doc/decisions/templates/implementation-design-template.md` | `7b1b2da048c7761540e58666986382476bc50273e9964f871c21f13f2293ac03` | YES | 用于 Action 1-B 模板缺项提取。 |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `108ba9050ed256c6e41a3e53e3af4c761706c4dc8fe697de9540fc649f5af6d3` | YES | 本轮盲审、最多两轮、作者处置材料后读。 |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5` | YES | 机器门只作机械判定，须有 red mutation；业务语义靠 review。 |
| `project-memory/operations/verification-governance.md` | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` | YES | 防止假绿、marker/首败边界适用。 |
| `project-memory/operations/terminal-coding-standard.md` | `a73c18c29f8013e7bedae46c1e39f533a216718d75a5cebe60b0097a8e591a35` | YES | TER coding standard memory 适用。 |

## 3. project-memory recall

### 3.1 kernel 全量读取

| path | SHA-256 | 完整读取 | 结论 |
|---|---:|---|---|
| `project-memory/index.md` | `549818b4e90dd17b054710c29f7f3b2e0d2c81cb262e7f624c53e095a25c63e5` | YES | 作为导航读取，不作为规则 anchor。 |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | YES | 显式授权与仓库控制边界。 |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | YES | owner/单 deployable 边界。 |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | YES | 依赖/事务/数据边界；本轮多数 N/A。 |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | YES | design/review 需先证伪、发现视为待验证输入。 |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` | YES | 证据分层、首败、cleanup、Git 边界。 |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | YES | Heritage 只读，不建 runtime/build fallback。 |

### 3.2 六维 recall

请求维度：`taskKind=design, domain=platform, consumerFace=all, owner=platform, impact=architecture, trigger=review`。

| 命令/路线 | 结果 | 处置 |
|---|---|---|
| `scripts/context/recall-memory --task-kind design --domain platform --consumer-face all --owner platform --impact architecture --trigger review` | `PROJECT_MEMORY=FAIL REASON=unknown or non-specific route: consumerFaces:all` | 记录为工具路线不接受 `all`；未把失败当无 memory。 |
| 同维度改用 `consumer-face=backend` / `platform-admin` / `operations-admin` | 有命中 | 打开下列适用原文。 |

| path | SHA-256 | 完整读取 | 适用结论 |
|---|---:|---|---|
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` | YES | deterministic context，不用 daemon/provider/作者说法代替源码。 |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `9d2903a17c1d71738f530fe00f0abdedf99b2d5370ce6219e63ce1fc082381f1` | YES | 独立证伪立场。 |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md` | `65e544c180c1b84e8b7d9c9da12f2fd06f8a480be00225179df2b72bcf29ab39` | YES | TER 架构/栈边界。 |
| `project-memory/decisions/terminal-build-order-and-batches.md` | `1a658ab71001980bd3f1c973cd73a08610e508a9294fbf778cc01e53b8692856` | YES | build order 与 batch 边界。 |
| `project-memory/pitfalls/green-by-existence-check.md` | `1d984aa79933cc6f396a049c0ac2767805386bd00ba1a1f37cdaa9f48ce0d234` | YES | existence check 假绿风险。 |
| `project-memory/practices/gate-four-pieces.md` | `5b37e2d44f9307b26ea3e805372d1e6cc9e1a84fc4155ae5791646fe86f2df3b` | YES | gate 需要入口、模型、真实树、聚合接线。 |
| `project-memory/pitfalls/machine-gate-test-api-false-positive.md` | `8ccdd70cd9b9412d56179a02412accd0b73af058b39f8ffa35b61336f17eeee6` | YES | test API / marker 假阳性风险。 |

### 3.3 业务词干 corpus 检索

检索词干：`contracts` / `terminal` / `shared language` / `ID` / `error` / `parameter` / `request` / `transport`，并检查中文近义词。

结论：`NO_CORPUS_ENTRY_MATCHED` for TER kernel/base/contracts 技术共享语言、ID、错误、参数、request、transport。本轮 corpus 命中的“合同/contract”属于业务合同语义，不是 TER 根契约包授权或字段来源；不得混用。

## 4. 被审对象

| path | SHA-256 | 完整读取 | 备注 |
|---|---:|---|---|
| `doc/plans/platform/2026-08-29-v2s-terminal-kernel-base-contracts-requirements-claude.md` | `9f5d7395d4eb2b466375a1465500ab3189a544e9cec06e32a886c853f3cc6655` | YES | 需求正本。 |
| `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-design-codex.md` | `3c3efbcf3814ab697cb135c423ac5d7ba8eac5a16685e55b88bfd772ba241ed1` | YES | 详设。 |
| `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-contracts-implementation-plan-codex.md` | `c4ae97a6be4826067180d517b9662fc7df8797d8b1fdb0a0749ed1b25602923d` | YES | 实施计划。 |

## 5. Owning source 与上游输入

| path | SHA-256 | 完整读取 | 备注 |
|---|---:|---|---|
| `apps/terminal/kernel/base/contracts/package.json` | `636ef3278c373f5c8962378486e9e5ad7c0ee18b23d7023458c92f6392ef800a` | YES | 当前仅骨架。 |
| `apps/terminal/kernel/base/contracts/tsconfig.json` | `aa32b060a7cf2f29c3e600ee045a772e78baddaf9ac6eae999373ecbf5d4a355` | YES | 当前只 include `src/**/*.ts`。 |
| `apps/terminal/kernel/base/contracts/src/index.ts` | `b7480428e0003f95ea3c03b84a1c5a5da1e2149155bd4626b408e1148b283962` | YES | 当前只骨架导出。 |
| `apps/terminal/kernel/base/contracts/src/moduleName.ts` | `3853ac7d86788f9772af0d750d9172435bb90969a40102eab62da86c5de168e3` | YES | 骨架元数据。 |
| `apps/terminal/kernel/base/contracts/src/dependencies.ts` | `595daf3e2ccb66fb942189dce29341e56ef1ab59602dc18dfbc204e2f11e1cd1` | YES | 空依赖声明。 |
| `apps/terminal/package.json` | `18f78a647be99720447f04373eb6dfc35c6804d32e978d8162a696c8733ea0ef` | YES | terminal verify/typecheck/test scripts。 |
| `apps/terminal/skeleton-graph.ts` | `c4c81e6b0fee753dbf3d06cffaa39d2f1590c913ffa072ed7640d8743b1b8a58` | YES | contracts 为根依赖、依赖为空；多包依赖它。 |
| `tools/terminal-skeleton/verify.mjs` | `30b68c8ca2b259c6a886e80eb942b708faa89c80c1dc18db6f3d556dfe5d88e2` | YES | 当前 `test` 仅 dry-run，是详设 CP-2 要修的假绿面。 |
| `tools/terminal-skeleton/verify-static.mjs` | `da6681cb697e2e33c9c78870a632f6a0aa7fb897cc28d491a89efa994da7b3f0` | YES | 当前只接 skeleton static。 |
| `tools/terminal-skeleton/check-static.mjs` | `19ed2b6ed788af73a4f1a025c66067794aad4775c335536356788692648e0e3c` | YES | 已有 graph exact-set 无条件比较。 |
| `tools/terminal-skeleton/check-static.test.mjs` | `9613f67bf72048fbf252a35995be554a7c4ba1fe5c15287457cbe76e039945a7` | YES | 已有 no-import red mutation。 |

### 5.1 五个 adapter package 与 runner

| path | SHA-256 | 完整读取 | 备注 |
|---|---:|---|---|
| `apps/terminal/adapter/android/persist-kv/package.json` | `4b50bd0d5648f82e8cc96f6485dd8e07c3c1cc4a1cc4ebbaccc2a7cafd06f269` | YES | `type: module`，devDeps 旧 template 值。 |
| `apps/terminal/adapter/android/persist-kv/internal/module_scripts/test.js` | `da2cff86fcd1746e5a5d07eb0bc83907e6bc04df783f1e2691ff6513b7564d24` | YES | CommonJS runner in ESM package。 |
| `apps/terminal/adapter/android/persist-kv/internal/module_scripts/util.js` | `0659a04926011ba8cf26ebc48294f17d6fde2969ab6ee0877dfd677ce8a51575` | YES | CommonJS util in ESM package。 |
| `apps/terminal/adapter/android/device/package.json` | `c029b0ceec4dd0875c14a0e226bf32cfdf29ac2a2399792ea23213ea0a8a5876` | YES | 同根 adapter。 |
| `apps/terminal/adapter/android/device/internal/module_scripts/test.js` | `b780a860e30881eef1b95b50aa2730c8f8c15e1952c6d6bef139152e03dab86a` | YES | CommonJS runner in ESM package。 |
| `apps/terminal/adapter/android/device/internal/module_scripts/util.js` | `1f237f5d1ed4a6fd24b7a062c184bee5316a313b3f26e2da31bd791b8a04e5f7` | YES | CommonJS util in ESM package。 |
| `apps/terminal/adapter/android/app-control/package.json` | `aea9c77858171a0866f3206d095a48a32438ad9021d2d79f61e7bfbbbb0cdbf4` | YES | 同根 adapter。 |
| `apps/terminal/adapter/android/app-control/internal/module_scripts/test.js` | `b780a860e30881eef1b95b50aa2730c8f8c15e1952c6d6bef139152e03dab86a` | YES | CommonJS runner in ESM package。 |
| `apps/terminal/adapter/android/app-control/internal/module_scripts/util.js` | `1f237f5d1ed4a6fd24b7a062c184bee5316a313b3f26e2da31bd791b8a04e5f7` | YES | CommonJS util in ESM package。 |
| `apps/terminal/adapter/android/logger/package.json` | `f88c2008cde1eb871cfc675eb0d872ded4f9f0fa475a5b1224b7ec64762f9557` | YES | 同根 adapter。 |
| `apps/terminal/adapter/android/logger/internal/module_scripts/test.js` | `b780a860e30881eef1b95b50aa2730c8f8c15e1952c6d6bef139152e03dab86a` | YES | CommonJS runner in ESM package。 |
| `apps/terminal/adapter/android/logger/internal/module_scripts/util.js` | `1f237f5d1ed4a6fd24b7a062c184bee5316a313b3f26e2da31bd791b8a04e5f7` | YES | CommonJS util in ESM package。 |
| `apps/terminal/adapter/android/dual-screen/package.json` | `e313e29de38d1b53cb8989f3469659824f29aeace7b364181e5ca644a6686243` | YES | 同根 adapter。 |
| `apps/terminal/adapter/android/dual-screen/internal/module_scripts/test.js` | `b780a860e30881eef1b95b50aa2730c8f8c15e1952c6d6bef139152e03dab86a` | YES | CommonJS runner in ESM package。 |
| `apps/terminal/adapter/android/dual-screen/internal/module_scripts/util.js` | `1f237f5d1ed4a6fd24b7a062c184bee5316a313b3f26e2da31bd791b8a04e5f7` | YES | CommonJS util in ESM package。 |

### 5.2 POC contracts 与相关消费者

POC 目录 `../newPOSv1/1-kernel/1.1-base/contracts/**` 已按 file list 与 SHA-256 全量枚举；重点语义文件逐项打开：`src/types/{ids,error,parameter,module,command,request,transport}.ts`、`src/foundations/{runtimeId,time,error,definition}.ts`、`src/index.ts`、`test/**`、`vitest.config.ts`、`tsconfig.json`。相关消费者通过 `rg` 追踪 imports/字段读写，重点覆盖 POC `platform-ports` logging、transport/runtime request/error/transport 使用、topology route context 使用、当前 v2s TER consumers 对 `moduleName` 的使用。

结论：POC `createRuntimeId<TId extends string>` 存在 caller-chosen brand 漏洞；POC `renderErrorTemplate` 缺参静默空串；POC `ParameterDefinition<any>` 与多处 `Record<string, unknown>` 属 TR-05 清理面；当前 v2s contracts 尚未实现目标 74 exports。

## 6. Action 1-B 前置提取记录

### 6.1 模板缺项

1. 详设把 implementation-design-template 中 operation/path/face、owner write、迁移/seed/UI 等整组折叠为 `NOT_APPLICABLE`；本批纯 contracts 包，这一折叠方向成立。
2. 但 template/需求对 C-4 的要求是“每个导出”回答共享词汇与消费者，详设 `§4.10` 仅按 7 组给 group-level 理由，未形成 74-row per-export 清单；这成为 review finding。

### 6.2 三份文档矛盾

1. 需求 `T-6` 要求远端值非法时 `ResolvedParameter.source` 必须是 `catalog-fallback`；详设/计划把本批 T-6 降为只证明三个 literal 可构造、`catalog-fallback !== default`，并把 invalid remote resolver 推迟。该矛盾成为 review finding。
2. 需求写 `npx expo install --dev <pkg>...`；详设/计划采用 `npx expo install --yarn --dev jest-expo babel-preset-expo -- --mode=update-lockfile`。本轮用 CLI help 验证 Expo 可透传 `--mode=update-lockfile` 给 Yarn，未形成 finding；执行期仍须首包实跑验证。

### 6.3 无出处数值/枚举

已核：`74` exact exports 在详设内可由 `3+23+14+5+7+7+7+8` 对齐；`TR-05 A=7/B=7/C=0` 与需求的 13 处 `Record` + 1 处 `any` 分母可对齐；`ErrorCategory(9)`、`ErrorSeverity(4)`、`ParameterValueType(4)`、四个 source 三值闭集均来自需求 C-6。未作为 finding。

## 7. 作者变更点前读/后读要求

| 变更点 | 写入前必须重开 | 写入后必须回读/证明 |
|---|---|---|
| CP-1 contracts 74 exports 与 `src/**` 实现 | 需求 §2/§4/§6/§8；详设 §4/§5/§6；TR-05/TR-06；POC types/foundations；实际消费者 imports/字段读写 | `src/index.ts` exact-set；T-1…T-9；F-1…F-4；4c negative control；`--listFilesOnly` 包含 typecheck fixture。 |
| T-6 / parameter resolver 边界 | 需求 `ResolvedParameter.source`、T-6；详设参数协议；POC parameter definition；未来 resolver 是否在本批授权内 | 若保留需求语义，则必须有生产 resolver/纯函数契约与 invalid remote → `catalog-fallback` 测试；若不保留，则需同步改需求/详设/计划与测试名称，不得假绿。 |
| C-4 per-export rationale | 需求 C-4 与交付物；详设 §4 exact exports；source consumers | 74-row 清单逐项包含共享词汇理由、已知消费者/未来包类别、未冻结档位。 |
| CP-2 contracts static gates/support/verifier | verification governance；现有 skeleton check/verify；pitfalls/practices | 每门 model red、真实树 green；support add/delete red；`verify.mjs` 真跑 test 且 marker exact-set。 |
| CP-3 adapter zero-test 与 SDK devDeps | 五包 package/test/util；需求 §8.1；详设 §6 CP-3；Expo/Yarn help 与当次 latest raw manifest | 首包成功后再继续；五包 semantic write exact-set；root `yarn install` convergence；test owner exact-set=6，1 real + 5 NO_TEST_FILES。 |
| CP-4 全范围收口 | 需求、详设、计划、TER memory、所有 CP focused evidence | fresh 全范围对账，不汇总替代重开；整体命令全绿；未冻结项未升格。 |

