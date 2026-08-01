---
title: R5 当前实现字节盘点（Codex）
status: FACTUAL_INVENTORY_FOR_REVISED_DESIGN
createdAt: 2026-07-26
scope: 当前 checkout 的源码、契约与 migration；不采信既有计划或 review 的完成自述
implementationAuthority: false
---

# R5 当前实现字节盘点

## 1. 方法与不可据此推导的结论

本件在停止实施后以当前文件字节重新枚举。使用的事实命令为：

```text
find apps/backend/catering-business-server/src/main/java -name '*Controller.java'
find apps/backend/catering-business-server/src/main/resources -name 'V*.sql'
rg -n '"operationId"[[:space:]]*:' contracts/openapi/paths
find apps/frontend -path '*/src/*' -type f
rg -n 'react-router|@reduxjs/toolkit|react-redux|createObservedBaseQuery|createSafeLogger|useDetailDrawer' apps/frontend libraries/frontend
```

盘点只回答“当前有哪些字节、与新方向是否相容”。它不证明 migration 已在某数据库执行、
功能已完成、门已通过、动态环境可用或任一业务 Journey 可验收。

## 2. 重新计数结果与交接差异

| 项 | 当前字节实测 | 与既有口述的差异 | 设计处理 |
| --- | ---: | --- | --- |
| edge controller | 27 | 不是“24 个 controller” | 27 个均已落在 `edge/<face>/<capability>`；保留这一结构成果，但逐一补齐 owner/contract 语义，不能把目录归位当实现完成 |
| controller face 分布 | operations 12 / platform 12 / publicentry 3 | 无 | `publicentry` 是 Java 保留字规避名称，保留 |
| edge Java 文件 | 187 | 无 | 包含 generated/wire/support，不能据此推导 187 个业务端点 |
| Flyway 文件 | 12 | 不是“11 条 migration” | 下表按 12 条逐件登记；既有字节一律不改写 |
| edge operationId | 104 | 与冻结 baseline 一致 | 当前实现仍为 104；Dexter 后续裁决将审计设计为两个 scalar-face read operation，目标分母为 **106**（platform 39 / operations 56 / public 11），本盘点不冒称已实现 |
| 前端 `src` 文件 | 33 | 与总册某时点数不同，故不用总册旧数字 | 证明两个 app 仍未有完整迁移面，不能当 UI 完成 |
| router / RTK app import | 0 / 0 | 与总册判断一致 | 是待建设底座，不是“薄实现”可接受状态 |

## 3. 已有边缘与 owner 代码

### 3.1 结构归位：保留且继续使用

27 个 `*Controller` 已全部在
`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/` 下的 face/capability
子目录：operations 12、platform 12、publicentry 3。这个物理边界与未来多 face、owner library
演进轴相容，**RETAIN**；不得为了新详设搬回 app 根或 owner library。

当前已出现且可继续消费的 owner-side 归位代码包括：

| 路径 | 当前亲验事实 | disposition |
| --- | --- | --- |
| `libraries/backend/organization/.../api/CommercialGroupLookup.java` | 已存在公开 lookup API | `RETAIN_AND_COMPLETE`：作为组织 owner 对 workspace-IAM 的只读事实接口，不发展为跨模块直写 |
| `.../OrganizationCommandService.java` | `execute` 已有 `@Transactional`，并有 group lookup/readback 方法 | `RETAIN_AND_HARDEN`：商业集团初始化仍须落实 advisory lock、receipt 与 audit 的同事务基数证明，不能仅以注解宣称 A-6 关闭 |
| `libraries/backend/workspace-iam/.../WorkspaceInvitationService.java` | 已接入商业集团 lookup | `RETAIN_AND_RECHECK`：必须与 token-hash-only、邀请状态收敛、限流、审计和真实 receipt 一并复核 |
| `.../WorkspaceAuthenticationService.java`、`WorkspaceMembershipService.java` | 已接入 lookup / context 读取 | `RETAIN_AND_REDESIGN`：当前 login/OTP/导航 readback 仍未闭合 A-1/A-2/D/E；兼容构造器和测试用 GROUP node 不能成为生产模型 |

这些路径的存在不改变 G-01：集团空间不推导集团，集团也不推导组织树、账号、角色或门店。

### 3.2 当前仍未可声称完成的代码事实

- `PlatformAssetService` 仍把全部文件作为 `byte[]` 读入并写入 `platform_asset.asset_content`，
  `requireActiveContent` 也返回 `byte[]`；`claim` 只按 asset/status 更新，没有读取或常时比对
  `asset_bind_grant`。它是 R-3/R-4/R-5 与 A-5 的直接整改输入，不能继续扩写。
- `ContractCommandService` / `ContractTaskReadService` 仍直接读写
  `contract.store_contract_item`；货号尚未是合同表的 JSONB `{code,name}` 数组。
- 认证表存在 `failed_attempts` / `locked_until_epoch_millis`，但失败登录路径未累加；OTP 仅写
  `attempt_count=attempt_count+1` 而没有读取限制。现有列不是安全功能。
- `platform-iam`、`platform-workspace`、`organization`、`contract` 已有 owner-local receipt
  service，并可见 advisory lock / request hash / terminal snapshot 的部分实现；但 workspace-IAM、
  asset 和所有 command 的一致覆盖尚未由 106-operation matrix 证明，且不能由 header 存在反推。
  新设计把它收敛为逐 command 的 reserve/fingerprint/replay/complete 覆盖，而不是删除已有可用实现。
- audit 也不是“零写”：当前至少有 platform-iam、organization、contract、workspace-IAM 和
  commercial-group 写点；但 `detail_json` 多为 `{}`，actor/target/change 形状不齐，只有
  platform-admin `auditSummary` 的局部读取，没有统一的用户历史读。新设计应保留其 owner-local
  写入原则并把它升级为可读事实，不能把总册旧时点“零写”数字直接复制为当前事实。
