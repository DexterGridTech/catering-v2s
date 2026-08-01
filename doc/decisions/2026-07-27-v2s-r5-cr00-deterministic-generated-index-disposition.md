---
title: R5 CR00 确定性生成索引 receipt 处置
status: DEXTER_ACCEPTED_BASELINE_EXCEPTION
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5-CR00
decisionAuthority: Dexter
---

# R5 CR00 确定性生成索引 receipt 处置

## 裁定

`project-memory/index.json` 与 `project-memory/index.md` 是由
`tools/project-memory/cli.mjs build` 从 active memory inventory 与 Markdown 原文确定性重建的
派生导航视图，不是独立规则、业务源码或人工维护的 package change surface。

因此它们不进入 CR00 的 `actualChangedPaths`/hook incremental receipt 集合；它们的正确性改由
`scripts/check/project-memory` 的原文重建比对证明。此豁免精确限于这两个路径：

- 不适用于 `project-memory/required-inventory.json`、任何 memory 原文、任何 tool、任何 evidence；
- 不适用于其他 generated 文件；
- `scripts/check/project-memory` 失败、索引未被确定性重建或路径超出上述二者时，CR00 package exit
  必须失败。

## 原因与边界

CR00 初始 baseline 已在用户要求的真实 hook 授权与 canary 后创建；随后按本包已接受计划新增
incremental-compliance memory assertion，导致两份派生索引重建。将其事后登记为 `before=ABSENT`
会伪造写前状态；将其作为普通 source 变更则重复计量同一 inventory/memory 输入。采用该受限派生
类别既保留输入的逐文件 receipt，也不掩盖索引新鲜度。

本裁定不改变任何冻结业务分母、契约、迁移、operation、surface 或 pageDesignKey；也不授权 CR01。
