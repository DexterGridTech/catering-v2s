# TER `kernel.base.platform-ports` 整改 · 独立 IMPLEMENTATION review（第二轮）

| 字段 | 值 |
|---|---|
| REVIEW_CYCLE_ID | `TER_PLATFORM_PORTS_IMPLEMENTATION_2026_08_30` · ROUND 2 / 2 |
| **VERDICT** | **GO** |
| M / S / N | **0 / 0 / 3** |
| 上轮 | 0M/2S/3N —— **五项全部闭合，且每项都有能证伪它的测试** |
| 方法 | 逐代码静态核验；本会话不运行命令，动态边界见 N-3 |

---

## 1 · 五项闭合的逐条核验

### S-1 · console 默认 —— **已闭合**

**实现侧**：`createPlatformPorts.ts` 的 console 分支现为无条件 `else sendToConsole(level, event);`，
`!(environmentMode === 'PROD' && level === 'debug')` 这个未声明的抑制已删除。

**测试侧**：`defaultPorts.test.ts` 的 D-1 重写为 **3 环境 × 4 级别**双层循环，每次
`mockClear()` 后断言 `toHaveBeenCalledTimes(1)`，并取出 `mock.calls[0][0]` 比对
`level`、`security.containsSensitiveRaw`、`data.safe` 保留、手机号与 token 不出现。

**证伪验证（静态推演）**：把 `sendToConsole` 函数体清空 → D-1 在第一个环境的第一个级别即
`toHaveBeenCalledTimes(1)` 失败。上轮那条"唯一的可用默认可以是空实现而全绿"的路径**已堵死**。

⚠️ 详设第 247 行同步更新为「`environmentMode` 作为 factory 输入保留，但本包的 console binding
不按环境丢弃任何日志级别」—— **文档与代码一致**，不是只改代码。

### S-2 · accepted 与 timeout —— **已闭合**

**timeout 半边（原 S-4，上轮零覆盖）**：现在由 `timeoutPort.resetRuntime({requestId, timeoutMs: 100})`
**实际调用端口**取得 `timed-out`，再断言 `timedOut.timeoutMs === 100` 且不是 `failed`/`unavailable`。
上轮那个"测试自造对象字面量再断言它自己"的恒真断言已消失。
⇒ 把任一端口的超时分支改成返回 `failed`，本条会红。

