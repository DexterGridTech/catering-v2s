# 商品库最终范围 DESIGN 独立对抗审查 · Round 1

```text
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_FINAL_SCOPE_20260824
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INDEPENDENT_BASELINE_FROZEN=true
VERDICT=NO-GO
M/S/N=1/0/2
```

本评审由 fresh 独立 critic subagent `01a02f8c-c482-7cd2-b097-c62752641b24` 完成。reviewer 先按证伪立场
读取 AGENTS、Blueprint、Roadmap 授权、deterministic memory、业务语料、正式需求、Journey、交互、IA、详设、串行计划、
前端规范、backend acceptance 规范及 production-tag/navigation/list/acceptance owning source；未采信作者自报 PASS。
由于该 reviewer 运行角色只读，评审原文由作者会话逐字忠实持久化为本文件；此限制不改变 finding 内容，也不授权
作者改写独立 verdict。

## First failure

`scripts/context/recall-memory --task-kind review ...` 返回：

```text
PROJECT_MEMORY=FAIL
REASON=required assertion drift: project-memory/decisions/confirmed-business-language-corpus.md
```

`LAST_KNOWN_GOOD`：直接读取核心输入成立；§9b 20 个 source anchor 均唯一命中；backend acceptance annotation=80；
L2 当前基线为 18 scenario/41 case、`FRAMEWORK_ONLY`、0 active、39 TEST dataset。

`BROKEN_BOUNDARY`：业务语料 frontmatter 与 `project-memory/required-inventory.json` 的 required assertions/sourceRefs
未原子更新，六维 recall fail closed。不是商品库业务设计本体的语义失败。

## Findings

### M-01 · deterministic memory required assertion drift

业务语料加入 `BUSINESS_CORPUS_CIPG01_SINGLE_PRODUCTION_TAG` 并更换 owning sources 后，required inventory 未同步，
导致所有相关 design/review/implementation recall 在读取正文前失败。必须更新唯一 required inventory、由
`scripts/memory/build-index` 生成 index，并证明 build check 与六维 recall 均 PASS；不得以直接读文件代替。

### N-01 · reviewer 只读写入边界

critic 无权自行写评审件。该限制属于审查编排，不是设计缺陷；作者会话只能忠实持久化 reviewer 原文，Round 2
继续由另一个 fresh reviewer 独立判断，不复用作者结论。

### N-02 · L3 未验证必须保留

当前 browser L2 仍是 18/41、0 active、39 TEST dataset；设计中的 26/65、active24、47 dataset 是实施目标，不能写成
动态通过。

## 已独立确认的设计事实

- 十列、四行、Tooltip、横向滚动在正式需求、交互、IA、详设与计划均有落点。
- 商品级 0..1 生产标签、SKU/option 标签退役、迁移 preflight、80 annotation、L2 目标与 seed 隔离均有设计覆盖。
- 当前生产源码仍保留旧 `productionTagRefs/addProductionTagRefs`，可作为实施红基线；设计未冒充已经实施。
- 设计明确不授权实施、契约代码、测试、migration、DEV/reset/seed、browser L2/UAT 或部署。

## 授权边界

本 Round 1 只审设计，不授权实施、契约/代码/测试修改、migration 真实执行、DEV、reset、seed、browser L2、UAT、
部署或数据操作。
