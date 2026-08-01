---
title: design review post-remediation 绑定治理修订
status: ACTIVE_GOVERNANCE_AMENDMENT
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
decisionOwner: Codex under R5 remediation authority
implementationAuthority: false
---

# design review post-remediation 绑定治理修订

## 1. 问题

第二轮独立对抗审查是 hard stop，作者随后仍有责任 intake 并修复其 findings。旧 checker 只接受
`review.manifestSha256 == current manifest sha256`，于是任何真实修复都会永久触发
`REVIEW_MANIFEST_HASH_DRIFT`；回填旧 review 的 hash 又会伪造“reviewer 看过当前字节”。

## 2. 裁决

保留精确 hash 作为默认路径。只有同一 cycle 的第二轮已声明
`ROUND_FINAL_DECISION=SELF_DECIDED` 且禁止后续 Codex round 时，current manifest 才可声明：

```json
"postRemediationDeclaration": {
  "version": "POST_REMEDIATION_V1",
  "reviewCycleId": "<same cycle>",
  "reviewRound": 2,
  "reviewPath": "<round-two review>",
  "reviewSha256": "<actual review bytes>",
  "reviewedManifestSha256": "<review.manifestSha256>",
  "intake": {"path": "<author intake>", "sha256": "<actual intake bytes>"},
  "reason": "<why bytes changed>",
  "currentBytesNotReviewedByAdversarialReviewer": true,
  "claudeRecheckRequired": true,
  "implementationAuthority": false
}
```

checker 只机械验证字段、相等关系、review/intake 文件与 intake hash；不读 intake 语义、不判断
修复正确，也不把当前字节冒充独立子 agent 已审。输出必须区分：

- `EXACT_REVIEWED_MANIFEST`；
- `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`。

第二种只表示历史 review 与当前修复的 provenance 闭合；current bytes 仍必须交 Claude recheck，
Dexter 接受前不得称设计 GO，更不产生 implementation authority。

## 3. 禁止滥用

- round 1、未 hard-stop 的 review、不同 cycle 或允许第三轮时不得使用；
- declaration 缺 intake、review hash、reviewed manifest hash 或诚实声明时必须红；
- 不得修改历史 review 的 `manifestSha256`；
- 不得用该声明重置轮次或绕过 Claude/Dexter；
- 旧产物无声明时保持旧行为，不事后伪造 provenance。

## 4. 机械证明

`scripts/check/implementation-design-granularity --self-test` 必须包含：

1. manifest 漂移且无 declaration 真红；
2. 完整 declaration 可通过并输出不同 binding mode；
3. declaration 指向不存在 intake 真红。

本修订只修复治理自相矛盾，不新增业务 gate，不授权 R5 implementation。
