# 门店经营规则开关 · 独立 DESIGN 审查（第 1 轮）

`REVIEW_TARGET=DESIGN`  
`REVIEW_CYCLE_ID=2026-09-16-store-operating-rule-switches-design`  
`REVIEW_ROUND=1`  
`REVIEW_ROUND_LIMIT=2`  
`reviewerKind=INDEPENDENT_SUBAGENT`  
`BLIND_REVIEW=true`  
`REVIEW_INPUT=当前需求正本、Journey、interaction、IA、mapping、详设、实施计划、活动 edge catalog、error disposition catalog、edge materializer/codegen、Store schema、StoreEditDrawer`  
`EXECUTION_BOUNDARY=READ_ONLY_STATIC; no build/test/codegen/DEV/reset/seed/L2/UAT/deploy/Git`

## 独立 reviewer 的原始结论

```text
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=1/2/2
L1_ENGINEERING=M-01；S-01；S-02
L2_USER_VISIBLE=S-01；N-01；N-02
L3_UNVERIFIED=生成链实际执行、54 个 operation 的 HTTP closed-set、四状态审计写读、三 host 的无列表请求与焦点/脏表单行为均未运行；本轮未将其记为实现缺陷
SAME_ROOT_SCAN=M-01 覆盖 52 个 gate mutation 加 2 个 Store command；S-01 覆盖 operations/platform 两个 modal；S-02 覆盖 Drawer、shared disabled surface 和 L2 roster；N-01 覆盖 1 个 Drawer 与 3 个 host；N-02 覆盖唯一 STRING Input
DESIGN_GAPS=registry 字段术语与 OpenAPI complete-object requiredness
EVIDENCE_TIER=L1 当前字节静态源码与设计对账；L2 静态交互工件；L3 未执行
```

独立 finding 的主题为：M-01 两个新 error code 的 materialization 住址；S-01 双端审计 label/state formatter 住址；S-02 TestId 唯一源；N-01 Drawer 文案归属；N-02 未确认的 320px；DESIGN_GAPS 为 registry 术语与 OpenAPI 12-key requiredness。

## 作者逐项当前字节核验与处置

| reviewer 项 | 当前字节判定 | 当前证据 / 处置 | 为什么不是更大方案 |
| --- | --- | --- | --- |
| M-01 error code materialization | `REJECTED_WITH_EVIDENCE` | 详设 §6.1 已将 422 限为 Store create/update、403 限为 mapping 的 52 mutation，并明确“disposition metadata → active edge catalog `operationErrorAugmentations` → materializer 的 54 path `x-error-codes` → codegen”；计划 P2/P4/P9 同样列出这两类 source。未手改 path。 | 不增加第二套错误码登记表；既有 active edge catalog 已是 operation closed-set 唯一输入。 |
| S-01 双端审计 display | `CONFIRMED`（文档间残余矛盾） | 详设 §5.4 本已规定 snapshot → fixed core → key fallback、platform 不导入 operations catalog、两端各自 typed switch；但详设 §7.3、interaction §5、计划 P5 仍有“shared helper/formatter”字样。已统一为：只共享 generated `AuditValueState` type 和同一组 fixture；两端各自在本 app 的 audit-history feature 穷尽渲染。 | 不为两个 app 内部 display 引入新 foundation API 或跨 app helper；这既复用 generated wire，又避免 app 边界倒置。 |
| S-02 TestId source | `REJECTED_WITH_EVIDENCE` | IA、interaction、详设、计划均以 `apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts` 为唯一计划来源；规则控件、保存、取消、未开通 surface retry 都挂到真实动作。 | 不新增第二份 testId 文件；StoreEditDrawer 现有直接 `testId(...)` 将迁入该唯一 source。 |
| N-01 Drawer host-only copy | `REJECTED_WITH_EVIDENCE` | interaction `OPS-SOS-01` 的 `USER_VISIBLE_COPY` 仅含 Drawer 的规则标签、父级提示、取消和保存；“功能尚未开启，需项目对门店授权”只在三个 host 和后端 capability feedback。 | 不给配置 Drawer 虚构 capability-disabled 状态。 |
| N-02 320px | `REJECTED_WITH_EVIDENCE` | interaction 与 IA 均规定 developer code 复用现有 Form 控件列宽，视觉确认后才冻结尺寸；没有固定像素宽度。 | 不新增响应式/尺寸规则。 |
| DESIGN_GAP registry 术语 | `CONFIRMED` | 需求正本 R-9.2a 与核验事实已由不存在的 `operationArithmetic` 更正为 root `operationCount` / `readCount` / `commandCount`；operation 级判据仍为 `mode`。 | 只更正术语，不改变 269/88/52 分类或映射。 |
| DESIGN_GAP OpenAPI complete object | `REJECTED_WITH_EVIDENCE` | 详设 §3.2-3.3 与计划 P2 已明确 generated values component `required` 恰为 12 key、`additionalProperties=false`，Create 可省略 property，但携带即完整。 | 保持单一 generated component，不手写第二套 request schema。 |

## 第 1 轮后状态

第 1 轮独立 verdict 保留为 `NO-GO`，不被作者改写。上表记录作者仅依据当前 owning source 的处置；本轮确认的文档修复已完成，须由 fresh 第 2 轮 reviewer 对新字节盲审。没有 production code、生成物、测试或动态运行发生。
