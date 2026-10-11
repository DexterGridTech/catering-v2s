# TER 应用内远程控制外部静态复评交接

REVIEW_TARGET=DESIGN
REVIEW_STATUS=READY_FOR_DEXTER_CLAUDE_REVIEW
IMPLEMENTATION_AUTHORITY=false

## 背景
原外部NO-GO 0M/1S/2N对应旧字节；作者已修订六工件。Dexter追加确认三态，正式需求R-01/R-02/R-20、详设、计划与话术已同步，当前处置与SHA见external-review-intake。当前字节无独立verdict，本次按Dexter明确指派交另一Claude静态复评。

## 评审目标
独立核验三项修法及同根路径，判断真实任务、最小方案与需求差异，不继承作者结论。

## 需阅读文件
以下话术逐一列明现行需求、六工件、原外部报告与作者intake；当前SHA见intake §5。

## 独立核验重点
在线三态及固定身份保护；隔离L2与DEV父run浏览器归属；各端cleanup观察边界；三态正本与六工件的一致性。精确source与章节见下方话术。

## 期望结论
明确GO/NO-GO与M/S/N；静态无阻断但UI未验证时GO_WITH_UNVERIFIED_UI。finding包含精确路径/行号、事实/推论、影响、最小修正及Dexter裁决，并列CLOSED/PARTIALLY/OPEN。

## 可直接复制给 Claude 的话术
```text
Dexter 转交：

您好 Claude，烦请对《TER 应用内远程控制》修订后的完整设计包做一次外部独立静态复评。

背景：
上一轮外部结论为 NO-GO，M/S/N=0/1/2。作者重开需求、DDL、CBS 在线投递及现有 runner 后，确认 S-1、N-1，部分确认 N-2，并最小修订六份设计工件。作者处置不是独立 verdict；旧结论只对应旧字节。内部两轮 DESIGN cycle 已关闭，本次不重开，也不构成第三轮内部审查。只考虑90%的常见主流程，避免为了极端情况增加机制。
Dexter已明确裁决：“同意同步正式需求，删除‘状态待确认’，统一为未激活、离线、在线三态。”正式需求R-01、R-02、R-20、详设及计划已经同步。该裁决只确认三态和文档同步，不代表设计独立GO或实施授权。

评审目标：
请以当前需求、裁决、规范及真实源码独立判断三项修订是否正确、是否引入同根矛盾，以及方案能否简单地解决“管理员看到并通过原控件协助操作终端”的任务。不继承作者 disposition 或旧 verdict。

【仓根材料】
- doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md：现行需求，重点 R-01、R-02、R-17、R-20。
- doc/decisions/2026-10-10-ter-remote-control-journey-claude.md：用户任务与前提链。
- doc/decisions/2026-10-10-ter-remote-control-ia-claude.md：入口、权限与观察边界。
- doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md：线框、三态文案、清理反馈。
- doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md：重点 §0、§6.3、§8.7、§9a、§10b.3。
- doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md：重点进入条件、CP-02、CP-04、CP-05与动态顺序。
- doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md：重点 §3a、§4b、§6、§7。
- doc/review/platform/2026-10-10-ter-remote-control-design-external-review-claude.md：原始三项 finding。
- doc/review/platform/2026-10-10-ter-remote-control-design-external-review-intake-codex.md：作者处置、需求文本差异及当前七文件 SHA，仅作定位。
请按 AGENTS.md、CLAUDE.md 恢复规范及适用项目记忆；先重开需求、当前设计与 owning source形成判断，再对照历史评审和 intake。

【独立核验重点】
1. S-1：latest_state 没有 deviceId/binding generation。三态是否准确复用 ACTIVE binding＋同 scope 未断 session；列表、详情、start、错误闭集、文案与合法 fixture 是否一致；是否保留 claim/register/renew 的固定身份保护与旧 PG 暂在线的限制。核查 CBS migration V20260926_000000_000__terminal_binding_owner.sql、V20261004_020000_000__terminal_control_online_operations.sql，以及 modules/terminal-control 下 TerminalControlPersistence、TerminalControlOwnerService。
2. N-1：隔离后台 L2 使用 browser-l2 runtime；DEV/设备主 run 由 terminal-automation 父 run 通过 Playwright拥有并回收 browser/context，只借用 DEV Vite/tunnel。核查 tools/terminal-automation/journeys/terminalUpdateSupplyUi.ts；避免嵌套启动隔离后端或回收借用服务。
3. N-2：后台释放失败仅指浏览器本地 Room/track；TER capture/track/Window 清理通过本机 selectRemoteControlStatus.cleanup 与结构化日志供 automation观察。是否无需新 report字段、ENDED后上报或额外清理框架；CBS ENDED不得冒充资源释放成功。
4. 正式需求R-01/R-02/R-20与六工件的三态、禁用条件、HTTP错误及fixture是否完全一致，是否还残留旧状态或待裁决措辞。同步删除旧状态不能削弱绑定/投递身份复核。同时检查相邻条款、owner/command/selector、现有foundation及runner复用，避免增加机制或职责越界。

【结论与证据边界】
请给明确 GO 或 NO-GO 与 M/S/N；已知阻断关闭、只剩未验证 UI 时按规范使用 GO_WITH_UNVERIFIED_UI。每项 finding列精确仓根相对路径/行号、事实或推论、影响、最小可验收修正及是否需 Dexter裁决；附三项 CLOSED/PARTIALLY/OPEN表，并单列方案合理性、DESIGN_GAPS及未验证项。
当前只有静态文档和源码读回。三个交互面看图 UNSET；T-01～T-04、原生帧导入 RN WebRTC公开桥及阶段 C最终出口仍 OPEN。全部新实现、依赖解析、生成、编译、测试、verify、Web、设备、DEV、seed与cleanup均 NOT_RUN，不将计划或历史结果写成当前 PASS。

授权边界：
本次仅为外部静态设计复评。允许必要的纯读取命令；不授权修改需求、设计、规范、记忆、源码或依赖，不授权任何动态验证、构建、verify、DEV、reset/seed、Web/设备、L2、UAT或部署。不读取 .runtime/，不打扰 Codex在途阶段 C。评审结论不自动授权实施或进一步改变产品语义。谢谢。
```
