# TER 包布局整理 IMPLEMENTATION review 请求

REVIEW_TARGET=IMPLEMENTATION
VERDICT_REQUEST=GO|NO-GO|GO_WITH_OPEN_EVIDENCE

## 背景

本轮按需求 v5、详设与实施计划完成 TER 包布局整理 CP-0 至 CP-4：`apps/terminal/assembly` 改为 `apps/terminal/application`，`ui/base/console-assembly` 改为 `ui/base/integration-assembly`，三 个未用包线下归档，`ui/base/test-support` 并回 `kernel/base/platform-ports`，并执行 D-6 darkMode 删除。follow-up 评审要求的 AC-10 匿名态前置、S3 逐行分类补充和 darkMode 精确报文已在进入实施前写入详设与计划。

此前 fresh 实施审查发现的 `platform-ports` logging layer union 残留已修为 `application`；随后发现 active snapshot、Web cleanup 与 SECONDARY UI tree 证据口径问题，已修复 runner，重新完成当前 W-1/W-2 Web、再完成 `final-u8-rerun-07` 设备 runner，并修正全部 AC-10 汇总引用。实施复核又发现旧 `plannedDependencies` checker 分支、两处退役 fixture 与 ui-state README 的退役 automation 描述残留，已删除/换靶/修文，静态、typecheck 与当前 Web/设备证据重新绑定到最新 sourceDigest。旧 `final-u8-rerun-02` 至 `final-u8-rerun-06` 仅保留为先前尝试，不作为最终结果。

## 评审目标

请独立确认：

1. CP-0 至 CP-4 的源码、测试、工具、原生、正本、project-memory 与 archive 变更符合 v5 需求和详设，不误改 `src/assembly/` 语义；
2. AC-0 至 AC-13 的证据真实可复核，尤其 AC-9 两个 App 的 ExpoModulesPackageList/dex/keystore/证书与 AC-10 Web→设备时序、startup JSON、SECONDARY display id 2；
3. D-2 只执行一次 App data clear，原始 clear digest 与当前 verification digest 的差异被如实归因，未把它伪造为同一源码字节；
4. 三道门、全部子门、lock/archive、逐代码与详设对账、cleanup、TR-08 OPEN 与 visual NOT_RUN 的分档没有把 OPEN 或 NOT_RUN 升级为 PASS；
5. Web 端反复出现的第三方 css-interop color-scheme pageError 是否被正确保留为诊断，且没有重新引入 D-6 darkMode 语义。

## 需阅读文件

请从 catering-v2s 仓库根读取：

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`：需求 v5 与 AC-0 至 AC-13；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md`：详设、owner、边界与证据契约；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md`：CP-0 至 CP-4、TR-16、交付门；
- `doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/` 至 `cp-4/`：门结果、archive、AC-9、AC-10、cleanup 与 reconciliation；
- `doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4/ac-10-matrix.json`、`cp-4/subgates.tsv`、`cp-4/reconciliation.md`、`cp-4/code-design-reconciliation.md`：最终汇总；
- `apps/terminal/kernel/base/platform-ports/src/types/logging.ts`：上一轮 implementation finding 的修复点；
- `doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4/web/W-1.json`、`W-2.json`、`cp-4/android/ac-10-device-W1-D1.json`、`ac-10-device-W2-D2.json`：当前字节 row-level startup 事实；
- `doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4/android/d2-data-clear/record.json`：D-2 一次性清除的 before/after 与 digest 归因；
- `project-memory/operations/terminal-coding-standard.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`project-memory/decisions/terminal-build-order-and-batches.md`、`project-memory/practices/ter-input-and-virtual-keyboard-usage.md`：active TER 规范与取代条目。

## 独立核验重点

- 运行时间：`W-1.capturedAt=2026-09-25T03:24:00.964Z`、`W-2.capturedAt=2026-09-25T03:24:56.734Z` 必须早于 `android/final-u8-rerun-07/result.json.startedAt=2026-09-25T03:25:43.711Z`；`final-u8-rerun-02` 至 `final-u8-rerun-06` 只能出现在先前尝试说明中。
- 当前源摘要：最终 Web/设备 row 为 `7084ad9ff75b4f43e0db0a60a3f3c233672897150d5dae79f1ab08b572471c31`；D-2 原始 clear 为旧摘要时，应核对 `sourceDigestAtClear`、`currentVerificationSourceDigest`、runner-only delta 和 APK bytes 证据，不要求也不允许第二次 clear。
- AC-9：两个 release build summary 的 `BUILD_SUCCESSFUL`、新 application FQCN、旧 FQCN zero、APK/keystore/certificate 关系；不得以一次 App 的生成清单代表另一个 App。
- AC-10：W-1 `sample.auth.login`；W-2 PRIMARY `sample.auth.login`、SECONDARY `sample.wallpaper-console.waiting`、display id `2`；groups 必须是布尔值；business 与 cleanup 分开为 PASS。
- D-6：active 产品 corpus 没有 darkMode/colorScheme 正向语义；第三方 `react-native-css-interop` pageError 只作为 `NON_BLOCKING_DEPENDENCY_DIAGNOSTIC` 保留。
- 交付边界：TR-08 必须仍为 `OPEN/OUT_OF_SCOPE`，visual 必须 `NOT_RUN/NOT_CLAIMED`，未运行的其他 VM、真机、DEV、L2、UAT 不得冒充覆盖。

