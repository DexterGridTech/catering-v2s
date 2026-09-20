REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-granularity.json
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-adversarial-review-codex.json
REVIEW_TARGET=DESIGN
REVIEW_STATUS=OPEN_FOR_CLAUDE_REVIEW
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
CODEX_INDEPENDENT_REVIEW=ROUND_2_NO_GO_REPAIRED; CLAUDE_REVIEW_ROUND_1=NO_GO_4M_2S_2N; CLAUDE_REVIEW_ROUND_2=NO_GO_1M_2S_2N_INTAKE_REPAIRED
IA_STATUS=ACCEPTED_BY_DEXTER; LATEST_IA_NUMERIC_THREE_COLUMNS_AND_ALPHA_CAPS
PALETTE_DECISION=CLOSED_BY_DEXTER_A_NEUTRAL_PLUS_THEME_FOCUS_BORDER; PIXEL_AUTHORITY=GEOMETRY_TOKEN_PLUS_ROI_98_PERCENT_RECONCILIATION
NOT_AUTHORIZED=源码/测试/依赖/脚本/构建/Web/Metro/Android/设备/DEV/seed/UAT/部署/Git

## 背景

Dexter 已确认 TER 四种程序虚拟键盘的视觉 IA，并确认 alpha 在三行第二行首位加入
`CAPS`，numeric 当前目标为 `BACKSPACE | 0 | COMPLETE` 三列底行。已确认 IA 资产为
`doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-approved.png`。
本轮只产出 implementation-facing 详设与实施计划，不实施源码，也不启动运行环境；视觉对账采用固定 ROI 约 98% 一致作为本批口径，不要求跨平台 raw PNG 逐字节相等。

Codex 已按当前源码核对：alpha definition 仍缺 CAPS，VirtualKeyboard dock 仍有 `#FFFFFF`
硬编码，普通键/动作键仍使用通用 action/surface recipe，两个 integration 尚未声明
keyboard 专用 token；两个 Android App 的 Tailwind 还通过
`apps/terminal/assembly/base/android/config/index.cjs` 继承 `sharedColors`，该分母已纳入
修订；InputProvider 的普通字符局部更新边界和现有 capsLock/edit 语义已经存在。本设计
选择 primitives 的 keyboard semantic recipe、integration-owned theme、Android sharedColors
同名 mapping、共享 renderer 的 alpha CAPS，以及保留/验证现有热路径边界。

Claude 第一轮 DESIGN review 为 `NO-GO,M/S/N=4/2/2`，复评为 `NO-GO,M/S/N=1/2/2`。
Dexter 已裁定 `A_NEUTRAL_PLUS_THEME_FOCUS_BORDER`：五个中性 token 两主题同值且
`keyboard-key === keyboard-action`，`keyboard-border`/`keyboard-focus` 仍由各 integration
theme 持有。S-1、S-2、N-1、N-2 已按详设/计划 intake 修订；`changedFraction <= 0.02` 只表示
ROI 约 98% 的量化参考，明显结构或颜色错位仍应判为 OPEN。

第一轮由两名 fresh 只读独立子 agent 完成，结论为 NO-GO 2M/3S/1N，报告与处置记录在：
`doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-adversarial-review-round1-codex.md`。
随后 round-2 fresh 定向核验结论为 NO-GO 0M/1S/1N，报告在：
`doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-adversarial-review-round2-codex.md`。
round-2 的 comparator 接口与历史来源命名问题已修入当前详设和计划；DESIGN cycle 两轮上限
已用完，Claude 的 review 仍需独立作出结论。当前不宣称 DESIGN GO、implementation、visual、
Web、Android、release 或 acceptance 通过。

## 评审目标

请以证伪为立场，独立判断当前详设与计划是否能指导后续实施，且不会让实施方在 IA、theme、
primitive API、事件边界、键盘效率或 pixel evidence 上自行猜测。请重点核验：

1. 最新 Dexter-confirmed IA 是否优先于旧需求文字：numeric 三列底行不得被旧的跨列 0 语义
   恢复；alpha 完整 definition 必须包含 CAPS；复合图的 mobile inset 不得被误读为删除 CAPS
   的第二套 key inventory。
2. `PrimitiveKeyboardSurface`、`PrimitiveButton.selected`、七个 keyboard token 的 owner、
   public export、两个 integration CSS/Tailwind mapping、精确 RGB table 与 computed-value
   theme test 是否闭合；base 不得保存 integration RGB。
