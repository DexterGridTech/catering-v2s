# 双后台 ProTable 紧凑密度实施独立对抗复核（Round 2 最终）

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=DUAL-ADMIN-PROTABLE-COMPACT-20260805
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

## Review identity

- `reviewerKind=INDEPENDENT_SUBAGENT`
- `ROUND_FINAL_DECISION=SELF_DECIDED`
- 本轮是该 cycle 唯一允许的第二轮，也是 hard stop；不再召集第三轮。
- `blindReviewDeclaration`: 我先读取当前实际 input/checker/source/focused proof/exit/package
  字节并独立重跑验证，再读取 Round 1 findings；没有用作者口头说明替代当前字节，也没有把
  Round 1 verdict 当作本轮结论前提。

## 用户任务

业务用户在双后台使用列表时需要统一的紧凑密度；13 个生产 ProTable 必须显式传入
Ant Design `size="small"`，同时不改变查询、分页、排序或业务操作路径。

## Dexter 立场

Dexter 要求这是静态、分钟级、防回归的 UI 标准实施，不扩展后端、契约、数据库、DEV/UAT、
runtime 或 seed/reset 范围；业务与 cleanup 仍按 `NOT_APPLICABLE_WITH_REASON` 处理。

## 替代方案

全局 CSS/ConfigProvider 默认值改动更少，但依赖主题上下文且无法逐实例审计；因此不选该
替代方案，逐 ProTable 显式属性是更可解释、更稳定且没有新增 wrapper 的最小方案。

## 方案合理性

Round 1 的方案判断仍成立：直接使用 Ant Design `size="small"`，不造轮子、不合并两个独立
后台、不改变 owner 或 Journey，复杂度与收益匹配。

## UI 与交互

`NOT_APPLICABLE_WITH_REASON`：不涉及新的 UI 操作或交互；本轮只复核表格密度，不改变用户
操作、反馈、权限、owner readback 或恢复路径，也没有宣称浏览器/L2 PASS。

## 最小输入与当前字节复核

Round 2 输入链：

```text
doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-independent-review-input.md
ab602a350f9ccb5aafc6bf42cd4e1c2a39ef0f7dc72e0b409babe34e541a499c

doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-independent-review-round1.md
(当前字节由本轮读取；Round 1 报告中的自身 hash 不作为本轮结论前提)

doc/plans/platform/2026-08-05-v2s-dual-admin-protable-compact-implementation-design.md
74cbf0394df0be0c160522bf6980f570f5989142b981dd986ae43aa02476ba7c
scripts/check/protable-compact.mjs
b0a03bd9a38e82df572f2fffbfa3275de826f91571cd97ea2607cedf54ed142f
doc/review/platform/2026-08-05-v2s-dual-admin-protable-compact-focused-proof.json
885c38226cde8d8d1221cc00fb73d1d8c99a8f4aa3c4a5e772a6cd81a7e1e172
doc/evidence/platform/2026-08-05-v2s-dual-admin-protable-compact-exit.json
b5ec42955f599e4ee5f5007dacd72e2c1fc88c125ca2f813756578f3592952d1
.runtime/compliance-control/active-package.json
3c3abbe5c48703032aa6dc04f92b301b9bb7bf4eb15f77aaac18c901274b2aa3
```

`AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`、current Roadmap、六个 kernel、两条合法
platform-admin/operations-admin routed memory 命令、standards matrix、verification
governance、compact standard 与 Round 1 报告均已回读。Round 1 后作者 input 中的非法
`consumer-face frontend` 已改为两个合法 consumer face，当前文本正确；但其表内的
active-package、focused-proof、exit-evidence SHA 仍是旧值，与上面的当前字节不一致。

## 定向核验

### 1. source/checker 与 red mutation

独立当前执行：

```text
node scripts/check/protable-compact.mjs --self-test
PROTABLE_COMPACT_SELF_TEST=PASS
RED_MISSING_SIZE=PASS

node scripts/check/protable-compact.mjs
PROTABLE_COMPACT=PASS
PROTABLE_INSTANCES=13
PROTABLE_FILES=12
PLATFORM_ADMIN=8
OPERATIONS_ADMIN=5
```

独立扫描仍只发现两后台 12 个生产文件中的 13 个 `<ProTable>`；逐处首属性仍为
`size="small"`。Round 1 scratchpad 的 `size="medium"` 变异仍会输出
`PROTABLE_COMPACT_MISSING` 并以 `PROTABLE_COMPACT_FAIL` 退出，未见回归。

### 2. focused proof 与测试声明