## 期望结论

请给出明确的 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO|NO-GO|GO_WITH_OPEN_EVIDENCE` 与 `M/S/N=x/y/z`。每条 finding 请列出文件与行号、事实/反例、影响、证据、最小修复建议，并标记 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 授权边界

本轮实现授权已覆盖 CP-0 至 CP-4、两个 integration Expo Web、单机双屏与 mobile 两台虚拟机，以及 D-2 对 sample-wallpaper-terminal 的一次 App data clear。没有授权其他 VM/真机、DEV/L2/UAT/seed/reset、TR-08 收口、视觉验收或超出详设的产品语义变化。此次 review 只判断当前实现与证据，不把 focused/typecheck/截图存在性升级为视觉或业务验收；如发现需要新增产品/Journey 裁定，请标为 Dexter decision。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 包布局整理做 IMPLEMENTATION 独立复核。

背景：本轮按 v5 需求、详设与实施计划完成 CP-0 至 CP-4，并完成两个 integration 的 Expo Web、单机双屏与 mobile 动态验证。此前 fresh 实施复核发现的 logging layer union 残留已修复；随后发现 active snapshot、Web cleanup 与 SECONDARY UI tree 证据口径问题，已修复 runner，先完成当前 W-1/W-2 Web、再运行 final-u8-rerun-07，并修正汇总文件。实施复核还发现旧 plannedDependencies checker 分支、两处退役 fixture 与 ui-state README 的退役 automation 描述残留，已删除/换靶/修文，当前 static/typecheck/Web/设备 evidence 均绑定最新摘要；旧 final-u8-rerun-02 至 final-u8-rerun-06 仅保留为先前尝试。D-2 的 sample-wallpaper-terminal App data clear 已按授权只执行一次，清除时旧 sourceDigest 与当前 verification digest 的 runner-only 差异已单独记录，未重复清除。

目标：请独立核验包布局迁移、下线/归档、platform-ports 合并、D-6 删除、原生身份、AC-9、AC-10 Web→设备顺序与 row-level startup/SECONDARY 证据、cleanup、逐代码与详设对账，以及 TR-08 OPEN 和 visual NOT_RUN 的边界。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md：v5 需求与验收条件；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md：详设与证据契约；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md：CP-0 至 CP-4 计划与 TR-16 顺序；
- doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/ 至 cp-4/：全部门、archive、AC-9、AC-10、cleanup 与 reconciliation；
- doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4/ac-10-matrix.json、subgates.tsv、reconciliation.md、code-design-reconciliation.md：最终汇总；
- apps/terminal/kernel/base/platform-ports/src/types/logging.ts：logging layer 修复；
- project-memory/operations/terminal-coding-standard.md、project-memory/decisions/terminal-architecture-and-stack-rulings.md、project-memory/decisions/terminal-build-order-and-batches.md、project-memory/practices/ter-input-and-virtual-keyboard-usage.md：active 规范。

请重点独立核验：W-1/W-2 capturedAt 是否早于 final-u8-rerun-07 startedAt；final 汇总是否不再把 rerun-02/03/04/05/06 当最终；当前 sourceDigest 与 active-files.sha256 是否相等；plannedDependencies 机制、退役包 fixture 与 ui-state README 退役 automation 描述是否确实不再命中 active corpus、其保留的 boundary red mutations 是否仍能红后绿；D-2 是否确实只清一次且如实区分清除时 digest 与当前验证 digest；两个 App 的 AC-9 原生证据；AC-10 的 startup JSON 布尔类型、sample.auth.login、SECONDARY sample.wallpaper-console.waiting/display=2 以及当前 `ui-secondary.xml`/全量 `--windows` XML；D-6 active scan；cleanup；TR-08=OPEN/OUT_OF_SCOPE；visual=NOT_RUN；以及第三方 css-interop pageError 是否被保留而没有重新引入 darkMode。

烦请给出明确 REVIEW_TARGET=IMPLEMENTATION、VERDICT=GO|NO-GO|GO_WITH_OPEN_EVIDENCE 与 M/S/N=x/y/z；每条 finding 请附路径、行号、影响、证据和最小修复建议，并标明 CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE。

授权边界：本轮仅覆盖已授权的 CP-0 至 CP-4、两个 integration Expo Web、单机双屏与 mobile 两台虚拟机，以及 sample-wallpaper-terminal 一次 App data clear；不包括其他 VM/真机、DEV/L2/UAT/seed/reset、TR-08 收口、视觉验收或超出详设的产品改动。谢谢。
```
