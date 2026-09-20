# TER 双机拓扑基建加固 · IMPLEMENTATION review

- 评审人:Claude｜日期:2026-09-18
- REVIEW_TARGET=IMPLEMENTATION｜依据详设与需求正本
- 方式:**逐行读源码**(Dexter 指示"不要只盯着交付证据"),证据文档只作对照,不作结论来源

## 0. 结论

```
VERDICT=NO-GO
M/S/N=1/2/3
```

⚠️ **独立性边界**:需求正本由本评审人撰写,故对需求本身的判断不是独立评审;对实现的评审是独立的。
⚠️ 保留披露:`INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER`。本文不是该治理条款所指的盲审产物。
⚠️ 本轮**只读**,零写入(本文件除外),未运行任何构建、测试、gradle、设备或网络动作。**不构成 implementation acceptance、release PASS、Web PASS 或 visual PASS**。

**唯一的 Major 是:这一批亲手引入了一条它自己立项要消灭的东西 —— 一条没写进任何文档、比对外宣称紧 18 倍、且没有任何测试能碰到的业务容量硬上限。** 其余实现质量相当高,详见 §1。

## 1. 逐行核过、确认做对的部分

| 需求 | 落点 | 亲验结论 |
|---|---|---|
| **S-1 发送侧预检**(上轮我提的) | `createTopologyStateTransfer.ts:151-153` | ✅ 溢出检查在分片循环**之前**,`return failure(...)` 时**一帧都未构建**;`failure()` 固定 `retryable:false, deterministic:true` |
| 双侧防御 | 同上 `:152` + 重组器 `:223` | ✅ 发送侧与接收侧各一道 `reassemblyMaxBytes` |
| 节省闸口径 | `:132-140` | ✅ 用 `rawBase64.length - compressedBase64.length` 同口径比较,**比详设"比 raw bytes 少"的措辞更准** —— 这才是真实线上节省 |
| **S-4 帧上限按字节** | `topologyWire.ts:24` `utf8ByteLength` | ✅ 真按 UTF-8 字节,不再是 `raw.length` |
| chunk 帧校验 | `topologyWire.ts:161-178` | ✅ exact-key、`index >= total` 拒、`total > 512` 拒、`rawBytes`/`encodedBytes` 受上限约束、codec 封闭 |
| **R-11 无关 slice 不构造** | `createTopologyStateSyncController.ts:66-67` | ✅ 引用相等闸在 `createFullSyncPayload`(`:74`)**之前** |
| **S-3 revision 不被污染**(上轮我提的) | 同上 `:79` / `:92` | ✅ `nextRevision` 是局部量,`membersSyncRevision = nextRevision` **只在 `result.status === 'ready'` 分支内** |
| payload 终态不关 session | `createTopologyModule.ts:409-425` | ✅ 走 `dispatchPayloadFailure` + `deterministic:true` + `lastReceivedPayloadFailureKey` 去重,**不调 `handlePeerLoss`** |
| 同一载荷不重试、新载荷自动解锁 | `createTopologyStateSyncController.ts:66`/`:100` | ✅ 用 `lastMembersFailureReference` 的引用身份实现,新引用天然解锁 |
| **R-16 心跳隔离** | `createTopologySession.ts:118`/`:127`/`:158` | ✅ 只在 `isClient` 挂;`onTimeout → input.onPeerTimeout?.()` 走普通 peer-loss,**不碰 payload terminal**;`pong → markPong` |
| **R-14 两个集合有界** | `createTopologyPeerCommandController.ts:130`/`:188` | ✅ `activeRemoteCommands` 与 `pendingPeerCommands` 均受 `peerCommandMaxInflight` 约束 |
| **并发 cancel 按集合**(上轮我提的) | 同上 `:62`/`:65-66`/`:108` | ✅ `cancelledRemoteCommands` 是 `Map<commandId, expiresAt>`,**不是单槽**,且带 TTL 过期 |
| **R-2 / R-3** | `TerminalTopologyServer.kt:18`/`:49-50` | ✅ `@Volatile` 已加;`hostAddress` 改为 `get() = hostAddressResolver()` 每次求值,且 resolver 可注入(`:40`)供 JVM test |
| **R-13** | `topology/src/foundations/topologyPeerWsUrl.ts`;`platform-ports/.../parseTopologyHostStatus.ts:51` | ✅ `topologyPeerWsUrl` 收敛为单一住址(两处 import);status parser 落在 **platform-ports**(正是 D-2 要的,不是 contracts),已进 `terminal-invariants.json`,旧手写 `hostStatusValue` 已消失 |
| **R-5** | `foundations/` 目录 | ✅ `createTransportLimiter` 已删;`resolveTransportServerAddresses` 与 `createTransportRetryController` 保留 |
| **R-1** | `HANDOFF.md` | ✅ 五行在册 |
| **D-1** | `selectTopologyFacts.ts:29-31` | ✅ 返回 `TopologyFacts \| undefined`,缺 slice 返回 `undefined`,不再调用会抛的 `selectTopologyState` |
| fixture family | manifest + 四份文件 | ✅ 文件字节、SHA-256、`recordCount`、canonical 字节与其哈希**逐项独立重算全部相符**;按**实现的真实公式**复算:capacity→`zlib-base64` 1 片、multi-chunk→8 片、low-compressibility(v3,已改 4 条)→`compression-not-beneficial`(节省 5.45% < 10%)、small-raw→`below-threshold` |
| fflate 实测 | manifest | ✅ 已补 `measurementMethod: "CP-0_ACTUAL: fflate 0.8.3"`、`measuredEncodedBytesAfterFflate: 392012`、`measuredChunkCountAfterFflate: 8`。与我 node-zlib 近似的 377,752 差 3.8%,**片数同为 8** —— 我那个近似至此收掉 |

