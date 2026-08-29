# TER 建设顺序 · 地基优先（Dexter 2026-08-28 裁定）

> **裁定原文**：TER 的建设顺序先把**业务无关**的内容按依赖关系建设，
> 像 TCP、TDP、权益之类的先不创建。把底座建立好，后面才会更稳。

本文是这条裁定落到 POC 35 个包上的结果：**哪些进地基批、什么顺序、怎么验收**。
逐包详析见同目录下各包文档；POC 好坏台账见
`../2026-08-27-v2s-terminal-poc-findings-ledger-claude.md`。

---

## 1 · 先说一个必须先解决的前提：声明的依赖图是不可信的

按依赖关系建设，前提是**知道真实的依赖关系**。POC 的 `package.json` 不是。

**实测（穷举 33 个有 `src/` 的包，比对 `package.json` 的 `dependencies` 与 `src/` 下真实 `@next/*` import）**：

**8 个包（24%）存在源码 import 了但未声明的工作区依赖：**

| 包 | 缺声明的依赖 |
|---|---|
| `topology-runtime-v3` | `platform-ports` · `runtime-shell-v2` · `state-runtime` · `transport-runtime`（**声明只有 `contracts` 一个，实际用 5 个**） |
| `admin-console` | `contracts` · `runtime-shell-v2` · `transport-runtime` · `ui-runtime-v2` |
| `tdp-sync-runtime-v2` | `platform-ports` · `terminal-log-upload-runtime-v2` |
| `workflow-runtime-v2` | `platform-ports` |
| `runtime-react` | `state-runtime` |
| `terminal-console` | `ui-runtime-v2` |
| `catering-master-data-workbench` | `topology-runtime-v3` |
| `catering-shell` | `state-runtime` |

**另有 9 个包声明了 `src/` 并不使用的依赖**（部分是 test-only，部分是冗余）：
`execution-runtime` · `terminal-log-upload-runtime-v2` · `ui-runtime-v2` · `input-runtime` ·
`runtime-react` · `terminal-console` · `automation-runtime` · `catering-shell` · `assembly`。

**为什么会这样**：Yarn 的 node_modules linker 会 hoist，**未声明的包在运行期照样 import 得到**
（台账 `CON-03`）。于是没有任何东西会让作者发现漏了声明。

**对 TER 的直接后果（两条，都必须在第一个包之前定）**

1. **建设顺序必须按真实 import 推导，不能按 `package.json` 抄**——本文的分层就是按真实 import 算的；
2. **依赖门必须有两条断言**，只有第一条会变成纸糊的门：
   - (a) 声明的依赖不违反层级方向；
   - (b) **源码里每一个 `@ter/*` import 在本包 `package.json` 里都有对应声明**。
   红夹具：给 `kernel/base/<x>` 加一条对 `ui/base/<y>` 的依赖 → 门必须红；
   在 `kernel/base/<x>` 源码里 import 一个未声明的 `@ter/*` → 门也必须红。
   **反例栏**：deep import（`@ter/pkg/src/internal/...`）两条都抓不到，需靠包的 `exports` 字段收口。

---

## 2 · 三个批次

> 🔴 **`SUPERSEDED_BY_DEXTER_2026_08_29`（本节的批次归属与完成标准部分）**
>
> 下表成文于 2026-08-28。之后 Dexter 有两处裁决改变了它，**以新裁决为准**：
>
> 1. **`workflow` 属于地基批，不是批 D。** 引擎不含业务语义，业务是它执行的定义。
>    推迟的只有它**唯一**依赖 `tdp-sync` 的那条边（`workflowRemoteDefinitionActor`
>    与 `moduleManifest` 的 TDP 声明）。因此地基批是 **22 个包**，不是本表的 15 项。
> 2. **地基批内部再分两批交付**：批 1 纵切片 14 个（覆盖全部结构性未知），
>    验收通过后才建批 2 的 8 个（已验证形态的复制）。
>
> **当前有效的批次划分与包清单**见
> `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md` 的 §6.2 与 §11，
> 以及 routed memory `decisions.terminal-build-order-and-batches`。
> 本节以下内容保留作为 2026-08-28 的分析记录，**不再是权威批次划分**。

### 批 F · 地基批（业务无关，现在建）

| # | TER 包（建议名） | POC 对应 | src 行 | 说明 |
|---|---|---|---|---|
| F0 | `contracts` | `kb.contracts` | 760 | 零依赖共享语言 |
| F1a | `platform-ports` | `kb.platform-ports` | 482 | 平台能力端口 |
| ~~F1b~~ | ~~`definition-registry`~~ | ~~`kb.definition-registry`~~ | — | **已取消**（Dexter 2026-08-28）：动态 catalog 不做了，整包不再成立，职责四分。见 §4B.8 |
| F2 | `state` | `kb.state-runtime` | 1,617 | Redux + 声明式持久化 + 同步语义 |
| F3 | `runtime` | `kb.runtime-shell-v2` | 2,501 | 模块装配 + 广播 command/actor + request ledger |
| F4a | `transport` | `kb.transport-runtime` | 2,344 | HTTP 多地址 failover + socket 生命周期（**机制**，与协议无关） |
| F4b | `display-context` | `kb.topology-runtime-v3` 的**上下文半边** | ~600 | 见 §3 拆分 |
| F5 | `ui-state` | `kb.ui-runtime-v2` | 1,273 | screen/overlay/uiVariable 的 kernel 状态协议 |
| F6 | `ui-render` | `ub.runtime-react` | 2,547 | RN 渲染桥（**需重构，见包文档**） |
| F7a | `automation` | `ub.automation-runtime` | 1,685 | 运行时控制面（自研，Dexter 已裁） |
| F7b | `ui-input` | `ub.input-runtime` | 1,154 | 虚拟键盘 / PIN / 数字输入 |
| F8 | `adapter/android/*` | `adapter-android-v2` 的对应能力 | Kotlin | 逐能力 expo-module |
| F9a | `test-support`（kernel 侧） | `1-kernel/test-support` | 2 文件 | 必须 React-free |
| F9b | `test-support`（ui 侧） | `ub.test-support` | 1,177 | **需与 tcp 解耦后才能进地基批** |
| F10 | `assembly/android` | `assembly` + `host-runtime-rn84` 的宿主半边 | — | 薄壳；`host-runtime-rn84` 现依赖 18 个包，TER 必须只依赖地基批重建 |

**地基批合计约 15K 行 TS + Kotlin adapter**，占 POC 全部 src 的约 26%。

### 批 D · 延后（等服务端 / 等业务 / 等裁决）

| 包 | 延后理由 |
|---|---|
| `tcp-control-runtime-v2`（1,747） | 编码的是 POC 与 mock-terminal-platform 共同设计的**协议**；v2s 的 `catering-business-server` 会定自己的 |
| `tdp-sync-runtime-v2`（6,903） | 同上；`terminal-data-server` 当前是空占位 |
| `terminal-log-upload-runtime-v2`（315） | 需要服务端上传端点 |
| `topology-runtime-v3` 的**链路半边** | 需要 host 对手方；且本机双屏改一个 store 后本机不需要链路 |
| `workflow-runtime-v2`（3,823） | 能力是否采纳待 Dexter 裁（台账 `FIX-18`） |
| `benefit-types / -calculation / -session`（4,972） | 业务；且当前全仓零引用 |
| `organization-iam / catering-product / catering-store-operating -master-data`（3,049） | 业务主数据，依赖 TDP |
| `terminal-console`（1,436） | 激活 UI，绑 `tcp-control` |
| `admin-console` 的**协议半边**（~2,800） | terminal/tdp/topology/version 四个 section + `topologyAdminActor`。**业务无关的另一半（~3,300）已划入批 F**，拆线见 §4B.4 |
| `catering-master-data-workbench`（817） | 业务 UI |
| `catering-shell`（1,025） | **餐饮业务**的 integration 包。⚠️ 但 integration **这一层**本身属地基批：它是**真实的 UI 与业务整合层**（**不是测试包**，见 §4B.0），只是被要求必须能在 Expo Web 上跑。地基批需自建一个 integration 包作为该层样板，见 §6 |
| hot-update 相关 | 需服务端 + `expo-updates` 采纳裁决 |

**判别式（本批的准入规则）**：**这个包编码的是「机制」还是「协议/业务」？**
机制可以先做（`transport` 的多地址 failover 与谁在对面无关）；
协议必须等对手方（TDP 的消息类型取决于服务端）。

### 批 N · 不建

