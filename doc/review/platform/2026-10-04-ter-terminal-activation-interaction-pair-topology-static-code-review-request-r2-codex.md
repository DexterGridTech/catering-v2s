# TER 终端激活交互与双机拓扑专项 · 当前源码静态复核请求 R2

## 背景

本专项收到一份针对当前实现的 11 项静态问题清单。主 agent 已按正式需求、详设和 owning source 对实现作修订，并做过部分编译、静态门和 Expo Web/DEV 验证。Dexter 现要求停止 DEV 与动态测试，本轮只请 Claude 对修订后的生产代码和测试/runner 源码做独立静态复核；不核验运行证据，不读取 `.runtime/`。历史 NO-GO 与作者修订说明均只是输入，不是本轮结论。

用户明确不运行 Android。本专项计划仍要求建立 `scripts/test/ter-terminal-interaction-android.mjs`，但当前文件不存在；请从代码和已批准详设判断这是否仍是交付代码缺口，不要求运行该入口。

## 评审目标

只读判断当前源码是否满足正式需求、IA/Journey 与详设，及实现是否足够简单、高效、健壮。重点检查：角色与激活/建连异步边界、peer command composition 转发、取消激活与自动重连、业务 command 的主副与断链准入、配置同步 readiness 失效、LMS/LSP 页面分支、会员 peer pending 收敛、代理字段切换、激活环境断言，以及专项 Android 编排源码是否齐备。

不得运行命令、构建、测试、verify、Web、Android、VM 或 DEV；不得读取、核验或比较 `.runtime/` 内的 manifest、日志、截图、报告与历史运行。Expo Web 与 DEV 的运行证据不属于本轮评审目标。

## 需阅读文件

- `AGENTS.md`、`CLAUDE.md`：本仓协作、范围与授权边界。
- `doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/frontend-coding-standard.md`：评审及 TER/UI 代码约束。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md`：正式需求 R-01～R-16、V-01～V-20。
- `doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md`、`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md`、`doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md`：批准的 Journey、页面信息及交互状态。
- `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md`、`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md`：实现边界、实现形态与测试判据。
- `apps/terminal/kernel/base/terminal-data-client/`、`server-config/`、`topology/`、`transport/`：凭证、配置、拓扑和传输 owner 实现及测试。
- `apps/terminal/ui/base/terminal-activation/`、`server-config-panel/`、`admin-shell/`、`integration-assembly/`，以及 `apps/terminal/ui/integration/sample-console/`、`sample-wallpaper-console/`：呈现、composition 与阶段路由。
- `apps/terminal/kernel/feature/sample-staff-session/`、`sample-member-registry/`、`apps/terminal/ui/feature/sample-staff-auth/`、`sample-member-desk/`、`sample-wallpaper-picker/`：店员、会员和壁纸实现及测试。
- `scripts/test/ter-admin-display-web.mjs`、`scripts/test/ter-admin-display-web.test.mjs`、`scripts/test/ter-virtual-keyboard-android.mjs`、`scripts/test/ter-virtual-keyboard-android.test.mjs`：Web/Android 测试与受管动作源码；仅静态阅读。
- `tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-topology/journey-acceptance.mjs` 及对应测试：双机拓扑脚本源码；仅静态阅读。

## 独立核验重点

1. 已激活、激活在途的终端能否成为副机；角色变化后迟到的激活/建连结果能否提交凭证或状态。
2. member peer command 的 `target` 是否从 feature hook 经两个 composition 适配器完整传递；确认、拒绝是否真正回到主机 owner。
3. 取消 HTTP 等待期间，transport retry、迟到 open/ready/heartbeat 是否可能重新认证或恢复连接。
4. 店员、会员、壁纸等 owner command 是否自行守住主副与断链准入；integration interlock 是否能在投影失败或重连倒序时继续保守阻断，同时保留本机 admin 恢复。
5. required projection 的 apply 失败能否使旧 readiness 失效；有效 server-config 是否在所需集合内。
6. LMS 的主机登录引导及 LSP 的分支拒绝、取消、重试、系统失败路径是否与 IA/catalog 对齐。
7. peer 成员列表投影到达后，pending 是否能按 operation identity 收敛；是否存在回包丢失后的重复确认窗口。
8. 服务/空间切换时代理 host、port、user、password 的显示值和提交来源是否一致，输入生命周期是否正确。
9. A-02 是否断言页面服务空间、当前配置和真实请求目标一致；删除或伪造标签能否导致假绿。
10. 计划 §9.2 第 6 项要求的 `scripts/test/ter-terminal-interaction-android.mjs` 当前缺失；请判定其与详设/计划的代码义务是否冲突。只做源码审查，不要求 Android 运行。

请主动找反例、同根路径及更小替代，不继承旧 review verdict，不把测试计划或作者声明当成源码事实。运行证据不得作为本轮结论依据。

## 期望结论

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N=x/y/z`。每项 finding 写明仓库相对路径及行号、源码事实、触发条件/反例、影响面、最小可验收修正，以及是否需要 Dexter 产品裁决。区分已证实事实、静态推论和未能仅凭代码确认的事项。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对《TER 终端激活交互与双机拓扑优化专项》当前源码做一次独立静态复核。

