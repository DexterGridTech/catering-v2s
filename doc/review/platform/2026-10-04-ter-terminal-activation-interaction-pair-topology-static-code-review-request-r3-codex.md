# TER 终端激活交互与双机拓扑专项 · 当前源码静态复核请求 R3

## 背景

当前实现收到七项静态 finding。主 agent 重开了需求、详设、计划和 owning source；S-1～S-6 已做最小代码修正并通过对应包级 lint、typecheck、单元测试。S-7 所要求的专项 Android runner 仍缺失。本轮用户明确要求不做动态验收，允许必要的编译、构建或 verify；本次没有运行 DEV、Expo Web、Android、VM、受管 runner，也没有读取 `.runtime/`。

## 评审目标

请仅对当前生产源码及测试源码做独立静态代码 review，判断 S-1～S-6 修复是否真实闭合、是否存在同根遗漏或回归，代码是否符合需求和详设且保持简单、可靠。请独立判断 S-7 是当前实现必须补齐的代码义务，还是需由设计/计划层处置的残项。不要比较、核验或推断任何历史或当前运行证据；也不要求动态验证。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`、`doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`：协作与实现边界。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求及 R-09a、R-10、R-11、R-07 判据。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`、`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：实现义务、场景映射及 Android runner 要求。
- `doc/review/platform/2026-10-04-ter-terminal-activation-interaction-pair-topology-finding-intake-codex.md`：作者逐项处置记录，仅供定位，不作为结论依据。
- S-1/S-2：`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts`、`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`、`src/features/actors/actors.ts`、`src/application/module.ts` 及两处对应测试。
- S-3：`apps/terminal/ui/integration/sample-console/src/application/module.ts`、`apps/terminal/ui/integration/sample-wallpaper-console/src/application/module.ts` 及对应 `businessInterlock.test.ts`。
- S-4：`apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`、`test/topology.test.ts`。
- S-5：`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts`、`test/serverConfig.test.ts`。
- S-6：`apps/terminal/ui/base/server-config-panel/src/components/ServerConfigPanel.tsx`、`test/serverConfigPanel.test.tsx`、`apps/terminal/ui/base/input/src/hooks/useInputField.ts`。
- S-7 现有底座：`scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-topology/run-dual-device.mjs`；计划指定的 `scripts/test/ter-terminal-interaction-android.mjs` 当前不存在。

## 独立核验重点

1. LSP branch-local 决定是否始终发给本地 owner；LMS host pending 决定是否仅由 SLAVE 发 peer；peer 注册后 branch pending 是否能按同一 operationId 收敛。
2. 同步成员列表先于 peer 回包、回包丢失/重连时，准确 operation 是否收敛，较新的 branch pending 是否不受影响。
3. 两个 integration 是否仅把 active activation 作为本地终端资格，同时仍保留必要的配对、投影 readiness、repair 与店员资格门。
4. topology 当前连接上可识别 slice/revision 的 payload failure 是否使 readiness 失效；迟到的旧 connection failure 是否被隔离。
5. server-config defaults/hydration 对 syncedHostDefaults 是否完整覆盖恢复、损坏持久值和 selected-space 状态。
6. 配置 source/service 切换过程中，UI 显示的表单值、编辑状态和 command payload 是否始终属于同一 draft identity；测试替身是否能暴露真实 `initialValue` 的挂载语义。
7. Android runner 的缺失是否与详设和计划中的实现交付义务冲突；不要用现有原子 action 或拓扑 runner 推定其已覆盖专项业务场景。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 附仓库相对路径及精确行号、静态触发条件或反例、影响、最小可验收修正和是否需要 Dexter 产品裁决。区分源码事实、推论及只能通过运行确认的事项。不要把本地 package test/typecheck/lint 当成动态业务验收，也无需核对运行证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《TER 终端激活交互与双机拓扑优化专项》当前生产源码及测试源码做一次独立静态代码 review。

背景：收到的七项静态 finding 已由主 agent 逐条重开需求、详设、计划和 owning source。S-1～S-6 已按最小范围修正；S-7 所要求的 `scripts/test/ter-terminal-interaction-android.mjs` 仍缺失。本轮用户要求不做动态验收，允许必要的编译、构建或 verify；主 agent 未运行 DEV、Expo Web、Android、VM 或受管 runner，也未读取 `.runtime/`。

目标：只判断当前代码是否符合正式需求与详设，S-1～S-6 是否真正闭合、是否存在同根遗漏或回归，以及 S-7 是必须补齐的实现义务还是应回到设计/计划处置的残项。请独立阅读源码和测试，不继承作者 finding disposition；不要核验、比较或推断运行证据，不要求动态测试。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`CLAUDE.md`、`doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`：协作与实现边界；
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求，特别是 R-09a、R-10、R-11、R-07；
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md` 与 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：实现义务、判据和 runner 要求；
- `doc/review/platform/2026-10-04-ter-terminal-activation-interaction-pair-topology-finding-intake-codex.md`：作者处置记录，只用于定位，不作为结论；
- S-1/S-2：`apps/terminal/ui/feature/sample-member-desk/src/hooks/useCustomerMember.ts`、`apps/terminal/kernel/feature/sample-member-registry/src/features/slices/slice.ts`、`src/features/actors/actors.ts`、`src/application/module.ts` 及相关测试；
- S-3：两个 integration 的 `src/application/module.ts` 与 `businessInterlock.test.ts`；
- S-4：`apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`、`test/topology.test.ts`；
- S-5：`apps/terminal/kernel/base/server-config/src/features/actors/serverConfigActor.ts`、`test/serverConfig.test.ts`；
- S-6：`apps/terminal/ui/base/server-config-panel/src/components/ServerConfigPanel.tsx`、`test/serverConfigPanel.test.tsx`、`apps/terminal/ui/base/input/src/hooks/useInputField.ts`；
- S-7：`scripts/test/ter-virtual-keyboard-android.mjs`、`tools/terminal-topology/run-dual-device.mjs`；计划要求的 `scripts/test/ter-terminal-interaction-android.mjs` 当前不存在。

请重点追踪 LSP branch-local 与 LMS host peer command owner、operationId 对账时序、active activation 与 TDS/配对资格区分、当前/旧 topology connection 的失败隔离、server-config syncedHostDefaults 恢复/hydration、配置切换期间 UI draft 与实际 command payload 一致性，以及 Android 专项 runner 的明确实现义务。主动寻找同根反例和更小修正。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每条 finding 请写精确仓库相对路径和行号、源码事实、触发条件或反例、影响、最小修正及是否需要 Dexter 产品裁决。区分源码事实、推论与只能由动态运行确认的事项。本次不要进行动态验证或运行证据比对。

授权边界：本轮仅请求只读静态代码 review，不授权修改文件、运行测试/构建/verify、Expo Web、Android、VM、DEV、reset/seed、L2、UAT 或部署。谢谢。
```
