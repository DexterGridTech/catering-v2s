# `kernel.base.contracts` · 需求文档

| 字段 | 值 |
|---|---|
| 包 | `apps/terminal/kernel/base/contracts` · `kernel.base.contracts` · `@catering-v2s/kernel-base-contracts` |
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 前置 | 骨架批一 + 批二已完成（22 包），本包骨架已存在，本文是**给它填内容** |
| 规范正本 | `doc/platform/terminal-coding-standard.md` |
| POC 参照 | `1-kernel/1.1-base/contracts`（760 行 / 19 文件，只读 Heritage） |
| 分析来源 | `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/k-01-contracts-claude.md` |

---

## 1 · 背景

TER 的 22 个包里，**这是唯一一个零依赖的包**，也是依赖图的唯一根。
POC 实测：它的 `dependencies` 为空，`src` 下零第三方 import，而**被 18 个包实际 import**，
是全仓被依赖最广的包。

这个位置决定了两件事：

1. **它一旦错，所有包一起错。** 没有任何包能绕过它自己定义同一件事 ——
   绕过就是两套真相。
2. **它一旦重，所有包一起重。** 它多导出一个类型，22 个包的编译面就宽一分；
   它引入一个依赖，整张图的根就有了出边，"谁都能依赖它而不成环"这个前提就没了。

⇒ **本包的设计压力全部来自"少"，不是"全"。**

---

## 2 · 包定位

### 2.1 它是什么

**跨包共享语言层。** 只放**多个包必须对同一件事用同一个名字**的东西。

判别式（每加一个类型都要过）：

> **它是「任何包都可能用到的共享词汇」，还是「某一个包的内部结构」？**
> 共享词汇 ⇒ 进 contracts；内部结构 ⇒ 留在拥有它的那个包里。

⚠️ **判别的是性质，不是当下的消费者数量。**
`ParameterDefinition` 是"任何模块声明自己参数的方式"，即使当下只有一个包定义了参数，
它仍是共享词汇；反之，一个类型即使被两个包用到，若它暴露的是某个包的内部结构，
也不该进来。**用数量判别会同时放错两边。**

### 2.2 它不是什么

| 不是 | 为什么 |
|---|---|
| 工具库 | 通用工具没有"跨包必须一致"的属性，它们属于用得到的那个包 |
| 类型总集 | 只被一个包用的类型放这里，等于把该包的内部结构公开成全仓契约 |
| 运行时 | 不持有状态、不注册 slice、不派发 command |
| 平台能力入口 | **不碰需要适配器提供的能力**：存储、网络、设备、原生模块。⚠️ 时间与随机数**不在此列**，它们是 JS 运行时自带的（§6.1） |

### 2.3 硬边界

- **零运行时依赖**：`dependencies` 与 `peerDependencies` **必须为空**；
- **零 Expo / RN / React**（骨架需求 §6.4「外部依赖基线」，已有门）；
- **无出边**：不 import 任何 `@catering-v2s/*`；
- `plannedKind: toolkit` —— **不得拥有 slice**。

---

## 3 · 消费者与依据

⚠️ **本节必须分三类看，不得混为一谈** —— 原先一张表把图边、POC 事实与 TER 推测混在一起，
会把推测当成已证需求去冻结导出面。

### 3.1 当前 TER 图边（**仓内事实，已独立复算**）

从 `apps/terminal/skeleton-graph.ts` 复算：直接依赖 contracts 的有 **10 个包** ——
9 条正式边（`platform-ports` · `state` · `runtime` · `transport` · `display-context` ·
`workflow` · `ui-state` · `ui.integration.platform-console` · `assembly.android.pos-desktop`）
+ 1 条 devDep 边（`kernel.base.test-support`）。

⚠️ **这只说明"谁被允许依赖它"，不说明"谁需要它的哪个类型"。**
当前这 10 个包的源码**都只 import `moduleName` 与依赖元数据**，无一使用语义类型。

### 3.2 POC 中的真实符号消费（**外部事实，已逐处核**）

| POC 包 | 实际 import 的符号 |
|---|---|
| `platform-ports` | `src/types/logging.ts` 多行 import **6 个类型**：`CommandId` · `ConnectionId` · `NodeId` · `RequestId` · `SessionId` · `TimestampMs`；`src/foundations/logger.ts`：`nowTimestampMs`；test：`createCommandId` · `createRequestId`。**不含错误协议** |
| `transport-runtime` | `createAppError` · `AppError` · `ErrorDefinition` · `TimestampMs` · transport 类型 |
| `admin-console` · `terminal-console` | `formatTimestampMs` · `TimestampMs`（**UI 展示，见 §4.1 的移除说明**） |
| assembly | **无 contracts 语义直连** |

🔴 **本行两度写错，记录在此**：原表写「ID 类型 · 错误协议」——ID 类型对、错误协议错；
第一轮 review 更正为「只有 `nowTimestampMs`」，我未复核即接受，**把半对换成了全错**。
根因是我用按行匹配的 `grep` 抓 import，**看不见多行 import**，
而同一次输出里孤立的 `} from '...'` 尾行就是漏抓信号，我没追。
⇒ **枚举符号消费必须读整段 import，不能用单行正则。**

⚠️ POC 有 18 个生产 importer，上表只列了与本批取舍直接相关的几个。
**不得把 POC 的每个符号消费自动升级为 TER 的已证需求** —— 两边的包边界已经不同。

### 3.3 TER 本批的需求判断（**推论，逐项标档**）

| 组 | TER 需求档位 | 依据 |
|---|---|---|
| ID 与时间 | `CONFIRMED` | POC 全层广泛使用；TER 的 request/command 语义必然需要 |
| 错误协议 | `CONFIRMED` | POC `transport-runtime` 实测使用（`createAppError` · `AppError` · `ErrorDefinition`）。⚠️ **`platform-ports` 不用它** —— §3.2 已更正 |
| 参数协议 | `UNVERIFIED_TER_NEED` | POC 有消费，但 TER 侧只有 `workflow` 可能用到，而 workflow 尚未实现 |
| 定义工厂 | `UNVERIFIED_TER_NEED` | 同上，随错误/参数协议一起 |
| 模块描述符 | `UNVERIFIED_TER_NEED` | 唯一读者 `runtime` 尚未实现（见 §4.1 的冻结警示） |
| request 生命周期 | `UNVERIFIED_TER_NEED` | 同上 |
| transport 配置形状 | `CONFIRMED` | 骨架需求 §11 已裁定形状归 contracts、地址值由启动层注入 |

