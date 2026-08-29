# `@next/ui-base-admin-console`

| 字段 | 值 |
|---|---|
| **TER 批次** | **拆两半（已定拆线）** —— 业务无关的 ~3,300 行 → `ui/base/admin-shell`，**批 F · F7c**；协议半边 ~2,800 行 → `ui/feature/admin-terminal-ops`，**批 D**。逐 section 依据见 `00-ter-build-order` §4B.4 |
| 路径 | `2-ui/2.1-base/admin-console` |
| 规模 | src **7,328 行 / 33 文件**（**全仓单包最大**）；test 2,612；test-expo 314 |
| 依赖 | 8 个（`runtime-shell-v2` · `tcp-control` · `tdp-sync` · `topology-v3` · `ui-runtime-v2` · `workflow-v2` · `runtime-react` · `input-runtime`） |
| 被依赖 | 2（`host-runtime-rn84` · `catering-shell`） |
| 状态 | 活跃；**终端侧运维控制台，能力强、体量大** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**装在终端里的运维后台。** 现场工程师在真机上多击唤起、输入动态密码进入，
用来查设备、调连接器、看 TDP 数据面、控拓扑、管版本、导日志、跑适配器自检。

这不是给收银员用的界面，是给**现场排障**用的 —— 门店没有开发者、没有 logcat，
这个面板就是唯一的现场诊断入口。

## 2 · 九个 section

`supports/adminSectionRegistry.tsx` 里声明式注册：

| tab | group | 标题 | 行数 | 后端 |
|---|---|---|---|---|
| `device` | runtime | 设备与宿主 | 263 | `AdminDeviceHost` |
| `connector` | adapter | 连接器调试 | 183 | `AdminConnectorHost` |
| `terminal` | runtime | 终端管理 | 248 | runtime + store |
| **`tdp`** | runtime | TDP 数据平面 | **1,114** | `AdminTdpHost` |
| `topology` | runtime | 实例与拓扑 | 667 | `AdminTopologyHost` |
| `version` | runtime | 版本管理 | 538 | `AdminVersionHost` |
| `control` | runtime | 应用控制 | 240 | `AdminAppControlHost` |
| `logs` | runtime | 日志 | 250 | `AdminLogHost` |
| `adapter` | adapter | 适配器测试 | 206 | diagnostics registry |

每个 section 一个显式 `Admin*Host` 接口 —— 这是分层标准里
"Host Operations Use Host Interfaces"那条规则的落地。

## 3 · 三个支撑机制

### 3.1 section 注册表可替换

```ts
sharedAdminConsoleSectionRegistry —— 模块级单例
installAdminConsoleSections(sections)   // assembly 可整体替换
resetAdminConsoleSections()
```

产品可以增删 section，而不用改这个包。

### 3.2 host tools 按 nodeId 作用域

```ts
const scopedHostTools = new Map<localNodeId, AdminHostTools>()
adminHostToolsResolver.get(localNodeId) / install(...) / reset(...)
```

比纯全局好一档（主副屏各有自己的 host tools），但仍是**模块级可变全局**。
`layered-runtime-communication-standard.md` 的 Priority B 就点了这一条：
> actor 还是伸手到全局 host-tools registry，然后 dispatch topology runtime 命令。

### 3.3 动态密码：`deviceId + 小时` 派生，容忍 ±1 小时

```ts
deriveFor(date, deviceId) = deriveNumericTail(`${deviceId}${formatHour(date)}`)
verify(password) = [-1, 0, 1].some(offset => deriveFor(now + offset 小时, deviceId) === password)
```

现场工程师用同样的算法从设备号算出当小时的口令。
**±1 小时容忍**处理了设备时钟偏差与跨小时输入。

## 4 · 优点

1. **"现场可诊断"这件事被当成一等能力做了。**
   九个 section 覆盖设备/连接器/数据面/拓扑/版本/控制/日志/自检 ——
   门店真实故障的绝大部分入口都在这里。这是很多 POS 项目缺的。
2. **每个 section 一个显式 host 接口**，UI 不直接碰 TurboModule（§2）。
3. **section 注册表可整体替换**，产品差异不改基础包（§3.1）。
4. **动态密码用 deviceId + 时间派生**，无需下发/存储任何密钥，
   ±1 小时容忍考虑了真实时钟偏差（§3.3）。
