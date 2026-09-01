# TER `kernel.base.platform-ports` implementation-facing 详设与实施计划 · Claude review request

```text
REVIEW_STATUS=READY
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=TER_KERNEL_BASE_PLATFORM_PORTS_DESIGN_20260830
REVIEW_TARGET=DESIGN
IA=NOT_APPLICABLE_WITH_REASON
```

## 背景

`kernel.base.platform-ports` 需求经两轮独立评审及作者处置后已由 Dexter 定稿。Dexter 只授权 Codex 编写本包的
implementation-facing 详设与实施计划，尚未授权实施。两份材料现已完成，设计把需求的 11 个候选能力逐项
举证后收成 10 个实际端口：`localWebServer` 因独立能力、真实 consumer、返回形状和边界证据均不成立而不单建，
其已证 HTTP/WS/local URL 能力归 `topologyHost`。

本轮仅评设计是否可作为后续实施输入，不以作者自洽、类型表完整或计划详细作为 GO 充分条件。

## 评审目标

请先独立回答“问题是否正确、方案是否更优、代价是否与当前阶段相称”，再以“找出它为什么不能直接实施”为
立场核验：10 个实际端口的契约是否足够而不过度，逐方法成功/失败/超时/不可用/accepted 是否真能阻断空成功，
六组测试和四道门能否证伪对应缺陷，以及逐文件计划是否已经消除实施者自由猜测空间。

## 需阅读文件

- `AGENTS.md`：执行、授权、步骤级对账与评审边界；
- `PLATFORM-BLUEPRINT.md`：平台目标；
- `CLAUDE.md`：方案合理性、右尺寸与 findings 处置；
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-requirements-claude.md`：已定稿需求；
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-implementation-design-codex.md`：待评详设；
- `doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-implementation-plan-codex.md`：待评计划；
- `doc/platform/terminal-coding-standard.md`：TR-02、TR-05、TR-08 与端口默认规则正本；
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`：完整禁记清单；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：单 VM/单 store/多 surface 等裁定；
- `project-memory/decisions/terminal-build-order-and-batches.md`：本包顺序与图边；
- `apps/terminal/skeleton-graph.ts`：当前唯一骨架规格；
- `apps/terminal/kernel/base/contracts/src/index.ts`：本包唯一依赖的当前公开面；
- `apps/terminal/kernel/base/platform-ports/`：当前骨架字节；
- `tools/terminal-contracts/check-static.mjs`、`tools/terminal-skeleton/verify-static.mjs`、
  `tools/terminal-skeleton/verify.mjs`：计划复用/修改的验证入口；
- 同父目录 `newPOSv1/1-kernel/1.1-base/platform-ports`、
  `newPOSv1/3-adapter/android/adapter-android-v2`、
  `newPOSv1/3-adapter/android/host-runtime-rn84`：只读 POC 证据源。

## 独立核验重点

1. 先独立从 current requirements、规范与 POC 推导端口面，不采信 Codex 的类型表；确认实际应是 10 个还是 11 个，
   特别证伪 `localWebServer` 五问失败和并入 topologyHost 的结论。
2. 核验公共 result 五态是否右尺寸：`accepted` 能否真的让调用方区分“受理/生效”，尤其
   `resetRuntime/exitApplication` 的 terminalObservation 是否仍只是解释文字；若不足，请给最小类型修复，不要引入
   可变 registry 或通用 operation framework。
3. 逐端口核实完整形状、证据来源和四平台矩阵；检查 device 去平台化、surfaceKey 非 display 查询、script 单一
   dispatcher、connector JSON-safe 泛型与 channel taxonomy 推迟是否自洽。
4. 检查 appControl 六类能力是否完整但没有越过 `DEXTER_DECISION`：exit/kiosk 只声明 shape，不能暗中裁定 owner、
   产品入口或真机行为。
5. 检查 logger central sink 设计是否保证 console/真实 sink 都无 public bypass；L 组是否覆盖 message/data/error、
   DEV/TEST/PROD、完整禁记类别、值命中和非敏感反例。
6. 检查 A/D/S/L/C/F 每个用例是否真的能证伪对应缺陷；特别是 8 个 unavailable 默认是否逐方法覆盖、consumer
   fixture 是否真实消费 success/failure union、ts-expect-error 反控是否会进入唯一 tsconfig。
7. 检查四道门是否只做机械事实、每道 mutation 是否只打红目标门；TR-05 analyzer 复用是否会让现有 contracts 门
   漂移；exact-export support 的 expected 是否来自冻结设计而非从源码自派生。
8. 检查逐文件计划、顺序、完成信号与停机清单是否足以防止实施 agent 自行补字段、加依赖/出边、改其他包、
   恢复 optional/Record/机制枚举或把 UNVERIFIED/DEXTER_DECISION 升格。
9. 再构造一条“所有计划判据通过但包仍没建成”的路径；若找不到，明确说明检查过哪些旁路。
10. 评估两份材料的篇幅与机制是否因端口数量所必需，还是已有可删除而不损失反证能力的重复。

## 期望结论

请给明确 `GO` 或 `NO-GO`，并汇总 `M/S/N`。每条 finding 包含精确文件与行号、事实类别（仓内事实、POC
外部事实、推论、产品判断、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`）、可证伪失败条件、后果、
最小修复，以及为什么更小修复不足。涉及产品 owner/Journey/权限的事项单列“需 Dexter 裁决”。

