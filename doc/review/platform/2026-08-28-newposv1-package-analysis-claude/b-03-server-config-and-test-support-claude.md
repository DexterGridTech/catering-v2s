# `server-config-v2` 与 `1-kernel/test-support`

> 两个非 runtime 的支撑单元，合并成一份文档。

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## A · `@next/kernel-server-config-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **分开** —— `server-config` → **批 N**（取消包）；⚠️ 但"值归 assembly"这句**说窄了**：值是**启动层输入**，而启动层 ≥3 个（assembly/android · assembly/electron · **ui/integration 的 web 入口**）；dev 地址册归 `test-support`（dev-only）。见 `00-ter-build-order` §4B.3。`test-support` → **批 F · F9a** |
| 路径 | `1-kernel/server-config-v2` |
| 规模 | src **171 行 / 4 文件**；test 0 |
| 依赖 | `contracts` |
| 被依赖 | 声明 6 个，源码实际 5 个（tcp / tdp / benefit-session / host-runtime-rn84 / 测试 harness） |

### A.1 内容

四个文件：`serverName.ts`（两个常量）· `dev.ts`（DEV space）· `test.ts`（三个测试 space）· `index.ts`。

```ts
// serverName.ts —— 全部内容
export const SERVER_NAME_MOCK_TERMINAL_PLATFORM = 'mock-terminal-platform'
export const SERVER_NAME_DUAL_TOPOLOGY_HOST_V3 = 'dual-topology-host-v3'
```

`dev.ts` 的 `kernelBaseDevServerConfig` 给 `mock-terminal-platform` 配三个候选地址：

```
lan       http://192.168.0.172:5810   timeoutMs 3000
local     http://127.0.0.1:5810       timeoutMs 3000
localhost http://localhost:5810       timeoutMs 3000
```

`test.ts` 另有三个测试 space：`kernel-base-test` · `kernel-base-http-retry-test` ·
`kernel-base-http-replacement-test`，服务器名如 `kernel-base-http-failover-test`，
地址是 `http://primary.local` / `http://secondary.local` 这类不可达域名 ——
**专门用来测"第一个地址失败后切第二个"**。

### A.2 优点

1. **"服务器名 → 多地址候选"的配置形态本身是对的**，
   多地址故障切换（`KEEP-12`）需要一个地方声明候选，这就是那个地方。
2. **space 概念**（一组服务器配置命名成一个空间，可整体切换）让 dev/test/未来 prod 分开。
3. **测试 space 用不可达域名构造失败**，比 mock 掉 transport 更真实。
4. **只有 171 行，零逻辑**，纯数据 + 类型。

### A.3 缺点 / 风险

1. **开发机 LAN IP 硬编码进 kernel 源码**（`http://192.168.0.172:5810`）。
   换网络就要改 kernel 包并重新出包（`FIX-12`）。
2. **服务器名字面量是 `'mock-terminal-platform'`** —— 一个 dev 期产物的名字
   成为 kernel 包对外的稳定标识，且被 `tcp-control` / `tdp-sync` 直接引用（`k-09` §6.2）。
   而 `tcp-control` 的 README 明确写着"不直接绑定 mock-terminal-platform"。
3. **地址是环境策略，不是 kernel 事实**，放在 kernel 层与"assembly 拥有产品/环境策略"的分工相悖。
4. **测试配置与 DEV 配置同包同层导出**，产品构建会把 `test.ts` 一并带进去
   （`index.ts` 里 `export * from './test'`）。

### A.4 TER 优化方向

| # | 动作 |
|---|---|
| 1 | **取消这个包**。`TransportServerConfig` 的**类型**本来就在 `contracts`，**地址值**由 assembly 作为产品/环境配置注入 |
| 2 | 服务器名从常量改为**模块输入**：endpoint 工厂接收 serverName，由装配方传 |
| 3 | 测试用的 space 迁进 `test-support`，不进产品导出面 |
| 4 | 多地址候选的**形态**保留（这是对的），只是换个住址 |

---

## B · `1-kernel/test-support`

| 字段 | 值 |
|---|---|
| 路径 | `1-kernel/test-support` |
| 规模 | **2 个文件**，非 npm 包（无 `package.json`，直接相对路径 import） |
| 内容 | `storageHarness.ts` · `serverConfig.ts` |