- 前端既有 generated operation 列表，但 `react-router`、`@reduxjs/toolkit`、`react-redux`、
  `createObservedBaseQuery`、`createSafeLogger`、`useDetailDrawer` 均未被 app 消费。

## 4. 12 条 migration 逐字节登记

| migration | SHA-256 | 当前性质 | 新计划 disposition |
| --- | --- | --- | --- |
| `V20260725_170000_000__platform_workspace_and_commercial_group.sql` | `72688ed43885c9c5995a43274ffc482b1e3b6b98e909f3c21b43327099fd7628` | R3 初始空间/集团/RLS 历史 | `IMMUTABLE_RETAIN`；后续只 additive 修正，不恢复 RLS |
| `V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql` | 当前基线文件，详设按其实际表/列重开 | 7 owner schema、初始 receipt/audit/合同 item 等基础 | `IMMUTABLE_RETAIN_ADDITIVE_EVOLUTION`；其空壳表、旧 item 表和历史 timestamp 由新 migration/数据迁移收敛 |
| `V20260726_110000_000__workspace_access_lifecycle_support.sql` | `ff2009822c6f259b91c90a3572e534e131c5869b3eaf7e33ed33b30a0c43849a` | invitation public progress | `RETAIN_BYTES_REASSESS_STATE_MODEL`；不把双 progress/version 当长期答案 |
| `V20260726_120000_000__workspace_password_reset_progress.sql` | `6a7b839ffb13aefa0af3b17a904ec5ee9a5168792897f62b587606175d323a05` | password reset progress | `RETAIN_BYTES_REASSESS_STATE_MODEL`；与 A-1/A-2 安全写路径一并收敛 |
| `V20260726_130000_000__workspace_assignment_audit_timestamps.sql` | `437decc70d4c7dfa96f9cb048ab3aa0ca675ec23fcf861390bf35303c0b9c450` | role assignment readback 时间点 | `RETAIN`；新写入必须全部为 epochMillis/BIGINT |
| `V20260726_140000_000__platform_asset_content_and_bind_grant.sql` | `c73b0f203679bf037b4e0114e9c89757740a8d857fd75952092155dfff829cef` | BYTEA 内容与 bind grant | `IMMUTABLE_SUPERSEDED_BY_ADDITIVE_ASSET_REHOMING`；不得改字节，先把内容迁出对象存储并校验，再以 precondition 删除 BYTEA；bind grant 留作暂存→绑定 proof 并接入 A-5 |
| `V20260726_150000_000__organization_and_contract_persistence_correction.sql` | `0033aa87f11353557d62243b2a2e939b7c1fa251ffcd1b505bb816d0422042b5` | 五宿主 revision、法律字段收紧、备注等 | `RETAIN`；货号关联表部分由 R-6 additive JSONB 收敛 |
| `V20260726_160000_000__extension_and_role_json_storage_alignment.sql` | `bb73fe76d251d2400c3b4850abbf9df8b9a5f4a4bfb450bd62b784ea31b88b31` | 五宿主 `extension_values`、definition/role JSON、8 张旧关联表 DROP | `RETAIN_AUTHORITATIVE`；正是 R-2 既有正确实现，不回退到关联表 |
| `V20260726_170000_000__workspace_role_readback_timestamps.sql` | `213ea941e1e5966d884c0ecc7b77b063d060134b1c89c1902857f3f499941869` | role epoch 时间点 | `RETAIN` |
| `V20260726_180000_000__workspace_invitation_lifecycle_timestamps.sql` | `fde218094ba77a246b50943647e6f459ef06322508bb4be87d8d423b0cb04d42` | invitation lifecycle 时间点 | `RETAIN`；state 重构不得改其字节 |
| `V20260726_190000_000__organization_node_notes.sql` | `ddf1ff4fc4914aeaeec3c259f25528de13612d6d78da9f50fe51cad6ff2dbb2b` | organization notes | `RETAIN` |
| `V20260726_200000_000__brand_name_uniqueness.sql` | `64c748915c3fde6b87133702935da2e1a19df1a4f2fed5f59f2d83595e087b54` | brand normalized name unique | `RETAIN_AND_CLOSE_SAME_CLASS`；tenant/head-company/store 的同类唯一性需新增式补齐并各自先做 typed precondition |

## 5. 已执行但被新设计取代的形状

| 当前物 | 为什么不删改历史字节 | 后续替代方向 |
| --- | --- | --- |
| `asset_content` BYTEA、public content proxy | 已执行 migration 不可改写 | 对象存储 metadata + adapter `url()` + public CDN URL；Range/streaming；先转存再 DROP |
| `store_contract_item` | 初始 migration 的历史事实 | `store_contract.items_json` JSONB array；应用层 normalized uniqueness + 并发 focused test；完成数据迁移及 precondition 后 DROP |
| 8 类 extension enum/旧 catalog 残迹 | 已执行 V160 已固定五值宿主 | contract/catalog/reducer 改为五宿主，不恢复无宿主三类 |
| audit/detail 空壳 | 已建表不足以成为用户能力 | owner 同事务 append + 统一跨 owner task read + 新 Modal；不把日志或 receipt 当替代 |

## 6. 结论

当前 checkout 有可保留的物理结构和 R-2 JSON 对齐，但它仍是“结构已出现、机制未完成”的
中间态。新详设必须把每一项保留、替代和新增式收敛落到同一阶段计划；不得为了看似整洁
而改写已执行 migration，也不得把目录、header、表或 generated 文件的存在写成业务完成。
