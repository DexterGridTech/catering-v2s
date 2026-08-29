# TER 骨架批一详设与实施计划 · fresh 独立对抗审查 R2

```text
REVIEW_CYCLE_ID=TER_SKELETON_BATCH1_DESIGN_20260829
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
reviewer=/root/ter_batch1_design_review_r2
VERDICT=NO-GO
M=0
S=1
N=0
```

本文件由主 agent 将 fresh reviewer 的最终消息机械转录入仓；未改写 verdict、severity 或 finding。
reviewer 角色为只读，因而没有自行写文件。

## 盲审声明

本轮从当前仓库字节与 fresh 命令输出重新核验；R1 artifact 作为指定输入读取，但 reviewer 未采信其结论
作为证据。只读执行，未写文件、未创建包、未创建 scratch。

## Finding

### S-1 · 四个 Turbo 聚合脚本的 dry-run 判据仍不完整

- 位置：implementation plan §4.1、§4.3、§9.4；implementation design CP-1、CP-6。
- 事实：四个聚合脚本都固定使用相同 TER filters，但仅 typecheck 有 `--dry=json` exact-set 判据。
  kernel/ui 只有 typecheck，adapter 保留 test 但本批不跑，因此 test/lint/clean 的预期 task set 仍需猜。
- 后果：脚本可能存在但不可验，或 test 意外进入本批执行语义；空 task 也可能被误报为有效能力。
- 最小修复：批一只保留/验收 typecheck，或为四个脚本分别写出 dry-run 的 task owner exact-set、是否允许
  为空、adapter test 是否入选，以及四者都必须零 frontend/library、零聚合包递归。

## 已核到的关键证据

- 当前 `apps/terminal` 只有占位 package；根无 `turbo.json`；当前 workspaces 只有仓根、两个 frontend app、
  admin-ui-foundation。
- `create-expo-module@57.0.1 --help` 与 `create-expo-app@4.0.0 --help` 均 exit 0，并支持设计使用的参数。
- exact app template 57.0.18 的 raw dependencies 是 `expo ~57.0.16` / RN `0.86.2`；当前文档已要求
  规范化到需求版本后重验。
- `npmMinimalAgeGate=1440`、Node `v24.13.0`、Yarn `4.17.0`。
- 当前仓执行 future Turbo command exit 1，因为 `turbo.json` 尚不存在；不能把未来 filter 结果写成已证明。
- R2 其余指定项未发现新问题：module 阻断状态、pinned app、metadata key、bootstrap self-root、UI version
  source、14/22、marker、frontend exclusion 与授权边界均无回归。
