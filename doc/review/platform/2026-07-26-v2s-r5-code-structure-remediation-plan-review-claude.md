---
title: R5 代码目录结构反思与整改计划 Claude 独立评审
type: review
status: DELIVERED
reviewer: Claude
createdAt: 2026-07-26
reviewTarget: doc/review/platform/2026-07-26-v2s-r5-code-structure-retrospective-and-remediation-plan.md
reviewTargetSha256Prefix: ffb5fb87a850b52a
programId: V2S_W0_W4_EXECUTION
roadmapStep: R5
authorizationBoundary: STRUCTURE_PLAN_REVIEW_ONLY_NO_NEW_CAPABILITY_NO_SEPARATE_R5_CYCLE
---

# R5 代码结构整改计划 Claude 独立评审

## 0. 结论

```text
VERDICT=NO-GO
M=3  S=5  N=4
```

一句话:**方向对、目标树对、且是长期正确而非短期兼容——但方案把自己限定成了"搬目录",而 Dexter 明确要求的是"目录 + 代码职责一起修";加上完成判定分母失真、防再犯控制面有死代码,三者都是 M。** 修订都落在方案文档层(扩范围、修分母、把控制面做成真实强制链),不动 104/32/22/180 任何分母,无需新的产品裁决。修订后本方案可以成为 R5 内部整改的执行依据。

## 1. 会话出处与方法

续接会话,如实声明。本轮:我本体亲读了 v2s 全部关键现状代码(24 个 controller 中的代表 + `PlatformApp.tsx`/`OperationsApp.tsx`/`OperationsFeaturePage.tsx`/`PublicEntry.tsx` 全文、library application service 抽读),并派两路只读 agent:一路核验 v2 组织纪律实况与方案事实声明(逐 controller 对映射表、逐 surface 对 feature 清单、控制面工具源码),一路提取 v6/v7 业务演进画像(22 域、5 face、TDP/报表路径)。所有 M 级判断以我亲验证据为准。本仓零写入(除本文件)。

## 2. 方案合理性(先于闭环,含 Dexter 要求的长期视角)

### 2.1 问题对不对——对,且根因判断准确

"单 deployable ≠ 单 app 包"的根因反思成立:业务确实都在 library(我抽读 `BusinessEntityService.java` 199 行,SQL/事务/乐观锁/审计全在库内;24 个 controller 对 SQL/JdbcTemplate 零命中),烂的是 edge 与前端壳。问题被早期抓住——app 根 28 个文件总共仅 1240 行、前端仅 6 个 tsx,**现在改是最便宜的时点**。

### 2.2 方案优不优——目标树是长期正确的,有 v6/v7 证据

**`edge/<face>/<capability>` + owner library 是与 v6 演进同构的两条正交轴**,不是权宜:

- v7 起步期契约消费面冻结为五个(`catering-operations`/`platform-admin`/**`terminal`**/`bff-internal`/`test-harness`),v6 BFF 规划还有 customer 端——face 会从 3 长到 5+。face 是暴露真相(`x-consumer-faces`)、per-face 安全与 per-face codegen 的天然轴,edge 按 face 先分是前瞻而非兼容。
- v6/v7 冻结 22 个 owner 域,相对现有 7 owner 还会新增约 15 个——`libraries/backend/<owner>` 线性可扩,app 始终只是组装。
- v2s 单 deployable ADR 以可判定触发清单 supersede 了 v6 多服务(支付/权益账本与 TDP 是文档写明的最可能触发点)。**本结构让未来拆分保持"只移动部署边界、不重写业务模型"**:capability 目录与 owner 对齐,触发时把某 owner library + 其 edge capability 目录成对抽出即可。
- **我构造的替代方案**(方案未列,按纪律补齐做比较):把 controller 放回各 owner library 的 `adapter.in.web`(v2 服务内的做法)。拒绝理由:一个 owner 同时服务多个 face(workspace-iam 三个 face 都占),owner 内放 controller 会把 face 混进库里,破坏 per-face 安全配置与 per-face codegen 的内聚;且已接受的 R5 设计 §3.2 已把 adapter.in.web 定在 business server。方案的选择是对的。
- v2 后端真实纪律经实测是 **capability-first 再分层**(organization-service 内 hierarchy/store/businessentity/… 各含 adapter/application),方案目标树恰与之同构——"复用 v2 纪律"名副其实(§2 的文字描述反而把 v2 写扁平了,见 S-03)。

