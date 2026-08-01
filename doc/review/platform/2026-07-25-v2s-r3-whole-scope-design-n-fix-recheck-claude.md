---
title: R3 全范围详设 N 项修订 Claude 快速复核
type: review
status: DELIVERED
reviewTarget: doc/plans/platform/2026-07-25-v2s-r3-whole-scope-implementation-design.md
reviewer: Claude
createdAt: 2026-07-25
---

# R3 全范围详设 N 项修订 Claude 快速复核

## 结论

```text
VERDICT=GO
M=0  S=0  N=1
```

五条 N 修订全部忠实、最小、可实施,无一处被做成伪语义 checker;章节对照制度已入 CLAUDE.md 并在本设计首次执行。唯一新 N 是对照制度自身的小缺口(Part C 未纳入),一句话修复。

## 逐项复核

1. **N-1(U06 边界页)**:交互工件新增 interaction map 第 5 行 + `Appendix Screen: operations-r3-boundary` + 状态表行;`DEXTER_WIREFRAME_REVIEW=ACCEPTED; includes the appendix…`;manifest R3-U06 改为 `pageKey=OPERATIONS_R3_BOUNDARY` 并引用该附录唯一锚点——"非 Journey 即非 UI"的先例口子已消除,附录明确"不渲染伪 dashboard/登录表单/默认账号"。✔
2. **N-2(DB 预算)**:U04 行 155、U07 行 171、§7 evidence 表三处一致(列表/详情 ≤3、初始化写 ≤5,`databaseOperationCount` 进 integration/L2),并加反绕行句"不能以拆分 surface 或删除审计/readback 规避预算"。✔
3. **N-3(文案断言)**:U07 与 evidence 表:四屏 L2 正向词(集团空间/商业集团/编码/名称)+禁用词(workspaceKey/aggregate/内部错误文案/"诊断")。✔
4. **N-4(回执)**:行 13 改为 `SKILL_USED=cs-writing-plans@72190c88…`,标签与冻结 vendor 哈希匹配。✔
5. **N-5(错误码常量)**:§3.1 行 113 与 U03 行 147:Problem `code` 为 components 闭集枚举、三端生成 typed 常量、禁手写字符串;U05 行 161:前端穷尽 `switch`+TS `never` 保底,新增码 typecheck 必红,映射只输出批准业务词。✔
6. **章节对照表**:`manifest-chapter-hit-map.md` 覆盖 B.1–B.6 与 Part D 各章,HIT 行带条目号+设计落点+冻结原文 hash,NA 行带理由;我抽验 B.3/B.6/D.7 三行与设计实文一致。CLAUDE.md 行 69 制度条款已入。✔
7. **机械复跑**:granularity(manifest+round-2 review)PASS(UNITS=7/GO/ROUND=2,双轮收口合规);standards R3 PASS;round-2 对 R3-N-001/002 保留为实现验收标准,处置正确。✔

## Finding

### N-1(新):章节对照制度未覆盖 manifest Part C 的规范性条款

CLAUDE.md 行 69 只要求 Part B+Part D 对照;但 Part C 含规范性条款(如行 277"契约是唯一真相/错误码生成 typed symbol/禁裸字面量"——恰是上一轮的漏扫源之一)。**最小修复**:CLAUDE.md 该句加"及 Part C 规范性条款";本设计的 hit map 补一行 Part C(内容已由 N-5 实际满足,只是补表)。不需 Dexter。

## 授权边界

本 GO 仅确认 N 项修订与设计一致性,连同前轮 GO 一并可交 Dexter 接受。不授权 implementation、contract、数据库、DEV、动态运行、seed/reset、Git 或 Roadmap step 完成;实施须 Dexter 另行精确授权,首个动作为 U01 Gate 0 + Dexter 不可变 checkpoint。Git 归 Dexter。
