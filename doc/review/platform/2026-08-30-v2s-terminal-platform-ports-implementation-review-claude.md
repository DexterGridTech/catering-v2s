# TER `kernel.base.platform-ports` 实施 · 独立 IMPLEMENTATION review

| 字段 | 值 |
|---|---|
| REVIEW_CYCLE_ID | `TER_PLATFORM_PORTS_IMPLEMENTATION_2026_08_30` |
| REVIEW_TARGET | IMPLEMENTATION |
| **VERDICT** | **GO** —— 条件：S-1、S-2 闭合后本包才算收口 |
| M / S / N | **0 / 2 / 3** |
| 方法 | **逐代码静态核验**。按 Dexter 长期约定，本会话不在本机运行任何命令；动态输出只读证据文件，标 `UNVERIFIED_REQUIRES_EVIDENCE`（见 N-3） |

---

## 1 · 机器对账结果（逐项复算，未采信实施记录）

| 对账项 | 结果 |
|---|---|
| `src/index.ts` 导出 vs 详设 §10.2 清单 | **124 = 124**，双向零差 |
| 门里 `expectedPublicExports` vs 实际导出 | **124 = 124**，零差；且是**手写常量**，非源码自派生 |
| 九个端口接口方法集 vs 详设 §6 | 全等：appControl 9 · connector 4 · device 5 · hotUpdate 7 · logUpload 1 · logger 6 · script 3 · storage 8 · topologyHost 4 |
| `LoggerPort` 是否含 `emit` | **否**。公开面无 emit |
| 八个 unavailable 默认逐方法闭合 | **8/8 全闭**，无缺无多 |
| `capability` 是否精确等于方法名 | **全部相等**（设计 review 的 N-1 已闭合） |
| `PlatformPortName` | 闭集 **10** 值，与装配键一致 |
| `containerKey` / `surfaceKey` | `containerKey` 已用，**`surfaceKey` 零残留**（设计 review S-2 闭合） |
| `resetRequestId` | `types/hotUpdate.ts` 出现 2 处（设计 review S-1 取①闭合） |
| `tsconfig.json` include | `["src/**/*.ts","test/**/*.ts","vitest.config.ts"]` —— test 真在编译面 |
| contracts 门是否漂移 | **未漂移**：`CONTRACT_RULE_NAMES` 仍 4 条，expected exports 仍 **74 = 74** |

## 2 · 逐代码确认成立的关键机制

**统一脱敏漏斗**：`createPlatformPorts.ts` 里 `debug/info/warn/error` 四个入口全部经同一个内部
`write()` → `sanitizeLogEvent()`；`scope()` / `withContext()` **递归调用 `createLogger` 并传同一 binding**，
派生 logger 因此不可能绕过。`sanitizeLogEvent` **不接受 `environmentMode` 参数** ——
结构上就不可能"按环境放松"，比靠测试保证更强。

**sanitizer 覆盖面**：`message`（值扫描）· `data`（递归、键+值、对象整键命中即整体替换）·
`error.message/stack/name/code` 四项 · `containsSensitiveRaw` 由三处 or 汇总 · `maskingMode` 恒为 `'masked'`。
键规则覆盖 password/hash/otp/authorization/cookie/token/phone/login/account/ip/payload/credential 十二类。

**装配**：`Object.freeze` 施于 logger 与根对象；九个非 logger binding 按 identity 透传；
`environmentMode` 不进返回对象。A 组逐条断言了键序、`Object.isFrozen`、`Reflect.set` 返 `false`、
strict 赋值抛 `TypeError`、九个 identity、`'environmentMode' in ports === false`。

**类型层负夹具**：`public-surface.typecheck.ts` 603 行 / **15 个 `@ts-expect-error`**，
覆盖 accepted 无 `.value`、unavailable 无 `.value`、开放函数表不可赋 `ScriptNativeBindings`、
`RequestId`/`CommandId` 双向 brand 互斥、`ConnectorPort` 缺 `on`、`PlatformPortBindings` 缺 `topologyHost`
（类型位与 factory 调用位各一）、`emit`/`localWebServer`/`display`/`automation` 均不可从包根取用。

