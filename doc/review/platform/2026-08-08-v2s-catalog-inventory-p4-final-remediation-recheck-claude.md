# P4 final acceptance remediation 静态 current-byte 复核（Claude）

复核对象：`contracts/policy/catalog-inventory-fixture-catalog.json`、
`contracts/policy/catalog-inventory-fixture-catalog.schema.json`、
`scripts/generate/catalog-inventory-p1.mjs`、`tools/catalog-inventory-p1/cli.mjs`、
`scripts/dev/catalog-inventory-seed-executor.mjs`。

前轮结论：`doc/review/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-review-claude.md`
（`GO — M=0 / S=1 / N=2`），原样保留不改写。

会话出处：fresh v2s-rooted 评审会话。本轮**只做静态复核**，
未执行 API、L2、DEV、reset、seed、数据库/migration、UAT、部署或 cleanup；
唯一执行的是只读的静态门与 self-test。

---

## 0. 结论

**GO — M=0 / S=0 / N=1**

前轮 S-01、N-01、N-02 三条全部真实闭合，且两条的收口方式优于我的建议。
唯一的 N 是证据件内缺一个标记，披露本身已在 remediation input 中做到位。

---

## 1. 五项核验

### ① cleanup 两角色分工 —— **闭合，且优于我的建议**

`seedExecutionPlan.cleanup` 已由单一口径改为双角色结构：

- `seed`：`strategy: "PASS_PRESERVED_DEV_STATE"`、
  `readback: "business readback complete; DEV facts retained"`、
  `destructiveCleanupOwner: "r5-reset"`；
- `reset`：`strategy: "MANAGED_RESET_RUN_SCOPED_REVERT"`、`mediaPurgeRequired: true`、
  `mediaNamespace: "run-scoped"`、`readback: "asset namespace absence"`、`owner: "r5-reset"`；
- 顶层保留 `businessAndCleanupSeparate: true`。

**我原本只建议改写 cleanup 口径，作者把原有的 `MANAGED_RESET_RUN_SCOPED_REVERT` 与
`mediaPurgeRequired: true` 整体迁到 reset 侧而不是删除**——这比单纯去掉那几句更好：
破坏性清理的义务没有消失，只是归属被写清楚了。
我前轮担心的"有人照契约修运行器去清媒体、毁掉 DEV 体验"的路径，
现在因为义务显式落在 `r5-reset` 而被堵住。

### ② BOM stage 复合身份与同名回归拒绝 —— **闭合**

`catalog-inventory-seed-executor.mjs:220–224` 的 `bomStageKey` 已改为
`[["owner", ownerCode], ["sku", skuCode], ["option", optionValueCode]]`
逐段 `name=encodeURIComponent(value)` 后以 `|` 连接。
**带名前缀消除了位置歧义，`encodeURIComponent` 消除了分隔符注入**，比单纯拼接更稳。

双向断言均在：

- **正向**（第 696–701 行）：同一 owner 下 `skuCode: "SAME-CODE"`、
  `optionValueCode: "SAME-CODE"`、两者皆空三种输入，
  必须产出 **3 个互异 key**，否则 `SEED_BOM_STAGE_IDENTITY_INVALID`；
- **反向红变异**（第 690–693 行）：以旧扁平实现对同样两个输入求值，
  必须坍缩为 `keys.size === 1` 才算变异被识别；
  第 702 行再统一要求每个 check 必须抛出，否则 `SEED_EXECUTOR_RED_MUTATION_NOT_REJECTED`。

这正是我前轮 N-01 点名的 same-name 场景，且覆盖方式是可证伪的。

### ③ `requiredIn` 全链路统一为 P4 —— **闭合**

- 生成器 `scripts/generate/catalog-inventory-p1.mjs:17`
  `const FULL_CATALOG_PARITY_DELIVERY_PHASE = "P4";`，
  第 777 行以该常量写入 `fullCatalogParity.requiredIn`——**单一声明点，不是三处副本**；
- 契约 `catalog-inventory-fixture-catalog.json` 现为 `"requiredIn": "P4"`；
- schema 声明了该字段；
- checker `tools/catalog-inventory-p1/cli.mjs` 断言
  `requiredIn === "P4" && …reductionIsNotFinalSeedPolicy === true`。

