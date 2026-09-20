# TER 双机拓扑基建加固 · DESIGN review(详设 + 实施计划)

- 评审人:Claude｜日期:2026-09-18
- REVIEW_TARGET=DESIGN
- 对象:
  - `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-design-codex.md`(416 行)
  - `doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-implementation-plan-codex.md`(503 行)
  - `doc/plans/platform/fixtures/ter-dual-machine-members-capacity-fixture.json`(D-12 fixture)
- 需求正本:`doc/plans/platform/2026-09-18-ter-dual-machine-topology-infrastructure-hardening-requirements-claude.md`

## 0. 结论

```
VERDICT=NO-GO
M/S/N=2/3/3
```

⚠️ **独立性边界**:需求正本由本评审人撰写,故本文对需求本身的判断**不是独立评审**;对详设与实施计划的评审是独立的。

两条 Major 同源:**D-12 fixture 被指派了它在物理上无法产生的行为**。其余是跨阶段衔接与措辞精度问题。

**先说做得好的**(不计入 finding,但影响 severity 判断):三阶段串行与 R-15 最后的约束落实到 CP 门控;D-15 被真正放在 CP-0 第一步;`state-full-chunk` 即使 `total=1` 也用同一形状,避免两套解析语义;终态按 payload/slice 而非 session/peer,且 deterministic 与 transient 分码;R-16 明确不写 payload terminal;fflate 被正确识别为**全新直接依赖**并设了 CP-0 停机条件;§7 主动指出上游 U-15 与本稿 U-15 是两个命名空间 —— 这条是评审人自己没想到的。

## 1. 已亲验为真的事实(避免被读成整稿存疑)

| 详设声称 | 亲验结果 |
|---|---|
| fixture SHA-256 `05d7b073…5f19e58` | ✅ 逐字相符 |
| fixture 文件 90,556 字节 | ✅ 相符 |
| recordCount 570 | ✅ 相符 |
| 当前 transport 无 fflate/pako 直接依赖 | ✅ 全仓 `package.json` 零命中,`node_modules` 亦未安装 |
| Android base 的 Kotlin source set 只有 `main` | ✅ 相符(故 D-4 选 JVM test source set 成立) |
| `cancelledRemoteCommands` 在 settle 时被消费 | ✅ `createTopologyModule.ts:387` add、`:460`/`:472` delete |

## 2. Major

### M-1 D-12 fixture 无法产生多片 transfer,U-8 与 U-18 的整类断言没有执行体

```
状态=CONFIRMED
严重度=M
owning source=详设 §0.3 / §4.1 / §6.4;计划 §6.4
需 Dexter 裁决=否(实施方补 fixture 即可)
```

**仓内事实(本评审人独立计算,非采信文档)**

以 fixture 的 `members` 数组为 logical payload,按详设 §4.1 的规则逐步推:

| 步骤 | 结果 |
|---|---|
| 规范化 UTF-8 字节 | **62,389** |
| 压缩阈值 16 KiB(§4.3) | 触发 |
| zlib level 6 | 11,402 字节(压缩比 **5.47×**) |
| base64 后 encoded | **15,204** 字节 |
| 节省判定(≥1024 字节 且 ≥10%) | 节省 75.6% ⇒ 采用 `zlib-base64` |
| 按 48 KiB 目标切分(§4.1 步骤 5) | **1 片** |

**反例(按现稿执行会怎么落空)**

详设 §6.4 与计划 §6.4 把"**乱序 / 重复 chunk / 丢片 / 半套不 apply / overflow 终态**"全部派给"D-12 transfer,真实 570-member fixture"。而 `total=1` 时:

- 没有第二片可乱序;
- 没有片可丢;
- 没有半套状态可构造;
- 重组 map 只有一个 entry 即完成,`topologyReassemblyMaxInflightTransfers`、`topologyReassemblyTimeoutMs`、`topologyReassemblyMaxBytes` 三条上限**一条都走不到**。

