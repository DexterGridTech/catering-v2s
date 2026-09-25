REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-VK-2026-09-24-IMPLEMENTATION
REVIEW_ROUND=FINAL-REREVIEW-RESPONSE
AUTHOR_STATUS=OPEN_DYNAMIC_EVIDENCE

## 背景

本文件订正 Claude 终轮复核指出的证据口径问题。S-1（scroll readback）、S-2（快速切换 outgoing key）和 N-1（hosted canvas 层级回退测试）的源码与 focused 修复保持不变；本轮只订正 TR-16 Web→设备证据、IA-19 分组、Android 前置条件及历史 cleanup 记录，不扩大功能或改写实现结论。

当前详细逐场景对照是：

`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/tr16-final-rereview-20260924.md`

当前对账正本是：

`doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md`

作者状态明确为 `OPEN_DYNAMIC_EVIDENCE`：Web 与设备均有当前字节的部分真实观察，但 VK-WEB-03..05 尚未全部闭合；visual 为 OPEN，business 为 NOT_RUN。不能报告整体 GO。

## 评审目标

请独立复核：

1. 当前字节的 Web 证据是否确实早于对应设备 run，并且逐场景记录了路径、时间、源码/APK 字节标识、business 与 cleanup；
2. `IA-19` 是否已经从 `VK-WEB-03` 移到双屏设备专属 `VK-DEVICE-19`；
3. sample-wallpaper-terminal 设备登录前置缺失是否如实标为 OPEN，而不是 NOT_COVERED_BY_PRODUCT_CONSUMER；
4. 双屏重复登录失败、首败后继续采集、cleanup 中间失败与最终 PASS 是否均保留；
5. N-1 的真实 `consoleAssembly.renderContentFrame` 回退是否仍有 focused 用例能变红。

## 需阅读文件

- `doc/review/platform/2026-09-24-ter-virtual-keyboard-optimization-implementation-final-review-claude.md`：终轮 finding 与验收判据；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/tr16-final-rereview-20260924.md`：本轮逐场景 Web→device 对照；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md`：订正后的对账正本及 §9 当前动态口径；
- `doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md`：CP-4 §6.1 共享场景与 IA-19 设备专属分组；
- `apps/terminal/ui/base/console-assembly/test/terminalSurfaces.test.ts`：N-1 回退测试；
- `apps/terminal/ui/base/console-assembly/src` 与 `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`：输入框架真实装配层级；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/web/final-rereview-20260924/`：当前 Web 截图和对象记录；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-terminal/run-manifest.json`：当前 sample-terminal 设备 run；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-wallpaper/run-manifest.json`：当前 wallpaper 设备 run；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-cp4-final01/events.jsonl`：历史重复输入与 cleanup 中间失败；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-terminal/VK-IA-19-dual-sample-terminal-secondary-1790254525188.png`：当前双屏设备专属帧；
- `doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-wallpaper/VK-IA-19-dual-sample-wallpaper-terminal-secondary-1790254747524.png`：当前 wallpaper 双屏设备专属帧。

## 独立核验重点

- Web 当前证据时间：sample-console 约 21:27–21:32；sample-wallpaper-console clean session 约 21:39–21:40；设备 run 分别从 12:49:23Z 与 12:55:48Z 开始，不能把旧 Web 截图或旧 APK 绑定到当前场景；
- `VK-WEB-01` 的 Web full/Shift/十符号观察可见字段值 `:/.?&=-_%+`，但当前 Android 生产入口没有 URL consumer，既有 harness 只能是 `HARNESS_ONLY`；
- `VK-WEB-03`、`VK-WEB-04`、`VK-WEB-05` 的 Web 与 device 只部分观察，必须保持 `PARTIAL/OPEN`，不能以 focused、截图存在、同布局切换或旧 run 补齐；
- wallpaper 设备当前已认证进入 picker，缺少未认证 login/PIN 前置；不得把这个条件缺失写成生产 consumer 不可达；
- 历史双屏登录失败从 `2026-09-24T11:50:33Z` 开始，`11:51:22Z` 才恢复；cleanup 第二次 `11:56:36.797Z` 为 `MANAGED_PROCESS_TREE_TABLE_UNAVAILABLE`，`11:59:54.267Z` 才最终 PASS；
- `IA-19` 是双屏 PRIMARY/SECONDARY 独立几何，属于设备专属，不是 Web 滚动场景；
- 复核 static、focused/typecheck、Web、Android/native/device、visual、business、cleanup 分档，不能用作者报告代替证据。

## 期望结论

请给出明确的 `GO`、`NO-GO` 或 `GO_WITH_OPEN_EVIDENCE`，并按 `M/S/N=x/y/z` 给出每条 finding 的精确路径、行号、影响面和最小修复建议。若动态证据仍不足，请保持 `NO-GO` 或 `GO_WITH_OPEN_EVIDENCE`，不要把订正后的部分证据升级为整体验收。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请复核 TER 虚拟键盘优化 IMPLEMENTATION 终轮复核后的证据订正。

背景：你指出上一版把 TR-16 Web→设备证据写成已完成，但当前 Web 记录、设备执行顺序、IA-19 分组和 Android/cleanup 口径并未全部闭合。本轮已保留源码修复，只订正证据与计划口径。逐场景正本是 doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/tr16-final-rereview-20260924.md；总对账正本是 doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md 的 §9。作者状态为 OPEN_DYNAMIC_EVIDENCE，不宣称整体 GO。

目标：请核验当前字节的 Web→设备先后和逐场景对照，IA-19 是否已移为双屏设备专属，wallpaper 登录前置缺失是否标 OPEN，历史双屏重复登录失败和 cleanup 中间失败是否如实保留，以及 N-1 的 consoleAssembly.renderContentFrame 原样回退是否有 focused 用例能真实变红。

请从 catering-v2s 仓库根阅读：
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/tr16-final-rereview-20260924.md；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization-static-rereview-reconciliation-codex.md；
- doc/plans/platform/2026-09-23-ter-virtual-keyboard-optimization-implementation-plan-codex.md，重点看 §6.1；
- apps/terminal/ui/base/console-assembly/test/terminalSurfaces.test.ts；
- apps/terminal/ui/base/console-assembly/src 与 apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/web/final-rereview-20260924/；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-terminal/run-manifest.json；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-final-wallpaper/run-manifest.json；
- doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android/tervk-20260924-cp4-final01/events.jsonl。

独立核验重点：Web 时间早于对应设备 run；VK-WEB-01 的十符号字段值可见；VK-WEB-03..05 没有被写成已闭合；IA-19 不再挂在 Web 滚动场景；wallpaper 已认证 picker 与未认证 login 的前置差异写成 OPEN；11:50:33Z 双屏重复输入、11:56:36.797Z cleanup 中间失败和 11:59:54.267Z 最终 PASS 均可追溯；当前两个独立设备 run 的 cleanup PASS 与 business=NOT_RUN/visual=OPEN 分档一致；N-1 的真实装配回退会使 focused 用例首次失败。

请按 REVIEW_TARGET=IMPLEMENTATION、VERDICT=GO|NO-GO|GO_WITH_OPEN_EVIDENCE、M/S/N=x/y/z 回复，逐条给出路径、行号、证据和下一步。不要把截图存在、focused、harness 或手工体验升级为视觉或业务通过。

授权边界：只复核既有 TER 虚拟键盘优化、两个 Expo Web integration、已授权单机双屏/mobile 设备证据和本轮文档/测试订正；不扩大功能，不改业务/登录/keyboard 语义，不新增依赖，不涉及其它虚拟机、真机、双机拓扑或 Git 操作。谢谢。
```
