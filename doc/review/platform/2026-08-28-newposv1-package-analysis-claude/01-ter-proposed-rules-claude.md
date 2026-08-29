# TER 规范 · 九条（已由 Dexter 采纳）

| 字段 | 值 |
|---|---|
| 日期 | 2026-08-28 · 作者：Claude |
| **状态** | **`TR-01` 至 `TR-09` 已全部由 Dexter 采纳为 TER 规范**（2026-08-28）。本文原为提案，现转为**记录** |
| **正本归属** | ⚠️ **本文不是正本。** Dexter 已明确：后续把**所有规范统一收进项目记忆**。在那之前，本文是唯一记录处；收编后本文只留指针 |
| 待办 | 见 §12 —— 收编时必须一并带走的、散落在其它文档里的规范条目清单 |
| 关联 | `00-ter-build-order-claude.md`（`TR-01` 原文在其 §4B.9）；好/坏台账 `../2026-08-27-v2s-terminal-poc-findings-ledger-claude.md` |

## 编号对照（供收编时使用）

| ID | 规则 | 提出者 | 本文位置 |
|---|---|---|---|
| **`TR-01`** | reducer 只能 actor 调用，且只由 command 驱动 | **Dexter** | `00-ter-build-order` §4B.9 |
| **`TR-02`** | 「什么都没做」的路径不得返回成功 | Claude | §规则 1 |
| **`TR-03`** | 跨包读只能走 selector，禁按字符串键读别人 slice | Claude | §规则 2 |
| **`TR-04`** | 声明持久化就必须有正反双断言的重启测试 | Claude | §规则 3 |
| **`TR-05`** | 端口与契约禁 `Record<string, unknown>` / `any` | Claude | §规则 4 |
| **`TR-06`** | foundations 不得触达 store / 网络 / 平台 API | Claude | §规则 5 |
| **`TR-07`** | 集合先声明形态，声明游标就必须真消费 | Claude | §规则 6 |
| **`TR-08`** | 调试与自动化面必须编译期剔除 | Claude | §规则 7 |
| **`TR-09`** | 包声明 `kind`；slice 名由 moduleName 派生 | Claude | §规则 8 |

⚠️ 原 §10「如果只收三条」的取舍**已作废** —— Dexter 采纳全部九条。该节保留仅作决策留痕。

## 0 · 每条规则的准入依据（采纳后仍然适用，用于将来复核）

写这份东西最大的风险是**用评审制造过度设计**。所以每条都同时满足：

1. **有 POC 里的真实失败做证据** —— 不接受"好实践"、不接受"业界常见"；
2. **说清是机械门还是 review**，机械门必须能写出**红夹具**；
3. **必须有反例栏** —— 写不出"这条门抓不到什么"，就说明我没想清楚；
4. **成本要诚实** —— 说清它会让谁多写代码。

⛔ 被否掉的候选（连同理由）列在 §9，作为"**这些明确不做**"的记录一并留存 ——
将来有人再提同样的候选时，先看那一节。

---

# 第一梯队（`TR-02` … `TR-05`）

## `TR-02` ·「什么都没做」的路径不得返回成功

**规则**：任何执行路径，若实际未完成其名义动作，**不得返回成功值、不得静默继续**。
必须产出**可区分的、有类型的**失败或"未执行"结果。

**为什么排第一**：POC 四条本质缺陷里**三条是同一个根因**，这条一次全收。

| POC 实例 | 表现 |
|---|---|
| `FIX-20` workflow 未知/未实现 step | `type:'custom'` 或拼错的 type 落进兜底分支，**什么都不做然后报 `COMPLETED`** |
| `FIX-24` HTTP 全链路不检查状态码 | 5xx 被当成传输成功 ⇒ **故障切换不触发、坏地址被记为首选** |
| `FIX-28` 自动刷盘失败静默 | `void flushPersistence()` 丢弃 Promise，**写盘失败无任何信号** |
| `4B.1` 能力缺失 | `ports.camera?.scan()` 得到 `undefined`，调用点各自猜怎么办 |