当前 focused proof 已包含：两个 app typecheck PASS、operations-admin 全部测试 PASS、
platform-admin `7 pass/2 pre-existing architecture assertions`，以及“移除全部 compact
属性后 scratchpad 仍复现两失败”的 baseline 说明。独立当前重跑确认：两个 typecheck exit 0；
operations-admin 16 architecture tests 与 28 Vitest files/76 tests PASS；platform-admin 两
个既有 architecture 失败仍为同一两条，不是本包 compact 回归。

### 3. exit status、六类 denominator、predecessor 与 review 引用

当前 exit 的 package、scope、六类 denominator、业务/cleanup N/A、predecessor package/hash
均与 active package 和 predecessor exit 字节一致；predecessor exit hash
`00e219fe79975fa10dff4b3357bdceb0000a245a04c1f33fa1f350f936da104f` 可复算。

但当前 exit 的 independent review 仍只引用 Round 1：
`reviewRound=1`、`path=...independent-review-round1.md`，status 已是
`IMPLEMENTATION_GO_INDEPENDENT_REVIEWED`。Round 2 final artifact 尚不存在于该 exit 的
review 引用中，因此在 Round 2 report 写入前，package exit 不能诚实地声称已完成本 cycle
最终独立复核。

## 审查意见复核

Round 1 的 N-01（非法 routed command）在当前 input 文本中已关闭；N-03（focused proof
缺少 typecheck/test）已关闭。N-02（无浏览器视觉 PASS）仍是已登记且不越界的非阻断 note。
这些处置状态分别按 `CONFIRMED`、`PARTIALLY_CONFIRMED` 与
`UNVERIFIED_REQUIRES_EVIDENCE` 重新对照当前证据；每项均重开源码/JSON/hash，检查反例和适用
边界，并保留更小修复与过度设计成本比较。
本轮新发现只基于当前文件 SHA 和 exit review binding 的事实；适用边界是“当前 package exit
在最终 Round 2 复核前必须能绑定最终 artifact”，不是生产 UI 代码本身。更小修复是更新
input 的三个旧 hash，并在 exit 的 review 节点绑定 Round 2 path/hash 与
`reviewRound=2`/`ROUND_FINAL_DECISION=SELF_DECIDED`；不需要改生产代码或新增动态环境。

## 闭环核验

源码 13/13、checker/self-test/red mutation、两个 typecheck、operations tests、platform
baseline separation、六类 denominator、predecessor hash 与 package boundary 均已核对。唯一
未闭环项是最终 review artifact 尚未写回 exit binding，以及 input checklist 的三项 stale SHA。

## 实施代码核验

已重新读取所有实际生产 ProTable 源码并执行 checker、编译 typecheck/测试与 baseline 复现，
保留 executable evidence，并复查业务用户行为与业务结果边界；未启动
runtime、DEV/UAT、浏览器、seed/reset 或 Git。

## Findings

### S-01 — Round 2 输入 hash 与最终 exit review binding 尚未收口

- 状态：`CONFIRMED`
- 证据：input 当前仍记录 active-package `1ac321...`、focused-proof
  `872b55...`、exit `6ac4bc...`，而当前字节分别为 `3c3abb...`、`885c38...`、`b5ec42...`。
  当前 exit 的 `review.independentImplementation` 仍只有 Round 1 path/reviewRound=1；
  Round 2 final report 尚未被绑定。
- 影响：强制 reviewer input path+hash 与 package-exit 最终独立 review 的证据链暂不具备
  当前字节 set equality；不能在该状态把 `IMPLEMENTATION_GO_INDEPENDENT_REVIEWED` 当作本
  cycle final closure。
- 最小修复：更新 input 三个 SHA；Round 2 report 写入后，在 exit 的 independentImplementation
  节点绑定 Round 2 path 的当前 SHA、`reviewRound=2`、`reviewRoundLimit=2`、
  `ROUND_FINAL_DECISION=SELF_DECIDED` 与本轮 verdict。该修复不改变生产源码、分母或业务边界。

## 结论

当前字节的最终定向复核：

```text
NO-GO | M=0 / S=1 / N=1
VERDICT=NO_GO
```

NO-GO 仅由 S-01 的证据绑定未收口造成；ProTable 实现本身仍为 13/13 PASS，Round 1 N-02
仍为非阻断 note。完成最小 evidence/hash/binding 收口后，不需要第三轮 reviewer；本 Round 2
是该 cycle 的 hard stop。

## Authorization boundary

本 verdict 仅覆盖 `DUAL-ADMIN-PROTABLE-COMPACT-20260805` 的 implementation source、checker、
focused proof、exit evidence 与独立 review binding。它不授权 backend、contract、database/
migration、DEV/UAT、HTTP/L2、runtime deployment、seed/reset 或 Git/仓库控制动作。