⚠️ **标 `UNVERIFIED_TER_NEED` 的四组仍然要建**（它们性质上是共享词汇，§2.1），
**但不得被当成已冻结的契约** —— 消费者包落地时有权要求改。
详设必须把这四组的档位如实带进实施记录。

---

## 4 · 本批内容

### 4.1 进（七组）

| # | 组 | 内容 | 依据 |
|---|---|---|---|
| 1 | **ID 与时间** | 九种 branded ID（runtime/request/command/session/node/connection/envelope/dispatch/projection）· `TimestampMs` · `RuntimeIdKind` · 前缀表 · **`createRuntimeId` 与九个 `create*Id` 便利函数** · `nowTimestampMs`。⚠️ **不含 `formatTimestampMs`**，见表后说明 | 全部消费者共用；branded 把最易串的字符串变成编译期可区分。生成与取时间**留在本包**，见 §6.1 |


| 2 | **错误协议** | `ErrorDefinition` / `AppError` / `ErrorCatalogEntry` / `ResolvedErrorView` 四型 + `ErrorCategory`(9 值) + `ErrorSeverity`(4 值) + `renderErrorTemplate` + `isAppError` | 四型分离让"这条文案从哪来"永远可回答（`source` 字段） |
| 3 | **参数协议** | `ParameterDefinition` / `ParameterCatalogEntry` / `ResolvedParameter` + `ParameterValueType` | `ResolvedParameter` 的 `source` 三值为未来 resolver 保留「用了默认」与「远端值非法退回默认」的**可区分结果形态**。⚠️ 本包不实现 resolver；具体分支赋值在 resolver owner 落地时验证 |
| 4 | **定义工厂** | `createModuleErrorFactory` / `createModuleParameterFactory` / `listDefinitions` | key 由 `moduleName` 派生，业务侧不手拼字符串（与 `TR-09` 的命名派生同源） |
| 5 | **模块描述符** | `AppModule` 及其 dependency / command / actor / middleware / slice 子描述符 | `runtime` 的模块装配需要；`TR-09` 的 `kind` 与 slice 归属最终落在这里 |
| 6 | **request 生命周期** | `CommandLifecycleStatus`(6 态) · `RequestLifecycleStatus` · `RequestCommandSnapshot` · `CommandResultSnapshot` · `RequestLifecycleSnapshot` · `CommandRouteContext` | `runtime` 的 request ledger 协议；广播 command 的四态聚合依赖它 |
| 7 | **transport 配置形状** | `TransportServerAddress` / `TransportServerDefinition` / `TransportServerConfigSpace` / `TransportServerConfig` / override 与 resolve 选项 / `TransportRequestContext` | `server-config` 独立包已取消，**形状归 contracts、地址值由启动层注入**（骨架需求 §11 已定） |

🔴 **`formatTimestampMs` 不进本包**（本文原先误列，现移除）。

**证据**：POC `foundations/time.ts:5-10` 用本地时区的 `Date` getter 拼展示字符串；
它的**生产调用点只有两处，都在 UI 层** ——
`2-ui/2.1-base/admin-console/src/supports/adminFormatting.ts:1,10` 与
`2-ui/2.1-base/terminal-console/src/supports/terminalFormatting.ts:1,34`；
**kernel 侧零使用**。

**它是 UI 展示策略，不是跨包共享词汇** —— 与 §2.2、§9 明确排除的「通用工具函数（日期格式化…）」
是同一类。放进零依赖根包会把时区与格式策略强加给全部消费者，
而时区、格式、非法输入行为**没有任何跨包共享契约来源**。

⚠️ `Date.now()` 的 `TR-06` 例外**只覆盖取时间，不覆盖展示格式化**。两者不是一回事。
⇒ 显示 helper 留在用得到它的 UI 包。

⚠️ **组 5 与组 6 的字段形状是 POC 派生的，`runtime` 那批必须复核并有权修改。**

它们的唯一读者是 `kernel.base.runtime`，而 runtime 现在还是空骨架 ——
**contracts 现在定它们的字段，本质上是在猜 runtime 要什么**。
留在本批的理由是它们性质上确实是共享词汇（模块如何声明自己、command 生命周期有哪些状态），
**不是因为字段已经定型**。

⇒ 交付时必须标注：**这两组在 runtime 落地前不视为已冻结的契约**，
runtime 那批若发现字段不合用，改 contracts 是正常路径，不算返工。

### 4.2 推迟（跨节点半边，等对手方出现）

| 组 | POC 文件 | 为什么推迟 |
|---|---|---|
| topology 握手 | `types/topology.ts`（`NodeRuntimeInfo` / `PairingTicket` / `NodeHello` / `NodeHelloAck`） | topology 的**链路半边**已推迟（骨架需求 §11） |
| 兼容性裁决 | `types/compatibility.ts` | 只被 topology 握手使用 |
| state-sync 三段协议 | `types/stateSync.ts` | 跨机同步，对手方未定义 |
| request 投影镜像 | `types/projection.ts` | 跨节点镜像 |
| command 跨节点信封 | `types/command.ts` 的 `CommandDispatchEnvelope` / `CommandEventEnvelope` | 本机派发不需要信封；**`CommandRouteContext` 留下**（本机路由要用）。⚠️ 见下方边界 |
| `protocol/` 二次筛选出口 | `protocol/index.ts` | POC 里它导出的 15 个类型**绝大多数属上面推迟项**，现在建它是个空壳 |

