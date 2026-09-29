# TER 第三方库整改 IMPLEMENTATION 独立复核记录

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/3
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-09-29-ter-third-party-usage-remediation-implementation-review-input-checklist-codex.md
blindReviewDeclaration=先尝试证伪实现，并在读取作者自评/处置前形成 findings 与 verdict
authorMaterialReadAfterIndependentVerdict=false
```

独立 reviewer：Helmholtz，session `01a0ed01-5cb3-7183-bd76-ab52e71392ec`。该 reviewer 只做只读静态审查；没有重跑构建、测试、Web 或设备运行。

## 固定结论

`L1_ENGINEERING=PASS`：本轮代码审查未发现阻断性实现问题。`scripts/test/ter-admin-display-web.mjs` 的 source digest 绑定与 runner 修复未发现同根假绿；runner `node --check` 和当前 Web manifests 均已检查。此项不是 reviewer 重跑所有 CP 测试的声明。

`L2_USER_VISIBLE=PASS`：仅对提供的当前字节 Web manifests 中确实观测到的交互成立（W2 overlay ownership、W11 键盘旅途及 admin-runtime 字段/画布读数）；不等于完整视觉验收，也不覆盖未运行场景。

`L3_UNVERIFIED=`

- Dexter 明确豁免：W5、W7、W8、W10。
- W4 的 screen/layer 错误边界没有当前字节 Web 动态记录；W9 四个 runtime Web run 记录 `startup.complete` 后为 `startup.ready-hidden`，但 native callback、真实 splash 与 resetRuntime 时序不由 Web 证明。
- W1/W3 语义色的视觉判定未由这些 admin-runtime 场景证明；拓扑 T1–T5 没有 Web 证明，且不以 Web 替代。
- W2 mobile topology host 输入不在该形态的产品控件树中，状态为 `NOT_COVERED_BY_PRODUCT_CONSUMER`。
- Web 结果不证明 Android/native、设备或双端 TR-16 等价。按本轮授权，仅 Web 动态验证；这些均不得写成 PASS。

`SAME_ROOT_SCAN=未发现当前 Web runner 与该 Web 证据之间已确认的同根假绿；N-1 为本次审查输入 checklist 的路由缺陷，不是产品源码回归。`

`DESIGN_GAPS=独立 reviewer 未提出详设缺判据项。`

`EVIDENCE_TIER=静态源码审查：reviewer 亲验；focused/node syntax：作者记录且 reviewer 只读核对；Web：作者受管运行 manifests，reviewer 只读检查；Android/native/device、拓扑与未列场景：未验证或明确豁免。`

## Source-facts inventory（独立审查提取）

| 事实 | 当前源码 / 证据位置 | 含义与边界 |
|---|---|---|
| Web 预期逻辑分辨率依 surfaceForm 取 landscape/portrait | `scripts/test/ter-admin-display-web.mjs:30-41` | 修复了 mobile 被错误拿 landscape 尺寸比较的问题；当前 mobile Web runtime run 观察到 360×640。 |
| mobile Admin 导航走 drawer trigger / option，laptop 走 section tab | `scripts/test/ter-admin-display-web.mjs:593-598` | 这是两形态分别寻址导航的 runner 路径。 |
| runtime 场景读取 PRIMARY 逻辑宽高、就绪状态、设备区域标签数量与 SECONDARY 卡片数量 | `scripts/test/ter-admin-display-web.mjs:600-610` | Web 无物理副屏事实；secondary/device 数据不能由该场景证明。 |

四个 runtime Web 日志中，`startup.complete` / `startup.ready-hidden` 的序号分别为 sample-console laptop/mobile 44→45、sample-wallpaper-console laptop/mobile 15→16。此项只证明 Web readiness/ready-hidden 事件顺序，不证明 native callback 或真实 splash 生命周期。
| 仓库 memory 路由没有 TER consumer-face | `project-memory/routing-vocabulary.json:3-9` | `consumerFaces` 只有 all/backend/platform-admin/operations-admin；CLI 又拒绝 `all`。 |

## 作者对独立 findings 的 intake 与处置

| Finding | 级别 | 复核状态 | 事实、影响与处置 |
|---|---|---|---|
| N-1：审查 checklist 指定不存在的 `consumer-face=terminal` | N | `CONFIRMED`，已作记录修订 | checklist 原命令真实返回 `PROJECT_MEMORY=FAIL / REASON=unknown or non-specific route: consumerFaces:terminal`、exit 2。路由词表 `project-memory/routing-vocabulary.json:6` 不含 terminal；`tools/project-memory/cli.mjs:188` 对未知或 non-specific route fail closed。checklist 保留该失败原样，另记 reviewer 用 platform-admin/operations-admin supplemental routes 与直接 TER memory refs；不擅改 routing vocabulary。 |
| N-2：TR-16 两端证据未验证 | N | `CONFIRMED`，由授权边界解释，仍列 OPEN evidence | 设备/Web parity 没有独立证明；当前仅获准 Web，reviewer 没运行设备。用户将 W5/W7/W8/W10 豁免，但未把其他未观察项变为 PASS。交 Claude 时逐项披露，不追加设备运行。计划与标准出处：`doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md:20-26`、`doc/platform/terminal-coding-standard.md` TR-16。 |
| N-3：LSP diagnostics 未运行 | N | `CONFIRMED`，非阻断 | reviewer 报告代码智能工具不可用，因此未产生 LSP 诊断；这是验证缺项，不是代码错误。本轮最近改动是 `.mjs` runner，已做 `node --check` 并有同字节 Web run；不据此宣称做过 LSP/typecheck，也不为此扩大验证。 |

## 当前 Web 证据索引

10 个计入的最终 Web run manifests 位于 `.runtime/ter-admin-display/<runId>/run-manifest.json`，均为 `phase=COMPLETE`、`business=PASS`、`cleanup=PASS`、`firstFailure=null`：

- `ter-remediation-webonly-final-w2-console-laptop-20260929-02`
- `ter-remediation-webonly-final-w2-console-mobile-20260929-02`
- `ter-remediation-webonly-final-w11-console-laptop-20260929-02`
- `ter-remediation-webonly-final-w11-console-mobile-20260929-02`
- `ter-remediation-webonly-final-w11-wallpaper-laptop-20260929-02`
- `ter-remediation-webonly-final-w11-wallpaper-mobile-20260929-02`
- `ter-remediation-webonly-final-runtime-console-laptop-20260929-02`
- `ter-remediation-webonly-final-runtime-console-mobile-20260929-02`
- `ter-remediation-webonly-final-runtime-wallpaper-laptop-20260929-01`
- `ter-remediation-webonly-final-runtime-wallpaper-mobile-20260929-01`

sample-console manifests 的 `sourceSha256=8da8a200c7bae8add89ade39565d83d10a6f9b1beb3c029a8e86c7b9368d9027`；sample-wallpaper-console 为 `4fed7ba481ecc0c9f436d20fe04a5170c86d831eeec61741257908d91f5f2f1c`。mobile runtime 旧预期值造成的首败保留在 `ter-remediation-webonly-final-runtime-console-mobile-20260929-01`（旧 digest、business FAIL、cleanup PASS）；按当前方向值修复 runner 后的 `...-02` PASS。首败不计入 10 个最终 PASS。

当前字节上的最新运行：`ter-remediation-webonly-final-runtime-console-laptop-20260929-02`，2026-09-29 20:48，business=PASS、cleanup=PASS，sourceSha256=`8da8a200c7bae8add89ade39565d83d10a6f9b1beb3c029a8e86c7b9368d9027`。

最后一次通过：同一 run ID；本批当前字节 Web 证据中最新且通过。

## 收口

独立复核 `GO_WITH_UNVERIFIED_UI, M/S/N=0/0/3`。作者已记录 N-1 的 checklist 处置；N-2 按当前明确授权保持未验证；N-3 记录为未运行且非阻断。没有报告生产代码阻断项。整批结论不是全量动态验收通过；Claude 评审请求须保留上述 L3 清单与 W8 豁免。
