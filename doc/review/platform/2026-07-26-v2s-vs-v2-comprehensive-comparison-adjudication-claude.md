---
title: v2 ↔ v2s 全面对比与裁决清单(Claude)
type: review
subtype: adjudication-list
status: DELIVERED_FOR_DEXTER_DECISION
reviewer: Claude
createdAt: 2026-07-26
basis: Dexter「哪些 v2 设计得不错的、或者 v2s 过度设计的、或者有争议的，你列出来我裁决一下」
method: 四路独立对比 agent（后端 owner 数据模型/横切机制/前端架构/测试与 DEV）+ Claude 本体亲验
authorizationBoundary: 结论仅供 Dexter 裁决；不授权实施、DEV、seed/reset
---

# v2 ↔ v2s 对比与裁决清单

四路 agent 共产出约 145 条,我去重、合并、按你的标尺(**代码治理要严谨,业务设计不能过度**)分档。**A 档我不问你,直接判必修;D 档才需要你勾。**

## 贯穿全局的一句话诊断

> **v2s 从 v2 搬来了「名字与结构」,却没搬来产生这些结构的机制,于是留下一批形状正确、消费为零的骨架。**

后端 47 张表里 **11 张(23%)零引用**,其中 9 张正是 v2 真正实现了的审计/幂等机制的空壳;前端同一个病的镜像——foundation 里三个需要架构才能接的 primitive 全部零消费。**这不是"设计过度",是"结构搬来了、行为没搬"。**

反过来也要说清楚:**业务建模本身没有膨胀**。真业务表 v2 = 31 张,v2s = 31 张,完全相等;总表数 v2 88 → v2s 55,砍掉的 40 张投影/outbox 是红线的功劳。

---

## A 档:安全缺陷(必修,不需裁决)

这一档我全部亲验过源码,不是转述。

| # | 缺陷 | 亲验证据 | 后果 |
|---|---|---|---|
| **A-1** | **密码无暴力破解防护** | `failed_attempts` 全仓仅 3 处出现,**全是 `failed_attempts=0`**(改密/重置时重置);登录失败路径**从不 +1**。`locked_until_epoch_millis` 同理 | 账号锁定机制**完全不存在**,列永远是 0。可无限次猜密码。v2 有 `platform_login_failure_bucket` / `workspace_password_login_failure_bucket`(ACCOUNT 10 次/15 分、SOURCE 30 次/5 分,HMAC 指纹 + advisory lock) |
| **A-2** | **OTP 无尝试上限** | `attempt_count` 三处都是 `+1`(`WorkspaceAuthenticationService:51`、`WorkspaceInvitationService:105`、`WorkspacePasswordResetService:66`),**全仓无任何地方读它或比较它** | 6 位 OTP 在有效期内可无限猜。v2 有 5 次/10 分锁定 + 3 次/10 分发送上限 |
| **A-3** | **无最后一个管理员 / 自我停用 / 内置账号保护** | `libraries/backend/platform-iam` 对 `built_in\|countActive\|self` grep **零命中** | 可停用种子管理员、可停用自己、可停用最后一个管理员 → **系统锁死,无人能登录**。v2 有 `built_in` 列 + `assertMutableTarget` + `countActiveUsers() <= 1` 守卫 |
| **A-4** | **幂等完全失效** | 每个写接口收 `Idempotency-Key`,但 `private static void key(String value)` **只校验长度、返回 void、key 之后再不出现**;7 张 `*_command_receipt` 表零读写 | 契约写着 `REQUIRED_16_128`、门能查到 header 必填、代码也在校验——**但零重放保护**。超时重试会重复建实体。教科书式假绿 |
| **A-5** | **资产 bind grant 签发但从不校验** | `asset_bind_grant` 一处写、零处读;`claim` 只按 `asset_ref` + `status IN ('STAGED','RELEASED')` 匹配 | 任何能到 claim 路径的调用者可绑定任意 staged asset。v2 用 `constantTimeEquals` 双重校验 |
| **A-6** | **商业集团初始化零事务** | `OrganizationCommandService` **零个 `@Transactional`**,幂等插入/建组/审计/回执四条语句各自 autocommit | 中途失败会在幂等表留下 `commercial_group_id` 为 NULL 的行,**永久烧掉那个 key**,重试必然再失败。v2 用 `@Transactional` + `pg_advisory_xact_lock` |

