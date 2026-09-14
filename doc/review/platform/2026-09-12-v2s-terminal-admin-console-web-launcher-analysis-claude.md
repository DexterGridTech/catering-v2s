# TER admin console Web 端无法唤起 — Claude 独立分析

```text
REVIEW_TARGET=DEFECT_ANALYSIS (Expo Web launcher)
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=NO-GO（针对 Web 档;不改变 Android/focused 档已有结论）
M/S/N=1/1/0
EVIDENCE_TIER=static（源码与 react-native-web 源码对账）;未执行任何命令,未打开浏览器
```

## 0. 先认我自己的责任

**这个缺陷我本该在需求阶段就挡住。** 事实经过:我读 POC 时看到并向 Dexter、向 Codex 都明确报告过 POC 的绑定是「原生 `onTouchEnd`、**Web `onClick`**」。但我随后:

1. 写 `AC-1.7` 时只约束了"祖先包裹、观察不拦截",**一个字未提输入模态**;
2. 新增 `A-5A` 时只判"不拦截业务触摸",**没有任何判据要求 Web 上真实输入能唤起**;
3. 实施评审时以**详设**为基准核代码——详设写 `onTouchEnd`,代码是 `onTouchEnd`,一致即放行,我没有回头问"那 Web 上谁触发它"。

话术里的散文不构成义务。没进需求条款与判据表的事实,下一轮就无人负责。本条根因在我,不在实施方。

## 1. 事实核验

**一、根因 — CONFIRMED,且比报告的更严重。**

`apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx` 第 109 行是全包唯一的事件绑定,`admin-shell` 全包**零处平台分支**(`Platform.` / `onClick` / `onPointer` / `onMouse` 均无命中)。

对照 `react-native-web` 源码 `dist/modules/forwardedProps/index.js`:`touchProps`(第 153 行起)与 `mouseProps`(第 144 行起)、`clickProps`(含 `onClick`,第 120 行)是**三个互不相干的转发族**,`View` 的 `forwardPropsList`(`dist/exports/View/index.js` 第 26 行)把它们一并转发给 DOM 元素。RNW **不把鼠标合成为触摸**。因此桌面鼠标只产生 `mousedown`/`mouseup`/`click`,`handleTouchEnd` 永不执行。

**但真实缺口比"鼠标不支持"更宽。** 第 85 至 86 行读的是 `event.nativeEvent.pageX` / `pageY`。在原生 RN 上 `GestureResponderEvent.nativeEvent` 确有 `pageX/pageY`;在 Web 上 `onTouchEnd` 收到的是 DOM/React 的 TouchEvent,坐标只在 `changedTouches[0]` 上,**顶层没有 `pageX`**。于是 `Number.isFinite(undefined)` 为假 → `logicalPointFromWindow` 返回 null → 第 90 行重置手势。

**结论:Web 预览用鼠标不能唤起,用真实触摸(平板浏览器或 devtools 触摸模拟)同样不能唤起。当前 Web 预览无任何输入可以打开 admin console。** 这同时排除了"改用触摸模拟即可规避"这条退路。

POC 那段看似啰嗦的 `resolveLauncherPoint`(先取 `changedTouches`/`touches`,再回落 `pageX`/`clientX`,且 `nativeEvent ?? event`)正是为这两件事写的。v2s 只抄了机制,没抄坐标提取。

**二、Web 鼠标支持是否属于本轮需求 — CONFIRMED 属于,不需要 Dexter 裁决。**

这一条不是未定义模态,需求正本已经写死:

- `ID-2.3`(第 350 至 351 行):"取不到标识时:console **必须能打开**,标识显示 `unknown`,口令默认 `123456`。**该路径用于 Web 端调试**。"
- `A-26`(第 543 行)判据:"…**Web 预览侧按不可得路径表现且降级标记可见**",**证据档位写明 `focused + Web`**。

