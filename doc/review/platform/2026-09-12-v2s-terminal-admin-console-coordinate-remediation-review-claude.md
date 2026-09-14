# TER admin console 坐标修复复审 — Claude

```text
REVIEW_TARGET=IMPLEMENTATION (S-01 + N-01 + N-02 REMEDIATION)
REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_IMPLEMENTATION_20260912
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO_WITH_UNVERIFIED_UI（工程层等同 GO;L3 非空,按 review-standard 不得写裸 GO）
M/S/N=0/0/1
```

## 0. 出处与方法

v2s-rooted 续接会话,非 fresh acceptance。按当前字节重开源码与测试逐行核验,**未执行任何命令**;brief 的自报结果一律未作为结论依据。对"变异会不会被抓"这一条,我**独立复算了三组 fixture 的判定**,不转述 brief 的结论。需求正本与历次评审由我撰写,实现与证据由 Codex 撰写。

## 1. 结论

`GO_WITH_UNVERIFIED_UI`,`0M / 0S / 1N`。上一轮的 `S-01` 与两条 note 全部真实闭合,修复方式与我给的最小方向一致,未扩大范围。仅留一条低概率的测试稳定性 note。

## 2. 逐项核验

**一、`coordinateSpaceOf` 是否真读 host 高度 — CONFIRMED。** `apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx` 第 35 至 36 行为 `scaleX: host.width / canvas.width`、`scaleY: host.height / canvas.height`。逐轴推导保持正确,未被"修复"成别的形状。

**二、组件级非等比 fixture 是否走生产路径 — CONFIRMED。** `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` 第 315 行的 host 为 `{width: 2560, height: 1200}`,画布为 laptop landscape PRIMARY 的 `1280×800`(由 `sample-console/package.json` 声明),故 `scaleX=2`、`scaleY=1.5`,**确为非等比**。该用例经 `createSampleAssembly` 建真实生产 assembly、`createSurfaceForDisplayIndex` 挂载,`pressLauncher` 取生产 `adminTestIds.launcher` 节点并调用其真实 `onTouchEnd`,页坐标由渲染树中 `ui-base-render:surface-host-canvas` 的真实 transform 反推。**未绕过生产 `AdminLauncher`。**

**三、变异是否真被抓 — CONFIRMED（我独立复算,非转述）。** 按 `scaleY := host.width / canvas.width` 复算三组 fixture:

- `(95,100)` 越界例:pageY = 200 + 100×1.5 = 350。正确推导得 logical y = 150/1.5 = **100**,越界拒绝;变异推导得 y = 150/2 = **75**,落入区内并开启。断言期望 0 个 login → **变异必红**。
- `(95,95)` 合法例:正确 y = 95,变异 y = 71.25,**两者都在区内**,该断言不区分。
- reduced 的 `(100,100)`:host `640×400` 为等比,正确与变异都得 y = 100 越界,**不区分**。

所以抓住变异的是**新增的那一条越界断言**,位置与 brief 所述的第 328 行一致。我同时确认另两条不具区分力——这不是缺陷,但意味着**这条越界断言是唯一的红夹具,不可被后续重构删除或放宽**。

`doc/evidence/platform/2026-09-12-...-implementation-evidence-codex.md` 第 436 行记录了"坏变异首轮因只有 inside 点仍全绿,补 outside-y 后才真实失败"。这与我的复算完全吻合,且**如实保留了中间失败**而没有写成一次就绿。这是本轮证据里最有价值的一条。

**四、内部参数是否必填 — CONFIRMED。** `sample-console/src/assembly/assembly.tsx` 第 193 行与 `assembly/android/sample-terminal/src/assembly/platformPorts.ts` 第 35 行均为 `readonly surfaceForm: SurfaceForm`,**无可选标记、无 `?? 'laptop'` 兜底**;仅最外层 `App.tsx` 第 23 行保留默认。与我给的最小方向逐字一致。全仓 `createSampleAssembly` 与 `createSampleTerminalAssembly` 调用点共 **25 处,全部显式传值,零遗漏**(我逐块解析确认)。