### 2.3 代价配不配——配,且"搬+修一遍过"才是长期最省

文件都还很小,迁移窗口成本处于最低点。但正因为每个文件都要动一次,**把代码职责修复与目录搬迁合成同一遍**(每文件只动一次)是长期最省的顺序;"先搬后修"要把全部文件动两遍,才是隐性的短期方案。这正是 M-01 的依据。

## 3. 五个评审判定(对应交办)

1. **根因是否准确**:准确(§2.1)。附计数修正:app 根 28 个 .java 实为 **24 controller** + advice + 3 boot/config;"七个 owner library"实况是 7 schema / 8 registry module / 9 library,三个数字不能混用(S-01)。
2. **backend 目标树能否承载**:能,且长期正确(§2.2)。§4.2 迁移映射表经逐文件核对**完整、零虚构**;跨 owner coordinator 留 app edge、不搬业务回 app 的约束正确;未引入 v2 多服务拓扑。
3. **前端 feature 清单是否完整**:**有洞**(M-02):platform 清单漏 `workspace-overview`(manifest 有 surface 且有同名 pageDesignKey、v2 有独立 feature);五类首页 5 个 HOME key 的归属只在 manifest(app 层 bootstrap)有答案、方案未交代;S3 完成判定写"11 个 page access key"而 crosswalk 的 operations 侧是 17 个(12 PG + 5 HOME),11 恰好等于当前半成品实现的 key 数——**用现状实现当完成分母,会把 PG-STORE-PROFILE 和五首页漏出判定**。另有三处 feature 静默改名未声明(S-02)。
4. **foundation 对接是否落实**:方向已写(feature 显式消费、不复制 primitive),但缺硬规则,现状代码恰好证明缺了什么:两个 App 各自手搓 HTTP client(platform 的还内联在组件文件里)、8 个写请求仅 1 个带 Idempotency-Key——必须把"api/ 只放 per-face generated slice、全部写命令过 lifecycle idempotency"写成迁移规则(并入 M-01)与机器约束(M-03)。
5. **S0-S5 可行性与控制合理性**:分母不动(104/32/contract/schema/Journey 均不触碰)且文件小,可行;"不新增独立门"的原则正确,但"复用既有控制"目前对 frontend 是虚的(M-03):code-layout 的 app 根 allowlist 分支对真实嵌套布局是**死代码从不命中**,frontend "architecture test" 是对即将拆掉的文件做 substring 断言,表达不了依赖规则。

## 4. Findings

### M(3 项)

