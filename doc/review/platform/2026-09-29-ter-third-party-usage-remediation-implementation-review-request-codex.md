# TER 第三方库用法整改实施后复核请求

## 背景

本批按需求 v3.4 实施 TP-A1、TP-A3..A11、TP-B0..B5、TP-C1..C3、TP-D1..D4、TP-X1..X3。详设与计划已完成 CP-A..D；根据 Dexter 最新授权，剩余动态验证只在 Web 进行。W5、W7、W8、W10 已由 Dexter 明确豁免，均不记为 PASS；W8 的豁免是本轮最新明确授权。不得将 Web 结果推为 Android/native、设备、拓扑或视觉验收。

截至本请求修订，`.runtime/ter-admin-display/ter-remediation-webonly*/run-manifest.json` 共 51 次 Web 运行：business=PASS 43、FAIL 8；51 次 cleanup 均为 PASS。八次首败分别保留在 manifest 中：runtime-mobile 尺寸断言一次、mobile overlay 定位两次、layer waiting-confirm runner 断言一次、auth system-notice 无触发一次、SECONDARY runner 参数一次、SECONDARY AdminLauncher 几何两次。除 auth system-notice 外，各失败族已有后续修正后的 PASS；不得抹去首败。SECONDARY 的 AdminLauncher 根因是错误提示关闭后测试宿主滚动，PRIMARY DOM bounds 已移动而 launcher 仍使用旧 `measureInWindow` 原点，导致手势 `logicalPoint.y=-127` 未命中；runner 复位滚动并重读 bounds 后，`...waiting-...-04` 与另外三个 SECONDARY 场景 PASS。此修复只改 runner，没有生产应用源码变更。最终 runner 当前字节的最近一次受管 Web 结果为 `ter-remediation-webonly-w4-layer-auth-notice-console-20260929-02`，business=PASS、cleanup=PASS、sourceSha256=`c36c44b1789552aa52fa3c6ca1f4cb19174b0eaca2d7847c8c35136de6fcd166`。

W4 的 7 个 screen owner 均已由生产 UI journey 触发：PRIMARY `sample.auth.login`、`sample.desk.member-list`、`sample.desk.member-form`；SECONDARY `sample.desk.customer-welcome`、`sample.desk.customer-member`、`sample.wallpaper-console.waiting`、`sample.wallpaper-console.welcome`。其中 PRIMARY 登录旧 runner digest 的 run 为 `ter-remediation-webonly-final-w1-console-laptop-20260929-01`；member-list/member-form 使用 `8db24f9b556871aba86f4cd80cc98987701b1263502ec6dd68ee7af0c16e570e`；SECONDARY 各自 PASS 的 run 为 `ter-remediation-webonly-w4-secondary-customer-member-20260929-01`、`...-customer-welcome-...-01`、`...-wallpaper-waiting-...-04`、`...-wallpaper-welcome-...-01`。14 个 layer owner 中 8 个已在生产 UI journey 上注入并观察到 fallback：两个 integration 的 `admin.console.layer`、两个 integration 的 `sample.auth.notice`，以及 sample-console 的 `sample.desk.discard-confirm`、`waiting-confirm`、`withdraw-confirm`、`registry-notice`。其余 6 个保持 OPEN：两个 integration 的 `admin.console.power-confirmation.layer`（Web device port 的 power-status 订阅不可用，无法由 Web 产品路径挂载）、两个 integration 的 `sample.auth.system-notice`（一次 console 尝试的登录错误是 `AUTHENTICATION` 业务失败，只打开 `sample.auth.notice`，未触发 system-failure observer；wallpaper integration 未另跑）、sample-console 的 `sample.desk.system-notice`（空表单错误是 `VALIDATION`，不触发 system-failure observer）、sample-wallpaper-console 的 `sample.wallpaper.system-notice`（本轮没有受控的 wallpaper 持久化写失败输入）。这些都是条件缺失/未覆盖，不是 PASS。相关首败 `ter-remediation-webonly-w4-layer-auth-system-console-20260929-01` 为 business=FAIL、cleanup=PASS；对应日志和截图保留。为了不留下必然超时的假测试入口，runner 已移除这两个未经证实可由普通 UI 旅途触发的 system-notice journey 假设；该修订尚无新的受管运行，`node --check scripts/test/ter-admin-display-web.mjs` 已通过。

W2 mobile topology host 输入按产品事实记为 `NOT_COVERED_BY_PRODUCT_CONSUMER`：mobile topology 页不提供该字段。W9 四个 runtime Web 日志显示 `startup.complete` 后为 `startup.ready-hidden`，但 native callback、真实 splash 与 resetRuntime 时序不由 Web 证明。W1/W3 的有限截图只记录 sample-console 蓝色主题控件与 wallpaper-console 酒红色主题控件，不构成 57 个语义色键的全量视觉验收。拓扑 T1..T5 不以 Web 替代，按 Web-only 授权标记 `NOT_RUN_BY_WEB_ONLY_AUTHORIZATION`。W5、W7、W8、W10 按 Dexter 裁定豁免，不计作 PASS。未完成项均如实保持 OPEN/豁免，不宣称整批动态验收全绿。

