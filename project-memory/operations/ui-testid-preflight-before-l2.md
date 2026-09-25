---
id: operations.ui-testid-preflight-before-l2
status: active
layer: routed
taskKinds: ["design","implementation","testing","review"]
domains: ["admin-ui","platform"]
consumerFaces: ["operations-admin"]
owners: ["frontend-platform"]
impacts: ["governance","evidence","memory"]
triggers: ["task-start","implementation","review"]
assertions: ["L2_UI_DESIGN_AND_TESTID_PREFLIGHT","L2_SCRIPT_BLOCKED_UNTIL_UI_PREFLIGHT","L2_TESTID_MUST_TARGET_ACTUAL_CONTROL","IMPLEMENTATION_DESIGN_MUST_RECORD_UI_PREFLIGHT","UI_INTERACTION_DESIGN_MUST_ENUMERATE_TEST_CONTROLS"]
sourceRefs: ["doc/decisions/templates/implementation-design-template.md","doc/decisions/templates/ui-interaction-design-template.md","doc/platform/browser-l2-execution-standard.md","doc/platform/frontend-coding-standard.md","doc/platform/implementation-task-template.md"]
---

# L2 脚本前 UI/testId 前置门

本条是后续 UI-bearing Journey 和浏览器 L2 工作的路由记忆；详细规则的唯一内容源是：

- `doc/platform/browser-l2-execution-standard.md` §3.1；
- `doc/platform/frontend-coding-standard.md` §3-K-9；
- `doc/platform/implementation-task-template.md` 的 L2 前置门；
- `doc/decisions/templates/implementation-design-template.md` §3a；
- `doc/decisions/templates/ui-interaction-design-template.md` 的逐 screen 控件清单。

执行含义：在新增或修改 L2 spec、runner adapter、locator binding 或 blueprint 控件声明之前，必须先复核
UI 代码是否符合批准的需求/IA/交互/详设、前端规范、同类既有模块和 foundation 形态，并按 case/action
穷举实际操作控件。每个实际操作控件都要有 app `*TestIds.ts` 唯一源、稳定业务身份、挂在真实动作节点
的 testId 和可追溯 binding/touch；缺失、挂错或只挂外层 wrapper 时先修 UI、UI focused/static proof 并
完成 fresh 独立复核。

在 `UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`、`L2_SCRIPT_ADMISSION=PASS` 之前，L2 脚本开发保持
阻断；不得用 role/label/placeholder/text/index/CSS/XPath、宽 locator、等待、放宽 oracle 或动态运行结果
替代 UI 控件可测性复核。

窄例外仅适用于仓内已有、组件 API 不暴露 option-level `data-*` 的复合控件（如 `Segmented`）：testId 可挂在
可见 option label/anchor，但必须在控件分母注明 `COMPOSITE_OPTION_ANCHOR`、同一点击语义和 focused/static
proof；Button、MenuItem、Checkbox、Radio、输入框、file input 等可直接标记的控件仍必须标在真实动作节点，
不得以外层 wrapper 或宽 locator 替代。

运行器强制(Dexter 2026-09-25):L2 运行器在启动前读取详设 §3a 的准入状态,缺失、未 PASS 或准入后控制面与 UI 有改动即拒绝启动
(`doc/platform/browser-l2-execution-standard.md` §4.1)。准入记录必须由 fresh 独立复核产生并绑定控制面/UI 字节摘要；相同失败族在相同摘要上不得无变更重跑。详设 §3a 还必须列出本批 L2 控制面文件全集(场景、blueprint、定位绑定、
执行配置、fixture、时间预算、spec、P1 生成器);缺表即设计 NO-GO。反例:门店终端批详设缺这张表,L2 跑了 36 次只通过 1 次。
