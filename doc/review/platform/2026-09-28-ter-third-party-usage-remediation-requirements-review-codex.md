# TER 第三方库用法整改正式需求评审（Codex）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档应然事实、矛盾与无出处阈值提取
被审对象=doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md（v3）
上游输入=doc/review/platform/2026-09-28-ter-third-party-library-usage-health-check-claude.md
reviewerKind=CODEX_REVIEW
EVIDENCE_TIER=静态源码、仓内规范与文档；第三方行为按精确 tag 官方源码静态核对；未运行任何测试、构建、Web、Metro、Android 或设备
VERDICT=NO-GO
M/S/N=1/3/1
```

## 结论

NO-GO。需求的范围、阶段顺序、两端验证要求和多数技术验收已具备实施基础；但一个已定技术栈裁定被排除，且数项关键验收仍可在假绿状态下通过。以下 findings 先由需求作者处理；涉及取舍的事项交 Dexter 裁决。

本评审独立回到当前源码核验了 F-1 至 F-28。第三方行为只做静态核验，没有运行基线门或任何动态验证；本报告不声称这些运行结果已验证。

## Findings

### M-1 · T-3 的 Sentry 部分被列为非目标，和现行裁定冲突

- **类型**：仓内事实 + 产品/范围判断；`DEXTER_DECISION`
- **位置**：需求 §1.2 第 70–73 行、F-20 第 100 行、TP-B1 第 296–316 行、§6 第 538 行、§7 第 556 行；T-3 正本见 `project-memory/decisions/terminal-architecture-and-stack-rulings.md:55-59` 与 `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md:909-924`。
- **事实**：T-3 明确写的是“Sentry + react-error-boundary”，并说明 POS 离线情况下需要离线队列/上传窗口；需求 TP-B1 只落实 `react-error-boundary` 与本地错误日志，§6 又把“Sentry 部分”整体登记为后续非目标。与此同时 §1.2 与 §7 声称遵循 T-3，没有记录 Dexter 对 Sentry 延期或取代裁定。
- **影响/反例**：按当前字面实施能够满足 screen/layer fallback，却仍没有生产故障上报；这正是 T-3 原文指出的“没有崩溃上报 = 没有故障可见性”。终端长期离线还意味着不能把“以后加一个 sink”当作已闭合的裁定。
- **需求层建议**：请 Dexter 明确二选一：本批纳入 T-3 的 Sentry 上报与离线投递要求，并补验收；或明确裁定本批只实施 boundary、Sentry 延期，作为对 T-3 的范围取代，并同步收窄 §1.2/§7 的“一致”表述与 T-3 追踪状态。评审方不替 Dexter选择。
- **严重度**：M。若保持当前“遵循 T-3”声明，实施后仍会缺少已定的崩溃可观测能力。

### S-1 · ESLint count-only 豁免无法保证“不让新违例替换旧违例”

- **类型**：仓内事实 + 推论
- **位置**：需求 TP-A3 第 182–195 行；当前 `node_modules/eslint/lib/services/suppressions-service.js:127-181`，特别是 129–131、166–181 行；`eslint.config.mjs:11-29`。
- **事实**：ESLint 9.39.5 批量豁免数据按相对文件路径与 rule ID 保存 `count`；执行时只比较该文件/规则本次违例数量与 count，不锚定原诊断位置。需求将基线聚合为“规则 × 包”计数，并要求加入违例的红夹具。
- **反例**：同一文件中原有一个被豁免的 `react-hooks/refs` 违例被修掉，同时加入另一个该规则违例，文件/规则数量仍为 1；内置 suppression 会继续抑制它，包级基线也未增加。单纯“追加一条”红夹具不能覆盖这种替换。
- **需求层建议**：明确“只降不升”接受的是计数级棘轮，允许同文件/规则等量替换；或要求额外保留并比较诊断身份/位置，使新增位置不能由旧位置减少抵销。后一选择超出 ESLint 内置 count-only 语义，应先确定所需保障，不宜把现有机制描述成逐项棘轮。
- **是否需 Dexter 裁决**：若接受 count-only 替换风险，则需 Dexter 接受该范围取舍；否则由需求作者补强判据。

### S-2 · Kotlin 单测“发现数等于执行数”未定义 skipped 的处理

- **类型**：推论 / 验收口径缺项
- **位置**：需求 TP-A4 第 197–207 行；当前原生测试源集与入口：`apps/terminal/application/base/android/android/build.gradle:20-27`、`apps/terminal/adapter/android/persist-kv/android/build.gradle:9-12`、`apps/terminal/adapter/android/dual-screen/android/build.gradle`。
- **事实**：验收要求从 JUnit XML 逐个测试类取“执行数”，并使发现数等于执行数；但没有规定 XML 的 `skipped` 属性、失败/错误属性如何进入该等式。JUnit 报告的 tests 总数可能包括 skipped 用例。
- **反例**：若逐类比较 `tests == discovered`，即使某个用例因 `@Ignore`/assumption 被跳过，也可计入 tests 总数而不是真正执行；当前“一个断言失败红夹具”只能证明该单个夹具执行，不能证明其他测试类没有被跳过。
- **需求层建议**：定义逐类关系 `discovered = executed + skipped`，并明确本批要求 `skipped=0`、`failures=0`、`errors=0`；如允许已有 skip，则列出逐项允许清单并要求不增加。
- **是否需 Dexter 裁决**：否，属于验收定义补全。

### S-3 · TP-A9 的并发红测试没有要求确定地触发锁交错

- **类型**：仓内事实 + 推论
- **位置**：需求 TP-A9 第 249–256 行；当前反向持锁路径在 `apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyServer.kt:159-175` 与 `TerminalTopologyHostRegistry.kt:100-128,186-188`。
- **事实**：当前 server 回调在 peer 锁路径内发布事件，registry 发布会进入 registry 锁；registry 的关闭路径持有 registry 锁并关闭 server/peer。需求要求“生产 registry 路径并发测试”且修复前有界判红，但未规定如何稳定地产生两条竞争路径的交错。
- **反例**：单纯启动两个线程并等待有界时间，不保证调度器在每次测试中都分别让线程一持有 peer 锁、线程二持有 registry 锁。修复前也可能因未撞上交错而通过；“有界等待”只限制挂死时长，不保证触发了死锁条件。
- **需求层建议**：要求测试通过可控同步点/屏障确定性地建立反向持锁前置状态，再同时放行两条生产路径；验收需证明修复前稳定红、修复后两方均在有界时间完成，并断言预期 close reason。具体同步 seam 由详设选择，需求层锁定确定性与结果即可。
- **是否需 Dexter 裁决**：否，属于可证伪性补强。

### N-1 · TP-A7 的重复连接次数 N 没有冻结

- **类型**：设计阈值缺项
- **位置**：需求 TP-A7 第 230–240 行，尤其第 238 行“反复连接、断开 N 次”。
- **事实**：测试次数 N 未赋值；连接线程回到基线是容量/资源回收判据，重复次数会影响该判据能否暴露泄漏。
- **影响**：不同实施者可用 1 次或数百次并都声称满足“N 次”，结果不可比较，也无法复核测试成本与检出力。
- **需求层建议**：冻结一个具体重复次数，或给出可机械计算的次数下界及依据；同时规定“线程回到基线”的观察窗口与线程集合判据。
- **是否需 Dexter 裁决**：否，阈值应由需求作者基于资源与检出率给出；若阈值改变产品可接受风险，再交 Dexter。

## F-1 至 F-28 当前字节核验摘要

| 事实 | 当前核验结论 | 当前源码锚点/说明 |
|---|---|---|
| F-1 | CONFIRMED（映射与色键分层成立） | `apps/terminal/application/base/android/config/index.cjs:121-183`；两个 integration `theme/global.css`；`ui/base/primitives/src/theme/tokens.ts` |
| F-2 | CONFIRMED | `application/base/android/.../TerminalTopologyHostRegistry.kt:73-80` 仍调用无参 `start()`；配置仍为 10s/30s；精确版本官方依据为 NanoHTTPD 2.3.1 tag |
| F-3 | CONFIRMED | `TerminalTopologyServer.kt:199-207` 检查发生在 NanoWSD 回调；官方 NanoWSD 2.3.1 tag 的 `readPayload()` 在 `:2887-2895` 先按声明长度分配，再读入 |
| F-4 | CONFIRMED | 当前 `apps/terminal` 生产/测试源码未检出 boundary 实现；需求所说“无 `react-error-boundary` 声明”与当前 package 字节一致 |
| F-5 | CONFIRMED | `ui/base/input/src/components/InputProvider.tsx:56-67,212-239` |
| F-6 | CONFIRMED | `ui/base/render/src/components/LayerStack.tsx:151-169` 保存拆开的 `focus` 后再调用；实现行为与需求列出的风险一致 |
| F-7 | CONFIRMED | `LayerStack.tsx:237-239` 当前仍并列设置 `focusable`、`tabIndex`、`accessibilityViewIsModal`；平台语义引用 RN 0.86.3 源码 |
| F-8 | CONFIRMED | `TerminalNativeLoadingModule.kt:10-26` 与 `TerminalNativeLoadingRegistry.kt:316` |
| F-9 | CONFIRMED | 两个 `MainActivity.kt:24-31` 仍读写 `preventAutoHideCalled` 并调用 `hide()` |
| F-10 | CONFIRMED | root `package.json` React 版本与两个 app `app.json` 无 `experiments` 字段；隐式默认行为需在详设按解析版本留据 |
| F-11 | CONFIRMED | `kernel/base/transport/src/foundations/createTopologyStateTransfer.ts:288-303` 仍调用 `unzlibSync(encoded)` 后才比较 `rawBytes` |
| F-12 | CONFIRMED | `TerminalTopologyServer.kt:159-175` 的 peer 锁与 `TerminalTopologyHostRegistry.kt:100-128,186-188` 的 registry 锁存在相反嵌套路径 |
| F-13 | CONFIRMED | `adapter/android/persist-kv/.../TerminalPersistKvModule.kt:209-212,298-303` 把设备 ID 接在 prefix 后；MMKV 2.4.2 官方 `AESCrypt.cpp` 按 `getMaxKeyLength()` 截断输入 |
| F-14 | CONFIRMED | `adapter/android/dual-screen/.../TerminalDualScreenActivityHandler.kt:110-125` 目前以“非默认 display”选 secondary，未过滤 presentation 类别 |
| F-15 | CONFIRMED | 当前静态检索仍找到 29 个测试文件使用 `react-test-renderer`，以及 10 个对应手写 `.d.ts` |
| F-16 | CONFIRMED | 当前检索仍找到 27 个 Vitest 配置包含 `__DEV__` 固定定义；两个 DEV 分支形态在指定文件中存在 |
| F-17 | CONFIRMED | integration `publicSurface.test.ts` 与 `tools/terminal-shared/typescript-analysis.mjs` 的所述接口使用仍存在 |
| F-18 | CONFIRMED | `TerminalTopologyServerTest.kt:44-53` 的 `testConfig()` 未提供 `HostConfig.moduleName`；三个 TER 原生模块均有 `src/test`；旧 `check-behavior.mjs` 仍存在且属原地改写脚本 |
| F-19 | CONFIRMED | root `eslint.config.mjs:11-29` 同一块覆盖 frontend、foundation、TER；`apps/terminal/package.json:13` 使用 Turbo lint；当前 invariants 尚标 lint ABSENT |
| F-20 | CONFIRMED，且本 finding 指出需求漏项 | T-3 正本为“Sentry + react-error-boundary”，并明说离线队列/上传窗口；T-4 不引 React Compiler，hook 规则“第一天 error”另有明确陈述 |
| F-21 | CONFIRMED | `terminal-coding-standard.md:976`；`ui/base/primitives/src/vendor/` 的 README 记载其为改造后的 copy-in |
| F-22 | PARTIALLY_CONFIRMED | hydration 对旧 storage kind 使用 `groupEntries(..., true)` 并 `listKeys`；Android store 对新 protected namespace 写 marker。代码不能证明“每台运行过 App 的物理设备当前均已存在 marker”；需求已把虚拟机状态标为推论 |
| F-23 | CONFIRMED | `TerminalDualScreenActivityHandler.kt:35-73` |
| F-24 | CONFIRMED | `LayerStack.tsx:151-173` 与 `ui/base/input/src/hooks/useInputFocusController.ts:270-282` |
| F-25 | CONFIRMED | `SystemFailureNotice.tsx:29-37` 默认文案；`ScreenReadyBoundary.tsx:10-14` 拥有“请重启终端”文案 |
| F-26 | CONFIRMED | `ScreenReadyBoundary.tsx:207-257` 只从目标 PRIMARY 匹配及实际 layout 走 ready callback，并传 `contentFailure`；`SurfaceRoot.tsx:13-24` 中 LayerStack 与 ScreenContainer 为兄弟，assembly 中 AdminLauncher 在 surface 内容之外 |
| F-27 | CONFIRMED | 实际解析 ESLint 9.39.5；本地 `node_modules/eslint/lib/services/suppressions-service.js:127-181` 证实 suppression 是文件×规则计数，不锚诊断行，支撑 S-1 |
| F-28 | CONFIRMED | `ui/base/primitives/src/vendor/slots.tsx:58-68` 是唯一共享 TextInput slot，并固定 `showSoftInputOnFocus: false` |

未发现本需求所用的当前字节引用存在会改变整体范围的路径迁移；需特别注意 F-22 只可作为当前代码推导，设备事实上仍须按 TP-A11 的授权验证。

## 独立提取与方案合理性

### 动作 1-B 提取

- **文档间实质矛盾**：TP-B1 声明遵循 T-3，但 §6 将 T-3 的 Sentry 部分延期（M-1）。
- **判据仍有可空过路径**：count-only suppression 的同文件同规则等量替换（S-1）；JUnit skip 被当作 tests 数（S-2）；普通并发调度不触发锁反向交错（S-3）。
- **未冻结具体阈值**：TP-A7 的 N 次（N-1）。
- **模板覆盖**：本对象是正式需求，不是 IA、交互稿、详设或实施计划。四份设计模板本轮均 `NOT_APPLICABLE`；相应模板内容应在授权的详设/计划阶段逐节应用，而不是把详设模板强塞入需求。

### 方案合理性判断

总体上“检测器优先、UI/原生分面、最后迁移测试框架与格式化”的顺序可实施；TP-A7/A9 使用生产 registry 路径、TP-A11 把身份影响限定在实际截断后的 key、TP-B1 将 screen/layer 恢复与 loading readiness 分开，方向清楚。TP-D1 已要求在详设阶段 POC，且把 RNTL + Vitest + TER RN stub 的未验证组合明确列为实测前置，没有把官方支持度臆测成已证。

但上述四条 S/M 可能导致“看似按需求通过、实际仍遗漏批准能力或回归”的情况；在修订前不建议直接把本需求转为详设输入。除 M-1 的范围裁决外，不建议扩大本批目标，也不建议借本批升级依赖或重做业务语义。

## 未验证清单与结论块

L1_ENGINEERING=NO-GO：M-1 至 S-3 修订前验收仍可假绿；N-1 的连接次数阈值未冻结。
L2_USER_VISIBLE=findings：TP-B1 的故障可观测范围（Sentry 是否延期）需要裁决；键盘、焦点、菜单等要求有明确用户期望，后续须按 TR-16/TR-17 双端验证。
L3_UNVERIFIED=本轮没有执行运行或动态核验。待未来实施验证：颜色构建产物、NanoHTTPD 心跳/半开行为、首屏 boundary/loading 释放、硬件焦点与 Tab/扫码、长按系统菜单、MMKV 既有 namespace、原生测试耗时等。该清单是未验证事实，不把静态源码确认升级为设备 PASS。
SAME_ROOT_SCAN=已检查 F-1 至 F-28 的对应源码组；S-1 检查当前唯一共享 ESLint 配置与 29 个 TER 包 lint ABSENT 分母；S-2 检查三个含 `src/test` 的原生模块；S-3 检查 server 与 registry 的两把锁及 publish/close 路径。
DESIGN_GAPS=TP-A4 明确 JUnit XML 的 skipped/failure/error 计数语义；TP-A7 冻结重复连接次数与线程基线观察窗口；TP-A9 要求确定性锁交错，不只写“并发 + 有界等待”。
TEMPLATE_COVERAGE=ui-interaction-design-template:NOT_APPLICABLE（需求阶段）；ia-design-template:NOT_APPLICABLE（需求阶段）；implementation-design-template:NOT_APPLICABLE（待授权详设）；journey-decision-template:NOT_APPLICABLE（未单独创建 Journey 工件）。
EVIDENCE_TIER=静态；没有测试、构建或动态结果。

## 边界

本文件只评审需求，不授权改需求、详设、计划、源码、测试、依赖、构建或运行环境。finding 的接受、severity 与产品范围由 Dexter 决定；需要修改的需求仍由 Claude 维护。