**门**：
- 机械可判的一半：`switch`/`if-else` 分派链必须有 default 分支，且 default **不得返回成功形状**；
  TypeScript 的 `never` 穷尽检查可直接承载（联合类型漏一支即编译错误）。
- 机械可判的另一半：**禁止 `void <返回 Promise 的表达式>`**（丢弃 Promise = 丢弃失败）。
- 其余靠 review：判据是"这条路径**没做成**时，调用方能不能区分出来"。

**红夹具**：给某个联合类型加一个成员而不加处理分支 → 编译必须红；
把一处 `await flush()` 改成 `void flush()` → 门必须红。

**反例栏**：`try { ... } catch { return {ok:true} }` 这种**显式伪造成功**，
两条机械断言都抓不到，只能靠 review。这是本条已知的边界。

**成本**：低。TS 穷尽检查是零成本的；`void Promise` 禁令会逼出一批 `await`/`.catch()`。

**对齐**：这条与 v2s 后台规范 **2-B** 是同一条，TER 规范正本应**指针引用**而非复述。

---

## `TR-03` · 跨包读只能走 selector，禁止按字符串键读别人的 slice

**规则**：读其它包的状态**只能**调用该包导出的 selector。
**禁止**用字符串字面量作为 key 从 `getState()` 里取别人的 slice。

**POC 证据（已亲验）**：`topology-runtime-v3/src/foundations/connectionController.ts:96-99`

```ts
const parameterCatalog = context.getState()?.[
    'kernel.base.runtime-shell-v2.parameter-catalog' as keyof ReturnType<typeof context.getState>
] as Record<string, {rawValue?: unknown}> | undefined
```

四个问题叠在一起：跨包读别人的 slice、硬编码字符串键、`as` 双重 cast 绕过类型、
**绕过了 `resolveParameter` 直接读 `rawValue`** 因而丢掉 decode/validate/source/valid。

**为什么这条必须有：它补上依赖门唯一的洞。**
依赖门（`00-ter-build-order` §1）查的是 `import`。
而**按字符串键读 state 不产生任何 import** —— 依赖图上看不见这条耦合，
门全绿而两个包已经紧耦合。这是隐蔽度最高的一种跨包依赖。

**门**：禁止 `getState()[` 后紧跟字符串字面量；
禁止其它包的 slice name 字符串出现在非 owner 包（配合规则 8 的 slice 命名派生即可判定 owner）。

**红夹具**：在任一包里加一行 `getState()['其它包.某slice']` → 门必须红。

**反例栏**：把 key 拼进变量再取（`const k = base + '.x'; getState()[k]`）抓不到。
但这已经是**刻意规避**，不是无意犯错——门的目的是防无意，不是防绕过。

**成本**：极低。POC 全仓只有这 1 处违规。

**与已裁定规则的关系**：§4B.9 管**谁能写**，本条管**谁能读**。
两条合起来，状态的读写面才完全受控。**建议成对采纳。**

---

## `TR-04` · 声明了持久化，就必须有正反双断言的重启测试

**规则**：任何声明 `persistIntent: 'owner-only'` 的 slice，
必须有一条**真实重启**（独立进程/独立 runtime 实例）测试，同时断言两侧：

- **该恢复的恢复了**；
- **不该恢复的确实没恢复**。

**POC 证据（已亲验，这条数字最刺眼）**：

- 声明了 `persistIntent: 'owner-only'` 的包：**12 个**
- 有重启恢复测试的包：**5 个**（`tcp-control` · `tdp-sync` · `topology` · `transport` · `admin-console`）
- **缺的 7 个**里包括 **`ui-runtime-v2`**

`ui-runtime-v2` 的整个 `test/` 目录（974 行）中，
`hydrate|persist|storage|restart|恢复` **零命中**（穷举其 test 全目录确认）。

⇒ **持有"崩溃重启恢复原状"这个灵魂核心状态（screen / overlay / uiVariable）的那个包，
从来没有验证过恢复。** 它的测试全部是命令语义与主副同步。

**正例现成**：`tcp-control-runtime-v2/test/scenarios/tcp-control-runtime-v2-live-restart-recovery.spec.ts:72-74`

