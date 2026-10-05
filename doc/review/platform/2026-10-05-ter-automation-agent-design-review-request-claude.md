# TER automation-agent · 再次修订设计包外部差量复核交接

## 背景

三项S及三项N的文档修订完成；carried N-1保持PARTIALLY。作者处置不是独立verdict，旧评审对应旧哈希。

## 评审目标

独立核验最小修订、CP准入时序、seed单源、属性品牌门与skill配方闭合；仅静态。

## 需阅读文件与独立核验重点

见下面完整可复制话术；当前文件与行号/哈希还见design-recheck-intake §2/§5。

## 期望结论

GO/NO-GO与M/S/N；未验证UI依review-standard保留GO_WITH_UNVERIFIED_UI。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER automation-agent》再次修订的设计包做外部差量静态复核。

【背景】
您此前差量结论为 NO-GO、0M/3S/4N，仅对应旧字节。作者已重开 owning source 与裁决，修订 S-A/S-B/S-C、N-a/N-b/N-c；作者处置为六项 CLOSED，需求开始时间 N-1 保持 PARTIALLY，未改需求正本。这不是独立 GO。
当前详设 SHA 前缀 12b995c8e888bf39，计划 8eb041e05b8f4e9e，附件 fb48983b92d9c14f，skill 3c200f7df972519d；完整七份哈希及当前行号见 intake §5。需求仍为 37fe9363e79b6db3。
本次 fresh 内部 DESIGN reviewer 派发失败：agent thread limit reached。状态核查确认 reviewer 未创建、有效内部轮次仍为0；没有独立 verdict，不复用历史 agent，不将外部复核当作内部审查替代。

【目标】
请独立证伪或确认七项处置，判断设计是否简单、可实施、可验收；不要继承作者 CLOSED 或旧 verdict。

【仓库内材料】
请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-10-05-ter-automation-agent-design-recheck-claude.md：旧差量 finding 与裁决；
- doc/review/platform/2026-10-05-ter-automation-agent-design-recheck-intake-claude.md：当前处置、行号、七份完整文件路径/哈希及工具状态，只作为待核输入；
- doc/plans/platform/2026-10-05-ter-automation-agent-implementation-design-claude.md：§4.4、§4.5、§9a/9a.1/9a.2、§10b.3/10b.4/10b.6及V-14；
- doc/plans/platform/2026-10-05-ter-automation-agent-implementation-plan-claude.md：CP-01第5步、CP-04准备、CP-05第3步、CP-06第3步；
- doc/plans/platform/2026-10-05-ter-automation-agent-skill-draft-claude.md：§3～4；
- doc/decisions/2026-10-05-ter-automation-agent-journey-claude.md：前提链；
- doc/plans/platform/2026-10-05-ter-automation-agent-source-inventory-claude.json：native属性清单、phaseDisposition、seed来源及readback扩展；
- doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json：stableFixtures.organization.storeTerminals；正式需求及适用规范按原评审输入重开。

【独立核验重点】
1. 全生产TSX的testID/testId属性定点类型门能否补齐直接RN节点；品牌props编译红例与 <View testID="x"> 属性门红例是否分开，未引入流分析。
2. dual=term-front、mobile=term-handheld是否忠实落实seed共享裁决；激活码只从契约读取，manifest无秘密；串行、REQUIRE_INACTIVE与本driver身份限定回收是否一致。
3. CP-01首次动态前资源门、新根/kind及health/format登记，CP-04首次顾客输入前fixture迁移，CP-06最终删除是否已消除前提倒置。
4. DEV readback跨owner清单是否覆盖projection、parse、r5-dev-runner.d.mts与红例，bound_device_id原值不落盘；未来实施授权须单独列明该改动，本次不授予。
5. skill真实点击request关联与显式激活前提是否足以指导后续定稿；薄封装复用selector/账本、无第二业务通路；activation.status与副机null合法JSON是否正确。
6. N-1继续PARTIALLY；草案API尚未实现，UI=UNSET，所有新能力/F/V及cleanup=NOT_RUN，不能写成当前PASS。

【期望结论与授权边界】
请给出独立 GO 或 NO-GO 与 M/S/N；已知阻断关闭且只剩未验证UI时，按 review standard 给 GO_WITH_UNVERIFIED_UI。每条 finding 标精确路径/行号、事实或推论、影响、最小修正及是否需 Dexter 裁决，并列七项 CLOSED/PARTIALLY/OPEN。
本次仅静态复核设计包，不授权修改需求、规范、记忆、源码、TDC acceptance、DEV runner或依赖，不授权安装、生成、编译、构建、测试、verify、DEV、Web/设备、reset/seed、L2、UAT或部署。谢谢。
```
