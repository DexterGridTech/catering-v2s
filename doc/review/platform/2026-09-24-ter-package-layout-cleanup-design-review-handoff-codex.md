# Codex 对 TER 包布局整理需求与方案的 DESIGN review 结果

## 背景

本文件不是再次请求 Claude review，而是 Codex 对 Claude 编写的正式需求与方案完成独立评审后的结果回复。

评审对象：

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`

完整 Codex 评审：

- `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md`

## 评审目标

记录 Codex 对 Claude 需求与方案的独立核验结果，供 Claude 和 Dexter 复核本轮设计结论；不是再次请求 Claude 对 Codex 报告进行 review。

## 需阅读文件

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`：正式需求与验收条件；
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`：方案、影响面、风险与后置详设事项；
- `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md`：Codex 的完整事实核验与 findings；
- `apps/terminal/skeleton-graph.ts`、`tools/terminal-skeleton/check-static.mjs`、`tools/terminal-layering/check-static.mjs`、`tools/terminal-ui-state/check-static.mjs`：当前 package graph 与静态门；
- `tools/terminal-sample2/check-native-projection.mjs`、`tools/terminal-sample2/check-production-bundle.mjs`：原生投影与 production bundle 断言；
- `apps/terminal/kernel/base/platform-ports/src/index.ts`、`apps/terminal/ui/base/test-support/src/index.ts`：D-3 的真实导出关系；
- `apps/terminal/assembly/android/sample-terminal/App.tsx`、`apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx`：D-5 harness 入口；
- `doc/platform/terminal-coding-standard.md`、`AGENTS.md`、`CLAUDE.md` 与相关 `project-memory/**`：正本和执行边界。

## 独立核验重点

请复核 AC-8、AC-10、PL-R00、AC-2、AC-3、AC-9、D-4、D-5/TR-08、active memory/skills 同步及四步中间态；重点区分已确认事实、推论、未验证项和需要 Dexter 裁决的产品/Journey 语义。

## 期望结论

本轮 Codex 已给出明确 `REVIEW_TARGET=DESIGN`、`VERDICT=NO-GO`、`M/S/N=3/7/3`。以下为可直接转交 Claude 的完整结果话术。

## 评审结果

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=3/7/3
```

## 评审摘要

### Major

1. **M-1：AC-8 反向映射不可直接执行。** 需求只规定了仓外 snapshot、锚定映射和逐文件允许差异，方案 §9 将 snapshot 位置、映射、ignored `.runtime`/keystore、构建产物、lockfile 和 allowlist 留给详设。当前无法防止空 snapshot、扩大 allowlist 或把合法 `src/assembly` 与顶层 application 层误混。
2. **M-2：AC-10 缺少可执行的绝对期望值。** `primaryReadyPartKey`、SECONDARY `partKey`、Web entry、操作步骤、startup 字段和双屏证据关系均未冻结，矩阵可以被“页面启动成功”空过。
3. **M-3：PL-R00 与当前真实静态基线不一致。** typecheck 33/33 PASS；全量 test 在 `kernel-base-transport` 的 `identityClient.test.ts` 有 2 个既有失败；`verify:static` 首败为 readability；直接 layering 门还有 `sample-staff-auth/src/components/StaffLoginForm.tsx:13`。因此“第 0 步后三道门全绿”当前不能按只修三项实现。

### Significant

1. **S-1：AC-2 的 `git grep` 范围不足。** 活跃文件包括未跟踪文件、`doc/platform`、`project-memory`、`AGENTS.md`、`CLAUDE.md` 和 `.agents/skills`，但当前扫描规则不能完整覆盖这些范围；`assembly` 顶层层名与 `src/assembly` 组合语义也需要明确分流。
2. **S-2：AC-9 缺少实际证据路径。** `tools/terminal-sample2/check-native-projection.mjs:264-265` 仍断言旧 package name；现有工具没有定义如何读取 `ExpoModulesPackageList`、两个 APK 的证书摘要及对应 keystore hash。
3. **S-3：active 正本、memory 和 skills 的同步清单不完整。** `doc/platform/terminal-coding-standard.md:974`、三个 skill 的旧层用语，以及 active `project-memory/decisions/terminal-build-order-and-batches.md:20-54` 未被逐项钉死；只追加历史说明不足以保证 active query 不再返回旧建设顺序。
4. **S-4：D-4 的仓外保留方案不足以证明可恢复。** 只有日期目录、文件数和体积，没有持久路径、源/目标路径、逐文件 hash、manifest、碰撞处理和恢复命令。
5. **S-5：D-5 与 TR-08 的现状冲突必须明确保持 OPEN。** 两个 App 的 `App.tsx:8-19` 仍能进入 `controlledKeyboardHarness`，而 `doc/platform/terminal-coding-standard.md:278-294` 要求调试/自动化面在 production bundle 编译期不存在。现方案可以按 Dexter 授权保持原样，但不能把静态门通过写成 TR-08 已关闭。
6. **S-6：四步“每步安装后过三道门”的中间态契约不足。** harness 的合法目标目录、install/lockfile 边界、ignored 产物的移动/删除范围和每步原子文件集未定义。
7. **S-7：AC-3 的红测试换靶仍可能空过。** skeleton/ui-state fixture 没有具体替代靶、唯一 gate、精确报文和恢复步骤；`plannedDependencies` 删除也没有独立红控制。

### Non-blocking / 正向结论

1. **N-1：D-3 方向成立。** `platform-ports/src/index.ts:18-33,135-139` 已直接导出五个类型，`ui/base/test-support/src/index.ts:3` 只是转出；三个 feature 改为 dev-only 直接消费 platform-ports 是最小方案，不需要新增 production export。
2. **N-2：D-1/D-2 命名边界基本正确。** Kotlin full name 随 application 层改名合理；共享基础设施包内的 `Console*` 可以改为 `Integration*`，但 integration 自有的 `WallpaperConsoleAssembly` 等名字应保留。
3. **N-3：PCRE 加正控制的方向正确。** 但必须补齐 active 文件分母，并用语义分类避免把合法 assembly 组合命中误判为残留。

## 方案合理性

方案方向合理：它正确区分了 application 层和 assembly 组合语义，D-1、D-2、D-3、D-4 的技术取舍也基本成立，D-5 按当前授权暂不改变 release harness 行为可以接受。

当前 NO-GO 不是因为重命名或合并方向错误，而是关键验收输入仍由后续执行者猜测，尤其是 AC-8、AC-10 和 PL-R00。建议在详设/实施计划中先关闭上述判据，不要直接进入源码实施。

## 授权边界

本轮只报告 Codex 对 Claude 文档的评审结果，不授权修改源码、需求、方案、测试、依赖或构建产物，不授权构建、安装、Web、Metro、Android、虚拟机、真机、详设或实施。

## 可直接复制给 Claude 的话术

```text
您好 Claude，Codex 已完成对你编写的《TER 包布局整理》正式需求与方案的独立 DESIGN 评审，现回复评审结果，不是再次请求你 review Codex 报告。

背景：Dexter 2026-09-24 提出 TER 顶层 application、integration-assembly 和四个基础包的布局整理；你已编写正式需求与方案，Codex 依据 Dexter 原文和当前字节完成了独立核验。
目标：向你直接反馈 Codex 的 DESIGN review 结论、已确认事实、风险和进入详设前必须补齐的判据。

评审对象：
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md
- doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md

结论：REVIEW_TARGET=DESIGN, VERDICT=NO-GO, M/S/N=3/7/3。
完整评审记录：doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-codex.md。

先给总体判断：顶层 assembly 改 application、console-assembly 改 integration-assembly、空壳下线，以及 ui/base/test-support 并回 kernel/base/platform-ports 的方向是合理的。D-1、D-2、D-3、D-4 的技术取舍基本成立；D-5 按 Dexter 当前授权保持 harness 字节不变也可以接受，但必须把 TR-08 明确保持为 OPEN，不能把它写成已关闭。

本轮的三个 Major：
1. M-1：AC-8 的仓外 snapshot、旧→新锚定映射、逐文件允许差异、ignored .runtime/keystore、构建产物和 lockfile 分母没有冻结；当前无法防止空 snapshot、扩大 allowlist，或误把 src/assembly 等合法组合语义当作顶层 application 层。
2. M-2：AC-10 的两行 TR-16 矩阵没有冻结 primaryReadyPartKey、SECONDARY partKey、Web entry、操作步骤、startup 字段和双屏证据关系，后续无法证明不是页面启动成功就空过。
3. M-3：实际静态基线不止需求 §1.3 的三项。typecheck 33/33 PASS；全量 test 在 kernel-base-transport 的 identityClient.test.ts 有 2 个既有失败；verify:static 首败为 readability；直接 layering 门还有 sample-staff-auth/src/components/StaffLoginForm.tsx:13。PL-R00 的“第 0 步后三道门全绿”不能按当前文字只修三项实现。

七个 Significant：
1. S-1：AC-2 使用 git grep，不能完整覆盖活跃未跟踪文件、doc/platform、project-memory、AGENTS.md、CLAUDE.md 和 .agents/skills；顶层 assembly 与 src/assembly 的语义分流也需要可执行判据。
2. S-2：AC-9 尚未定义如何读取 ExpoModulesPackageList、两个 APK 的证书摘要和对应 keystore hash；tools/terminal-sample2/check-native-projection.mjs:264-265 仍使用旧 package name。
3. S-3：doc/platform/terminal-coding-standard.md:974、三个 skill 的旧层用语，以及 active project-memory/decisions/terminal-build-order-and-batches.md:20-54 没有逐项同步判据；只追加历史说明不足以保证 active query 不再返回旧建设顺序。
4. S-4：D-4 只有仓外位置、文件数和体积，没有持久路径、逐文件 hash、manifest、碰撞策略和恢复命令，不能充分证明可恢复。
5. S-5：两个 App 的 App.tsx:8-19 仍可进入 controlledKeyboardHarness，而 TR-08 要求 production bundle 编译期剔除。D-5 可以保持本批不处理，但交付必须明确 TR-08=OPEN/OUT_OF_SCOPE。
6. S-6：四步每步安装后过三道门的中间态、harness 合法目标目录、install/lockfile 边界和 ignored 产物移动/删除范围没有冻结。
7. S-7：AC-3 的 skeleton/ui-state fixture 换靶没有具体唯一 gate 与报文；plannedDependencies 删除也缺少独立红控制，存在被其它失败空过的风险。

正向核验：platform-ports/src/index.ts:18-33,135-139 已直接导出 D-3 所需五个类型，ui/base/test-support/src/index.ts:3 只是薄转出；D-1/D-2 的命名边界基本正确；PCRE 加正控制的总体方向正确。

独立核验重点：Codex 重点核对了 AC-8 反向映射、AC-10 TR-16 矩阵、PL-R00 实际静态基线、AC-2 active 文件分母、AC-3 红测试、AC-9 原生清单/签名、D-4 恢复记录、D-5/TR-08 边界、四步中间态以及 active memory/skills/正本同步。

建议在详设和实施计划中先补齐上述可执行判据，并为每条 finding 写明 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，以及精确路径、行号和红变异。涉及产品/Journey 取舍的地方请标 DEXTER_DECISION，不要自行扩大 D-5 或 TR-08 范围。

授权边界：本轮仅为 Codex DESIGN review 结果，不授权源码修改、需求/方案修改、依赖安装、构建、Web、Metro、Android、虚拟机、真机、详设或实施。谢谢。
```
