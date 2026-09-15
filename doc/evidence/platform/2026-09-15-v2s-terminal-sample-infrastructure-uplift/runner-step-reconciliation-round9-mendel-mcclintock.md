# Sample2 frozen-journey runner：滚动可见性修复对账

REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=9
reviewerKind=INDEPENDENT_SUBAGENT
REVIEWERS=Mendel,McClintock
DYNAMIC_STATUS=NOT_RUN_BY_REVIEWER

## 背景与首败

主 agent 的第一次当前 APK mobile 运行产生了真实首败：
`sample2-frozen-current-mobile-final-20260915/result.json` 的
`business=NOT_RUN`、`cleanup=PASS`，边界为 `anonymous-login -> picker-after-login`，
错误是 `observed effective wallpaper ... expected=none observed=none`。根因由运行时
过程与当前 runner 源码共同指向 ScrollView 可见性：runner 为寻找同一 ScrollView
底部的 confirm 节点滚动后，off-screen selected 节点不再出现在 UI tree，旧逻辑把
“不可见”当成了“无壁纸”。需要更正的是，首败目录保存的 `picker-after-login.xml`
与 `first-failure-display-0.xml` 是失败捕获时的树，**并未直接保存滚动前
`options:none selected=true` 的属性**；该属性只能由当时的 transient UI readback
或产品初始状态推断，不能把它写成该 artifact 已直接证明的事实。首败目录未覆盖。

## Mendel：第一次修复后的只读结论

Mendel 为 fresh 独立 reviewer，未修改文件，未执行动态、构建、设备、Web、Metro、
DEV、seed、UAT 或部署命令。它核对了 `selectionXml`、`confirmationXml`、selected
状态保留、真实 `options:scroll` confirm 节点、各类 partKey/state/display 断言，结论为：

```text
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
STEP_RECONCILIATION=OPEN
M/S/N=1/0/1
DYNAMIC_STATUS=NOT_RUN_BY_REVIEWER
```

其 M finding 是第一次修复只在 `confirmationXml !== selectionXml` 时写 confirmation
XML，而当时仓内仍没有成功运行产生的成对证据；其 N finding 是 mobile 尚无当前修复
后的闭合运行证据。该报告确认未发现产品语义或显示身份断言被削弱。

## McClintock：第二次修复后的只读结论

主 agent 随后补齐每个状态无条件的 `*-selection.xml` 与 `*-confirmation.xml`，并把
缺少 selected 节点的诊断显示改为 `not-visible`。McClintock 为新的 fresh 独立 reviewer，
未修改文件，未执行动态、构建、设备、Web、Metro、DEV、seed、UAT 或部署命令。其当前
源码核对报告为：

```text
REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION
reviewerKind=INDEPENDENT_SUBAGENT
STEP_RECONCILIATION=OPEN
M/S/N=0/0/1
DYNAMIC_STATUS=NOT_RUN_BY_REVIEWER
```

源码语义本身没有 OPEN finding：

- `tools/terminal-sample2/run-sample2-frozen-journey.mjs:405-492` 总是写 selection 与
  confirmation 两份 XML；selection 来自确认滚动前/回顶后的 UI，confirmation 来自
  confirm 节点检查树。
- `tools/terminal-sample2/run-sample2-frozen-journey.mjs:414-444,508-520` 保留真实
  selected 节点语义，必要时从回顶或底部树补读，不把 `not-visible` 写入业务状态。
- `tools/terminal-sample2/run-sample2-frozen-journey.mjs:410-471,476-485,585-620,737-768`
  仍断言 primary/secondary partKey、background、pending/confirmed、冷重启和显示身份。
- `apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperPicker.tsx:55-175`
  与 `WallpaperBackground.tsx:16-28` 的产品语义未改动：pending 控制 picker/confirm，
  confirmed 控制背景。

McClintock 的 N 是它在当时未能定位 Mendel 的仓内报告；本记录已把两次独立结果、
首败与处置链补齐。Heisenberg 后续复核还发现上述“首败 XML 直接证明 selected”
表述过强，现已在本记录中纠正为“待当前重跑产生的 selection XML 闭合”。该 N 不能
被解释为代码不匹配或动态 PASS。

## 当前对账状态

本记录是独立结果的原样留痕，不把 McClintock 的 `OPEN` 擅自升级。下一步由新的
fresh reviewer 读取本记录、当前源码与当前设计约束，确认输入链闭合后再决定
`STEP_RECONCILIATION=MATCHED`；在此之前不开始 sample2 动态重验。
