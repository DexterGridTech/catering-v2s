# TER Admin console 非登录区详设与实施计划独立对抗审查

```text
REVIEW_CYCLE_ID=2026-09-20-TER-ADMIN-CONSOLE-NON-LOGIN-DESIGN
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWER=Galileo
EVIDENCE_TIER=static/source-read
VERDICT=NO-GO
M/S/N=2/1/1
L2_USER_VISIBLE=OPEN_NOT_RUN
```

## 1. 输入与边界

本轮由 fresh 只读 critic 独立读取需求正本、已确认 IA、implementation-facing 详设、实施计划、项目记忆相关标准和当前源码；未运行 Web、Metro、Android、设备、visual 或动态测试。作者会话不代替独立 reviewer 形成 verdict。本记录不是 Claude review，也不构成 implementation 授权。

输入：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md`
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md`
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md`
- `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md`
- 当前 `apps/terminal/kernel`、`apps/terminal/ui/base` 与两个 integration 的 owning source。

## 2. Findings

### M-1：non-current surface 的字段分母在需求与 IA 之间冲突

状态：`CONFIRMED`；不得由实施者自行选择。

仓内事实：需求正本 R-9 与 §7.4 要求每个实际 surface 显示逻辑分辨率、物理分辨率、主/副角色和就绪/可用状态；物理值缺失时对应数字位置显示“未知”。已确认 high-fidelity IA 的双屏帧与 §5.1 又明确要求非当前 surface 只显示存在性、角色和“该屏信息未提供”，不显示分辨率和就绪态。详设与计划已沿用 IA 收窄，并在详设 §0.4、计划不变量和 CP-0 停止条件中登记冲突，但尚未有产品裁决或同步修订正本。

Owning source：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md` R-9、§7.4；
- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md` §4.3、§5.1；
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts` 当前只公开 current surface context；
- `apps/terminal/kernel/base/platform-ports/src/types/device.ts` 的 `DisplayInfo` 当前只有 `displayCount`。

反例：若按 R-9 实现，非当前卡片必须保留字段槽位并显示未知/未提供；若按 IA 实现，非当前卡片必须隐藏字段。两者会产生不同的 renderer、fixture、视觉分母和验收结果。当前 display owner 又不足以无猜测地填充逐屏数据，不能用 Android 日志、current surface 复制或推导值绕过。

最小处置：Dexter 明确接受 IA 的 non-current 收窄并同步需求/IA，或保留每个字段槽位并重画 IA。当前详设 §0.4 与计划 CP-0 已把此项保持 `OPEN`；在关闭前不得进入实施。

### M-2：display/topology owner admission 尚未闭合

状态：`CONFIRMED`；当前文档已把状态改为 `READY_FOR_REVIEW_WITH_ADMISSION_BLOCKERS`，但 blocker 仍然存在。

仓内事实：需求 §9.1 要求 display-facts owner 和 topology page-level availability owner 在进入实现前闭合；UI 不得从 raw facts 或代表性 operation reason 重组整页 gate。当前 `TopologyAdminCapability` 没有 `getPageAvailability()` 或 `pairByHost()`，只有 snapshot、operation eligibility、identity query、pair(locator)、unpair、host enable。当前公开 display facts 也不足以提供所有真实 surface 的逐屏尺寸与状态。

Owning source：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md` §9.1、R-12、R-16；
- `apps/terminal/kernel/base/contracts/src/types/topology.ts` `TopologyAdminCapability`；
- `apps/terminal/kernel/base/topology/src/features/commands/commands.ts` 的 `pair` command；
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts` 的 MASTER/CHIEF、module identity 与 pairing state 前置；
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts` 与 `apps/terminal/kernel/base/platform-ports/src/types/device.ts`。

反例：若 implementation 直接进入 CP-1，实施者只能在 admin-shell 自行拼 page gate、隐藏 non-current 字段或复制现有 current surface；这正是需求明确禁止的 owner 漂移。详设给出目标 contract 是计划输入，不代表 contract 已存在。

最小处置：保留 CP-0 停机；由 owning owner 闭合 `DisplayFactsReadModel`、`getPageAvailability()` 与 `pairByHost()` 的声明—传递—消费—readback，或由 Dexter 明确调整范围。关闭前不得声称计划可直接实施。

### S-1：direct pair 的 owner 闭包需要逐项可证伪

状态：`PARTIALLY_CONFIRMED`；文档修订已补强，需 Claude/fresh 复核后才能关闭。

当前代码事实：`pairTopologyCommand` 接收完整 `TopologyLocator`；actor 需要 moduleName 匹配、当前 `MASTER` + `CHIEF`、未配对，并会切换实例/显示角色。仅写“内部可查询 identity”不足以证明 host 输入能安全转换为 locator，也不足以证明失败后不会留下半状态。

详设与计划现已补列：host 规范化、identity 查询、moduleName 校验、stale identity、MASTER/CHIEF 前置、single-pair 占位、locator 构造、切换 `SLAVE`/`VICE`、失败回滚、成功/失败 readback，以及每项 red mutation。该处不再允许只测 capability 被调用，但仍需后续独立复核与实现证据。

### N-1：sample-wallpaper-console shared admin 装配疑点被源码反证

状态：`REJECTED_WITH_EVIDENCE`。

`wallpaperConsoleParts` 虽只列业务 parts，但 `createConsoleAssembly` 会统一注入 `adminShellAssembly.parts` 并由 `AdminLauncher` 包住 content。因此 shared admin console 基线成立，不构成当前设计 finding。

## 3. 结论与后续门

当前设计方向合理，但 M-1、M-2 使它不能作为无条件实施入口，独立结论为 `NO-GO (M/S/N=2/1/1)`。详设与计划仍可交 Claude 做第二方静态 review，但交付话术必须明确：这是带 admission blockers 的设计稿，不是 implementation-ready，也没有 runtime/visual/device PASS。

作者已在本轮吸收可直接落地的文档处置：补齐全部 IA-01–IA-29、IA-32 帧分母；把状态改为带 blocker 的 review 状态；把 `pairByHost` 的逐项 owner proof、失败 readback 和 red mutation 加入 CP-1。上述处置尚未关闭产品字段裁决或 owner contract blocker。
