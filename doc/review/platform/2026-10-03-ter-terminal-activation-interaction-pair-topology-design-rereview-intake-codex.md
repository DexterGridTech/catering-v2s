# 终端激活交互与双机拓扑优化专项 · 外部复评 finding intake

```text
SOURCE_REVIEW=doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-rereview-claude.md
SOURCE_VERDICT=NO-GO；M/S/N=0/1/1（只绑定来源评审所列输入摘要）
INTAKE_OWNER=CODEX_MAIN_AGENT
INTAKE_VERDICT=不替代独立复评；本文件记录当前字节核验与最小文档修正
EVIDENCE_TIER=当前需求/规范/设计文档和源码静态核验；focused package tests不构成Web/VM/业务验收
```

## 1 · intake边界

主 agent 重开正式需求、terminal-coding-standard.md 的 LMS 承载条款、当前 IA/UI/详设和 testId owning source。来源评审中的摘要与行号只用于定位；按评审附带哈希复算，当前 IA、UI、详设和计划字节均已变化，故不把旧行号判断直接套用到当前文件。没有修改需求、Journey 的已裁决产品语义或源码业务行为。

## 2 · Findings处置

### S-1 · LMS承载来源及MMP/LMP确认页

- **Classification：PARTIALLY_CONFIRMED，已最小修订。** 来源 finding 指出的排他性旧表述在当前 IA 与逐屏 SAMPLE-09 已不存在；当前字节已区分单机和双机 LMS。原 reviewer 摘要的负面断言不适用于当前行，但 IA 总则与 UI 汇总的 owner-source 仍可写得更直接，避免实施者只按摘要表读取时丢掉双机投影边界。
- **需求/规范**：正式需求 R-01、R-09a、R-09b；`doc/platform/terminal-coding-standard.md:951-966` 区分单机 `MASTER+SECONDARY` 与双机 `SLAVE+VICE`。
- **当前证据**：`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md:43-48,136`：SAMPLE-04-MMP 与 SAMPLE-05-LMP 只读本机 MASTER hostPending，双机 LMS pending 路径仅在 SAMPLE-06；SAMPLE-09 已明确两种承载。`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md:1520-1531` 的 SAMPLE-09 screen 已声明双机 host-confirmed projection，MMP/LMP confirm screens 未引入 SLAVE+VICE 路径。真实实现来源仍未实施：`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts:33-54` 与 `apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts:25-74`。
- **最小修订**：IA 总则补为单机 LMS 读取 MASTER hostPending/host-confirmed wallpaper，双机 LMS 读取绑定当前 peer 的 hostPendingProjection/host-confirmed wallpaper projection，明确不覆盖 branchPending/本地壁纸；UI SAMPLE-09 汇总行明确相同双路数据源。保留 SAMPLE-04/05 本机主机确认，LMS 路径仅归 SAMPLE-06。没有新增 owner、协议或同步机制。
- **证伪/边界**：当前同一 IA 中的 SAMPLE-04/05 无双机读取路径；SAMPLE-06 是唯一会员 LMS 确认屏；SAMPLE-09 双机屏由 SLAVE+VICE 显示投影，不能按“内容页”推出同一 runtime。无动态投影证据。
- **Dexter裁决**：不需要。

### N-1 · logout/exit TestId当前值与提案分离

- **Classification：REJECTED_WITH_EVIDENCE（引用的误标在当前字节已不存在）；同根源事实状态已核正。**
- **当前证据**：`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts:3-12` 当前仅含 root/title/optionsScroll/options/confirm 与选项派生器，无 `logout` 或 `exit`。UI工件 SUMMARY `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md:1742-1747` 将 SAMPLE-07/08 的既有字面量和提案分别标注；SAMPLE-10 的 branch picker `option/confirm/exit` 仍为提案。故 logout/exit 未被当作当前源码常量。
- **本次同步修订**：MASK-01 的状态/提示字面量在 `apps/terminal/ui/base/integration-assembly/src/components/PairReadinessInterlock.tsx:3-17` 已存在，UI roster、汇总与详设 `§3a` 现标为当前源码常量；focused proof 标为仅覆盖层级/焦点/selector，不升级为 Web/VM/业务证据。logout/exit 继续标为设计提案。
- **验收判据**：任何未在 owning TestIds/component 常量中定义的 logout/exit ID 均写“提案”；本次 `rg` 对 `wallpaperPickerTestIds` 与 `PairReadinessInterlock` 核对通过。没有新增 checker。
- **Dexter裁决**：不需要。

## 3 · 回读与证据边界

- IA 总则、SAMPLE-04/05/06/09，UI SAMPLE-07/08/09/10 与 MASK-01，以及详设 MASK-01 汇总已回读；MMP/LMP 本页确认、双机 LMS 投影和本地 LSP 状态各有唯一归属。
- 当前源文件没有证明本专项 Expo Web、任一 VM topology、adapter、真实输入/焦点行为或V-01～V-20业务断言。上述项目保持 `NOT_RUN`。
- `ui-base-render` tests：PROD/DEV各19 files、118 tests PASS；`ui-base-admin-shell`：19 files、61 tests PASS；`ui-base-integration-assembly`：7 files、20 tests PASS；两个 integration：sample-console 9 files、61 tests PASS，sample-wallpaper-console 5 files、29 tests PASS。各包lint/typecheck均以退出码0结束。测试结果只覆盖当前对应包，不是设计独立GO或动态设备PASS。
- 本地开发命令有两次 workspace 名称解析失败（当时用了缺少 `ui-integration-` 前缀的名称）；无测试启动。按 `package.json` 的正式 workspace 名称重跑并取得上述真实测试结果。

当前文本修订仅处理两个finding中确有必要的表述同步；历史外部 `NO-GO` 与其输入摘要保留，不由作者intake替代新一轮独立复评。