| 包 | 理由 |
|---|---|
| `execution-runtime`（488） | 与 `runtime-shell-v2` 是**两套 command 语义**，后者已胜出。TER 只应有一种。其 middleware 链与错误归一化**吸收进 runtime 包**，不单建（见包文档） |
| `host-runtime`（1,986） | TS 版 topology host 内核。它的既定消费者 `dual-topology-host-v3` 实测**零 `@next/*` 依赖**、自己另写了一套——设计承诺的复用没发生。TER 只有在决定"端内自跑 topology host"时才需要 |
| `server-config-v2`（171） | **取消这个概念**：类型/形状本来就在 `contracts`，具体地址值归 assembly 作为产品/环境配置注入。顺带修掉硬编码 LAN IP（台账 `FIX-12`） |
| `hot-update-runtime-bridge` | POC 里是**空目录**（0 文件），只在 `2-ui/2.1-base/README.md` 的包表里存在 |

---

## 3 · `topology-runtime-v3` 必须拆两半（这条决定 F4b 能否进地基批）

**实测**：整包 38 个文件里，**只有 3 个**触及 `transport-runtime`：
`foundations/connectionController.ts` · `foundations/protocol.ts` · `types/runtime.ts`（仅类型）。
其余全部与传输无关。所以拆分是干净的：

| 半边 | 内容 | 批次 |
|---|---|---|
| **上下文**（`display-context`） | `runtimeDerivation`（由 `displayIndex/displayCount` + config 推 `instanceMode/displayMode/workspace/standalone`）· `eligibility` · `configState`/`contextState` · `selectors` · `powerDisplaySwitch` · `stateKeys` | **F4b 地基批** |
| **链路**（`peer-link`） | `connectionController` · `protocol` · `pairLinkController` · `connectionState`/`peerState`/`syncState`/`requestMirrorState`/`hostState` · `connectionActor`/`hostLifecycleActor` · `syncRegistry` | **批 D** |

**为什么上下文必须进地基批**：`ui-state`（F5）依赖它——但只依赖**两个 selector**：
`selectTopologyWorkspace` 与 `selectTopologyDisplayMode`（实测 4 个 import 点，`runtime-react` 对 topology 零 import）。
这就是"scope 轴"这件事，与主副机链路无关。

---

## 4 · ⚠️【已推翻】"一个 store 两个 surface 会撞上 workspace 全局读法"——判错了

> **2026-08-28 更正。** 本节原判"两块屏会写进同一份 scoped slice、互相覆盖"，**是错的**。
> Dexter 补充 `Q-04` 的跨机拓扑说明后我重新核对源码，发现自己把 workspace 这个轴的语义读反了。
> 原判保留在 §4.3 作为失败留痕。

### 4.1 事实：两块屏根本不靠 workspace 区分

| 状态 | 两块屏怎么区分 | 证据 |
|---|---|---|
| **screen** | 靠 **`containerKey`** —— `primaryRootContainer` / `secondaryRootContainer`，由调用方随命令传入 | `runtime-react/src/foundations/uiVariables.ts`；`UiRuntimeRootShell.tsx:40-41` 按 `display` 选容器；`screenState.setScreen` 的 payload 带 `containerKey`，slice 是 `Record<containerKey, …>` |
| **overlay** | 靠**同一个 slice 内的两个字段** `primaryOverlays` / `secondaryOverlays`，由 **`displayMode` 随命令 payload 传入** | `overlayState.ts`：`openOverlay(state, action: PayloadAction<{displayMode: string; overlay}>)`，内部 `getListEnvelope(state, displayMode)` |

⇒ **两块屏的状态本来就该写进同一份 workspace slice，只是不同的 key / 不同的字段。**
`displayMode` 已经是"随命令传入"，`containerKey` 已经是"按容器索引" ——
**POC 在这两处都做对了，不需要改。**

### 4.2 那 workspace 轴到底是什么

`deriveTopologyV3Workspace`：`instanceMode === 'SLAVE' && displayMode === 'PRIMARY' → 'BRANCH'`，否则 `'MAIN'`。

配合同步方向 `syncIntent: {main: 'master-to-slave', branch: 'slave-to-master'}`：

| workspace | 语义 | 权威方 |
|---|---|---|
| `MAIN` | 设备**跟随主机工作**（自己是主机，或作为副屏镜像主机） | 主机 |
| `BRANCH` | 设备**脱离主机独立工作** | 该设备自己 |

**它区分的是"这台设备当前处于哪种工作上下文"，不是"哪一块屏"。**

而 `BRANCH` 存在的理由，正是 Dexter 在 `Q-04` 里说的那个场景 ——
**副屏（一般是平板）可以拿下来，当成主屏独立使用**（见 §4B.11）。
POC 的 workspace 轴就是为它设计的。

**所以在"一个 VM、一个 store、两块屏"下**：
一台设备只有一个 `instanceMode` / `displayMode` / `workspace`（**设备级事实**），两块屏共享它。
`getWorkspaceDispatcher` 从全局 state 读 workspace **是正确的，不是缺陷**。

### 4.3 我错在哪（失败留痕）

**原判**：看到 `screenRuntimeActor.ts:19-27` 里
`normalizeUiRuntimeWorkspace(selectTopologyWorkspace(context.getState()))` 是**全局读**，
就推断"workspace 是用来区分两块屏的，因此两块屏会读到同一个值而互相覆盖"。

**错在**：我从**机制形态**（全局读）直接推出了**语义结论**（这个轴代表屏幕），
**没有去核对这个轴到底代表什么**。核对的成本只是打开 `overlayState.ts` 看一眼
——它的主副是字段而非 workspace，一眼就能推翻我的假设。

⚠️ **这是同一类错误的第二次**。第一次是台账 `FIX-05`：
我看到 `local.updatedAt < incoming.updatedAt` 就断言"墙钟 LWW、快的机器永远赢"，
实际是 **per-slice 静态 authority**，`updatedAt` 只作变化检测。

**共同模式**：*看到一个机械形态（全局读 / 时间戳比较），就推断出一个语义结论，
而没有去核对那个轴/那个字段到底代表什么。*
两次都发生在"这个字段名看起来像我熟悉的某个概念"的地方。

**给 TER 的可复用防法**（建议进 review checklist）：
> 凡要对**某个轴、某个维度、某个 scope** 下语义结论，
> 必须先找到**它的取值是怎么派生的**（`derive*` 函数）
> 和**至少两个使用它的地方**，确认两处解释一致。
> 只看一处使用点就下结论，等于按名字猜语义。

### 4.4 §4 还剩下的真实结论

只有一条，而且是正面的：

> **`displayMode` 与 `containerKey` 必须随命令/容器传入，不得从全局 state 读。**
> POC 已经这样做了（overlay 的 `displayMode` 在 payload 里，screen 的 `containerKey` 在 definition 里）。
> **TER 保持即可，这是 `TR-01`（reducer 只能 actor 调用）之外，
> 另一条让"一个 store 多 surface"成立的关键形状。**

反过来说：若将来有人把 `displayMode` 改成从全局读（"反正设备只有一个 displayMode"），
两块屏的 overlay 就会串。**这条值得写进 TER 编码规范，带上这个反例。**

## 4B · Dexter 2026-08-28 补充裁定（含两条推翻 Claude 原判的）

> **补充原文（第一次）**：`2-ui/2.3-integration` 是**业务整合包**，
> 专门用于在 web 下测试业务逻辑功能，所以它本身必须能在 Expo Web 下跑；
> 需要 adapter 能力时，虽然没有真实终端能力，但**不影响业务本身运行**，
> **业务运行上应该是完整有效的**。`server-config-v2` 概念取消没问题，但内容不止在 assembly。
> admin-console 里有业务相关也有业务无关的内容，**底座需要业务无关的部分**。
> **底座建好之后，四个层都有内容，在安卓端能够完整运行。**
>
> **补充原文（第二次，纠正 Claude）**：
> ① **integration 不是为了测试**，他是**真实的 UI 和业务整合层**，只是他必须要能够在 web 上运行测试。
> ② **不能有 `adapter/web`**：一是 **integration 不能依赖 adapter**；二是 **`adapter/web` 根本不能等同于 `adapter/electron`**。
> 一版 POC 里适配器**声明的时候就带了一个默认的实现** —— 业务代码从**适配器注册器**取得实现
> `ILogger` 接口的实例并调用它；注册器里有人注册过就返回注册的实例，没人注册就返回**默认实例**，
> 该默认实例的 `log` 调用 `console.log`，**不额外依赖其他包**。
> "KV 用 webstorage"只是举例、可能不准确：**如果提供这个默认实现会引入其他依赖，这个地方就不应该用它**。
> 因为 **integration 在 web 上测试是个很便宜的方案**，让用户能在 web 上就发现业务问题，
> **并不代表真机所有能力**。

### 4B.0 两条被推翻的原判（记录在案）

