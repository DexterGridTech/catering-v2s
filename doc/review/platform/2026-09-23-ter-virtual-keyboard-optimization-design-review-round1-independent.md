# TER 虚拟键盘优化 DESIGN 独立对抗审查 · Round 1

> 本文由主 agent 逐项转录 fresh 只读 reviewer `01a0cdc0-cc36-7843-a630-3f57f637f5b2` 的返回；verdict/findings 属 reviewer，不是作者自审。reviewer 未写文件。  
> reviewerKind=INDEPENDENT_SUBAGENT；REVIEW_TARGET=DESIGN；REVIEW_CYCLE_ID=TER_VIRTUAL_KEYBOARD_OPTIMIZATION_DESIGN_2026-09-23；REVIEW_ROUND=1；REVIEW_ROUND_LIMIT=2。  
> blindReviewDeclaration=先独立阅读被审设计、上游材料、路由 memory 与 owning source 形成 findings/verdict；未读取作者自审/处置材料。  
> authorMaterialReadAfterIndependentVerdict=false；ACTION_1_VARIANT=1-B 文档提取。  
> VERDICT=NO-GO；M/S/N=1/1/1；EVIDENCE_TIER=static_read_only_source_and_design_review。

## Findings（独立原判定）

| ID | 独立结论 | 反例和影响 | 最小修法 |
| --- | --- | --- | --- |
| M-1 | CONFIRMED | 详设 §3/§6 只说 presentation-only bridge；`apps/terminal/ui/base/render/src/types/props.ts#SurfaceRootContentFrame` 只有 `{content}`，`SurfaceRoot.tsx#SurfaceRoot` 把 children/ScreenContainer/LayerStack 混成一棵树，`LayerStack.tsx#LayerStack` 同含 backdrop/layer，`consoleAssembly.tsx` 只把整棵内容塞进 InputSurfaceFrame。executor 必须猜 offset 传递，可能移动遮罩或让 render 反向依赖 input，破坏 VK-R05。 | 给出 exact bridge 类型/owner/API：谁声明、创建、驱动/消费 offset；分别移动 ScreenContainer 与 layer 内容，backdrop 固定；键盘层级和 pointer events 明确，绑定四处源码签名。 |
| S-1 | CONFIRMED | `useInputField.ts` 的 nativeLess `inputRef=null`；`ui/base/input/src/types/types.ts` registration 无 measure handle；`InputScrollArea.ensureVisible` 见 null 就跳过；`PrimitivePinInputProps` 无 ref/onLayout/measure。PIN 是 9 个生产输入点之一，不能凭 testID/固定坐标假测量。 | 增最小可见测量锚点 API，说明 surface-local 坐标、无滚动时容量不足与 focused 反例。 |
| N-1 | NOTE | 对 `TER / virtual keyboard / keyboard / URL symbol / PIN / input` 检索 `confirmed-business-language-corpus.md`，无专项业务语料命中。 | 处置写 `NO_CORPUS_ENTRY_MATCHED`，不把 corpus 冒充键盘产品裁定。 |

独立审查其余核验：Claude S1(b)/S2/N1 文本、十二 URL 字符、space/零插入、五行 302/232、9 生产字段、20 IA 帧、当前仅设计授权未见矛盾。`L3_UNVERIFIED=Web/Android/native/device/dynamic visual/逐帧截图`，本批禁止动态。

## reviewerInputChecklist（reviewer 返回的核心路径与 SHA-256）