5. **host tools 按 nodeId 作用域**，主副屏不串（§3.2）。
6. **`AdminSectionPrimitives.tsx` 687 行统一控件**，且在 primitive 层做 `semanticId: testID`
   自动注册 —— 这是 `FIX-08` 的正确做法，只是没铺到别处。
7. **2,612 行测试 + 314 行 test-expo**，且 test-expo 覆盖了真实的
   "多击唤起 → 动态密码登录 → tab 切换 → 各 section" 全流程。

## 5 · 缺点 / 风险

### 5.1 体量与单文件

- 包 **7,328 行**，全仓最大；
- `AdminTdpSection.tsx` **1,114 行**、`AdminPopup.tsx` 691、`AdminSectionPrimitives.tsx` 687、
  `AdminTopologySection.tsx` 667、`AdminVersionSection.tsx` 538。

`AdminTdpSection` 一个文件承担 TDP 数据面的全部诊断视图，
体量已经超过多数 kernel 包。

### 5.2 UI 直接编排 host + runtime 命令

`layered-runtime-communication-standard.md` Priority B 第 1 条点名：
> `AdminTopologySection.tsx`：UI 直接在按钮 handler 里同时调 runtime 命令和 topology host 方法，
> 包括混在一起的 clear-master 逻辑。目标形态是 UI 只 dispatch admin 命令，由 admin actor 协调。

本包只有 **1 个 actor**（`topologyAdminActor.ts` 248 行），
而九个 section 的动作大多仍在组件 handler 里。**"UI 只渲染 + 发命令"这条在这个包里守得最松。**

### 5.3 动态密码是"防误入"，不是安全控制

派生算法完整存在于发布包里，任何人拿到 App 都能为自己的设备算出口令。
而这个面板能：重启 App、清数据缓存、改拓扑、触发版本回滚、导出日志。

⇒ **它是一道防止收银员误入的门槛，不是一道安全边界。**
POC 阶段完全合理；产品阶段需要显式裁决（是否需要服务端挑战/一次性码/角色校验）。

### 5.4 依赖 8 个包，含 `workflow-runtime-v2`

`workflow` 的唯一生产消费点就在这里（扫码导入拓扑配对，`FIX-18`）。
一个运维面板成为 kernel 引擎的唯一消费者，是耦合方向上的异常信号。

### 5.5 模块级可变单例两处

section registry 与 host tools resolver 都是模块级 `let` / `Map`。
`resetAdminConsoleSections()` / `reset(undefined)` 是公开导出的清空入口。

## 6 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **能力整体继承**：现场诊断面板对门店 POS 是刚需，不是可选项 | §4.1 |
| 2 | **按 section 拆包或拆目录**，每个 section 一个独立单元（含自己的 host 接口与测试） | 7,328 行单包、1,114 行单文件（§5.1） |
| 3 | **section 的动作统一走 admin command + actor**，UI 只 dispatch | 分层标准 Priority B 至今未闭（§5.2） |
| 4 | **`AdminSectionPrimitives` 的 `semanticId: testID` 自动注册下沉到 NativeWind + RNR primitive 层** | 一次解决 `FIX-08` |
| 5 | **动态密码机制保留**，但**权限模型需 Dexter 裁决**：是否要服务端挑战、是否分级（只读诊断 vs 危险操作） | §5.3 是产品判断不是技术判断 |
| 6 | **危险动作（重启/清数据/回滚/改拓扑）单独二次确认 + 审计留痕** | 当前与只读诊断同一道门 |
| 7 | **两处模块级单例改为 runtime 作用域** | §5.5，与 `u-01` §6.3 同一形态 |
| 8 | **section 注册表的可替换性保留** | 产品差异不改基础包（§3.1） |
| 9 | 若 TER 不采纳 workflow 引擎（`FIX-18`），**扫码改走 scanner 能力端口** | §5.4 |

## 7 · 证据档位

`已亲验`：`supports/adminSectionRegistry.tsx` 全文、`supports/adminHostToolsRegistry.ts` 全文、
`supports/adminPasswordVerifier.ts` 的 `verify`/`deriveFor` 实现、`types/admin.ts` 的接口清单、
全部文件行数、`package.json` 依赖、被依赖穷举、`layered-runtime-communication-standard.md` Priority B 原文。
`推论`：§5.3 的"派生算法在发布包里所以可被复算"—— 逻辑推导，未做逆向验证。
**未逐行读**：九个 section 组件的完整实现（合计约 3,700 行）、`AdminPopup.tsx` 691 行、
`adminHostToolsFactory.ts` 505 行。