| # | Claude 原判 | 事实 / 裁定 |
|---|---|---|
| 1 | 把 `2-ui/2.3-integration` 读成"产品 shell / 测试面" | **错。** 它是**真实的 UI 与业务整合层**。"能在 web 上跑"是加在它身上的**约束**，不是它的用途 |
| 2 | 提议新增 `adapter/web` 作为第四适配目标 | **错，且是分层错误。** integration 属 `ui` 层，**依赖 adapter 是反向依赖**；且 web 与 electron 不能等同。正确解法是端口自带默认实现，见 4B.1 |

### 4B.1 【正解】端口注册器 + 默认实例（取代我上一版的"三态 + fail-fast"）

**一版 POC 已经解决过这个问题，形状是：**

```text
业务代码 ──> 适配器注册器.取(ILogger) ──> 有人注册过？ ── 是 ──> 返回注册的实例
                                              └─ 否 ──> 返回【默认实例】（console.log，零额外依赖）
```

**关键推论：`PlatformPorts` 不该有可选字段。**

POC 现状是 12 个字段里 10 个可选（台账 `FIX-04`），于是每个调用点写
`ports.device?.getDeviceId()`，并**在每一处**决定"没有时怎么办"。
按注册器模型，**端口永远存在**，变的只是绑定了哪个实现：

| 绑定 | 何时 |
|---|---|
| **注册实现** | adapter 注册过（真机） |
| **默认实现** | 没人注册（Expo Web、单测、任何未接 adapter 的宿主） |

于是：

- `ports.logger.info(...)` —— 永远可调，永远类型正确，不需要 `?.`；
- `ports.scanner.scan(...)` —— 永远可调，Web 上返回 typed **"能力不可用"**，不是 `undefined`、不是抛异常；
- **`FIX-04` 的"降级散落在每个调用点"随之消失** —— 降级只在端口声明处发生一次。

**默认实现分两类：**

| 类别 | 语义 | 例 |
|---|---|---|
| **可用默认** | 零额外依赖就能真干活 | `logger` → `console.log`；KV → 进程内 Map |
| **不可用默认** | 明确返回 typed `CAPABILITY_UNAVAILABLE`，业务据此走自己的分支 | 摄像头扫码、打印/HID、热更新、topology host、安全存储 |

**硬约束（Dexter 明示）：默认实现必须零额外依赖。**
"如果提供这个默认实现会引入其他依赖，这个地方就不应该用它"——
所以 KV 的默认不必是 webstorage，进程内 Map 更符合这条；
凡是要额外拉包才能实现的默认，一律改成"不可用默认"。

**与既有 finding 的关系**：这条同时收掉三个 ——
`FIX-04`（可选端口降级散落）· `FIX-20`（未知 step 静默报成功）·
后台规范 2-B（"什么都没做"的路径不得返回成功）。三者的修法是同一个：
**"没做成"必须产生可区分、有类型的结果。**

⚠️ 我上一版写的"`required` 缺失就装配期 fail closed"**基本用不上了** ——
端口永远有实现，不存在"缺失"。只有一种例外值得保留：
某个模块明确声明"我必须要真实的 X 能力才有意义"（例如热更新模块在无 `hotUpdate` 实现时毫无意义），
那是**模块自己**的准入判断，可在 install 时读端口的 `isDefault` 标志后决定拒绝安装 —— 
而不是端口层的强制。

### 4B.2 【取消】不新增 `adapter/web`

上一版本文提议的 `adapter/web` **已删除**，理由是 Dexter 指出的两条：

1. **分层错误**：integration 在 `ui` 层，adapter 在其下方的另一层，
   `ui → adapter` 是反向依赖，本来就不允许（`spec/layered-runtime-communication-standard.md` 的层契约）；
2. **web ≠ electron**：Electron 有主进程、文件系统、原生模块，
   把 web 当作 electron 的公共底会把两者的能力面强行拉平。

**web 上的运行由"没人注册 ⇒ 默认实现"自然覆盖，不需要任何 adapter。**

**同时要守住的范围**（Dexter 明示，写成判别式）：

> **integration 在 web 上跑是个很便宜的方案，用来让人在 web 上就发现业务问题；
> 它不代表真机所有能力。**

⇒ **不要为了让 web 像真机而给默认实现加戏。**
摄像头就返回不可用，打印就返回不可用。
一旦开始在默认实现里模拟设备行为，web 面就会变成第二个需要维护的"假终端"，
而它给出的结论还不可信。

### 4B.3 【修正】server config 的值是 **启动层输入**，启动层不止一个

原建议"取消包、值归 assembly"**方向对但说窄了**。准确的形状：

- **形状/类型**：本来就在 `contracts`（`TransportServerConfig` 等），不动；
- **值**：由**启动层**提供，而启动层 **≥ 3 个**：
  1. `assembly/android`（产品/环境配置）
  2. `assembly/electron`（同上）
  3. **`ui/integration` 的 web 运行入口**（它自己就是一个启动层）
- **dev 地址册**（LAN / local / localhost 那组候选）是开发期便利，
  归 `test-support`（dev-only 依赖），**不进任何生产包** ——
  既让 web 入口跑得起来，又不会让开发机 IP 回到 kernel 里（台账 `FIX-12` 的根因）。

**判别式**：这个地址值会不会随部署环境变？会 ⇒ 它是启动层输入，不是包内常量。

### 4B.4 【落地】`admin-console` 的拆线（已亲验，拆得很干净）

实测每个 section 的跨包依赖：

| Section | 行数 | 跨包依赖 | 归属 |
|---|---|---|---|
| `AdminConnectorSection` | 183 | **零 `@next` 依赖** | 地基 |
| `AdminDeviceSection` | 263 | **零** | 地基 |
| `AdminLogsSection` | 250 | **零** | 地基 |
| `AdminControlSection` | 240 | `runtime-shell` | 地基 |
| `AdapterDiagnosticsScreen` | 206 | `runtime-shell` | 地基 |
| `AdminSectionPrimitives` | 687 | `runtime-react` | 地基（**共享控件层，含 `semanticId: testID` 自动注册**） |
| `AdminPopup` | 691 | `runtime-shell` · `input-runtime` · `runtime-react` | 地基 |
| `adminHostToolsFactory` | 505 | **仅 `platform-ports`** | 地基 |
| `adminSectionRegistry` | 112 | **零** | 地基 |
| `adminTabs` / `createModule` / 支撑 | ~300 | `runtime-shell` · `ui-runtime` · `runtime-react` | 地基 |
| `AdminTdpSection` | **1,114** | `tcp-control` · `tdp-sync` | 批 D |
| `AdminTopologySection` | 667 | `tcp-control` · `topology` | 批 D |
| `AdminVersionSection` | 538 | `tdp-sync` | 批 D |
| `AdminTerminalSection` | 248 | `tcp-control` | 批 D |
| `topologyAdminActor` | 248 | `topology` · `workflow` | 批 D |

`AdminHostTools` 本身**已经按 7 个 host 接口拆好了**，边界正好落在同一条线上：

- 地基：`AdminDeviceHost` · `AdminLogHost` · `AdminAppControlHost` · `AdminConnectorHost`
- 批 D：`AdminTopologyHost` · `AdminVersionHost` · `AdminTdpHost`

tab 分组也印证：`adapter` 组（连接器调试 + 适配器测试）**完全业务无关**；
`runtime` 组里 device/control/logs 业务无关，terminal/tdp/topology/version 绑协议。

**拆分结果**

| TER 包 | 内容 | 约行数 | 批次 |
|---|---|---|---|
| `ui/base/admin-shell` | registry + tabs + primitives + popup + hostToolsFactory + createModule + 5 个业务无关 section + 4 个业务无关 host 接口 | ~3,300 | **批 F** |
| `ui/feature/admin-terminal-ops` | terminal / tdp / topology / version 四个 section + `topologyAdminActor` + 3 个协议 host 接口 | ~2,800 | **批 D** |

**这一拆同时解决了地基批"没有真实 UI 可看"的问题** ——
`admin-shell` 的设备/日志/应用控制/连接器调试/适配器测试五个面，
本身就是一个在真机上可用、且完全业务无关的运维界面。

### 4B.5 【升级】地基批的完成标准

> 🔴 **`SUPERSEDED_BY_DEXTER_2026_08_29`**
>
> 本节写的是**能力验收**口径（装 APK、真机启动、双运行面、杀进程重启恢复原状、
> 业务逻辑完整走通）。2026-08-29 Dexter 把当前批次收窄为**只建骨架**：
> 骨架只证明结构接通，**不启真机、不启浏览器、不验证任何包的能力**。
>
> **当前有效的骨架完成标准**是三条检查（图比对 / 逐包 `tsc` / assembly `expo export`
> 且入口可达集合等于批次包集合），见
> `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md` 的 §9。
>
> 本节内容**仍是包级细化阶段的有效目标**，只是**不再是当前批次的完成标准**。

