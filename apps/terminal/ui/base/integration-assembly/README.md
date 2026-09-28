# Integration 基础装配

## 定位

`ui.base.integration-assembly` 是两个 terminal integration 共用的整机装配壳。它读取设备与屏幕
事实，合并 admin shell 与 integration 提供的 parts，建立并启动 runtime，按每块屏幕的 display
mode 和 surface form 生成界面树，并导出 `createIntegrationAssembly` 与按屏幕创建 surface 的
基础能力。启动诊断 writer 只是其中一项职责；本包不拥有 feature 业务状态、catalog 或原生开机
画面。

## 结构

- `src/moduleName.ts`：公开模块身份。
- `src/dependencies.ts`：integration assembly 的 workspace 依赖声明。
- `src/foundations/integrationAssembly.tsx`：共享整机装配壳、设备/屏幕事实读取、parts 合并、
  runtime 启动、surface 输入和 per-runtime primary-ready 生命周期门，并导出
  `createIntegrationAssembly`。
- runtime facts 同时携带按 PRIMARY/SECONDARY 解析后的应用逻辑画布尺寸；这是应用逻辑分辨率，
  不等同于设备 adapter 提供的逻辑显示区域或物理像素尺寸。
- `src/foundations/terminalSurfaces.ts`：无业务知识的 surface declaration parser 与
  orientation selector；package.json 仍由 integration adapter 读取。
- `src/foundations/startupReady.ts`：startup-ready payload 与 actor 的机械共性；command
  identity、消息和装配时机仍由 integration 持有。
- `src/foundations/stateSyncSlices.ts`：只过滤显式提供的 isolated slice，不扫描、排序或
  去重 integration 的 state source。
- `src/foundations/startupDiagnosticsWriter.ts`：单一 writer 与 duplicate guard。
- `src/index.ts`：唯一公开入口。
- `terminal-invariants.json`：公开面与包边界不变量。

两个 integration 通过同一 writer 接收 logger、唯一 run identity、client/app 及
surface provenance；它们不得各自复制 `startup.complete` 写入逻辑，也不得把 sink
oracle 变成写入端。

## 用法

在 integration assembly 完成 required startup groups 和 surface provenance 后，调用
`createStartupDiagnosticsWriter` 的受控入口。writer 必须拒绝相同 run 的重复 complete，
并保留结构化、脱敏、可关联的日志字段；integration 通过 `createStartupReadyActor`、
`createStartupReadyPayload`、`selectStateSyncSlices` 和 terminal-surface adapter 接入，
不在包内复制这些机械实现。

## 迭代边界

在这个包上迭代时，先同步详设 D-7/D-8 与计划 B3，再核对两个 integration 的
`package.json`、`dependencies.ts`、graph edge 和 admin console 接线。不要在此加入
第二 writer、跨客户端聚合、feature notice 或 runtime state；每个新字段都要有 focused
red mutation 和日志脱敏复核。
