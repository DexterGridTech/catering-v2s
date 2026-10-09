# TER 更新阶段 C：外部 Claude 设计评审交接

REVIEW_STATUS=READY_FOR_EXTERNAL_REVIEW
REVIEW_TARGET=DESIGN
INDEPENDENT_CURRENT_VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
IMPLEMENTATION_AUTHORITY=false
DYNAMIC=NOT_RUN

## 背景

Dexter已确认IA与当前低保真邀请内容，并明确追加两轮对抗性review。同一cycle的R3独立NO-GO 0M/1S/0N只对应修订前SHA；唯一S是C后台浏览器入口/所有权与B现行供给链冲突。主agent亲验后最小修改C详设、计划和附件，未改B/source。新fresh R4对当前六份冻结字节独立封口GO_WITH_UNVERIFIED_UI 0M/0S/0N。R4先独立形成结论，再对照历史；不是作者自评，也不授权实施。

原R1/R2报告与作者处置保留历史；Dexter明确授权在同cycle追加R3/R4（limit=4），没有重命名cycle。R4后停止，不自行召第五轮。六文中的PENDING_R3_R4为冻结时输入状态，当前审查结果以绑定相同六SHA的R4报告为准；R4报告区分盲审原SHA与封口后§0.1规则时间来源单行纠正的最终SHA，已由同reviewer亲读确认；不新开第五轮。其余五文不变，全部产品/执行判据未变。

仅做常见主流程；不同sample App不得配对，只同App不同机器/版本。正式需求R-07旧不同App句由Dexter直接裁决覆盖，需求只读。IA内容接受不等于真实UI通过；A/B仍在途，相关最终出口/接口仍OPEN，C全部实现与运行NOT_RUN。

## 评审目标

请独立判断C能否简单、正确地闭合自动择新、FULL→HOT跨启动、N/M、本机点击、同App主副独立升级和MAIN HTTP报告。重开需求、模板、当前源码，检查CP/fixture/供给链/cleanup是否可实施，不继承R4或作者intake。

## 需阅读文件

- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md：需求；讨论稿2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md：原话裁决。
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md：A固定执行核；B三工件前缀2026-10-07-ter-version-update-stage-b-：当前供给、报告、同DEV父运行接缝，仍不是B验收证明。
- doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md、ia-claude.md、ui-interaction-claude.md：完整任务/IA/交互包（同前缀）。
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md、implementation-plan-claude.md、source-and-api-appendix-claude.md：完整实施设计包（同前缀）。
- doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md；同前缀design-review-r3-codex.md、design-review-r4-codex.md、design-review-intake-claude.md：范围、冻结结论和作者处置，先独立判断后对照。
- AGENTS、CLAUDE、Blueprint、平台/脚本README、全部kernel/deterministic与适用六维原文、四模板及实施/终端/前端/第三方/review规范；当前owning source由附件§2定位，不读取.runtime。

## 独立核验重点

1. S1 FULL→S2 HOT→S3确认旧结果可择新，executionBootId与纯确认分离，不建第二任务账本。
2. 同App/protocol门；规则投影和本机task/actual/click隔离；VICE逻辑屏与物理PRIMARY、本机邀请/admin及断链业务保护。
3. FULL单APK ZIP/HOT清单分源，有界compact peer≤65,536字节，真实摘要/签名复用，不传files或credential、不扩协议。
4. known pending-user按N恢复精确session而零commit，安装中不重复，UNKNOWN仅回读；M只按本机点击，单timer和原command/selector。
5. B§15.2a唯一terminal-automation update.supply-chain同父run：后台Playwright/helper、TER agent、系统driver窄例外；新browser/设备owned，DEV Vite/tunnel borrowed；C不新建runner，当前Android注册不冒称C Web/pair完成。
6. CP顺序、全批6b、动态前准入、Web非adapter先于设备同场景、13c、账号/PROJECT权限/seed、适用动态及cleanup；A/B最终交接OPEN，不用假fixture代替自动eval。
7. 不为极端归档/容量/跨App增加机制，不重跑无影响旧proof；普通主流程的真实设计冲突仍应报告。