3. Web keyboard root 的 `onClick` 与 native keyboard root 的 `onTouchEnd` 是否分别透传并有
   composed proof，且 primitive 不 import input/dismiss 语义。
4. CP-0 的 fixed-ROI manifest 是否具有明确字段、source/hash、measurementMethod、mask
   策略和 self-baseline 禁止；是否复用 `tools/terminal-image-compare/compare.mjs`，将
   `changedFraction` 作为视觉复核参考，而非伪造一个不存在的失败退出门。
5. alpha CAPS 的持久 `capsLock`、numeric 当前三列、full/financial 不漂移、键高/间距、
   testID、surface-dismiss、`InputProvider.forceKeyboardUpdate` 边界是否逐项有真实执行体。
6. 文档是否诚实区分 static/focused/Web/Android/visual/cleanup；是否仍禁止任何性能改善
   或 FPS 结论；是否把当前设计的未运行状态误写成 implementation ready。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-design-codex.md`：
  当前实现详设、IA 优先级、token 表、primitive API、输入状态、性能边界、V-1 至 V-12、
  pixel baseline 和动态证据门；
- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-implementation-plan-codex.md`：
  CP-0 至 CP-5 顺序、入口条件、red mutation、三维对账、逐代码对账、动态 pixel gate 和
  cleanup 边界；
- `doc/plans/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-granularity.json`：
  设计分母、pixel baseline contract、实施授权与证据状态；
- `doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-adversarial-review-codex.json`：
  fresh round-1 审查状态、finding 与处置路径；
- `doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-adversarial-review-round1-codex.md`：
  round-1 原始 NO-GO 与逐条处置记录；
- `doc/plans/platform/assets/2026-09-19-ter-terminal-input-keyboards-ia-approved.png`：
  Dexter 确认的复合视觉输入，SHA-256 为 `383227b1892b11eec0c24eb34ccfab086c8ebbcd2b61a88e85f5434aeb2dca9f`；
- `doc/plans/platform/2026-09-06-v2s-terminal-input-keyboard-visual-redesign-requirements-v2-codex.md`：
  历史键盘文字输入；请特别核对它与最新 IA numeric 口径的差异，不要把历史句子静默升级为
  当前视觉正本；
- `apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts`、`apps/terminal/ui/base/input/src/foundations/editText.ts`、
  `apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx`、`apps/terminal/ui/base/input/src/components/InputProvider.tsx`：当前布局、caps
  edit 语义、native/Web surface event 选择和更新边界；
- `apps/terminal/ui/base/primitives/src/theme/tokens.ts`、`src/components/PrimitiveButton.tsx`、
  `src/components/PrimitiveIcon.tsx`、`src/types/types.ts`：现有 primitive recipe、public props
  和 keyboard token/API 影响面；
- `apps/terminal/ui/integration/sample-console/theme/global.css`、`tailwind.config.cjs`、
  `test/theme.test.ts` 与 `sample-wallpaper-console` 对称文件：两个 theme owner 和 mapping；
- `tools/terminal-image-compare/README.md`、`tools/terminal-image-compare/compare.mjs`：现有
  ROI PNG 比较执行体及其失败关闭约束；
- `AGENTS.md`、`scripts/README.md`、`doc/platform/claude-review-handoff-template.md`：授权、
  证据、主 agent 写入和交接边界。

## 独立核验重点

请每条 finding 区分仓内事实、推论与尚缺证据的假设，给出 owning source、精确仓库相对路径
与行号、可复现核验方式、反例和最小修复；产品/IA 不能同时成立时标 `DEXTER_DECISION`，
不得自行改图。特别关注：

- 是否有任何地方仍写“保留 numeric 作为未归因的既有变更”，从而绕过最新 IA 的对账分母；
- `keyboard-focus` 是否真有 `selected` consumer，还是只有 token/string 存在；
- theme test 是否读取 computed channels，而非只检查 CSS 字符串；
- baseline 是否能从独立 reference renderer/approved capture 产生，且绝不使用
  `RUNTIME_SELF_BASELINE`；
- Web click 与 native touch 两条 keyboard-root surface-dismiss 路径是否各自会在删除事件
  透传时变红；
