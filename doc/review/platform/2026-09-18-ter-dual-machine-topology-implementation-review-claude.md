# TER 双机拓扑 · IMPLEMENTATION review

- 评审人:Claude｜日期:2026-09-18
- REVIEW_TARGET=IMPLEMENTATION
- 对象:需求正本、详设、实施计划、CP-5 执行证据、收口对账、`tools/terminal-topology/run-dual-device.mjs`,以及上述文档指向的当前源码

## 0. 结论

```
VERDICT=NO-GO
M/S/N=1/1/3
```

⚠️ **先说清楚 NO-GO 不是什么**:它**不是**"功能没做出来"。双机拓扑的核心业务问题**已经解决,并有真实设备证据**(见 §1)。唯一的 Major 是**账面与实物不符**:一个本该活过本批的底座包,其 README、详设、计划都声称了它并不具备的能力,而收口对账把该项判为 `MATCHED`。修复面很小(改文档口径或补原语),但不能带着一条错误的 `MATCHED` 进入 implementation acceptance。

⚠️ **两条独立性声明**:① 需求正本由本评审人撰写,故本文对**需求本身**的判断不是独立评审;② 按仓内协作约定,本轮由主 agent 完成,**不是 fresh 独立子 agent 盲审**。

⚠️ 本轮只读,未运行任何构建、测试、设备或动态动作。所有源码事实为当前字节的静态亲验。

## 1. 这件事要解决什么问题,解决了没有

**业务问题**:收银终端需要第二块面向顾客的显示面。原本只能靠"一台机器 + 两块物理屏";本批让**两台单屏机器**组成等效的主副屏,并要求二者**行为一致**。

**技术问题**:TER 此前"契约齐、运行时全缺"——无 HTTP/WS、无拓扑状态、命令只在本机执行(`defaultTarget` 默认 `local`)、副屏可用性只按本机物理屏数判定。

**解决了。** 设备证据是实的,不是结构断言:

- 阶段一(两台单屏 laptop,`emulator-5554`/`5556`)两个 profile 均 `business=PASS`、`cleanup=PASS`、`firstFailure=null`;timeline 覆盖 `master-host-started-via-enable-slave-chain`、`identity-before-ws-pair-and-slave-reset`、`single-master-single-slave-role-occupancy`、`disconnect-preserves-paired-and-secondary-semantics`、`reconnect-full-recovery`、`unpair-order-and-host-stop`。
- 跨机会员流程记录了**两侧真实 partKey**:pending 时 master `sample.desk.waiting-confirm` / slave `sample.desk.customer-member`;confirmed 时 master `sample.desk.member-list` / slave `sample.desk.customer-welcome`。
- 阶段二单机双屏(`emulator-5558`)逐步序列与阶段一对照 `MATCHED`、`missing=[]`,〔等价性裁定〕由此闭合。
- 阶段二 mobile 两个 App 的 topology tab 均真实可见、四个操作 `enabled=false`、reason 为「当前机型不支持双机拓扑」——与 D-1「恒显示、不做显隐」一致。

**三处我特意去证伪、结果站得住的设计**:

1. **命令路由优先级正确**:`createCommandDispatcher.ts` 的 `const target = options.target ?? input.resolveCommandTarget?.({...}) ?? definition.defaultTarget` —— resolver **排在 `defaultTarget` 之前**,D-19 真正生效。
2. **依赖方向没有被反转**:`runtime` **不依赖** `topology`;runtime 暴露 `CommandTargetResolver` 类型与可选注入点(`types/runtime.ts:61`、`createRuntime.ts:419`),由 topology 提供实现。接缝选得对。
3. **不是重复造轮子**:`evaluateTopologyOperation` 未复用 display-context 的两个资格函数,但二者答的是**不同的题**——display-context 管"本机能否改 role/mode"(写入准入),topology 管"管理员能否执行该拓扑操作"(操作可用性)。这正是 D-16 要求拆开的两件事。
4. **包结构没有自成一套**:`kernel/base/topology` 的 `application / features{actors,commands,slices} / foundations / selectors / types` 与 `display-context`、`ui-state` 完全同构。

## 2. Major

### M-1 `kernel.base.transport` 声称的能力在源码中不存在,而对账判为 MATCHED

```
状态=CONFIRMED
严重度=M
```

**仓内事实(当前字节)**