⚠️ **`CommandRouteContext` 是 local-only 的，必须显式标注。**
POC 里它被 `CommandDispatchEnvelope` 内嵌后**跨节点上线**。本批只保留本机路由用途，
详设必须在类型旁写明「**local-only，未经序列化边界审查前不得进入 wire protocol**」；
将来接跨节点信封时，它的字段（尤其 `metadata`）**必须重新过一次序列化与兼容性审查**，
不得因为"已经有这个类型了"就直接内嵌上线。

⚠️ **`protocol/` 的设计意图必须登记，不是取消。**
它把「包内共享类型」与「上线协议对象」分开，防止内部类型经字段无意变成跨节点契约。
**第一个跨节点协议对象出现时同批建立**，并同时建那道门：
`protocol` 导出的类型不得引用未被 `protocol` 导出的类型。

### 4.3 判别式

上面的进/推迟不是清单记忆，是同一条判别式的结果：

> **这个类型的消费者包，现在建成了吗？**

⚠️ **「建成」指的是包已在 22 包内存在，不要求它已有实现。**
本批所有包都还是骨架，若按「实现存在」解读，contracts 什么都不能建，那是误读。

`transport` 在批 F（包已存在）⇒ 它的配置形状进；
`tcp-control` / `tdp-sync` / topology 链路在批 D（**包都还没建**）⇒ 它们的协议对象推迟。

---

## 5 · 设计标准

每条**必须绑定真实门或负夹具**；无法机械判定的诚实标 `UNENFORCEABLE_BY_MACHINE`
并绑定评审清单（依 `decisions.deterministic-context-only` 的 `MACHINE_OR_REVIEW_DESTINATION`）。

| # | 标准 | 落点 |
|---|---|---|
| C-1 | **零依赖**：`dependencies` / `peerDependencies` 为空，源码零 `@catering-v2s/*` import | **已有门**（依赖方向 + 依赖声明完整）；红夹具：给它加一条对 `platform-ports` 的依赖 |
| C-2 | **零适配器能力**：源码不出现 `fetch` / `XMLHttpRequest` / `localStorage` / `AsyncStorage` / `process` / 文件系统 / 任何原生模块访问。⚠️ `Date.now` / `Math.random` / `crypto` **允许** —— 它们是 JS 运行时自带的，不需要适配器（§6.1） | **新增门**（标识符扫描）；红夹具：在任一文件加一行 `fetch('/x')` |
| C-3 | **零 React / RN / Expo** | **已有门**（kernel 平台独立性） |
| C-4 | **每个导出都必须是共享词汇，不得是某个包的内部结构**（判别式 §2.1） | `UNENFORCEABLE_BY_MACHINE` —— 这是性质判断，机器判不了。**绑定评审清单**：每个导出，详设必须回答「为什么它是共享词汇而不是某包内部结构」，并列出**已知消费者**（数量不设下限，但为零时要说明它服务于哪类将来的包） |
| C-4b | **`TR-05`：禁止 `Record<string, unknown>` / `any` / 双重 `as` cast**。**扫描面写死为**：`src/**` 全部 **exported** 的 ① 接口与 type alias 的成员类型、② 函数签名的参数与返回值、③ **泛型约束**（`extends` 右侧）；④ **双重 `as` cast**（形如 `x as unknown as T` / `x as any as T`）——**全 `src/**` 扫，不限 exported**。⚠️ 不得只扫 `src/types/**` —— `foundations/error.ts` 的 `renderErrorTemplate` 与 `foundations/definition.ts` 的 `listDefinitions` 都在 `foundations/` 下且都有命中 | **本批必须建这道门** —— 正本 `TR-05` 已规定门形态，骨架批因无真实类型未建，**contracts 是它第一次有约束对象**。红夹具：把任一处改回 `Record<string, unknown>`；红夹具二：把某个泛型约束改回 `extends Record<string, unknown>`；**红夹具三：在任一文件加一行 `const x = y as unknown as string`** |
| C-5 | **ID 前缀表与 `RuntimeIdKind` 一一对应，无遗漏无多余** | **新增门**（对拍两个字面量集合）；红夹具：删掉前缀表里一项 |
| C-6 | **以下七处闭集不得退化成裸 `string`**：`ErrorCategory`(9 值) · `ErrorSeverity`(4 值) · `ErrorCatalogEntry.source`(3 值) · `ResolvedErrorView.source`(3 值) · `ParameterCatalogEntry.source`(3 值) · `ResolvedParameter.source`(3 值) · `ParameterValueType`(4 值) | **新增门**（对这七个具名位置断言其类型是字面量联合且成员数相符）；红夹具：把 `ErrorCategory` 改成 `string` |
| C-7 | **`TR-06`：`foundations/` 必须是纯函数**，例外为：① `nowTimestampMs` 与 ID 生成一族；② **`createAppError`**（盖 `createdAt` 是它的固有语义） | 例外**已写入规范正本**（`TR-06` 的「JS 运行时自带的时间与随机数」一节，含第 ② 类派生构造器），不是本文自行豁免。**新增任何派生构造器必须先改正本** |
| C-8 | **公开面最小**：`index.ts` 只导出 §4.1 的七组，不做 `export *` 的无差别转发 | `UNENFORCEABLE_BY_MACHINE` —— **绑定评审清单**：逐项核对导出清单与 §4.1 一致 |

---

## 6 · 三个关键设计决定

### 6.1 时间与 ID 生成**留在 contracts**（Dexter 2026-08-29 裁定）

**结论**：`nowTimestampMs` 与 `createRuntimeId` 一族**原样保留在本包**，
与 POC 一致。`createAppError` 内部盖 `createdAt` 也保留。

**为什么**（Dexter）：

1. **时间与 ID 本身就是 JS 端能力，不依赖适配器。** `Date.now()` 与 `crypto.randomUUID`
   在任何 JS 运行时都有，不需要任何原生模块提供 ——
   把它们做成端口，是把"本来就有的能力"包装成"需要注入的能力"。
2. **时间不需要 JS 层校正。** 真要校正是**操作系统级**的；OS 校正之后 `Date.now()`
   自动就是校正后的值。**JS 层再做一层偏移，是在解一个不存在的问题。**

