---
title: R5 v2 edge contract dialectical assessment
status: PROPOSED_REVIEW_ONLY
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 v2 edge contract 辩证评估

## 1. 评估方法

all-v2 的 105 项 edge operation 只是候选资产，不是 v2s 接口真相。每组必须同时回答：

1. 是否由 R5 的 32 项 Journey 真实需要；
2. 是否表达正确 owner 和独立用户 task surface；
3. v2 的 method/path/DTO/face/失败语义是否合理；
4. 单体化后是否仍残留跨服务证明、投影、补拉或重复 endpoint；
5. 保留、优化、合并或拒绝哪个方案成本最低且不损失用户任务。

disposition 使用 `RETAIN / ADAPT / MERGE / SPLIT / ADD / NOT_CARRIED`。已有实现只能降低
搬运成本，不能单独成为采纳理由。

## 2. 总结论

- all-v2 105 项候选中，103 项保留用户 task，但全部至少适配
  `groupWorkspaceKey`、Problem、幂等、face、DTO 或 owner 语义；
- 2 项 `NOT_CARRIED`：未被真实页面消费且已有等价真相的 role candidates、page-entry guard；
- 1 项 `ADD`：G-07 要求的 platform assignment revoke；
- 最终分母为 **104 项**，而不是机械的 105+1；
- 当前每项均有一个明确 face：`platform-admin=38`、`operations-admin=55`、`public=11`。
  治理仍允许经用户任务证明的 multi-face，不把“当前恰好单 face”升级为平台规则。

## 3. 逐组辩证处置

| # | v2 operation group | Journey / 用户价值 | 采纳理由 | v2 问题 | v2s 优化与不选替代的理由 |
| --- | --- | --- | --- | --- | --- |
| 1 | workspace page/detail/commercial-group init | D01-S02～S06、D02-S01 | 列表、详情、具名初始化是三个独立 task surface；未知写结果可回详情 | 与 R3 三项同义；旧 `workspaceKey` 和 root 命名 | `ADAPT` 为 R3 的 `listPlatformGroupWorkspaces`、`getPlatformGroupWorkspaceDetail`、`initializeCommercialGroup`；拒绝双 operation/alias。 |
| 2 | workspace create/update/status | D01-S02/S03/S04 | 三个命令有不同输入、不变量和恢复 | status POST 在资源根；旧 bind grant 暴露跨服务舞步 | `ADAPT`：status 用 `/status`；统一 CAS/header；body 只留 `logoAssetRef`，本地同事务 claim。 |
| 3 | asset stage/content | D01-S02/S03 | multipart staging 与 JSON 表单分离有真实安全价值 | content 挂 platform path，运营登录/公开入口无法合理消费；异步 bind/proof 属旧拓扑 | stage 保持 platform；content 改 `getPublicAssetContent` + public path/face。拒绝把 object bytes 塞进 workspace DTO。 |
| 4 | platform login/session/password/logout | D01-S01、D04-S12P | 四个独立安全动作与 shell/session 真相匹配 | v2 全量生成进两个 app；cookie/error 规范不统一 | 四项 `ADAPT` 保留，仅进入 platform slice，cookie/session 与 operations 隔离。 |
| 5 | platform admin list/create/detail/profile/status/reset | D04-S11 | list/detail/详情动作结构合理；profile/status/reset 不宜万能 PATCH | reset 易误解成管理员指定密码；缺 root/default 禁令 | 六项 `ADAPT`；reset 只发起 owner-controlled recovery，禁止输入目标密码和 root/default。 |
| 6 | platform organization overview page/detail | D02-S06 | 独立 task query 避免平台前端跨 owner 扇出；page/detail 分开 | 旧 per-source degradation/asOf 是多服务补偿 | 两项 `ADAPT`；同库 task join、整体 typed failure，不保留投影状态。 |
| 7 | platform contract overview page/detail | D03-S06 | 平台只读 overview/detail 是批准任务，不复用 operations command | 旧货号和状态词冲突 | 两项 `ADAPT`；item `{code,name}`、三态只读，platform face 不获写权。 |
| 8 | role list/create/candidates/update/status | D04-S01/S02 | role list 已带 role、page catalog、action catalog；其余四项粒度合理 | `getWorkspaceRoleCandidates` 未被真实页面消费且与 role list catalog 重复 | list/create/update/status `ADAPT`；candidates=`NOT_CARRIED`。拒绝为已有文件保留死 endpoint。 |
| 9 | platform account list/detail/status/credential-reset | D04-S03 | list/detail与两种详情动作合理 | 缺 platform revoke；reset 不能直接设密码 | 四项 `ADAPT`，新增 `revokePlatformWorkspaceAssignment`=`ADD`；新增任职仍无 direct endpoint。 |
| 10 | platform invitation list/create/candidates/cancel/reissue | D04-S05P | 列表、表单支持与三种命令都对应真实任务 | candidates 是旧投影；key/error 旧形状 | 五项 `ADAPT`；candidates 改同库 task query，命令幂等并返回 owner readback。 |
| 11 | extension catalog/detail/replace | D01-S07P | catalog→detail→完整 replace 符合 revision/CAS，避免字段逐条 CRUD | v2 catalog 暴露 8 类但 R5 只有 5 个 value host | 三项 `ADAPT`；host 收窄五类，replace 用 `expectedVersion`。 |
| 12 | operations login-entry/password/OTP/session-entry | D04-S08 | entry、两种凭据和 session readback 分工清楚；OTP send/verify 分离便于限流与 purpose | 旧 key、全量 generated、projection session | 五项 `ADAPT`；keyed route、owner session、完整 readback，仅 operations slice。 |
| 13 | operations context/data-node/password/logout | D04-S09/S12O | 四个用户动作和安全后果不同，不应机械合并 | mutation 后 `refetch()`、projection stale 是旧拓扑补偿 | 四项 `ADAPT`；mutation 直接返回完整 context，删补拉。 |
| 14 | brand 5、tenant 5、head-company 6 | D02-S03 | 三类实体必须分开；list/detail/create/update/status匹配 UI；品牌授权 replace 是集合命令 | “商户”等旧词；授权易被误作数据范围 | 16 项 `ADAPT`；正确词、同库 owner 复查、授权不扩权。 |
| 15 | business-entity extension-definition task query | D01-S07O、D02-S03 | definition 是独立缓存/延迟 surface；不应随每次 list 分页重复返回 | 旧页面过早查询；三类 definition 可能被混为一份 | `ADAPT` 保留，显式 entityType，表单打开时加载。拒绝塞入每个 entity list response。 |
| 16 | hierarchy read/create region/create project/update/status | D02-S02 | tree read 与四命令匹配左树右详情 | 旧 DTO 容易被理解成任意树；tag/投影补偿 | 五项 `ADAPT`；锁死 GROUP→REGION→PROJECT，phase 是 project 属性。 |
| 17 | membership list/detail/revoke | D04-S04 | list/detail/revoke 是三个独立 surface | membership DTO 混淆 account 与 assignment；scope/capability 需明确 | 三项 `ADAPT`；detail 显式 account+assignments，revoke 只改 assignment。 |
| 18 | page-entry guard | D04-S09/S10 表面相关 | v2 意图是 direct route 也授权 | 真实页面未消费；session navigation 已负责 UX；业务 endpoint 又必须最终授权，独立 guard 产生 TOCTOU/重复真相 | `NOT_CARRIED`。router 消费 owner navigation，每个真实 task endpoint 做最终授权。 |
| 19 | operations invitation list/create/candidates/cancel/reissue | D04-S05O | 固定节点类型内邀请、列表、表单支持与生命周期动作均真实 | candidates 不能靠前端过滤/旧投影 | 五项 `ADAPT`；同库 task query，command 仍最终复查。 |
| 20 | public invitation 7-step | D04-S06 | view/accept/OTP/credentials/complete/completion 分开可证明用户意图、本人验证、readiness、原子完成和 unknown recovery | key/Problem/idempotency 旧形状；accept 不能提前赋权 | 七项 `ADAPT` 全保留；只有 complete 建 assignment。拒绝为减少端点而破坏安全状态机。 |
| 21 | password-reset OTP send/verify/complete | D04-S10 | 三步 purpose-bound 恢复链正确，workspace 由 reset owner 解析 | secret/error/session effect需统一 | 三项 `ADAPT`；独立 grant、限流、complete session readback。 |
| 22 | store list/create/candidates/definition/detail/update/status/profile | D02-S04/S07、D01-S07O | list/detail/commands/profile 各是任务；candidates 随 brand/search 变化，definition 按 revision 稳定缓存，分开更省 | v2 前端并行扇出并先过滤，候选是旧投影 | 八项 `ADAPT`；后端 task query 同库 join、owner command 重查。拒绝盲目合并 candidates+definition。 |
| 23 | contract list/create/definition/candidates/store-contracts/detail/update/invalidate | D03-S01～S04、D02-S07 | list/detail/commands、分页 candidates、稳定 definition、store-profile contracts 是不同 surface | 错挂 `/organization/contracts`；`itemCodes[]`、VALID/INVALID、投影语义错误 | 八项 `ADAPT`；移至 `/contracts`，item pair/phase snapshot/受控 date 三态。invalidate 保留具名 command，因为不是普通启停。 |

