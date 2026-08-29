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
assertions: ["TER_SAME_GOVERNANCE_AS_MAIN_REPO","TER_FOUR_LAYER_NESTED_STRUCTURE","TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE","TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY","TER_STACK_RULINGS_T1_T13","TER_SCRIPT_EXECUTE_UNRESTRICTED"]
sourceRefs: ["doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md"]
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
- `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`：单机双屏 = **一个 ReactHost、一个 Hermes VM、
  一个 JS 线程、一个 store、多个 Root Surface**，Kotlin 按屏传不同 `initialProps`。
  POC 的"副屏独立进程"整套跨进程广播协议**不搬**。
  `displayMode` / `containerKey` 随命令传入；`workspace`（MAIN/BRANCH）是**设备级工作上下文**，两屏共享。
- `TER_PAIR_TOPOLOGY_WITH_DETACHABLE_SECONDARY`：跨机拓扑**仍是一主一副 pair**
  （"多 peer 图网络"是已被证伪的方向）；副屏（平板）**可拿下来、监听接电状态当主屏用** ——
  即 POC 已实现的 standalone slave + powerDisplaySwitch，`SLAVE && PRIMARY → BRANCH`。
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
