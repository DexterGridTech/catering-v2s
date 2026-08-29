# `@next/ui-base-terminal-console`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 D · 延后** —— 激活 UI，绑 `tcp-control` |
| 路径 | `2-ui/2.1-base/terminal-console` |
| 规模 | src **1,436 行 / 20 文件**；test 669；test-expo 304 |
| 依赖 | **10 个**（UI 层最多）：`tcp-control` · `tdp-sync` · `topology-v3` · `ui-runtime-v2` · `runtime-shell-v2` · `state-runtime` · `contracts` · `runtime-react` · `input-runtime` · `server-config-v2` |
| 被依赖 | 2（`host-runtime-rn84` · `catering-shell`） |
| 状态 | 活跃 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**终端激活与终端状态的基础 UI。** 三个屏 + 一组 primitive：

| 文件 | 行数 | 内容 |
|---|---|---|
| `ActivateDeviceScreen.tsx` | 392 | 主屏激活页（输入激活码、显示设备信息、错误反馈） |
| `ActivateDeviceSecondaryScreen.tsx` | 271 | **副屏激活页**（副屏不自己激活，显示等待/绑定状态） |
| `TerminalSummaryScreen.tsx` | 99 | 终端摘要 |
| `TerminalSectionPrimitives.tsx` | 289 | 统一控件（含 `semanticId: testID` 自动注册） |
| `useDeviceActivation.ts` | 121 | 激活状态 hook |
| `useTerminalConnectionSummary.ts` | — | 连接摘要 hook |

## 2 · 优点

1. **主屏与副屏各有独立激活页**，不是同一个页面按条件分支。
   副屏的语义是"我不激活，我等主屏"，与主屏是**两个用户任务**，分开是对的。
2. **`TerminalSectionPrimitives.tsx` 在 primitive 层做 `semanticId: testID` 自动注册**
   （第 217 行），是 `FIX-08` 的正确做法之一。
3. **两个 hook（`useDeviceActivation` / `useTerminalConnectionSummary`）把 selector 组合收敛**，
   组件不直接拼多个 selector。
4. **304 行 test-expo**，激活流程可在浏览器里跑。
5. **UI 只读 selector + 发 command**：激活动作走 `tcpControlV2CommandDefinitions.activateTerminal`，
   不自己拼 HTTP。

## 3 · 缺点 / 风险

1. **依赖 10 个包，是 UI 层最多的。**
   一个"激活页"需要同时知道 TCP 控制面、TDP 数据面、拓扑、UI runtime、输入、server config。
   这说明**激活页承担的其实是"终端整体状态总览"**，不只是激活。
2. **`useDeviceActivation.ts` 用 `useSelector` + `shallowEqual` 组合多个 selector**，
   而 `useTerminalConnectionSummary.ts` 直接 `useSelector<RootState, T>((state) => {...})`
   内联构造对象 —— **两种写法并存**（对照前端规范 §3-A"同一件事只能有一种写法"）。
3. **`ActivateDeviceScreen.tsx` 392 行**，激活页承载了输入、校验、错误展示、设备信息、沙箱选择。
4. **依赖 `server-config-v2`**：UI 包直接知道服务器配置，
   这与"地址是环境策略、归 assembly"相悖（`FIX-12` 的连带）。

## 4 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **主副屏两个激活页的拆法保留** | 两个用户任务（§2.1） |
| 2 | **拆成"激活"与"终端状态总览"两个关注点** | 10 个依赖说明它现在是两件事（§3.1） |
| 3 | **selector 组合统一成一种写法**（推荐 hook + `shallowEqual`），写进 TER 前端规范 | §3.2 |
| 4 | **去掉对 `server-config-v2` 的依赖**，服务器选择由 assembly 注入 | `FIX-12` |
| 5 | **primitive 层 automation 注册保留并下沉到 RNR 包装层** | §2.2，`FIX-08` |
| 6 | **协议相关部分等对手方**（激活流程会随 `catering-business-server` 重定） | 讨论稿 §7.3 |

## 5 · 证据档位

`已亲验`：文件清单与行数、`package.json` 依赖、被依赖穷举、
`TerminalSectionPrimitives.tsx:217` 的 `semanticId: testID`、
两个 hook 的 `useSelector` 写法差异。
**未逐行读**：三个屏组件（合计 762 行）。
