# TER 终端激活交互与双机拓扑 · 外部复评 finding intake

## 范围与证据边界

本记录由主 agent 按 `project-memory/operations/claude-review-finding-intake.md` 重开原始需求、当前设计与 owning source 后形成。所核 Claude 输入为 `doc/review/platform/2026-10-03-ter-terminal-activation-interaction-pair-topology-design-rereview-claude.md`，其 verdict 绑定该报告列出的旧字节；本记录不改写该历史 NO-GO，也不声称独立复评。

本轮已明确授权两项最小文档修正及完整专项实施/动态验收；不授权 Browser L2、reset/seed、UAT、生产部署、生产 HA 或批次外功能。

## Findings

### S-1 · LMS 承载和壁纸数据源

- **分类：`REJECTED_WITH_EVIDENCE`（对当前修订字节仍存在矛盾的主张）**。原复评所指旧字节的问题当时成立；当前修订已补齐两种承载与数据来源。
- **当前判据**：正式需求 `doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-and-pair-topology-formal-requirements-codex.md` R-01、R-09a、R-09b；IA §3 总则及 `IA-SAMPLE-06/09`；交互工件 `SAMPLE-06-LMS/SAMPLE-09-LMS`。
- **当前证据**：IA §3 明确单机 LMS 为 MASTER+SECONDARY 同 runtime host owner，双机 LMS 为 SLAVE+VICE 并读取当前 peer 的 `hostPendingProjection`/host-confirmed projection；IA `SAMPLE-06` 明确区分两条会员确认链，`SAMPLE-09` 明确区分两条已确认壁纸读取链。UI `SAMPLE-06-LMS` 与 `SAMPLE-09-LMS` 同样列明两种来源，且限制不得读取 branch-local pending/壁纸。MMP/LMP 本页确认仍归各自 host owner；LMS 逻辑在 `SAMPLE-06-LMS`。
- **反例检查**：对 IA 的四个 ACT、四个 AUTH、六个会员 screen 与四个 wallpaper screen 搜索 LMS/同 runtime/peer/projection 相关条款；当前仅将同 runtime 限定于单机情形，未发现双机被排除的当前断言。SAMPLE-04/05 的 host 本页确认未携带 LMS/VICE 路径。
- **影响与最小修正**：未发现当前遗漏；不需再修正。保留 branch-local pending 与壁纸，不新增同步 owner 或 coordinator。
- **剩余 OPEN**：真实投影与 UI 行为属于 V-12/V-14/V-20，尚须按动态计划验证；文档闭合不能替代运行证据。
- **Dexter 裁决**：不需要。

### N-1 · testId 当前源码常量与设计提案标注

- **分类：`PARTIALLY_CONFIRMED`**。复评旧字节中的 logout/exit 不存在判断对当前源码已过期；IA 的通用总则仍有一句把全部所列 testId 概括成提案，容易与已实现常量矛盾，已作最小文案修正。
- **当前判据**：IA §3 要区分已有值与未落源提案；UI §1.2 和 SAMPLE-07/08/10 汇总逐屏列出现有/提议 ID。
- **当前证据**：`apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts` 导出 `exit`、`logout`；两种 host wallpaper component 使用相应节点；LSP 分支不渲染 logout。`sampleWallpaperPicker.test.tsx` 覆盖 MMP/LMP logout 派发既有 `logoutCommand`、LMP exit 单独派发 exit command，以及 LSP 不显示 logout。
- **原 finding 的适用边界**：对本次 intake 所读当前实现，不能将 host wallpaper logout/exit 标为“未实现”；其在 UI 汇总中的当前源码常量标注成立。尚未在源码实现的其他设计 testId 仍须标为提案。
- **最小修正**：IA §3 总则现写明逐屏清单区分源码已有 testId 与设计提案，不把未落源条目标成当前常量。无需额外改 source，也不复述每屏全集。
- **剩余 OPEN**：上述聚焦测试通过不等于 Expo Web、VM 或端到端登出动态验收；这些仍按 V-11/V-14/V-20 报告。
- **Dexter 裁决**：不需要。

## 同根修复记录：管理台 section 与页面内容标识

双机拓扑运行首败根因为 runner 把持久导航 section 当成当前页面内容，导致导航与内容根使用相同测试标识时 selector 不唯一。当前修复为各管理页引入单独 `contentRoot` ID，并令拓扑等待实际页面标题/内容根；display-context 是 runtime canonical page 缺失时的 fallback renderer，`selectAdminPageProjections` 每个 canonical page 只选择一个来源。`adminSections.test.tsx` 增加仅有 fallback source 时的回归测试，避免把互不同时渲染的 fallback 当成第二个活动页。

该修复经包级测试与一次当前字节受管 Expo Web 平台端口页面验证。`sample-console` laptop `platform-ports-smoke` 结果：`business=PASS cleanup=PASS sourceStable=PASS`，runId=`20261003-ter-pair-web-admin-topology-console-laptop`，sourceSha256=`0398f67ab2c206ddf99f09d41e5bedb9b9cbcdfa1c4b54d924108a0f2ab07bd6`。该通用 runner 场景不是 V-01～V-20 的业务证明。