## 2. Major

### M-1 本批新引入一条 4,096 条的业务容量硬上限:无文档、无配置、无测试、比对外宣称紧 18 倍

```
状态=CONFIRMED
严重度=M
owning source=contracts/src/foundations/topologyWire.ts:22、:40
需 Dexter 裁决=是(取舍见最小修复)
```

**源码事实(逐环打开读过)**

1. `topologyWire.ts:22` `const maxJsonArrayLength = 4_096` —— **模块私有常量,硬编码**。
2. `:40` `if (Array.isArray(value)) return value.length <= maxJsonArrayLength && …` —— 作用在 `isTopologyJsonValue` 的**每一层数组**上。
3. `createTopologyModule.ts:77` `if (!('value' in envelope) || !isTopologyJsonValue(envelope.value)) return undefined` —— 接收侧对 state-full 载荷的校验走的正是这个谓词。
4. `sample-member-registry/src/features/slices/slice.ts:41-48` 的 `sync.getEntries` 返回**单一 entry**(`key: "state"`),其 `value` 是**整个 `MemberState`**;`MemberState` 即 `{members: Member[], pending}`。

⇒ **`members` 数组直接落在这条 4,096 上限之下。**

**尚缺证据的假设(已排除)**:我曾怀疑 members 会按 key 逐条同步、从而上限只作用于成员对象内部的小数组。回源后不成立 —— `getEntries` 只产出一条 `state` entry。

**这是本批新增的**:本会话早前我读过改动前的 `topologyWire.ts`,当时的 `isJsonValue` 是 `value.every(item => isJsonValue(item, depth + 1))`,**没有任何数组长度上限**。

**反例(会怎么落空)**

会员数超过 4,096 时:`isTopologyJsonValue` 返回 false → `readSyncStateDiff` 返回 `undefined` → `createTopologyModule.ts:411-424` 派 `TOPOLOGY_DECODED_PAYLOAD_INVALID` 的 **deterministic 终态** → 该 revision 不再重试。连接、身份、心跳、其他 slice **全部正常**,UI 也还显示上一次成功的会员表。

⇒ **副机从此静默停止接收会员更新,而一切看起来都是健康的。** 每一个后续 revision 只要仍超 4,096 条,会以同样方式失败。

**影响面与自相矛盾**

