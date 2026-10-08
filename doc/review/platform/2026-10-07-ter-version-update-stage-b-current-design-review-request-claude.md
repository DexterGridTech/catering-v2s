# TER 阶段 B 当前设计包 · 外部 Claude 评审请求

REVIEW_TARGET=DESIGN
REVIEW_KIND=EXTERNAL_CLAUDE_VIA_DEXTER
INTERNAL_CYCLE_STATE=CLOSED_NOT_REOPENED
CURRENT_VERDICT=NOT_ISSUED
IMPLEMENTATION_AUTHORITY=false

## 背景

Dexter 六项裁决、每任务一条报告与启用范围更正已进入当前六份设计文档。旧 NO-GO 与处置记录只用于定位，不继承。

## 评审目标

核验完整方案的需求忠实性、简单性、owner/失败闭包、UI标准复用与实施/验收可达性。

## 需阅读文件

以下复制话术列出完整仓根输入；当前摘要在 `doc/review/platform/2026-10-07-ter-version-update-stage-b-dexter-decision-revision-intake-claude.md` §4。准备请求时已读回摘要匹配当前七份文件，非运行证明。

## 独立核验重点

启用资格、CBS HTTP 每任务报告、state pending 与 PONG 广播、标准审计与保存 gate、生成/权限/预算、模板/测试/seed/CP顺序及只读边界，见下方八项。

## 期望结论

独立 GO/NO-GO 与 M/S/N；仅适用 UI 未验证时按规范 GO_WITH_UNVERIFIED_UI；逐 finding 精确定位、证据与反例、影响、最小修正、Dexter决定，另列方案合理性/TEMPLATE_COVERAGE/DESIGN_GAPS/未验证项。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 B 当前完整设计包做一次外部独立静态评审。

背景：此前外部评审为 NO-GO，0M/3S/8N，对应旧字节。Dexter 随后明确了六项产品裁决，并确认每个更新任务一条报告，最终更正查询范围为“仅包含启用”。作者已修订六份设计文档及 intake；当前字节尚无独立 verdict。内部 DESIGN cycle 已关闭，本次是 Dexter 转交的外部评审，不重开该 cycle，不要求追加内部轮次。
目标：先依据需求、Dexter 最新裁决与真实 owning source 独立推导预期，再读历史评审/intake；判断当前完整方案是否简单、正确、可实施、可验收，并主动寻找同根反例。不要将作者处置当成独立证明。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；project-memory/index.md 全部 kernel、deterministic-context-only 及六维命中原文。
- doc/platform/review-standard.md、doc/platform/implementation-task-template.md、doc/platform/frontend-coding-standard.md、doc/platform/backend-coding-standard.md、doc/platform/terminal-coding-standard.md、doc/platform/third-party-library-usage-standard.md，以及 Journey/IA/UI/implementation-design 四份模板。
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：需求正本，只读；与新裁决有差异时明确指出交接义务。
- doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md：原话与早期裁决。
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-journey-claude.md
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ia-claude.md
- doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-source-and-api-appendix-claude.md
- 形成独立判断后，再读 doc/review/platform/2026-10-07-ter-version-update-stage-b-design-review-claude.md、doc/review/platform/2026-10-07-ter-version-update-stage-b-external-design-review-intake-claude.md、doc/review/platform/2026-10-07-ter-version-update-stage-b-dexter-decision-revision-intake-claude.md；最后一份含当前 SHA-256。旧 intake 只代表旧处置截面。
- 按引用重开 apps/terminal/kernel/base/terminal-update/、terminal-data-client/、runtime/，两个 integration；CBS 的 audit-model/audit-read、terminal-binding 及相关现有 owner；operations-admin 标准审计 Modal、libraries/frontend/admin-ui-foundation、生成与验收 runner 源码。只看源码，不读取 .runtime/。

Dexter 最新裁决，请作为本轮直接输入：
1. 运维后台仅维护更新包；运营项目内容页左 Tab 为规则，右 Tab 为终端更新状态。右 Tab 查询当前项目启用门店下的启用终端，可按门店、当前版本筛选；列为门店名、终端名、版本、最新报告状态，标准 Drawer 显示最新及历史报告。“包含启用和停用”已被更正，不再适用。
2. 每个更新任务一条 CBS 数据库报告，阶段变化更新同一条；历次任务保留，心跳/重送不新增历史。
3. 上传和解析成功后才可“保存”，不叫“登记”。
4. 报告用 CBS HTTP；失败内容缓存到业务 owner state。TDP ping/pong 用广播 command 作重试时机，其他 actor 重试自己的未发送内容，形成标准机制。
5. N/M 使用分钟；运维界面保留技术细节。
6. 规则操作历史接入标准审计。所有查询、列表、分页、详情/编辑 Drawer 等复用标准能力，不自造容器。

请重点独立核验：
1. page/detail/history 的启用资格一致，单侧停用/作废反例、NO_REPORT、历史保留与页面入口区分；按实际版本过滤，不以 target 替代 actual。
2. HTTP report 的 credential owner、事务/幂等/乱序/最新选择、每任务 UPSERT 和分页历史；无任务观察是否与任务历史明确分开，是否引入不必要结构。
3. pending 持久化、同任务更新、不同任务保留、匹配 receipt 清理、响应丢失、flush 失败、重启及旧绑定/配置迟到回包是否闭合；不承诺不可写时仍能落盘。
4. 将合法匹配 PONG 作为一次广播时机是否忠实且可实现；Runtime 多 actor 分发、timeout 不取消 IO、single-flight 与业务失败隔离；广播不得破坏 transport 存活，不引入轮询、中央失败存储或报告触发重连。
5. 两内容页与附属交互、标准审计权限/实体闭集/真实 caller、保存 gate、技术中文字典、分钟换算及候审上限是否合理；各模板逐节核对，报告 TEMPLATE_COVERAGE。
6. 18 项 HTTP 的 canonical→materialize→codegen→consumer 链、授权/错误集/预算；检查新报告 operation 是否有设计缺口被不当地推迟到 CP-01。
7. CP 顺序、A 最终交接、测试源码/seed/fixture/脚本与清理计划是否可执行；L2 有报告 fixture 改为本 run 合法激活加 CBS HTTP，不再为报告新增 TDS；TER 只用最新 automation-agent，非 adapter 行为 Web 先于 Android。
8. 正式需求 R-15、终端规范及项目记忆的后续同步是否明确且不冒充已修改；不重复核验未受影响且已完成的 A 对账，但本次新增影响不能豁免。

烦请给出明确 GO 或 NO-GO 与 M/S/N；若仅剩适用的 UI 未验证，按 review-standard 给出 GO_WITH_UNVERIFIED_UI。每条 finding 写精确文件/章节/行号、仓内事实或推论、触发反例、影响、最小可验收修正及是否需要 Dexter 裁决；单列方案合理性、TEMPLATE_COVERAGE、DESIGN_GAPS、已核实及未验证项。请披露会话是否 fresh。

证据边界：本批目前只有文档与静态源码读回；A 最终交接仍 OPEN，阶段 B 的生成、编译、测试、verify、HTTP/L2、DEV、Web/Android、seed 与 cleanup 全为 NOT_RUN，不得把计划或历史运行称为当前 PASS。
授权边界：只做阶段 B 完整设计包的独立静态评审，可使用纯读取命令；只允许在 doc/review/platform/ 下写一份以 -claude 结尾的评审交付物。其余文件只读，不授权需求/规范/记忆修订、源码实施、依赖、生成、构建、测试、verify、DEV、设备、reset/seed、L2、UAT、部署或阶段 C。谢谢。
```
