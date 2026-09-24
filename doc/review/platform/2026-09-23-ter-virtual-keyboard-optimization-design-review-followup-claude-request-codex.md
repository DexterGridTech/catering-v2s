# TER 程序虚拟键盘优化 DESIGN 复评请求（Claude follow-up）

> REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；REVIEW_ROUND=2（Dexter 中转的 Codex↔Claude 复评序号，不适用 fresh 子 agent 两轮上限）。  
> 上一份 Claude review 对前一版文档的结论为 NO-GO,M/S/N=0/4/4；本请求针对当前修订字节。  
> DESIGN 独立子 agent 两轮已完成；本轮不派第三轮。授权仅覆盖文档修订与外部 DESIGN 复评，不授权实施或动态验证。

## 背景

正式需求、交互设计、IA、详设与实施计划按 S-1/S-2 修订，并落实 Dexter 对 S-3/S-4 的裁定。N-1/N-3/N-4 依建议收敛，N-2 因 full 四行裁定撤回。逐项 intake 见作者处置记录。上一份 NO-GO 仍是针对前一版字节的历史结论，请独立审查当前字节。

## 评审目标

判断修订是否消除 S-1/S-2 反例、是否正确落地 S-3/S-4，并复核 N 项及交互视觉/操作合理性。请从公式、安装源码和文档之间重新推导；finding 附精确行号、影响面、最小修订与是否需 Dexter 裁决。

## 需阅读文件

- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-claude.md：上一版 finding 与 Dexter 裁定。
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-response-codex.md：作者逐项 intake，仅供对照。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md：当前需求与 AC。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md：交互路径与低保真形态。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md：19 帧、键位映射、逐字契约。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md：测量、动画、焦点、滚动、容量详设。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md：CP 顺序、红变异、逐代码对账门。
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md：原始需求分析及 Q1–Q6。
- apps/terminal/node_modules/react-native/package.json 与 apps/terminal/node_modules/react-native/ReactCommon/react/renderer/dom/DOM.cpp、apps/terminal/node_modules/react-native/ReactCommon/react/renderer/core/LayoutableShadowNode.cpp：安装 RN 版本及 Fabric 测量坐标实现。
- apps/terminal/node_modules/react-native-web/package.json 与 apps/terminal/node_modules/react-native-web/dist/exports/UIManager/index.js：安装 RNW 版本及 Web 测量实现。
- apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx、apps/terminal/ui/base/input/src/components/InputScrollArea.tsx、apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts：canvas 缩放、现有 scroll-content 测量与焦点预检 owner。

## 独立核验重点

1. S-1：重算 λ=(K(t)−K_A)/(K_B−K_A) 和 offset 公式。饱和端点检查 laptop 190→246、246→190、246→246 的平台/变化段是否路径连续、单调且逐帧 |offset|≤K(t)；CP-3 的错误插值变异是否会真实变红。
2. S-2：重读安装 RN 0.86.3 Fabric、RNW 0.21.2 的 measureLayout/measureInWindow 与 SurfaceHostController scale；检查普通字段、viewport、scroll-content 字段、PIN anchor 在 Web/Android、已/未平移及已/未滚动时是否只换算一次，且没有跨 ScrollView 测量。
3. S-3/S-4：IA 的 W=1280 键宽 118/412、W=360 键宽 30/110；full 四行、246/189、十符号；五份设计是否清除旧 302/232、十二符号、键盘 @/#、360×400 unsupported，并正确用 360×360。
4. N-1：交接两阶段键盘区是否吞点；旧键盘完全退出后新键盘才接键；pending B 的提交、A→B→C 替换及关闭/失焦/scope/unmount/几何失效取消能否执行。
5. N-2：确认撤回后不再要求 302/232 分母，246/190 三类及饱和端点覆盖充分。
6. N-3/N-4：确认无 IA-20/窄宿主 harness，field placement 只作为未来正式删除范围；单 native-driver progress 与一次 animated scrollTo 的职责是否满足同段要求，且没有把静态设计冒充动态通过。
7. 核对 IA §1 与详设 §1 的重复契约及其与需求/交互/计划的一致性，审阅交互是否服务现有用户任务，不以 testID/结构存在代替控件形态。

## 期望结论

请对当前文档给出明确 REVIEW_TARGET=DESIGN GO 或 NO-GO 与 M/S/N。finding 需含精确路径/行号、事实与推论、影响、最小修订和裁决需求。区分静态设计推导与未运行验证。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请复评 TER 程序虚拟键盘优化当前需求、交互设计、IA、详设与实施计划字节。

背景：您对前一版五份文档判 REVIEW_TARGET=DESIGN,VERDICT=NO-GO,M/S/N=0/4/4。Dexter 已裁定 S-3(a) 键帽列轨全宽、S-4 full 四行与十个 URL 字符，并撤回 N-2。Codex 修订 S-1/S-2 并处置 N 项，记录见 doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-response-codex.md。此前 verdict 仅针对旧字节，请重新独立判断。

目标：重算真实 K(t) 参数化是否令 190→246、246→190 饱和端点及 246→246 满足逐帧 |offset|≤K(t)；重开 RN/RNW 与 SurfaceHost 源码，核对普通字段、ScrollView content、viewport、PIN 在已/未平移、已/未滚动下测量是否只换算一次；复核 IA 键宽、full 四行/十符号，以及 pending focus、键盘命中、滚动驱动和 field placement 范围，并审查交互合理性。

请从仓库根阅读：
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-claude.md：上一版 finding 和裁定；
- doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-response-codex.md：作者处置，仅供对照；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md：需求与 AC；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md：用户路径与低保真；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md：19 帧与逐键规格；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md：测量、动画、焦点、滚动与容量；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md：实施顺序与对账门；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md：原始需求分析及 Q1–Q6；
- apps/terminal/node_modules/react-native/package.json、apps/terminal/node_modules/react-native/ReactCommon/react/renderer/dom/DOM.cpp、apps/terminal/node_modules/react-native/ReactCommon/react/renderer/core/LayoutableShadowNode.cpp：安装 RN 版本与 Fabric 测量源码；
- apps/terminal/node_modules/react-native-web/package.json、apps/terminal/node_modules/react-native-web/dist/exports/UIManager/index.js：安装 RNW 版本与 Web 测量源码；
- apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx、apps/terminal/ui/base/input/src/components/InputScrollArea.tsx、apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts：缩放、滚动测量与焦点 owner 源码。

请核对旧 302/232、十二符号、键盘 @/#、360×400 unsupported 是否从五份现行设计清除；检查 360×360 示例、饱和端点和 CP-3 反例能否证伪错误实现。对任何 finding 给精确行号、影响、最小修订及是否需 Dexter 裁决。

烦请给出当前字节的明确 REVIEW_TARGET=DESIGN GO 或 NO-GO 与 M/S/N。

授权边界：本轮仅需求、交互、IA、详设、计划和 DESIGN 复评；不进入源码实施，不改测试、依赖、脚本或构建产物，不运行 Web、Metro、Android、设备或动态视觉验证。谢谢。
```
