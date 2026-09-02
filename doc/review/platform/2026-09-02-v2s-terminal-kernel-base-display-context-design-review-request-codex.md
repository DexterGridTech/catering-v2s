# TER kernel.base.display-context 详设与实施计划评审请求

## 背景

`kernel.base.display-context` 需求已冻结，Codex 已完成详细设计与实施计划。需求输入为
`e29965294f465d139e920ac8aefad524e50a9716bd25a03838c81cf84e989684`；详设与计划分别为
`cde95c4aa3644ef92857a37b240d8c526cda092afb22c7ac2b855f0b606bfdad` 与
`ebb57e7d87863c1f8b1785d98e7dcd9178efd76d1d68a9728eb2048623c1644c`。

作者侧已做两轮 fresh 独立静态对抗检查并闭合一条阻断项，最终静态结论为 `GO, M=0/S=0/N=1`。这不是 Claude 的结论，也不能替代 Claude 独立重建基线。唯一 note 是需求第 10 节的历史处置记录仍保留“四道减为三道”的旧句，而当前有效正文第 7.3 节、详设和计划均明确为四道门；需求不在本次写入授权内，故只登记为阅读陷阱。

## 评审目标

请从当前仓库字节独立判断：详设是否完整、方案是否是当前最小可靠方案、测试与 red fixture 是否具备证伪力、实施计划是否足以防止实施者自由发挥，以及跨包前置与授权边界是否准确。

## 需阅读文件

- `doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md`：冻结需求与 v1 判据；
- `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-design-codex.md`：详细设计；
- `doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-plan-codex.md`：实施顺序、完成信号和停机条件；
- `doc/platform/terminal-coding-standard.md`：TR-01、TR-02、TR-03、TR-04、TR-09、TR-10、TR-11 正本；
- `doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`：D-5 被 TR-11 路径取代的上游背景；
- `apps/terminal/kernel/base/runtime/src/`、`apps/terminal/kernel/base/platform-ports/src/`、`apps/terminal/kernel/base/state/src/`、`apps/terminal/kernel/base/display-context/`：当前 owning source 与骨架；
- `tools/terminal-runtime/`、`tools/terminal-platform-ports/`、`tools/terminal-state/`、`tools/terminal-skeleton/`：exact-set、边界门与 TER-local 接线现状。

## 独立核验重点