```ts
expect(selectTcpRuntimeState(second.runtime.getState())?.lastActivationRequestId).toBeUndefined()
expect(selectTcpRuntimeState(second.runtime.getState())?.lastRefreshRequestId).toBeUndefined()
expect(selectTcpRuntimeState(second.runtime.getState())?.lastTaskReportRequestId).toBeUndefined()
```

**断言"不该恢复的确实没恢复"** —— 这正是 POC 方法论文档 §2.5 要求的形态，
只是没有任何东西强制它。

**门**：机械 —— 扫全部 slice descriptor，凡 `persistIntent: 'owner-only'`，
在本包 test 下必须存在标记为 restart-recovery 的用例覆盖该 slice name。
**这是存在性判据，本身不够**（§3-C：存在性判据不算判据），
所以配一条：该用例必须同时含**正向与反向**断言（反向＝对 runtime-only 字段断言未恢复）。

**红夹具**：给某个 slice 加 `persistIntent: 'owner-only'` 而不加测试 → 门必须红。

**反例栏**：门只能判"有没有这条用例"，判不了"断言得对不对"。
一条只断言 `expect(true).toBe(true)` 的用例能骗过它。这是本条已知边界，靠 review 兜。

**成本**：中。会逼出 7 个包补测试。但这 7 个里 5 个在批 D，
**地基批只需补 `ui-state` 与 `runtime` 两个** —— 又是"现在做便宜"的一条。

---

## `TR-05` · 端口与契约的入参/返回禁止 `Record<string, unknown>` 与 `any`

**规则**：`platform-ports` 与 `contracts` 中，
任何对外方法的参数与返回值必须是具名类型。禁止 `Record<string, unknown>` / `any` / 双重 `as` cast。

**POC 证据（`FIX-03`，已亲验）**：
`DevicePort.addPowerStatusChangeListener(listener: (event: Record<string, unknown>) => void)`；
`HotUpdatePort` 的四个 marker 读取全返回 `Record<string, unknown> | null`；
`LocalWebServerPort` 三个方法全是；`ConnectorPort` 几乎全是。
POC 自己的迁移地图也把"归一化 power payload"列为待办 —— **作者知道，但没有门**。

**为什么**：端口的全部意义是**有类型的边界**。退化成 `Record<string, unknown>` 之后，
它不是边界而是洞：消费侧只能手搓字段名，那些字段名立刻变成
**跨层字符串、零编译器保护**（v2s charter §3-D 要治的正是这类）。

**门**：扫 `kernel/base/platform-ports/**` 与 `kernel/base/contracts/**` 的类型定义，
禁止上述三种形态。**红夹具**：把任一端口方法的返回改回 `Record<string, unknown>` → 门必须红。

**反例栏**：`interface PowerEvent { [k: string]: unknown }` 这种"具名但内容开放"的写法能过门。
需要在 review 里判"这个具名类型有没有实际字段"。

**成本**：低-中。逼出一批字段归一化工作，但都是一次性的。

---

# 第二梯队（`TR-06` … `TR-09`）

## `TR-06` · foundations 不得触达 store、网络与平台 API

**规则**：`foundations/` 下的代码必须是纯函数，或只接受**显式注入的、已抽象的**依赖。
不得 import store、不得直接发起 HTTP/WS、不得调用平台 API。

**这是 `TR-01` 的配套**：既然 foundation 不能 dispatch，就该顺势把它变纯。

**POC 证据**：`reduceServerMessage.ts`（8 处 dispatch）名字就叫"把服务端消息 reduce 成状态变更"，
本该是纯函数，现在**必须持有 dispatch 才能测**；
`connectionController.ts`（15 处）同时持有 socket 与 dispatch。

**改写形态**（已在 `00-ter-build-order` §4B.9 写明）：同步纯逻辑**返回 action 列表**；
长生命周期控制器**改发 command**。

**门**：`foundations/**` 不得 import store/transport 实现；不得出现 `dispatchAction` 标识符（与 `TR-01` 同一道门）。

**反例栏**：foundation 接受一个"看起来抽象、实际就是 store"的对象（`{getState, dispatch}`）能过门。
需要 review 判注入的依赖是不是真抽象。

**成本**：中。改写集中在批 D 的三个包。