**accepted 半边**：observer 的翻转改由 fake 内部 `successorSignal.then(...)` 完成，
测试断言 `await Promise.resolve()` 之后状态**仍为 `pending`` —— 这条是真的，
它证明端口没有同步把受理当成生效。

### N-1 · 诊断字段保留 —— **已闭合，且做法比我建议的更严**

`sensitiveData.ts` 新增 `isSafeDiagnosticValue`，是**键名 + 值形状双重**放行：
`packageSha256`/`manifestSha256` 必须是 64 位十六进制、`bundleVersion` 必须点分数字、
`accountBalance` 必须十进制数。**这比单纯按键放行安全** —— 无法用一个叫 `packageSha256`
的键把任意密文夹带出去。

**顺序正确且这一点是关键**：`sanitizeText` 里 `isSafeDiagnosticValue` 在
`sensitiveKeyCategory` **之前**。若顺序反了，`accountBalance` 会先命中 `includes('account')`
被遮蔽 —— 现在不会。

**测试正反成对**：新用例同时断言四个放行字段原样保留 **且**
`unrelatedHash` → `[REDACTED:hash]`、`account` → `[REDACTED:account]`、
`containsSensitiveRaw === true`。⇒ 把 `isSafeDiagnosticValue` 改成恒真，反例半边会红；
改成恒假，保留半边会红。**两个方向都被夹住。**

### N-2 · `LogContext` 闭合投影 —— **已闭合**

`sanitizeContext` 重建 context：六个 branded ID 原样保留，`commandName` 走
`sanitizeText('commandName', ...)`，**未知字段不复制**。
`sanitizeLogEvent` 把 `context.sensitive` 并入 `containsSensitiveRaw`。

**测试直接证伪**：用 `Object.assign({commandName: 'Bearer context-secret'}, {extra: 'Bearer extra-secret'})`
构造带未知字段的 context，断言 `context.commandName === '[REDACTED:authorization]'`、
`context` **不含 `extra` 属性**、且 `context-secret` 不出现在序列化结果里。
且该用例走的是 `withContext(...)` **派生 logger**，顺带证明派生路径也过投影。

⇒ 上轮我说的"将来给 `LogContext` 加自由文本字段会静默绕过"这个隐患，
现在由「未知字段直接丢弃」从结构上消除 —— 新字段若不进白名单，**根本到不了 sink**。

### N-3 · 动态证据 —— **处理方式正确**

证据文件把原 §7.1 明确重标为 `Pre-remediation command ledger (historical baseline)`，
并另起 §11 记录本轮整改与新鲜 focused 运行；**没有把旧数字当成当前状态**。
文件自身也保留了 `N-3 remains UNVERIFIED_REQUIRES_EVIDENCE for Claude's independent dynamic
re-execution`。这一档位处理是诚实的。

---

## 2 · 本轮 findings

### N-1 · `environmentMode` 是必填公开输入，但在本包内可证明无任何作用

**CONFIRMED**。事实类别：仓内源码事实。

**位置**：`src/types/platformPorts.ts` 的 `CreatePlatformPortsInput.environmentMode`。

**事实**：全 `src/` 搜索 `environmentMode`，**只命中这一处类型声明**。
`createPlatformPorts` 与内部 `createLogger` 均不再引用它（S-1 的整改移除了它唯一的消费点）。

**这不是声称与行为不符** —— 详设第 247 行已明确写"作为 factory 输入保留"，
README 也只说它是构造参数、不出现在 `PlatformPorts` 里，两处都没有声称它有作用。

**后果**：它是每个调用点都必须提供的必填字段，而类型声明处没有任何说明。
下一个维护者要么把它删掉（牵动 exact export 清单与全部装配点），
要么以为 `'PROD'` 会降低详细度。可证伪：把任一调用点的 `'PROD'` 换成 `'DEV'`，
行为逐字节相同，全部测试仍绿。

**最小修复**：在该字段上加一行 JSDoc，写明它保留给 adapter 的 sink/level 策略、
**本包内刻意不影响脱敏与 console 级别选择**。
不建议删除 —— 详设已裁定保留，删除会牵动公开面。

### N-2 · S 组 accepted 半边的最后三行仍是测试自身管道

**CONFIRMED（低）**。位置：`test/successSemantics.test.ts` 第一个 `it` 的结尾。

`signalSuccess()` 由测试触发，observer 的 `.then` 也由测试的 fake 注册，
因此末尾 `expect(fakeState.terminalState).toBe('succeeded')` 只证明测试自己的 promise 已 resolve。

**但本条不要求改**：承载证伪力的是前面四条 —— `status === 'accepted'`、`requestId` 回环、
`terminalObservation` 取值、以及**跨一次 tick 仍为 pending**，它们已经覆盖
「受理冒充生效」这个目标缺陷。而 `appControl` 端口**按设计就没有终态观察通道**
（相关性落在 `hotUpdate` marker 的 `resetRequestId` 上），
所以包内测试本就无法观察真实终态。

**最小修复（可选）**：删掉末尾三行这段非承载性脚手架，或另起一条用例断言
marker 侧的 `resetRequestId` 相关性。**不影响本轮 GO。**

### N-3 · 动态输出仍需独立复跑

**UNVERIFIED_REQUIRES_EVIDENCE**。按 Dexter 的长期约定我不在本机运行命令。

本轮我静态核实的是：代码改动本身、测试断言的证伪力、放行顺序、
公开面仍 **124 = 124**（门的 expected 清单与 `src/index.ts` 零差）、
以及详设/README 与代码一致。证据 §11 的新鲜运行结果我未复跑。

---

## 3 · 重新寻找「所有门通过但包仍未建成」的路径

逐个推演本包每一处"可能被掏空而不被发现"的实现：

| 掏空对象 | 会红的判据 |
|---|---|
| `sendToConsole` | D-1（3 环境 × 4 级别的 `toHaveBeenCalledTimes`） |
| `createProcessMemoryStateStoragePort` 任一方法 | D-2 的往返断言（write→read→listKeys→remove→clear） |
| 任一 unavailable 端口的任一方法改成返回 succeeded | D-3…D-10 逐方法 `expectUnavailable(port, capability)` |
| `sanitizeLogEvent` 的 message/data/error 任一支 | L 组三环境 × 10 个 raw 子串不出现 |
| `sanitizeContext` | context 用例（`extra` 必须被丢弃、`commandName` 必须被遮） |
| `isSafeDiagnosticValue` 恒真或恒假 | 安全诊断用例的正反两半各夹一边 |
| `createPlatformPorts` 的冻结或 identity 透传 | A 组（`Object.isFrozen`、`Reflect.set` 返 false、九个 identity） |

**未发现新的假绿路径。** 上轮那一条已堵死。

⚠️ 需要说清的结构性事实：四道门与 support 检查的都是**形状**
（exact export、两层零可选、默认实现依赖白名单、无原生标识符），
它们**在原理上无法发现"形状正确但语义为空"的实现** ——
这项职责完全落在 A/D/S/L 四组运行时断言上。本轮之后这四组已能覆盖每一个可被掏空的实现点，
但**新增任何默认实现或端口方法时，必须同步新增对应的运行时断言**，
否则这条防线会重新出现缺口。该要求已写进本包 README 第 7.1 节。

---

## 4 · 授权边界

本 `GO` 只表示整改结果可交 Dexter 决定是否作为本包的收口。
不授权 adapter 与 native 补做、设备与 Gradle、DEV、seed、reset、浏览器 L2、UAT、
部署或仓级 normal verify。静态与 typecheck 结果、Expo export 均不构成任何 native、
Gradle、设备或 adapter 能力已被证明的结论。下一个包的授权归 Dexter。