**A 档我的判定:六条全部必修,且 A-1~A-3 应优先于任何新功能。** 这不是"要不要更严"的问题,是已声明的能力根本不存在。

---

## B 档:正确性缺陷(必修,不需裁决)

| # | 缺陷 | 证据 | 后果 |
|---|---|---|---|
| B-1 | **组织树无法通过应用引导** | `createRegion` 要求存在 `node_type='GROUP'` 的 `organization_node` 行,而**没有任何生产端点创建它**——只有测试在建 | 全新空间建不出大区 |
| B-2 | **主数据外键可变导致合同快照失配** | v2s 的 store update 写 `SET project_id=?, tenant_id=?, brand_id=?, ...`;而合同创建时把 `tenant_id` 快照进 `store_contract` | 改门店归属会**静默让所有已有合同的 tenant 失配**。v2 拒绝改 code、store update 只动 `name/head_company_id/notes` |
| B-3 | **货号去重大小写敏感 + 未映射 500** | 校验时按原值去重,插入时 `trim`;`"A1"` 与 `" A1"` 通过校验后撞 `UNIQUE(contract_id,item_code)`,且无 advice 映射 `DuplicateKeyException` | 用户可触发 500(v2 返回 400) |
| B-4 | **DB 层几乎没有状态闭集约束** | v2 有 28 个 `CHECK (... IN (...))`;v2s 18 个 status 列**只有 3 个**有 CHECK | 脏状态写得进去 |
| B-5 | **名称唯一性缺失** | v2 对 brand/tenant/head_company/store 都有 `UNIQUE(workspace, name)`;v2s 只约束 `code` | 同名门店/品牌可并存,而运营端选择器按 name 显示 |
| B-6 | **二级索引几乎为零** | v2 有 65 个 `CREATE INDEX`,v2s 只有 2 个(且都是 grant hash 局部索引) | 所有列表是顺序扫描,且 `listEntities`/`list` 还有 N+1 |
| B-7 | **组织节点变更完全无审计** | `OrganizationHierarchyService` 零审计写入 | 大区/项目的建、改名、启停无任何痕迹 |
| B-8 | **RLS 已删但代码仍在设 GUC** | 四条 policy 已被 drop,`PlatformWorkspaceService:71-74` 每次请求仍 `set_config('app.consumer_face',…)` | 每请求两次多余往返,喂给没人读的 GUC |

---

## C 档:我已代裁的(不需你勾,列出供你否决)

**照搬 v2(v2 做得好、v2s 缺):** 状态闭集 CHECK、非空白 CHECK、名称唯一键、二级索引、日期范围 CHECK、登录/OTP 限流、built_in 与最后管理员保护、审计行带 actor+幂等键(让审计表有读者)、`pageSize` 上界 100、单一分页信封、Problem 目录带 `defaultHttpStatus` 且 `type`/`title` 承载真信息、邀请 3 态 + generation 计数器、前端 routing/session boundary/feedback 映射/presentation catalog/locators 模块/`X-Correlation-Id`、L3 链路测试形态、`run-managed` 的 business/cleanup 分离、`test-discovery-evidence` 这道 61 行的门。

**砍掉(v2s 独有的过度或 v2 自己的过度):**
- v2s:11 张零引用表(7 receipt + 4 audit)、`authorization_revision` 列(恒等于 `context_version`、零比较)、Overview 的 8 个 source-status 常量字段、6 个重复的 `*SortDirection`、冻死的 `revision` 双列、`phase_names` 死列 + `project_phase_name` 侧表二选一、邀请状态机从 8 态收回、`COMPLETING` 与 `EXPIRED` 死分支、`password_reset_progress` 1:1 拆表、`platform_credential_reset`、`asset_cleanup`、`claimed_by_type` 常量列、`mobile_mask_source` / `last_seen_at` 死列、孤儿脚本 `build-static.mjs`
- v2 的别搬:写权限/permit-kernel/module-delivery/journey-design 治理机器(**6,480 行 = v2 治理代码 25%,一行不证明产品行为**)、`*JourneyTraceRegistry`(1,008 行,测试在断言 registry 等于它自己的拷贝)、`generatedProblemSemantics`(182 行零消费,**且"证明它被消费"的门读的是这个生成物自己**——永远绿)、evidence 目录 286 文件(机器实际引用约 12 个)、`.runtime/runs` 无保留策略(1 GB/12 天)、per-face gateway base URL、分布式 trace 链、`*SourceStatus` 部分降级读模型、成功文案里点名后端服务("已由角色服务保存")

