# RM1 U09 — Claude round-2 finding intake and Dexter decision disposition

`REVIEW_TARGET=DESIGN`。本件是作者对两份已冻结 Claude review 的 source-first intake，不改写其 verdict，
不构成第三轮独立审查，也不授权 implementation、contract、owner、codegen、DEV 或动态运行。

## 输入与回读范围

- `doc/review/platform/2026-07-29-v2s-rm1-p6-whole-scope-interaction-review-round2-claude.md`：历史 `GO, M=0/S=1/N=3`；
- `doc/review/platform/2026-07-29-v2s-rm1-p6-extension-chain-and-recovery-retirement-review-claude.md`：历史 `NO-GO, M=1/S=4/N=1`；
- Dexter 2026-07-29 四项裁决：K04 保留、实体扩展字段写请求不带 definition revision、无“经营资料”可见分组、DEV/UAT 展示受控测试验证码；
- owning sources：五类实体 create/update 调用、三个 definition read、全量 `@PostMapping|@PatchMapping|@PutMapping|@DeleteMapping`、IA01/03/04/05、P6 preparation 与 action ledger。

## 逐项处置

| review finding | source-first 结论 | 处置与最小修复 | 反例 / 边界 |
| --- | --- | --- | --- |
| K04 与 X09–X11 应退役 | `DEXTER_DECISION`：不退役 | K04、X09–X11、K=20 与 56 条业务动作分母保持不变；不得把其保留误记为旧 public completion flow 仍可替代 authenticated recovery。 | K04 是已认证管理员 recovery；X09–X11 才是旧公开完成链。 |
| 五类实体 extension revision 写入链 | `CONFIRMED` | IA04 §12.4 固化 `GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL`：五 host × create/edit 的 10 条 request、edge 传递与 owner CAS 一并移除；保留 current definition 无条件校验和 owner read-only trace。 | Store create 当前无 request revision 但 edge 传 `0L`；不能反向补 request revision。 |
| definition 与实体使用链没有闭合 | `CONFIRMED` | IA03/IA04 的 12 个读写 screen 均已在用户可见文案、线框和 ownership roster 中标出原生字段后的动态槽位；模板将此三处对账升为强制标准。 | 无启用 definition 时不显示动态字段；不得借此造“经营资料/补充资料”分组。 |
| 56 行台账并非逐端点一一对应 | `CONFIRMED` | ledger 明确为 business action → endpoint 的多对多映射：56 行映 59 个 endpoint；加 19 个排除行，`59+19=78`。C01 展开五 endpoint，S04/S05 说明一 endpoint 对两个业务 surface。 | `selectContext/selectDataNode` 是已认证提交但不属于 C/S/K/P 实体、凭据、任职或邀请 mutation；不挪入 56。 |
| 旧 P-N1 禁止所有测试码而 Dexter 要 DEV/UAT 展示 | `DEXTER_DECISION`，原始矛盾已消解 | P6 preparation §8.1 是显名 amendment：仅 server config `platform.otp.debug-code-exposure` 控制，DEV/UAT 显式 true，生产 false；off 时可选字段省略，client 仅在 owner 返回本次非空测试验证码时显示提示。 | 生产空字符串不是合格替代；验证码随机且不能由 session、request、URL 或前端开关推导。 |

## 可审计结果

本 intake 的问题族、有限分母、扫描面、反例和 prevention set equality 在
`rm1-u09-claude-round2-problem-family-discovery.json`。保留的 implementation-facing GAP 仅是设计后的未来关闭条件，
不是已实现事实：`GAP-ENTITY-EXTENSION-REQUEST-REVISION-REMOVAL`、既有 candidate/list/authorization recovery GAP。
本次未修改历史 review、Roadmap、生产源码或契约。
