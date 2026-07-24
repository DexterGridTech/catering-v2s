# Claude 评审交付模板

每次由 Codex 交给 Dexter、再由 Dexter 转交 Claude 的评审材料，都使用本模板。它服务于人工评审交接，不复制业务设计或完成状态。

## 背景

说明本轮交付单元、它为何需要评审，以及与此前结论的关系。

若本轮是 implementation-facing 详设，标题前必须声明：

```text
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=<repo-relative-json>
ADVERSARIAL_REVIEW_REPORT=<repo-relative-json>
```

这两份材料必须先通过 `scripts/check/implementation-design-granularity`；否则不得创建本 handoff。

## 评审目标

明确希望 Claude 独立确认的 architecture、contract、boundary、evidence 或代码问题；不要使用泛化的“请 review”。

## 需阅读文件

列出从 catering-v2s 仓库根可直接打开的相对路径，并说明每个文件的用途。不能使用机器绝对路径代替。

## 独立核验重点

列出可独立复验的关键边界、实现入口、命令或 evidence；区分已完成事实与仍待处理项。

## 期望结论

请求明确的 `GO` 或 `NO-GO`。findings 使用 `M` / `S` / `N`：每项带精确文件与行号、影响面、最小修复建议及是否需要 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次 <交付单元>。

背景：<本轮范围、此前结论及为什么现在评审>。
目标：请独立核验 <明确的 architecture/contract/boundary/evidence/code 目标>。

请从 catering-v2s 仓库根阅读：
- <相对路径 1>：<用途>；
- <相对路径 2>：<用途>；
- <相对路径 3>：<用途>。

请重点独立核验：<可复跑的边界、关键命令、evidence 和残留项>。

烦请给出明确 `GO` 或 `NO-GO`。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。

授权边界：<本次 GO/NO-GO 所代表的范围，以及它不授权的事项>。谢谢。
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file <review-request-relative-path>
```

该检查验证 review 文件的结构与可复制话术。Codex 还必须在给 Dexter 的最终回复中直接渲染同一段代码块；不能把“文件存在”或“检查通过”当成可以省略交付话术的理由。