**Claude 原提案（移出到 `platform-ports`）已撤回，判为过度设计。**
我原来的两条理由都不成立：

- 「将来要做时钟偏移校正」—— 被上面第 2 条直接否掉；
  且 `k-01` 里 `FIX-05` 的依据我此前已自我推翻（跨端同步是 per-slice 静态 authority，
  不是墙钟 LWW），这条本就没有实证基础。
- 「测不动，只能弱断言 `typeof createdAt === 'number'`」—— **也不成立**。
  vitest 自带假时钟（`vi.setSystemTime`），**零 API 成本**就能让 `createdAt` 可精确断言。
  我为一个测试框架已经解决的问题去改公开面，是典型的过度设计。

**由此确立的边界线**（比原来的「零平台能力」更准）：

> **JS 语言与运行时自带的 ⇒ 允许**（`Date.now` · `Math.random` · `crypto`）；
> **需要适配器提供的 ⇒ 禁止**（存储 · 网络 · 设备 · 原生模块）。

C-2 的门按这条线收窄（§5）。

⚠️ **POC 的 `createRandomSuffix` fallback 用 `Math.random`**，在无 `crypto` 的宿主上
ID 不具备加密强度。**当前 ID 只作关联标识、不作安全凭据，按此保留**；
若将来 ID 参与任何鉴权，届时再裁 —— **不在本批处理**。

### 6.2 模板缺参数：**保留占位符并可观测**，不静默成空串

**POC 现状**：`renderErrorTemplate` 对缺失的 `${key}` 渲染成**空串**，无任何信号。

**后果**：门店现场会看到「订单  提交失败」这种带空洞的文案，
而且**没有任何线索说明缺了哪个参数** —— 这类问题在现场根本无法诊断。

**要求**：缺参数时**保留可辨识的占位标记**（形态由 Codex 定），
并让缺失这件事**可被调用方观测**（返回值携带缺失 key 列表，或同等手段）。
**不得静默**。

**判据**：一条正断言（参数齐全 ⇒ 渲染完整）+ 一条反断言
（缺参数 ⇒ 输出含可辨识标记**且**缺失 key 可被读到）。

### 6.3 版本常量：本批**不建**

POC 有 `generated/packageVersion.ts` 与 `generated/protocolVersion.ts`。

- `packageVersion` —— 骨架需求 §8.3 已定**不建**：POC 那个文件内容就是
  `export const packageVersion = '0.0.1'`，**没有生成器**，手写一个放 `generated/` 下标签是假的。
- `protocolVersion` —— 它的用途是**跨节点握手时的兼容性裁决**，
  而握手协议已推迟（§4.2）。**没有消费者，不建。**

🔴 **这里有一处必须同时改的**：POC 的 `AppModule` 里
**`packageVersion: string` 是必填**，只有 `protocolVersion?: string` 是可选。
「不建 `packageVersion` 常量」与「`AppModule` 必填 `packageVersion`」**不能同时成立**。

**要求**：TER 的 `AppModule` 把 **`packageVersion` 改为可选**（或整字段先不要），
并在详设里把这条记为**与 POC 的显式差异**。
`protocolVersion` 本就是可选，不受影响。

### 6.4 【本文原缺】`TR-05` 直接点名本包，13 处必须逐一处置

**规范正本 `TR-05` 的规则句原文点名了本包**：

> 「`kernel/base/platform-ports` 与 `kernel/base/contracts` 中，
> 任何对外方法的参数与返回值必须是**具名类型**。
> 禁止 `Record<string, unknown>` / `any` / 双重 `as` cast。」

**POC 的 contracts 全包有 17 处 `Record<string, unknown>` 与 1 处 `any`**；
排除 §4.2 已推迟的 `projection.ts`(2 处) 与 command 跨节点信封(2 处) 后，
**落在 §4.1 范围内的是 13 处 `Record<string, unknown>` + 1 处 `any`**。

**逐文件逐成员清单**（本文原表有两处错误，已更正）：

| 文件 | 成员 | 形态 |
|---|---|---|
| `types/error.ts` | `AppError.args?` | `Record<string, unknown>` |
| `types/error.ts` | `CreateAppErrorInput.args?` | `Record<string, unknown>` |
| `foundations/error.ts` | `renderErrorTemplate(template, args?)` 第二参 | `Record<string, unknown>` |
| `types/request.ts` | `CommandResultPatch.result` | `Record<string, unknown>` |
| `types/request.ts` | `CommandResultSnapshot.result?` | `Record<string, unknown>` |
| `types/request.ts` | `RequestCommandSnapshot.result?` | `Record<string, unknown>` |
| `types/command.ts` | `CommandRouteContext.metadata?` | `Record<string, unknown>` |
| `types/transport.ts` | `TransportRequestContext.metadata?` | `Record<string, unknown>` |
| `types/transport.ts` | `TransportServerAddress.metadata?` | `Record<string, unknown>` |
| `types/transport.ts` | `TransportServerDefinition.metadata?` | `Record<string, unknown>` |
| `types/transport.ts` | `TransportServerAddressOverride.metadata?` | `Record<string, unknown>` |
| `types/transport.ts` | `TransportServerOverride.metadata?` | `Record<string, unknown>` |
| `foundations/definition.ts` | `listDefinitions<TDefinition extends Record<string, unknown>>` **泛型约束** | `Record<string, unknown>` |
| `types/module.ts` | `AppModule.parameterDefinitions?: readonly ParameterDefinition<any>[]` | **`any`** |

🔴 **本文原表的两处错误**（已更正，记录在此以免再犯）：
① 列了 `TransportServerConfigSpace.metadata` —— **该成员不存在**，
   实测该接口只有 `{name, servers}`；
② 漏了 `TransportRequestContext.metadata`（`types/transport.ts` 第 14 行）
   与 `listDefinitions` 的泛型约束（`foundations/definition.ts` 第 78 行），
   因此原计数 12+1 是错的，正确是 **13+1**。