| # | owning source | 证据(我亲验) | 最小修复 |
| --- | --- | --- | --- |
| M-01 | 方案 §5 S1「仅移动 package/path」/ §4.1 约束 1 | Dexter 明确要求"不光调整目录,代码职责不清一起修",而方案未列任何代码职责修复项。亲验缺陷清单:**后端**——每个 controller 复制粘贴 session/cookie/context 解析(`OperationsOrganizationController.java:29,71-73` 的 COOKIE 常量与 `context()/cookie()` 私有方法,各 controller 各一份);手写 inline DTO record 而非 generated wire(`:76-83`);`Object` 裸返回(`:60-61`);闭集枚举用字符串字面量(`"BRAND"/"PROJECT"`);inline 校验抛 `IllegalArgumentException` 而非 typed Problem(`:61`);7 处 `List<>` 裸返回无冻结的分页信封;context-version 校验各路由不一致。**前端**——两个 App 两套手搓 HTTP client(`PlatformApp.tsx:12` 内联 `request()` vs operations `api/client.ts`),均非设计规定的 per-face generated client + 状态层;`PlatformApp.tsx` **8 个写请求仅 1 个带 Idempotency-Key**(违反冻结 §2.2 七处);`InvitationsForWorkspace` 用 `Date.now()+7天` 在客户端制造邀请有效期(业务事实前端捏造+违受控时钟);角色权限编辑用逗号分隔 TextArea 输闭集 key(违 D-08"分别选择,统一保存"的闭集选择);表格列从返回 JSON key 自动推导+裸 JSON 详情抽屉(非已接受的 v2 基线 UI);无 router(正则匹配 location.pathname)、无状态层、context 切换无缓存失效 | 方案增设「职责归位规则表」并与搬迁**同一遍执行**(每文件只动一次):①edge 统一 session/context 解析为共享组件(interceptor/argument resolver),controller 零 cookie 解析;②DTO 一律 generated wire,禁 inline record;③闭集用 typed 常量;④错误全走 typed Problem;⑤分页信封按 catalog;⑥前端统一 foundation protocol + per-face generated client,删两套手搓 client;⑦全部写命令过 lifecycle idempotency;⑧禁止客户端制造业务时间;⑨角色编辑改闭集选择控件。UI 语义仍以已接受交互工件为准,不新增能力 |
| M-02 | 方案 §4.3 platform 清单、§5 S3 完成判定 | platform 9 feature 漏 `workspace-overview`(manifest surface `PLATFORM-WORKSPACE-OVERVIEW` + 同名 pageDesignKey 存在,v2 有独立 feature);5 个 `HOME-*` key 归属未交代(manifest 定为 app 层 `CARRY_ROUTE_BOOTSTRAP_ONLY`);S3 写"11 个 page access key"而 crosswalk operations 侧 = 12 PG + 5 HOME = 17,11 恰为当前半成品实现数(缺 `PG-STORE-PROFILE` 与五首页)——完成判定锚在现状而非分母,结构"完成"时 manifest 仍有 surface 无承载 | 完成判定改锚 manifest:platform 10 surfaces(补 workspace-overview feature)、operations 17 key(12 PG 归 feature + 5 HOME 显式声明留 app routing/bootstrap,引用 manifest 的 CARRY_ROUTE_BOOTSTRAP_ONLY 行);S2/S3 判定行改为"22 surface / 25 pageDesignKey 全部有归属,零缺口" |
| M-03 | 方案 §6 + `tools/code-layout/cli.mjs`(FORBIDDEN_APP_ROOT 遍历)+ `apps/frontend/*/src/tests/architecture/*.test.mjs` | Dexter 要求"以后必须有强制约束,开发 agent 不能再犯"。现状:code-layout 的 app 根 allowlist 分支只遍历 `apps/<name>/src`,真实布局是 `apps/frontend/<name>/src` 两层嵌套——**该分支是死代码,从不命中**(其 self-test fixture 也是扁平布局,绿灯是假保护);frontend "architecture test" 是 3 个 12-14 行的 substring 断言,断言对象恰是要拆掉的巨型文件,且无法表达"feature 不得 import 另一 feature 的 ui 私有路径"这类依赖规则。§6 声称"零新门叠加"实际需要真实修复与新写规则 | §6 改为**分层强制约束链**,并作为 S1 前置:①修 code-layout 遍历使其真实命中嵌套布局,app 根 allowlist(backend: bootstrap/configuration/edge/generated;frontend: app 根禁业务 page/form/table)+ 以真实布局做 red fixture 亲验真红;②frontend 依赖规则进既有 `frontend-architecture` gate(跨 feature 私有路径 import、手搓 fetch、写命令缺 idempotency 三类可 grep 断言),替换三个 substring 断言;③backend ArchUnit(已存在,真实可承载)加 capability 单向依赖与"controller 禁直读 cookie(必须经共享 resolver)"规则;④`project-memory/pitfalls/` 增"app 根堆叠/职责下坠"条目并接入 routed anchor,使每个未来开发会话必读;⑤蓝图 §14 禁伪修复清单追加"不得在 app 根新增业务文件、不得绕过共享 edge resolver"。全部落在既有工具/记忆/蓝图内,不新建独立门 |

### S(5 项)

