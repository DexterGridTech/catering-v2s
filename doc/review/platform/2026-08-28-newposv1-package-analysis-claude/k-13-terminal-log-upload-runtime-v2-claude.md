# `@next/kernel-base-terminal-log-upload-runtime-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 D · 延后** —— 需要服务端上传端点 |
| 路径 | `1-kernel/1.1-base/terminal-log-upload-runtime-v2` |
| 规模 | src **315 行 / 11 文件**；test **0 行** |
| 依赖 | `contracts` · `platform-ports` · `runtime-shell-v2` · `tcp-control-runtime-v2` · `transport-runtime` |
| 被依赖 | 声明 1 个（host-runtime-rn84），源码实际 2 个（+ `tdp-sync-runtime-v2` 把命令路由过来） |
| 状态 | 活跃但**零测试**，是 kernel base 里唯一没有 test 目录的包 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**响应服务端下发的"上传终端日志"命令。** 链路：

```
服务端经 TDP 下发 UPLOAD_TERMINAL_LOGS
  → tdp-sync-runtime-v2 的 terminalLogUploadCommandRouterActor 路由
  → 本包 uploadActor 执行
  → platformPorts.terminalLogs.uploadLogsForDate(...)
  → 上报结果
```

## 2 · 结构

| 文件 | 行数 |
|---|---|
| `features/actors/uploadActor.ts` | **186**（唯一实质实现） |
| `application/createModule.ts` | 29 |
| `supports/errors.ts` | 27 |
| `features/commands/index.ts` | 20 |
| `application/moduleManifest.ts` | 18 |
| `types/index.ts` | 15 |

**一个包只有一个 actor**，职责单一。

## 3 · 优点

1. **职责极窄**：只做"收到上传命令 → 调端口 → 报结果"，没有夹带。
2. **上传能力走 `TerminalLogUploadPort`**，kernel 不知道文件系统、不知道 HTTP 上传细节。
   该端口的返回类型是 `platform-ports` 里**质量最好的几个之一**：

   ```ts
   TerminalLogUploadResult = {
       terminalId?, displayIndex?, displayRole?, logDate,
       uploadedFiles: {fileName, fileSize, uploadedAt?, checksum?, storageKey?, url?, metadata?}[],
       skippedFiles?: string[],
       metadata?
   }
   ```

   全部具名类型，**没有 `Record<string, unknown>`** —— 是 `FIX-03` 的正面对照。
3. **结果按文件逐条返回，并区分 uploaded 与 skipped。**
   对照后台规范 2-B"任何'什么都没做'的路径不得返回成功"，
   这个返回形状是对的：调用方能看出"上传了 0 个文件"。
4. **命令由 TDP 路由过来而不是自己订阅 TDP**，包间依赖方向正确。

## 4 · 缺点 / 风险

1. **零测试。** kernel base 14 个包里唯一一个没有 `test/` 目录。
   而它的实际行为（哪些文件被选中、失败如何重试、结果如何上报）恰恰是不看代码说不清的。
2. **186 行单 actor 承担全部逻辑**，没有把"选文件 / 调端口 / 报结果"分开，不利于单测。
3. **依赖 `tcp-control-runtime-v2`**（取 terminalId / token），
   使"上传日志"与"终端激活"耦合。合理但值得记录。
4. **这是一条权限敏感通道**：服务端可远程抓取终端日志。
   包内没有任何关于"谁能下发、下发内容如何校验"的处理 —— 与 `FIX-19` 同型。
5. **路由 actor 住在 `tdp-sync` 里**（`terminalLogUploadCommandRouterActor`），
   而执行 actor 住在这里。**一个能力横跨两个包**，这是 `FIX-01` 的又一处表现。

## 5 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **能力保留**：远程抓日志对门店终端排障是刚需（现场没有开发者、没有 logcat） | 与 `FIX-09` 同一动机 |
| 2 | **补测试**：至少覆盖"零文件命中""端口抛错""部分文件 skipped"三条 | 当前零测试（§4.1） |
| 3 | **拆 actor**：选文件 / 调端口 / 报结果三段分开 | 186 行单函数不利于测（§4.2） |
| 4 | **路由 actor 一并搬进本包**，让"日志上传"成为完整 owner | 消掉横跨两包（§4.5，`FIX-01`） |
| 5 | **下发命令必须有来源校验**，并把"谁触发了这次上传"写进审计 | 权限敏感通道（§4.4） |
| 6 | **`TerminalLogUploadPort` 的类型形态作为其它端口的模板** | 它是 `FIX-03` 的正面对照（§3.2） |

## 6 · 证据档位

`已亲验`：文件清单与行数、`index.ts`、`platform-ports` 的 `TerminalLogUploadPort` 类型定义、
`tdp-sync` 侧路由 actor 的存在。"零测试"为 `已亲验`（`test` 目录不存在）。
**未逐行读**：`uploadActor.ts` 186 行（读了签名与端口调用点，未逐行核对失败分支）。
