---
title: v2s Codex hooks 配置兼容性修复复审(Claude,post-NO-GO)
type: review
status: DELIVERED
scope: R2_CONTROL_PLANE_DEFECT_FIX_REREVIEW
programId: V2S_W0_W4_EXECUTION
reviewer: Claude
createdAt: 2026-07-24
requestRef: doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-request.md
priorReviewRef: doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-claude.md
boundCommit: 331984e8147e435e1ac7029f66fe38ff9cc8214e
---

# v2s Codex hooks 配置兼容性修复复审

## 结论

**GO(0 M / 0 S / 2 N)**——修复真实、落盘、可失败、无退化;上一轮 NO-GO 的 M-1 归因("修好的门未落盘")**在此正式撤回**:字节早已交付,是我这侧 SMB 挂载的陈旧数据缓存污染了评审视图。上轮评审文件按不可变保留(sha256 `3dd5c02b…` 已核对),本复审绑定 Dexter 的 commit `331984e8`。

会话口径披露:本复审仍由 all-v2 续接会话执行;鉴于视图污染,本轮全部关键字节改由 **git 对象库**(`git show`/`git archive HEAD`)读取,彻底绕开 VFS 缓存,并在 scratchpad 提取树上执行门与变异。

## View divergence 的裁定(request 要求"保留未解释分歧"→ 现已解释并有证据)

- 我侧 VFS 读到的 `d1e59383…` 文件 = **90 行纯旧逻辑 + NUL(0x00)填充到新尺寸 7584 字节**(xxd 实证);其中 0 个新版特征字符串。
- `git show HEAD:scripts/check/agent-lifecycle` = **`0a82ac8d…`**,与 Codex 声明精确一致;hooks.json/README 的 HEAD 哈希同样吻合。
- 机制:macOS smbfs(`//dexter@192.168.0.172/idea`)刷新了 size/mtime 元数据但对已缓存文件继续供给旧数据页,超出旧 EOF 部分补零;晚于首读创建的新文件(closure、request 等)不受影响——与观测完全吻合。
- 附带方法论警告:此拓扑下 `git status` 干净是 stat 捷径(size/mtime 与 index 一致即跳过读内容),**不能**作为内容一致性证明;必须用 `git show | shasum` 对象级核验。

## 独立核验记录(全部亲验于 commit 331984e8 的提取树)

1. `scripts/check/agent-lifecycle` fresh PASS,输出含内嵌两类 schema 红(`HOOKS_UNKNOWN_TOP_LEVEL_RED/HOOKS_FLAT_REGISTRATION_RED`)与原有全部控制(SESSION_START_CONTRACT、PROMPT_SOURCE_INJECTION_RED、STOP_NO_MARKER/NONE_AND_CLEAN/INVALID_INPUT/ACTIVE_GOAL/CLEANUP 五类)——**无退化**。
2. 源码通读:`validate_hooks_config` 为真生产 validator——顶层键精确 `hooks`、事件集精确三事件、event group 形状 `{hooks:[…]}`、typed command `{type:"command",command,timeout:5}` 键集精确;失败输出 `HOOKS_CONFIG=FAIL + REASON=<精确原因>`(静默 exit 缺陷一并修复);命令提取路径确为 `.hooks.<Event>[0].hooks[0].command`(85-87 行)。
3. 我的独立变异(提取树上,原仓零写入):加回顶层 `schemaVersion` → exit 2 `REASON=top-level keys must be exactly hooks`;扁平化 SessionStart → exit 2 `REASON=invalid event group: SessionStart`;恢复后 PASS。精确真红。
4. 其余门:foundation-standard-actions、standards-coverage(--phase R2 与 --self-test)、project-memory、handoff-debt、roadmap-program-registry 在提取树 PASS;heritage-registry 在提取树报 `HERITAGE_REPOSITORY_MISSING` 属提取位置伪影(需同级 all-v2 仓),在真实挂载点 fresh PASS;handoff-debt 真实挂载点亦 PASS。
5. 哈希:真树 roadmap `a36fc88b…`、matrix `358dc6be…`、R1 immutable 三哈希(`e1bcbf43…`/`80935592…`/`61bf4f47…`)全部一致;HANDOFF 精确七项、激活 token 全部可判定。
6. Git:全部两个 commit(`5b08350`、`331984e8`)作者均为 Dexter;Codex 无任何 stage/commit/push。无 apps/migration/DEV/seed/reset/数据库/Heritage 回写。
7. `scripts/README.md` 新增"Codex hooks 客户端兼容性"节:`CODEX_CLI_VERSION_CHANGED` 精确触发、完整 event stream 扫描、"禁止只看 exit code"、明确 checker 不能替代客户端 probe、且不污染 HANDOFF 七项——上轮 N-2 以右尺寸方式落地。

## 方案合理性判断(强制段落)

维持上轮判断:配置向真实客户端 schema 归一是唯一正解,probe 归 evidence、门钉形状的分工正确。本轮新增两点:(1) 把两类红夹具内嵌进**同一个生产 validator** 而非旁挂 self-test,消除了"展示不接线"的假绿空间,优于常见做法;(2) 再探针触发器放 README 规则而非 HANDOFF,守住了"HANDOFF=冻结生产化欠账"的语义边界。无过度工程,与阶段匹配。

## Findings

### N-1 评审字节通道需要固化为 commit 仲裁(建议,由 Dexter 定)

本次分歧证明:共享 SMB 目录上,实现方与评审方可能长时间看到不同字节,哈希纪律在 VFS 层会被缓存击穿。Dexter 本次的 commit 恰好同时解决了治理仲裁与缓存旁路。建议固化为常规:**每次 review request 绑定 commit hash,reviewer 对关键文件一律 `git show <commit>:<path>` 对象级核验**;分歧再现时以对象库为准并重挂载/清缓存。属 Git 节奏与基础设施,归 Dexter 裁决;不阻断本修复。

### N-2 原生客户端探针在评审环境不可复现(诚实保留,不阻断)

`codex` 二进制不在评审 shell PATH,原生启动路径复验保持 `UNVERIFIED_CLIENT_UNAVAILABLE`,不升格 PASS。接受依据:closure 记录了完整 event stream 扫描(parse failure 计数 0、ENTRY_PROBE_OK=1),且检测器的真红样本即 originalFailure 的完整报错信号;README 已把未来复验绑定到 `CODEX_CLI_VERSION_CHANGED`。如需彻底闭合,可由 Dexter 在任一侧机器跑一次探针留证。

## 授权边界

本 GO 仅确认 hooks 配置兼容性缺陷修复达到可接受条件;不关闭 fresh R2 acceptance,不授权 R3/W1、业务代码、DEV、seed/reset、数据库、生产切流或任何 Codex Git 写操作。状态推进由 Dexter 决定。