- `apps/terminal/kernel/base/transport/src` 共 **9 个文件、178 行**:`createTopologyIdentityClient.ts`(40)、`createTopologySession.ts`(46)、`types/{channel,session,identityClient}.ts`(39)、`application/createTransportModule.ts`(17)、`index/dependencies/moduleName`(18)。
- 对 `transport/src` 检索 `replaceServers|sticky|retry|backoff|cancel|heartbeat|failover` —— **零命中**;另一次检索 `heartbeat|Heartbeat|timeoutMs|cancelToken|abort` 在该包同样**零命中**。
- 该包 README 第一段:「负责一个拓扑连接的帧边界、协议 session、连接身份、**心跳与重连调度**」;第三段:「它只提供 transport 所需的 **bounded retry、取消和 heartbeat 原语**,拓扑 owner 决定何时使用它们」。
- 计划 §2 交付物表:「transport extensions | ... | frame、session、**heartbeat、retry、cancel、replaceServers**」;详设 §10.3:「transport 只负责 frame boundary、**cancel token**、connection identity、**heartbeat**、**replaceServers**、**sticky address**、**bounded retry**」。
- 收口对账 §3.1 的 R-7/R-8 行判 `MATCHED`,理由中明确援引「heartbeat」。

**能力的真实 owner(与文档不符)**

- 心跳取值在 `kernel/base/topology/src/features/actors/actors.ts:428-429`(`heartbeatIntervalMs: 10_000`、`heartbeatTimeoutMs: 30_000`),作为 config **传给原生宿主**执行。
- 调用超时 `topologyCallTimeoutMs = 5_000` 在同文件 `:41`。
- 重连退避 `reconnectMaxDelayMs = 10_000` 在 `kernel/base/topology/src/application/createTopologyModule.ts:61`。
- `cancel`、`retry`、`replaceServers`、`sticky address` 在三个包中**均无落点**。

**附带事实(同一条的证据)**

需求 R-7 要求新传输包**消费** `contracts` 既有的四个传输配置契约。实际检索 `TransportServerConfig|ResolveTransportServerConfigOptions` 全仓,除 `contracts/src/index.ts` 的导出与 `contracts/test/public-surface.typecheck.ts` 外**零消费方**;而 `createTopologyIdentityClient.ts:34` 把地址写成 `http://${host}:43172/terminal-topology/status` 的**字面模板**。⇒ 该包**无法服务任何第二个地址**,与「connection identity / replaceServers」的自述直接冲突。

**反例**

后续接远端服务器的工作按 transport README 去找 bounded retry / cancel / heartbeat 原语,会一个都找不到;按详设 §10.3 认为 `replaceServers`、`sticky address` 已在该包,同样落空。而收口对账的 `MATCHED` 会让下一批默认这些已经存在、无需重做。

**影响面**

这是本批唯一按裁决⑩ 要"活过本批"的底座。裁决原文是「按**通用形状**建,但不为证明通用制造第二个消费方」——不建第二个消费方是被允许的,**把端口写死进 URL 模板、且不消费既有配置契约,则不是"通用形状"**。

**最小修复(二选一,不得两边不一致却记 MATCHED)**

- (甲)把 README、详设 §10.3、计划 §2 的 transport 能力声明改为与实现一致(identity client + wire session),并把 heartbeat/timeout/backoff 的真实 owner 写清(topology + 原生);对账相应改为 `MATCHED`(已修正口径)或 `OPEN`。
- (乙)补齐 README 与详设所声称的原语,并让 identity client 消费 `contracts` 的传输配置契约而非写死地址。

⚠️ 无论走哪条,`TR-10`(项目记忆:README 示例必须回源码核过)要求 README 与源码一致;当前 transport README **不满足**该要求。

## 3. Significant

### S-1 固定端口 43172 没有单一住址,并被嵌进用户可见文案

```
状态=CONFIRMED
严重度=S
```

**仓内事实** —— 生产与工具落点共 **7 处**(不含测试):

- `apps/terminal/ui/base/admin-shell/src/components/sections/TopologySection.tsx:30` `const topologyPort = 43172`
- `apps/terminal/assembly/base/android/.../TerminalTopologyHostRegistry.kt:8` `private const val DEFAULT_PORT = 43172`
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts:426` `port: 43172`
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts:58` `const topologyPort = 43172`
- `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts:66` —— **写在用户可见文案里**:「服务端口 43172 被占用……」
- `apps/terminal/kernel/base/transport/src/foundations/createTopologyIdentityClient.ts:34` —— URL 模板
- `tools/terminal-topology/run-dual-device.mjs:12`

**与本批自述的冲突**:详设 §3 横切机制表有一行「**同一事实只有一个住址**」,禁止复制 union、禁止 UI 自算;D-21 又把 wire contract 的 owner 定为 `contracts`。固定端口属 wire contract 的一部分,却在 UI 包、Kotlin、两个 kernel 包与工具里各自声明。

