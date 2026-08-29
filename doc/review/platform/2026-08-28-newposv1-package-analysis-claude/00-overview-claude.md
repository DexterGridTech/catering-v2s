# newPOSv1 逐包分析 · 总览

- 日期：2026-08-28 · 作者：Claude
- 范围：`1-kernel` `2-ui` `3-adapter` `4-assembly` 下**全部 35 个包**，逐包精读
- 性质：**事实与判断，不构成评审结论、不授权实施**
- 关联：好/坏台账 `../2026-08-27-v2s-terminal-poc-findings-ledger-claude.md`；
  讨论稿 `../2026-08-27-v2s-terminal-poc-analysis-and-ter-design-discussion-claude.md`

## 0 · 文档索引

⚠️ **先读 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)** ——
Dexter 2026-08-28 裁定 TER 建设顺序为「**业务无关的内容按依赖关系先建，TCP/TDP/权益之类先不创建**」。
那份文档把本目录 35 个包分成 **批 F（地基，现在建）/ 批 D（延后）/ 批 N（不建）** 三档并给出层序；
本目录每一份包文档的首表都已带上所属批次。

| 文档 | 覆盖包 |
|---|---|
| `00-ter-build-order` | **建设顺序与三批分档**（Dexter 2026-08-28 裁定的落地） |
| `k-01` … `k-14` | `1-kernel/1.1-base` 全部 14 个包 |
| `b-01` | 主数据三包（organization-iam / catering-product / catering-store-operating） |
| `b-02` | 权益三包（benefit-types / benefit-calculation / benefit-session） |
| `b-03` | `server-config-v2` + `1-kernel/test-support` |
| `u-01` … `u-06` | `2-ui/2.1-base` 全部 8 个（含 1 个空包） |
| `u-07` | `2-ui/2.2-business` + `2-ui/2.3-integration` |
| `a-01` `a-02` `a-03` | `3-adapter/android` 2 个 + `4-assembly/android` 1 个 |

## 1 · 全景数据

| 层 | 包数 | src 行 | test 行 | 测试比 |
|---|---|---|---|---|
| `1-kernel/1.1-base` | 14 | **27,665** | 20,896 | 76% |
| `1-kernel/1.2-business` | 6 | 8,021 | 4,401 | 55% |
| `1-kernel`（其它） | 2 | 171 | 0 | 0% |
| `2-ui/2.1-base` | 8（含 1 空） | 15,459 | 7,381 | 48% |
| `2-ui/2.2-business` | 1 | 817 | **0** | 0% |
| `2-ui/2.3-integration` | 1 | 1,025 | 954 | 93% |
| `3-adapter/android` | 2 | 4,240 TS + **13,355 Kotlin** | 0 TS | 0% |
| `4-assembly/android` | 1 | 45 | **4,991** | —— |
| **合计** | **35** | **约 57.4K TS + 13.4K Kotlin** | 约 38.6K | —— |

### 1.1 体量分布（前十）

| 包 | src | 备注 |
|---|---|---|
| `adapter-android-v2` | 9,329 Kotlin | 纯原生，零 RN |
| `ui-base-admin-console` | 7,328 | **全仓单包最大（TS）** |
| `kernel-base-tdp-sync-runtime-v2` | 6,903 | kernel 最大，**一包五职责** |
| `host-runtime-rn84` | 4,240 TS + 4,026 Kotlin | 依赖 18 个包 |
| `kernel-base-workflow-runtime-v2` | 3,823 | 引擎 POC |
| `kernel-base-topology-runtime-v3` | 3,070 | |
| `kernel-base-runtime-shell-v2` | 2,501 | 中枢 |
| `ui-base-runtime-react` | 2,547 | UI 中枢 |
| `kernel-base-transport-runtime` | 2,344 | |
| `kernel-business-benefit-session` | 1,988 | 零消费者 |

## 2 · 依赖图（源码实际 import，非 package.json 声明）

```text
                    contracts (18 入边，零出边)
                        ↑
              platform-ports (11) ← definition-registry (1)
                        ↑
                 state-runtime (17)
                        ↑
              runtime-shell-v2 (20 入边，全仓第二广)
                        ↑
        ┌───────────────┼────────────────┬──────────────┐
   transport(7)    ui-runtime-v2(8)  topology-v3(10)  workflow(2)
        ↑               ↑                 ↑
   tcp-control(11) ─→ tdp-sync(8) ─→ terminal-log-upload(2)
        ↑
   1.2-business 主数据三包 / 权益三包
        ↑
   2.1-base（runtime-react 8 / admin-console 2 / …）
        ↑
   2.2-business workbench(1) → 2.3-integration catering-shell(1)
        ↑
   host-runtime-rn84（依赖 18） → assembly（依赖 2）
```

