---
title: v2s Codex hooks 配置兼容性修复独立复核(Claude)
type: review
status: DELIVERED
scope: R2_CONTROL_PLANE_DEFECT_FIX
programId: V2S_W0_W4_EXECUTION
reviewer: Claude
createdAt: 2026-07-24
requestRef: doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-request.md
---

# v2s Codex hooks 配置兼容性修复独立复核

## 结论

**NO-GO(1 M / 1 S / 2 N)**——缺陷诊断与修复方案本身是对的,但**修好的 checker 没有落进仓库**,交付态此刻过不了自己的门。

会话口径披露:本复核由 all-v2 续接会话执行,全部判断基于 v2s 仓当前文件的新鲜读取与新鲜命令输出。

## 方案合理性判断(强制段落)

修复方向正确且右尺寸:客户端 parser 是外部真相,配置向真实 schema 归一是唯一正解;三事件/命令/5s timeout 分母不变;checker 按真实嵌套结构校验并新增两类 schema red control;用原生启动路径复验而非绕过 parser。替代方案比较:把真实客户端调用塞进门内(错——确定性门里不该有 LLM 会话,probe 归 evidence、门钉形状,作者的选择正确);干脆删除仓内 hooks(错——丢掉生命周期治理)。对"用户真正要什么"的检验:Dexter 要的是 fresh Codex 会话在 v2s 根可靠拿到上下文,本修复正中该需求。**值得表扬**:发现客户端 exit code 为 0 而错误在 event 流里,把回归证据定义为验信号而非验退出码,这是真实假绿教训的正确沉淀。问题全部出在落地环节,不在设计。

## Findings

### M-1 修复后的 agent-lifecycle 未落盘,交付态门为红

- 位置:`scripts/check/agent-lifecycle`(mtime 18:52:28,sha256 `d1e59383…`)。
- 事实:该文件的生产校验块仍是 legacy 逻辑(断言顶层 `schemaVersion===1` 与扁平 `[0].command`),对已交付的新 `.codex/hooks.json` **静默 exit 2**;fresh 运行 `scripts/check/agent-lifecycle` 此刻即 FAIL(零输出),连带 `scripts/check/foundation-standard-actions` 在 `PROVIDER_FREE_CONTEXT=PASS` 后中途 exit 2。全仓搜索不存在任何包含新提取路径 `.hooks.<Event>[0].hooks[0].command` 的文件——声称的新版 checker 从未写入仓库。
- 影响:fix 包核心主张("checker 改为验证真实嵌套结构")对交付树不成立;evidence 自报的 fresh PASS 无法复现。
- 最小修复:真正落盘新 checker(event-group/typed-command 校验 + 新提取路径 + 两类 schema red control + 失败时输出精确 REASON 而非静默 exit),fresh 复跑全部十门,刷新声明哈希后重发 request。无需 Dexter 裁决(在已授权缺陷修复范围内)。

### S-1 评审包哈希绑定断裂,evidence 产自非交付态

- 事实:request 声明 `AGENT_LIFECYCLE_SHA256=0a82ac8d…`;resolution 声明 before=`583372ce…`/after=`0a82ac8d…`;实际交付文件是第三个哈希 `d1e59383…`,与两者都不符。fix evidence 中的 fresh 运行、scratch 变异与门 PASS 记录,只能产自某个未交付的工作态。
- 影响:若 reviewer 不逐一复算哈希,将把未交付版本的验证结果当成交付态证据——这正是本项目哈希纪律要防的 stale review chain。
- 最小修复:落盘后以**交付树**重新生成全部验证记录与三处哈希声明,保证 request/resolution/evidence/实文件四方一致。

### N-1 原生客户端探针在我的环境不可复现

`codex` 二进制不在本评审 shell 的 PATH 上,原生启动路径复验保持为 Codex 机器侧证据,按纪律记 `UNVERIFIED_CLIENT_UNAVAILABLE`,不升格 PASS。我完成的替代核验:新 hooks.json 顶层仅 `hooks`,与客户端报错语法("expected `description` or `hooks`")一致;event group/typed-command/5s timeout 分母与批准值一致;originalFailure 的完整报错信号可作为信号检测的真红样本。下一轮可由 Dexter 在本机跑一次探针补齐,或接受 Codex 侧记录。

### N-2 缺少客户端版本变更的再探针触发器

本缺陷的根教训是"checker 形状 ≠ 客户端 parser,客户端升级即腐烂"。fix evidence 记录了 client 0.144.6,但没有任何机制绑定未来升级。建议:在 `HANDOFF.md` 登记一条可判定触发器("codex-cli 版本变更 → 重跑原生启动探针并留信号证据"),零基建、符合阶段标尺。无需 Dexter 裁决。

## 已核验未受损的部分

- `.codex/hooks.json` 哈希与声明一致(`82b43833…`),schema 结构核验通过;
- 三个 hook 脚本未改(mtime 17:08/17:12,resolution 声明 hookScriptsChanged=false 相符);
- R1 immutable 三哈希(implementationClosure `e1bcbf43…`、postTransferClosure `80935592…`、transferReceipt `61bf4f47…`)全部复算一致;
- Roadmap(`a36fc88b…`)/standards matrix(`358dc6be…`)未变,Registry 仍唯一解析 R2 `IN_REVIEW`;
- 其余八门(standards-coverage R2/self-test、project-memory、provider-free-context、roadmap-program-registry、roadmap-control-plane-transfer、handoff-debt、heritage-registry)fresh 全 PASS;
- 无 apps/migration/DEV/seed/reset/数据库/Heritage 回写;Git 仍仅 Dexter 的 Initial commit。

## 复审关闭条件

M-1/S-1 修复落盘后:reviewer fresh 复跑十门全绿、在 scratch copy 独立变异"加回 schemaVersion"与"扁平 SessionStart"确认生产 validator 精确真红、复算四方哈希一致,即可转 GO。该 GO 仍不关闭 fresh R2 acceptance,不授权 R3/W1、业务代码、DEV、seed/reset、数据库、切流或 Git 写操作。
