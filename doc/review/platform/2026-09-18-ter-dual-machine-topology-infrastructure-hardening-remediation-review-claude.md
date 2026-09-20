# TER 双机拓扑基建加固 · implementation remediation 复评

- 评审人:Claude｜日期:2026-09-18
- REVIEW_TARGET=IMPLEMENTATION(仅限本轮 remediation)
- 上轮:`doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-review-claude.md`(NO-GO,1/2/3)
- 方式:**逐行读源码与测试**,remediation 说明只作对照,不作结论来源

## 0. 结论

```
VERDICT=GO
M/S/N=0/0/2
```

**上轮 1M/2S 全部实质关闭**,三处修复我都回源亲验并独立复算过判据方向。两条 Note 均不阻塞。

⚠️ **GO 的范围严格限于本轮 remediation**。**不构成整体 implementation acceptance、release PASS、Web PASS、visual PASS 或 device PASS**。按 remediation 自身的标记,历史 CP-0～CP-4 与阶段一/二设备证据仍为 `OPEN_FOR_REMEDIATION_RERUN`。
⚠️ 需求正本由本评审人撰写,故对需求本身的判断不是独立评审;对实现的评审是独立的。
⚠️ 本轮只读,零写入(本文件除外),未运行任何构建、测试、gradle、设备或网络动作。

## 1. 三处修复的逐条亲验

### 1.1 M-1 隐藏的 4,096 业务上限 —— CLOSED,且做法优于建议

**做法比我提的三选一更好**:没有拆成两份谓词,而是**一份实现 + 两个薄包装**:

- `topologyWire.ts:36` `isTopologyJsonValueWithArrayLimit(value, depth, maxArrayLength?)` —— 唯一实现;
- `:51-52` `isTopologyJsonValue(value, depth = 0)` —— **不传上限**,state 路径用;
- `:55` `isTopologyCommandPayload(value)` —— 传 `maxCommandArrayLength`,控制面用;
- `:22` 常量由 `maxJsonArrayLength` 改名为 **`maxCommandArrayLength`** —— 名字本身说清适用面,这是消除歧义的关键一步。

**分派正确(逐个调用点核过)**:

| 路径 | 落点 | 用的谓词 | 上限 |
|---|---|---|---|
| state 载荷(接收解码后) | `createTopologyModule.ts:77` | `isTopologyJsonValue` | **无数组上限** ✅ |
| state 载荷(transport 解压后) | `createTopologyStateTransfer.ts:306` | `isTopologyJsonValue` | **无数组上限** ✅ |
| `command-request.payload` | `topologyWire.ts:153` | `isTopologyCommandPayload` | 4,096 ✅ |
| `command-result.result` | `topologyWire.ts:161` | `isTopologyCommandPayload` | 4,096 ✅ |

**内存安全未被削弱**:去掉数组计数上限后,约束回到**字节**——发送侧与接收侧各一道 8 MiB(`createTopologyStateTransfer.ts:152` / `:223`)、单帧 64 KiB、深度 12、键长 256 仍全部生效。这正是上轮建议的方向:**让字节闸成为唯一的容量约束**。

**判据双向锁定(这是最关键的一点)**

`contracts/test/topologyWire.test.ts:63` 的用例名直接命名了缺陷 —— "does not turn state payload arrays into a hidden business cap while bounding command payload arrays"。同一个 4,097 元素数组:

- `expect(isTopologyJsonValue({members: largeMembers})).toBe(true)` —— state 路径**接受**;
- `expect(() => parseTopologyWireMessage(command-request with payload: largeMembers)).toThrow(/invalid topology command-request fields/)` —— 控制面**拒绝**。

⇒ 两个方向在同一条用例里同时锁住,任一侧回归都会红。

**端到端证据(最强的一种)**

`transport/test/stateTransfer.test.ts:82` "round trips a members state above the command array bound while remaining byte-bounded":构造 **4,097 条** members,并用**真实信封形状** `{mode:'authoritative', replaceMissing:true, entries:[{key:'state', value:{updatedAt:0, value:{members, pending:null}}}]}` —— 与 `sample-member-registry` 的 `slice.ts:43-47` 产出一致,不是简化替身。断言 `plan.status === 'ready'`、`canonicalBytes < 8 MiB`,再过重组器。

⇒ **上轮那个会静默停止同步的场景,现在端到端跑通。**

**字节闸仍在两侧**:`:110` "rejects an encoded payload above the reassembly bound **before allocating frames**" 用 43,000 条断言 `TOPOLOGY_REASSEMBLY_OVERFLOW` 且 `encodedBytes > 8 MiB`;紧随其后另有一条独立的接收侧用例。发送侧预检语义(超限零帧)被用例名显式钉住。

### 1.2 S-1 transport 重复 JSON 谓词 —— CLOSED

`createTopologyStateTransfer.ts:1` 现在 `import {… isTopologyJsonValue …} from '@catering-v2s/kernel-base-contracts'`,`:306` 直接使用;**本地副本已删除**。transport 本就依赖 contracts,依赖方向未反转。⇒ 全仓 topology 相关路径只剩**一份**谓词实现,"同名两份、标准不一"消失。

### 1.3 S-2 TopologySection 订阅边界 —— CLOSED,做法比建议更干净

`TopologySection.tsx:56` 现为:

