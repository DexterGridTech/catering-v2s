# TER 虚拟键盘优化 DESIGN Round 1 finding 处置

> AUTHORED_AFTER_INDEPENDENT_VERDICT=true；独立原 verdict 见 `2026-09-23-ter-virtual-keyboard-optimization-design-review-round1-independent.md`，本文件不重写为 GO。  
> REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；REVIEW_ROUND=1；REVIEW_ROUND_LIMIT=2。  
> `NO_CORPUS_ENTRY_MATCHED`：已复读 `project-memory/decisions/confirmed-business-language-corpus.md` 索引，TER/virtual keyboard/URL symbol/PIN/input 无专项业务词条；本批产品事实来自 Dexter 原话、Q1–Q6 与 Claude review，不假借 corpus 权威。

| finding | 回源核验与反例 | 作者处置（待 Round 2 独立判定） |
| --- | --- | --- |
| M-1 | `render/src/types/props.ts#SurfaceRootContentFrame` 只有 `content`；`SurfaceRoot` 先合并 ScreenContainer/LayerStack，`LayerStack` 同时持有遮罩与内容；assembly 只包整块 content。确认 reviewer 反例有效。直接平移 `InputSurfaceFrame.children` 会移动遮罩；让 render import input 则反转现有依赖。 | `CONFIRMED`。详设 §3、§4.5、§6 明确 render 声明 `Animated.Value` 通道、SurfaceRoot 每 surface 创建、assembly 原样传、InputSurfaceFrame 唯一驱动、普通内容/每个 layer 内层平移而 backdrop/焦点外壳固定、keyboard overlay 高于 1000 且仅占位区域拦截命中；计划 CP-2 加 exact 签名与反向依赖/遮罩/层级红变异；IA §3 只留可见判据并回指机制正本。较小替代“给整个 content 加 transform”不能保持遮罩固定，故不采。 |
| S-1 | `useInputField` nativeLess `inputRef=null`，registration/primitive 无可见测量 API；`InputScrollArea` 见 null 跳过，PIN 又无 scroll area。确认 reviewer 反例有效。测 card 或 testID 不能等价测 PIN 六格。 | `CONFIRMED`。详设 §3/§4.6 精确增加独立 `visibleAnchorRef`/`InputVisibleAnchorHandle`、RnrPressable ref forwarding、PrimitivePinInput measureRef 透传与 admin login 仅接线；PIN/frame 同 generation 测 `measureInWindow` 并只扣一次 offset，无滚动/无效测量显式容量状态；计划 CP-2 加红变异；IA-13 同步真实锚点判据。较小替代 `onLayout` 单节点局部坐标无法独立转换为 surface 坐标，故不采。 |
| N-1 | 业务语料无键盘专用条目，与本任务无业务词义冲突。 | `CONFIRMED_NOTE`，顶部显式记 `NO_CORPUS_ENTRY_MATCHED`，无产品语义改动。 |

同根扫描：M-1 已覆盖 `SurfaceRootContentFrame`、`SurfaceRoot`、`LayerStack`、`ConsoleSurfaceInputFrame`、`InputSurfaceFrame` 与 input→render 依赖方向；S-1 覆盖 `useInputField`、registration/types、`PrimitivePinInputProps`/RnrPressable、admin login 双 renderer、`InputScrollArea` 的普通 ref 分支。反例边界是普通 `PrimitiveInput` 已有 measureLayout、业务 command 不变；没有为所有表单增第二测量系统。修订均为文档，不是已编译/运行的实现。Round 2 应重开当前字节独立核对 exact 通道是否仍有不可执行缺口。
