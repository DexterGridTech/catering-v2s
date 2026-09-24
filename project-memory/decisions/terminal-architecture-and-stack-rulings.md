---
id: decisions.terminal-architecture-and-stack-rulings
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform","product"]
impacts: ["architecture","governance","runtime"]
triggers: ["task-start","implementation","review"]
assertions: ["TER_SAME_GOVERNANCE_AS_MAIN_REPO","TER_FOUR_LAYER_NESTED_STRUCTURE","TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE","TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY","TER_FEATURE_TOPOLOGY_OWNERSHIP","TER_STACK_RULINGS_T1_T13","TER_SCRIPT_EXECUTE_UNRESTRICTED","TER_EVENT_TO_COMMAND_ACTOR_PATTERN","TER_KERNEL_UI_FEATURE_ONE_TO_MANY"]
sourceRefs: ["doc/platform/terminal-coding-standard.md","doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md"]
---

# TER 架构与技术栈裁定

TER = `apps/terminal`，v2s 仓内的终端产品工程。设计输入是对 POC `newPOSv1` 的全量逐包分析。

- `TER_SAME_GOVERNANCE_AS_MAIN_REPO`：**与主仓同规，不另立第二套治理载体**
  （Dexter 原话："我为啥要搞两套真相？我最讨厌的就是多真相"）。
  ⚠️ Claude 曾以"R 原子交付与半小时切小冲突"为由建议另立，**是读错了**：
  两条的正确读法是"R 的**范围**要定得足够小"。
- `TER_FOUR_LAYER_NESTED_STRUCTURE`：四层**嵌套**目录（非平铺）——
  `kernel/{base,feature}` · `ui/{base,feature,integration}` · `adapter/{android,electron}` · `assembly/{android,electron}`。
  `ui-state` 留在 `kernel/base`（它是 React-free 的状态协议），渲染在 `ui/base`。
  **integration 是真实的 UI 与业务整合层，不是测试包**；"必须能在 Expo Web 上跑"是加在它身上的约束。
  它**不得依赖 adapter**（反向依赖）——web 上的能力由端口默认实例覆盖，**不建 `adapter/web`**。
  由此导出的验证顺序（不涉及 adapter 的功能先过 integration 的 Expo Web，再上设备跑 assembly 并证明两端一致）
  见 `doc/platform/terminal-coding-standard.md` 的 `TR-16`，本条不复述。
- `TER_EVENT_TO_COMMAND_ACTOR_PATTERN`：🔴 **Dexter 2026-09-02 定为「本 TER 工程最重要的设计模式」** ——
  **事件 → command → 关心它的业务方自己的 actor → `dispatchAction`**；内部外部一律照此，
  **不得**以回调注册、effect 列表或事件总线交给业务方。
  ⚠️ **内容正本在 `doc/platform/terminal-coding-standard.md` 的 `TR-11`**（含 command 定义点的层序约束、
  桥的播种与去重要求、门与反例栏）。本条只是指针，**不复述** —— 同一条规则写两处必然漂移（规范正本 §0）。
  ⚠️ 已知连带：runtime 现有的 `RuntimeModule.roleChangeEffects` 是被这条取代的形态；
  门缺陷整改 D-5 当前方案（effect 返回 action 数组）比现状好但**仍是 effect 列表**，
  落地前须问 Dexter 是否直接换成 command + actor。
- `TER_KERNEL_UI_FEATURE_ONE_TO_MANY`：见 `doc/platform/terminal-coding-standard.md` 的 `TR-12`。
- `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`：单机双屏 = **一个 ReactHost、一个 Hermes VM、
  一个 JS 线程、一个 store、多个 Root Surface**，Kotlin 按屏传不同 `initialProps`。
  POC 的"副屏独立进程"整套跨进程广播协议**不搬**。
  `displayMode` / `containerKey` 随命令传入；`workspace`（MAIN/BRANCH）是**设备级工作上下文**，两屏共享。
- `TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY`：跨机拓扑**仍是一主一副 pair**
  （"多 peer 图网络"是已被证伪的方向）；副屏（平板）**可拿下来、监听接电状态当主屏用** ——
  即 POC 已实现的 standalone slave + powerDisplaySwitch，`SLAVE && PRIMARY → BRANCH`。
- `TER_FEATURE_TOPOLOGY_OWNERSHIP`：正式写入归属规则是：**`MAIN` 只能主机的 actor 执行 command
  写入 slice。`BRANCH` 只能副机的 actor 执行 command 写入 slice。** 正本见
  `doc/platform/terminal-coding-standard.md` §4-D。由此导出 `MAIN → SLAVE` 与 `BRANCH → MASTER`
  的 projection 方向；不得以物理屏数 helper、拓扑事件重放或 `peer-intent` 代替 workspace 写入
  owner 判定。
- `TER_STACK_RULINGS_T1_T13`：技术栈裁定编号 `T-1`…`T-13`，正本在 sourceRefs 的建设顺序文档 §4B.10 —
  Expo SDK 57，**RN 版本取实施当时 `latest` 官方模板的解析结果，不手工钉死**
  （Dexter 2026-08-29 裁定用 latest）——2026-08-29 快照为 **RN 0.86.3**，
  满足 reanimated 4.5.1 的 peer `0.83-0.86`；快照与当时 latest 不符时以实际为准 ·
  NativeWind + React Native Reusables（由此新增 `ui/base/primitives`，承载统一语义注册）·
  Sentry + `react-error-boundary`（boundary 到 screen 级）· **不引入 React Compiler** ·
  **不使用 RTK Query**（OpenAPI → 类型化 client + transport 执行全部策略）· automation 完全自研 ·
  vitest 单一 runner · TDP 用 WS（放弃 SSE）· adapter/android 用 expo-module ·
  持久化后端由 adapter 决定 · 虚拟键盘按「单表面命中测试」（Reanimated 随之进入既定依赖集）· 引入 turbo。
- `TER_SCRIPT_EXECUTE_UNRESTRICTED`：`scripts.execute` **保留，且必须支持运行期从远端下发脚本源**，
  **不设来源限制**；安全由业务侧保障，平台层不设卡。
  ⚠️ 该能力**不属于**"调试面编译期剔除"的范围，写门时不得误剔。
