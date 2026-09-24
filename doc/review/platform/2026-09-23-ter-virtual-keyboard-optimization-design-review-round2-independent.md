# TER 虚拟键盘优化 DESIGN 第 2 轮独立对抗审查

> reviewerKind=INDEPENDENT_SUBAGENT；REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；REVIEW_ROUND=2；REVIEW_ROUND_LIMIT=2；ROUND_FINAL_DECISION=SELF_DECIDED。  
> VERDICT=GO（仅 DESIGN_GO）；M/S/N=0/0/1。审查者为 fresh 只读子 agent；本文件由主 agent 忠实转录 verdict，审查者没有写入仓库。  
> 盲审声明：先独立读取当前五份设计/计划、上游需求、项目记忆和 owning source 并形成 verdict，之后才读取第 1 轮报告与作者处置。`authorMaterialReadAfterIndependentVerdict=true`。

## 输入与独立结论

本轮读了 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`doc/platform/roadmap-program-registry.json`、`project-memory/index.md`、`project-memory/decisions/deterministic-context-only.md`、`project-memory/decisions/confirmed-business-language-corpus.md`、`scripts/README.md`、`doc/platform/review-standard.md`、`doc/platform/terminal-coding-standard.md`，以及正式需求、交互设计、IA、详设、实施计划五份当前字节。第 1 轮报告和处置记录只在 verdict 后读取。

1. 第 1 轮 M-1 的 presentation bridge 已在详设 §4.5 精确到 `SurfaceRootContentFrame` 新 prop、每 surface 唯一 `Animated.Value`、assembly 透传、input 唯一写者、render/LayerStack 只读，以及固定遮罩和 keyboard overlay 层序；当前源码尚未实现，设计给出了未来改动路径。
2. 第 1 轮 S-1 的 `nativeLess` PIN 已在详设 §4.6 精确到 `InputVisibleAnchorHandle`/`visibleAnchorRef`、`RnrPressable` ref 透传、真实六格 Pressable 测量、同 generation 的坐标换算与无滚动区域的容量失败。
3. 方案 (b) 对 `246→190`、`190→246`、`246→246` 的交接已在详设 §4.2/计划 CP-3 定义实际可见遮挡 `K(t)=max(v_A(t),v_B(t))`、分阶段位移和逐帧证伪；设计已闭合，不是动态观察结果。
4. URL 十二字符、全宽五行、Shift/空格、最终宽度容量及 `K≤320`、`K≤H/2` 的约束在需求、IA、详设一致；交互设计视觉审阅仍为 `UNSET`。
5. 20 个 IA 帧、9 个生产字段、受控 field harness、两套 integration 与授权边界在计划中可复核。Web、Android、native/device、视觉、cleanup 均 `NOT_AUTHORIZED/NOT_RUN`，不能据此声称运行通过。

## 唯一 Note 与作者处置边界

N-1：`project-memory/decisions/confirmed-business-language-corpus.md` 仅命中通用 G-10 URL 语义，没有 TER virtual keyboard、PIN 或 keyboard symbol 专项业务语料。应继续标记 `NO_CORPUS_ENTRY_MATCHED`，产品事实取自 Dexter 本轮要求、Q1–Q6 和正式需求，不假借 corpus 权威。第 1 轮处置记录已如此写明；本轮不要求修改设计语义。

第 1 轮是 `NO-GO,M/S/N=1/1/1`；本轮审查者认为其 M-1/S-1 已有 exact API、owner 和失败边界，故不再保留 M/S finding。本轮为同一 DESIGN cycle 第 2 轮，按上限硬停止，不发起第 3 轮。

## reviewerInputChecklist（核心，审查者报告原值）

```text
{path=AGENTS.md,sha256=6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679,read=true}
{path=CLAUDE.md,sha256=f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a,read=true}
{path=PLATFORM-BLUEPRINT.md,sha256=19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396,read=true}
{path=doc/platform/README.md,sha256=b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80,read=true}
{path=doc/platform/roadmap-program-registry.json,sha256=f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8,read=true}
{path=project-memory/index.md,sha256=2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029,read=true}
{path=project-memory/decisions/deterministic-context-only.md,sha256=c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263,read=true}
{path=project-memory/decisions/confirmed-business-language-corpus.md,sha256=335fcaff503385b777cab673502f4b343865f47ab1e098c47a139b2bbd374c3d,read=true}
{path=scripts/README.md,sha256=06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8,read=true}
{path=doc/platform/review-standard.md,sha256=6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6,read=true}
{path=doc/platform/terminal-coding-standard.md,sha256=595c39dabb72c6f7ec4f4c7579564032ce1ee81ca999113d43801f4e346d7b03,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md,sha256=883ce7aa7834be4d503561c06f3c009b9ed533cd5c11669b7eb0591db096d42e,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md,sha256=b7ea2089d9677352ad817e6bfbe74f461e6554d2762f2f41134be169ee5babe1,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md,sha256=eaa3ca0da2b449c108d577593706dc16a55eb3bf03c6c51850c8d67da07761ad,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md,sha256=dac2cdb7ab119e27328632165e7aaaecc6b2fe82e91a161f5604c8d638870671,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md,sha256=4fed3ca49c1606d5da2f65820bd354e2de0e55b28ae44a06133c3b9aad2765ad,read=true}
{path=doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-review-round1-independent.md,sha256=269a9763da041caa87cbaa21f1d54c9691da6d6f1873f8d278f5ba001f9a2c6f,read=after_independent_verdict}
{path=doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-design-round1-disposition-codex.md,sha256=b7c7e59995854ea2a72b2512ae35708c0df7713fc0008419fb6f384fc1fe139c,read=after_independent_verdict}
```