## 4. 为什么不把所有 task support 合并

单体化删除跨进程机制，不等于“一页一个请求”。list、detail、form candidates、extension
definition 和独立延迟区拥有不同刷新条件：

- candidates 常随搜索、分页、品牌或项目变化；
- definition 按 host+revision 稳定缓存；
- 合并会在每次候选搜索时重复传 definition，并把不同 freshness 强绑；
- 因此 store/contract 的 candidates 与 definition 保持分离，但每个 endpoint 都由发起任务
  的 module 用同库 join 返回完整 surface，前端不再跨 owner 拼不变量。

role candidates 和 page-entry guard 则应删除：前者被 role list catalog 覆盖，后者既未被页面
消费又不能替代真实 endpoint 授权。

## 5. consumer face 处置

v2 的大 OpenAPI 被完整生成到两个 app，导致 platform client 含 operations/public、
operations client 也含 platform operation。这是明确不搬的缺陷。

R5 由 `x-consumer-faces` 单向生成服务端 route-face registry 和 app client slice。公开 Logo
content 从 platform path 移出，因为登录页和运营壳需要稳定 URL；它不进入两个 app 的 RTK
Query slice，浏览器按 public content URL 读取。asset owner 仍限制 usage、status 与 opaque ref，
PUBLIC 不等于对象存储目录可浏览。

逐项执行形状与 32 个 Scenario 的双向绑定冻结于
`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`。该 catalog
只把本评估已裁决的语义具体化；不得反向用 Heritage schema 覆盖本文件的采用、优化或拒绝
理由。

## 6. 执行前冻结条件

1. 104 项每项命中 32-scenario task 或明确的登录/session/恢复前提；
2. 两项 `NOT_CARRIED` 在 OpenAPI、route registry、generated client 和 runtime 均为零；
3. platform revoke 有 G-07、页面动作和 owner command 三方 trace；
4. 38/55/11 face 分片精确生成，不再出现两个 app 各含全量 endpoint；
5. path、DTO、Problem、idempotency、CAS 与 `groupWorkspaceKey` 无旧双形状；
6. R4 contract/face/generated production gate 与真实 red mutation通过。