之前的 fresh 独立实施复核为 `GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/3`，报告见 `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-codex.md`。它早于本轮 W4 layer-owner 运行和 runner 假旅途移除；因此仅作历史输入，不作为当前 runner 或动态矩阵的审查结论。此前三个 N 项的处置仍见增量报告与 intake；TR-16 设备侧证据受当前 Web-only 授权限制。

## 评审目标

请依据 v3.4 需求及已接受详设，独立复核当前源码是否按 TP 范围落实、是否存在遗漏/退化/不安全第三方库用法，并审视当前 Web 运行状态与实际覆盖边界是否如实。特别关注本轮受管 Web runner 的 mobile 方向尺寸选择与导航、RNTL v14 setup/cleanup、Android 测试接入、WebSocket topology/JVM socket、persist-kv 兼容与 TP-B/C/D 代码。不要把豁免或未运行项目当作通过。

## 需阅读文件

- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：实施详设与代码判据。
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：CP、测试与动态场景计划。
- `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/` 下 cp-0、cp-a、cp-b、cp-c、cp-d、whole-batch-reconciliation 报告：已有实施与一次性对账记录；无需重做 CP 对账。
- `scripts/test/ter-admin-display-web.mjs`：最终 Web 动态入口；尤其 surfaceForm/方向判据、W4 PRIMARY 几何复位、双屏刷新源码摘要。
- `.runtime/ter-admin-display/ter-remediation-webonly-final-*/run-manifest.json` 与 `.runtime/ter-admin-display/ter-remediation-webonly-w4-*/run-manifest.json`：Web business/cleanup 记录；每个 run 的完整日志、截图与资源预检同目录。
- `.runtime/ter-admin-display/ter-remediation-webonly-final-runtime-console-mobile-20260929-01/run-manifest.json`：已修复的首败记录；与 `...-02` 对照。
- `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-input-checklist-codex.md`：本轮 fresh independent reviewer 的输入清单与盲审声明。
- `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-codex.md`：较早字节的独立实施复核；仅供历史对照，不预设当前结论。
- `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-web-runner-delta-review-codex.md`：较早 runner 增量复核，作为历史处置材料；其结论不覆盖本轮修复后的 runner 字节。
- `.runtime/ter-admin-display/ter-remediation-webonly-w4-secondary-wallpaper-waiting-20260929-02/`、`...-03/`、`...-04/`：同一 launcher 几何失败族的两次首败与修复后通过；另三个成功 SECONDARY manifest 使用 `ter-remediation-webonly-w4-secondary-customer-welcome-20260929-01`、`...-customer-member-...-01`、`...-wallpaper-welcome-...-01`。
- `doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`（TR-08/10/11/16/17/§7.1）、`doc/platform/review-standard.md`：适用规范。

截至当前共 51 个 Web run manifest，统一位于 `.runtime/ter-admin-display/ter-remediation-webonly*/run-manifest.json`；每个同名目录含 Expo 日志、截图及资源预检。覆盖场景分组为：`admin-runtime` laptop 4/mobile 3；`keyboard-member-journey` laptop 4/mobile 4；`keyboard-login` laptop 4/mobile 4；`keyboard-overlay-ownership` laptop 3/mobile 5；`screen-error-member-journey` laptop 2；`screen-error-secondary-journey` laptop 7；`layer-error-production-journey` laptop 11。每条的 business 与 cleanup 见独立 manifest，不能只凭汇总当作场景 PASS。失败 run ID 与 firstFailure 均在各自 manifest；修复后复跑不覆盖首败。

## 独立核验重点

- 对 TP-A1、A3..A11、B0..B5、C1..C3、D1..D4、X1..X3 逐项检查详设判据与当前实现位置；核对同族全量消费者，而非只看变更摘要。
- 静态审查 v14 testing setup、原生单测 runner、production registry socket 测试、受保护存储迁移、错误边界/恢复命令、输入遮挡与焦点 owner、ReactEditText 长按菜单、键盘/颜色正本及 README/版本登记。
- 复核 CP 与整体对账报告、实际 focused/static/JVM 结果及源码边界；如发现详设无判据的问题，列入 DESIGN_GAPS。
- 独立读取 51 个 Web manifests，检查 source digest、业务与 cleanup、screen/layer-owner 状态；核对 W4 几何根因、修复逻辑及保留的首败。Web 不等于 device/native/topology/完整视觉证明。
- 明确列出未验证项：W5/W7/W8/W10 为 Dexter 豁免；W4 14 个 layer owners 中 6 个保持 OPEN；W9 原生 callback/splash/resetRuntime 与全量颜色视觉判定未由 Web 矩阵证明；T1..T5 未在 Web 运行；W2 mobile host 输入无产品 consumer。不得称这些项 PASS。
- 按 `doc/platform/review-standard.md` 完成非空源码事实提取、设计对账、same-root scan、静态/测试/verified-by-nobody 分档与固定 verdict block。