**零入边的包（5 个）**：
`execution-runtime`（966 行）· `host-runtime`（1,986 行）· `benefit-session`（1,988 行）·
`adapter-android-v2`（走 Gradle 不走 npm，属正常）· `assembly`（图顶点，属正常）。

前三个都是**已建成、已测试、等待接入或被取代**的能力，
按 POC 判据不是缺陷（台账 §2.0），但**没有任何机制会提示它们的状态**（`FIX-11`）。

## 3 · 五条贯穿全仓的结构模式

### 3.1 固定包骨架（20 个 runtime 包零变形）

```
src/application/{createModule,moduleManifest,index}
src/features/{commands,actors,slices}/
src/foundations/  selectors/  supports/{errors,parameters}  types/  hooks/
src/moduleName.ts  src/generated/packageVersion.ts  src/index.ts
test/{scenarios,helpers,index}
```

即使某个位置没有内容也保留空壳（`export {}` + 一行规则注释）。
`hooks/index.ts` 的空壳注释是"kernel 不实现 React hook"——**形状本身是文档**。

⚠️ **两个例外**：`benefit-types`（按领域概念切目录）与 `benefit-calculation`（只有 `pipeline/`）。
仓库没有为"非 runtime 包"定义第二套标准骨架。

### 3.2 命名派生自 `moduleName`

command key / actor key / slice key / error key / parameter key / 日志 scope
全部由 `moduleName` 派生（`createModuleCommandFactory` / `createModuleErrorFactory` / …）。
业务侧**不手拼字符串**。

### 3.3 声明式 slice descriptor（约 40 个 slice 在用）

六字段 `{name, reducer, persistIntent, syncIntent, persistence, sync}`。
业务包写**零行**持久化与同步代码。

**用得最好的是 `tcp-control`**（`k-09` §2）：五个 slice 各按语义分档，
`accessToken`/`refreshToken` 走 `protection: 'protected'`，时间戳走普通存储。

**用得最差的是主数据三包**（`b-01` §5）：
同步逐条（`kind: 'record'`），持久化却整块（`kind: 'field'` on 整个 `byTopic`）+ 立即刷。

### 3.4 广播 command + 动作/事实成对

`tcp-control` 的形态最典型：5 条 public 动作各配一条 internal 的 `*Succeeded` 事实广播，
下游（`catering-shell`）订阅事实而不是轮询状态。

⚠️ 代价：`allowNoActor` 默认 `false`，所以纯广播必须有人"接"，
于是出现 5 个 `() => ({})` 的空 actor（`k-09` §6.1）。
**"命令"与"事件"共用一个机制的账单。**

### 3.5 端口 + 宿主注入

`platform-ports` 是 kernel 唯一的平台入口；13 个 kernel 包**零 React / RN / Android import**。
adapter 是纯 Kotlin，带独立 `dev-app` 可脱离 RN 手测。

## 4 · 本轮相对前两轮的修正

逐包精读推翻或修正了三条此前的判断：

| # | 此前判断 | 本轮事实 |
|---|---|---|
| 1 | **`FIX-05`：跨端同步用墙钟 LWW，快的机器永远赢** | **错了。** 同步是 per-slice 静态 authority（`syncIntent` 决定唯一权威方），模式恒为 `authoritative`，`updatedAt` 只作变化检测（`!==` 而非 `<`）。POC 采用的正是我当时"建议"的方案。已在台账更正并降级 |
| 2 | **"两个死包，没人发现"** | 更准确的说法是**被取代/待接入**：`host-runtime` 实现的是 V3 明确裁掉的 ticket + resume（设计文档 §7.2/§8.2 有原文）；`execution-runtime` 是被广播模型取代的单 handler + middleware 模型。README 的层级表把两者都列为在编层 |
| 3 | **"这个代码库没有时钟纪律"** | **错了。** `tdp-sync` 有完整的 `serverClockOffsetMs`：从下行消息时间戳推出、持久化、用于 projection TTL 判定。团队在**真正需要时钟的地方**做了对的事 |

## 5 · 本轮新发现（尚未进台账，见 §7）