⚠️ **`listDefinitions` 那处是泛型约束，不是参数或返回值。**
`TR-05` 的规则句写的是「参数与返回值」，字面上不覆盖泛型约束 ——
**这正是 C-4b 必须写死扫描面的原因**（见 §5）。本文要求把它计入。

⚠️ **照抄 POC 就是直接违反正本。** 本文原先只写「照 §4.1 进七组」，
没提 TR-05，等于默认把这 13 处一起搬进来 —— 这是本文最实质的一处缺漏。

**要求：逐处判定，只允许三种处置，且详设必须逐处写明选了哪种与为什么。**

| 处置 | 适用 | 例 |
|---|---|---|
| **A · 泛型化** | 形状由调用方决定、但每个调用点是确定的 | `CommandResult<TResult>` 取代 `result: Record<string, unknown>`；`ErrorDefinition<TArgs>` 取代裸 `args` |
| **B · 收窄为具名类型** | 值域其实有限，只是 POC 没写出来 | `ParameterDefinition<any>` → `ParameterDefinition<unknown>` 或泛型擦除的基接口 |
| **C · 保留为开放扩展点** | 确实是设计上的开放槽 | `metadata` 一族 |

⚠️ **C 是有代价的，不是默认选项。** `TR-05` 的反例栏已点明：
`interface X { [k: string]: unknown }` 这种「具名但内容开放」**能过门但需 review 判**。
⇒ 选 C 的每一处，详设必须回答：**谁会往里放东西、谁会读、为什么不能具名**。
**答不上来就不是 C。**

⚠️ **`any` 那一处（`AppModule.parameterDefinitions`）没有 C 选项** ——
`TR-05` 对 `any` 是无条件禁止。

---

## 7 · 包结构与公开面

```text
kernel/base/contracts/
  package.json          零 dependencies；exports 只有 "." → ./src/index.ts
  tsconfig.json
  vitest.config.ts      ← 本批新增（§8）
  src/
    moduleName.ts       零 import（已有）
    dependencies.ts     空集合（已有，零依赖）
    index.ts            公开面，逐项显式导出
    types/              ids · error · parameter · module · request · transport
    foundations/        time · runtimeId · errorTemplate · definition · validator
  test/
```

- **不建** `application/` · `features/` · `selectors/` · `hooks/` · `supports/` · `protocol/` · `generated/`
  —— 无内容的目录不建（骨架需求 §8.3「空目录不留空文件占位」）；
- `index.ts` **逐项显式导出**，不用 `export *` 无差别转发（C-8）。

⚠️ `moduleName.ts` 与 `dependencies.ts` 的**现有形态不得改动** ——
它们是骨架六道门与入口可达断言的输入。

🔴 **`index.ts` 必须继续导出骨架期的三个符号**：
`moduleName` · `dependencyModuleNames` · `devDependencyModuleNames`。

**为什么**：`assembly` 的 `skeletonBootstrap.ts` 第 6 行
`import {moduleName} from '@catering-v2s/kernel-base-contracts'` **直接依赖它**。
删掉或改名会同时打断**入口可达断言**与 assembly 的 `typecheck`。
新增 §4.1 七组的导出是**追加**，不是替换。

---

## 8 · 测试与验收

### 8.1 一键测全部（Dexter 要求）

`apps/terminal/package.json` **已有** `test` 脚本
（`turbo run test --filter='./apps/terminal/**' --filter='!@catering-v2s/terminal'`）。

🔴 **但它现在跑不绿，有两个独立原因，必须一起解决。**

#### 问题一 · 5 个 adapter 零测试文件，jest 直接 exit 1

`adapter/android/*` 的 `test` 是 `node internal/module_scripts/test.js`（spawn jest，
`preset: jest-expo`、`roots: ["<rootDir>/src"]`），而它们 `src/` 下**只有
`moduleName.ts` / `dependencies.ts` / `index.ts`，零测试文件** ——
**jest 找不到测试默认 exit 1**。

**要求**：让 `yarn workspace @catering-v2s/terminal test` **在本批之后可以全绿**，
且**零测试的包不得伪装成有测试**：

- 有测试的包（本批只有 `contracts`）：真实跑，真实断言；
- 无测试的包：`test` 必须**成功退出并明确打印"本包尚无测试"**（形态由 Codex 定），
  不得靠"找不到测试就当过"的默认行为蒙混。

⚠️ **`test` 全绿 ≠ 覆盖充分。** 哪个包该有测试由它自己的需求文档规定，
不由 runner 的退出码决定。交付报告必须写明**本批有真实测试的包数 = 1**。

#### 问题二 · 5 个 adapter 的 `devDependencies` 混了三个 SDK 世代

**仓内事实**（我逐包读 `package.json` 核过，5 个 adapter 声明完全相同）：

| 依赖 | 现在 | 属于 |
|---|---|---|
| `expo` | `^57.0.17` | SDK 57 |
| `jest-expo` | `~55.0.9` | **SDK 55** |
| `babel-preset-expo` | `~55.0.8` | **SDK 55** |
| `react-native` | `0.82.1` | 比 SDK 57 的 `0.86.3` 落后四个小版本 |
| `@types/react` | `~19.1.1` | TER 其余部分是 `~19.2.2` |

**SDK 号对应关系已由上游确认**：`babel-preset-expo` 在 npm 上有明确的
`sdk-55: 55.0.25` 与 `sdk-56: 56.0.20` dist-tag ——
所以 `~55.0.8` 确实是 SDK 55 的，不是推断。

**已经在冒烟**：`doc/evidence/platform/terminal-skeleton/batch-1/cp4-adapter-codex.md`
第 190–200 行记录了安装期真实输出 ——
`does not provide react-refresh, requested by babel-preset-expo`，
根因就是 SDK 55 的 preset 在 SDK 57 工程里要一个对不上的 peer。

**最硬的一条依据**：`jest-expo@57.0.5` 的 `peerDependencies` 含
**`@react-native/jest-preset: ^0.86.3`** —— 它期望的宿主 RN 就是 `0.86.3`，
**adapter 现在的 `0.82.1` 不满足这个 peer**。
这不是"对齐比较整齐"，是**版本约束本身不成立**。

