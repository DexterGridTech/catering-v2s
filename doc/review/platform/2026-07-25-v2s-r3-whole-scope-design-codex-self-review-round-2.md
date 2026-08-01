---
title: R3 全范围详设 Codex 对抗自审（第 2 轮定向核验）
status: SELF_REVIEW_ROUND_2_FINAL
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md
createdAt: 2026-07-25
---

# R3 全范围详设 Codex 对抗自审（第 2 轮定向核验）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-WHOLE-SCOPE-IMPLEMENTATION-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
```

## 用户任务

业务用户仍是获得部署期 platform-admin 访问的系统服务提供者：在既有、未初始化的集团空间中，
核对目标、独立录入商业集团编码和名称、再看到唯一商业集团 readback。到达 operations-admin
独立 route 的使用者有一个更小但真实的用户任务：不能被空页、伪 dashboard 或登录控件误导，必须
清楚知道本阶段未开放运营业务。该静态说明不增加运营用户登录或任何业务任务。

## Dexter 立场

Dexter 接受了 U06 静态边界页的附录线框，同时要求 R3 保持单一 C-01 业务 Journey、外部受控
前提和不恢复 operations 登录。Claude 的五项 N 必须以最小、可核验的细化关闭，而不能借复核把
R3 扩为 R4 门体系或新的账号/运营功能。

## 替代方案

1. **豁免 U06 线框。** 文档最少，但会留下“非 Journey 即不需要交互工件”的错误先例；不选。
2. **给 operations 做登录页或空业务后台。** 看似更完整，却会违背 R3-C02 删除和外部身份边界；不选。
3. **为 DB 预算、错误码、文案另建语义 checker。** 机械外观会掩盖业务判断，且超出门三问；不选。
4. **补一张静态边界线框，并把预算/错误码/文案约束写入既有 U03–U07 的设计和 L2 证据。**
   这是更小、可实施且不扩权的处理；采用。

## 方案合理性

| 发起的攻击 | 复核事实、反例和适用边界 | 结论 |
| --- | --- | --- |
| U06 是用户可见 route，能否因不是业务 Journey 而没有 UI 工件？ | 重开 interaction template、U06 manifest 与 Claude N-1：用户可见不等于可以不被审看。反例是无内容页或伪登录页，它们会让用户误解独立 app 的含义。附录线框只表达边界，不添加操作 | `CONFIRMED`：补线框优于豁免，且不改变 C-01 的业务范围 |
| DB 往返预算是否应另建新门或只写一句口号？ | 复开 manifest B.6.6：预算要求以 `databaseOperationCount` 进入测试。反例是分页/详情拆端点或删 audit/readback 来“压次数”。最小处理是在 U04/U07 integration/L2 明确 list/detail `≤3`、initialize `≤5` | `CONFIRMED`：现有测试证据承载预算，不新建伪语义 checker |
| 错误码生成与前端文案是否会被手写字符串绕开？ | 复开 B.3.3 与 D.2：Problem code 必须为 OpenAPI components 闭集、双端 typed codegen，前端映射须穷尽。反例是新增 code 后 UI 落入 generic/internal 文案 | `CONFIRMED`：U03/U05 明定 typed constants、禁止手写和 `never` 保底；typecheck 提供机械失败面 |
| 四屏文案断言是否把内部词误判为业务文案？ | 重开已确认语料 G-01 与 C-01 四屏；正向只允许集团空间、商业集团、编码、名称，禁用 `workspaceKey`、aggregate、内部错误、“诊断”。适用边界是 C-01 可见 copy，不扩展为通用术语 checker | `CONFIRMED`：U07 L2 逐屏断言是最小定位 |

问题与方案相称：新增的是一张静态图和五条既有单元内的精确证据，不是新页面体系、账号机制或
R4 验证项目。成本小于继续保留误导性非 UI 理由的返工风险。

## UI 与交互

`APPLICABLE`：U05 的操作继续严格来自获批 C-01；U06 的静态页由 Dexter 本轮明确接受，锚点为
interaction artifact `### Appendix Screen: operations-r3-boundary`。该页让用户知道“本阶段未开放
运营业务”，只有返回/离开入口；没有登录、账号、session、菜单、业务 endpoint、内部错误或“诊断”。
它不把 backend 或旧文档限制伪装为用户任务，也不从独立 app 架构反推出真实 operations 登录。

## 审查意见复核

- **Claude N-1（U06 可见 route 的 UI 理由）=`DEXTER_DECISION` + `CONFIRMED`。** Dexter 明确同意
  补附录线框；已重开 interaction artifact、U06 详设和 manifest，将其登记为 UI-bearing anchor。反例
  是“非 Journey”自动豁免，已被拒绝。更小方案是单页静态边界，不是登录或业务界面。
- **Claude N-2（DB 往返预算）=`CONFIRMED`。** 重开 B.6.6，U04/U07 与 manifest evidence 已增加
  `databaseOperationCount` 明确预算。没有为此增加 checker；超过预算仍先走评审说明，符合适用边界。
- **Claude N-3（C-01 文案 L2）=`CONFIRMED`。** 重开 G-01 和四屏线框，U07 已加入正向与禁用词
  断言。反例是把全仓术语问题扩大为关键词 gate；该过度设计被拒绝。
- **Claude N-4（skill 标签与 hash）=`CONFIRMED`。** 总详设顶部已改为 `cs-writing-plans`，与本仓
  适配 skill 的冻结 vendor hash 一致。它是标签纠正，不改变 scope。
- **Claude N-5（Problem 代码闭集与前端穷尽映射）=`CONFIRMED`。** 重开 B.3.3/D.2，U03/U05 现已
  点名双端生成、禁手写和 TypeScript `never`。反例是手写错误字符串或 generic fallback；最小修复在
  既有 generated closure 和 typecheck 中完成。
- **制度化修订（manifest Part B/D 对照）=`CONFIRMED`。** `CLAUDE.md` 与 matrix 两个设计 review
  checklist 均已加入缺表不得 GO/NO-GO 的规则，并附章节级 hit map。该表是人工 review 交付，不是
  新语义 checker。

所有 finding 均以 owning source/interaction/manifest 回读后处置；没有全盘接受，也没有在信息不足时
创造新的产品结论。第二轮到此硬停止，后续只允许 Claude 独立快速复核或 Dexter 产品/授权决定。

## 闭环核验

- U01–U07 的 design source hash、interaction source hash 和 carry-over decision hash 已重新绑定到
  granularity manifest；U06 有唯一 UI artifact anchor；
- JSON 结构、R3 standards coverage、project-memory、agent lifecycle、Claude handoff 格式与 diff
  whitespace 将在冻结前 fresh 重跑；旧 round-1 review 不再作为当前 manifest hash 的核验输入；
- 本轮仍无 implementation、OpenAPI、migration、app、DEV、动态运行、seed/reset 或 Git 操作；
- 本轮是同一 `REVIEW_CYCLE_ID` 的第 2 轮，不能再由 Codex 发起第 3 轮对抗审查。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_CLAUDE_QUICK_REVIEW_OF_R3_N1_TO_N5_AND_REVIEW_DISCIPLINE_FIXES
M=0
S=0
N=2
N-01=external platform-access/workspace-precondition remains an implementation acceptance constraint, not a design gap.
N-02=Heritage frontend source freeze-before-carry remains an implementation acceptance constraint, not a design gap.
ROUND_FINAL_DECISION=SELF_DECIDED
NEXT=freeze current manifest/review bindings and request Claude quick review; implementation remains unauthorized.
```