Dexter 的原话是最终判据：**"底座建好之后，四个层都有内容，在安卓端能够完整运行。"**

这比本文 §5 原来的六条单元判据强得多。完成标准因此升级为：

| 层 | 地基批必须有的内容 |
|---|---|
| `kernel` | contracts · platform-ports · state · runtime · transport · display-context · ui-state（**不含 `definition-registry`**，已取消，见 §4B.8） |
| `ui` | ui-render · automation · ui-input · **admin-shell**（真实运维界面）· **一个 integration 包** |
| `adapter` | **`android`**（真实 expo-module）。**不建 `adapter/web`** —— web 上由端口默认实现覆盖，见 §4B.1/§4B.2 |
| `assembly` | `android` 薄壳，能装出 APK 并在真机启动 |

**双运行面判据（两条都要过）**：

1. **Android 真机**：装上 APK → 启动 → 主副屏各自渲染 → 进 admin-shell →
   设备信息/日志/应用控制/连接器/适配器测试五个面**全部可用** → 杀进程重启 → **恢复原状**；
2. **Expo Web**：`ui/integration` 的 web 入口跑起来 → 同一套 runtime 与 UI →
   **没有任何 adapter 注册**，全部走端口默认实现 →
   可用默认（logger→console、KV→进程内）**真实生效**，
   不可用默认（扫码/打印/热更新）**返回 typed "能力不可用"而不是崩溃或 `undefined`** →
   **业务逻辑完整走通**。

第 2 条正是补充裁定里"业务运行上应该是完整有效的"这句话的可验收形态。

---

### 4B.6 `adapter/electron` 与 `assembly/electron`：建空目录，不阻塞（Dexter 2026-08-28 确认）

先把 Android 做完整再做 Electron；当下**只建空目录 + 一份 README 写明边界**，
形式与 v2s 对 `apps/backend/terminal-data-server` 的做法一致
（README 声明：本阶段不提供 runtime、能力实现、构建产物）。

**为什么这不构成阻塞**：按 §4B.1 的端口注册器 + 默认实例模型，
"没有 electron adapter"这件事本身就是一个**已定义的运行状态**——
端口绑默认实现，`ui/integration` 与全部 kernel/ui 包照常运行。
空目录只是给未来留位置，不是欠账。

⛔ 空目录里**不得**放"将来可能用得上"的代码。按 charter §2-A，
那是为想象中的未来付费；等真做 Electron 时按当时的真实需求写。

### 4B.7 目录结构与三重命名（Dexter 2026-08-28 要求）

> **要求原文**：TER 的包目录结构希望跟之前说的一样，**不要平铺**；
> 包的名字同意 Claude 的建议（禁版本号/框架名），但**最好也要有 `kernel.base.contract` 这样人读起来容易理解的写法**。

#### 三重标识必须互相可推导

POC 里其实**已经有**这个写法了，而且 29 个包里 **27 个天然符合**：

```
目录路径     kernel/base/contracts
moduleName   kernel.base.contracts          ← 目录路径用「.」连接
npm 包名     @catering-v2s/kernel-base-contracts   ← moduleName 用「-」连接 + scope
```

`moduleName` 在 POC 里是**命名空间真相源**：command key、actor key、slice key、
error key、parameter key、日志 scope 全部由它派生（`createModuleCommandFactory(moduleName)` 等）。
所以它不是装饰，是运行期真正在用的标识。

**实测的两个反例（说明这条约定没有机械保障）**：

| 包 | 目录 | npm 名 | moduleName | 问题 |
|---|---|---|---|---|
| `ui-automation-runtime` | `ui-automation-runtime` | `ui-base-automation-runtime` | `ui-base-automation-runtime` | **三者两两不一致**，且 moduleName **用连字符不用点**，全仓唯一 |
| `host-runtime-rn84` | `host-runtime-rn84` | `host-runtime-rn84` | `adapter.android.host-runtime-rn84` | npm 名缺 `adapter-android-` 前缀 |

**TER 动作**：三重标识由**目录路径唯一派生**，并做成机械门 ——
读每个包的目录路径、`package.json.name`、`src/moduleName.ts`，断言三者可互推。
红夹具：把任一包的 `moduleName` 改成不匹配的值，门必须红。
（成本极低：POC 27/29 已符合，只是没人守。）

#### 地基批的目录与命名（scope 沿用 v2s 的 `@catering-v2s`）

```text
apps/terminal/
  kernel/
    base/
      contracts/          kernel.base.contracts
      platform-ports/     kernel.base.platform-ports
      state/              kernel.base.state
      runtime/            kernel.base.runtime
      transport/          kernel.base.transport
      display-context/    kernel.base.display-context
      ui-state/           kernel.base.ui-state          ← 仍在 kernel：它是 React-free 的 UI 状态协议
      test-support/       kernel.base.test-support
    feature/                                            ← 地基批为空，批 D 才有内容
  ui/
    base/
      render/             ui.base.render
      automation/         ui.base.automation
      input/              ui.base.input
      admin-shell/        ui.base.admin-shell
      test-support/       ui.base.test-support
    feature/                                            ← 地基批为空
    integration/
      platform-console/   ui.integration.platform-console   ← 地基批的 integration 样板（§6）
  adapter/
    android/
      persist-kv/         adapter.android.persist-kv
      device/             adapter.android.device
      app-control/        adapter.android.app-control
      logger/             adapter.android.logger
      dual-screen/        adapter.android.dual-screen
      …                                                  ← 逐能力一个 expo-module
    electron/                                            ← 空目录 + README（§4B.6）
  assembly/
    android/              assembly.android
    electron/                                            ← 空目录 + README
```

⚠️ `ui-state` **留在 kernel** 而不是 ui：它是 screen/overlay/uiVariable 的**状态协议**，
POC 里就在 `1-kernel/1.1-base/ui-runtime-v2`，且严格 React-free。
真正的渲染在 `ui/base/render`。这条边界不要因为名字里有 "ui" 就挪。

### 4B.8 `definition-registry` 取消动态 catalog 后，整包不再成立（Dexter 2026-08-28 裁定 + Claude 建议）

> **裁定原文**：`definition-registry` 原定位于 error/parameter 定义与解析，
> **最主要的是从 store 中动态取值，但实际上意义不大**，后续不希望再从 store 中动态取值了，
> 就在各个包中自己定义就好了。它的作用是**让代码中不要散落各种数字和字符串，要统一管理**。

#### 去掉 catalog 之后还剩什么

逐项核对该包 356 行的实际职责：

| 职责 | 去掉动态 catalog 后 |
|---|---|
| `resolveParameter`：catalog → decode → validate → fallback | **坍缩成 `definition.defaultValue`**。整套 decode/validate/fallback 机制**存在的唯一理由**就是处理远端下发的 raw 值 |
| `resolveAppError`：catalog 模板 → 定义默认模板 → appError.message | **坍缩成 `renderErrorTemplate(definition.defaultTemplate, args)`** —— 而这个函数**已经在 `contracts`** 里 |
| `createKeyedDefinitionRegistry`：重复 key 检测 + 清单 | **只剩这一条**，约 55 行 |
| 定义工厂 `createModuleErrorFactory` / `createModuleParameterFactory` | **本来就在 `contracts`**，不在本包 |
| 类型 `ErrorDefinition` / `ParameterDefinition` / `AppError` | **本来就在 `contracts`** |

⇒ **约 200/356 行随 catalog 一起消失，剩下的 55 行不足以成包。**

#### 建议：整包取消，职责四分

| 原职责 | TER 落点 |
|---|---|
| 定义本身（各包的 error/parameter 常量） | **各包 `supports/errors.ts` / `supports/parameters.ts` 自己导出**（Dexter 的要求） |
| 工厂 + 模板渲染 | **`kernel.base.contracts`**，不动（本来就在那） |
| **key 唯一性 + 全集清单** | **静态门 + 生成的清单常量**，不是运行期注册表 |
| **按 key 反查 definition**（UI 拿到错误码要渲染文案） | **生成的清单常量** `Record<string, ErrorDefinition>`，普通对象访问 |

**为什么"生成清单"比"运行期注册表"好**：

1. 重复 key 在**门时间**发现，不是启动时；
2. 零运行期成本；
3. 清单是**闭集**，于是 UI 侧的错误码 → 文案映射**漏一个就是编译错误** ——
   这正好收掉台账 `FIX-16`（错误码目录无统一消费方），
   形态对齐 v2s 前端 `operationsProblemFeedback.ts` 那个正例（对生成的 problem code 闭集做全量文案覆盖）。

#### 这条裁定连带删掉的东西（都在延后批，是净简化）