⚠️ **同一根因还打掉 U-18 的第三条断言**:详设 §4.4 要求"chunk data queue 不能饿死 ping/pong control queue;U-18 用 fake clock + **delayed multi-chunk writes** 证明"。单片 transfer 造不出 multi-chunk write,该断言同样无数据源。

⚠️ **8 MiB 重组上限(§4.3)的 overflow 终态更彻底**:需要约 8,388,608 字节的载荷,fixture 只有 62,389 字节,**相差 134 倍**,而 §0.3 明写 fixture 是"U-8/U-9 的**唯一数据源**"。

**补充(降低而非消除严重度)**:若测试强制走 `raw-base64` 路径,同一 fixture 的 encoded 为 83,188 字节 ⇒ **2 片**。但 ① 详设未规定这种强制方式(§8.2 的 "forced codec" 指强制**开启** codec,不是强制关闭);② 2 片只够构造一个乱序对,不足以覆盖 inflight/TTL/overflow。

**最小修复**

D-12 从"单一 fixture"改为**一组具名 fixture**,各自绑定判据,且各自记录 hash 与规范化字节:

1. 当前 fixture ⇒ 只服务 U-9 的 codec round-trip 与 forced-codec;
2. **多片 fixture**(压缩后 encoded 明显超过若干个 48 KiB)⇒ 服务 U-8 的乱序/重复/丢片/半套/session generation 与 U-18 的 delayed multi-chunk;
3. **溢出构造**(≥8 MiB encoded,可由程序化生成而非落盘)⇒ 服务 overflow 终态。

为什么不是更小方案:只把 48 KiB 目标调小会让判据与生产配置脱钩,测出来的不是将要上线的行为。

### M-2 fixture 的压缩分布不具代表性,D-6 的两条 raw fallback 无执行体,且与计划 §9.1 自相矛盾

```
状态=CONFIRMED
严重度=M
owning source=详设 §0.3 / §4.1 步骤 2-3 / §5 D-6;计划 §6.4 / §9.1
需 Dexter 裁决=否
```

**仓内事实(独立统计 fixture 570 条)**

| 字段 | 唯一值数 | 形态 |
|---|---|---|
| `name` | **40 / 570** | 平均 3.4 字,重复度极高 |
| `memberId` | 570 | `M197102020001` —— 前缀 + 类日期 + 递增序号,高度结构化 |
| `phone` | 570 | `010-0000-7919` —— 固定前缀 `010-` + 递增 |
| `registeredAt` | 570 | 每条恰好 **+86,460,000**,严格等差 |
| `age` | 58 | — |

⇒ 实测压缩比 **5.47×**。

**外部对照事实**:Codex 自己在需求评审第一轮的实测结论是"高度重复数据约 19–40 倍;**真实变化数据只有约 2.36–2.73 倍**"。本 fixture 的 5.47× 更靠近"高度重复"一端,而非其自述的真实分布。

**反例**

- D-6 的节省闸(≥1,024 字节 **且** ≥10%)在本 fixture 上以 75.6% 轻松通过 ⇒ **`compression-not-beneficial` 分支永远走不到**;
- fixture 62,389 字节远超 16 KiB 阈值 ⇒ **`below-threshold` 分支也走不到**;
- 而详设 §8.2 与计划 §6.4 都把"compression-not-beneficial / below-threshold 两个 raw fallback"列为必测,**却没有指派任何数据源**。

⚠️ **自相矛盾**:计划 §9.1 明文列出"**只用高度重复的合成 payload**"属于"不能独立关闭任何 U"的类型。按其自身标准,D-12 fixture 不足以独立关闭 U-9。

**最小修复**

补一份**低可压缩性** fixture(随机化 name/phone/时间戳、或直接使用高熵字段)用于 `compression-not-beneficial`,并补一份 <16 KiB 的小载荷用于 `below-threshold`;两者与 M-1 的多片 fixture 一并纳入 D-12 的具名集合。同时在 §0.3 写明当前 fixture 的**可压缩性档位**,不要让读者误以为它代表真实门店分布。

## 3. Significant

### S-1 D-10 的"只追踪当前执行命令"是单数表述,而远端命令可并发在途