| # | owning source | 一句话 |
| --- | --- | --- |
| S-01 | 方案 §1/§2/§3 | 计数卫生:28 实为 24 controller(+4 boot/config);"七个 owner library"混用了 7 schema / 8 registry module / 9 library 三个数字——修订并写明三者关系 |
| S-02 | 方案 §4.3 | 三处 feature 静默改名未声明(v2 `role-management`→`workspace-role-management`、`extension-field-management`→`extension-definition-management`、`entity-extension-fields`→`entity-extension-values`),且 `workspace-invitation-management` 无 manifest surface 对应(有 controller/页面支撑但在 carryover 分母外)——补一张「v2 名→v2s 名→surface/pageKey」对照表,防 manifest 对账漂移 |
| S-03 | 方案 §2 | 对 v2 后端纪律的描述扁平化了实况(v2 是 capability-first 再各自 adapter/application 分层——这恰好更支持方案目标树,应写准);`features/<capability>/api/` 是 v2 没有的新增(v2 feature 只有 ui/automation/model),应显式标注为 v2s 增强并约定 api/ 只放 per-face generated slice 的 re-export/query hooks,禁手写 fetch |
| S-04 | `apps/frontend/operations-admin/src/features/PublicEntry.tsx`(33 行/7.5KB) | 邀请接受+密码找回两条 public 链压在一个文件,方案已列 `invitation-acceptance`/`access-recovery` 两个 feature 但 S3 完成判定未把 PublicEntry 拆分列入——补入判定行 |
| S-05 | `PlatformApp.tsx`(72 行/28,420 字节)等 | 单行极限密度是"不可维护"的直接成因之一;搬迁时必须同步恢复正常格式(既有 lint/prettier 内),否则"可定位"目标落空——格式化纳入 S2/S3 完成判定 |

### N(4 项)

| # | 一句话 |
| --- | --- |
| N-01 | 包名 `workspaceiam` 与库名 `workspace-iam` 的对应关系写一句约定,防未来 owner 增多后混乱 |
| N-02 | §9 长期依据太薄:把 v6/v7 画像(22 owner 域、5 契约 face、TDP/报表分期路径、单 deployable 触发制)写进方案作为结构选型的长期证据——本评审 §2.2 可直接引用 |
| N-03 | v2 operations tests 有 `chrome/` 目录,S4 迁移时列一次 v2/v2s 测试目录差异,避免搬运时临场发明 |
| N-04 | 方案 §4.1 目标树中 `configuration/` 建议同时声明"禁止业务 SQL"(现 `BusinessDataConfiguration` 是唯一 JdbcTemplate 配置点,保持如此) |

## 5. 章节对照(紧凑)

B.2/B.3(后端结构):§2.2、M-01 后端项、M-03③;B.4/B.5(前端架构/UI):M-01 前端项、M-02、S-04;B.6:NOT_APPLICABLE(纯结构,无运行时语义变化);Part C(generated→adapter、typed Problem、Drawer lifecycle):M-01 ①②④⑥⑦ 正是其代码层执法;Part D:NOT_APPLICABLE(本件不触 DEV/seed,停线边界方案 §7 已正确声明)。

## 6. 授权边界

本 NO-GO 针对整改方案文档;三个 M 均为方案修订项(扩职责修复范围、修完成分母、控制面做成真实强制链),修订后无需新一轮产品裁决即可执行。本评审不新增业务能力/Journey/接口/迁移/DEV/seed,不形成独立 R5 review cycle;R5 仍只在全范围完成后统一进入 implementation review。结构整改的执行结果(含 M-03 的红夹具亲验)进入该次统一 review 的证据分母。

---

# Part 2:修订复核(2026-07-26)

## P2.0 结论

```text
VERDICT=GO
M=0  S=0  N=2
```

**本方案可进入 R5 内部结构整改实施**(在既有 R5 implementation 授权范围内执行 S0-S5,不形成独立 review cycle)。

## P2.1 复核记录(全文重读,非只查修复点)

复核对象哈希:方案 `d5ca6bf50e691dd2`(259 行)、intake `ad1e5d8f71125140`、蓝图 `9c453236eb146491`(878 行)。逐项判定:

