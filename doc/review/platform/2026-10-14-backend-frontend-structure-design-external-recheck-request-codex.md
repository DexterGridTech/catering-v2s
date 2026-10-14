# 前后台结构优化：Route A 外部差量复核请求

## 背景

Dexter选择A后同步需求与设计，原外部0/2/2保留；Route A两轮fresh静态审查收口。新结论仅本次差量，不授权实施。

## 评审目标

独立核验四项处置及同根边界，不继承作者intake或历史verdict。

## 需阅读文件

完整四文件、原外部报告、当前intake及独立R1/R2见下文话术；对应owning source只读。

## 独立核验重点

三隔离L2＋现Web Journey、PROJECT固定scope、六enum、dry-run证明边界、有限测试资源释放。

## 期望结论

GO / GO_WITH_UNVERIFIED_UI / NO-GO与M/S/N、当前位置、事实/推论、最小修正及Dexter裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《前后台重点代码结构优化》修订后的设计包做一次外部静态差量复核。

背景：您上一轮针对旧字节的结论为 NO-GO，M/S/N=0/2/2，原报告与 SHA 保留不变。Codex 已逐条重开规范与 owning source 处置。Dexter 本轮明确选择 A：隔离 L2 只保留菜单、门店扩展和合同扩展，更新页与远控复用现有受管 Web Journey，并同步正式需求 V-09/V-10/V-11/V-14。该实质变化单列 Route A DESIGN cycle，不重开原 cycle。Route A R1 为 GO_WITH_UNVERIFIED_UI 0/0/1；R2 初始盲审为 NO-GO 0/1/0，修订后同轮 SELF_DECIDED 为 GO_WITH_UNVERIFIED_UI 0/0/0，旧字节与原 verdict 均保留。此结论只覆盖本次修订及同根接缝；作者 intake 不是独立 verdict。

目标：请依据当前需求和源码独立核验四项处置与同根路径，判断方案是否简单、可执行、可验收；重点核实验证删减没有变成业务或证明遗漏。请先独立形成判断，再读作者 intake。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md：V 档位与 Dexter A 裁决。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md：§3a、§7/§8.1、§9a、§10b、§11a。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md：CP-01、CP-06、整体准入、未来入口与审查范围。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md：§4–6，控件、角色、Web 与隔离 L2 的边界。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-external-review-claude.md：原四项 finding。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-external-review-intake-codex.md：主 agent 的事实、替代比较、当前 SHA 与未验证项。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-route-a-review-r1-codex.md：第一轮 fresh 原 verdict。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-route-a-review-r2-codex.md：第二轮初始字节、修订与最终综合。
- 对应 canonical/generator、DataScopeSelector/admin-catalog、seed dryRun、现 update/remote Web Journey、报告 owner 与直接测试源码，按上述文档引用重开。

请重点独立核验：
1. A 是否完整同步：三隔离 L2 case＋两个 sample 各 update/remote 的四个既有 W run；没有隔离 TDS、wire 新模式、报告 credential fixture或工件移交；没有新增 TDS tunnel。
2. 当前 PROJECT fixture 的 role/assignment/page/capability 与固定 scope 是否准确；只观察禁用控件，不点击它们，不通过换 GROUP/REGION 角色扩测试需求。
3. 真实 update/report/远控主链与 W_CONTROLLED_UI 两页只读响应夹具是否分开；后者不写报告、不占 owner sequence，不冒称 CBS 持久化分页或隔离 L2。实际 owner cursor 由现测试及 H 证明。
4. 六个 enum 字段是否统一从 canonical 派生并由 Web 消费；nullable、真实字符串、cancel 坐标、消息关联与字节边界保留；TER 手写 consumer 不越界改动。
5. 完整 seed dry-run 是否明确不证明七个 owner seed 请求；工件前置成本与 export cleanup 是否如实说明，未执行范围没有写成 PASS。

烦请给出明确 GO / GO_WITH_UNVERIFIED_UI / NO-GO 与 M/S/N。每项 finding 列当前文件/行号、仓内事实或推论、影响、最小修正及是否需要 Dexter 裁决；无判据的问题列 DESIGN_GAPS。复核以本次变化及同根接缝为重点，不重复未改 CP-01～CP-05 的全量源码审查。

证据边界：本轮只有静态文档修订、源码读回和独立审查。源码实施、生成、编译、F/H、构建、DEV/Web、L2、实际 seed 与 cleanup 均 NOT_RUN；UI/TestId/L2 准入仍 OPEN/OPEN/BLOCKED。

授权边界：仅授权本次设计包静态复核；不授权实施、源码/测试/生成器/规范/记忆/依赖修改，不授权构建、测试、verify、DEV、Web、设备、reset/seed、L2、UAT 或部署。谢谢。
```