```
状态=CONFIRMED
严重度=S
owning source=详设 §5 D-10
需 Dexter 裁决=否
```

**仓内事实**:`createTopologyModule.ts` 每收到一个 `command-request` 就**立即**发起 dispatch 并挂 `.then`/`.catch`(`:459` 起),**没有任何队列或串行化**;`:460`/`:472` 在 settle 时 `cancelledRemoteCommands.delete(...)` 消费墓碑。

**推论**:多个远端命令可同时在途。

**反例**:命令 A、B 并发在途,`command-cancel(A)` 到达。若按"当前执行命令"字面实现为**单槽**,而"当前"此刻指向 B,则 A 的取消被丢弃 ⇒ A settle 后仍回传 `command-result`,违反取消语义。U-16 的压力测试若只串行发命令,该缺陷**不会变红**。

**已核为成立的部分**:D-10 的核心论证正确 —— 同一 WebSocket 上 `command-request` 必先于其 `command-cancel` 到达,且 dispatch 同步发起,故"丢弃未知 id 的 cancel"安全。问题只在措辞精度。

**最小修复**:把 D-10 改写为"只对**当前在途集合**内的 commandId 记录取消标记;不在集合内(从未收到或已 settle)的 cancel 为 no-op",并要求 U-16 的压力用例**并发**发起多个远端命令再交叉取消。

### S-2 §0.3 把 fixture 的信封字节当成 logical payload 字节

```
状态=CONFIRMED
严重度=S
owning source=详设 §0.3、§4.3
需 Dexter 裁决=否
```

**仓内事实(逐变体计算)**

| 计量对象 | UTF-8 字节 |
|---|---|
| `members` 数组(真正会过线的 logical payload) | **62,389** |
| **整个 fixture 文件对象**(含 `fixtureId`/`schemaVersion`/`sourceType`/`recordCount` 外壳) | **62,535** ⇐ 详设所称 |

⇒ 详设 §0.3 的"以 JSON.parse 后按对象属性顺序 JSON.stringify 的规范化 payload:62,535 UTF-8 字节"量的是**信封**,不是载荷。那 146 字节的 fixture 元数据**永远不会过线**。

**反例**:§4.3 的 8 MiB 折算("约 76,000 条同分布记录")据此推得。数值影响很小(用 62,389 折算得约 76,645,同量级),**但方法错误说明 fixture 与真实 encode 路径之间没有做过端到端核对** —— 这正是 M-1 得以成立的同一个疏漏。

**最小修复**:§0.3 改记 `members` 数组的规范化字节(62,389),并注明与文件字节数的区别;§4.3 的折算随之更新。建议实施时把"fixture → `createFullSyncPayload` → codec → chunk plan"跑一遍并记录实际片数,作为 D-12 冻结的一部分。

### S-3 R-11 删掉序列化 fingerprint 后,"发送失败不污染 revision"这条保证失去承载者

```
状态=CONFIRMED
严重度=S
owning source=详设 §4.1 步骤 7 / §5 D-9;需求 R-11
需 Dexter 裁决=否
```

**文档事实**:详设 §4.1 步骤 7 写"只有 encoder 已生成合法 transfer plan 后才更新 `lastMembersFingerprint`;发送失败不会先污染 revision/fingerprint"。而 §5 D-9 写"R-11 采用 slice reference equality,**不保留序列化 fingerprint**"。

**仓内事实**:`lastMembersFingerprint` 当前是 `createTopologyModule.ts` 的可变闭包变量,`:230` 赋值、`:229` 比对。R-11 属**阶段三**,§4.1 属**阶段二**。

**反例**:阶段二按步骤 7 把保证挂在 `lastMembersFingerprint` 上;阶段三 R-11 删掉它改为引用相等 ⇒ **该保证的承载者消失**,而详设没有说明阶段三由谁接手"发送失败不预先递增 `membersSyncRevision`"。实施方可能在阶段三无意中把递增提前,而 U-13 只验"无关 slice 不构造 / members 变化照常下行",**抓不到 revision 污染**。

