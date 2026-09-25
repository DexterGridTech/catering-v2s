---
id: decisions.terminal-build-order-and-batches
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform"]
impacts: ["architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["TER_FOUNDATION_FIRST_THREE_BATCHES","TER_DEPENDENCY_GRAPH_FROM_REAL_IMPORTS","TER_FOUNDATION_DONE_CRITERIA","TER_SKELETON_TWO_BATCH_VERTICAL_SLICE"]
sourceRefs: ["doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md","doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md"]
---

# TER 建设顺序与批次

⚠️ **两套批次编号并存，指的是不同维度，不要混**：
**F/D/N 是「哪些包要建」的分档**；**批 1 / 批 2 是「地基批内部的交付节奏」**。

- `TER_FOUNDATION_FIRST_THREE_BATCHES`：**业务无关的内容按依赖关系先建**（Dexter 裁定）。
  **批 F 地基（22 个包）** —— contracts → platform-ports → state → runtime →
  transport / display-context / **workflow** → ui-state → render → automation → primitives →
  input / admin-shell → adapter/android ×5 → test-support ×2 → integration → assembly。
  **批 D 延后**（编码的是**协议或业务**、对手方尚不存在的）：tcp-control · tdp-sync ·
  terminal-log-upload · topology 的链路半边 · **workflow 的 remote definition actor 与 TDP 边** ·
  权益三包 · 主数据三包 · terminal-console · admin-console 的协议半边 ·
  业务 workbench 与产品 shell · 热更新。
  **批 N 不建**：execution-runtime（与 runtime 是两套 command 语义）· **host-runtime 中间层（永久不建）** ·
  server-config（概念取消）· adapter/web · adapter 的共享包 · mock server。
  **判别式**：这个包编码的是**机制**还是**协议/业务**？机制可先做，协议必须等对手方。

  ⚠️ **`workflow` 属于地基，不属于批 D**（Dexter 2026-08-29 裁决，选项 B）。
  引擎本身不含任何业务语义 —— 业务是它执行的**定义**。
  推迟的只有它**唯一**依赖 tdp-sync 的那条边（`workflowRemoteDefinitionActor` 与
  `moduleManifest` 的 TDP 声明，POC 已逐文件核过）。
  **这不是限制远端下发脚本的能力**，只是当前没有承载它的传输层。

- `TER_SKELETON_TWO_BATCH_VERTICAL_SLICE`：**地基批分两批交付，批 1 验收通过后才开批 2**。
  **批 1 纵切片 14 个** —— contracts · platform-ports · state · runtime · display-context ·
  ui-state · kernel test-support · render · automation · primitives · ui test-support ·
  adapter/android/persist-kv · integration/platform-console · assembly/android/pos-desktop。
  **批 2 复制已验证形态 8 个** —— transport · workflow · input · admin-shell ·
  adapter/android 的另外 4 个。
  **判据**：批 1 必须覆盖**全部结构性未知**（四层俱全、owner 与 toolkit 两种形态、
  devDep 边、两条官方脚手架路径各一个、手工建的两类各一个）；
  批 2 只做已验证形态的复制。**批 1 若暴露与设计不符的结构问题，先改设计再开批 2。**
- `TER_DEPENDENCY_GRAPH_FROM_REAL_IMPORTS`：建设顺序必须按**真实 import** 推导，
  **不能按 `package.json` 抄** —— POC 实测 33 个包里 8 个存在未声明的工作区依赖
  （Yarn hoist 让未声明的包照样解析得到）。
- `TER_FOUNDATION_DONE_CRITERIA`：**骨架完成标准（Dexter 2026-08-29 收窄）** ——
  骨架只证明**结构接通**，不证明任何包的能力：
  ① 四个层都有内容，依赖图与设计一致（方向、闭包、无孤儿）；
  ② 全链**类型解析**通过（源码真实 import，`tsc` 走通整条纵切片）；
  ③ assembly 能**打包成功**（Metro 真实消费全部工作区包）。
  批一另有一次性 Android 模拟器验收，证明本仓三级布局下的 Gradle 构建、adapter autolinking（含生成注册结果）、
  应用启动与 bootstrap 诊断文本渲染；它不证明任何 Kotlin/native 能力或业务渲染行为，也不建设设备自动化。
  **不启真机、不启浏览器、不验证任何 command / slice / 持久化 / 业务渲染 / 双屏 / 端口行为。**
  ⚠️ 原"双运行面 + 装 APK + 杀进程重启恢复原状"是**能力验收**口径，属包级细化阶段，
  不是骨架完成标准。**骨架跑通只证明接线，报告不得表述成"包都能用了"。**

## 2026-09-25 包布局整理取代条目

本文件前述批次历史保留为历史记录。自 2026-09-25 起，TER 顶层可运行层的现状名称为
`application/{android,electron}`，不再把该层的目录、workspace package、moduleName 或 TR-16
运行目标称为 `assembly`。包布局整理的当前执行顺序与验收以
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-formal-requirements-claude.md`、
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md` 和
`doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-plan-codex.md` 为准；
本段不改写前述批次发生时的历史事实。
