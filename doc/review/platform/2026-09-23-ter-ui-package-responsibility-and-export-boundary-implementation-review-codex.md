# TER UI 五包职责与公共导出边界：IMPLEMENTATION 独立复核

日期：2026-09-23  
范围：本批授权的 CP-0 至 CP-4；五个 TER UI 包的非收窄 public-surface 契约补强及两 Android app × 双屏/mobile 动态回归。  
评审规范：`doc/platform/review-standard.md`；判据：本批需求、implementation design、implementation plan、项目记忆与 owning source。  
reviewer 均为只读；测试、设备运行、证据整理与本文写入由主 agent 完成。

## 最终结论

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerIdentity=01a0ccd2-e979-78b0-87b7-854dbcfbcb16
BLIND_REVIEW_STATEMENT=未采信主 agent 或前任 reviewer 结论；仅将前任 finding 作为复查范围，fresh reviewer 重新读取当前仓内指令、标准、设计/计划、owning source 与四组动态证据后独立下结论。
INPUTS_READ=AGENTS.md; PLATFORM-BLUEPRINT.md; doc/platform/README.md; doc/platform/roadmap-program-registry.json; 当前 Roadmap 授权字段; project-memory kernels 与六维路由原文; scripts/README.md; doc/platform/review-standard.md; doc/platform/terminal-coding-standard.md TR-06/TR-12/TR-13/TR-R01/TR-R02/§7.1; 本批 requirements/design/plan; 动态证据 README; 四组 command-actions/result; run-sample1/run-sample2 cleanup source。
ACTION_1_VARIANT=1-A 代码与运行证据事实提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS：N1 文案现与四组 JSONL 时序、四份 result cleanup/firstFailure 及 cleanup source 一致；71 root/7 export-map path、非收窄边界与 Android consumer 契约保持。
L2_USER_VISIBLE=PASS_FOR_EXTRACTED_DYNAMIC_FACTS：证据准确描述双屏/mobile 已记录旅途、屏幕归属、alpha 键盘探针和 wallpaper pending/confirmed/restart 状态；未把 UI 树提升为像素或视觉结论。
L3_UNVERIFIED=像素/截图/整体视觉未验证；Web/Metro 未运行；本批未重新构建 APK；未验证其他设备类别；71 个 root export 与 7 条路径的仓外消费者仍 OPEN；dismissal helper 纯度仍 OPEN。
SAME_ROOT_SCAN=五包 public surface、关联 invariant/test、两个 Android host、两个 runner 与四组动态证据均已复核；Round 1 唯一 finding N1 已同根修正并经 fresh Round 2 复查关闭；剩余实施范围内 finding=0。
DESIGN_GAPS=无新增设计缺口；既有 OPEN 项按计划边界保留。
EVIDENCE_TIER=静态源码/契约 + focused tests/真实红变异/host typecheck + 已安装 release APK 的 Android 双屏/mobile 动态 UI-tree/log/cleanup 证据；reviewer 未重跑测试或设备。
N1_STATUS=CLOSED
NEW_FINDINGS=0
```

`GO_WITH_UNVERIFIED_UI` 仅表示本批已授权实施差异与对应动态事实经复核无 OPEN；不表示像素视觉验收、Web/Metro 或未授权设备验证通过。

## 复核动作与 Round 1 finding 处置

### 动作 1-A：用户可见事实提取

从四组设备证据提取到的事实如下，单独列事实，不将存在控件或 UI tree 断言当作视觉判断：

- `sample-terminal` 双屏：primary 记录 login、invalid-login、member-list、member-form；secondary 记录 `sample.desk.customer-welcome`。mobile 记录 member-list/member-form；alpha probe 实际输入后执行 complete，键盘关闭且输入值保留。
- `sample-wallpaper-terminal` 双屏：记录登录前 waiting、登录后 welcome 与 picker；mobile 记录 picker。两种形态均记录 w1/w2/w3 pending、confirmed 及冷启动恢复断言。
- 四份 run result 均为 `business=PASS`、`cleanup=PASS`、`firstFailure=null`。双屏逻辑屏为 2560×1600 与 1280×720；mobile 逻辑屏为 720×1280。

事实来源为动态证据目录中的 `result.json`、UI XML、Display/SurfaceFlinger 快照、logcat 与 `command-actions.jsonl`；不据此声称尺寸、颜色、排版或像素相同。

### 动作 2：逐条对账

实现范围按本批详设与计划核对：

- CP-0：当前字节复算五包 `src/index.ts` 为 71 个命名 root exports；`package.json exports` 为 7 条路径（五个 `.`、两个 `./theme/global.css`）。Q5 与仓外消费者保持 OPEN。
- CP-1：五包以非收窄方式同步 README、root index、package exports、`terminal-invariants.json` 与 public-surface 执行体；两个 integration 的 CSS 子路径登记精确 key/target；consumer-side contract 与两个 Android host typecheck 保持真实 package-root import、moduleName、CSS 子路径的约束。
- CP-2：`AUTHORIZED_SHRINK_ITEMS=0`；71 个 root exports 均未删除或收窄。不存在以仓内零命中推导删除的实施。
- CP-3：16 个 focused test 文件 / 131 tests 通过；8 项指定 red mutations 均真实失败，恢复后同门通过；两个 Android host `tsc --noEmit` 通过。首次 `pnpm exec vitest` 失败在 runner 启动前，原因及恢复路径记于 CP-3 记录。
- CP-4：完成全批三维对账、四组限定 Android 动态验证、cleanup、逐代码对账与两轮独立 implementation review。两种虚拟机 × 两 app 均 PASS；动态 README 分开列业务、cleanup 与未验证边界。

未见实施偏差。以下不是本批允许关闭的差异，仍按计划 OPEN：Q5/仓外消费者、MemberForm v2 区域标题既有差异、dismissal helper 纯度。

### 动作 3：同根范围扫描

扫描五个目标包及其 invariant/publicSurface 测试、消费者侧 Android `App.tsx` / `platformPorts.ts` / `dependencies.ts` / Metro 配置、相关 assembly/feature 契约测试与两个动态 runner。CP-3 执行记录含指定变异对照；动态复查覆盖全部四个 run 目录。Round 2 reviewer 报告实施范围内剩余 OPEN 为 0。

### 动作 4：未验证事实

| 档位 | 事实与结论 |
|---|---|
| 静态已证 | 71 个 root exports、7 条 export-map paths；五包 exact public-surface/invariant 契约及 Android consumer 静态约束；无获准 shrink。 |
| focused 已证 | 16 files / 131 tests；8 项指定变异红、恢复绿；两个 Android host TypeScript typecheck 通过。 |
| Android/device 动态已证 | 两个 app 各在双屏与 mobile 运行；旅途、屏幕/状态事实、cleanup 由 run-scoped evidence 记录。四组 firstFailure 为 null，business 与 cleanup 均 PASS。 |
| 未验证 | 没有截图或像素比较；`visual=NOT_APPLICABLE_WITH_REASON`（本批无视觉变更），不构成视觉验收；未跑 Web/Metro、未重新构建 APK、未验证其他设备形态。仓外消费者、v2 区域标题差异、dismissal helper 纯度仍 OPEN。 |

### Round 1 finding 及修复

Round 1 reviewer `01a0ccc7-7ceb-7182-ab80-72573281e62b` 给出 `VERDICT=GO_WITH_UNVERIFIED_UI, M/S/N=0/0/1`。唯一 N1 为动态证据 README 把每组唯一 `package PID readback status=1` 描述为 pre-run 信号；从四组 command timeline 看，它实际发生在 `final package force-stop status=0` 之后，是 cleanup 后 PID 为空的确认。

主 agent 逐组重读日志、`result.json` 与两个 runner cleanup 实现后，仅修订动态证据 README 的该处解释，没有更改源码、测试、runner 或动态结果。修订后的 README 说明 `pidof` 的空结果允许非零状态，且四份 result 均 `cleanup=PASS`、`firstFailure=null`。

### Round 2 remediation recheck

Fresh reviewer `01a0ccd2-e979-78b0-87b7-854dbcfbcb16` 重新读取当前指令、判据、计划、source 与四组证据，确认：四条 `status=1` 均紧跟成功的 final force-stop；cleanup 源码将空 PID 作为预期结果、非空 PID 才失败；修订后的 README 准确；N1 closed；无新 finding。复查只读，未重跑设备、构建或测试。

## 证据索引

- 需求：`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-requirements-codex.md`
- 详设：`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-23-ter-ui-package-responsibility-and-export-boundary-implementation-plan-codex.md`
- CP-3 focused、mutation、typecheck 与首次失败：`doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-cp3-execution-evidence-codex.md`
- 四组合 dynamic result、cleanup 与证据边界：`doc/evidence/platform/2026-09-23-ter-ui-package-responsibility-dynamic/README.md`
- 逐帧/逐状态运行原件：同一 dynamic 目录下 `sample-terminal-dual/`、`sample-wallpaper-terminal-dual/`、`sample-terminal-mobile/`、`sample-wallpaper-terminal-mobile/`。

## Dexter / Claude 后续复核边界

本记录是 Codex 调度的 fresh independent subagent implementation review 结果摘要，不替代 Dexter 或 Claude 对当前源码和原始证据的独立判断。请复核：71/7 分母及零收窄；五包 public contract 的原子一致性；CSS export-map 错指另一个存在文件时的真实变红；两个 Android 宿主的根导入、moduleName 与 CSS 子路径；八项 mutation 的真实红绿；四组合动态状态及 cleanup 时序；Round 1 N1 修正；以及本记录是否诚实保留视觉/Web/Metro/仓外消费者 OPEN。
