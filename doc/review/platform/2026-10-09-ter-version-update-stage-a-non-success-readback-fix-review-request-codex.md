# TER 阶段 A FULL 非成功 readback 修复差量交审

## 背景

Claude 对阶段 A D-S-1～D-S-4 修复差量的静态复评为 `NO-GO`，`M/S/N=0/1/0`。其余三项及 D-S-1 的成功 readback 路径已静态关闭；剩余 finding 是 FULL 非成功 readback 以空 `action.bootId` 覆盖现有任务 boot 身份，导致失败任务不能在后继启动释放。

主 agent 核验后在既有 Stage A 范围内作了最小修正，并在现有 actor 测试补充了同 boot 阻止第二规则、持久化重建后的继任 boot 释放、不同修复工件可接受、旧失败工件仍拒绝等断言。处置与 focused proof 记录见 `doc/review/platform/2026-10-09-ter-version-update-stage-a-non-success-readback-intake-codex.md`。

本请求只针对上述 Stage A D-S-1 修复差量，不代表 Stage A 整批交付结论，也不评审正在进行的 Stage B CP-02 或 Stage B 整批实现。Dexter 已另行授权 Stage B 连续实施；本次复评不构成该工作的新准入门。

## 评审目标

请独立核验修复后的 FULL 非成功 readback 生命周期是否保留正确 boot 身份，并确认成功 readback 仍只使用同次权威 `actual.bootId`。重点检查 waiting-user/unknown 转 failed、同 boot 占位、后继 boot 释放、旧失败 artifact 拒绝及不同修复 artifact 接受是否与正式需求和阶段 A 详设一致。

本轮限定为当前源码、测试源码与设计判据的静态复评；不要求重跑动态验收、设备矩阵、完整 Stage A 测试或读取历史运行 evidence。测试源码只作为断言覆盖面审查，不代表测试执行通过。

## 需阅读文件

- `doc/review/platform/2026-10-09-ter-version-update-stage-a-ds-fix-static-rereview-claude.md`：前轮 finding、适用边界及需关闭的原反例。
- `doc/review/platform/2026-10-09-ter-version-update-stage-a-non-success-readback-intake-codex.md`：主 agent 的核验、最小修正与 focused proof 记录。
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：失败任务、boot 身份与后继启动的正式行为判据。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md`：FULL readback、任务占位和跨 boot 释放设计。
- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`：实际 readback reconcile 与任务释放逻辑。
- `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`：直接、waiting-user 后失败及跨 boot 反例断言。

## 独立核验重点

1. 对非成功 readback，缺少 action boot 时是否保留已有 task boot；若 action 提供 boot，是否仍按现有语义处理。
2. 对成功 readback，是否只写入本次权威 `actual.bootId`；权威 boot 缺失时是否维持 UNKNOWN 行为。
3. waiting-user/unknown → failed 路径是否无法擦除占位身份；同 boot 是否仍阻止第二规则。
4. Runtime 持久化重建后的后继 boot 是否释放终态占位、接受不同修复 artifact，同时继续拒绝旧失败 artifact。
5. 是否存在同根调用路径仍会以 null 覆盖有效 boot 身份，或测试只验证状态字段而没有验证规则选择结果。

如发现问题，请只针对本差量报告，逐项给出精确仓库相对路径与行号、仓内事实与推论、影响、最小修复建议及是否需要 Dexter 产品裁决。不要把未运行的动态验收或 Stage B 未完工作纳入本差量结论。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N`。本结论仅覆盖 Stage A D-S-1 修复差量，不升级为 Stage A 整批或 Stage B 实施 verdict，也不授予新的运行、reset/seed、L2、UAT 或部署权限。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 阶段 A FULL 非成功 readback 修复差量做一次独立静态复评。

背景：你上一轮对阶段 A D-S-1～D-S-4 修复差量给出 NO-GO，M/S/N=0/1/0。D-S-1 的剩余问题是 FULL 非成功 readback 可能用空 action.bootId 覆盖已有任务 boot 身份，使失败任务无法在后继启动释放。主 agent 已按正式需求与详设核验并完成最小修正，在现有测试补上同 boot 阻止第二规则、持久化重建后继 boot 释放、不同修复工件可接受、旧失败工件仍拒绝的断言。

目标：本次只复评上述 Stage A D-S-1 修复差量，不代表 Stage A 整批交付结论，也不评审仍在推进的 Stage B CP-02 或 Stage B 整批实现。Dexter 已另行授权 Stage B 连续实施，本次复评不是其前置门。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-10-09-ter-version-update-stage-a-ds-fix-static-rereview-claude.md：前轮 finding 与边界；
- doc/review/platform/2026-10-09-ter-version-update-stage-a-non-success-readback-intake-codex.md：主 agent 的 finding intake、修正与 focused proof 记录；
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：正式行为判据；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md：任务占位与 boot 释放设计；
- apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts：readback reconcile 与释放实现；
- apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts：直接、等待态转失败及跨 boot 断言。

请独立核验：
1. 非成功 readback 缺少 action boot 时是否保留原 task boot；成功 readback 是否仍只使用同次权威 actual.bootId；
2. waiting-user/unknown 转 failed 是否保留占位，同 boot 是否阻止第二规则；
3. 持久化重建后的继任 boot 是否释放终态任务、接受不同修复 artifact，同时拒绝旧失败 artifact；
4. 同根代码路径和测试是否还存在空 boot 覆盖或仅断言状态、未验证实际规则选择的缺口。

本轮只做源码、测试源码与设计判据的静态复评；不要求重跑动态验收、设备矩阵、完整 Stage A 测试或读取运行 evidence。测试源码不代表测试执行通过。findings 请给精确路径与行号，区分仓内事实和推论，说明影响、最小修复建议及是否需要 Dexter 产品裁决。

烦请给出明确 GO/NO-GO 与 M/S/N。结论仅覆盖 Stage A D-S-1 修复差量，不升级为 Stage A 整批或 Stage B 实施 verdict。

授权边界：本次仅请求静态复评，不授予新的运行、reset/seed、L2、UAT 或部署权限；Dexter 已另行授权的 Stage B 实施继续按既定范围推进。谢谢。
```