即"在 Web 预览上打开 admin console"是已批准判据、已声明 Web 档、且其存在目的就是 Web 端调试。叠加 Dexter 的 Q-6 裁定"入口一律隐藏,只有手势"——没有第二条打开路径——所以 Web 上手势可用是 `A-26` 的**必要条件**。

因此这是**已确认的实现缺陷**,不是"Web 预览的未定义输入模态",也不需要产品裁决。

**三、前述事实逐条核对。** `terminal.admin:launcher` 节点存在、`isHostPrimaryDisplay` 门禁通过、点击未 dispatch `openLayerCommand`——这三条与源码逻辑自洽:门禁通过才会渲染该节点(第 102 行),而唯一的 dispatch 在 `handleTouchEnd` 完成分支内(第 99 行),handler 不执行则不 dispatch。**但现场坐标与点击次数属浏览器现场观察,我未打开浏览器,记 `UNVERIFIED`,按 Codex 现场报告采信其存在性,不采信其数值。**

**四、同根全集扫描 — 缺陷族只有一个成员。** `apps/terminal/ui` 生产代码中 `onTouchEnd` / `onTouchStart` **仅 1 处命中**,即 `AdminLauncher.tsx` 第 109 行;`trackAdminGesture` 的消费者也只有这一处。**其余同类隐藏手势入口:零个。** 不存在需要一并修的第二处。

## 2. findings

```text
[M-01] Web 预览无任何输入可唤起 admin console
状态：CONFIRMED
严重级别：M
位置：apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx 第 85-86 行、第 109 行；对照 react-native-web dist/modules/forwardedProps/index.js 第 120/144/153 行与 dist/exports/View/index.js 第 26 行
失败场景：(甲) 桌面鼠标 —— RNW 不把 mouse 合成 touch，onTouchEnd 永不触发；(乙) 真实触摸或 devtools 触摸模拟 —— onTouchEnd 触发，但 event.nativeEvent.pageX 在 Web TouchEvent 上为 undefined，坐标解析返回 null 并重置手势。两条路径都打不开。
影响面：ID-2.3 与 A-26（判据档位写明 focused + Web）在 Web 档结构上不可达；Q-6 裁定入口仅手势，无第二条打开路径；Web 端调试路径整体失效。Android/native 不受影响——原生 GestureResponderEvent.nativeEvent 确有 pageX/pageY。
最小修复方向：按 POC 的形态做**平台互斥绑定**——Web 绑 onClick，原生绑 onTouchEnd，**两者永不同时绑定**；并把坐标提取改为兼容两种事件形状（先 changedTouches[0]，再回落顶层 pageX，再回落 clientX；容器取 event.nativeEvent ?? event）。复用既有 trackAdminGesture 与 logicalPointFromWindow，不新增 tracker、不新增可见控件、不新增覆盖层、不新增第二条 openLayer 路径。
为什么更小的修复不足：只加 onClick 而不做互斥，会在 Web 触摸设备上把一次点按数成两次（浏览器在 touchend 后约 300 毫秒合成 click），5 次物理点按在第 3 次左右就触发，制造误开；这正是 POC 用 Platform.OS 分支而非叠加绑定的原因。只加 onClick 而不改坐标提取，Web 触摸路径仍然拿不到坐标。只改坐标提取而不加 onClick，桌面鼠标仍然无效。三者缺一不可。
是否需要 Dexter 裁决：否。ID-2.3 与 A-26 已把 Web 档打开 console 写成批准判据。
```