**要求**：把 5 个 adapter 的 devDeps 对齐到 SDK 57：

| 依赖 | 改成 | 说明 |
|---|---|---|
| `expo` | `~57.0.18` | 与 assembly 一致 |
| `react-native` | `0.86.3` | SDK 57 模板锁定值；满足 jest-expo 的 peer |
| `jest-expo` | `~57.0.5` | npm `latest` |
| `babel-preset-expo` | `~57.0.9` | npm `latest` |
| `@types/react` | `~19.2.2` | 与 ui / assembly 一致 |
| `jest` | **不变**（`^29.7.0`） | `jest-expo@57.0.5` 的依赖仍是 jest 29.x 系，**升 30 会破** |
| `typescript` | 不变（`~6.0.3`） | 已一致 |
| `peerDependencies` | **不变**（`react: *` / `react-native: *` / `expo: *`） | expo-module 惯例，宿主提供，本来就对 |

🔴 **来源权威分三类，不得一律说「走 `expo install`」**（本文原表述与骨架需求冲突，现更正）。

骨架需求已把版本来源分成集合 A 与集合 B：**集合 A**（`expo` · `expo-status-bar` ·
`react` · `react-native` · `typescript` · `@types/react`）以**该精确 template 的发布 raw manifest 为权威**；
**集合 B**（UI 专有依赖）必须由 `npx expo install` 取得 SDK-aware 映射。
而 adapter 的 devDeps 里还有**第三类**：`jest-expo` 与 `babel-preset-expo` ——
它们既不在 app template 的 raw manifest 里，也不是 UI 专有依赖。

| 依赖 | 来源权威 | 目标值 |
|---|---|---|
| `expo` · `react-native` · `@types/react` · `typescript` | **集合 A** —— 当次 app template 的 raw manifest | 与 assembly 一致 |
| `jest-expo` · `babel-preset-expo` | **第三类** —— 由 `npx expo install` 在该 adapter 包内解析 | SDK 57 的对应值 |
| `jest` | **不动** | `^29.7.0` |
| `peerDependencies` | **不动** | `*` |

⚠️ **预期解析结果**（`jest-expo ~57.0.5` · `babel-preset-expo ~57.0.9`）
只用于对账；实际与它不符时**以当次解析为准并说明**。
⚠️ 若 latest template 版本在执行期滚动，**集合 A 与第三类必须同批重取**，
不得 A 用旧快照而第三类用新解析。

**执行规格（必须写死，不得现场发挥）**：

- **cwd**：逐个 adapter 包目录，**不在仓根执行**；
- **顺序**：`persist-kv` → `device` → `app-control` → `logger` → `dual-screen`，
  **第一个成功并核对无误后再做其余四个**；
- **写入面**：只允许改该包 `package.json` 的 `devDependencies`；
  **`peerDependencies` / `dependencies` / native 目录 / Gradle 配置一律不动**；
- **命令形态**：`npx expo install --dev <pkg>...` —— **必须显式列出包名**
  （`jest-expo` · `babel-preset-expo`），**不得裸跑 `expo install`**（那会按 manifest 全量对齐，
  写入面失控）；**不得用 `--fix`**（它会改本包全部依赖，超出本批写入面）；
- **lockfile 边界**：`yarn.lock` 由 Yarn 生成，**不得手改**；
  五个包全部改完后**统一安装一次**，不要每包各装一次；
  安装若因供应链或网络失败，保留首败，**不得改动保护设置**；
- **停机**：任一 `expo install` 非零退出**立即停止**，保留首败与完整 stdout/stderr，
  **不得手写版本兜底**；
- **证据**：每个包记录 cwd、确切命令、CLI 版本、退出码、改动前后的 `devDependencies` diff。

🔴 **已知外部阻断（Codex 2026-08-29 实跑，本轮新增事实）**：
在 scratch 中跑 `create-expo-module` 时，模板下载与生成成功，
但其内置的 npm install 阶段 **exit 1**：

```text
npm error code EALLOWSCRIPTS
npm error --allow-scripts is not allowed in project-scoped installs.
```

⇒ **脚手架的完整安装闭包目前 `UNVERIFIED_REQUIRES_EVIDENCE`。**
本批只改已入仓 5 个 adapter 的 `devDependencies`，**不重跑脚手架**，
因此不受该阻断影响；但**不得据此声称脚手架闭包已解除**。

⚠️ **这不违反「走官方路径不手搓」。** 那条约束的是 **native 工程结构**
（Gradle、manifest、autolinking、`expo-module.config.json`）—— 那些必须原样来自官方。
而 devDeps 里的 RN / jest-expo / babel-preset / @types 是**我们自己包的开发工具链版本**，
与 native 结构无关。

**为什么现在改**：adapter 的 `src/` 目前零 RN import，所以类型偏移还没显形；
一旦写真实代码就是跨工作区类型偏移，**现在是 5 行，那时是 5 个包的返工**。

**证据档位，两档分开记**：

- **归因：`CONFIRMED`** —— Codex 已取得 `expo-module-template@57.0.9` 的 tarball 静态元数据，
  并在 scratch 中观察到生成物 manifest 含 `jest-expo ~55.0.9` · `babel-preset-expo ~55.0.8` ·
  `react-native 0.82.1` · `expo ^57.0.17`。**这些 devDeps 来自上游模板，不是实施者所写。**
- **脚手架完整安装闭包：`UNVERIFIED_REQUIRES_EVIDENCE`** —— 生成后的 npm install 阶段
  以 `EALLOWSCRIPTS` 退出 1（见上）。**本批不重跑脚手架，不受影响，但不得声称闭包已解除。**
- **latest 漂移**：目标值取自 2026-08-29 的 npm `latest`，执行期须重取。

### 8.2 contracts 的测试道次

- runner **vitest `4.1.10`**（与 v2s 主仓一致，骨架需求 §3）；
- 环境 **node** —— contracts 零 React/RN，这是它能在 node 直接测的前提，
  也是 `kernel` 平台独立性门的验证手段之一。

