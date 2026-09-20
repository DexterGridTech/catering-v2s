# TER Admin console 非登录区需求 DESIGN review 请求

## 背景

本轮交付单元是 TER Admin console 非登录区的需求分析与范围冻结，覆盖 panel 框体、平台端口、合并后的运行状态、全 surface 显示上下文和双机拓扑用户旅途。登录框、feature 注入的业务页面、电源确认 alert、topology kernel/transport 和动态实现均不在本轮。

需求稿已经完成一次 fresh 独立只读 DESIGN 审查，留痕见 `doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`。上一轮 Claude review 的 NO-GO（1M/2S/3N）也已逐条 intake：按 Dexter 决定，本批不扩展 display facts owner；当前 surface 显示现有逻辑尺寸/就绪状态，非当前 surface 只显示存在性/角色并标注“该屏信息未提供”；topology page-level availability 作为进入 IA/详设的 admission blocker；端口比例条冻结能力单位分母并为缺失/空 port 生成一个合成“未声明”单位；`switch-role` 与双物理屏/拓扑语料边界已记录。当前仍是需求稿，未进入 IA、详设、实施或动态验证。

## 评审目标

请独立判断：

1. 本稿解决的是否是真实用户问题，三 tab 的范围收口是否合理，是否遗漏了用户需要的非业务 panel 或误把业务/登录内容带入；
2. runtime 与 display-context 合并、平台端口聚合、laptop/mobile panel 交互和 single-machine dual-screen surface 表达是否能交给 IA，而不会把错误的源码事实或过度设计带入；
3. topology 的全局不可用 gate 与 operation-level eligibility 是否已严格分开，主机/副机 action matrix 的分母是否闭合，`paired` 与 `peerReachable` 是否保持正交；
4. 当前 surface 与非当前 surface 的公开事实边界是否按已定不对称下限表达，需求是否明确禁止复制 current surface 或伪造逻辑/物理/就绪事实；同时核对 topology page-level availability 是否仍作为 owner blocker 而没有被 admin-shell 绕过；
5. shared primitives、semantic theme token、selector subscription、用户可见中文语料和后续可证伪性质是否足够约束实施方，同时没有把具体组件树、像素、hook 或实施批次提前写死。

## 需阅读文件

请从 catering-v2s 仓库根阅读：

