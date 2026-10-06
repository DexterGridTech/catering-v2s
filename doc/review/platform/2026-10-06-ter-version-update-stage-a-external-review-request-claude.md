# 阶段 A 外部设计评审交接

## 背景
Dexter仅授权代写阶段A设计文档；automation-agent在途任务不被本包改变。内审当前字节/轮次状态以intake为准。

## 评审目标
独立判断版本/产物、最终owner、native执行与保护、跨启动、资源、模板和验收闭包。

## 需阅读文件
正文话术列出仓根相对路径；详设§9a提供源码入口。需求与讨论正本保持只读。

## 独立核验重点
正文七项；官方源码支持接口，实际工程、设备、数据兼容和UI仍未验证。

## 期望结论
GO或NO-GO与M/S/N；UI未验证按规范保留GO_WITH_UNVERIFIED_UI。finding附位置、事实、影响、最小修正、Dexter裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《TER 版本定义、完整更新与热更新》阶段 A 设计包。

背景：Dexter 委托本会话代写阶段 A 详设与实施计划，只授权文档。Codex 的 automation-agent 仍在验收收尾；本包依其当前源码规划唯一自动化入口，没有干扰该任务。内部 DESIGN cycle 已硬停止：R1 为 NO-GO 3M/2S/1N，R2 冻结字节为 NO-GO 0M/1S/0N。R2 唯一问题是 root reset 保留更新任务与现行 TR-09 冲突；作者已将精确规范修订写成待 Dexter 批准、CP-02 前必须落地的前置，本轮没有修改规范。另澄清 CP-06 阶段出口顺序、源码简称和下载/取消预算口径。修订后字节尚无独立 GO；记录见 intake；请以当前文档重新判断，不继承作者处置或旧字节 verdict。此次外部评审不重开内部 cycle。
目标：核验 A 的三类产物、四版本、最终本机 owner、Android loader/installer、启动保护与跨启动 FULL→HOT 是否简单、可实施、可验收，并确认 CP 依赖和测试计划闭合。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md，以及 project-memory/index.md 全部 kernel、deterministic-context-only 和六维命中原文；
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：原始需求，重点 §20 的 A/B/C 边界；
- doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md：Dexter 原话与裁决；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md：详设；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md：实施计划；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md：当前源码与精确版本官方依据；
- doc/decisions/2026-10-06-ter-local-update-journey-claude.md、doc/decisions/2026-10-06-ter-local-update-ia-claude.md、doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md：Journey、IA、交互候选；
- doc/platform/implementation-task-template.md、doc/platform/review-standard.md、doc/platform/terminal-coding-standard.md、doc/platform/third-party-library-usage-standard.md 与四份 design templates；
- doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-intake-codex.md 及其 R1/R2 引用：请形成独立判断后再对照；
- 详设 §9a 引用的 platform-ports/runtime/state/application/integration/automation 当前源码，以及安装的 Expo/RN 公开 Host 接缝。

请重点独立核验：
1. 是否安排最终 owner/Web 先行，并在原生保护接线完成后才首次真实 HOT；计划不存在 direct-port 测试后门。
2. 每次冷启/reload 的不可变 ReactContext boot 身份、三个已有 reset 通路、PRIMARY/hydration 确认、旧结果拒绝及一次获准恢复。
3. installer action/session 的创建、持久化、commit、callback 崩溃窗口；取消仍等待，UNKNOWN 不重提交、不清仍需文件，无手工重试。
4. 同发布树的 HBC/图片/字体、FULL 中间旧 embedded 与 HOT 回退的数据兼容；四版本、actual readback、签名/最低 FULL 与来源 provider 的唯一住址。
5. 当前 automation driver 扩展、同 run 包名/签名/storage、DEV 特定子断言、Web→Android 同场景及两 App/mobile/单机双屏；系统安装/权限 UI 仅用最新 driver 内获准的窄例外，禁止旧 runner。
6. CP 顺序、各 CP 退出与全批 6b/整体验收不循环；已有效对账的未受影响内容不重复，实际修改仍作差量。
7. TR-09 规范前置是否足够有限，是否忠实满足固定任务/失败身份而没有第二存储；模板覆盖、资源预算、工程 OPEN、UI UNSET 和 NOT_RUN 标注；不把官方 API 依据、静态文档或计划当成动态 PASS。

烦请给出明确 GO 或 NO-GO 与 M/S/N；若无已知阻断、只剩 UI 未验证，按 review-standard 给 GO_WITH_UNVERIFIED_UI。每条 finding 请列当前路径与精确行号、事实或推论、影响、最小修正及是否需 Dexter 裁决；另列方案合理性、DESIGN_GAPS、已核实和未验证项。

授权边界：本次仅评阶段 A 文档和指定静态源码/API 输入，不授权实施、改需求/规范、依赖安装、生成、编译、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT、部署或 B/C。UI 看图未接受，所有新能力和运行/cleanup 仍为 NOT_RUN。谢谢。
```