### 8.3 必须有的断言（每条正反成对）

| # | 对象 | 正断言 | 反断言 |
|---|---|---|---|
| T-1 | branded ID | 各 `create*` 产出以对应前缀开头 | **把 `RequestId` 传进要 `CommandId` 的位置必须编译失败**（类型层负夹具） |
| T-2 | 前缀表 | 九种 kind 各有前缀且互不相同 | —— **集合一致性由 C-5 的门保证，不在测试里重复** |
| T-3 | 错误模板 | 参数齐全 ⇒ 渲染完整无占位 | **缺参数 ⇒ 含可辨识标记且缺失 key 可读**（§6.2） |
| T-4 | `isAppError` | 合法 `AppError` ⇒ true | 缺任一必需字段 ⇒ false（逐字段各一条） |
| T-5 | 定义工厂 | key = `${moduleName}.${localKey}` | 同名 localKey 在不同 module 下 key 不相同 |
| T-6 | `ResolvedParameter.source` | 三个来源 literal 各自可构造 | **`catalog-fallback` 与 `default` 是不同的闭集成员，不得退化或混同**。本包没有 resolver，故本条不声称「远端值非法」行为已经实现；该行为在 resolver owner 落地时以真实 invalid-remote 输入验证 |
| T-7 | 纯函数确定性 | 除 `nowTimestampMs`、ID 生成一族与 **`createAppError`**（正本 `TR-06` 已点名的第 ② 类派生构造器）外，同输入两次调用结果全等 | —— |
| T-8 | **`createdAt` 可精确断言** | 用 vitest 假时钟（`vi.setSystemTime`）固定时间后，`createAppError` 的 `createdAt` **等于该精确值** | 不得退化成 `typeof createdAt === 'number'` |
| T-9 | ID 唯一性与前缀 | 连续生成多个同类 ID 互不相同，且全部以对应前缀开头 | —— |

⚠️ **T-1 的反断言是类型层的**，需要一个「预期编译失败」的形态
（`@ts-expect-error` 或等价机制）。**不得用运行时断言冒充类型断言。**

### 8.3b 【必须】消费者编译闭包 —— 堵住「全绿但根契约没用」

🔴 **T-1…T-9 只测 contracts 自己，没有任何一条要求消费者真的用它。**

**可复现的 false-green**：实现者写出错误或不完整的类型，
本包九条断言、四道静态门与导出清单全部通过；
而 10 个消费者与 assembly bootstrap **仍然只 import `moduleName`**，
于是图门与 Metro 也照样绿 —— **根契约从未被任何消费者编译验证过**。

**要求**：新增一个**消费者编译夹具**（`test/` 下，类型层，不要求运行时行为），
从**公开面**（`src/index.ts`，即 `exports` 指向的那个入口）import §4.1 的**七组全部**，
并至少断言：

| # | 断言 | 形态 |
|---|---|---|
| F-1 | `AppModule` 可在**不提供 `packageVersion`** 时构造 | 正向编译通过（§6.3 的差异由它兜住） |
| F-2 | 两种不同 branded ID **不可互传** | `@ts-expect-error` 负夹具 |
| F-3 | `RequestLifecycleSnapshot` / `CommandRouteContext` / `TransportServerConfig` / `AppError` / `ParameterDefinition` **各能构造一个完整合法值** | 正向编译通过 |
| F-4 | §6.4 处置为 A（泛型化）的每一处，**泛型参数真的收窄了类型** | `@ts-expect-error` 负夹具：传错类型必须编译失败 |

⚠️ **F-4 是 §6.4 的验收手段。** 没有它，「泛型化」可以退化成
「把 `Record<string, unknown>` 换个名字」而无人发现。

🔴 **F-1…F-4 必须真的进 `typecheck`，否则整组是摆设。**

**当前事实**：`apps/terminal/kernel/base/contracts/tsconfig.json` 的
`include` 是 `["src/**/*.ts"]` —— **`test/` 不在编译面内**。
夹具放 `test/` 下而不改 tsconfig，`@ts-expect-error` 永远不会被求值，
F-2 与 F-4 两条负夹具**形同不存在**，而 §8.4 判据 4b 却会显示通过。

**要求**：本包的 `typecheck` 必须**实际编译 `test/**`**。两种形态任选：
① 扩展现有 `tsconfig.json` 的 `include` 覆盖 `test/**/*.ts`；
② 新增 `tsconfig.test.json` 并让 `typecheck` 脚本**同时**跑两个 tsconfig。

⚠️ **验收必须证明它真的生效**：把 F-2 的 `@ts-expect-error` 注释删掉一行，
`typecheck` **必须变红**。没有这个反向控制，就无法区分
「负夹具通过」与「负夹具根本没被编译」。

⚠️ **这只是编译闭包，不是消费者真实使用。** 真正的证明在 `platform-ports` 那批 ——
它是第一个会真实消费 contracts 语义类型的包。本批必须如实记录这一点。

### 8.4 验收判据