---

## `TR-07` · 每个返回集合的接口先声明形态，声明了游标就必须真消费

**规则**：任何返回集合的接口/状态，**设计期先判定形态**（Page / Cursor / Bounded / Detail 聚合），
形态决定义务。**契约声明了 `cursor`/`pageSize`，owner 就必须真消费它。**

**这条是 v2s charter §1-J 的既有规则**，TER 规范正本应**指针引用**。
此处只补终端侧的证据与加重理由。

**POC 证据（已亲验）**：形态是**逐作者自行决定**的，没有统一声明：

| 集合 | 有界？ |
|---|---|
| `workflow` 的 observation | ✅ 有 `completedObservationLimit` / `eventHistoryLimit` |
| `workflow` 的 queue | ✅ 有 `queueSizeLimit` |
| `workflow` 的 **definitions 数组** | ❌ **无界累积**（`FIX-21`：同一 workflowKey 每来一个新版本就多留一条，永不裁剪，且整块立即刷盘） |
| `execution-runtime` journal | ✅ 有 `maxJournalRecords` |
| `tdp` projection 仓库 | ❌ 未见裁剪 |

**为什么终端比后台更需要这条**：后台内存可扩，**终端不能**。
一个无界数组在门店连续运行数周之后是真实的 OOM 来源，而且它先表现为"越用越卡"，不是崩溃，很难归因。

**门**：机械可判的一半 —— slice 里任何数组/Record 型字段必须在 descriptor 里声明形态标记；
声明了 cursor 的必须有消费点。其余靠 review。

**反例栏**：声明了 `Bounded` 但上界取自"当前行数"（charter §1-J 已点名的反例）门抓不到。

**成本**：低（声明）+ 中（真去裁剪无界的那几处，都在批 D）。

---

## `TR-08` · 调试与自动化面必须编译期剔除，不靠运行期开关

**规则**：automation 控制面、脚本执行、诊断 socket 等能力，
**在 production 构建产物里必须不存在**，而不是"存在但默认不启动"。

**POC 证据（已亲验，`FIX-14`）**：
`host-runtime-rn84/src/application/createApp.ts:376`

```ts
const automation = adbSocketDebugConfig.enabled ? ... : undefined
```

是**运行期分支**，代码照常编进产物。而 automation 的能力面包含
`runtime.getState`（读全部状态）、`command.dispatch`（执行任意命令）、`scripts.execute`（执行任意脚本），
Android 侧还有 `AutomationSocketServer` 与设备上的 `TopologyHostV3Server`。

设计文档里"Product 环境默认不启动"是**约定型防线** ——
在"有人改了初始化顺序"或"某个产品配置写错"时**无声失效**，而失效的后果是一个完整后门。

⚠️ **边界（`T-11` 之后必须分清）**：本条针对的是 **automation 调试控制面**
（`adb` socket、`runtime.getState`、`ui.*` 这类调试入口）。
**`scripts.execute` 作为产品运行期能力已由 `T-11` 保留，并支持运行期远端下发脚本源** ——
它**不在**本条剔除范围内。落地写门时不得连它一起剔掉。

**门**：对 production bundle 做符号扫描，automation 相关标识符必须零命中。
**红夹具**：把剔除开关关掉重新打包 → 门必须红。

**反例栏**：符号被压缩/重命名后扫不到。需要按模块入口而非标识符判定。

**成本**：中。要做构建变体或编译期常量裁剪。但**地基批就该做** ——
`ui.base.automation` 是 F7a，这时候建立剔除链最便宜。

---

## `TR-09` · 包必须声明自己是 owner 还是 toolkit；slice 名由 moduleName 派生

**规则**：
- 每个包在 manifest 里声明 `kind: 'owner' | 'toolkit'`；
- `owner` 包**必须至少拥有一个 slice**，且是这些 slice 的**唯一写者**；
- `toolkit` 包**不得拥有 slice**；
- 所有 slice 名**必须以本包 moduleName 为前缀**。

**POC 证据**：
- 切分轴错误（`FIX-01`）的两端 —— 两个零消费者的包 + 一个五职责的巨包 ——
  根因就是"包"这个概念没有可判定的定义；