- `runtime-shell-v2` 的 **2 个 slice**：`errorCatalogState` · `parameterCatalogState`；
- `runtimeParameterResolver` 的 catalog 查找路径；
- `tdp-sync` 的 **`systemCatalogBridgeActor` 整个**；
- TDP 的 **5 个 required topic 少掉 2 个**（`errorCatalog` · `parameterCatalog`）。

#### 必须说清的代价（Dexter 已知情，此处只作记录）

1. **`KEEP-26` 失去一半**：引擎限额（超时/队列上限/历史条数）仍**集中声明**（"不散落数字"这个目的达成），
   但**不再远端可调**。改一个超时要发版或热更新。
2. **错误文案同理**：改用户可见文案要发版。
3. 若将来确有"按门店调参"的真实需求，那是一次**新的、有明确业务场景的设计**，
   不是把这套 catalog 机制原样复活。

#### 顺带发现：catalog 机制在 kernel 内部就已被绕过（新增 finding）

`1-kernel/1.1-base/topology-runtime-v3/src/foundations/connectionController.ts` 第 96-103 行：

```ts
const parameterCatalog = context.getState()?.[
    'kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>
] as Record<string, {rawValue?: unknown}> | undefined
const value = parameterCatalog?.[topologyRuntimeV3ParameterDefinitions.reconnectIntervalMs.key]?.rawValue
if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value
return topologyRuntimeV3ParameterDefinitions.reconnectIntervalMs.defaultValue
```

四个问题叠在一起：

1. **绕过 `resolveParameter`**：直接读 `rawValue`，不走 definition 的 `decode`/`validate`；
2. **自己内联了一套校验**（`typeof number && isFinite && >= 0`），与 definition 里的 `validate` 是第二个真相源；
3. **跨包读另一个包的 slice**，用**硬编码字符串键 + 类型 cast**，违反"跨包读走 selector"；
4. 结果没有 `source`/`valid`，"这个重连间隔从哪来"不可回答。

**这条反过来支持了 Dexter 的裁定**：一个连 kernel 内部都会被绕过的机制，说明它的成本没有换来对应的纪律。

### 4B.9 【硬规则】reducer 只能被 actor 调用，且只由 command 驱动（Dexter 2026-08-28）

> **规则原文**：TER 必须遵守 —— **reducer 只能 actor 调用，通过 command 驱动**。

#### 这比 POC 的规范更严

POC 的原文是"**跨包**写走 command，**包内** slice action 可以自己 dispatch"：

- `spec/layered-runtime-communication-standard.md:211`：*"A package may dispatch its own slice actions internally."*
- `1-kernel/1.1-base/README.md:39`：*"跨包写操作走 public command …… slice action 默认只在包内使用。"*

TER 这条把**包内也收死了**：进入 reducer 的路径只有一条 —— `command → actor → dispatchAction`。

#### 为什么值得（三条真实收益，不是洁癖）

1. **request ledger 成为状态变更的完整审计。**
   任何状态迁移都带 `requestId` / `commandId`、进 ledger、可被 selector 观察。
   只要存在一条绕过 command 的写入，"什么改了状态、为什么、什么时候"就没有单一答案 ——
   而这正是终端现场最常问的问题。
2. **automation 的 `command.dispatch` 变成完备驱动面。**
   若 reducer 只能经 command 到达，自动化就能覆盖 **100% 的状态迁移**，
   不需要 UI、也不需要留后门。这直接提升 `ui.base.automation` 的价值。
3. **foundations 被迫变纯。**
   不能自己 dispatch，就只能**返回"要发生什么"**，由 actor 去发生。
   于是 foundation 可以脱离 store 单测 —— POC 里 `reduceServerMessage.ts` 这种
   "把服务端消息化成状态变更"的纯逻辑，现在必须持有 dispatch 才能测。

#### POC 的实际合规面（实测，穷举生产源码）

穷举范围：`1-kernel` `2-ui` `3-adapter` `4-assembly` 下 `*.ts`/`*.tsx`，
排除 `node_modules` / `**/test/**` / `**/test-expo/**`；
匹配 `dispatchAction(` · `store.dispatch(` · `dispatch(` 后接标识符。

**合计 197 处派发点：**

| 位置 | 处数 | 文件数 | 判定 |
|---|---|---|---|
| ① `features/actors/**` | **126** | 23 | ✅ 合规（占 **64%**） |
| ② `foundations/**` | 54 | 11 | ⚠️ 其中 **11 处 / 5 文件是 runtime 自身管道**（`createKernelRuntimeV2` · `internalModule` · `runtimeCatalogBootstrap` · `createStateRuntime` · `createExecutionRuntime`），在 actor 概念之下，属白名单；**真正违规 43 处 / 6 文件** |
| ③ `application/`（module install） | 13 | 2 | ❌ 违规（`tdp-sync` 12 · `topology` 1） |
| ④ `ui/**` | **1** | 1 | ❌ 违规，全生产源码**仅此一处**：`admin-console/src/ui/screens/AdapterDiagnosticsScreen.tsx:54` `store.dispatch(adminConsoleStateActions.setLatestAdapterSummary(summary))` |
| ⑤ `supports/`（scoped dispatcher 助手） | 1 | 1 | 白名单（它是 `state` 包提供的派发工具本身） |
| ⑥ `types/`（仅签名） | 2 | 2 | 非调用 |

**⇒ 真正要改的是 57 处 / 9 文件。** 而"UI 不得直接写 state"这半条**几乎已经成立**（全仓仅 1 处违规）。

#### 违规集中在哪（对 TER 是好消息）

| 文件 | 处数 | 所属批次 |
|---|---|---|
| `topology/foundations/connectionController.ts` | 15 | **批 D**（链路半边） |
| `tdp-sync/application/createModule.ts` | 12 | 批 D |
| `tdp-sync/foundations/sessionConnectionRuntime.ts` | 10 | 批 D |
| `tdp-sync/foundations/reduceServerMessage.ts` | 8 | 批 D |
| `workflow/foundations/engine.ts` | 6 | 批 D（待裁） |
| `tdp-sync/foundations/hotUpdateProjectionReducer.ts` | 2 | 批 D |
| `workflow/foundations/engineObservationRuntime.ts` | 2 | 批 D |
| `topology/application/createModule.ts` | 1 | 批 D（链路半边） |
| `admin-console/ui/screens/AdapterDiagnosticsScreen.tsx` | 1 | **批 F**（admin-shell） |

**57 处违规里有 56 处落在批 D，只有 1 处落在地基批。**
⇒ **这条规则在 F0 采纳几乎零成本；等业务铺开再回头收，代价会大一个量级。**

#### 规则的精确形态：取**词法**版，不取"调用链起源"版

| 形态 | 可机械判定 | 问题 |
|---|---|---|
| **词法**：`dispatchAction` 只允许出现在 `features/actors/**` | ✅ 禁止句，零假绿 | 长流程 engine 改造成本高 |
| **调用链起源**：只要最终由 actor 发起即可 | ❌ 需调用图分析 | 会退化成"反正 context 是 actor 传下来的"这类自我豁免 |

**取词法版。** 理由：调用链版**在实践中一定会松**——
POC 现状就是证明：`connectionController` / `reduceServerMessage` 都是"actor 把 `context` 传进来，
foundation 自己 dispatch"，形式上起源是 actor，实质上写入点已经散到了 foundation。

#### 门的形态（四件套）

- **不变量**：标识符 `dispatchAction` / `store.dispatch` / `useDispatch`
  **不得出现在 `features/actors/**` 之外的任何生产文件**；
  白名单仅 `kernel/base/runtime/**` 与 `kernel/base/state/**`（它们**实现**派发本身）。
- **红夹具**：在任一 foundation 或 UI 文件里加一行 `context.dispatchAction(...)` → 门必须红。
- **负控制**：actor 内正常 dispatch → 门必须绿；`dispatchCommand` 在任何地方 → 门必须绿
  （发命令不是写 reducer）。
- **反例栏**：`actor 把 dispatchAction 作为参数传给 foundation，foundation 再调` ——
  单纯禁"调用"抓不到。所以不变量写成**禁标识符出现**，
  连"传出去"一起禁掉（POC 的 `reduceServerMessage` 正是裸 `dispatchAction(` 形参，会被抓到）。

#### foundation 不能 dispatch 之后写成什么

两种改写，按 foundation 的性质选：

| foundation 性质 | 改写 | POC 实例 |
|---|---|---|
| **同步纯逻辑**：把输入化成一组状态变更 | **返回 `readonly UnknownAction[]`**，actor 逐条 dispatch。foundation 变纯函数，可脱离 store 单测 | `reduceServerMessage.ts`（8 处）· `hotUpdateProjectionReducer.ts`（2 处） |
| **长生命周期控制器**：持有连接/队列，异步随事件写入 | **控制器改发 command**（`dispatchCommand`，不是 `dispatchAction`），由对应 actor 写状态 | `connectionController.ts`（15 处）· `sessionConnectionRuntime.ts`（10 处）· `workflow/engine.ts`（6 处） |