- 详设 §4.3 对外宣称 8 MiB 重组上限"按权威 fixture 折算约 **76,000 条**同分布记录" —— 真实可用上限是 **4,096 条**,**紧约 18 倍**,而这个数字在需求、详设、实施计划里**零命中**。
- 它**不在** `topology-transport.config.json`,违反详设 §3 自己立的横切规则:"同一事实只有一个住址……新常量只在 contracts config;其他层只消费 projection"。
- **没有任何测试能碰到它**:四份 fixture 分别是 570 / 512 / 4 / 2 条,最大的也只有上限的 14%。U-8、U-9、U-10 全绿而这条天花板完全不可见。
- 需求 §0.1 把本批的立项理由写成"**基建不得把业务上限写死**";本实现在消灭 64 KiB 那条隐式上限的同时,**亲手换上了一条更紧的**。

**最小修复(三选一,需 Dexter 裁定量级)**

1. **去掉 state-full 路径上的数组长度上限**,让 8 MiB 字节闸成为唯一约束(字节闸已在发送与接收两侧,足以防 OOM)。`command-request`/`command-result` 路径可保留数组上限。
2. 保留上限但**移进 `topology-transport.config.json`** 成为 typed config,并把取值提高到与 8 MiB 一致的量级(或按字节推导),同时更新详设 §4.3 的容量表述。
3. 若刻意要 4,096 作为产品上限,则须**写进需求与 HANDOFF**、更正详设的 76,000 折算、并补一份 >4,096 条的 fixture 让 U-8 能证伪。

为什么不是更小方案:只改详设文字不够 —— 上限是真实生效的运行期行为,而当前没有任何判据能发现它被违反。

## 3. Significant

### S-1 transport 本地又出现一份 JSON 谓词,且与已导出的那份**标准不一**

```
状态=CONFIRMED
严重度=S
owning source=transport/src/foundations/createTopologyStateTransfer.ts:94、:316
```

**源码事实**

- contracts 已把强谓词**导出**:`topologyWire.ts:36` `export const isTopologyJsonValue`,`contracts/src/index.ts:56` 导出,`terminal-invariants.json` 已登记。
- 但 `createTopologyStateTransfer.ts:94` 又定义了一份**本地 `isJsonValue`**,在 `:316` 用于校验**解压重组后的载荷**。
- 两者**只差一个轴**:本地这份 `:98` 是 `value.every(...)`,**没有数组长度上限**;contracts 那份 `:40` 有 4,096 上限。

**反例**

同一份解码后的字节:在 transport `:316` **通过**(无数组上限),随后在 `createTopologyModule.ts:77` **被拒**(有 4,096 上限)。两道校验对同一份数据给出不同答案,而调用方无法从任一处读出真实标准。

这正是 R-12 立项要消灭的"**同名两份定义、标准不一**"形态 —— 旧的弱版本在 `createTopologyModule` 里确实删干净了,却在 transport 新长出一份。

**最小修复**:`createTopologyStateTransfer.ts` 改为 `import {isTopologyJsonValue} from '@catering-v2s/kernel-base-contracts'`(transport 已依赖 contracts,方向不反转),删除本地副本。M-1 的取舍落定后,两处自然同标准。

### S-2 R-9 未实现:`factsSelector` 仍捕获 capability、`_root` 仍未使用

```
状态=CONFIRMED
严重度=S
owning source=ui/base/admin-shell/src/components/sections/TopologySection.tsx:57-58
```

**源码事实**:`TopologySection.tsx:57-58` 当前为

```
const factsSelector = useMemo(
  () => (_root: StateRoot) => capability?.getSnapshot(),
  [capability],
)
```

与本批开始前**一字未改**。需求 R-9 要求"改用现成的 root selector",现成件 `selectTopologyFacts` 已由 `topology/src/index.ts` 导出且 `TopologySection.tsx:11` 已 import 同包。

**功能风险低**:`createTopologyAdminCapability.ts:123` 的 `getSnapshot` 就是 `selectTopologyFacts(runtime.getState())`,数据仍是 root 派生的,只是多一层间接。缺陷是**约定未落地**:selector 仍绕过"从 root 派生"的仓内惯例,形参仍是死参数。

⚠️ **我要如实说明一处我自己的责任**:U-6 是我在需求复评时改写的,它约束的是"替换 capability 后返回值随之改变"与"缺 slice 不抛" —— **当前实现两条都满足**,所以 **U-6 抓不到 R-9 未实现**。判据没能逮住它对应的那条需求,这是我的判据缺陷,不是实施方绕过判据。