- POC 其实**已经在派生 slice 名**（`createModuleStateKeys(moduleName, keys)`），只是没有门。

**为什么值得**：它把"包是什么"从口头判断变成可判定的 ——
并且**它是规则 2 的前提**：知道谁是 slice 的 owner，才能说"你在跨包读"。

**门**：slice 名前缀检查（纯机械）；
`kind: 'owner'` 但零 slice、或 `kind: 'toolkit'` 却有 slice → 报错；
**零消费者的包报出来**（顺带收掉 `FIX-11`"没有任何机制注意到没人用"）。

**反例栏**：一个包拥有 slice 但职责仍然过宽（`tdp-sync` 五职责），门抓不到。
"一个 owner 该管多大"仍是 review 判断。

**成本**：极低。POC 27/29 已天然符合命名派生。

---

# 第三梯队 · 有价值但建议先不做成门

| # | 候选 | 为什么先不做门 |
|---|---|---|
| 9 | **渲染组件不得包含状态机**（ready gate / 缓存策略 / 生命周期控制器必须在组件外）。证据：`ScreenContainer.tsx` **980 行**，且 5 处条件 hook 有 3 处在里面 | 判据是语义的（"这算不算状态机"），做成行数门就是 charter §6-C 点名的"冻结计数不是不变量"。**放进 review checklist** |
| 10 | **时间源必须可注入**。证据：`contracts` 的 `nowTimestampMs = Date.now()` 写死；`tdp-sync` 另有一套 `serverClockOffsetMs` 但别处用不上 | 收益主要是**测试可控**与**将来换时钟策略**，当前没有正在发生的失败。建议在 `contracts` 建 F0 时**顺手做成可注入**，但不立规则 |

---

# 9 · 明确否掉的候选（连同理由；再有人提同样的候选，先看这一节）

| 候选 | 否掉理由 |
|---|---|
| 文件/函数行数上限 | 冻结计数不是不变量（charter §6-C）。`ScreenContainer` 的问题是**职责**不是行数 |
| 强制单测覆盖率阈值 | 覆盖率是代理指标，不是行为判据。POC 已证"有测试 ≠ 测了行为"（`renderToStaticMarkup` 不跑 effect） |
| 禁止 `as` 类型断言 | 会误伤大量合法窄化。真正的问题是**双重 cast 绕过边界**，已由规则 4 精确覆盖 |
| 强制每个 command 有对应 actor | POC 已有 `allowNoActor` 的明确语义，硬禁会破坏"广播给零个 actor 也合法"的设计 |
| 统一 UI 交互一致性七族 | v2s 前端规范 §3-K 是给 antd 后台写的，终端的控件形态与之不同。**等 TER 有真实 UI 批次再由实例产生**，现在写就是无实例的口号 |
| 禁止 `console.*` | 与规则 7 的端口默认实现直接冲突 —— 默认 logger 就是 `console.log` |
| 强制所有异步带超时 | 无差别加超时会制造"假超时"（`FIX-22` 正是这个坑：`setTimeout` 挡不住同步死循环）。超时要按边界设计，不是按规则铺 |

---

# 10 · 原「只收三条」的取舍（已作废，仅留决策痕迹与落地优先级）

按 **（收益 × 可判定性）／成本** 排，我的建议是：

1. **规则 1**（"什么都没做"不得返回成功）—— 一次收掉四条本质缺陷里的三条；
2. **规则 2**（跨包读只走 selector）—— 补上依赖门唯一的洞，且与 `TR-01` 成对；
3. **规则 3**（持久化必须有正反双断言的重启测试）—— 护住"崩溃恢复原状"这个灵魂，
   而且实测发现**最该有的那个包恰恰没有**。

规则 4 与 8 成本极低、可随手带上；5/6/7 建议随对应包进入地基批时逐条落。

# 11 · 证据档位

全部计数与路径均为 `已亲验`。穷举范围统一为：
`1-kernel` `2-ui` `3-adapter` `4-assembly` 下的 `*.ts`/`*.tsx`，
排除 `node_modules` / `dist` / `build` / `**/test/**`（仅规则 3 的分子分母统计**包含** test）。
`ui-runtime-v2` 无恢复测试为**否定式结论**，穷举方法：对其 `test/` 全目录搜
`hydrate|persist|storage|restart|恢复`，零命中。


