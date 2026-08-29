---
id: operations.terminal-coding-standard
title: 终端编码规范的唯一内容源在 doc/platform，别处只放指针
type: operation
status: active
layer: routed
scope: every TER (apps/terminal) design, implementation, review, and standards change
createdAt: 2026-08-29
taskKinds: ["design","implementation","review","testing"]
domains: ["platform"]
consumerFaces: ["all"]
owners: ["platform","frontend-platform"]
impacts: ["governance","architecture"]
triggers: ["task-start","implementation","review"]
assertions: ["TERMINAL_STANDARD_SINGLE_SOURCE","TERMINAL_STANDARD_POINTERS_ONLY","TERMINAL_NINE_HARD_RULES","TERMINAL_TRIPLE_NAMING_DERIVED","TERMINAL_PORT_REGISTRY_WITH_DEFAULTS"]
sourceRefs: ["doc/platform/terminal-coding-standard.md"]
---

# 终端编码规范

- `TERMINAL_STANDARD_SINGLE_SOURCE`：唯一内容源是
  [`doc/platform/terminal-coding-standard.md`](../../doc/platform/terminal-coding-standard.md)。
  新增或修改规则**只改那一处**。
- `TERMINAL_STANDARD_POINTERS_ONLY`：项目记忆、skill、评审文档**只写"见正本"**，不复述规则内容。
  通用工作纪律（`currentData`/`isFetching`、`initiate` 义务、同一事实一个住址、幂等键、
  否定式全称命题、finding 带业务场景、动笔前查五处）由正本 §0 指针引用前端规范，同样不复述。
- `TERMINAL_NINE_HARD_RULES`：九条硬规则编号稳定为 `TR-01`…`TR-09`（门的名字、红夹具、
  review checklist 都引用该编号）：
  reducer 只能 actor 调用 · 「什么都没做」不得返回成功 · 跨包读只走 selector ·
  持久化必须有正反双断言重启测试 · 端口禁 `Record<string,unknown>`/`any` ·
  foundations 不得触达 store/网络/平台 API · 集合先声明形态 ·
  调试面编译期剔除 · 包的 owner/toolkit 归属与 slice 命名。
  ⚠️ **本条只列规则标题，不复述内容** —— 规则细节（含骨架阶段的 `plannedKind` 例外）
  一律以正本为准，避免记忆随规范漂移。
- `TERMINAL_TRIPLE_NAMING_DERIVED`：目录路径 → `moduleName`（点连）→ npm 包名（连字符 + scope）
  三者互相可推导；包名禁版本号与框架名；依赖门必须有**方向**与**声明完整性**两条断言。
- `TERMINAL_PORT_REGISTRY_WITH_DEFAULTS`：`PlatformPorts` 无可选字段；
  没人注册就用**声明处自带的零依赖默认实例**；默认分「可用」与「不可用（typed 能力不可用）」两类；
  **不得为了让 web 像真机而给默认实现加戏**。
