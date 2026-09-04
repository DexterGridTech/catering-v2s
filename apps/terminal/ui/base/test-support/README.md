# `@catering-v2s/ui-base-test-support`

## 定位

本包当前只保留 TER 包图元数据骨架，不提供运行时、宿主、平台端口或测试 helper。可复用的
Expo Web 开发宿主已经归属 `@catering-v2s/ui-base-dev-host`；保留这个空壳是为了让 base toolkit
目录的模块边界和后续扩展位置明确。

## 公共面与结构

公共面只有 `moduleName`、`dependencyModuleNames` 与 `devDependencyModuleNames`。三个导出
分别来自 `src/moduleName.ts`、`src/dependencies.ts` 与 `src/index.ts`；当前两组依赖均为空。
本包没有测试、运行时依赖或 React/Expo peer 依赖。

## 用法

本包不应被业务或 Expo 入口用于宿主能力。需要可切换 surface、Web PlatformPorts、真实 Web
Storage 或启动日志时，请使用 `@catering-v2s/ui-base-dev-host` 的公共接缝。

## 迭代指引

只有在获得明确设计与授权后，才可向本包加入不属于开发宿主的通用 test-support 能力；加入前
必须重新推导实际 import、依赖声明、公共面、`terminal-invariants.json`、测试与本 README。
不得把 `ui.base.dev-host` 的文件复制回本包，也不得通过 fallback 保留旧宿主入口。