- `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`：本轮需求、用户旅途、范围边界和需求级验收性质；
- `doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`：fresh 独立审查原始 findings 与主 agent intake；
- `doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-claude-intake-codex.md`：上一轮 Claude NO-GO 的逐条处置；
- `doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-review-claude.md`：上一轮 Claude DESIGN review 原文；
- `apps/terminal/ui/base/admin-shell/src/parts/parts.ts`：当前四个非业务 section part、两种形态和独立 power-confirmation layer；
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`：当前 panel frame；
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`：当前 laptop navigation/content 组织；
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`：当前 mobile 组织；
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`：当前 tab 导航；
- `apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`：catalog/renderer 与 topology capability 注入边界；
- `apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx`：当前平台端口平面列表与 missing descriptor 处理；
- `apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx`：当前运行状态字段；
- `apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`：当前只读 current-surface 显示上下文；
- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx`：当前拓扑平面信息、操作入口和用户文案；
- `apps/terminal/kernel/base/contracts/src/types/topology.ts`：`TopologyOperation`、facts、eligibility、capability 与 reason 类型；
- `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`：全局资格、operation-level eligibility、paired/reachable 语义；
- `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`：拓扑事实 projection；
- `apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`：Admin UI 可消费的 topology boundary；
- `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`：display/workspace/物理屏相关语义；
- `apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`：当前公开 surface facts；
- `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`：surface host snapshot 与 display identity；
- `apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt`：Android 内部 display diagnostic logging；
- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`：dual-screen host 内部 logical bounds/metrics logging；
- `apps/terminal/kernel/base/platform-ports/src/types/result.ts`：十个 platform port 名称与 capability 状态；
- `apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`：platform capability snapshot 的真实分母来源；
- `apps/terminal/ui/base/primitives/src/index.ts`：现有 shared primitive 公共面；
- `apps/terminal/ui/base/primitives/README.md`：现有 primitive 能力说明；
- `apps/terminal/ui/integration/sample-console/theme/`：sample-console 语义 theme；
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/`：sample-wallpaper-console 语义 theme；
- `doc/platform/terminal-coding-standard.md`：TER 终端层、owner 和 UI 边界；
- `project-memory/decisions/terminal-integration-admin-console-invariant.md`：两个 integration 共用 Admin console 的约束；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：终端层次、双机角色与 feature ownership；
- `project-memory/operations/verification-governance.md`：需求/设计/动态证据的边界。

## 独立核验重点

1. **三 tab 的范围**：逐一核对四个现有 non-business part 与三个用户 tab 的映射；确认 `power-confirmation` 是独立 alert/layer，登录与 feature content 没被误并入。
2. **拓扑 gate 的边界**：验证需求现在只把 unsupported form、physical display count、capability 缺失等全局资格用于整页不可用，且要求由 topology owner 提供 page-level availability/read model；角色、配对和连接状态只能影响对应 operation。用“已配对副机仍可解绑、但不能 query/pair/enable-host”的反例检验需求不会把合法动作吞掉，也检查 admin-shell 没有从 representative operation reason 重建整页 gate。
3. **action matrix 的封闭分母**：逐一核对 `TopologyOperation` union（包括当前没有 capability 同名 command 的值）、`TopologyAdminCapability` command surface 与 `getOperationEligibility`/reason。检查需求是否要求对 capability 缺失的 operation 显式归为资格-only 或非本批，而不是由 UI 自行补命令或静默漏掉。
4. **paired/reachable 正交**：确认断线场景仍显示已配对/重连中，不会被 UI 重算成未配对；同时确认 topology secondary 的既有 owner 语义没有被 Admin 需求改写。
5. **平台端口摘要**：回源十个 port 名称与 `PlatformPortCapabilitySnapshot` 的 descriptor/capability 分支，检查能力单位分母、每个 missing/empty port 恰好一个合成“未声明”单位、分类守恒和有限展开，不把 list length 冒充健康度。
6. **运行状态与双屏**：验证当前 `SurfaceContextValue`/`DisplayInfo` 的真实公开面，并区分 Android 内部诊断日志与公共 owner；确认需求按 Dexter 决定只让当前 surface 显示逻辑尺寸/就绪状态，非当前 surface 只显示存在性/角色和“该屏信息未提供”，禁止复制 current surface 或用 logical 值冒充 physical 值，并确实要求单机双屏同时呈现 PRIMARY/SECONDARY。
7. **panel 响应式**：检查 laptop master-detail 与 mobile 独立窄屏编排的需求是否可证伪，是否明确避免只换行、横向溢出、关闭入口被内容遮挡和键盘/inset 覆盖。
8. **primitive/theme**：核对现有 shared primitive 与 theme 事实；确认需求把 ratio/expand/surface map 缺口留给 shared primitive 扩展，而没有让 admin-shell 或两个 integration 复制控件或写死品牌色。
9. **selector 与渲染边界**：检查 R-19/P-12 是否要求完整订阅分母、context/capability identity、equality、stable identity 与无关 slice/full-root/new-object red mutation；不得用“调用了 selector”替代证明，也不得把需求稿写成性能改善承诺。
10. **上一轮新增精度**：确认 `switch-role` 的 `allowed:true` 没有被误写成可执行授权；确认 laptop 双物理屏时运行状态的“检测到两块物理屏”与拓扑的“要求本机只有一个物理屏”不冲突；确认独立审查状态与留痕一致。
11. **需求与详设边界**：找出任何把组件树、像素、CSS、hook、testID、具体 API 或实施批次提前写死的句子；反向检查是否存在用户旅途、失败/恢复、数据缺失或 owner 边界尚未定义的缺口。

本轮只做需求 DESIGN review，不启动构建、测试、Web、Metro、Android、设备、DEV、seed、UAT 或部署。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding 请区分仓内事实、推论与尚缺证据，给出仓库相对路径、精确行号/符号、反例、适用条件、最小修复，以及是否需要 Dexter 做产品/Journey 裁决。

如果需求层成立但某项必须留给 IA/详设，请标为 `UNVERIFIED_REQUIRES_DESIGN_OWNER`，不要把它写成当前源码已经具备；如果不成立请给出 `REJECTED_WITH_EVIDENCE` 的反例。

授权边界：本轮只授权对需求与范围做独立 DESIGN review。`GO` 只表示可以由 Dexter 决定是否进入 IA；不授权 IA、详设、实施、源码/测试/脚本/依赖修改、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或任何 acceptance/release PASS。任何产品语义、Journey 或范围扩大问题请单独标为需 Dexter 裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER Admin console 非登录区的需求与范围。

背景：本轮只做需求 DESIGN review，目标是重构 Admin console 登录成功后的非业务 panel 框体、平台端口、合并后的运行状态、全 surface 显示上下文和双机拓扑用户旅途。登录框、feature 注入的业务页面、电源确认 alert、topology kernel/transport 以及任何实现和动态验证都不在本轮。该需求稿已经经过一轮 fresh 独立只读审查，原审查中的拓扑全局资格/operation eligibility 混淆、action matrix 分母、surface facts owner 前置和 selector 可证伪性问题已经按源码回源处理，相关路径在文末相对路径清单中。

评审目标：请先独立判断这是否解决真实用户问题、三 tab 范围是否合理、laptop/mobile 交互是否真的需要不同信息编排；再核验平台端口是否做到总量摘要加有限分类展开，runtime 与 display-context 是否合并且单机双屏同时显示主屏和副屏，拓扑是否在全局不支持时只显示不可用原因、在可用时按主机/副机和 operation eligibility 展示不同动作；同时检查当前公开 display facts 不足时是否禁止伪造物理分辨率、TopologyOperation 与 TopologyAdminCapability 的 action matrix 分母是否闭合、paired/reachable 是否保持正交、shared primitives/theme 和 selector 订阅边界是否没有把详设机制提前写死。

请从 catering-v2s 仓库根阅读文末相对路径清单中的需求稿、独立审查留痕、Admin shell、topology、display-context、platform-ports、primitives、两个 integration theme、终端规范和项目记忆。

请重点独立核验：
1. 四个现有 part 是否确实收口为三个用户 tab，power-confirmation、登录和 feature content 是否被正确排除；
2. 拓扑全局不可用和 operation-level 不可用是否严格分开；已配对副机仍可解绑但不能 query/pair/enable-host 的反例是否能被需求正确表达；
3. `TopologyOperation` union、`TopologyAdminCapability` command surface、eligibility/reason 是否逐项闭合，不能由 UI 自行造命令或静默漏项；
4. 平台端口 summary 的计数分母、missing descriptor、分类守恒和有限展开是否可证伪；
5. 当前 display facts 不完整时，需求是否准确区分 current/non-current surface 的信息下限，禁止复制 current surface 或用 logical 值冒充 physical/ready 值；同时 topology page-level owner 是否仍被列为 IA/详设前置；
6. 单机双屏必须同时表达 PRIMARY/SECONDARY，laptop/mobile 不得只是同一桌面布局换行；
7. primitives/theme 与 selector 订阅边界是否足够约束实现，又没有把组件树、像素、hook、具体 API 或实施批次写死。

烦请给出明确 `GO` 或 `NO-GO`，并按 `M` / `S` / `N` 报告数量。每条 finding 请给出精确仓库相对路径、行号/符号、仓内事实与推论的区分、反例、最小修复及是否需要 Dexter 产品/Journey 裁决；资料不足请写 `UNVERIFIED_REQUIRES_DESIGN_OWNER`。

授权边界：本轮只授权需求 DESIGN review。`GO` 不授权 IA、详设、实施、任何源码/测试/脚本/依赖修改、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署，也不代表任何 acceptance/release PASS。

仓库相对路径清单：`doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`；`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-independent-review-codex.md`；`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-claude-intake-codex.md`；`doc/review/platform/2026-09-19-ter-admin-console-non-login-requirements-review-claude.md`；`apps/terminal/ui/base/admin-shell/src/parts/parts.ts`；`apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx`；`apps/terminal/ui/base/admin-shell/src/components/AdminShellLaptop.tsx`；`apps/terminal/ui/base/admin-shell/src/components/AdminShellMobile.tsx`；`apps/terminal/ui/base/admin-shell/src/components/AdminSectionNavigation.tsx`；`apps/terminal/ui/base/admin-shell/src/components/AdminSectionContent.tsx`；`apps/terminal/ui/base/admin-shell/src/components/sections/PlatformPortsSection.tsx`；`apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSection.tsx`；`apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSection.tsx`；`apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx`；`apps/terminal/kernel/base/contracts/src/types/topology.ts`；`apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`；`apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`；`apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`；`apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`；`apps/terminal/ui/base/render/src/contexts/SurfaceContext.ts`；`apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`；`apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt`；`apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`；`apps/terminal/kernel/base/platform-ports/src/types/result.ts`；`apps/terminal/kernel/base/platform-ports/src/foundations/createPlatformPorts.ts`；`apps/terminal/ui/base/primitives/src/index.ts`；`apps/terminal/ui/base/primitives/README.md`；`apps/terminal/ui/integration/sample-console/theme/`；`apps/terminal/ui/integration/sample-wallpaper-console/theme/`；`doc/platform/terminal-coding-standard.md`；`project-memory/decisions/terminal-integration-admin-console-invariant.md`；`project-memory/decisions/terminal-architecture-and-stack-rulings.md`；`project-memory/operations/verification-governance.md`。谢谢。
```