**五、`pressLauncher` 死代码 — CONFIRMED 已删。** 第 160 至 166 行现为直接构造 `pageX`/`pageY`、对其做有限性断言、再传给 `onTouchEnd`。**不再调用 `logicalPointFromWindow`**,测试与被测生产函数之间的同义反复风险消除。

**六、文档同步 — CONFIRMED。** 实施计划第 436 行把 A-4 明确记为 `Android (focused precursor)` 并写明 Android 仍须重跑真实宿主窗口动作;交互详设第 467 行同口径;实施详设第 42 行记录了 `AdminLayer` 的 effect closure 捕获。**没有把 focused precursor 写成 Android PASS。**

## 3. N finding

```text
[N-01] severity=N
status=UNVERIFIED_REQUIRES_EVIDENCE
fact_type=推论（概率无法静态量化）
location=apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx#tapLauncher 第 172 行；apps/terminal/ui/base/admin-shell/src/foundations/adminLauncher.ts#trackAdminGesture
failure_scenario=手势窗口是 1800 毫秒的真实 Date.now() 墙钟,而组件路径没有可注入的时钟。tapLauncher 每次点击 await 一次 act 加一个 0 毫秒定时器;若机器负载使连续 5 次的平均单次耗时超过约 360 毫秒,窗口会在中途过期、计数归零,合法用例便会偶发失败。第 315 行用例在同一 renderer 上连做 10 次点击（先 5 次越界再 5 次合法）,暴露面比其他用例更大。
impact=仅测试稳定性,不涉及生产行为。正确实现下越界点会重置计数,所以两段之间无交叉污染,这一点我已确认。
minimum_fix=若将来出现偶发红,给 trackAdminGesture 的调用方注入时钟而不是放宽窗口常量——常量是 AC-1.2 写死的判据对象,不能为测试稳定性改动。当前不建议预先改造。
dexter_decision=NO
```

## 4. 证据档位（逐条）

- **static**：brief 自报 `check-static.mjs` PASS。**我未复跑**,按自报处理。我的静态结论仅来自源码与测试的逐行对账,以及对 25 处调用点、三组 fixture 判定的独立枚举与复算。
- **focused**：brief 自报 sample-console 7 files/33 tests、admin-shell 2 files/7 tests、两处 typecheck PASS。**我未复跑**。我独立证实的是**这组 fixture 具备区分力**（第三点的复算),以及变异会落在哪一条断言上;测试是否真的通过仍属自报。
- **Android**：`NOT_RUN_THIS_ROUND`。A-4 只能记为 **focused precursor**;真实宿主窗口手势、secondary 手势、scaled geometry、IME 与 no-popup、权限与数据清理、真机、protected persistence 全部 OPEN。本轮的非等比 fixture **不得**升级为 Android PASS——它证明的是坐标换算的纯逻辑与组件接线,不是真机窗口行为。
- **native**：`NOT_RUN_THIS_ROUND`。历史 named Kotlin unit test 结果保留,**不外推** native device 或 Android IME 行为。
- **Web**：`NOT_RUN`。
- **release**：`NOT_RUN`。
- **visual**：`NOT_RUN`。无 wireframe、无相似度、无视觉 verdict。
- **cleanup**：focused cleanup 自报 PASS;cleanup PASS **不提升任何其他档位**。

## 5. 授权边界

本轮结论**不是完整 implementation acceptance**,只表示 `S-01` 与两条 note 的修复在当前字节上成立,且取得 `focused + mutation` 级证据。不授权继续修改源码、测试、依赖或文档,不授权 Android、Web、release、visual、native device、DEV、seed、UAT、部署或下一 Roadmap step。本文是独立评审输入,不自动成为新权威。
