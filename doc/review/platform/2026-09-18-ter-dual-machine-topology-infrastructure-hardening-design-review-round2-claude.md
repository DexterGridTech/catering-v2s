# TER 双机拓扑基建加固 · DESIGN review 第二轮(详设 + 实施计划 + fixture family)

- 评审人:Claude｜日期:2026-09-18
- REVIEW_TARGET=DESIGN
- 对象:详设(`…-implementation-design-codex.md`)、实施计划(`…-implementation-plan-codex.md`)、`doc/plans/platform/fixtures/ter-dual-machine-members-fixture-manifest.json` 及其四份 fixture、交接稿(`…-design-review-handoff-codex.md`)
- 上轮:`doc/review/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-design-review-claude.md`(NO-GO,2/3/3)

## 0. 结论

```
VERDICT=GO
M/S/N=0/1/3
```

**上轮 2M/3S/3N 全部实质关闭**(逐条回源码、回 fixture 字节亲验,非采信修复说明)。新增 1 条 Significant 与 3 条 Note,均不阻塞 CP-0 起步;S-1 须在 **CP-2 之前**落到详设 §4.1。

⚠️ **独立性边界**:需求正本由本评审人撰写,故本文对需求本身的判断**不是独立评审**;对详设、实施计划与 fixture 的评审是独立的。

⚠️ **GO 的含义**:详设与实施计划可交 Dexter 决定是否进入实施。**不构成 implementation、runtime、focused、Kotlin、Android、设备、容量、release 或 cleanup 的任何 PASS**;本轮只读,零写入(本文件除外),未运行任何构建、测试、gradle、设备或网络动作。

## 1. 上轮 findings 的复核(逐条独立重算,非回读文档)

### 1.1 M-1 / M-2 —— fixture family 实测

我对四份落盘 fixture **重新独立计算**了文件字节、SHA-256、`recordCount`、`members` 规范化字节与其 SHA-256,并按详设 §4.1/§4.3 的规则(16 KiB 阈值、≥1024 字节且 ≥10% 节省闸、48 KiB 分片目标)复算 codec 分支与片数:

| fixture | 哈希/字节/条数 | 规范化字节 | codec 分支 | 片数 |
|---|---|---|---|---|
| capacity-v1(权威业务) | ✅ 逐项相符 | 62,389 ✅ | `zlib-base64`(节省 75.6%) | 1 |
| multi-chunk-stress-v1 | ✅ 逐项相符 | 466,323 ✅ | `zlib-base64`(节省 19.0%) | **8**(声称 ≥4) |
| low-compressibility-v2 | ✅ 逐项相符 | 24,048 ✅ | **`compression-not-beneficial`**(压缩后**反涨 27.1%**) | 1 |
| small-raw-v1 | ✅ 逐项相符 | 213 ✅ | **`below-threshold`** | 1 |

- **M-1 CLOSED**:multi-chunk fixture 实测 **8 片**,足以承接 U-8 的乱序/重复/丢片/半套不 apply/inflight/TTL 与 U-18 的 delayed multi-chunk;其 `name` 为 805 字符高熵、512/512 唯一(故只压 1.65×),形态与"物理压力"角色相称。overflow 改为固定 seed 程序化生成,并有**两道门**:计划 CP-0 第 8 步预演证明可超 8 MiB(§4.2 :129),U-10 要求"overflow generator 的实际 encodedBytes 必须超过 8 MiB",红变异含"仅用 disconnect 清理代替 overflow"。
- **M-2 CLOSED**:low-compressibility 真正落进 `compression-not-beneficial`(不是勉强通过闸门,而是压缩**使其变大**),small-raw 真正落进 `below-threshold`。两条 raw fallback 各有执行体。
- ✅ **权威业务 fixture 仍是 U-8/U-9 主数据源**:manifest 的 `authoritativeBusinessFixtureId` 指向 capacity-v1,`note` 明写辅助 fixture "only exercise physical boundary branches";详设 D-12 与 U-8 同述,U-8 的顺序是"先用权威 fixture 做完整逐字段 round-trip,再用 stress fixture 覆盖物理分支"。
- ✅ 计划 §9.1 的"只用高度重复的合成 payload 不能独立关闭任何 U"与现 fixture family **不再自相矛盾**。