```text
[S-01] focused 证据在结构上无法覆盖平台事件桥，缺陷因此逃逸
状态：CONFIRMED
严重级别：S
位置：apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx#pressLauncher 第 163 行；apps/terminal/ui/base/admin-shell/test/adminLauncher.test.ts
失败场景：pressLauncher 直接读取并调用 launcher.props.onTouchEnd(...)，绕过 RNW 的 prop 转发与浏览器事件分发。全仓扫描确认 apps/terminal/ui 下**零个**测试使用 fireEvent、dispatchEvent、jsdom 或 happy-dom。因此现有 focused 证据只能证明"handler 的逻辑正确"，**在原理上无法区分"handler 正确"与"handler 永远不会被平台调用"**。这不是测试写得差，是这一层证据的能力上限。
影响面：A-3、A-4、A-5A 三条判据看起来覆盖了入口，实际都停在 handler 入口之内。A-26 的 Web 半边从未被任何自动化触及。
最小修复方向：补一条**真实事件层**的证明——在 Web 档用真实浏览器交互（或至少 DOM 级事件分发）走完"五次输入 → login 出现"，并同时断言一次物理点按只计一次。该证明必须挂在 A-26 的 Web 档下，不得由 focused 档顶替。
为什么更小的修复不足：把 pressLauncher 改成构造更逼真的事件对象仍然是直接调用 props，跨不过 RNW 转发这一层；在详设里写明"Web 用 onClick"也不够，判据不能只靠文字断言——这正是本次缺陷逃逸的完整路径。
是否需要 Dexter 裁决：否（补证据属既有 Web 档范围）；但何时跑 Web 档需要他的运行授权。
```

## 3. 看似覆盖、实际没覆盖的结论

- **"入口手势已被 focused 证明"** —— 不成立。三条相关判据全部止步于 handler 入口之内,平台事件桥零覆盖。
- **"A-4 的坐标换算已被证明"** —— 在 focused 档成立(我上一轮复算过其变异区分力),但它验证的是 `logicalPointFromWindow` 的算术,**不含事件对象的坐标提取**。本次缺陷正落在提取这一步,A-4 抓不到。
- **"Web 档只是未跑"** —— 不成立。证据文件第 199 行把 Web 记为 `NOT_RUN / not authorized`,读起来像"授权后跑一下即可"。实际是:**以当前字节,Web 档的 `A-26` 跑了也必红**。与我上一轮 M-01 同一形态——不是未执行,是不可执行。

## 4. 各档证据现状

- **static**：本分析的全部结论来自源码与 `react-native-web` 源码对账。**我未执行任何命令,未打开浏览器。** Codex 现场报告的 DOM 节点存在性我采信为现场观察,其坐标与点击次数我未复核,记 `UNVERIFIED`。
- **focused**：已有——手势纯函数、坐标换算算术、非等比变异红夹具、不拦截业务触摸的行为级断言。缺失——任何真实事件层证明;**该档结构上无法补上这一项**。
- **Web**：已有——零。缺失——`A-26` 的 Web 半边、`A-59`、Web SVG、Web preview login。当前为 `NOT_RUN` 且**以现字节不可达**。
- **Android / native**：本缺陷不影响。原生 `GestureResponderEvent.nativeEvent` 具备 `pageX/pageY`,`onTouchEnd` 由 RN 原生事件系统触发。既有 Android clean debug 的五击证据仍然有效,不因本条撤销。

## 5. 对"Web 鼠标支持是否属于需求"的最终建议

**属于,且已是批准判据,不需要新裁决。** 依据是 `ID-2.3` 第 3 条与 `A-26` 的 `focused + Web` 档位。

建议一并补两处文字,使它今后不再依赖任何人的记忆:

1. `AC-1` 增一条:手势必须在**该形态实际提供的输入模态**下可达;Web 预览的模态包含桌面鼠标与浏览器触摸,原生为触摸。
2. `A-26` 的 Web 半边或新增一条判据,把"真实事件层五次输入可开、且一次物理点按只计一次"写成可证伪判据。

这两条本该在我写 `AC-1.7` 时就有。是否现在改需求由 Dexter 定;在他裁决前我不动需求正本。

## 6. 授权边界

本文只是独立分析输入,**不自动成为产品裁决或实施授权**。不授权修改源码、测试、依赖或文档,不授权 Android、native、Web 运行、DEV、seed、UAT、部署或发布。`M-01` 的修复方向在既有批准需求(`ID-2.3`、`A-26`)范围内,不需要 Dexter 再裁;`S-01` 补证据需要他的 Web 档运行授权;§5 的两条需求文字修订需要他点头。