**反例**:改端口时改了常量却漏了 `evaluateTopologyOperation.ts:66` 的文案,用户看到的报错仍写「43172」,而实际监听已变——错误信息把人引向错误的排查方向,且没有任何判据会变红。

**最小修复**:把端口(及 basePath)收进 `contracts` 的 wire 契约单一导出,其余六处改为引用;文案改为插值而非字面量。Kotlin 侧若无法直接引用,须在 D-21 的 golden vectors 里加一条端口一致性断言。

## 4. Notes

### N-1 六个终端 runner 各自复制设备操作层(仓级欠账,非本批发明)

`tools/terminal-sample2/` 已有 5 个 runner 各自实现 `adb` 包装、`dumpsys display`、`dumpsys SurfaceFlinger --displays`、`screencap`、`uiautomator dump`(例:`run-sample1-frozen-journey.mjs:109` 的 `const adb = ...`);本批新增的 `run-dual-device.mjs:198` 又写了一份。两者**不共享任何模块**,均只 import node 内置。`tools/terminal-shared/` 存在,但只有静态分析工具(`import-capabilities`、`package-invariants`、`typescript-analysis`、`closed-union-consumers`、`run-owned-tests`),**没有设备 helper**。

⇒ 本批**沿用了既有惯例而非发明新模式**,因此不要求本批重构。按右尺寸标尺登记为仓级欠账:设备操作层是否抽进 `tools/terminal-shared`,由 Dexter 决定何时做。

### N-2 `buildUiObserverDex` 是本批新增的自建机制

`run-dual-device.mjs:226` 自行构建并推送 UI observer dex,经 `CLASSPATH=...:/system/framework/uiautomator.jar` 运行;既有 runner 用的是普通 `uiautomator dump`。源码 `:19` 有注释说明理由(shell 侧 `uiautomator dump` 每次新建 UiAutomation)。技术理由成立,但这是新增的维护面,Dexter 宜知悉其存在。

### N-3 CP-5 独立对账的 fallback 合规,但两份正本措辞不一致

CP-5 证据 §8 记录两个 fresh verifier 均卡在 `running` 无 verdict,状态标为 `INDEPENDENT_REVIEW_STATUS=FAILED_TO_COMPLETE_MAIN_AGENT_FALLBACK`,由主 agent 完成同范围复核。

**该处置合规**:`doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md:132` 确有 `REVIEW_FALLBACK=MAIN_AGENT_AFTER_REPEATED_SUBAGENT_FAILURE`,并明令「不得冒充 `INDEPENDENT_SUBAGENT`」——本次**没有冒充**,如实标注。

⚠️ 但 `CLAUDE.md:97` 的措辞是「不得由作者会话自审自判……Claude 检查此边界但不允许作者自审替代独立子 agent」,未提该 fallback。两处口径不一致,建议在 CLAUDE.md 补一句指向正本第 132 行,免得后续评审按 CLAUDE.md 误判为违规。

## 5. 本轮核验范围与未验

**已回当前源码亲验**:transport 全部源文件与两个 foundation 全文;topology 包结构、`evaluateTopologyOperation`、`resolveCommandTarget`;`createCommandDispatcher` 的 target 解析优先级;runtime 是否反向依赖 topology;心跳/超时/退避的真实落点;43172 全仓枚举;`TransportServerConfig` 族的消费方;transport/topology 的 README 存在性与 transport README 正文;既有 runner 与新 runner 的能力重叠;治理正本第 132 行。

**已读**:CP-5 执行证据全文(200 行)、收口对账 §1–§4(含 R/D/plan/U 四张表)。

**未验**:未复跑任何 focused/native/设备动作,阶段一与阶段二的 `result.json`、timeline、UI XML、截图与 cleanup readback **未逐份打开**,本文对动态结果的引用来自证据文档的记述;未逐条推演 U-1 至 U-22 的红变异是否真能逮住对应缺陷(抽样核了 U-7、U-15、U-18、U-19、U-20、U-21);未核 Kotlin 侧 `TerminalTopologyServer.kt` 的实现细节;`tools/terminal-topology/run-dual-device.mjs` 只读了结构与 helper 分区,未通读 1831 行。

## 6. 授权边界

本评审只读。不授权修改源码、测试、脚本、依赖或构建产物;不授权实施、构建、Android、设备、Web、DEV、seed、UAT、部署或仓库控制动作。**本评审的结论不构成 implementation acceptance、release PASS 或产品验收 PASS**;是否接受实施由 Dexter 裁定。