## 期望结论

独立GO或NO-GO及M/S/N；无阻断但真实UI未知时按规范GO_WITH_UNVERIFIED_UI。每finding含精确文件/行号、性质、证据/反例、影响、最小修正和Dexter裁决；列方案合理性、四模板覆盖、DESIGN_GAPS、静态事实和未验证。计划与历史不得升级为当前PASS。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审《TER 版本定义、完整更新与热更新》阶段 C 完整设计包。

背景：Dexter已确认IA及低保真邀请内容，并明确追加两轮。R3为NO-GO，0M/1S/0N；唯一S是后台入口/资源归属与B现行供给链冲突。主agent亲验并最小修订后，新fresh R4对当前六份字节给出GO_WITH_UNVERIFIED_UI，0M/0S/0N。旧verdict只对应旧SHA，请独立判断。本cycle按Dexter授权扩至R4并关闭，不重开或追加内部轮次。

目标：核验自动择新、FULL→HOT跨启动、N/M、本机点击、同App主副独立升级、MAIN HTTP报告，以及完整CP/fixture/供给链和cleanup是否简单、可实施、可验收。

请从catering-v2s仓根阅读：
- doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md；
- doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md；
- doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md和同前缀implementation-plan-claude.md；
- doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-journey-claude.md、同前缀ia-claude.md、ui-interaction-claude.md；
- doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md、同前缀implementation-plan-claude.md、source-and-api-appendix-claude.md；
- doc/review/platform/2026-10-09-ter-version-update-stage-c-design-review-input-claude.md、同前缀design-review-r3-codex.md、design-review-r4-codex.md、design-review-intake-claude.md。
先读需求、裁决、规范、当前设计及附件指向的真实源码，独立形成判断后再对照历史报告与intake。

请重点核验：S3纯确认不占本boot执行名额；FULL单APK与HOT清单分源；known pending-user恢复同session零commit；本机PRIMARY邀请/admin及规则投影/本地task隔离；B既有terminal-automation update.supply-chain同父run的Playwright/TER agent职责、owned browser/设备与borrowed DEV Vite/tunnel；CP→6b→Web→同场景设备→13c顺序和合法PROJECT权限/seed/cleanup。

两个样本App不能配对，仅同App不同机器/版本独立升级。只覆盖常见主流程，不新增极端归档、协议扩容或恢复框架。IA内容已确认，真实UI、全部C实现/生成/编译/测试/verify/Web/设备/DEV/cleanup均NOT_RUN；A/B最终出口仍OPEN，不把计划或静态事实写成PASS。

烦请给出独立GO/NO-GO与M/S/N；只剩真实UI未验证时给GO_WITH_UNVERIFIED_UI。每条附精确路径/行号、事实或推论、反例、影响、最小修正及是否需Dexter裁决，并列方案合理性、模板覆盖、DESIGN_GAPS和未验证项。

授权边界：仅静态评审C设计包，不授权修改需求/规范/记忆/源码/依赖，不授权实施、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT或部署；不读取.runtime，不要求重跑无影响旧验证。谢谢。
```

## 当前交付 SHA-256

| 文件 | SHA-256 |
| --- | --- |
| Journey | 0ed55be74354f05bcbae9ae5691f368822c017b98bfb7f585b12c635cd55ad05 |
| IA | 167c08d0752028513a836a453ddbeae721e34862983865357b36665fb8ae360b |
| UI | 115ab84603d6f628aceecde16a61de114ad12aad9cf70d970cc682e06cc5b4ef |
| 详设 | 15f790d1901a06f28e3e1a5e4cadb223bd0e203996b167332740fd1056a19fe1 |
| 计划 | 09674c2a8359263c17b65b1e7a6c9e1ed3a642f5df28051af541c95dda3597f6 |
| 附件 | 90260a49a8290533f14fa0d5c18d120333beccc23a2add06fae85498d62dfb7e |