| # | 判据 | 不通过的表现 |
|---|---|---|
| 1 | `dependencies` / `peerDependencies` 为空，源码零 `@catering-v2s/*` import | 有任何出边 |
| 2 | 源码零 `fetch` / `localStorage` / `AsyncStorage` / `process` / 文件系统 / 原生模块访问（C-2 门）。⚠️ `Date.now` / `Math.random` / `crypto` 允许 | 出现任何需适配器提供的能力访问 |
| 3 | `index.ts` 的导出清单**逐项等于详设产出的精确导出清单**，且该清单与 §4.1 七组一一对应，无 `export *` 无差别转发 | 多导出、或用通配转发；**或详设没产出精确清单，导致对账无基准** |
| 4 | §8.3 的 **T-1…T-9 九条**全部存在，凡标了反断言的必须成对；T-1 反断言是类型层 | 缺任一条；或用运行时断言冒充类型断言 |
| 4b | §8.3b 的**消费者编译夹具 F-1…F-4 全部存在**，F-2/F-4 是 `@ts-expect-error` 负夹具 | 只测了 contracts 自己 ⇒ 根契约可以写错而全绿 |
| 4c | **`typecheck` 实际编译 `test/**`**，且反向控制通过：删掉 F-2 的一行 `@ts-expect-error` 后 `typecheck` **变红** | `tsconfig` 的 `include` 仍只有 `src/**` ⇒ 负夹具从未被求值，4b 是假绿 |
| 5 | `yarn workspace @catering-v2s/terminal test` **全绿**，且报告写明真实有测试的包数 = 1 | 因 adapter 无测试而红；或把"零测试"报成"已覆盖" |
| 5b | 5 个 adapter 的 devDeps **无跨 SDK 世代混用**：`jest-expo` / `babel-preset-expo` 主版本为 57，`react-native` 为 `0.86.3`，`@types/react` 为 `~19.2.2`；`peerDependencies` 保持 `*` 未被改动 | 仍留 SDK 55 的测试工具链；或误改了 `peerDependencies` |
| 6 | 骨架六道门与入口可达断言**仍全绿** | 改动 `moduleName.ts` / `dependencies.ts` 破坏了骨架断言 |
| 7 | 新增门（**C-2 / C-4b / C-5 / C-6 四道**）建成且**正负控制都过** | 只验红夹具没验真实树；**或漏建 C-4b 却声称判据 7 通过** |

---

## 9 · 明确不做的

| 项 | 为什么 |
|---|---|
| topology 握手 / 兼容性裁决 / state-sync / 投影镜像 / command 跨节点信封 | 对手方不存在（§4.2） |
| `protocol/` 二次筛选出口 | 现在建是空壳；设计意图已登记，第一个跨节点协议对象出现时同批建 |
| `packageVersion` / `protocolVersion` | 无生成器 / 无消费者（§6.3） |
| 通用工具函数（字符串、集合、日期格式化…） | 没有"跨包必须一致"属性，属于用得到的那个包 |
| 任何运行时状态、slice、actor、command 实现 | `plannedKind: toolkit` |
| 存储 / 网络 / 设备 / 原生模块访问 | 需要适配器提供，归 `platform-ports`（§6.1）。**时间与随机数不在此列**，它们留在本包 |

---

## 10 · 裁决记录

**D-1 · 时间与随机数是否移出 contracts —— Dexter 2026-08-29 裁定：不移出，留在本包。**

Claude 的移出提案**已撤回并判为过度设计**，理由见 §6.1。
由此收窄了 C-2 的门：**JS 运行时自带的允许，需要适配器提供的禁止**。

**§6.2（模板缺参数保留占位并可观测）与 §6.3（版本常量本批不建）—— Dexter 已同意。**

**D-2 · 建设顺序：contracts 先于 platform-ports —— 已确认正确。**

Claude 曾提出「是否该先做 platform-ports」的疑问（担心端口形状反向要求 contracts 提供别的类型）。
Codex 独立复核后 `REJECTED_WITH_EVIDENCE`：当前 `skeleton-graph.ts` 与 POC 都显示
**platform-ports 依赖 contracts，反向边不存在**。POC 实测 platform-ports
只从 contracts import `nowTimestampMs`。**顺序不变。**

其余（§4 的进/推迟、§7 的包结构）按判别式自行决定，如有异议请指出。

**D-3 · `T-6` 只验判别式，不在 contracts 增建 resolver —— Codex 设计审查处置，2026-08-30。**

第一轮独立设计审查确认：原 T-6 把「远端值非法 → `catalog-fallback`」写成了本包行为判据，
但 §4.1 的精确范围没有 resolver，§2.2 又禁止把 contracts 变成运行时/工具总集；按原字面可出现
「只构造 literal 就声称 resolver 行为通过」的假绿。两种修复中，**不选在根包新增 `resolveParameter`**：
POC 的该行为属于 `definition-registry`，TER 的实际 owner 尚未落地，提前搬进唯一零依赖根会扩大公开面并冻结
`UNVERIFIED_TER_NEED`。因此本批只证明三值闭集与可区分性；真实 invalid-remote 分支随未来 resolver owner
同批实现和验证。不得把 T-6 PASS 表述成参数解析行为已建成。

## 11 · 交付物

1. `contracts` 的 `src/types/` 与 `src/foundations/` 实现，`index.ts` 逐项显式导出；
2. `vitest.config.ts` 与 `test/`，覆盖 §8.3 的 **T-1…T-9 九条**断言，
   **外加 §8.3b 的消费者编译夹具 F-1…F-4**；
3. **四道门**：C-2 零适配器能力 · **C-4b `TR-05` 具名类型（本批首次有约束对象）** ·
   C-5 前缀表对拍 · C-6 闭集类型 —— 各自红夹具与真实树绿的记录；
4. **5 个 adapter 的两项处置**（§8.1），使 `apps/terminal` 的 `test` 可全绿：
   ① `test` 脚本在零测试时成功退出并明确打印"本包尚无测试"；
   ② devDeps 经 `npx expo install` 对齐到 SDK 57，并记录实际解析结果与上表的差异；
5. 实施记录，含：
   ① 逐项回答 §4.1 每个导出「为什么是共享词汇而非某包内部结构」并列已知消费者（C-4 评审清单）；
   ② **与 POC 的显式差异清单**，至少含 `AppModule.packageVersion` 改可选（§6.3）、
      `renderErrorTemplate` 缺参数不再静默（§6.2）、
      以及 **`TR-05` 的 13 处逐处处置**（A/B/C 各选了哪个、为什么，§6.4）；
   ②b **精确导出清单**，作为判据 3 的对账基准；
   ②c §3.3 四组 `UNVERIFIED_TER_NEED` 的档位如实带入，**不得升格为已证需求**；
   ②d 5 个 adapter 的 `devDependencies` 改动前后 diff、cwd、命令、CLI 版本与退出码；
   ③ 标注组 5 / 组 6 **在 runtime 落地前不视为已冻结契约**（§4.1）；
   ④ 与本文任何偏差的说明。
