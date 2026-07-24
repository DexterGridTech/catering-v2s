---
title: v2s Codex hooks 配置兼容性缺陷 resolution
type: defect-resolution
status: FIXED_PENDING_REREVIEW
programId: V2S_W0_W4_EXECUTION
roadmapStep: R2
createdAt: 2026-07-24
authorizedBy: Dexter
implementationOwner: Codex
---

# v2s Codex hooks 配置兼容性缺陷 resolution

## 现象与边界

从 `catering-v2s` 根开启 fresh Codex 会话时，Codex 0.144.6 在执行任何仓内 hook 前报告：

```text
failed to parse hooks config .../.codex/hooks.json: unknown field `schemaVersion`, expected `description` or `hooks` at line 2 column 17
```

Dexter 已明确授权修复 hook schema 兼容性、回归门与缺陷证据。本修复不关闭 R2 acceptance，不进入 R3/W1，不启动 DEV，不触碰数据库、seed/reset、Heritage 或 Git。

## 根因

1. `.codex/hooks.json` 顶层包含当前 Codex parser 不接受的 `schemaVersion`。
2. 三个 lifecycle event 使用旧的扁平 `{command,timeout}` 条目；当前 parser 需要 event group 的 `hooks` 数组，内部命令为 `{type:"command",command,timeout}`。
3. `scripts/check/agent-lifecycle` 把旧 schema 写成自己的 expected value，并直接读取 `.hooks.<Event>[0].command` 执行脚本。它验证了脚本行为，却绕过了客户端配置解析，因此产生假绿。

## 修复

- `.codex/hooks.json` 改为当前 Codex 可解析的 event-group/typed-command 结构；事件、命令与 5 秒 timeout 分母不变。
- `scripts/check/agent-lifecycle` 改为验证并读取真实嵌套结构，再执行三个生产注册命令。
- 同一 production validator 新增两类 red control：
  - 加回未知顶层 `schemaVersion` 必须失败；
  - 把 `SessionStart` 改回扁平注册必须失败。
- 使用原始 Codex 启动路径复验，确认不再出现 hook parse failure；该 probe 不冒充 fresh R2 acceptance。

## Claude NO-GO 后的处置

Claude 首轮独立复核文件：

```text
path=doc/review/platform/2026-07-24-v2s-hooks-config-compatibility-review-claude.md
sha256=3dd5c02bc514a1969c2ce452faa7218437d68503240640f321fa00a55e8fdf3e
verdict=NO-GO(1 M / 1 S / 2 N)
reviewerObservedAgentLifecycleSha256Prefix=d1e59383
```

M-1/S-1 的结论对 reviewer 当时观察到的交付视图成立，原评审保持不改。收到 NO-GO 后，Codex 重新从 v2s 当前路径读取实际文件，得到：

```text
currentAgentLifecycleSha256=0a82ac8d9dc78e80426491837f4b935d7c2729bf9dc1ad4f1811f7ee0e0698ac
currentContainsNestedCommandExtraction=true
currentContainsUnknownTopLevelRed=true
currentContainsFlatRegistrationRed=true
freshAgentLifecycle=PASS
freshFoundationStandardActions=PASS
```

当前仓与同级工作区未找到 `d1e59383…` 对应 checker，且仓内材料无法证明两个观察视图为何不同。因此本 resolution 不伪造原因、不删除 NO-GO，也不对已经正确的 checker 做无意义重写；而是新增 post-NO-GO closure，以当前交付 bytes 重新跑全门、重算四方 hash 并要求 Claude 复审。

N-1 保持 `UNVERIFIED_CLIENT_UNAVAILABLE` 作为 Claude 环境事实；Codex 本机原生 probe 单独记录，二者不互相冒充。

N-2 接受“客户端版本变化必须重跑原生 probe”的意图，但不把它加入 `HANDOFF.md`：该文件由冻结输入限定为精确七项生产化欠账，新增第八项会令 `scripts/check/handoff-debt` 合理失败。可判定 trigger `CODEX_CLI_VERSION_CHANGED` 改登记在 `scripts/README.md#Codex hooks 客户端兼容性`，并由本 evidence 的 `clientReprobePolicy` 绑定；它属于 AI 控制面维护规则，不是生产化欠账。

## 同类扫描

```text
scanScope=catering-v2s .codex/scripts/tools/doc/project-memory/contracts
otherHooksConfigFilesInRepository=0
staleFlatLifecycleCommandAccesses=0
hookScriptsChanged=false
```

仓内其他 `schemaVersion` 属于各自 JSON contract、session marker 或 evidence schema，不是 Codex hooks 顶层字段，予以保留。

## Create / update / delete / retain

Create：

- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json`
- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-post-no-go-closure.json`
- 本 resolution
- Claude review/rereview request

Update：

- `.codex/hooks.json`
- `scripts/check/agent-lifecycle`
- `scripts/README.md`

Delete：无。

Retain：

- `scripts/hooks/session-start`
- `scripts/hooks/prompt-route`
- `scripts/hooks/stop`
- R1 immutable implementation closure、post-transfer closure 与 transfer receipt
- Roadmap `CURRENT_STEP=R2 / CURRENT_STATUS=IN_REVIEW`
- `R2_AUTHORIZED=false`、`V2S_WRITE_AUTHORITY=false` 及全部 R3/W1/runtime/data/Git 红线

## 证据

权威机器证据：

- `doc/evidence/platform/2026-07-24-v2s-hooks-config-compatibility-fix.json`

修复前后关键 hash：

```text
.codex/hooks.json.before=030978be945752d9da748d43035501055566f6a1e39e54b57b69b6974f242141
.codex/hooks.json.after=82b43833b89f257cc8d7b4431215a325bee6f5b5cf6f9eb82f3455a02bbfaafe
scripts/check/agent-lifecycle.before=583372cebe75f9e609103fa621744542e60b4af5e6c861e3daf4e8a2fe7e820b
scripts/check/agent-lifecycle.after=0a82ac8d9dc78e80426491837f4b935d7c2729bf9dc1ad4f1811f7ee0e0698ac
```

R1 immutable evidence 未修改：

```text
implementationClosure=e1bcbf43c8c6a0b475e14169ebc0e0dcc1248e54bbefc8097a384ed1ae1add91
postTransferClosure=8093559204490c147aa9cf8ff0828c9441428f85b53b8ca0dafe03e86f4d5b21
transferReceipt=61bf4f4729efbb5bfbd8d5cbea1c43987503067c306deaf28a34ce7e350cefda
```

## Review 关闭条件

独立 reviewer 必须：

1. 从 v2s 根读取生产 `.codex/hooks.json` 和 checker，不能只采信本 resolution；
2. fresh 运行 `scripts/check/agent-lifecycle`，确认两类 schema red control 与原有 hook 行为 red controls 全部真红/真绿；
3. 用 scratch copy 独立变异未知顶层字段及扁平 event 注册，确认生产 validator 精确失败；
4. 使用本机 Codex 原生启动路径确认没有 hook parse failure；
5. 复跑 R2 standards、provider-free、foundation、Registry/transfer/Heritage gates；
6. 确认 Roadmap 仍停在 R2 `IN_REVIEW`，且 R1 immutable hashes、all-v2 Heritage、Git 与 runtime/data 边界未改变。

只有 `GO(0 M / 0 S / N*)` 才表示本缺陷修复可接受；该 GO 也不自动关闭 R2 或授权 R3/W1。