第二种是这条规则**最大的一笔成本**：命令定义会变多。
但收益是**每一次异步状态变更都在 ledger 里有名字** ——
"14:32 这一刻屏幕为什么变了"从不可回答变成可回答。
而且它与 POC 自己已有的模式一致（kernel 需要 UI 确认时也是发 `request-*` command）。

**`module install` 不需要例外**：install 改成只 `dispatchCommand(initialize)`，
由 `initializeActor` 写状态。POC 的 `tcp-control` / `tdp-sync` 本来就有
`bootstrapActor` / `initializeActor` 的形态，这条现成可走。

#### 写进哪

这条属于**跨包通用规则**，应进 `doc/platform/terminal-coding-standard.md`（TER 编码规范正本），
条目形态按 v2s 规范的要求写成**自带反例的禁止句**：

> **规则**：`dispatchAction` 不得出现在 `features/actors/**` 之外。
> **反例**：foundation 接收 `dispatchAction` 形参并在内部调用
> （`tdp-sync/foundations/reduceServerMessage.ts` 现状）——
> 形式上由 actor 发起，实质上写入点已散到 foundation，ledger 里看不到这次写入对应哪条命令。

### 4B.9b 治理形态：TER 与主仓同规，不另立第二套（Dexter 2026-08-28，补记）

> **裁定原文**：跟主仓保持一致，规矩都是一样的，**我为啥要搞两套真相？我最讨厌的就是多真相**。

**补记原因**：这条是 Dexter 明确裁定的，但此前只存在于对话与讨论稿（Q-01 / X-01），
**决策文档里零命中**。

**内容**：TER 落在 `catering-v2s` 仓内，**直接适用 `AGENTS.md` / `CLAUDE.md` 的既有规矩**，
不新建治理载体、不新建第二套授权体系。

**Claude 此前的一处判错，一并记录**：
我曾以"R 原子交付与「超过半小时先切小」互相冲突"为由，建议 TER 另立一份治理文件。
**那是我读错了** —— 两条的正确读法是"**R 的范围要定得足够小**"，
而不是"定大了再拆"。不冲突，也就没有另立的理由。本文 §2 的三批分档
（批 F / D / N）正是"把 R 定小"的具体做法，与仓规一致，不是它的例外。

### 4B.11 Dexter 2026-08-28 第三轮裁定（Q-04 / X-02 / X-07 / X-08 / Q-11）

#### Q-04 跨机拓扑：**仍是一主一副**，且副屏可"拿下来当主屏"

> **裁定原文**：仍是"一主一副"，**与一机双屏能力保持一致**；
> 只是跨机拓扑允许副屏（一般是平板）**可以拿下来（监听接电状态）当成主屏使用**。

**这条同时确认了两件事，且都指向 POC 已有的实现：**

1. **pair 模型原样继承**。POC 的 `topology-runtime-v3` 设计文档 §1.4 明确把
   "多 peer 图网络"记为**已被证伪的错误方向**——本裁定与之一致，不需要重新建模。
2. **"副屏拿下来当主屏"正是 POC 的 `standalone slave` 场景**，已实现：

| POC 现有实现 | 作用 |
|---|---|
| `DevicePort.addPowerStatusChangeListener` | **监听接电状态**（就是裁定里那个触发条件） |
| `foundations/powerDisplaySwitch.ts` · `features/actors/powerDisplaySwitchActor.ts` | 电源变化 → 判定是否该切显示模式 |
| `foundations/eligibility.ts` 的 `standalone-slave-only-display-mode` | 只有 standalone slave 允许切 displayMode |
| `deriveTopologyV3Workspace`：`SLAVE && PRIMARY → BRANCH` | 拿下来独立工作时进入 **BRANCH 工作区** |
| `syncIntent: {main:'master-to-slave', branch:'slave-to-master'}` | BRANCH 的权威在该设备自己 |
| `spec/layered-runtime-communication-standard.md` 的 "Canonical Example" | 完整链路：adapter 报电源 → port → topology 发**确认请求 command** → UI bridge 开确认框 → 用户确认 → topology 执行切换 |

⇒ **`workspace` 这个轴存在的理由就是这个场景**（见 §4.2）。

**对建设批次的影响（要调整）**：

| 内容 | 原定 | 调整后 |
|---|---|---|
| `powerDisplaySwitch` + `eligibility` + workspace 派生 | 已在 F4b `display-context`（§3） | ✅ 不变 |
| `DevicePort.addPowerStatusChangeListener` | 未特别标注 | ⚠️ **地基批必需**，且按 `TR-05` 必须**具名事件类型**，不得 `Record<string, unknown>`（台账 `FIX-03` 点名的正是这个方法） |
| 电源触发切换的**确认交互**（request command → UI bridge → 确认 → 执行） | 未定 | ⚠️ 该链路**业务无关**、且跨 kernel/ui，建议**随 F4b + F6 一起做**；它同时是"kernel 需要 UI 确认时的 canonical 形状"的样板 |
| pair link（跨机 WS） | 批 D | ✅ 不变 —— "拿下来"这个动作**不需要链路**，是该设备自己的 displayMode 切换 |

#### X-08 `scripts.execute`：**保留，且必须支持运行期远端下发脚本源**

> **裁定原文（2026-08-28，二次强调）**：`scripts.execute`（任意脚本执行）**必须支持运行期从远端下发的脚本源**，
> 不然做这件事情的意义在哪里。**请不要因为安全问题限制我，程序的自由度和可扩展性是第一位的，
> 安全问题业务自己会保障。**

**TER 的能力要求（无限制条件）**：

1. `scripts.execute` 保留；
2. **脚本源可以在运行期从远端下发**；
3. 不设"脚本必须构建期确定"之类的来源限制；
4. 安全由业务侧保障，不由平台层设卡。

⚠️ **Claude 前一版曾在此加了一条"脚本来源必须构建期确定、不接受远端下发"的限制 ——
该限制已由 Dexter 明确否决并整条删除，不得以任何形式重新引入。**

**这条对建设的实际影响**：远端下发脚本要真正可用，
需要一条**服务端 → 终端**的下发通道。POC 里对应的是 workflow 的 remote definition
（TDP topic → 注册进 definitions），而该通道当前**未接线**（模块未声明 `tdpTopicInterests`，
台账 `FIX-19`）——**这是 TER 的接线工作项，不是设计问题**，随对应包进入批 D 时一并做通。

**与 `TR-08` 的关系**：`TR-08`（调试与自动化面编译期剔除）针对的是
**automation 控制面**（`adb` socket、`runtime.getState` 这类调试入口）。
若脚本执行是**产品运行期能力**而非仅开发期调试能力，
它就不属于 `TR-08` 的剔除范围 —— 这一点在 `TR-08` 落地写门时要分清，不要误剔。

#### X-07 离线能力边界：**先不管，属业务逻辑**

> **裁定原文**：这个先不管，这是**业务逻辑需要处理的事情**。

**记录并移出地基批议程。** 地基批不碰业务数据，不受影响。

⚠️ 保留一条提醒（不是异议）：离线要求最终会反过来影响
`state` 的持久化形态与 `platform-ports` 的能力型端口（台账 `FIX-15` 已裁"等真实业务再补"）。
建议在**第一个业务 Journey 的需求阶段**把它作为必答项，而不是等实现时才发现。

#### Q-11 性能 / React Compiler：**不引入**（确认）

已记为 `T-4`，本轮确认，不再讨论。
数据量级问题同样按"业务阶段再答"处理。

#### X-02 工具链：**与 v2s 统一**

> **裁定原文**：需要与 v2s 统一。

**落地含义（四条）**：

| # | 项 | 取 v2s 的值 |
|---|---|---|
| 1 | 包管理器 | **Yarn 4.17.0**（POC 是 3.6.4） |
| 2 | Node | **>= 22** |
| 3 | 任务编排 | **引入 turbo**（`T-13`）。⚠️ Claude 原写「不引 turbo（v2s 没有）」，**理由不成立已推翻** —— v2s 前端仅 3 个包、后端用 Gradle 自带缓存，而 TER 有 35 个包；「与 v2s 统一」管的是会产生真实冲突的项（包管理器 / Node / scope / 门入口），**编排器不在此列** |
| 4 | 静态门入口 | **`scripts/verify`** |
| 5 | npm scope | **`@catering-v2s/`**（此前是 Claude 假定，本条裁定后成立） |