### 1.2 S-1 / S-2 / S-3 与三条 Note

| 上轮 | 状态 | 亲验落点 |
|---|---|---|
| S-1 D-10 单数表述 | **CLOSED** | D-10 改为"按**当前在途 commandId 集合**分别记录取消标记,**不能实现成单槽**";红变异含"改成单槽";U-16 改为"并发发起多个远端命令,交叉取消不同 commandId";计划 §13 失败模式表亦登记。⚠️ 并如实注明"源码当前已用 Set",即对齐既有形态而非新增机制 —— 与我回源所见一致(`createTopologyModule.ts:187` 为 `new Set`) |
| S-2 信封字节当载荷 | **CLOSED** | manifest 与详设 §4.3 均已改用 **62,389**,并保留 `fileBytes` 与 `canonicalMembersUtf8Bytes` 两个独立字段;8 MiB 折算改述为"只能得到约 76,000 条同分布记录的**解释性量级**",且明写辅助 fixture "不参与业务容量推导" |
| S-3 fingerprint 删除后保证失去承载者 | **CLOSED** | 详设 §4.1 第 7 步重写:"阶段二允许暂存 fingerprint 作为发送去重实现细节,但跨阶段不把它当作 revision 正确性的 owner;阶段三按 R-11 删除序列化 fingerprint 后,仍必须先成功建立合法 transfer plan,再递增 `membersSyncRevision`……该不变量与 fingerprint 是否存在无关"。D-9 同步;**U-13 增加 `injected send failure`**,红变异为"把 revision 在 send 前递增";计划 §6.2:238 与 §7.1:284 呼应 |
| N-1 U-1/U-4 红变异档位 | **CLOSED** | 计划 U 矩阵 :356/:359 标注"document mutation,不是 production red"与"evidence-method mutation,不是 production red"。⚠️ 详设 §7 表格未同步该标注,但 CP-4 读的是计划矩阵,不构成 finding |
| N-2 limiter 与 control queue 混淆 | **CLOSED** | 计划 :240 专段区分:"limiter 是并发/速率限制;queue 是在同一 session 内让 ping/pong、cancel 等控制帧先于 data chunk,**不能以换名方式恢复 limiter**" |
| N-3 C-3 登记 | **CLOSED** | 跨层矩阵 :359 与计划 :218 均登记 `state-full` → `state-full-chunk`(含 `total=1`)为 INV-1 的 C-3,并明写"**不另造未批准的 C-6**" —— 这是正确的克制 |

## 2. Significant

### S-1 发送侧没有 encoded 总量预检,超限要先把约 8 MiB 推上局域网才失败

```
状态=CONFIRMED
严重度=S
owning source=详设 §4.1 发送顺序、§4.3 终态分类
适用条件=logical payload 的 encoded 总量超过 topologyReassemblyMaxBytes
需 Dexter 裁决=否
```

**仓内/文档事实**

- 详设 §4.1「发送顺序」共 7 步:序列化 → 阈值判定 → 压缩与节省闸 → codec 异常终态 → **按 48 KiB 切分** → checksum/transferId → revision 递增。**七步中没有任何一步把 encoded 总量与接收侧上限比对**。
- §4.1 parser 段落的上限只约束**单片**:"`encodedBytes` 超**单片** UTF-8 上限都 fail closed"。
- `topologyReassemblyMaxBytes = 8 * 1024 * 1024` 位于 **contracts typed config**(§4.3),⇒ **发送侧完全有能力读到它**。
- §4.3 把 "payload/reassembly size overflow" 列为 deterministic payload failure,但**没有说明在哪一侧检出**。

**反例(按现稿执行会怎么落空)**