## 期望结论

请给出明确 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO` 及 `M/S/N=x/y/z`。UI-bearing review 必须包含 `L2_USER_VISIBLE`、`L3_UNVERIFIED`；如 `L3_UNVERIFIED` 非空，不能给 bare `GO`。每条 finding 附详设路径/行号、实现路径/行号、影响、最小修复与是否需要 Dexter 裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，请对 TER 第三方库用法整改实施结果做独立复核。

背景：本批依据需求 v3.4，实施 TP-A1、TP-A3..A11、TP-B0..B5、TP-C1..C3、TP-D1..D4、TP-X1..X3。CP-A..D 与整体对账记录已完成；Dexter 明确豁免 W5、W7、W8、W10，并将剩余动态验证限定为 Web。共 51 个 Web 尝试：business 43 PASS、8 FAIL；cleanup 全部 PASS。W4 七个 screen owners 均有运行记录；14 个 layer owners 中 8 个观察到 owner fallback、6 个仍 OPEN。本轮只修改受管 Web runner，不改生产应用源码。W9 原生 callback/splash/resetRuntime 与拓扑 T1..T5 不由 Web 证明；W1/W3 有限颜色观察不等于语义色键全量视觉验收。任何未完成项均不宣称通过。

目标：请依据需求、详设和实施计划审查当前生产代码及测试，复核实现完整性、第三方库 API 用法、owner/失败语义、遗漏与回归，并核验所列 Web manifests 的 source digest 与业务/cleanup 结论。请将明确豁免、未运行、产品不可达分开判断。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-requirements-claude.md`：唯一需求输入，v3.4；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-design-codex.md`：详设判据；
- `doc/plans/platform/2026-09-28-ter-third-party-usage-remediation-implementation-plan-codex.md`：CP、验证计划与完整实施范围；
- `doc/evidence/platform/2026-09-28-ter-third-party-usage-remediation/`：CP 与整体对账/验证记录；
- `scripts/test/ter-admin-display-web.mjs` 及 `.runtime/ter-admin-display/ter-remediation-webonly-final-*/run-manifest.json`：最终 Web runner 与运行绑定证据；
- `doc/platform/third-party-library-usage-standard.md`、`doc/platform/terminal-coding-standard.md`、`doc/platform/review-standard.md`：第三方库、TER 与 review 正本；
- `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-input-checklist-codex.md`：fresh 独立审查输入清单。先按清单形成盲审 findings/verdict，再读取作者的历史 review/disposition。

请重点核验 TP-A1/A3..A11/B0..B5/C1..C3/D1..D4/X1..X3 的当前代码与详设判据；RNTL v14 lifecycle/cleanup、原生 Gradle runner、production-registry socket、persist-kv 旧 namespace、resetRuntime 与错误边界、遮挡字段/焦点 owner、ReactEditText 长按菜单、dynamic import/config 与功能正本。核实所有 relevant same-root siblings。复读 51 个 Web manifests，尤其核实 W4 SECONDARY 的几何首败、修复后各 owner 运行，以及 layer owner 8 PASS/6 OPEN 的分类是否有逐 consumer 依据。W2 mobile host 字段为产品未提供，W5/W7/W8/W10 是明确豁免；W9 原生生命周期/启动画面、全量语义色视觉与 T1..T5 不得由 Web 冒充通过。无需重跑已完成 CP 对账或任何动态验证。

较早 fresh 独立 reviewer 对早先字节给出 `GO_WITH_UNVERIFIED_UI`、`M/S/N=0/0/3`，报告路径为 `doc/review/platform/2026-09-29-ter-third-party-usage-remediation-final-implementation-review-codex.md`；不预设当前结论。烦请给出 `GO`、`GO_WITH_UNVERIFIED_UI` 或 `NO-GO` 与 `M/S/N=x/y/z`；逐条 finding 写明详设与实现精确路径/行号、影响、最小修复建议及是否需要 Dexter 裁决。按 review standard 输出 `L1_ENGINEERING`、`L2_USER_VISIBLE`、`L3_UNVERIFIED`、`SAME_ROOT_SCAN`、`DESIGN_GAPS` 与 `EVIDENCE_TIER`；L3 非空时不要给 bare GO。

授权边界：本次只请求实施后复核，不授权新增源码修改、Android/device/VM/native、L2/DEV/seed/reset/UAT、安装/构建或额外动态运行；W5、W7、W8、W10 按 Dexter 裁定保持豁免。谢谢。
```