背景：本专项收到一份针对当前实现的 11 项静态问题清单，主 agent 已按正式需求、详设和 owning source 修订实现。此前的 NO-GO 与作者修订说明都只是待核输入，不是本轮结论。Dexter 已要求停止 DEV 和动态测试；本轮仅评当前生产代码及测试/runner 源码。用户明确不运行 Android。

目标：核验实现是否满足正式需求、IA/Journey 和详设，三包/owner 与 command-selector 边界是否正确，关键异步、失败、主副、断链、配置、会员和壁纸路径是否闭合，以及代码是否足够简单、高效、健壮。详设和计划仍要求 scripts/test/ter-terminal-interaction-android.mjs，但该文件当前不存在；请静态判断这是否构成代码缺口，不要求运行它。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、doc/platform/review-standard.md、doc/platform/terminal-coding-standard.md、doc/platform/frontend-coding-standard.md：协作范围与适用规范；
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md：正式需求 R-01～R-16、V-01～V-20；
- doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-journey-codex.md、doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ia-codex.md、doc/decisions/2026-10-02-ter-terminal-activation-interaction-pair-topology-ui-interaction-codex.md：批准的 Journey、IA 与交互；
- doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-design-codex.md、doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md：实现边界与计划判据；
- apps/terminal/kernel/base/terminal-data-client/、server-config/、topology/、transport/：owner 实现及测试；
- apps/terminal/ui/base/terminal-activation/、server-config-panel/、admin-shell/、integration-assembly/ 与 apps/terminal/ui/integration/sample-console/、sample-wallpaper-console/：呈现、composition、路由及测试；
- apps/terminal/kernel/feature/sample-staff-session/、sample-member-registry/、apps/terminal/ui/feature/sample-staff-auth/、sample-member-desk/、sample-wallpaper-picker/：店员、会员、壁纸实现及测试；
- scripts/test/ter-admin-display-web.mjs、scripts/test/ter-admin-display-web.test.mjs、scripts/test/ter-virtual-keyboard-android.mjs、scripts/test/ter-virtual-keyboard-android.test.mjs：测试和受管动作源码；
- tools/terminal-topology/run-dual-device.mjs、tools/terminal-topology/journey-acceptance.mjs 及对应测试：双机拓扑源码。

请重点追踪：角色变化和迟到激活/建连提交；peer command target 经过两套 composition 的传递；取消等待期间 transport 自动重连；owner command 的主副/断链准入与 admin 恢复；projection apply 失败后的 readiness 失效和 server-config 必需集合；LMS 登录引导、LSP 异常分支；成员 peer pending 的 operation identity 收敛；代理字段切换后的真实提交来源；A-02 的服务空间与真实请求目标断言；Android 专项编排代码是否按计划存在。请寻找反例和同根路径，不继承此前 verdict。

严格边界：只做静态源码审查。不运行测试、构建、verify、Expo Web、Android、VM 或 DEV；不读取或比较 .runtime/ 下任何 manifest、日志、截图、报告或历史运行；不要求本轮提供动态证据。此前的动态运行状态不构成本轮评审目标。

请给出 GO 或 NO-GO 与 M/S/N=x/y/z。每条 finding 请附精确仓库相对路径和行号、源码事实、触发条件或反例、影响、最小可验收修正，以及是否需要 Dexter 产品裁决；区分事实、推论与代码本身无法确认的事项。

授权边界：本轮仅请求只读静态源码复核，不授权修改文件、运行测试/构建/verify、Web/Android/VM/DEV、reset/seed、L2、UAT 或部署。谢谢。
```
