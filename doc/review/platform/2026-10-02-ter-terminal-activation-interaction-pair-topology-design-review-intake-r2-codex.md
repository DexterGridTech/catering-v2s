# 第 2 轮最终 finding intake 与文档修复记录

```text
REVIEW_CYCLE_ID=TER-ACTIVATION-INTERACTION-PAIR-TOPOLOGY-DESIGN-2026-10-02
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
AUTHOR_INTAKE=COMPLETED
POST_FIX_INDEPENDENT_VERDICT=NOT_AVAILABLE_WITHIN_CLOSED_CYCLE
POST_FIX_DYNAMIC_VALIDATION=NOT_RUN
```

## Intake 边界

R2 独立 verdict 与 finding 原文见 [第 2 轮复核记录](2026-10-02-ter-terminal-activation-interaction-pair-topology-design-review-r2-report-codex.md)。R2 原 verdict 是对 checklist 哈希对应字节的 `NO-GO, M/S/N=0/1/2`。`SELF_DECIDED` 按 reviewer 的澄清只表示允许作者对第 2 轮 finding 做最终 intake、修复并停止本 cycle；它不改写原 verdict，也不授权作者声称修订字节已获独立 DESIGN GO。

本记录是主 agent 的 finding intake，不是新的独立 verdict。已按 R2 最小修正补齐模板槽位；cycle 已达两轮上限，不再召集第三轮。修订后字节交 Dexter 与 Claude 做外部设计评审，后续实现须等授权。

## S-1 · `TEMPLATE_SECTION_CANONICALITY`

- **分类**：`CONFIRMED`（R2 finding 对当时字节成立）。
- **判据**：`doc/decisions/templates/journey-decision-template.md` §5 要求 corpus 命中与冲突专节；`doc/decisions/templates/ui-interaction-design-template.md` §1.1、§1.2 要求标准入口、逐 screen 声明和适用性/N/A 说明。
- **原始位置**：Journey 原 §4 后进入 §6；UI 工件原有逐屏内容与管理一致性说明，但未放入 canonical §1.1/§1.2 槽位。
- **修正**：Journey 新增 `## 5. Corpus 命中与冲突`，逐行区分 G-01/G-03/G-05/G-10、TER §4-D/§4-E 及 corpus 未覆盖的专项术语，写明不得推导边界和无需 Dexter 裁决。UI 工件新增 `## 1.1`，列出模板 11 个强制字段及 26 个 screen 的完整索引；新增 `## 1.2`，说明全部 screen 都是 TER public、没有两个后台 consumer face，给出可检查的 `NOT_APPLICABLE_WITH_REASON`。将 §§11/12 移至文末，恢复连续阅读顺序。
- **理由与更小替代**：未复制 26 份字段大表或重复 screen 内容；用标准槽位加逐 screen 锚点索引，屏幕具体值仍只住在各自 `### Screen` 块，避免双份事实漂移。
- **同根范围**：R2 已检查 Journey、IA、UI、详设、计划。变更只涉及 Journey 与 UI；IA、详设、计划没有 template-slot 缺项，不做无关修改。
- **产品裁决**：不需要。Dexter 已接受整体交互方向；本次只补文档结构与可审查入口，没有扩展控件或产品行为。
- **复核结果**：主 agent 对 26 个 `### Screen` 块做只读结构解析；26/26 均含 `CONSUMER_FACE`、`APPLICATION_AFFILIATION`、`UI_SURFACE`、`HOST_AND_ENTRY`、`ACTOR`、`BUSINESS_SCENARIO`、`BUSINESS_GOAL`、`USER_VISIBLE_COPY`、`TECHNICAL_BOUNDARY`、`FOUNDATION_PRIMITIVE`、`CONTAINER_LAYOUT`。该解析只证明文档字段存在，不证明内容正确或实际渲染。

同根一致性检查还确认 UI roster 与详设验收映射中的 `SAMPLE-08-LMP` 行曾误指向 `SAMPLE-06` 的当前 TestId。依据 `apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts` 的 title/options/confirm 定义，已在 UI 与详设同步改为指向 `SAMPLE-07`；未改源码或生成物。

## 当前模板覆盖

| 模板 | 修订后文件状态 | 覆盖位置 |
| --- | --- | --- |
| `journey-decision-template.md` | 全部适用章节存在 | Journey §1～§7；§5 已补 corpus 表 |
| `ia-design-template.md` | 全部适用章节存在 | IA §1～§6；设计档位与 N/A 均有说明 |
| `ui-interaction-design-template.md` | 全部适用章节存在；无后台 screen 有具体 N/A 理由 | UI §1、§1.1、§1.2、§2～§10、§11～§12；26 个 screen 的强制声明逐一索引 |
| `implementation-design-template.md` | R2 未报缺项，本 intake 未改 | 详设 §0～§14 与 §11a；实施计划逐步对应 |

## 修订后未验证范围

- 修订后设计文件没有经过新的独立子 agent DESIGN verdict；当前独立 verdict 仍是 R2 对旧 hash 字节的 `NO-GO`。
- 26 screen 实际渲染、真实控件/TestId、Expo Web、VM/device、adapter 行为、business、cleanup 与 V-01～V-20 全部 `NOT_RUN`。
- Browser L2 `N/A_WITH_REASON`；没有源码实施、构建、测试、verify、DEV、reset/seed、L2、UAT 或部署授权。
- 设计文档已准备提交 Dexter 与 Claude 外部评审。任何实现或动态验证均须遵从后续明确授权。

## 修订后输入字节

以下为本 intake 完成后当前五份设计输入的 SHA-256，供 Dexter/Claude 锁定评审对象：

```text
Journey      e9106f2dcb2dc1e8a12f0b2cac0e44b02aebb661a156a287895902b08e479256
IA           3244904f8be1c87f37a8ccf39257afe3137e1b9aae4b31746951f365d6ff986f
Interaction  d17aa25675defd95c57f9062142039b76c1511278b890a961f287d6b526b5a7f
Design       1f5d3e9499d0933e7df18f86451463d8af84d2ed9bafca4426b425c8b5fa2eb9
Plan         929f15a43b26a0e586bf934e0c72cd1f02ebf96f7beb571d61348c42f23666e5
```