```
const facts = useUiStateSelector<TopologyFacts | undefined>(selectTopologyFacts, areTopologyFactsEqual)
```

**直接把 root selector 交给 `useUiStateSelector`**,连 `useMemo` 包装都去掉了 —— 比我建议的写法更好:`selectTopologyFacts` 是模块级稳定引用,不再因 `capability` 变化而重建订阅。

**语义变化已核,无新缺陷**。返回 `undefined` 的条件从"未注入 capability"变成"root 无 topology 切片",两者不等价,我逐个分支核过:

- `:73` `capability?.getOperationEligibility(operation) ?? unavailableEligibility(operation)` —— capability 缺席时**所有操作落到不可用**;
- `:164`/`:186`/`:205`/`:218` 四个动作 handler 各自 `if (capability === undefined) return`;
- 展示侧全部 `facts?.` 并带兜底文案。

⇒ "有切片、无 capability"的组合现在是**只读展示 + 操作禁用**,比旧行为(全空)更好;"无切片"则 facts 为 `undefined`,走兜底,且 `selectTopologyFacts:31` 的 guard 保证不抛。`areTopologyFactsEqual` 对 `undefined/undefined` 经 `Object.is` 返回 true,不产生多余重渲染。

**判据补上了我指出的那个缺口**。`admin-shell/test/topologyInput.test.tsx:76-79`:

```
it('subscribes to root topology facts instead of the optional capability snapshot', …)
expect(selectorSpy).toHaveBeenCalledWith(selectTopologyFacts, expect.any(Function))
```

⇒ 直接断言**传给订阅的就是那个 root selector** —— 这是"约束来源"的正判据,正是我上轮自承 U-6 缺的那一条。回归到捕获 capability 的写法必红。

### 1.4 历史设备证据的标注 —— 正确

remediation 说明 `:6` 明写不把先前阶段一/二设备证据升级为本轮设备重验;`:9-10` 说明本轮未改 dual-screen handler、Android host、transport session 生命周期与受管 runner,旧设备证据可作行为支持材料但**产生在本轮源码改动之前**,本轮未重跑 native/device;`:97` 将历史 CP-0～CP-4 与阶段一/二设备证据标为 `OPEN_FOR_REMEDIATION_RERUN`。

⇒ 没有把旧证据洗成新证据,档位诚实。

## 2. Notes

### N-1 需求侧的 U-6 判据文本仍未更新

本轮的修复靠 `topologyInput.test.tsx:79` 那条断言锁住,**但需求 U-6 的文字仍是我上轮写的版本**("替换成会投出不同 facts 的 capability 后返回值随之改变"+"缺 slice 不抛")。该措辞对**捕获 capability 的实现同样成立**,所以单看需求判据仍抓不到回归。

⇒ 实现与测试已正确,**判据文本落后于实现**。建议把 U-6 补一条与该测试等价的正判据(传给订阅的 selector 必须是 root selector 本身),使需求、判据、测试三者一致。⚠️ 这是我上轮自承的判据缺陷的遗留,不记在实施方头上。

### N-2 上一轮的两条 Note 未在本轮处置(不属本轮 remediation 范围)

- checksum 为 FNV-1a 32 位覆盖最大 8 MiB 载荷,建议在详设写明其职责边界是"捕获重组逻辑缺陷"而非完整性保证;
- U-17 的"拆分后测试文件一行未改"仍需**冻结时刻 hash 与拆分后 hash 的对照**才能核验,本评审仍无该基线。

两条均为登记项,不阻塞本轮 GO;请在批次收口时一并处置。

## 3. 本轮核验范围与证据分档

**已逐行读过**:`topologyWire.ts` 的谓词定义区(`:17-56`)与全部调用点、`createTopologyStateTransfer.ts` 的 import 与 `:306`、`TopologySection.tsx:54-64` 与 `capability` 的全部用法、`contracts/test/topologyWire.test.ts:63-76`、`transport/test/stateTransfer.test.ts:78-124`、`admin-shell/test/topologyInput.test.tsx:1-80`、remediation 说明的证据档位段。

**独立核对**:四条谓词分派路径逐一确认;4,097 用例的信封形状与 `sample-member-registry/src/features/slices/slice.ts:43-47` 的真实产出比对一致;`areTopologyFactsEqual` 对 `undefined` 的行为;capability 缺席时的四个动作 handler 与 eligibility 兜底。

**证据分档(严格保留,未混写)**:
- `static` = 已完成(本文全部结论均为静态源码与测试文本核验);
- `focused` / `typecheck` / `terminal static` = **本评审未运行**。测试文件的**存在与断言内容**我读过并确认方向正确,但**运行结果**是实施方的证据,本文未以其作为结论依据,亦未复核其真伪;
- `Kotlin JVM` / `native/device` / `cleanup` = 本轮未涉及,历史证据按 remediation 自身标记仍为 `OPEN_FOR_REMEDIATION_RERUN`;
- 整体 acceptance / release / Web / visual / device = **不适用,未宣称**。

## 4. 授权边界

本评审只读,仅针对本轮 remediation。不扩大双机拓扑范围、不改变既有裁决、不授权额外设备、部署或 release 验收。**GO 表示这三处修复可以关闭上轮的 1M/2S**,不表示批次整体就绪;批次收口仍须处理 §2 的两条登记项与设备证据的重跑决定,由 Dexter 裁定。
