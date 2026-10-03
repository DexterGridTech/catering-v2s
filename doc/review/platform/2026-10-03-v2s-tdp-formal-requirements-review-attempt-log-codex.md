# TDP 正式需求 · 独立审查尝试记录

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_REQUIREMENTS_2026-10-03
REVIEW_TARGET=DESIGN
AUTHOR=主 agent 记录；不是独立 verdict
```

## 未计为有效第一轮的输入失败

- reviewer：`/root/tdp_formal_requirements_r1`，fresh context，未写入文件或运行动态验证。
- 被审对象 SHA-256：`bd36b68c7aff83ac1ce5eb54ac9f1920c9b9aa3bc92e49e8ff2a2aa8572999ec`。
- last known good：已读取目标全文、入口、kernel与部分来源，尚未形成 verdict。
- first failure：补读讨论稿 §9 时使用 `sed 610,747`，包含后续作者 §10 可行性分析。
- broken boundary：先独立形成 findings/verdict，后读作者分析/处置的盲审输入顺序。
- 真实状态证据：reviewer 主动上报 `WAITING_FOR_PARENT_DISPOSITION`；不再形成 DESIGN verdict。
- 处置：主 agent 受控中断该 reviewer；改用另一个 fresh reviewer，提前禁止读取整份讨论稿与作者分析。
- 本尝试没有 GO/NO-GO，没有计入有效 `REVIEW_ROUND=1`，没有以换 reviewer 重置已发生的有效轮次。
- 已确认通用失败模式：按固定行号读取章节会因文件增长读入下一节，污染 blind-review 顺序。
  最小防再犯落点：本 cycle 两轮 input checklist/prompt 明确原始输入在 prompt/目标 §10，
  独立 verdict 前不读讨论稿；需要章节时按标题截取到下一同级标题，不用猜行号跨段。
  本条不新增机器门、不重写治理；保留失效尝试以供 Dexter 追溯。