**门**：4 条规则名 + 1 support；TR-05 经具名 import 复用 contracts 的 analyzer。
model test 五个 mutation 各自定向，**且每次都断言其余门保持 PASS**（`status drifted during targeted mutation`），
另含一条设计里没有的传递依赖用例；fixture 清理有断言。

**verify 接线**：`expectedTaskOwners('test')` 已改为**显式具名七元组**（不再用 `includes('/adapter-')` 模式），
marker 断言逐名要求 contracts 与 platform-ports 均为 `REAL_TESTS` 且 `real.length===2`；
`verify-static.mjs` 在 contracts 之后串接 platform-ports 的 model + real，`run()` 非零即失败，
`TERMINAL_STATIC=PASS` 只在全链绿时打印。

---

## 3 · Findings

### S-1 · `consoleLoggerBinding` 的"可用"从未被断言；且 PROD 丢 debug 是详设未声明的行为

**CONFIRMED**。事实类别：仓内源码事实 + 可复现推论。

**位置**：`src/foundations/createPlatformPorts.ts` 的 `write()`
（`binding.kind === 'sink'` 分支之后的 console 分支与紧随的 `return {status:'succeeded'...}`）；
`test/defaultPorts.test.ts` 的 D-1；`test/logger.test.ts` 全部四条。

**事实一**：console 分支是
`else if (!(environmentMode === 'PROD' && level === 'debug')) sendToConsole(level, event);`，
其后**无条件**返回 `succeeded`。详设 §6.1 与 §7.4 **从未声明任何级别过滤**；
§7.4 的 logger 行写的完成点是"sanitizer 完成且 **sink 同步返回**"、
可观察确认是"返回的 `LogEvent` 与 **sink 捕获值一致**"。
在 PROD + debug + console 这条路径上，**没有任何捕获**，却返回 `succeeded`。

**事实二**：D-1 用 `vi.spyOn` 接管了四个 console 方法，但**自始至终没有一条
`expect(spy).toHaveBeenCalled*`**；它只调用 `logger.info`，断言 `status === 'succeeded'` 与
`maskingMode === 'masked'`。而 L 组四条测试**全部使用 `{kind:'sink'}` binding**，
console 分支在整个测试集中**从未被断言过**。

**可证伪失败条件**：把 `sendToConsole` 的函数体清空（任何 level、任何环境都不输出）。
`typecheck`、A/D/S/L/C/F、四道门与 support、`TERMINAL_VERIFY` **全部仍然绿**。
⇒ 本包**唯一的"可用默认"可以是一个彻底的空实现而全部判据通过**。

**影响面**：① 存在"全部判据通过但包实际未建成"的路径，且落在唯一的可用默认上；
② PROD 下 `logger.debug(...)` 返回 `succeeded` 而实际什么都没发生，属 `TR-02` 家族
（「什么都没做」的路径返回了成功），调用方无法区分"已写出"与"按策略丢弃"。

**最小修复（两条都要）**：
① D-1 逐 level 断言 console 默认真的写：`expect(debugSpy).toHaveBeenCalledTimes(1)` 一类，
   并至少一条断言传给 console 的就是那个 sanitized event；
② PROD-debug 抑制**二选一**：删掉该分支，让级别策略留给 adapter 的真实 sink（更简单，推荐）；
   或写进详设并让结果可区分，不得让 `succeeded` 同时表示两种事实。

**为什么更小方案不足**：只在证据里补一句说明不行 —— 缺的是断言；
只加断言而不处理抑制，等于把"PROD 下 debug 不写却成功"固化成预期行为。

**为什么不是 M**：影响面限于 console binding 的 debug 级别；真实 adapter 走的 sink 分支不受影响，
脱敏闭包与其余全部判据都真实成立。

### S-2 · S 组两条断言是自证式的，对目标缺陷零证伪力

**CONFIRMED**。事实类别：仓内源码事实。

**位置**：`test/successSemantics.test.ts` 两个 `it`。

**事实一**：`terminalState` 是测试自己的局部变量，fake 的 `resetRuntime` **从不触碰它**；
测试写 `terminalState = 'succeeded'` 之后断言它等于 `'succeeded'`。
这一对是 `x = 'a'; expect(x).toBe('a')`，恒真。