#### `scripts/verify` 的实际形态（2026-08-28 实读 `tools/verify-gates/verify.mjs`）

⚠️ **本小节前一版基于文档转述，写错了，已按实测重写。**

它有**两批命令、两种模式**：`parseMode` 只接受无参数（`normal`：static + runtime 全跑）
与 `--validate-only`（只跑 static）。

| 批 | 内容 |
|---|---|
| `staticCommands`（16 条） | `scripts/check/*` 各边界检查 · prettier · openapi 契约 · code-layout · name-code-density，加三条 Gradle（ArchUnit / PMD 单规则 / spotlessCheck） |
| `runtimeCommands` | **真跑测试**：node tests · foundation tests · **十几个 `r5-remote-testcontainers.mjs` 的 Gradle 模块测试**（platform-admin-iam / workspace / asset / organization / catalog / inventory / audit / store-contract …） |

**⇒ 两条修正：**

1. **`scripts/verify` 不只跑门** —— 无参数模式也跑测试（含远端 Testcontainers），**绝不止分钟级**。
   仓规「必须保持分钟级」那句**未区分模式**：要么专指 `--validate-only`，要么仓规与实现已不符。
   **这是 v2s 主仓的事，不在 TER 范围，此处只报告不处置。**
2. **Claude 前一版提的「门分档、慢门另设入口」是多余的** ——
   v2s **已经就是这个两档结构**，TER 照抄即可，不需要新入口：

| TER 的门 | 落点 |
|---|---|
| `TR-01`…`TR-09` 的正则/结构断言、三重命名、依赖两断言、包名禁版本号（读文件不编译） | 进 **`staticCommands`** |
| 全量 `tsc`、全量 `vitest`、Expo Web 自动化 | 进 **`runtimeCommands`** |

**不需要再确认** —— 这不是新方案，是沿用 v2s 现成结构。

### 4B.10 技术栈裁定汇总（补记 —— 此前散在讨论稿，未进决策载体）

⚠️ **补记原因**：Dexter 2026-08-28 问"NativeWind + RNR 记录下来了吧"，核查发现**没有**。
顺同一类扫描，发现**五条技术栈裁定全部未进本文与规范文档**，只散落在讨论稿与逐包文档里。
讨论稿是过程记录，不是决策载体 —— 本节把它们收进来。

| # | 裁定 | 裁定人 | 状态 |
|---|---|---|---|
| T-1 | **用 Expo 替代 RN 裸工程**（SDK 57） | Dexter | 已定。版本事实由 Dexter 把握，Claude 不再列为风险 |
| T-2 | **UI 统一使用 NativeWind + React Native Reusables** | **Dexter** | 已定，见下 §T-2 详述 |
| T-3 | **Sentry + `react-error-boundary`** 保障可靠性与可观测 | Dexter | 已定。接入点见台账 `FIX-09` |
| T-4 | **不引入 React Compiler** | Dexter | 已定。"当前没有具体业务，还不慢，等后面建设时再针对性优化" |
| T-5 | **不使用 RTK Query。** OpenAPI → 类型化 client 生成 + `kernel.base.transport` 执行 | Dexter（2026-08-28 二次裁定，反转前一版） | 已定，见下 §T-5 详述 |
| T-6 | **automation 完全自研**，不引 Maestro | Dexter | 已定 |
| T-7 | **单一测试 runner：vitest**，不引 Jest | Claude 判断，Dexter 认可 | 已定。DOM 级行为由 Expo Web 那条道覆盖 |
| T-8 | **TDP 通讯回到 WS**，放弃 SSE | Dexter | 已定 |
| T-9 | **adapter/android 用 expo-module 实现** | Dexter | 已定 |
| T-10 | **持久化后端由 adapter 决定**（MMKV / SQLite / webstorage），非 adapter 层无感 | Dexter | 已定。SQLite 类能力等真实业务再补 |
| T-11 | **`scripts.execute` 保留，且支持运行期远端下发脚本源**；不设来源限制 | Dexter | 已定，见 §4B.11 X-08 |
| T-12 | **虚拟键盘按「单表面命中测试」实现**；高亮层用 Reanimated worklet，**Reanimated 进入既定依赖集** | Dexter（专家意见） | 已定，方案与接口影响见 `u-03-input-runtime-claude.md` §9 |
| T-13 | **引入 turbo** 做 TER 内部任务编排（35 个包） | Dexter | 已定。Claude 原以"v2s 没有"为由反对，理由不成立，已推翻 |

#### T-2 详述：NativeWind + React Native Reusables

**范围**：TER **全部 UI** 统一使用。POC 完全没有 UI 框架（样式是内联 `style={{}}`），
品牌定制需求下自建控件库是对的。

**高杠杆的那一点（已被 6 份包文档当作前提引用）**：
RNR 是 **shadcn 模式** —— 控件是**你自己仓里的源码**，不是 `node_modules` 依赖。
因此可以在**每个 primitive 上统一挂 automation 语义注册**，
把台账 `FIX-08`（语义注册是加法、覆盖率随代码量下降）**从加法变成减法**：
业务组件只要由这层构建，默认全部可被自动化寻址，业务代码零感知。

POC 里 `AdminSectionPrimitives.tsx` / `TerminalSectionPrimitives.tsx` 已有 `semanticId: testID` 的雏形，
只是没铺开（实测 `semanticId` 52 处 vs `testID` 221 处）。

**⇒ 结构后果：地基批需要新增一个包 `ui/base/primitives`。**

它被 `render` 之外的多个包共用（`admin-shell`、`input`、将来的业务 UI），
且它承载 automation 注册，所以必须是独立包而不是散在各处：

| 包 | 依赖 | 说明 |
|---|---|---|
| `ui.base.primitives` | `ui.base.automation` | NativeWind 样式 + RNR 控件源码 + **统一的语义注册** |
| `ui.base.render` | `kernel.base.ui-state` | 保持**最小**：screen/overlay/alert 的渲染桥。其默认 alert 用裸 RN，**不依赖 primitives**，以避免 `primitives ↔ render` 成环 |
| `ui.base.admin-shell` · `ui.base.input` | `primitives` + `render` | 消费方 |

**明确不覆盖的**：`input-runtime` 的 POS 专有能力（虚拟键盘 / PIN / 数字输入 / 输入持久化）
RNR **不提供**。TER 的做法是 —— **外观层用 NativeWind + RNR 重做，输入语义层（controller / 模式 / 布局 / 持久化）整体保留**。

**仍 `UNVERIFIED`（TER 起步时需现场确认，Claude 本轮未验证）**：

1. NativeWind 版本 × Expo SDK 57 × RN 新架构 的兼容矩阵；
2. RNR 的可用控件清单是否覆盖 POS 需要的形态 —— 大按钮触控区、双屏不同 DPI、数字/金额输入；
3. NativeWind 的样式方案在**两块屏不同密度**下的表现（这条与 `CON-02` 的 DPI 未验证项是同一个风险面）。

#### T-5 详述：不使用 RTK Query（2026-08-28 二次裁定，反转前一版）

**裁定过程**：Dexter 先定"RTKQ 只当封装好的 HTTP client、不要缓存"；
Claude 指出**RTKQ 本质就是缓存引擎，关掉缓存后实际只用到三样** ——
OpenAPI 代码生成、类型化 endpoint、一个 `baseQuery` 接缝，
而这三样有更直接的来源。Dexter 2026-08-28 采纳该意见：**不用 RTKQ。**

**替代形状**

| 层 | 承担什么 |
|---|---|
| **契约生成** | OpenAPI → 类型化 client（`openapi-typescript` + 薄 fetch 包装，或 `hey-api` / `orval`）。**具体工具待 terminal 契约出现后再选**，现在不定 |
| **`kernel.base.transport`** | **全部执行策略**：多地址 failover、重试轮、有效地址黏住、并发闸门、限流、per-attempt metric、结构化日志（台账 `KEEP-12`）。**这是我们的策略，不交给任何 client** |
| **actor** | 只认一个类型化的 `httpService` facade。底下换 client 是一个文件的事 |

**这条裁定顺带解决了三件事**

1. **`TR-01` 不再需要例外。**
   RTK Query 会**自己装一个 reducer 和 middleware 往 store 里写**，
   完全绕开 command → actor 路径。若采用 RTKQ，`TR-01`（reducer 只能 actor 调用）
   就必须给它开一个**永久豁免**。不用 RTKQ 之后，`TR-01` 全局零例外。
   ⇒ **这是比"更轻"更硬的理由。**
2. **`initiate` 的生命周期义务整条消失。**
   v2s 前端规范 §3-C 记着 `dispatch(endpoint.initiate(...))` 必须配
   `.unsubscribe()` / `.reset()` 或 `{subscribe:false}`，实测泄漏形态
   **3 query + 1 mutation = 4 次 HTTP**（对照组 1 次），且 mutation 条目带完整响应体永久驻留。
   原方案里这条义务要适用于**100% 的取数调用点**；现在不存在了。