我另对 `contracts`、`scripts`、`tools` 全量检索 `requiredIn` 的 `P2` 口径，
**残留为 0**。链路四环闭合。

### ④ 静态门与红变异 —— **fresh 复跑全部通过**

- `node scripts/dev/catalog-inventory-seed-executor.mjs --self-test` →
  `CATALOG_INVENTORY_SEED_EXECUTOR_SELF_TEST=PASS`
- `node tools/catalog-inventory-p1/cli.mjs` → `CATALOG_INVENTORY_P1_CHECK=PASS`
- `node tools/catalog-inventory-p1/cli.mjs --self-test` → `RED_TIME_TYPE_CONVENTION=PASS`
- `node tools/catalog-inventory-p4/cli.mjs --self-test` →
  `CATALOG_INVENTORY_P4_PRE_L2_SELF_TEST=PASS`
- `node tools/catalog-inventory-p4/cli.mjs` →
  `CATALOG_INVENTORY_P4_PRE_L2_CONTROL_RECONCILIATION=PASS`

### ⑤ 未把历史 runtime evidence 当成本轮证据 —— **披露正确，证据件内缺标记（见 N-01）**

`doc/review/platform/2026-08-08-v2s-catalog-inventory-p4-final-remediation-review-input-codex.md`
第 11 行与第 41 行两处显式声明：
「不重跑 API、L2、DEV、reset、seed…既有 runtime evidence 保持历史字节边界，
不用本次静态修改冒充重新执行」、
「历史 runtime evidence 不因本轮静态修改而重新获得字节背书」。
**这个边界声明是准确且主动的**，我确认本轮确无任何 runtime 重跑痕迹。

---

## 2. Finding

### N-01｜P4 终验 evidence 的 `sourceBindings` 中 seed executor 哈希已漂移，件内无标记

- **章节/路径**：`doc/evidence/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-codex.json`
  的 `sourceBindings` 中 `scripts/dev/catalog-inventory-seed-executor.mjs` 一项。
- **依据**：我对该 evidence 的全部 7 条 `(path, sha256)` 做当前字节独立复算，
  **6 条一致、1 条漂移**，漂移的正是 seed executor——因为本轮 N-01 的复合键修复改动了该文件。
  另四个被改文件（fixture catalog、schema、生成器、P1 checker）**不在该 evidence 的绑定范围内**，
  故不受影响。
- **影响范围**：**不是事实错误，也不是越界**——该 evidence 记录的是当时那次运行，
  内容依然真实；作者也已在 remediation input 中声明历史边界。
  问题在于：只打开 evidence JSON 的读者会复算出一处哈希不符，
  却无法从件内判断这是漂移、篡改，还是有意的后续修改。
  这与我在 P2 轮提过的 N-05 是同一形态——**限定语只写在 intake 文档、没写进证据件本身**。
- **最小修复**：在该 evidence 的 `sourceBindings` 对应条目旁加一个件内标记，
  例如 `asRunSha256` 与一句 `supersededByStaticRemediation:
  doc/review/platform/2026-08-08-...-final-remediation-review-input-codex.md`，
  说明该哈希是"运行当时字节"，其后经静态 remediation 修改且**未重跑**。
  不需要改任何运行结果，也不需要重新执行。
- **是否需 Dexter 裁决**：否。

---

## 3. 方案合理性

本轮三条闭合都很克制：只动了契约文字、生成器常量、一个 key 函数与其自测，
没有借机扩大改动，没有为了让哈希"看起来对"去重跑 runtime，
也没有把 `PASS_PRESERVED_DEV_STATE` 反向改成清理以迁就旧契约。

两处比我的建议更好：cleanup 把破坏性义务迁移而非删除；
`bomStageKey` 用带名前缀加 URI 编码而不是裸拼接。
`requiredIn` 收在生成器的单一常量上，也避免了四处各写一遍的漂移风险。

## 4. 授权边界

本轮只做静态 current-byte 复核，未执行 API、L2、DEV、reset、seed、
数据库/migration、UAT、部署或 cleanup。
**本轮 GO 只覆盖上述五个文件的静态修改**，不重新背书任何 runtime 结果：
P4 终验 evidence 中的运行数据仍属其历史字节边界，
本轮的复合键改动**仅有静态自测覆盖，未经运行时验证**。
N-01 在既有批准边界内可自主处置，不需要 Dexter 裁决。