**事实二**：`timedOut` 是测试**自己写的对象字面量**，随后断言它的 `status` 与 `timeoutMs` ——
**不经过任何端口**。详设 §8.3 的 S-4 要证伪的是"timeout 语义丢失（被改写成 generic failed 或 unavailable）"，
而没有任何端口产出的 `timed-out` 被检验过。

**可证伪失败条件**：把某个端口实现的超时分支全部改成返回 `failed`，S 组仍全绿。

**影响面**：S-4 的目标缺陷在运行时完全未覆盖；S-2 的"保持 pending"实际由 S-1 的
`expect(result.status).toBe('accepted')` 间接兜住（若 fake 改成立即 succeeded，该断言会红），
故 S-2 属部分覆盖，S-4 属零覆盖。

**最小修复**：让被断言的值由**端口产出**——
`resetRuntime` fake 内部持有 observer，断言在未收到 successor signal 前跨一次 await tick 仍为 pending；
`timed-out` 由一个超出预算的 fake 方法返回，断言其 `timeoutMs` 等于调用入参且 `status` 不是 `failed`/`unavailable`。

**为什么更小方案不足**：改名或加注释不恢复证伪力；断言必须观察端口产出的值，而不是测试自己写下的值。

### N-1 · sanitizer 三处过度遮蔽，会吃掉最该看的诊断字段

**CONFIRMED**。位置：`src/foundations/sensitiveData.ts` 的 `valueCategory` 与 `sensitiveKeyCategory`。

- `\b[0-9a-f]{32,}\b` → 判为 `hash`。`HotUpdateDownloadInput.packageSha256` / `manifestSha256`
  与 `HotUpdateInstall` 的两个 hash **正是排查坏包时最需要打的字段**，会整值变成 `[REDACTED:hash]`；
- `normalized.includes('account')` → `accountBalance` 这类普通字段被整体遮蔽；
- `(?:\d{1,3}\.){3}\d{1,3}` → `bundleVersion: '1.2.3.4'` 被判为 IP。

不是泄漏，是可用性：热更新与拓扑诊断会丢掉关键字段。
L-11 只用无害值（`count:1`/`status:'ok'`），抓不到这三类。
**最小修复**：值扫描前按键放行已知安全键（`*Sha256`、`bundleVersion` 一类），或收窄这三条正则；
并给 L 组补一条"合法 hash 与版本号必须原样保留"的反例。

### N-2 · `LogContext` 不进 sanitizer，且该前提没有任何东西钉住

**CONFIRMED**。位置：`sanitizeLogEvent` 的 `context: event.context`（原样透传）。

当前**安全**，因为 `LogContext` 是闭合形状、字段是六个 branded ID 加一个开发者书写的 `commandName`，
不含自由文本用户数据。但这个前提既无注释也无测试；
将来给 `LogContext` 加一个自由文本字段，就会**静默绕过唯一的漏斗**。
**最小修复**：让 `context` 也过 `sanitizeFields`（成本一行），或写明豁免前提并加一条守住闭合性的断言。

### N-3 · 动态输出我无法独立复现，按证据档位处理

**UNVERIFIED_REQUIRES_EVIDENCE**。

Dexter 的长期约定是我只做静态检查、不在本机运行命令。因此证据 §7.1 的八条命令、退出码与耗时，
以及 §7.2 的 `--listFilesOnly`（`MATCHED_FILES=32`、`INCLUDES=...=YES`）与去除 `@ts-expect-error` 的
反向控制（`TS2339` / `BRAND_RED=PASS` / `EMIT_RED=PASS`），**我核的是它们所验证的静态事实**：
`tsconfig` 的 include 确实覆盖 `test/**`、夹具确实存在且位置正确、门的 expected 集合确实与源码相等、
mutation 确实定向、verify 接线确实串接 —— **不是这些命令的实际执行结果**。
本条不改变 GO，因为 S-1、S-2 与三条 N 全部由源码本身即可证明。

---

## 4 · 对提问项的逐条结论