# 12 · 收编清单：`TR-01`…`TR-09` 之外，还有哪些已裁定条目是规范形态

⚠️ **这一节是为"统一收进项目记忆"那一步准备的。**
若收编时只搬这九条，下面这些**同样已经裁定、同样是规范形态**的条目会丢失 ——
它们目前散落在建设顺序文档、台账和逐包文档里。

## 12.A 已裁定的规范条目（应与 `TR-*` 一同收编）

| 条目 | 内容一句话 | 现居 | 提出者 |
|---|---|---|---|
| 依赖门两条断言 | ①声明依赖不违反层级方向 ②源码每个 `@ter/*` import 都有对应声明。缺②则①是纸糊的 | `00-ter-build-order` §1 | Claude |
| 端口注册器 + 默认实例 | 端口无可选字段；有人注册用注册的，没人注册用**声明处自带的默认实例**；**默认实现必须零额外依赖**；默认分「可用」与「不可用（typed `CAPABILITY_UNAVAILABLE`）」两类 | 同上 §4B.1 | **Dexter** |
| 不给默认实现加戏 | web 面是**便宜的业务问题探测器**，不代表真机能力。摄像头就返回不可用，不得在默认实现里模拟设备行为 | 同上 §4B.2 | **Dexter** |
| 不建 `adapter/web` | integration 属 ui 层，依赖 adapter 是反向依赖；且 web ≠ electron | 同上 §4B.2 | **Dexter** |
| server config 值归启动层 | 形状在 `contracts`；**值由启动层提供**，启动层 ≥3 个；dev 地址册归 `test-support`（dev-only），不进生产包 | 同上 §4B.3 | Dexter + Claude |
| 空目录不得预置代码 | `adapter/electron`、`assembly/electron` 只放 README 写明边界，**不得放"将来可能用得上"的代码** | 同上 §4B.6 | Dexter + Claude |
| 三重命名可互推 | 目录路径 → `moduleName`（点连）→ npm 包名（连字符 + scope），三者互相可推导，做成机械门 | 同上 §4B.7 | **Dexter** |
| 包名禁版本号与框架名 | 不得出现 `-v2`/`-v3`/`rn84` 之类；演进用同名包内改实现 | 台账 `FIX-02` | Claude |
| 定义在各包自己声明 | 不再从 store 动态取值；key 唯一性与全集清单走**静态门 + 生成常量**，不建运行期注册表 | `00-ter-build-order` §4B.8 | **Dexter** |
| 错误码→文案闭集全覆盖 | 生成的错误码清单是闭集，UI 文案映射**漏一个即编译错误** | 台账 `FIX-16` + §4B.8 | Claude |
| 语义注册下沉到 primitive | 自动化节点注册必须由控件层统一提供，**从加法变减法** | 台账 `FIX-08` | Claude |
| error boundary 粒度 | 至少到 **screen 级**（不能只有 root）；reset 后**重挂 screen 而非重启 App** | 台账 `FIX-09` | Claude |
| TER 只留两类文档 | **裁定记录** + **编码规范正本**（自带反例）。方法论型叙述要么变规范条目，要么变可跑的模板代码 | 台账 `FIX-10` | Claude |
| 单一测试 runner | vitest 一套到底，不引 Jest；DOM 级行为由 Expo Web 那条道覆盖 | 讨论稿 §7.9 | Claude（Dexter 认可） |
| 编码规范正本形态 | 新写 `terminal-coding-standard.md`，通用条款**指针引用** v2s 前端规范（§3-B/§3-C/§3-E/§3-G/§4-A/§4-B/§4-D），不复述 | 讨论稿 Q-13 | Dexter 认可 |

## 12.B 已裁定的架构决策（不是"规则"，但收编时要一并留痕）

