---
title: v2s 设计法治 Batch 1.5 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/decisions/2026-07-25-v2s-design-governance-batch-1-5.md
reviewer: Claude
createdAt: 2026-07-25
---

# v2s 设计法治 Batch 1.5 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=3
```

四项增补全部按批准范围落地且未越界:N-1 已修;十份 Heritage 出处三方(source/frozen/registry)零漂移且**不构成 fallback**;三项 vendor skill 本仓冻结、壳内权威边界与 Git/自动推进剪除齐全;高保真 demo 规则可选、静态、可追溯。未启动第二批,未恢复 J02。三条 N 均一句话级修复。

## 亲验记录

1. **N-1**:全模板表格列数扫描,原 8 vs 7 不匹配已消除,无其他错列。
2. **Heritage 三方哈希**:23 项 selected assets(13 原有 + 10 新增)source 侧(../catering-all-v2)与 frozen target 侧共 46 次复算,与 registry `expectedSha256` 全部一致;`scripts/check/heritage-registry` fresh PASS。
3. **红控独立变异(scratchpad,最小重建源仓结构后先取全绿基线)**:①冻结副本改一字节 → `HERITAGE_COPY_HASH_MISMATCH`,文件级定位精确;②源仓原文追加一行 → `HERITAGE_SOURCE_HASH_MISMATCH`,定位精确;③逐次还原后基线回绿。字节等价与源漂移两类检测都是真的。
4. **vendor 冻结**:manifest 三条 `sourceSha256` 与三份 `VENDOR-SKILL.md` 复算一致;`runtimeFetch=false`、`FROZEN_SOURCE_PLUS_CS_ADAPTER_ONLY` 落盘;三个 cs- 壳逐份检查——权威边界声明(AGENTS.md/Roadmap/模板最高)、阶段绑定(brainstorming=Journey 裁决前 / writing-plans=已接受 Journey+看图后 / systematic-debugging=已授权实现期)、`SKILL_USED=<adapter>@<完整 vendor hash>` 回执格式、无 Git/worktree/自动推进/自动分派指令,全部符合收编纪律。
5. **模板增补**:§7 B.4/B.5 命中对照(条文号+遵循方式+冻结原文 path@hash,不适用须说明)、§8 demo 台账(路径/升级原因/假数据出处与水印/视觉基线"摹自 all-v2 path@sha256"/两级看图 `DEXTER_HIFI_REVIEW`)、mockups 目录与零引用规则、R4 才建机械检查——与授权四条规矩逐条对应;demo 为可选且默认线框。
6. **checklist 与门**:`JOURNEY_INTERACTION_REVIEW` 已含 B.4/B.5 对照与 SKILL_USED 人审语句;`standards-coverage --phase R3` PASS(150,分母未动);未新建任何语义 checker。
7. **边界**:Roadmap `CURRENT_ACTIVITY=DESIGN_GOVERNANCE_BATCH_1_5`、`R3_DESIGN_STATUS=PENDING_RECOVERY` 保持;工作树无 mockup/app/contract 产物;无第二批 inventory 迹象。

## Findings

### N-1:vendor manifest 记录本机绝对路径

`.agents/skills/vendor/superpowers-6.2.0/manifest.json` 的三条 `sourcePath` 为 `/Users/dexter/.codex/plugins/cache/...` 本机绝对路径——跨机不可复核,且违反本仓"文档禁本机绝对路径"惯例。**最小修复**:改为语义出处(如 `codex-plugin-cache:openai-curated-remote/superpowers/6.2.0/skills/<name>/SKILL.md`),hash 保留为唯一核验锚。不需 Dexter 裁决。

### N-2:checklist 未提两级看图/demo 台账证据

`JOURNEY_INTERACTION_REVIEW` 的 requiredEvidence 已含 B.4/B.5 与 SKILL_USED,但未提"按需高保真 demo 台账与 `DEXTER_HIFI_REVIEW` 结论"。人审时可能漏查 hifi 台账。**最小修复**:该字符串追加一短句。不需 Dexter 裁决。

### N-3:heritage-registry self-test 三个红夹具失败码同为 DENOMINATOR_MISMATCH

`--self-test` 的 `selected-asset-hash-drift` 等三个夹具 EXPECTED=FAIL/ACTUAL=FAIL 通过,但失败码均为 `HERITAGE_REGISTRY_DENOMINATOR_MISMATCH`,未命中各自名义错误类(hash drift 应命中 HASH_MISMATCH 类)。生产行为经我独立变异证明精确无假绿,故只是夹具构造在触发目标错误前先绊在分母检查上。**最小修复**:修正夹具使每类红命中自身错误码。不需 Dexter 裁决。

## 授权边界

本 GO 仅评估 Batch 1.5,连同第一批 GO 一起交 Dexter 接受。不授权 R3/W1 implementation、contract、migration、app、DEV、数据库、动态运行、seed/reset 或任何 Git 操作;Dexter 接受前不得启动第二批 R3–R6 Journey inventory 或恢复 J02。Git 归 Dexter。