一份 encoded 20 MiB 的 payload:发送侧照常切成约 427 片全部推出;接收侧在累计约 8 MiB 处触上限,产生 deterministic 终态。**正确性没有破**(D-13 兜住,不会循环),但:

- 局域网上白推约 8 MiB 才知道失败,POS 终端上是可感知的卡顿;
- U-10 要验 overflow 就必须真的把 8 MiB 推过 fake session,测试昂贵且慢;
- §4.3 的措辞歧义会让实施方合理地只实现接收侧一处,而详设读不出这是刻意的。

**最小修复**

§4.1 发送顺序在第 5 步(切分)**之前**增一步:若 encoded 总量 > `topologyReassemblyMaxBytes`,**本地直接产生同一 typed deterministic 终态,一片都不发**;§4.3 明写该 failure **两侧都可检出**,发送侧优先。U-10 相应要求**两个检出点各有一条断言**(发送侧快速失败、接收侧上限兜底),红变异为"删掉发送侧预检后仍须由接收侧变红"。

为什么不是更小方案:只在 §4.3 补一句"发送侧也可检出"不够 —— 发送顺序是实施方逐步照做的清单,不在清单里的步骤不会被实现。

## 3. Notes

### N-1 manifest 的 fflate 溯源标注不一致

`multi-chunk-stress-v1` 带 `minimumEncodedChunkCountAfterFflate: 4`,字面读作**已用 fflate 实测**;而 `overflow` 条目带 `fflateMeasurement: "CP-0_REQUIRED"`。交接稿则明写"请把 fixture 的 **node-zlib 预览**与 CP-0 必须完成的 **fflate 实测**分开" ⇒ 该 4 实为 zlib 预览下的保守下限,不是 fflate 实测。

本评审人用 `zlib.compress(data, 6)` 独立复算得 **8 片**,对 ≥4 有 2 倍余量,**结论稳健**;问题只在标注。建议给 multi-chunk 条目补同样的 `fflateMeasurement: CP-0_REQUIRED`,或加 `measurementMethod: node-zlib-preview`,使 manifest 自身可分辨预览与实测。

### N-2 low-compressibility fixture 是单条 15,114 字符 `name`,形态极端且只有 1 条记录

**仓内事实**:该 fixture 的唯一 member 为 `memberId` 10 字符、`phone` 11 字符、**`name` 15,114 字符的随机 Unicode**。

**已核为不阻塞**:`topologyWire.ts` 的 `maxTextLength = 256` 只作用于**键名**(`:26-28` 的 `key.length <= maxTextLength`),字符串**值**在 `:23` 直接返回 `true` ⇒ 该 fixture **能过 parser**,不会在进入 codec 前被拒。其 role 为 `supplemental-codec-boundary`,manifest 也未宣称它代表业务分布,属诚实标注。

**残留风险**:`recordCount = 1`。若实现存在**逐记录**处理缺陷(如按成员分块、逐条 checksum),单记录 fixture 不会暴露。建议改为多条高熵记录,或在 U-9 补一条"多记录高熵载荷同样落入 `compression-not-beneficial`"的断言。

### N-3 独立子 agent 盲审仍为 OPEN,本评审不能替代它

`doc/review/platform/…-design-adversarial-review-codex.json` 的 `status` 为 `OPEN`、`verdict` 为 `null`,并自陈"No fresh independent subagent verdict has been run in this artifact"。详设头部 `INDEPENDENT_SUBAGENT_REVIEW=OPEN` 亦如实声明。

这是**诚实披露而非隐瞒**,不计为缺陷。但须写明:`CLAUDE.md` 对 `REVIEW_TARGET=DESIGN` 要求 fresh 独立子 agent 盲审;**本评审是 Codex 交付物的独立外部评审,不是该治理条款所指的盲审产物**。⇒ 本轮 GO **不关闭**这一项,由 Codex/Dexter 决定是否在进入实施前补齐。

## 4. 对交接稿九项问题的直接回答