1. **M-01 CLOSED**。§4.1 约束 1 改为"controller 职责必须在**同一次迁移**归位,不能先搬后修";新增 §4.1.1 职责归位规则表,八项全覆盖且边界正确:shared edge resolver(controller 零 cookie 解析)、generated wire、typed Problem、typed catalog 常量、catalog-driven response、per-face generated facade(feature `api/` 仅 re-export,transport 只在 app client)、lifecycle idempotency、server-owned time、closed-set selector;禁止列逐条对上我亲验的缺陷(Date.now 业务时间、TextArea 闭集、JSON key 自动拼 UI、裸 JSON drawer)。S1-S3 行与完成判定同步改写。**未引入新业务**——全部规则是对已冻结 contract/design 的代码层执法。
2. **M-02 CLOSED**。S0 锚定 22 surfaces / 25 pageDesignKey;我重算 manifest:platform 10(含 `PLATFORM-WORKSPACE-OVERVIEW`)、operations+public 12、12 `PG-*` + 5 `HOME-*` + 8 platform key = 25——与方案 S2"10 platform surface"、S3"12 operations surface、17 key"精确一致,零遗漏。platform feature 补 `workspace-overview`/`password-management`,邀请管理归 `workspace-account-management`(intake 说明其为 accounts surface 子能力,与 manifest 无独立 invitation surface 一致);`home-bootstrap` 显式承接五首页;§10 增 v2 名→v2s 名→surface 对照表。
3. **M-03 CLOSED**。§6 改为"先假绿修真红、再作 S0 前置"的强制链:①code-layout 真实两层遍历+同布局 red mutation;②frontend-architecture gate 三条机械规则(跨 feature 私有 ui import/裸 fetch/幂等 helper)替换 substring 断言,并明确"不判定用户语义"(合验证治理);③backend ArchUnit 承接 capability 单向依赖+controller 禁 cookie/servlet/JDBC+每条规则真红 fixture;④memory pitfall + 蓝图 §14 禁令——蓝图 §14 第 8/9 条已实际写入(`:871-874` 亲验逐字),pitfall 正确列为 S0 完成项并诚实声明"S0 完成前不得声称未来 agent 已受约束"。S0 行明确"不通过不得搬迁"。零新独立门。
4. **反例选择正确**(交办 4):intake 末段显式拒绝"controller 放回 owner library"并给出正确理由(一 owner 多 face 会污染 owner 独立性;主设计 §3.2 已定 app assembly);方案 §4.1 末段同步。与单 deployable 和 owner 独立性一致。
5. **"raw List 一律分页"未被误采纳**(交办 5):§4.1.1 backend list/read 行明确"逐 operation 严格服从 frozen catalog;catalog 为 page 的回 generated envelope,为 bounded collection 的不得无依据改分页",并同时禁止"全量改写"与"现状全保留"两个懒方案——正确。
6. **S-01~S-05、N-01~N-04 全部落实**:24 controller 计数与 7 schema/8 module/9 library 术语修正(§1/§2);改名对照表(§10);v2 capability-first 描述修正+`feature/api` 约定(§2/§4.3);PublicEntry 拆分入 S3 判定;格式化入 S4;包名约定、长期适用性(face/owner 独立扩展轴)、tests/chrome 差异、configuration 禁业务 SQL 均在 §10。

## P2.2 N 级备注(不阻断)

| # | 一句话 |
| --- | --- |
| P2-N1 | intake 写"S2/S3 加入格式化"而方案落在 S4 产物列——执行时以 S4 完成判定为准即可,两处措辞对齐一下更好 |
| P2-N2 | pitfall 条目与 routed anchor 是 S0 完成项(现尚未建,声明诚实)——R5 统一 implementation review 时必须亲验其已建成、已接入路由、且 code-layout/architecture 红夹具真红;此项列入该次 review 的必查清单 |

## P2.3 授权边界

本 GO 确认方案(`d5ca6bf50e691dd2`)可作为 R5 内部结构整改的执行依据,S0-S5 在既有 R5 implementation 授权内执行;不新增业务能力、Journey、接口、数据库迁移、DEV/seed 行为,不形成独立 R5 review cycle。S5 恢复 DEV/seed 仍以 S0-S4 全 PASS 为前提。结构整改结果(含控制链红夹具证据与 P2-N2)进入 R5 全范围统一 implementation review 的分母。