1. S-6 是否应作为窄 runtime 前置 `DC-P0` 单独完成，而不是等待整批门缺陷整改单元 B；它是否真正删除 `roleChangeEffects`，并以 runtime 自有 post-commit internal command 取代旧 effect list，且没有形成第二套接缝。
2. runtime 角色提交、journal、child command 的时序与失败语义是否诚实；request-ledger 的跨角色 half `startedAt` 是否需要随同修正。
3. `RuntimeModuleContext.registerResource` 是否是电源订阅可释放所需的最小接缝，还是存在更小且已可复用的现成能力。
4. `DisplayInfo` 是否严格只含已裁定的 `displayCount`；platform-ports 公开面 124→125、DevicePort 方法 5→6 与默认 unavailable 形态是否闭合。
5. 三条写入 `VICE` 的路径是否各自在写前实时调用 `getDisplayInfo`：显式切换、power actor、hydrate 后 startup validation；非 succeeded、缺失/非整数/小于一、大于一的失败域是否分别正确。
6. startup validation 是否确实位于 hydrate 后且 initialize/started/UI 可见前，由模块 install 派发并 await command；startup 失败纠 `CHIEF` 与运行期命令失败不写是否被清楚分域。
7. power bridge 的状态是否持有在模块实例闭包内，首事件只播种、同值去重、跃迁串行，release 幂等；`external→battery` 快速事件是否不会因并发乱序留下错误最终角色。
8. display-context 的 exact set 是否应为 17 exports、4 commands、5 actors、1 个 owner-only/isolated slice；55 个 focused cases、四道门及各自 red fixture 是否能真实证伪而非只做存在性检查。
9. 计划的 CP 顺序、每步 RECALL 前后双读、fresh 三维对账、全范围对账、10/REAL5/NO5 owner 分母与停机条件是否具体且相互一致。
10. 需求历史处置表中“四道减为三道”是否仅为非执行历史残留；不得据此覆盖当前有效第 7.3 节的四道门。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请写精确文件与行号、事实/推论、可证伪失败条件、最小修复，以及 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION` 档位。请独立比较更小替代，避免为 review 引入新的兼容层、event bus、callback registry 或其它过度设计。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立评审 TER kernel.base.display-context 的详细设计与实施计划。

背景：需求已冻结，Codex 已完成详设与实施计划，当前已获实施授权。冻结需求 sha256 为 e29965294f465d139e920ac8aefad524e50a9716bd25a03838c81cf84e989684；详设与计划 sha256 分别为 cde95c4aa3644ef92857a37b240d8c526cda092afb22c7ac2b855f0b606bfdad、ebb57e7d87863c1f8b1785d98e7dcd9178efd76d1d68a9728eb2048623c1644c。作者侧 fresh 独立静态检查最终为 GO、M=0/S=0/N=1，但请不要采信该结论，从当前源码、正本和需求独立重建基线。唯一已知 note 是需求第 10 节历史处置记录仍有“四道减为三道”的旧句；当前有效第 7.3 节、详设与计划均为四道门，需求不在本次写入授权内。

目标：请判断详设是否完整、方案是否为当前最小可靠方案、测试与 red fixture 是否具备真实证伪力、实施计划是否足以防止实施者走偏，以及跨包前置与授权边界是否准确。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-01-v2s-terminal-kernel-base-display-context-requirements-claude.md：冻结需求与 v1 判据；
- doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-design-codex.md：详细设计；
- doc/plans/platform/2026-09-02-v2s-terminal-kernel-base-display-context-implementation-plan-codex.md：实施顺序、完成信号与停机条件；
- doc/platform/terminal-coding-standard.md：TR-01、TR-02、TR-03、TR-04、TR-09、TR-10、TR-11；
- doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md：D-5 被 TR-11 路径取代的背景；
- apps/terminal/kernel/base/runtime/src/、apps/terminal/kernel/base/platform-ports/src/、apps/terminal/kernel/base/state/src/、apps/terminal/kernel/base/display-context/：当前 owning source；
- tools/terminal-runtime/、tools/terminal-platform-ports/、tools/terminal-state/、tools/terminal-skeleton/：exact-set、边界门与 TER-local 接线。

请重点独立核验：
1. S-6 是否适合作为窄 runtime 前置 DC-P0 单独完成，而非等待整批门缺陷整改单元 B；它是否真正以 runtime 自有 post-commit internal command 取代 roleChangeEffects，且没有保留第二套接缝。
2. runtime 角色提交、journal、child command 的时序和失败语义，以及 request-ledger 跨角色 half 的 startedAt 修正是否成立。
3. RuntimeModuleContext.registerResource 是否为电源订阅释放所需的最小接缝，是否已有更小的现成能力可复用。
4. DisplayInfo 是否只含 displayCount；platform-ports 公开面 124→125、DevicePort 方法 5→6、默认 unavailable 是否闭合。
5. 显式切换、power actor、startup validation 三条写 VICE 路径是否各自实时求值 getDisplayInfo；失败与畸形数据是否全部 fail-closed。
6. startup validation 是否在 hydrate 后、initialize/started/UI 可见前由 install 派发并 await；startup 失败纠 CHIEF 与运行期命令失败不写是否分域正确。
7. power bridge 是否首事件播种、同值去重、跃迁串行、释放幂等，并能抵抗快速连续事件的乱序。
8. 17 exports、4 commands、5 actors、1 slice、55 cases、四道门及 red fixtures 的 exact set 与证伪力。
9. CP 顺序、逐点 RECALL 双读、fresh 三维对账、全范围对账、10/REAL5/NO5 分母和停机条件是否自洽。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请写精确文件与行号、事实或推论、可证伪失败条件、最小修复，并标注 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION。请同时指出任何做不到、代价不相称或需要 Dexter 裁决的判据。

授权边界：本轮只评详细设计与实施计划，不授权实施，不授权修改 tools、apps/terminal 源码、skeleton-graph.ts、规范正本或需求；不授权 D-5、runtime 单元 B、platform-ports 实施、workspace scoping、仓级 normal verify、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。谢谢。
```