**最小修复**:`factsSelector` 改为直接使用 `selectTopologyFacts`;U-6 补一条"selector 在 capability 为 `undefined` 时仍能从 root 得到 facts"的正判据 —— 这一条现实现必红。

## 4. Notes

### N-1 checksum 为 FNV-1a 32 位,覆盖最大 8 MiB 载荷

`createTopologyStateTransfer.ts:86-93` 的 `topologyChecksum` 是 FNV-1a 32。考虑到 TCP 与 WebSocket 帧已覆盖随机传输损坏,且按〔信任边界裁定〕无认证威胁模型,它的实际职责是**捕获重组逻辑缺陷**(乱序、重复、错拼),32 位对此够用。**不构成缺陷**,但建议在详设写明这是**刻意选择**及其职责边界,免得后来者误当作完整性保证。

### N-2 U-17 的"拆分后测试文件一行未改"本轮无法静态核验

`topology/test/topology.test.ts` 现为 **1,539 行 / 75 个 `it(`**(批前 926 行),`members` 44 处、`cancel` 12 处、`state-full` 6 处命中 —— 拆分前的行为网确实补上了。但"冻结后一行未改"需要比对**冻结时刻的 hash 记录**,本评审无该基线。请在交付证据中给出冻结 hash 与拆分后 hash 的对照。

### N-3 `INDEPENDENT_SUBAGENT_REVIEW=OPEN_DEXTER_WAIVER` 披露正确,须保留

详设头部与 JSON 均如实标注。本 review 是对实现的独立外部评审,**不是**治理条款所指的盲审产物;GO/NO-GO 都不关闭这一项。

## 5. 本轮核验范围与证据分档

**已逐行读过的源码**:`createTopologyStateTransfer.ts`(355 行的 codec/plan/reassembler 主干)、`createTopologyStateSyncController.ts`(128)、`createTopologyPeerCommandController.ts` 的集合与 cancel 路径、`createTopologySession.ts` 的心跳接线与 pong 路径、`createTopologyModule.ts` 的 `readSyncStateDiff` 与 state-full 接收段、`topologyWire.ts`(220,含 `isTopologyJsonValue`、`utf8ByteLength`、state-full-chunk 分支)、`selectTopologyFacts.ts` / `selectTopologyState.ts`、`TopologySection.tsx:55-62`、`createTopologyAdminCapability.ts:123`、`TerminalTopologyServer.kt` 的 `@Volatile`/`hostAddress`/`address()`、`parseTopologyHostStatus.ts`、member-registry 的 `slice.ts` sync 声明、`topology-transport.config.json`、`HANDOFF.md`。

**独立重算**:四份 fixture 的 fileBytes / SHA-256 / recordCount / canonical 字节 / canonical SHA-256;按**实现真实公式**复算的 codec 分支、encoded 字节与片数;单帧估算与 64 KiB 上限余量;`maxJsonArrayLength` 的全部引用点与 members 载荷路径。

**证据分档(严格保留,未混写)**:
- `static` = 已完成(本文全部结论均为静态源码核验)
- `focused` / `Kotlin JVM` / `native/device` / `cleanup` = **本评审未运行**,Codex 的阶段一/阶段二结果与 cleanup 属其证据,本文**未以其作为任何结论依据**,亦未复核其真伪
- 整体 acceptance / release / Web / visual = **不适用,未宣称**

**未验**:两个阶段的 `result.json`、timeline、UI XML、stepwise comparison 与 `cleanup-result.json` 的逐份读取 —— 按 Dexter 本轮指示,本评审把全部预算投在源码逐行核验上;证据文档的逐份复核未做,故对阶段一/阶段二的 PASS **不背书也不否定**。

## 6. 授权边界

本评审只读。不授权修改源码、测试、依赖、脚本或构建产物;不扩大需求、不改变 Dexter 已定裁决;不授权部署或产品验收。**NO-GO 指 M-1 关闭前不宜宣称 implementation 就绪**;是否放行由 Dexter 裁定。