本轮是静态 DESIGN review：请列明实际打开核对的源文件与未核部分，不要求动态运行，也不得用未运行的命令
作为 GO 证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER kernel.base.platform-ports 的 implementation-facing 详设与实施计划。

背景：本包需求已完成两轮独立评审、作者处置并由 Dexter 定稿。Dexter 本次只授权 Codex 编写详设与实施计划，尚未授权实施。Codex 将 11 个候选能力逐项举证后收成 10 个实际端口：localWebServer 因独立能力、真实 consumer、返回形状和边界证据均不成立而不单建，已证 HTTP/WS/local URL 能力归 topologyHost。请不要把作者自洽或表格完整当作 GO 证据。

评审目标：请先独立回答“问题是否正确、方案是否更优、代价是否与当前阶段相称”，再以“找出它为什么不能直接实施”为立场，核验 10 个端口的契约、逐方法成功语义、六组测试、四道门和逐文件计划是否足够具体且无 false-green。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、CLAUDE.md；
- doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-requirements-claude.md（已定稿需求）；
- doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-implementation-design-codex.md（待评详设）；
- doc/plans/platform/2026-08-30-v2s-terminal-kernel-base-platform-ports-implementation-plan-codex.md（待评计划）；
- doc/platform/terminal-coding-standard.md；
- doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md；
- project-memory/decisions/terminal-build-order-and-batches.md；
- apps/terminal/skeleton-graph.ts；
- apps/terminal/kernel/base/contracts/src/index.ts；
- apps/terminal/kernel/base/platform-ports/；
- tools/terminal-contracts/check-static.mjs、tools/terminal-skeleton/verify-static.mjs、tools/terminal-skeleton/verify.mjs；
- 同父目录 newPOSv1 的 1-kernel/1.1-base/platform-ports、3-adapter/android/adapter-android-v2、3-adapter/android/host-runtime-rn84（只读 POC 证据）。

请重点独立核验：
1. 不采信 Codex 的类型表，先从需求、规范和 POC 独立推导端口面；确认 localWebServer 五问失败后不单建、能力并入 topologyHost 的结论是否成立；
2. 公共 result 的 succeeded/accepted/unavailable/failed/timed-out 是否右尺寸，尤其 resetRuntime/exitApplication 的 terminalObservation 是否真能让后续异步失败可观察，而不是只换了一个更漂亮的解释；
3. 逐端口类型、四平台归属与默认档位是否有证据；device 去平台化、surfaceKey 非 display 查询、script 单一 dispatcher、connector typed 契约与 taxonomy 推迟是否自洽；
4. appControl 六类是否完整，且 exit/kiosk 只冻结 shape，没有越权裁定 owner、产品入口或真机行为；
5. logger central sink 是否堵住所有 public bypass；L 组是否覆盖 message/data/error、DEV/TEST/PROD、完整禁记类别、值命中和非敏感反例；
6. A/D/S/L/C/F 每个用例能否证伪目标缺陷，8 个 unavailable 默认是否逐方法覆盖，consumer fixture 与 ts-expect-error 反控是否进入真实 tsc；
7. TR-05/P-3/P-4/P-8 四门与 exact-export support 是否只做机械事实、每个 red mutation 是否定向、复用 contracts analyzer 是否会让旧门漂移；
8. 文件清单、顺序、完成信号和停机清单是否让实施者无从自行加字段/依赖/出边、改其他包或升格 UNVERIFIED/DEXTER_DECISION；
9. 是否仍存在所有判据通过但包没有建成的路径；
10. 详设与计划的篇幅/机制是否与 10 个跨平台端口的风险相称，有无能删除且不损失反证能力的重复。

请给出明确 GO 或 NO-GO，并汇总 M/S/N。每条 finding 请带精确文件与行号、事实类别、可证伪失败条件、影响面、最小修复及为何更小方案不足；产品 owner/Journey/权限事项单列“需 Dexter 裁决”。请列出实际打开核过的源文件与未核部分。本轮为静态 DESIGN review，不要求动态运行，也不得把未运行命令当作 GO 证据。

授权边界：你的 GO 只表示这两份设计材料可以交 Dexter 决定是否作为后续 platform-ports 实施输入；不自动授权实施，不授权修改 TER 源码、其他 21 包能力、adapter/native、设备、仓级 normal verify、DEV、seed、reset、浏览器 L2、UAT 或部署。谢谢。
```

## 授权边界

Claude 的 `GO` 只表示两份设计材料可供 Dexter 决定是否授权后续实施；不自动授权源码写入、其余包、native、
动态运行、设备、仓级 normal、DEV、seed/reset、浏览器 L2、UAT 或部署。`NO-GO` 只形成 findings 输入，仍须
Codex 回源核验并由 Dexter 收口。