| # | 问题 | 结论 |
|---|---|---|
| 1 | 权威 fixture 是否仍是 U-8/U-9 主数据源 | ✅ 是。manifest `authoritativeBusinessFixtureId` + `note` + 详设 D-12/U-8 三处一致 |
| 2 | multi-chunk 经真实 fflate 是否至少 4 片 | ⚠️ **本轮以 node-zlib 复算得 8 片**,余量 2 倍,结论稳健;**fflate 实测仍属 CP-0**(见 N-1) |
| 3 | low / small 是否分别触发两个 raw fallback | ✅ 是。low 压缩后**反涨 27.1%**、small 仅 213 字节,均为真实触发而非勉强通过 |
| 4 | overflow generator 是否真实覆盖 8 MiB | ✅ 设计层面闭合:CP-0 第 8 步预演 + U-10 要求实际 encodedBytes 超 8 MiB + 红变异禁止用 disconnect 代替。⚠️ 实际生成属 CP-0/CP-2,本轮不判 PASS |
| 5 | U-13 是否证明发送失败不污染 revision | ✅ 是。§4.1 第 7 步 + D-9 + U-13 的 `injected send failure` + 红变异"把 revision 在 send 前递增" |
| 6 | U-16 是否覆盖并发交叉取消 | ✅ 是。D-10 明禁单槽,U-16 要求并发多命令交叉取消,红变异含"把取消实现成单槽" |
| 7 | C-3 登记是否正确 | ✅ 是,且**不另造未批准的 C-6** |
| 8 | 阶段二 control queue 会不会换名重建 limiter | ✅ 计划 :240 专段区分并明禁 |
| 9 | 三阶段 / 三维对账 / 逐代码对账是否闭合 | ✅ 闭合。步骤级(每 CP 后 fresh 只读子 agent)、全批(CP-3 后、整体测试前,禁止引用"已经看过")、逐代码逐行映射到详设 §4/§5/§7/§8/§9,三者明写互不替代,任一 OPEN 即"实施未就绪" |

## 5. 本轮核验范围与未验

**已独立重算/亲验**:四份 fixture 的 `fileBytes`、`fileSha256`、`recordCount`、`canonicalMembersUtf8Bytes`、`canonicalMembersSha256`;按详设规则复算的 codec 分支与片数(含 raw 路径对照);low-compressibility fixture 的字段形态;multi-chunk fixture 的 `name` 熵与唯一性;`topologyWire.ts` 的 `maxTextLength` 作用域(键名 vs 值);`createTopologyModule.ts` 的 cancel 集合形态;详设与计划全文;manifest、交接稿、adversarial-review JSON。

**未验 / UNVERIFIED**:
1. **fflate 0.8.3 的实际压缩结果** —— 本轮仍用 Python `zlib.compress(data, 6)` 近似,未逐字节比对。两者同为 DEFLATE 且层级相同,片数结论有 2 倍余量,但**精确值以 CP-0 的 fflate 实测为准**。
2. fflate 在本仓 Yarn/Expo/RN resolver 下的可用性 —— 详设标 `PRECHECK_REQUIRED` 并设 CP-0 停机条件,处理档位正确。
3. overflow generator 未实际运行;8 MiB 结论属设计承诺 + CP-0 预演门,本轮不判 PASS。
4. RN WebSocket 真实文本帧上限、OkHttp protocol pong、设备双屏恢复 —— 详设 §12 列为外部未决,档位正确。
5. 未逐条推演 U-1..U-18 全部 18 条反例;本轮重点核 D-12 family / U-8 / U-9 / U-10 / U-13 / U-16 / U-18 与 D-10 / D-13 一线。
6. 未运行任何构建、测试、gradle、设备或网络动作。

## 6. 授权边界

本评审只读。不授权修改源码、测试、依赖、脚本或构建产物;不授权 Web、Metro、Android、设备、DEV、seed、UAT、部署。**GO 只表示详设与实施计划可进入 Dexter 的实施决策**,不表示任何实现或验收结论;§2 的 S-1 须在 CP-2 之前落到详设 §4.1,§3 的 N-3 由 Codex/Dexter 决定是否在实施前补齐。
