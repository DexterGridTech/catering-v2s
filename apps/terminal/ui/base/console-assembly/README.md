# Console 基础装配

## 定位

`ui.base.console-assembly` 是两个 terminal console integration 共用的启动诊断写入
owner。它只写一次结构化 `startup.complete` 事实，不拥有 feature 业务状态、catalog
或原生开机画面。

## 结构

- `src/moduleName.ts`：公开模块身份。
- `src/dependencies.ts`：console assembly 的 workspace 依赖声明。
- `src/foundations/consoleAssembly.tsx`：共享 console 壳、运行期模块装配、surface
  输入和 per-runtime primary-ready 生命周期门。
- `src/foundations/startupDiagnosticsWriter.ts`：单一 writer 与 duplicate guard。
- `src/index.ts`：唯一公开入口。
- `terminal-invariants.json`：公开面与包边界不变量。

两个 integration 通过同一 writer 接收 logger、唯一 run identity、client/app 及
surface provenance；它们不得各自复制 `startup.complete` 写入逻辑，也不得把 sink
oracle 变成写入端。

## 用法

在 console assembly 完成 required startup groups 和 surface provenance 后，调用
`createStartupDiagnosticsWriter` 的受控入口。writer 必须拒绝相同 run 的重复 complete，
并保留结构化、脱敏、可关联的日志字段；读侧只消费单客户端 sink。

## 迭代边界

在这个包上迭代时，先同步详设 D-7/D-8 与计划 B3，再核对两个 integration 的
`package.json`、`dependencies.ts`、graph edge 和 admin console 接线。不要在此加入
第二 writer、跨客户端聚合、feature notice 或 runtime state；每个新字段都要有 focused
red mutation 和日志脱敏复核。
