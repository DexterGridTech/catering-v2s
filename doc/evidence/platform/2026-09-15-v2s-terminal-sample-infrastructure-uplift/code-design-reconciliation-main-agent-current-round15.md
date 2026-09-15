# 交付前逐代码与详设对账（主 agent 当前字节）

REVIEW_TARGET=CODE_TO_DESIGN_RECONCILIATION
REVIEW_CYCLE_ID=2026-09-15-v2s-terminal-sample-infrastructure-uplift-implementation
REVIEW_ROUND=15
REVIEWER_KIND=MAIN_AGENT
RESULT=MATCHED
EVIDENCE_STATUS=OPEN_FOR_CLAUDE_DECISION

## 范围

按详设 §10 的完整 changed-surface census 逐组重开当前源码、测试、工具、配置、package、
graph、native resource 和 evidence；范围不是抽样，包含 B0、B1、B2、B3、B4 及实施中为
修复首败而修改的 checker/runner 测试边界。逐行核对每一处实际实现是否有详设章节、计划
批次、U/CP 控制和 evidence 落点；新建的当前 evidence 与交接文档不引入生产 owner 或
运行期行为。

## 对账结果

| 范围 | 详设/计划落点 | 当前源码/证据 | 结果 |
| --- | --- | --- | --- |
| B0 R-E6、两个废弃 adapter 线下处置 | design §6/§11.1；plan §1/§10 | `skeleton-graph.ts`、root workspace/lock、static tests、`obsolete-file-cleanup-round2.md` | MATCHED |
| B1 runtime subset、AST collector、base boundary | D-1/D-2/D-4；U1/U2/U5/U11 | `graph-model.mjs`、factory、layering/static red vectors | MATCHED |
| B2 native provider、identity/assets、SDK57 order | D-5/D-6/D-10/D-11；U6/U7/U8/U12 | `assembly/base/android`、两 App MainActivity/resources、native projection/build | MATCHED |
| B3 admin console、single writer/run、ready/failure | D-5/D-7；U3/U4/U8/U9 | `console-assembly`、`sample-console`、render boundaries、U8 focused/release | MATCHED |
| B4 feature skeleton、requestOutcome、notice、picker two-hop | D-12/D-13A/D-14；U10/U12/U13 | feature adapters/factory、picker actor/UI、16-test runtime injection、旅途 runner | MATCHED |
| D-9/U10 literal journey | design §8；plan §8 | sample1/sample2 current mobile/dual records and unchanged sample1 IDs | MATCHED |
| U8/S-3 runner and evidence | design U8/D-5；plan §5/§10 | current release build, normal/wrong-primary record-only runner and cleanup | MATCHED |
| failure/diagnostic repairs | design §2.3/§11.1；plan §9 | parallel mutation race、cache cleanup、SF virtual identity、picker viewport 首败记录 | MATCHED |

未发现脱离详设的生产文件、owner、依赖边或用户可见身份变更。当前 `RESULT=MATCHED`
只表示代码与详设/计划对齐；它不替代三维独立审查，也不把 Web、visual 或 Claude 的
implementation acceptance 变成 PASS。

## 关键反例检查

- `sample1` 的 partKey、layerId、testID 与两类 notice 身份未改名；当前 dual/mobile XML
  与 runner 均以冻结值读取；
- `sample2` 的 pending/confirmed 与冷重启规则未被 U13 错误提示路径覆盖；当前 mobile/dual
  runner 与 focused child readback 分开；
- U13 failure injection 仅通过 test-only runtime module 注册，release production bundle
  scan 禁止该 token，不在生产代码保留调试开关；
- checker 的临时 mutation 已串行执行并在 finally 清理；之前的并发 race 和 Vitest cache
  首败仍有独立记录。