| # | 发现 | 位置 | 严重度判断 |
|---|---|---|---|
| N-1 | **HTTP 全链路不检查状态码** ⇒ 5xx 被当传输成功 ⇒ 故障切换不触发、坏地址被记为首选 | `k-08` §4.1 | 高。招牌能力在最常见故障下失效 |
| N-2 | **`protection: 'protected'` 没有加密**：`secure-state` 只是另一个 MMKV namespace，`MMKV.mmkvWithID(id)` 单参无 cryptKey | `a-01` §4 | 高。类型与描述符过度承诺 |
| N-3 | **主数据整块落盘 + 立即刷**：三包同错，`byTopic`（26 topic × N 条）一个 storage key | `b-01` §5 | 中高。与 `k-06` 的"全量重写"叠加 |
| N-4 | **`host-runtime-rn84` 零测试，4,991 行测试寄居在 assembly** | `a-02` §5.1 / `a-03` §3 | 中。测试归属与代码归属不一致 |
| N-5 | **`hot-update-runtime-bridge` 是空目录**，只在 README 的包清单里存在 | `u-06` §B | 中。文档声明了不存在的包 |
| N-6 | **`topology-runtime-v3` 只声明 1 个 `@next` 依赖，实际 import 4 个** | `k-11` §6.1 | 中。`CON-03` 的真实实例 |
| N-7 | **release manifest 的 `targetPackages` 含两个零 import 的包** | `a-03` §4.1 | 中。manifest 不是从依赖图算的 |
| N-8 | **`catering-shell` 同一路由有两个触发源**（事件 + 状态订阅），本机激活时都会触发 | `u-07` §B.3 | 低-中。幂等所以无 bug，但"何时路由"有两个答案 |
| N-9 | **自动刷盘失败静默**：`void flushPersistence()` 丢弃 Promise，写盘失败无信号 | `k-06` §6.1 | 中高。终端存储异常时状态静默丢失 |
| N-10 | **`workflow` 的 `inputSchema`/`outputSchema` 声明了但无校验点** | `k-14` §6.9 | 中。schema 是声称不是行为 |

## 6 · 整体判断

### 6.1 这套架构的真实水平

**明显高于平均，且缺陷集中在"边界的形状"而非"边界是否存在"。**

可验证的证据：

- 13 个 kernel 包零 React/RN/Android import；
- assembly `App.tsx` **30 行**，Kotlin 侧两个一行子类；
- adapter 纯 Kotlin + 独立 dev-app；
- production 源码 `TODO/FIXME/HACK` **零命中**；
- 20 个 runtime 包骨架零变形；
- 设计文档会记录**被推翻的方案**（topology V3 §1.4）。

### 6.2 三条最值得原样带走的

1. **声明式 slice descriptor**（六字段表达完持久化与同步，业务写零行）——
   这是整个代码库最好的一个想法；
2. **广播 command + 聚合四态 + request ledger 进 state** ——
   POS 里一个动作多个 owner 反应是常态，编排代码因此不存在；
3. **"恢复真相源 vs 运行时观察值"的区分** ——
   绝大多数持久化 bug 的根因就是把观察值当真相源。

### 6.3 三条最需要在 TER 改形状的

1. **包按 owner 切，不按 runtime 名切**（`FIX-01`）——
   `tdp-sync` 一包五职责与两个零消费者包是同一个切分轴错误的两端；
2. **端口必须是有类型的边界**（`FIX-03` / `FIX-04` / N-2）——
   `Record<string, unknown>` 穿透、十个可选端口无 fail-fast、`protected` 不加密，
   三条都是"边界名义上存在、实际是洞"；
3. **静默失败要变成可见失败**（N-1 / N-9 / `FIX-20` / `FIX-22`）——
   HTTP 5xx 当成功、刷盘失败无信号、未知 step 报 COMPLETED、脚本假超时，
   四条形态不同，本质一样。

## 7 · 待办

1. ✅ §5 的 N-1 … N-10 已并入台账，编号 `FIX-24` … `FIX-33`；
   另新增 `KEEP-28` … `KEEP-36` 九条本轮发现的正面形态。
   台账现为 **36 KEEP / 33 FIX / 4 CON**。
2. ✅ `FIX-05` 已自我推翻并在台账降级为 `POC 残留`。
3. ✅ 台账 §4.2 已按新计数重写：**本质缺陷由 3 条增至 6 条**
   （新增 `FIX-24` HTTP 不检查状态码 · `FIX-25` protected 未加密 · `FIX-28` 自动刷盘失败静默）。

## 8 · 证据档位说明

- 每份包文档末尾都有独立的"证据档位"段，逐项标注 `已亲验` / `推论` / `UNVERIFIED`，
  并写明**未逐行读**的部分。
- 全仓计数类结论（依赖数、import 数、命中数）的穷举范围统一为：
  `1-kernel` `2-ui` `3-adapter` `4-assembly` `0-mock-server` 下的
  `*.ts` `*.tsx` `*.kt` `*.json`，排除 `node_modules` `dist` `build` `.turbo` `.gradle` `.kotlin`。
- 本轮**未覆盖**：`0-mock-server`（53,220 行，3 个包）—— 它是服务端对手方，
  Dexter 已裁定不带入 TER，故未做逐包分析。
