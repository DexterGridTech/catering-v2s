---
id: 2026-08-12-v2s-complete-dev-seed-composition
status: accepted
owner: Dexter
scope: managed-dev-seed
---

# 完整 DEV Seed 组合

## 决定

从本决定起，Dexter 所说的“seed”唯一指完整体验数据装载：

```bash
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

该入口按固定顺序运行且必须汇总验收：

1. `owner-command`：32 项 R5 fixture 的基础平台、组织、账号、邀请、合同等事实；
2. `catalog-inventory`：canonical catalog/inventory fixture 的 73 条来源项、72 条创建项、1 条有据排除项、34 个媒体及总公司/门店 scope readback。

二者缺一、顺序错误、managed DEV run 不一致、任一 business/cleanup/receipt 非 PASS，完整 seed 都是 FAIL。两个子阶段保留各自 owner/API 报告；父报告只引用、校验并汇总子 receipt，不混合 API 或数据库计量。

`catalog-inventory` 不再是顶层用户 seed profile；它是完整 `r5-full` 的内部组件。它的 fixture、loader、静态 plan 与单阶段 reconcile 仍独立保有数据主权，不能被复制进基础 fixture 或直接 SQL 替代。

## 运行边界

`stop`、`reset`、`start` 和 `seed` 仍为四个独立受管动作。seed 不自动 reset/start/stop，start/restart 永不隐式 seed；失败后的部分 DEV 体验状态由下一次显式 reset 清理，不得用盲目重试覆盖 first failure。

完整 seed 在 `.runtime/r5/seed/complete/<complete-seed-run-id>/` 写入父 manifest、JSON 与 Markdown 报告。每个子阶段仍写自己的 run-scoped report；父 manifest 以有序精确集合 `[owner-command, catalog-inventory]` 校验，并记录每阶段 report/manifest 路径、business、cleanup、耗时与首败。

`--dry-run` 只验证两个静态计划；catalog plan 使用临时目录，不写入仓内 evidence 或运行态体验数据。