| # | 提问 | 结论 |
|---|---|---|
| 1 | 十端口方法集 / exact exports / 默认实现 / typed unavailable 是否逐方法闭合 | **是**。124=124、9 个接口方法集全等、8 个 unavailable 逐方法闭合 |
| 2 | `resetRequestId`、`containerKey`、`capability` 精确值、十端口闭集 | **四项全部与设计一致**，且是设计 review 三条 finding 的落点 |
| 3 | 五态是否可区分、accepted 是否错误暴露成功值 | **可区分**。类型层有 `accepted.value.completed` 与 `unavailable.value` 两条 `@ts-expect-error` 钉死 |
| 4 | logger 公开入口是否统一脱敏、有无 emit 旁路 | **统一，且无 emit**。四入口 + 派生共用一个 `write()`；sanitizer 不接受环境参数 |
| 5 | test 是否真进 tsc、负夹具与反控是否有效 | include 覆盖 `test/**` 且夹具就位（**静态确认**）；实际 `--listFilesOnly` 与反控见 N-3 |
| 6 | A/D/S/L/C/F 是否真正证伪 | **A/D/L/C/F 是；S 不是** —— 见 S-2。另 D-1 对唯一可用默认无证伪力，见 S-1 |
| 7 | 四门是否各有定向 red、真实树是否独立全绿 | **定向 red 成立**（每个 mutation 断言其余门 PASS，另加一条传递依赖用例）；真实树全绿属 N-3 |
| 8 | verify 的 22/7/2+5 与 Expo export | 接线**静态成立**且 owner 已改为具名七元组；数字本身属 N-3。⚠️ Expo export 只证明 Metro 能消费新公开面，**不构成 native/Gradle/设备/adapter 能力证明**，证据 §7.1 也是这么写的 |
| 9 | 是否仍有"全绿但包没建成"的路径 | **有一条**，即 S-1：`sendToConsole` 清空后全部判据仍绿 |
| 10 | 是否把静态结果升格为真机证明 | **没有**。证据 §6/§10 与详设 §12 都保持 `UNVERIFIED_REQUIRES_EVIDENCE` 与 `DEXTER_DECISION` 未升格 |

**需 Dexter 裁决**：无新增。原有 `exit`/`kiosk` 的 owner 与产品授权仍为 `DEXTER_DECISION`，未被升格。

**非 finding 的登记项**：本包尚无 `README.md`。今日新立的 `TR-10` 要求每个 TER 包收口时交付中文 README，
但 Dexter 已明示本包"还没完全落地，可以延后再写" —— 记在此以免遗漏，不计入 finding。

---

## 5 · 实际打开核过 / 未核

**核过**：platform-ports 的 `package.json`、`tsconfig.json`、`src/index.ts`、
`src/types/*`（10 个）、`src/foundations/createPlatformPorts.ts`、`src/foundations/sensitiveData.ts`、
`src/defaults/*`（10 个）、`test/*`（5 个，含 603 行类型夹具）；
`tools/terminal-platform-ports/check-static.mjs` 与 `check-static.test.mjs`；
`tools/terminal-contracts/check-static.mjs`（规则名与 expected 集合）；
`tools/terminal-skeleton/verify.mjs`、`verify-static.mjs`、`verify.test.mjs`；
`doc/evidence/.../implementation-codex.md`（章节结构、§7.1、§7.2）；
详设与需求正本对应章节。

**未核**：`check-static.mjs` 中 TR-05 analyzer 的**内部实现细节**（我核的是它被具名复用、
且 contracts 侧规则名与 expected 集合未变，未逐行审 analyzer 本体的重构差异）；
证据 §8 端口台账与 §9 用例账的逐行复算（抽核了与 finding 相关的部分）；
以及全部动态命令输出（N-3）。

---

## 6 · 授权边界

本 `GO` 只表示实施结果可交 Dexter 决定是否作为本包的收口，且以 S-1、S-2 闭合为条件。
不授权 adapter/native 补做、不授权设备/Gradle、不授权 DEV、seed、reset、浏览器 L2、UAT、
部署或仓级 normal verify。静态与 typecheck 结果、Expo export 均**不构成**任何 native、
Gradle、设备或 adapter 能力已被证明的结论。