- 普通字符输入是否仍不触发整体键盘刷新，且设计没有虚构 FPS 或性能改善结论；
- mobile/Android/Web/visual/cleanup 未运行档位是否保持 `OPEN`/`NOT_RUN`。

## 期望结论

请给出：

```text
REVIEW_TARGET=DESIGN
VERDICT=GO | NO-GO
M/S/N=<数字>/<数字>/<数字>
```

每条 finding 请标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，说明影响面、最小修复及是否阻断
实施。GO 只表示详设与实施计划可进入下一步实施决策，不表示源码实现、测试、Web、Android、
visual、release、cleanup 或 acceptance PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审本次 TER 虚拟键盘视觉与交互的 implementation-facing 详设和实施计划。

背景：Dexter 已确认四种虚拟键盘的视觉 IA，并确认 alpha 在三行第二行首位加入 CAPS，numeric 当前目标为 BACKSPACE | 0 | COMPLETE 三列底行。IA 资产和设计/计划文件见末尾仓库根相对路径汇总。本轮只交付设计，不授权源码、测试、依赖、脚本、构建、Web、Metro、Android、设备或部署。

历史 fresh 独立设计审查与 Claude 复评均为 NO-GO，当前稿已按复评修订。请核对 Dexter 已裁定的 palette、fixed-ROI measurement/mask 规则、ROI 指标的人工判定边界和 document stub 恢复守卫，不要把历史 NO-GO 直接当作当前稿结论。

目标：请独立核验当前详设与计划是否可实施，尤其是 latest IA 与历史 numeric 文字的优先级、完整 alpha CAPS inventory、primitive keyboard token/API、两个 integration theme、PrimitiveButton.selected 对 keyboard-focus 的真实消费、Web onClick 与 native onTouchEnd 的 composed proof、InputProvider 热路径边界，以及 CP-0 fixed-ROI manifest、measurement/mask 规则和 ROI 比较是否能阻止自证与自然绕过。

请从 catering-v2s 仓库根阅读：
- implementation-design-codex：详设；
- implementation-plan-codex：CP-0 至 CP-5 实施计划；
- design-granularity.json：设计分母和 pixel baseline contract；
- adversarial-review-codex.json 与 round1/round2 报告：fresh 审查状态和原始 findings；
- terminal-input-keyboards-ia-approved.png：已确认复合 IA；
- 2026-09-06 terminal-input-keyboard-visual-redesign-requirements-v2：历史文字输入，需与最新 IA 差异核对；
- keyboardLayout.ts、VirtualKeyboard.tsx、InputProvider.tsx：布局、事件和更新边界；
- tokens.ts、PrimitiveButton.tsx、PrimitiveIcon.tsx、types.ts：primitive recipe/public API；
- 两个 integration 的 global.css、tailwind.config.cjs、theme.test.ts：theme owner；
- terminal-image-compare README/compare：ROI 比较执行体；
- AGENTS、scripts README、Claude handoff template：项目边界。

请重点挑战：numeric 三列是否被明确为最新正本；mobile inset 是否安全地被限定为示意而不删除 CAPS；七个 token 是否都有实际 renderer consumer；五个中性色是否跨主题相等且 key/action 相等、focus 是否跨主题不等；Web/native 两个 surface-dismiss 入口是否分别可证伪且 document stub 恢复；fixed-ROI manifest 的 measurementMethod/mask 是否闭合；`changedFraction <= 0.02` 是否仅作为约 98% 的视觉参考；以及任何 OPEN/NOT_RUN 是否被误写成 PASS。

请给出明确 GO 或 NO-GO，并报告 M/S/N。每条 finding 请给出 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，列出相对路径、精确行号、反例、影响面和最小修复。视觉对账按固定 ROI 约 98% 一致执行：`changedFraction <= 0.02` 是量化参考，机器门只判 manifest/geometry/token，最终由轻量视觉记录判定；不要求逐像素完全相等。GO 不代表实现、动态、visual、Web、Android、release、cleanup 或 acceptance PASS。

授权边界：本轮只授权 DESIGN review，不授权任何源码、测试、依赖、脚本、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git 操作。谢谢。

仓库根相对路径汇总：doc/review/platform/2026-09-19-ter-terminal-input-keyboard-visual-design-review-request-codex.md；详设、计划、IA、fresh review 报告、源码和工具路径均在该文件的“需阅读文件”章节。
```
