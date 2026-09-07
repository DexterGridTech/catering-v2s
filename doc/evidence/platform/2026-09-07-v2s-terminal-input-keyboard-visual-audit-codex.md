# TER 虚拟键盘视觉复核与修复记录

> DATE: 2026-09-07
> REVIEW_TARGET: IMPLEMENTATION_VISUAL_FIT
> SCOPE: full / alpha / numeric / financial
> EVIDENCE: focused static + live Web observation at `http://localhost:8082/`
> ANDROID: 本记录不宣称 Android 视觉已验

## 1. 结论

修复前四类键盘都没有达到本轮视觉预期：alpha 的四行内容被放进五行固定 dock，
numeric/financial 的动作行单侧排列，full 的短字母行也向左堆叠。共同根因不是业务
键集合，而是 `keyboardHeight.ts` 固定按五行 dock 计算高度、`rowBlockOffset` 对短布局
做二次居中，以及 `keyboardLayout.ts` 对短行使用 `start` 对齐。

已完成的根因修复：

1. dock 高度改为 `min(availableDockHeight, verticalRequired(rowCount))`；五行布局为
   `270`，四行 alpha 为 `219`，并为内容区明确设置上下各 `9` 的 token padding。
2. 删除 `rowBlockOffset` 传递与渲染路径，避免未来再次把短布局塞进长 dock。
3. full/alpha 的短字母行、numeric 的 `0` 行、financial 的符号行和四类动作行统一
   使用对称居中；没有改变任何 `KeyboardKey` 语义或 key testID。

## 2. 四类逐项判定

| 布局 | 修复前 | 修复后是否符合本轮设计预期 | 与系统软键盘的视觉关系 | 判定理由 |
| --- | --- | --- | --- | --- |
| full | `FAIL` | `PASS` | 结构接近，非像素复制 | 数字、QWERTY、短字母和动作区分层；短行左右平衡；五行正好占用内容高度；保留 shift/caps/backspace/complete 既有语义 |
| alpha | `FAIL` | `PASS` | 结构接近，非像素复制 | 四行 dock 从固定 270 收敛到 219；QWERTY 下两行与动作区居中，去除截图中的大块上下空白；不新增系统没有的 space/enter |
| numeric | `PARTIAL` | `PASS` | 结构接近，非像素复制 | 三列数字、居中 0、居中动作区符合常见数字软键盘的空间直觉；五行高度精确为 270，动作键不再贴左并留下单侧空白 |
| financial | `PARTIAL` | `PASS` | 结构接近，非像素复制 | `-,0,.` 符号行对称居中，三列数字与动作区保持同一网格；五行高度精确为 270；金融键集合仍是 sample-only 既有语义 |

这里的“与系统软键盘视觉一致”指空间结构、分组、密度、对齐和可触达区域遵循常见
系统软键盘原则；不宣称颜色、厂商图标或键语义与某一系统 IME 像素级一致。TER 保留
深色科技主题和业务明确禁止的键集合，这是产品身份与行为边界，不是视觉缺陷。

## 3. 实际 Web 观察

通过当前 sample-console Web surface 逐字段聚焦观察到：

- alpha：四行按键从输入内容区下方开始，行间距稳定，第二/第三字母行和动作区左右
  对称，没有修复前的上、下大块空白。
- numeric：数字网格占满五行所需高度，`0` 居中，backspace/完成成对居中。
- financial：`- / 0 / .` 位于同一三列网格，动作区成对居中，无单侧空白。
- full：数字行、QWERTY 行、居中的短字母行与居中动作区连续排列，未观察到裁切、
  重叠或内容区下方额外保留的旧 dock 空间。

本次 Web 观察证明的是浏览器实际渲染，不替代 Android 模拟器、真实 POS 或系统 IME
视觉取证。

## 4. 代码与 focused proof

| 维度 | owning source | 结果 |
| --- | --- | --- |
| 高度与容量 | `apps/terminal/ui/base/input/src/model/keyboardHeight.ts` | `MATCHED`：按 rowCount 计算，仍消费 local frame，容量失败语义保留 |
| 行/动作对齐 | `apps/terminal/ui/base/input/src/model/keyboardLayout.ts`、`VirtualKeyboard.tsx` | `MATCHED`：center alignment 由布局数据驱动，渲染无业务分支 |
| 旧留白路径 | `InputSurfaceFrame.tsx`、`InputProvider.tsx`、`types.ts` | `MATCHED`：`rowBlockOffset` 无生产源码命中 |
| 输入行为 | `apps/terminal/ui/base/input/test` | `MATCHED`：9 个测试文件、46 个测试通过 |
| 类型解析 | `apps/terminal/ui/base/input` | `MATCHED`：package typecheck 通过 |

## 5. 设计同步

本次用户视觉反馈同步到了：

- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-design-codex.md`
- `doc/plans/platform/2026-09-06-v2s-terminal-input-surface-and-keyboard-implementation-plan-codex.md`

三处均明确记录：dock 不再为短布局预留 `rowBlockOffset` 空间，布局切换允许内容区按
真实键盘行数收缩/恢复。该修订是对本次用户视觉反馈的明确输入，不是静默偏离设计。
