# TER `kernel.base.platform-ports` 详设与实施计划 · 独立 DESIGN review

| 字段 | 值 |
|---|---|
| REVIEW_TARGET | DESIGN（详设 + 实施计划） |
| 评审对象 | `doc/plans/platform/2026-08-30-...-implementation-design-codex.md`（1047 行）· `...-implementation-plan-codex.md`（290 行） |
| 冻结基线 | `...-platform-ports-requirements-claude.md`（已定稿，两轮 review 收口） |
| **VERDICT** | **GO** —— 条件：S-1、S-2 在 CP-1 开工前闭合 |
| M / S / N | **0 / 2 / 3** |
| 会话出处 | fresh v2s-rooted 静态评审。未运行任何测试、构建、设备或仓级命令 |

---

## 1 · 方案合理性（先于闭环正确）

**问题对不对：是。** 端口层作为 kernel 唯一外部入口、把 POC 在 TS 边界丢掉的类型找回来、
用四平台都能满足的抽象——这三件是真问题，不是为闭环造出来的。

**方案优不优：是，且多处比替代更简单。** 本轮特别认可四处**做减法**的判断：

- **11 → 10 端口**。`localWebServer` 按需求 §5.1 的五问逐项举证，四项失败后**不建、也不留空壳占位**
  （详设 §4、§4.1）。这是我在需求里定的规则第一次被真正执行，而且执行方向是删而不是加。
- **纯 factory，无 registry/seal**。`createPlatformPorts(bindings)` + `Object.freeze`，
  漏键编译不过；不造"seal 前取用"这个人为错误状态。
