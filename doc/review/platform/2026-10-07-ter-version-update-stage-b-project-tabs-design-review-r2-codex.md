# 阶段 B 项目双Tab：fresh独立 DESIGN R2 原始结果归档

REVIEW_CYCLE_ID=ter-version-update-stage-b-project-tabs-20261007
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEWER=/root/stage_b_project_tabs_design_r2
VERDICT=NO-GO
M/S/N=2/2/0
ACTION_1_VARIANT=1-B 文档提取
EVIDENCE_TIER=STATIC_CURRENT_BYTES
INPUT_LIST=doc/review/platform/2026-10-07-ter-version-update-stage-b-project-tabs-design-review-r2-input-claude.md

主agent唯一写入本文件，保留子agent完整会话返回作为原始来源；这里是结构化摘录，不冒充逐字全文。先SOURCE_FIRST/BLIND读取原需求、规范、记忆与owning source，再全文读六工件形成四项原始finding，最后读R1/intake。无写入/测试/生成/构建/verify/.runtime/环境操作。R2已完成并硬停止，不召集第三轮。以下位置均为冻结审阅字节，主agent其后修订不覆盖原verdict。

## 1 · 冻结摘要

| 工件 | SHA-256 |
| --- | --- |
| Journey | b3d3bb6523684a53504792546cb05da2412f9678da60fb062239cfee0ddbb8c7 |
| IA | faca9c1d85eab76ffa0f1103b5bf0d78d03944d8980983ae4d200da682668363 |
| UI | ae24877be3e0644e58be02a8edcf174f4e8988292d6a227338b263a8aa4ceb97 |
| 详设 | fe9fa9eb03a678d29bb5a896de6e02267d840375a39081468246ca8c8becd08e |
| 计划 | 059ce673eaf88004ed771821790d60d5fd2202abd445c968675f5a1978c20c0a |
| 附件 | eb74443e58c2f532e5ca8c2ca0293687b046a35caeeefed47a66f4954731ce96 |

## 2 · 四项独立finding

D=doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md；A=同目录source-and-api-appendix-claude.md。

### M1 · operation完整计数口径错误

仓内事实：A:202明确只算JDBC statement并排除BEGIN/COMMIT；204–221只有R/W/锁总数。主动规范project-memory/decisions/http-crud-efficiency-design-redlines.md:204–214要求具名normal fixture的request-local databaseOperationCount；foundation CountingDataSource.java:72–78记录CONNECTION，109–115记录TRANSACTION。register即使15次SQL成立，单连接REQUIRED还会计借连接/开始/提交。影响：预算和验收使用不同分母；CP01后核数字不能消除当前口径错。最小修正：SQL作为诊断列，全部16项另列CONNECTION/TRANSACTION/SQL/batch及完整计数，绑定normal fixture/事务origin，不删除正确业务事实。无需Dexter产品决策。

### M2 · handler所在层反向依赖与事务原点冲突

仓内事实：A:227全部handler在modules/terminal-update/application；235要求其调用app edge OperationsSessionResolver及EdgeRequestContext。该resolver真实app/edge/operations/session/OperationsSessionResolver.java:1–16；app build.gradle.kts:61–78是app依赖modules。当前app源码catalog/application/operations/CreateOperationsCatalogItemOperation.java是可复用REQUIRED编排模式。D横切表仍“edge REQUIRED”，与附件“edge禁止@Transactional”冲突。影响：实现需擅自选依赖/事务原点。最小修正：app application operation承接raw credential，在REQUIRED内当前command事实，再调用owner API；module不引用app-edge。同步全部caller/计数假设，无新恢复框架。无需Dexter产品决策。

### S1 · 受管验收argv缺必需--operation

仓内事实：D:366写backend-acceptance registerPlatformTerminalUpdateArtifact及backend-acceptance all；scripts/test/backend-acceptance:7–10否则exit2。分别加--operation，保留新operation待生成和NOT_RUN。不是缺运行evidence。无需Dexter产品决策。

### S2 · 每variant遗漏context输入唯一来源

仓内事实：A:196/214把expectedContextVersion required；302–327两create variant没有独立fact行，仅幂等key提到；332/338又把project/context合行。UI模板267–283要求每fact唯一来源/生命周期。key含version不等于requestbody来源当前有效。最小修正：两create各补H行，指明当前operations context来源、epoch/context失效、owner复核；enable/disable分projectRef与expectedContextVersion。无新增可见表单字段。无需Dexter产品决策。

## 3 · R1定向关闭表

| 原项 | 独立R2判断 |
| --- | --- |
| M1 binary/JSON | CLOSED_STATIC：JSON snapshot/grant与binary descriptor/native bytes分开 |
| M2 operation合同/事务 | PARTIALLY_CLOSED：本轮M1/M2 |
| M3 首次L2/fullseed门 | CLOSED_STATIC：CP/全批6b、UI/control准入、current seed dry-run明确 |
| S1 CP RECALL | CLOSED_STATIC：六CP原文/source/观察/禁止项 |
| S2 PROJECT/TITLE报告 | CLOSED_STATIC：PROJECT、NO_REPORT、TITLE source明确 |
| S3 input/variant/fact | PARTIALLY_CLOSED：本轮S2 |
| S4 同步/caller/V/seed | PARTIALLY_CLOSED：caller本轮M2 |

## 4 · 方案合理性、模板与未验证

独立reviewer判断主方向合理：真实版本报告、工件供应与规则维护闭包，复用asset/TDP/foundation，A真实FULL/HOT能力明确为依赖门，没有提前扩展C自动/主副行为。两内容页/两个route、内部Tab/Drawer/Modal、权限/搜索/hidden事实/全链同步/CP顺序/全批6b/UI-TestId先行/Web→Android同清单/IMPLEMENTATION交付review有实质槽位；不以作者覆盖表作证明。四项为剩余具体DESIGN_GAPS，无新增产品决策。

L1_ENGINEERING=OPEN（四项）；L2_USER_VISIBLE=设计内容核查、真实UI未验证；L3_UNVERIFIED=OPEN。真机安装、工具实际可用、运行SQL数字、seed dry-run、L2行为、cleanup保持PLANNED/NOT_RUN，不作为静态缺陷。六工件全文读取；大型source仅相关方法/边界/调用者，不声称无关段落全审。当前R2原verdict不因作者修复升级GO；作者SELF_DECIDED及最终字节见intake，外部复核由Dexter转交。