**保留(v2s 确实比 v2 好,别误砍):** `TimeProvider` 单一注入点(v2 有 99 处裸 `System.currentTimeMillis()`)、统一 `version/expectedVersion`(v2 是 version/revision 分裂)、排序键 generated enum 闭集、`contextVersion` 在 6 个 controller 统一守卫、无投影/无闭包表/无反规范化快照/无 `store_business_identity` 副本、一张 OTP 表带 purpose 判别(v2 是三份重复)、邀请任职意图关系化(v2 是 JSONB 里存 role_names 会漂移)、只存 token_hash 不存原始 token、凭据与身份行分离、`standards-coverage-matrix`(诚实标出 69% 机器判不了)、DEV 分层(79 行纯函数校验 + 93 行编排 vs v2 的 1,037 行单体)

---

## D 档:需要你裁决的(只有 7 条)

| # | 争议点 | 选项 A | 选项 B | 我的倾向 |
|---|---|---|---|---|
| **D-1** | **合同货号:一列还是一表** | v2:`item_codes JSONB` 一列 | v2s:`store_contract_item` 表,多一个 `item_name` | **看 `item_name` 是不是真业务事实**。G-09 裁定过货号是 `{编码,名称}` 二元组——若是,表就该留;若名称只是展示,回 JSONB。**这条取决于你对货号名称的产品定义** |
| **D-2** | **组织节点 code 唯一性范围** | v2:workspace 内全局唯一(REGION 和 PROJECT 不能重名) | v2s:按 node_type 分别唯一(大区 R1 和项目 R1 可共存) | 倾向 v2s,但若 UI 有"按编码搜节点"就必须用 v2 的 |
| **D-3** | **同状态转换** | 拒绝(v2 workspace 做法) | 接受并 bump version(v2s 现状) | 倾向拒绝——接受会让一次空操作使别人的 `expectedVersion` 失效 |
| **D-4** | **前端多标签页 shell** | 照搬 v2 的 `contentTabsSlice`(可关闭标签 + 状态快照恢复) | 单页面切换 | 倾向**不搬**。v2 为此在 6 个页面复制了近乎相同的快照类型守卫,是它前端最大的重复源;单管理员工具要不要浏览器式标签是**产品判断,归你** |
| **D-5** | **错误码粒度** | v2s 现有 106 码(80 个零引用) | 收敛到实际用到的约 26 个 | 倾向**先让 106 码真正接线**而不是砍——但如果你觉得 106 太细,现在是最便宜的收敛时机 |
| **D-6** | **审计要做到什么程度** | 每个 owner 命令都写审计行(带 actor + before/after) | 只对高风险命令(停用、撤销任职、凭据重置)写 | 倾向 B。现在是 6 张表零读者、`detail_json` 恒为 `'{}'`——**要么让它承载事实,要么删掉,不要留着假装有审计** |
| **D-7** | **两份 `problem.schemas.yaml` 并存** | 保留 R3 那份做兼容 | 统一到 R5 那份 | 倾向统一。同一个 App 里两种 Problem wire 形状,前端要写两套解析 |

---

## 我建议的处理顺序

1. **A 档六条**(安全)——优先于一切新功能。A-1/A-2/A-3 各自是几十行代码,v2 有现成实现可照抄。
2. **B 档八条**(正确性)——B-1 会挡住整条组织树的使用,B-2 会静默损坏合同数据。
3. **C 档的"砍掉"**——13 张零引用表 + 若干死列,一条 migration 解决,**现在删最便宜**。
4. **D 档**——等你勾完再动。
5. C 档的"照搬"里,**约束类**(CHECK/唯一键/索引)跟 3 一起做;**架构类**(前端 routing/RTK/feedback)归 Phase C。

## 授权边界

本清单仅供裁决,不授权实施、DEV、seed/reset。A/B/C 三档若你无异议,我按既有 R5 授权写成执行指令交 Codex;D 档等你逐条勾选。