```text
{path=AGENTS.md,sha256=6e67d157e199a2baee8148fa41073f9421eb48ec34e1dde8b78ac1232a1c2679,read=true}
{path=CLAUDE.md,sha256=f08b1fc18e5c1ebbb70056a97a8433c7cf7ad229a5987bafcb0b1e3a367a797a,read=true}
{path=PLATFORM-BLUEPRINT.md,sha256=19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396,read=true}
{path=doc/platform/README.md,sha256=b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80,read=true}
{path=doc/platform/roadmap-program-registry.json,sha256=f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8,read=true}
{path=project-memory/index.md,sha256=2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029,read=true}
{path=project-memory/decisions/deterministic-context-only.md,sha256=c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263,read=true}
{path=scripts/README.md,sha256=06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8,read=true}
{path=doc/platform/review-standard.md,sha256=6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6,read=true}
{path=doc/decisions/2026-07-24-v2s-verification-governance.md,sha256=6dceb7fe8fac8a9ac4df5c650204f225f079451218dd5fcbd6f573c68692f0f5,read=true}
{path=doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md,sha256=bb6b02257b1a1413480b7138d943972c6e189a651095eaddc8940684983d489e,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-codex.md,sha256=883ce7aa7834be4d503561c06f3c009b9ed533cd5c11669b7eb0591db096d42e,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ui-interaction-design-codex.md,sha256=b7ea2089d9677352ad817e6bfbe74f461e6554d2762f2f41134be169ee5babe1,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-ia-design-codex.md,sha256=be300c9d4330a995dc2588f59b4217ecd60776e6e00182d46abd99656eb31329,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-design-codex.md,sha256=33fceee60d718bb0b46c2a5ff80cd867202edff1d01b115a99e9c379a9bf94d3,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md,sha256=0b65115a512dda22c8f0b2bc3f415c320fc38410cb2247a68e8d0fd9b5bbb66e,read=true}
{path=doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-requirements-analysis-codex.md,sha256=2e9ab88137099ae0559050a7e8ae566841fe0d8c9253344867a3ac3aa2cbddd9,read=true}
{path=doc/review/platform/2026-09-23-ter-virtual-keyboard-optimization-formal-requirements-review-claude.md,sha256=8c13dd96bf54d4e612e7ab27a6b654a5ca3d64d8567262362d9aa5b211a91f11,read=true}
{path=apps/terminal/ui/base/render/src/types/props.ts,sha256=830f0bd832dccc044c4f41ae8c14ecd3fb461e9caa1f3789dd4312a2b4d28b1a,read=true}
{path=apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx,sha256=4fa3c4cebd1ade0715e54996faff6a8e267579d98c893daf8207b7ae78d039e9,read=true}
{path=apps/terminal/ui/base/render/src/components/LayerStack.tsx,sha256=935bd7206a758ad98dfbd901ae5d36a2322191f8c2476e19a6875d653f9b8dcd,read=true}
{path=apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx,sha256=05f36a6b14ea2da10583c1b3b35bb46f68e6c99a5ae9e851f9c405d725067017,read=true}
{path=apps/terminal/ui/base/input/src/types/types.ts,sha256=a88bf40ab5e8a9474cfbe5a036e0a10597bbf62ec2ac9494f5e6cceaf7cfd9a9,read=true}
{path=apps/terminal/ui/base/input/src/hooks/useInputField.ts,sha256=aed4c9d3f181d87c7acb1952dacfcef6ebd21eb5da3c5f334bd057a2d53ee444,read=true}
{path=apps/terminal/ui/base/input/src/components/InputScrollArea.tsx,sha256=f6eeda27081c7a7c77c042c6585e45ff029380a04ee8515f634549a83950901f,read=true}
{path=apps/terminal/ui/base/primitives/src/types/types.ts,sha256=4d034e66605845a21becae3ac6b82eedcd610df26f219ce06bed133cab5ff1b9,read=true}
{path=apps/terminal/ui/base/primitives/src/components/PrimitivePinInput.tsx,sha256=20e8e3216b9bc1e3713e810380dd4ee5b7e48d07e2ff4a5872285fcbd31ca2f1,read=true}
```

本清单只转录 reviewer 明确给出的核心项；不是声称其它路由原文皆有逐项 SHA 留痕。作者处置在独立 verdict 后另文记录，不回写 reviewer 判定。