- **不建 codegen、不建运行期 schema 校验、不建可配置脱敏引擎**（§12）。
- **`display` 不建**，`surfaceKey` 只路由既有 surface（§4.3）——与 `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 一致。

**代价配不配：相称。** 1047 行里约 350 行是十个端口的类型块，即交付物本身；
§7.4 的三十余行五问表逐方法作答，不是填充。可删的重复只有一处（N-3）。

---

## 2 · Findings

### S-1 · `resetRuntime` 的 accepted 终态相关性没有 typed 载体

**事实类别**：仓内设计事实 + 可复现推论。

**位置**：详设第 173-177 行（`PortAccepted.terminalObservation`）、第 431 行
（`RuntimeResetInput.requestId`）、第 442 行、第 814 行（§7.4 `resetRuntime` 行）、
第 612 行起（`HotUpdateMarker`）。

**事实**：§7.4 第 814 行要求"accepted 后失败由 host lifecycle **以同一 `requestId`**
写入 successor-runtime 启动诊断，**不得只写无关联日志**"。
但本包公开面里，successor runtime 唯一能读回开机结果的通道是
`hotUpdate.readBootMarker / readActiveMarker / readRollbackMarker` → `HotUpdateMarker`，
而该类型（第 612 行起）有 `bootAttempt`、`lastBootAt`、`lastSuccessfulBootAt`、
`rollbackReason`、`failedBootAttempt`、`rolledBackAt`，**唯独没有 `requestId`**。
§10.2 的 exact export 清单也确认没有第二个携带 reset 相关性的公开类型。

**可证伪失败条件**：按本详设完整实现后，热更新消费者调用 `resetRuntime` 拿到 `accepted`，
其 VM 随即被替换；successor runtime 启动后调用 `readBootMarker`，
**得到的 marker 无法回答"这次开机是不是我那次 reset 造成的"**。
于是 §7.4 自己禁止的"无关联"状态成为唯一可实现的状态。

**影响面**：appControl 在 POC 里唯一的真实 kernel 消费者就是热更新装载
（`tdp-sync-runtime-v2/src/application/createModule.ts:175`），
而"这次开机是否来自我的 reset"正是 rollback 判断的输入。

**最小修复（二选一，都是一行级）**：
① 给 `HotUpdateMarker` 增 `resetRequestId?: RequestId`，让相关性落到公开类型上；
② 或把 §7.4 该行改成与 `exitApplication` 同样诚实的表述——终态在契约外由 host/supervisor 观察，
   并删掉"不得只写无关联日志"这句本包无法兑现的要求。

**为什么更小方案不足**：仅在 §7.4 补一句说明不够——现在缺的不是解释，
是**承载相关性的字段**。保留原句而不给载体，等于把一条不可实现的约束交给 adapter 批次去背。

**为什么不是 M**：需求 P-7 的硬判据是"答案落到公开结果类型、不得退回无判别的 `Promise<void>`"，
详设的判别式 union 已满足；本条是 §7.4 多写了一句兑现不了的话，不是判据未达标。
且 S 组测试不会因此假绿（S-1/S-2 只测 accepted ≠ succeeded，本就没声称测相关性）。

### S-2 · 同一个 surface 身份有两个名字，且都是裸 `string`

**事实类别**：仓内设计事实 + 跨包契约推论。

**位置**：详设第 119-121 行（§4.3）、第 433 行（`SurfaceActionInput.surfaceKey: string`）、
第 748 行（差异表"`displayIndex` 改被推进的 `surfaceKey`"）。

**事实**：§4.3 说宿主通过 `initialProps` 推入 `containerKey`，由 `kernel.base.display-context` 消费保存；
同一个被推进来的 key 到了 `appControl` 入参却叫 `surfaceKey`。
两者都是裸 `string`，`contracts` 的公开面里没有任何 surface/container 相关导出
（已核 `apps/terminal/kernel/base/contracts/src/index.ts`，零命中），
`kernel.base.display-context` 尚未建（batch 1，`skeleton-graph.ts` 里依赖为 contracts/state/runtime）。

**可证伪失败条件**：`display-context` 实施时自行定义 `containerKey` 的类型或取值空间；
调用方把 display-context 的 key 传进 `showNativeLoading({surfaceKey})`，
**两个 `string` 互相可赋值，编译期与四道门全绿**，运行期遮罩挂到错误的 surface 或找不到 surface。
§7.4 第 777 行把"找不到 `surfaceKey`"定为 `failed` 而非 unsupported——
说明这条路径确实预期会发生，但没有任何机制防止它由命名分裂引起。

**影响面**：跨包身份漂移。`contracts` 已为 `RequestId`/`CommandId`/`SessionId`/`ConnectionId`/`NodeId`
建了 branded ID，正是为了消除这一类缺陷；surface 身份是双屏架构的核心标识，却是唯一没有品牌的。

**最小修复**：**本批统一命名为 `containerKey`**（§4.3 已用该名，改 appControl 一处即可），
并在 §12 登记：`display-context` 实施时若引入 branded surface 身份，
本包 `SurfaceActionInput` 随之改用该 brand。

**为什么更小方案不足**：只在文档里写一句"两者是同一个 key"不足以阻止赋值——
类型系统看到的仍是两个 `string`。而现在改名的代价是一处字段名 + §10.2 一个导出名；
实施完成后再改，要动 appControl 全部签名与 exact-export 清单。
**这是本批唯一一次零成本定名的机会。**

### N-1 · `PortUnavailable.capability` 是开放 `string`，D 组未把它钉死

**位置**：详设第 142、156、163 行；§8.2 D-3…D-10。

`port` 是闭集 `PlatformPortName`，`capability` 却是裸 `string`。
D 组只说"返回本端口/能力"，没有说 `capability` 必须等于方法名。
⇒ 拼错的 capability（如 `'cal'`）能通过全部断言。
**最小修复**：在 §8.2 写明 `capability` 必须等于该端口方法名，D-3…D-10 逐方法断言相等。
不建议为此引入 per-port capability 闭集——那要给每个 result 类型加泛型参数，代价大于风险。

### N-2 · 需求写 11 端口、详设交 10，两份活文档没有一句收口

需求 §10 交付物写"11 个端口的类型声明"，详设按需求 §5.1 授权的举证条件收成 10。
两处都对，但没有任何一句说明"以 §4 举证为准"。
后来者对照会把 10 ≠ 11 当缺陷，或反手把 `localWebServer` 加回来。
**最小修复**：计划 §6 完成条件加一行——本批实际端口数 10，
依据详设 §4 的五问举证覆盖需求 §10 的 11 之数。

### N-3 · 详设 §13 与计划 §5 是两份近重复的停机清单

十条内容高度重合（找不到形状证据、五问答不出、localWeb 新证据、新依赖、改公开面、
connector 分类、exit/kiosk owner、改他包源码、门不红/不绿、动态运行）。
两份文档各存一份，日后必然漂移，且实施 agent 不知以哪份为准。
**最小修复**：计划 §5 改为引用详设 §13，只保留计划特有的第 9 条
（`test owner 不等于 7`）。这是本轮唯一找到的、删掉不损失反证能力的重复。

---

## 3 · 对提问项的逐条结论

| # | 提问 | 结论 |
|---|---|---|
| 1 | localWebServer 不建是否成立 | **成立**。四判别式逐条有据，且"不为未来假设占位"与需求 §5.1 一致 |
| 2 | result union 是否右尺寸 / terminalObservation 是否真可观察 | **union 右尺寸**（五态、timeout 不与 failed 并存、accepted 强制分支）。`exitApplication` 的契约外观察是诚实的；**`resetRuntime` 不是**——见 S-1 |
| 3 | 逐端口类型与自洽性 | **成立**。device 去 `batteryHealth`、闭集 `source`/`charging`、桌面无电池返 `'external'/'unknown'` 而非整端口不可用；script 单一 dispatcher + JSON 边界；connector opaque `channelKey` 与 taxonomy 推迟自洽 |
| 4 | appControl 六类是否完整且未越权 | **完整且未越权**。§6.4 与 §12 两处都写明只冻结 shape、只给 `ADAPTER_NOT_INJECTED`、不接线不实现真机 |
| 5 | logger 是否堵住全部 public bypass | **堵住了**。公开面无 `emit`；`LoggerBinding` 让 console 与 sink 都只收 sanitized event；L-13 覆盖四入口 + `scope/withContext` 派生；F-4/L-12 用 `@ts-expect-error` 钉死 `emit` 不可用。L 组覆盖上位标准全部禁记类别，且 L-11 有非敏感反例 |
| 6 | 各组用例能否证伪 | **能**。八个不可用默认要求逐方法迭代、明禁抽样；D-8 把"能力没有"与"marker 没有"分开；A-2 用 strict mode 重新赋值验证真冻结；C/F 进 `public-surface.typecheck.ts` 且经 `--listFilesOnly` 确认在编译面 |
| 7 | 四门与复用 contracts analyzer 是否会漂移 | **不会**。计划 §3.1 明令不得改 contracts 四门名/support 计数/输出/red vectors，且**先跑 contracts model+real 证零回归再复用**。四门 red mutation 各自定向、预期唯一首错；support 的 expected list 要求从详设逐名抄入、禁止源码自派生 |
| 8 | 计划是否让实施者无从走偏 | **是**。逐文件清单分新增/修改/明确不改；CP 内 GREEN 顺序固定；每 CP 有完成信号与数字（A=3/D=10/S=4/L=13、owners=7、REAL=2、NO_TEST=5）；§5 十条停机并明禁"按需设计/选择合适类型/视情况而定" |
| 9 | 是否仍有全绿但包没建成的路径 | **未发现新的**。三条旧路径已分别由 connector typed 契约、成功语义五问 + S 组、P-8 收窄堵住。残留风险一条：端口**多**一个方法时，机器门不管（P-3 只扫 optional），靠 F-2 的手写 exact list + 停机第 5 条约束——与 exact-export 同一档纪律，可接受 |
| 10 | 篇幅是否相称 | **相称**，可删重复只有 N-3 一处 |

**需 Dexter 裁决**：无新增。原有两项维持——`exit/kiosk` 的最终 owner 与产品授权
（详设 §6.4、§12 已正确保持 `DEXTER_DECISION` 未升格）。

---

## 4 · 本轮实际打开核过的文件

**核过**：两份待评文档（§0–13 全部章节，逐段读）；需求正本；
`doc/platform/terminal-coding-standard.md`（§3-A 第 366/375 行、第 173 行）；
`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`（§2 第 20 行）；
`project-memory/decisions/terminal-architecture-and-stack-rulings.md`（第 24-36 行）；
`apps/terminal/skeleton-graph.ts`（display-context 依赖、5 个 adapter 包）；
`apps/terminal/kernel/base/contracts/src/index.ts`（surface/container 零命中）；
`tools/terminal-skeleton/verify.mjs`（第 18、40-95、170 行）；
POC：`platform-ports/src/types/ports.ts`、`types/logging.ts`、`foundations/logger.ts`、
`test/scenarios/platform-ports.spec.ts`、`workflow-runtime-v2/src/foundations/connectorRuntime.ts`、
`AppControlTurboModule.kt`、`MainActivity.kt`、`TestHomeFragment.kt`、`ScriptEngineManager.kt`。

**未核**：`AGENTS.md`、`PLATFORM-BLUEPRINT.md`、
`project-memory/decisions/terminal-build-order-and-batches.md`、
`tools/terminal-contracts/check-static.mjs` 与 `tools/terminal-skeleton/verify-static.mjs`
（本轮未重开；前者在更早会话读过，其当前内容未在本轮亲验）。
⇒ **计划 §3.1 "复用 analyzer 不改 contracts 四门"这条，我核的是计划的约束表述，
不是 analyzer 现有代码结构是否支持无损提取。** 该点留 `UNVERIFIED_REQUIRES_EVIDENCE`，
由 CP-3 的"contracts 零回归"实测证明。

---

## 5 · 授权边界

本 `GO` 只表示这两份设计材料可交 Dexter 决定是否作为 platform-ports 的实施输入，
且以 S-1、S-2 在 CP-1 开工前闭合为条件。
不授权实施、不授权修改任何 TER 源码或其余 21 包、不授权 adapter/native、
不授权设备、仓级 normal verify、DEV、seed、reset、浏览器 L2、UAT 或部署。
静态 review 不构成任何动态或真机行为已被证明的结论。