3. **store 里不再有一个永远近乎空的 `api` reducer**，也没有 `serializableCheck` 的交互问题。

**要自己补的一件事**：RTKQ 自带的**同 in-flight 请求去重**没有了。
若真需要，在 `transport` 层按 `(endpointName, argsHash)` 做，约 20 行 —— 且它本来就该属于 transport 策略。

**与 v2s 后台的一致性（诚实交代）**：
v2s 两个管理后台用 RTKQ，TER 由此**分道**。
Claude 前一版曾用"统一标准"论证保留 RTKQ，现自我推翻 ——
理由是：TER 本来就要以**完全不同的方式**使用它（无 hooks、无缓存、无 tag 失效），
**同一个库、相反的用法**比"不同上下文用不同工具"更容易误导后来者
（有人会带着后台的假设读终端代码）。
真正该保持一致的是**"契约生成物是唯一真相"这条原则**，不是运行库本身。

**对建设顺序的影响：无。**
`transport`（F4a）不依赖客户端选型；契约生成随 terminal 契约进入**批 D**。

#### T-3 详述：Sentry + `react-error-boundary`

**为什么是真缺口**：POC 生产代码 `ErrorBoundary / componentDidCatch / getDerivedStateFromError`
**只在 `test-expo` 出现**；`Sentry / crashlytics / ErrorUtils.setGlobalHandler / unhandledrejection`
**零命中**（台账 `FIX-09`）。POS 崩了门店当场停止收银，现场没有开发者也没有 logcat ——
**没有崩溃上报 = 没有故障可见性**。

**接入点现成**：`LoggerPort` 已经是结构化的且带 `security.containsSensitiveRaw`（台账 `KEEP-14`），
加一个 sink 即可，**业务代码零改动**。

**三条边界要在接入时定**：

1. 终端可能长期离线 ⇒ 需离线队列与上传窗口（POC 的 `versionReportOutbox` 是现成先例）；
2. boundary 粒度不能只有 root ⇒ **screen 级**（`render` 的 ScreenContainer 是天然边界），
   一个业务页崩了不该让整台收银机白屏；
3. boundary reset 之后**重新挂载 screen 而不是重启 App** —— store 的恢复能力本来就有。

#### T-4 详述：不引入 React Compiler，但两件事仍要做

1. `eslint-plugin-react-hooks` **从第一天就设 error**（v2s 根已装 7.0.1）——
   将来想开 Compiler 时是"打开开关"，不是"先还三个月技术债"；
2. POC 那 **5 处条件调用 hook 不能搬过来**（台账 `FIX-07`），理由与 Compiler 无关：
   `const x = xProp ?? useOptionalXxx()` 在 `xProp` 由 `undefined` 变为有值时
   **hook 调用数会变化**，React 直接抛 `Rendered fewer hooks than expected`。这是潜伏崩溃。

## 5 · 地基批怎么验收（没有业务、没有服务端时的判据）

Dexter 已裁"当前不接服务器"。因此地基批的验收场景必须是**平台自身的事实**，不能是业务事实。
以下六条不需要任何业务、也不需要真实服务端，且每条都能落成可跑的用例：

| # | 判据 | 覆盖的地基能力 |
|---|---|---|
| 1 | 启动 → 模块按依赖排序装配 → hydrate → selector 读回预期值 | F0-F3 |
| 2 | 一条 command 广播到 N 个 actor，聚合出 `COMPLETED` / `PARTIAL_FAILED` / `FAILED` / `TIMEOUT` 四态，request ledger 可查 | F3 |
| 3 | 状态写入 → 按字段/按条目落盘 → **独立子进程重启** → 恢复原状；且断言"不该恢复的确实没恢复" | F2 |
| 4 | **一个 store 两个 surface**：各自渲染、各自导航、互不干扰；副屏发命令主屏可见（§4 的 routeContext 形状） | F4b+F5+F6 |
| 5 | HTTP 多地址 failover：首地址失败切次地址、成功后黏住、`replaceServers` 后重选 —— 用 vitest 内起的临时 `http.createServer`（**是 test fixture，不是 mock-server 包**） | F4a |
| 6 | automation 控制面可 `selectState` / `command.dispatch` / `wait.forState`，且 Product 构建里**编译期不存在** | F7a |

第 3、4 条是"POC 的两个灵魂"（崩溃恢复原状 / 双屏）的直接证明，
第 6 条把台账 `FIX-14`（生产 inert 靠约定不靠机制）在地基阶段就变成可机械判定的。

---

## 6 · 地基批的 integration 包：不是脚手架，是这一层的样板

⚠️ 本节原写作"最小平台自检 shell"，按 §4B.0 的身份更正重写。

`assembly` 要启动就得有一个 root screen。POC 里那是 `catering-shell`（业务）。
地基批需要**一个自己的 integration 包**，但它的定位不是临时脚手架：

1. **它是 integration 这一层的样板** —— 后续每个业务 integration 包照它的形状建；
2. **它是地基批"四层都有内容"的第四层证明**（kernel / ui / adapter / assembly 之外，
   integration 是 ui 层里把东西组合起来的那个包）；
3. **它是双运行面判据的载体**（§4B.5）：同一个包，Android 真机跑一遍、Expo Web 跑一遍。

**内容**：把 `admin-shell`（§4B.4 拆出的业务无关运维界面）组合进来，
外加一屏显示 runtime 装配结果、当前 workspace/displayMode、副屏画面。
**admin-shell 本身就是真实可用的 UI**，所以这个 integration 包不需要造假页面。

**可参考**：POC 的 `2-ui/2.1-base/runtime-react/test-expo/RuntimeReactExpoShell.tsx`
（303 行）与 `runAutomation.mjs`（670 行）已经是"同一套 runtime 在浏览器里跑、
两个页分别当 displayIndex=0/1"的可运行实例——形状可直接借鉴，
但 TER 的这个包是**生产包**，不是 `test-expo/` 下的测试外壳。

## 7 · 建设顺序总表

```text
F0  contracts                 (零依赖)
     │
F1   platform-ports          (definition-registry 已取消，见 §4B.8)
     │
F2   state
     │
F3   runtime  (command/actor/module/request ledger)
     ├──────────────┬───────────────┐
F4a  transport      F4b display-context
                    │
F5                  ui-state
                    │
F6                  ui-render   (screen/overlay/alert 渲染桥，保持最小)
                    │
F7a                 automation  (运行时控制面)
                    │
F7b                 primitives  (NativeWind + RNR + 统一语义注册，见 §4B.10 T-2)
                    ├── F7c ui-input    (POS 虚拟键盘/PIN/数字输入：语义层保留、
                    │                    键盘渲染与命中层按「单表面命中测试」重做，见 u-03 §9)
                    └── F7d admin-shell (admin-console 的业务无关半边，见 §4B.4)
F8   adapter/android/* (expo-modules，实现 platform-ports)
       ※ 不建 adapter/web：web 由端口默认实现覆盖（§4B.1/§4B.2）
F9   test-support ×2   (含 dev 地址册，见 §4B.3)
F10a ui/integration/<platform-selfcheck>   (双运行面：Android + Expo Web)
F10b assembly/android  (薄壳，能装出 APK 并在真机启动)
```

⚠️ §4B.5 已把完成标准升级为**四层都有内容 + 双运行面通过**；
F7b / F7d / F10a 三项就是为满足该标准而进入地基批的。

**同层可并行**：F4a/F4b、F7c/F7d。
**关键路径**：`contracts → platform-ports → state → runtime → display-context → ui-state → ui-render → assembly`。
**目录与三重命名**见 §4B.7；每一层的具体包名已在那里列出。

---

## 8 · 证据档位

- 依赖声明与真实 import 的比对：`已亲验`。穷举范围＝33 个含 `src/` 的工作区包，
  比对 `package.json.dependencies` 与 `rg '@next/[a-z0-9-]+' <pkg>/src` 的集合差。
- `topology-runtime-v3` 三文件触及 transport：`已亲验`，逐文件 import 扫描。
- `ui-runtime-v2` 只用两个 topology selector：`已亲验`，4 个 import 点全部列出。
- workspace 全局读法：`已亲验`，`screenRuntimeActor.ts` 第 19-27 行原文。
- "两块屏会互相覆盖"：`推论`，推导链＝一个 store + 全局 workspace + 两个 surface 同时 dispatch；
  **TER 原型阶段应实测确认**。
- 各包行数：`已亲验`，脚本统计，排除 `node_modules`/`dist`/`build`/`.turbo`。