### B.1 `storageHarness.ts`

两个工厂：

- **`createMemoryStorage()`** —— 内存 KV，实现了 `StateStoragePort` 的**全部**方法
  （含可选的 `multiGet` / `multiSet` / `multiRemove` / `getAllKeys`），
  并额外暴露内部 `saved: Map`，让测试可以直接断言"哪些 key 被写了、写了什么"；
- **`createFileStorage(filePath)`** —— 文件型 KV（JSON 文件），
  用于 `full / seed / verify` 三阶段**真重启验证**：
  第一个子进程写盘，第二个全新子进程从同一个文件恢复。

方法论文档 `kernel-core-dev-methodology.md` §2.4 把它列为"本次已经验证可复用的最小实现"。

### B.2 `serverConfig.ts`

**14 行，只是 re-export**：

```ts
export const resolveTransportServers = (config, options = {}) =>
    resolveKernelTransportServers(config, options)
```

一个零增值的转发层。

### B.3 优点

1. **`createMemoryStorage` 暴露内部 Map**，让测试能断言"不该持久化的确实没持久化" ——
   这正是方法论文档 §2.5 要求的"断言两侧"。
2. **`createFileStorage` 让跨进程重启验证成为可能**，
   而不是在同一个 Node 进程里重建 store 冒充重启。这是 POC 测试体系里最关键的一块。
3. **实现了端口的全部可选方法**，所以测试路径与生产路径走同样的分支
   （生产 MMKV 有 `multiSet`，内存实现也有 ⇒ 测试覆盖到的是同一条代码路径）。

### B.4 缺点 / 风险

1. **不是 npm 包**：无 `package.json`，消费者靠相对路径 `../../test-support/...` import。
   ⇒ 依赖图上看不见它，依赖门也管不到它。
2. **`serverConfig.ts` 是零增值转发**，多一层没有意义的间接。
3. **只有 storage 一类 harness。** 方法论文档 §六自己写了：
   > 当前方法论已经稳定，但代码层面还可以继续抽象一个真正通用的 `shared-dev` harness，
   > 统一提供 phase 管理、child process 启动、stdout JSON 摘要解析、storage 文件清理与快照读取、通用断言辅助。

   **这个抽象没有做**，于是 `tdp-sync` 与 `ui-runtime-v2` 各写了一份结构相似的
   `test/helpers/liveHarness.ts`（分别 317 行与若干行）。
4. **UI 侧另有 `2-ui/2.1-base/test-support`（1,177 行，是 npm 包）** ——
   两个 test-support 命名相同、形态不同（一个是散文件、一个是包）。

### B.5 TER 优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **做成正式包** `kernel/base/test-support`，devDependency 引入 | 让它进依赖图、受依赖门管辖（§B.4.1） |
| 2 | **第一天就建共享 live-harness**：phase 管理 / 子进程启动 / stdout JSON 摘要 / storage 清理与快照 / 通用断言 | 方法论文档自己提出但没做；每包一份 harness 是 `KEEP-02` 的反面（§B.4.3） |
| 3 | **`createMemoryStorage` 暴露内部 Map 的做法整体继承** | "断言不该持久化的确实没持久化"是持久化测试的必需能力 |
| 4 | **`createFileStorage` + 三阶段真重启整体继承** | TER 的"崩溃恢复原状"必须这样验，不能同进程重建 store |
| 5 | **删掉零增值的 `serverConfig.ts` 转发** | §B.4.2 |
| 6 | kernel 侧与 UI 侧的 test-support **保持两个包**（kernel 侧必须 React-free），但**形态统一** | 见 `k-06` 的同一理由 |

## C · 证据档位

`已亲验`：两处的全部文件（`serverName.ts` / `dev.ts` / `test.ts` 前 30 行 /
`storageHarness.ts` 前 60 行 / `serverConfig.ts` 全文）；
被依赖数由全仓 `rg` 统计；方法论文档 §2.4 与 §六原文。
`推论`：§B.4.3 的"因为没做共享 harness 所以各包自建"——两份 liveHarness 的存在是事实，
因果为推论。
