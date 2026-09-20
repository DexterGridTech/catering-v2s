# TER 虚拟键盘视觉设计 · fresh 独立 DESIGN review round 1

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER_TERMINAL_INPUT_KEYBOARD_VISUAL_DESIGN_2026-09-19
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
REVIEWER_KIND=INDEPENDENT_SUBAGENT
BLIND_REVIEW=true
EVIDENCE_TIER=STATIC_SOURCE_AND_DESIGN_READBACK_ONLY
VERDICT=NO-GO
M/S/N=2/3/1
```

本轮由两名 fresh、只读、独立审查 agent 完成，均先以证伪为立场阅读当前详设、计划、IA
资产和 owning source；未修改仓库，未运行构建、测试、Web、Android、设备、Git。以下 finding
是主 agent 已回源核对的输入，不把 agent 的结论直接当作源码真相。

## Findings

### M-01 · IA 的 mobile inset 与 alpha 全键集口径冲突

`alpha` 的文字契约要求 `CAPS` 在第二行首位且 mobile 保持全部键可达，当前复合 IA 的主
ALPHA 面板确有 `CAPS`，但右侧 `MOBILE (INSET)` 示意没有 `CAPS`。这不是实施事实差异，
而是复合图内部的视觉输入歧义。

处置：当前详设明确完整 alpha definition 是唯一 key inventory；mobile inset 仅表示紧凑
承载比例，不生成 mobile baseline，也不得据此删除 `CAPS`。若 Dexter/Claude 认为 inset 也
是逐像素正本，需在设计 review 中重新指定一张包含 `CAPS` 的 mobile IA；本轮不自改图片。

### M-02 · numeric 旧文字与最新 IA/当前源码冲突

旧的 2026-09-06 需求文字仍描述“0 跨两列、动作共享第三列”，而 Dexter 最新确认的 IA、
当前 `keyboardLayout.ts` 与既有 focused test 使用 `BACKSPACE | 0 | COMPLETE` 三列。
本批不把旧文字静默当作目标，也不把当前源码自动当作证明。

处置：当前详设/计划新增最新 IA 优先级记录，把三列底行列入 layout 与 pixel 对账分母，明确
旧跨列文字是历史版本，不得恢复；CP-0 若对此优先级有异议必须停在 `DESIGN_GAP=OPEN`。

### S-01 · canonical pixel baseline 的执行体此前不够具体

此前文档只有 composite PNG hash 和原则性要求，没有 manifest schema、产物路径、生成入口、
自证禁止和失败条件。

处置：当前详设 §6.1 与计划 CP-0 固定 manifest/PNG/metadata 路径、entry required fields、
`measurementMethod` closed values、planned `tools/terminal-input-keyboard/generate-canonical-baselines.mjs`
和现有 `tools/terminal-image-compare/compare.mjs`，并要求 wrong token/row/viewport red mutation。

### S-02 · Web/native surface-dismiss 事件必须分别证明

当前 source 在 native 使用 `onTouchEnd`、Web 使用 `onClick`。只证明 native root touch 会漏掉
Web keyboard root click；将事件接缝移入 primitive 后，composed renderer 两条入口必须分别验证。

处置：当前详设/计划将 native `onTouchEnd`、Web `onClick`、composed keyboard root proof 和
删除任一入口的 red mutation 分开列为 V-8/CP-1/CP-2 执行体。

### S-03 · token 必须绑定精确 palette 与真实消费

此前只要求七个变量/mapping，没有 RGB table，且 `keyboard-focus` 没有明确 consumer。

处置：当前详设 §2.2 冻结两套 integration 的 keyboard RGB/hex 表，要求 computed CSS channel
readback；`PrimitiveButton.selected` 仅对 keyboard variant 消费 `keyboard-focus`，VirtualKeyboard
把它绑定到 CAPS/SHIFT，且有 selected render red mutation。

### N-01 · 现有 focused test 尚未覆盖 alpha CAPS

当前源码的 alpha definition 和 test 仍缺 CAPS；这属于将来 CP-2 的实现缺口，不是当前设计文档
本身的第二个阻断。计划已要求补 layout、render 和 edit sequence，并将 mobile key inventory
纳入 CP-0/CP-4 对账。

## 主 agent 处置状态

上述处置已写入当前详设、计划和粒度清单；本文件仍保留 round-1 的原始 `NO-GO`，不把修订
后的文档伪装成已获独立 GO。下一步应由同一 DESIGN cycle 的 round 2 fresh agent 对上述
修订做定向证伪；随后再交 Claude DESIGN review。直到 review 通过前，
`IMPLEMENTATION_AUTHORITY=false`，不执行源码、测试、依赖、构建或运行。
