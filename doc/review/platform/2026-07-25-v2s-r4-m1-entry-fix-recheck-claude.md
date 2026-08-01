---
title: R4 M-1 标准入口修复即时复核
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-25
sessionProvenance: fresh v2s-rooted;评审仓经 smbfs 挂载(本复核关键上下文)
---

# R4 M-1 标准入口修复即时复核

## 结论

```text
VERDICT=GO
M=0  S=0  N=3
```

**Readback 收口记录(2026-07-25)**:Dexter 在源机执行 `shasum -a 256 scripts/verify`,回报完整哈希 `c607e045189b0425600358b252b1b4612d21e603adeb2431180d46d6a9708b2c`——与 `r4-verify-evidence.json` 的 entrypoint 声明及 closure 绑定**逐字一致**。M-1 关闭,按本文件预写条件即时转无条件 GO。我侧 smbfs 视图在收口时刻仍供旧字节(2ea9a2a7…),再次证实为缓存假字节而非交付缺陷;SMB 分歧第二案归档,N-3 建议(入口类小文件 evidence 附双哈希/内容片段)维持进 HANDOFF。

除入口文件本体外,一切吻合:evidence 内部自洽、目标 verifier 哈希与 closure 绑定逐字一致、business/cleanup 字段如实(`NOT_APPLICABLE_R4_TECHNICAL_STEP`/`PASS`)。唯一分歧点呈现出与 2026-07-24 hooks 事件**完全相同的 SMB 假字节指纹**,按既定仲裁纪律处置,不以我侧视图定罪。

## 亲验记录与视图分歧

1. **我侧视图**:`scripts/verify` mtime=20:46(刚被重写)但内容仍为旧字节(第 4 行指向 `tools/r4-gates/`,哈希 `2ea9a2a7…`);fresh 运行仍 `MODULE_NOT_FOUND`,exit=1。
2. **对方声明与旁证**:`r4-verify-evidence.json` 声明入口哈希 `c607e045…`、`resolvedTarget=tools/verify-gates/verify.mjs`;closure evidence 绑定同哈希;**目标文件 `tools/verify-gates/verify.mjs` 我侧复算 `2826facc…` 与 closure 绑定逐字一致**——即改名后的整套工具链在我侧视图都是新的,唯独 wrapper 一个文件是旧的。
3. **定性**:单文件"元数据新/内容旧"+周边文件全新鲜,是 smbfs 缓存污染的特征形态(踩坑台账第 6 条,2026-07-24 曾致我误发 NO-GO 后撤回)。本次按纪律**先怀疑我侧视图**;因该文件未入 git 对象库,无法 `git show` 仲裁,亦不要求任何仓库控制动作。

## 唯一确认动作(读操作,非任何控制动作)

请 Dexter 在其机器上执行 `shasum -a 256 scripts/verify` 并回报前 8 位:

- 若为 `c607e045` → M-1 关闭,本复核**即时转无条件 GO(0 M / 0 S / 3 N)**,无需再送我;
- 若仍为 `2ea9a2a7` → 修复未落盘,M-1 维持,Codex 重新保存后再走本复核。

## Findings(均 N)

- **N-1(承继)**:8 条机械切片台账(R5 首 UI 波接线)——上轮已登记,待办不变。
- **N-2(承继)**:我侧无 Docker,Testcontainers 层采信 evidence(其运行记录含 business/cleanup 分账),`UNVERIFIED_BY_ME_ENV` 如实标注。
- **N-3(新,登记性)**:SMB 视图分歧本次为第二次发生;建议(不阻断)未来 evidence 对入口类关键小文件附"内容前 N 字节"或双哈希(内容+规范化),便于跨机快速自判;该建议进 HANDOFF 欠账即可,不建门。

## Part B/C/D 章节对照

上一轮 delta review 的对照表(remediation 后版本)持续适用,本次无任何章的承接变化。

## 授权边界

仅复核 M-1 与 fresh evidence;不重开已收口的独立对抗审查 cycle;不授权新业务 Journey、UI、operations-admin 真实登录、TDP runtime、DEV、seed 或 reset。Git 归 Dexter。
