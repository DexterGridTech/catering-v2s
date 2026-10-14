# TER T1 实施源码语义对读记录

`REVIEW_TARGET=IMPLEMENTATION_SOURCE_READBACK`
`STATUS=AUTHOR_SOURCE_READBACK`
`VERDICT=NOT_CLAIMED`

本文件是 V-18 计划指定的源码语义对读记录，不是独立审查 verdict、CP 对账或动态验收结果。独立 CP-05 与全批 6b 结论分别记录在对应 reviewer 文档中。

## 核验输入

- 正式需求：R-03、R-07～R-15、V-02、V-03、V-18，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md`。
- 详设：CP-05、§8.1、§9、§11a，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md`。
- 计划：CP-05、§7，见 `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md`。
- 项目正本：`doc/platform/terminal-coding-standard.md` TR-10、TR-R06、§7.1、§8；`project-memory/operations/terminal-coding-standard.md`；`project-memory/pitfalls/machine-gate-selftest-format-fragility.md`。
- 逐包 README、CP-05 源码/测试和此前 finding intake：`doc/review/platform/2026-10-14-ter-t1-cp05-implementation-evidence-codex.md` 与 `doc/review/platform/2026-10-14-ter-t1-cp05-implementation-reconciliation-codex.md`。

## 源码责任与交叉读回

| 核验面 | 当前源码与消费者 | 对读结果 |
|---|---|---|
| 包内具名单元与共享纯逻辑 | `apps/terminal/kernel/feature/store-basic/src/features/actors/storeBasicActor.ts`、`src/features/actors/shared/loadStore.ts`；`apps/terminal/kernel/feature/project-basic/src/features/actors/projectBasicActor.ts`、`src/features/actors/shared/loadProjectContext.ts` | reducer callbacks 由事实 owner actor 提供；共享 loader 不直接写 slice。CP-05 的 focused typecheck/test 与 R6 对账覆盖这条接缝。 |
| 包身份、依赖和 root public surface | `apps/terminal/**/src/moduleName.ts`、`src/dependencies.ts`、`src/index.ts`、`terminal-invariants.json` | root 保持显式 barrel；`publicExports` 现在由结构门按 TypeScript checker 与 root 导出精确比较。业务 command/selector 由真实消费者通过包根使用，未把 generated HTTP client 公开为跨包业务 API。 |
| UI package contribution | `apps/terminal/ui/base/feature-assembly/src/`、`apps/terminal/ui/base/integration-assembly/src/`、`apps/terminal/ui/base/admin-shell/src/` 与两套 integration assembly | feature module 声明呈现贡献；integration 只装配包、应用政策和外部输入；服务配置 UI 由 admin-shell 承载，没有新增 panel package 或 assembly 业务名单。 |
| state qualification 与 topology | `apps/terminal/kernel/base/state/src/`、`apps/terminal/kernel/base/topology/src/`、两套 integration assembly | slice owner 声明同步资格；topology 消费已注册的资格视图；integration 不保留第二份 `stateSyncSlices` 白名单。 |
| 外部 API 与凭证通路 | `apps/terminal/kernel/base/terminal-data-client/src/`、各 store/project/update/remote owner 的 `src/generated/`、`apps/terminal/contracts/` 及现有生成器 | owner private generated client 由 canonical/generator 产生；跨包业务读写沿 selector/command，TDC 只承接认证/通用 transport 通路，不复活全业务 API 目录。 |
| address 集合与环境 | `apps/terminal/kernel/base/server-config/src/`、`apps/terminal/kernel/base/transport/src/`、两个 application manifests、DEV producer 与 automation config readers | package defaults、环境解析、server-config owner 和通用 transport 按具名服务地址接线；当前 DEV 双 HAProxy 拓扑未扩展。 |
| 原生资源及唯一自动化入口 | `apps/terminal/adapter/android/`、`apps/terminal/application/base/android/`、`tools/terminal-automation/`、`scripts/test/terminal-automation.mjs` | 原生资源由 adapter/host 持有，业务身份仍在 owner；设备 Journey 只注册在受管 automation driver。设备行为仍须按 CP-06 实测，本文不作动态结论。 |

CP-05 纳入的 30 份中文 README 按逐包路径记录在上述 evidence 文件，并由 fresh CP-05 reviewer 对照包根公开 API、真实 factory/command/selector 消费者、结构及维护说明检查。该逐项检查记录与 README 语言/存在性扫描分开；41 个 workspace README 的存在或中文字符计数不替代语义判断。

## 公共导出差量与机械保护

全批 6b 的第一轮独立对账发现 `publicExports` 与 `src/index.ts` 的差异。主 agent 以 TypeScript checker 复核了当前声明 public surface 的 35 个 package，确认 13 个 package 有 75 个实际 root export 未列入 invariant，未发现反向多列项。

最小修正保留现有 root API、不改消费者或业务行为：将 13 份 `terminal-invariants.json.publicExports` 与实际 TypeScript root exports 对齐；将 `remote-control` 和 `automation-agent` 的 wildcard root re-export 改成等价的显式 named re-export。随后在现有 `tools/terminal-skeleton/check-static.mjs` 增加单一结构规则，检查所有带 `publicExports` 的包精确相等并拒绝 root wildcard。`tools/terminal-skeleton/check-static.test.mjs` 的 mutation 覆盖少列 export、wildcard 及 TDC generated client root re-export；没有创建第二个 checker、registry 或 hash ledger。

当前字节验证：

- `node tools/terminal-skeleton/check-static.mjs`：退出码 0，`RULE_GATES=13`，13 项均 PASS，`SCAFFOLD_HYGIENE=PASS`。
- `node tools/terminal-skeleton/check-static.test.mjs`：退出码 0，`TERMINAL_SKELETON_MODEL_TEST=PASS`；少列 public export、wildcard root barrel 均触发新增规则，已有 TDC generated-client root exposure red mutation 同时触发原 graph rule 与新增 structural rule。
- fresh CP-05 reviewer `/root/t1_cp05_public_surface_r10`：本记录创建前的公共面差量对账 `MATCHED`。本记录及详设 V-01 路径改正晚于该次 verdict；因此此处不将原 MATCHED 扩大到本记录内容，须由 fresh CP-05 reviewer 核验当前 CP-05 字节后再沿用。

## 证据边界

本记录只归档源码语义和结构门差量，不表示全批 6b、CP-06、13c、Expo Web、DEV 或 Android/双机业务通过。当前动态验收没有在本记录中执行；设备、business 和 cleanup 均须在 CP-06 按受管准入另行证明。

## 6b R2 public-surface source readback

主 agent 对 R2 公开面问题修正完成后的源码对读：六个此前缺 `publicExports` 的 invariant 已与各自 `src/index.ts` 由 `public-export-invariants` 门进行 TypeScript module symbol 精确比较；六份中文 README 也列出同一 root API。`adapter/android-update/src/index.ts` 现在只有四条显式 re-export，`src/implementations/androidUpdatePort.ts` 承载原 adapter 实现，两个原包根消费者与测试无需改导入。

相应 focused proof 是 `doc/review/platform/2026-10-14-ter-t1-cp05-implementation-evidence-codex.md` 的 R2 章节。该源码对读不替代 fresh CP-05/6b reconciliation，也没有产生动态验收结论。