**最小修复**:在 D-9 或 §4.1 显式写出跨阶段交接 —— 阶段三改为引用相等后,"失败不递增 revision"由哪个不变量承载(建议:`membersSyncRevision` 的递增点与 transfer plan 成功建立绑定,与 fingerprint 机制无关),并给 U-13 增加一条"发送失败后 `membersSyncRevision` 不变"的断言与红变异。

## 4. Notes

### N-1 U-1 与 U-4 的"红变异"本质上不是 production mutation

详设 §7 对 U-1 的红是"删除一行、activation token 自由文本",对 U-4 是"只 dump primary、把 OPEN 说成 PASS"。两者分别是**文档行**与**证据方法**的变异,不是生产代码变异 —— 这由其主题决定(台账行、设备行为),并非缺陷。但交付矩阵把 18 条并列时应显式标注这两条的档位,避免 CP-4 被读成"18 条都有 production red"。

### N-2 删除 `createTransportLimiter` 与 §6.2 步骤 9 的 control-priority queue 的关系未说明

R-5 在阶段一删除 `createTransportLimiter`(并发闸 + 最小启动间隔),而阶段二 §6.2 步骤 9 要求"session control queue 高于 data chunk queue"。两者**不是同一种机制**(前者限并发速率,后者是优先级队列),但相隔两个阶段且都涉及"发送节流",详设未点明差异。建议加一句,避免实施方在阶段二把刚删的 limiter 以别的名字重建。

### N-3 `state-full` → `state-full-chunk` 的帧型替换未显式映射到需求的 C-3 登记

需求 INV-1 要求所有对外行为变化逐条在册(C-1..C-5)。详设 §4.1 把 `state-full` 的物理传输统一换成 `state-full-chunk`(即使 `total=1`),这是**线上帧型的替换**,比 C-3 字面的"压缩、分片与重组 ⇒ 线上字节形态变化"更强。§9 矩阵只为 typed errors 提到"新成员登记 C-4/C-5"。建议在详设显式写明该替换归属 C-3,或为其新增一条登记。

## 5. 本轮核验范围与未验

**已亲验**:两份文档全文;fixture 的 SHA-256、文件字节、`recordCount`、字段基数分布;按详设 §4.1/§4.3 规则独立复算的规范化字节、zlib 压缩比、base64 encoded 字节、节省判定与分片数(含 raw 路径对照);`createTopologyModule.ts` 的 cancel add/delete 路径与 dispatch 并发性;`transport/package.json` 现有依赖;全仓 `package.json` 的 fflate/pako 检索;`node_modules/fflate` 存在性;Android base 的 Kotlin source set。

**未验 / UNVERIFIED**:
1. fflate 0.8.3 在本仓 Yarn/Expo/RN resolver 下的实际可用性 —— 详设已正确标为 `PRECHECK_REQUIRED` 并设 CP-0 停机条件,本轮不重复判定。
2. 我用 Python `zlib.compress(data, 6)` 近似 fflate 的 `zlibSync(level 6)`;两者同为 DEFLATE 且层级相同,字节数应极接近,但**未逐字节比对**。⇒ M-1/M-2 的结论(单片、5.47×)在量级上稳健,精确值以实施方用 fflate 实测为准;**即便压缩比落到 2.4×,encoded 约 34 KiB 仍是 1 片**,M-1 不受影响。
3. RN WebSocket 的真实文本帧上限、OkHttp protocol pong、设备双屏恢复 —— 详设已列为外部未决,处理档位正确。
4. 未逐条推演 U-1..U-18 全部 18 条的反例;本轮重点核 D-12/U-8/U-9/U-18/D-10/D-9 一线。
5. **未运行任何构建、测试、gradle、设备或网络动作**;本轮零写入(本文件除外)。

## 6. 授权边界

本评审只读。不授权修改源码、测试、依赖、脚本或构建产物;不授权 Web、Metro、Android、设备、DEV、seed、UAT、部署。**DESIGN review 的 NO-GO 指详设与实施计划在上述两条 Major 关闭前不宜进入实施**,不构成 implementation、runtime、native 或 release 的任何判定。是否进入实施由 Dexter 裁定。
