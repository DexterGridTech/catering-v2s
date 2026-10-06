# 阶段 A 外部设计差量复核交接

## 背景

外部原审阅字节为 NO-GO，0M/3S/5N。作者已逐项重开需求、源码及官方依据，并修订六份设计工件；处置和完整新旧 SHA256 见本轮 intake。历史 verdict 不变，当前字节尚无独立 verdict。本次外部差量复核不重开已关闭的内部 DESIGN cycle。

## 评审目标

独立确认 APK 身份复位、已结束安装会话出口、embedded/HOT 资源路径、精确 TR-09 决定及测试装配/自动化边界是否最小、一致、可验收。

## 需阅读文件

话术列出六份当前工件、只读原始需求、来源评审与作者 intake；精确静态源码/API 位置在附件§4。当前工件以 intake 的完整 SHA256 为输入锚点，不采用旧 verdict 替代判断。

## 独立核验重点

详设§0、§8.1/8.2/8.4/8.6/8.7、§9a、§11a 新反例、§12；计划§0、CP-02/03及同根 CP-04/05；UI L142；附件 L35及§4；Journey/IA 的等待、入口与裁决同步。N-4 官方组织名的怀疑已核实存在重定向，不将原链接描述为失效。

## 期望结论

明确 GO 或 NO-GO 与 M/S/N；已知阻断关闭且只剩 UI 未验证时，按规范给 GO_WITH_UNVERIFIED_UI。每项附当前文件/行号、事实/推论、影响、最小修正及是否需 Dexter。作者 CLOSED 是文档处置，工程 OPEN/NOT_RUN 保留。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 A 修订设计包做外部差量复核。

背景：上一轮外部评审为 NO-GO，0M/3S/5N。作者逐条重开需求、owning source 和官方依据，已完成八项文档处置，完整新旧 SHA256 与当前位置见 intake；这不是独立 GO。Dexter 已批准仅 TERMINAL_ACTIVATION_CANCELLED 根级清除的 TR-09 精确例外，规范正本尚未修改，须未来实施授权下在 CP-02 前落地。内部 DESIGN cycle 已关闭，本次不重开，也不增加第三轮。
目标：独立判断三项 S 与五项 N 是否最小、准确闭合，主动查找同根反例；不继承作者 CLOSED 或旧 verdict。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：只读需求及 A/B/C 边界；
- doc/review/platform/2026-10-06-ter-version-update-stage-a-design-review-claude.md：来源评审与裁决；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md：当前详设；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md：当前计划；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-source-and-api-appendix-claude.md：官方依据及当前源码锚点；
- doc/decisions/2026-10-06-ter-local-update-journey-claude.md、doc/decisions/2026-10-06-ter-local-update-ia-claude.md、doc/decisions/2026-10-06-ter-local-update-ui-interaction-claude.md：同步工件；
- doc/review/platform/2026-10-06-ter-version-update-stage-a-external-review-intake-claude.md：作者处置、精确行号与六份当前 SHA256，请独立形成判断后对照；
- AGENTS.md、CLAUDE.md、doc/platform/review-standard.md、doc/platform/terminal-coding-standard.md、doc/platform/implementation-task-template.md、doc/platform/third-party-library-usage-standard.md；附件§4引用的 Expo/RN、TDC/topology 与 automation R-10 原文。

请重点核验：
1. 详设§8.4/8.7：selection、previous、candidate 是否绑定已安装 APK；同 runtime FULL 与外部高版本 APK 是否复位到新 embedded，旧 boot 不可确认；readback 和§11a两反例是否闭合。
2. §8.6/8.7 installer 表：成功读回确认 session 消失且未安装是否 ENDED_NOT_INSTALLED→WAITING_USER；新 action/session 邀请与旧 commit/回调隔离；BUSY_UNKNOWN 是否有出口，查询失败是否仍 UNKNOWN，是否保持无手工重试。
3. §8.1/8.2：embedded assets://+res，HOT/文件型恢复 file，构建签名 metadata 身份；F-LOAD 是否分别证明图片/字体离线，缺 HOT 不隐式回默认 assets。
4. §0/9a/12及计划 CP-02：TR-09 已批准但待规范同步，触发仅取消激活；角色切换只是 flush+reload。Web 生产 unavailable，fixture 仅 automation-enabled 测试构建且有 production red。
5. UI L142、详设§3a/9a.2与计划 CP-05：三类非 React 界面仅走最新 driver 窄例外，失败文本只读，React 仍 agent；附件 L35 官方精确 tag 与重定向事实准确。
6. 可选一次性 F-LOAD 探针是否仅未来单独授权、用后移除、不进入产品路径、不替代 CP-03；CP 顺序、同根 Journey/IA 与 NOT_RUN 是否一致。

请给明确 GO 或 NO-GO 与 M/S/N；已知阻断关闭、只剩 UI 未验证时给 GO_WITH_UNVERIFIED_UI。finding 请列当前路径/精确行号、事实或推论、影响、最小修正和是否需 Dexter 裁决，并分列方案合理性、已核实与未验证项。

授权边界：仅静态差量复核阶段 A 文档及指定源码/API；不授权实施、改需求/规范/记忆、依赖安装、生成、编译、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT、部署或 B/C。UI 看图仍 UNSET，所有新能力、运行与 cleanup 均 NOT_RUN。谢谢。
```