| 决策 | 现居 |
|---|---|
| 单机双屏：**一个 ReactHost、一个 Hermes VM、一个 store**、多 surface | `00-ter-build-order` §4 / 讨论稿 §7.2 |
| workspace 必须随 command 的 `routeContext` 走，不得从全局 state 读 | `00-ter-build-order` §4 |
| TDP 通讯**回到 WS**，放弃 SSE | 讨论稿 §7.1 |
| RTK Query **只当 HTTP client**，无缓存；接缝形状先定、客户端选型后定 | 讨论稿 §7.1 / §7.5 |
| automation **完全自研**，不引 Maestro | 讨论稿 §7.1 |
| 多地址 failover 等策略**必须留在 transport**，不交给任何 HTTP client | 台账 `KEEP-12` |
| SQLite 类能力**等真实业务再补**；端口须能力型不得技术型 | 讨论稿 §8.0 / 台账 `FIX-15` |
| 建设分三批（F / D / N）与层序 | `00-ter-build-order` §2 / §7 |
| 地基批完成标准：**四层都有内容 + 双运行面** | 同上 §4B.5 |
| `admin-console` 拆线（~3,300 进地基 / ~2,800 延后） | 同上 §4B.4 |
| `topology` 拆两半（上下文进地基 / 链路延后） | 同上 §3 |

## 12.B2 技术栈裁定（`T-1`…`T-10`，2026-08-28 补记）

⚠️ 这一组**此前完全没有进决策文档** —— Dexter 问起 NativeWind 才发现，
顺同类扫描后发现五条全漏。现已收进 `00-ter-build-order` §4B.10，**收编时不得再漏**。

| ID | 裁定 |
|---|---|
| `T-1` | 用 Expo（SDK 57）替代 RN 裸工程 |
| `T-2` | **UI 统一使用 NativeWind + React Native Reusables**；由此新增地基批包 `ui.base.primitives`，承载统一语义注册 |
| `T-3` | Sentry + `react-error-boundary`；boundary 到 screen 级，reset 重挂 screen 不重启 App |
| `T-4` | **不引入** React Compiler；但 `eslint-plugin-react-hooks` 第一天设 error |
| `T-5` | **不使用 RTK Query**（2026-08-28 二次裁定）。OpenAPI → 类型化 client 生成 + `kernel.base.transport` 执行全部策略。**顺带让 `TR-01` 全局零例外**（RTKQ 会自装 reducer 绕开 actor 路径） |
| `T-6` | automation 完全自研，不引 Maestro |
| `T-7` | 单一测试 runner：vitest，不引 Jest |
| `T-8` | TDP 通讯回到 WS，放弃 SSE |
| `T-9` | `adapter/android` 用 expo-module 实现 |
| `T-10` | 持久化后端由 adapter 决定，非 adapter 层无感 |
| `T-11` | `scripts.execute` 保留，**支持运行期远端下发脚本源**，不设来源限制 |
| `T-12` | 虚拟键盘按「单表面命中测试」实现；Reanimated 进入既定依赖集 |
| `T-13` | 引入 turbo 做 TER 内部任务编排 |

## 12.B3 作业纪律 checklist（`D-1`…`D-8`）

`03-review-discipline-claude.md` —— **Claude 做分析/评审时的作业纪律**，
由本轮真实发生的 8 类错误产生（看形态推语义 · 改一处不搜全库 · 事实翻了不回溯 ·
用产品尺子量 POC · 拿仓规挡用户 · 验证无关事实 · 脚本引号与 assert · 负面结论不穷举）。

⚠️ 与 `TR-*` / `T-*` **归属不同**：那两组是 TER 的规范与技术裁定，这一组是作业纪律。
收编时须与既有同类记忆**合并去重**，不要新增第二个真相源。

## 12.C 收编时建议的形态

1. **一条规则只住一处** —— 收进项目记忆后，本文与建设顺序文档只留**指针**，不复述内容
   （这正是 `FIX-10` 那条"文档漂移"的防法）；
2. 每条保持**自带反例 + 反例栏**的形态（v2s 两份 coding standard 的既有要求）；
3. `TR-*` 编号**保持稳定**，因为门的名字、红夹具、review checklist 都会引用它；
4. §9「否掉的候选」**一并收编** —— 它的用途是"下次有人再提同样的候选时先看这里"，
   丢了就会反复重提。
