---
title: TER automation-agent Journey（待确认）
status: PROPOSED
implementationAuthority: false
---

# TER automation-agent Journey

## 1. 裁决元数据

JOURNEY_ID=TER-AUTOMATION；STATUS=PROPOSED；DECISION_OWNER=Dexter；UI_BEARING=true。
SKILL_USED=cs-spec-to-plan、cs-writing-plans。CORPUS_VERSION=`project-memory/decisions/confirmed-business-language-corpus.md` 当前原文。
需求正本：`doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`。
本次 Dexter 指派我编写设计，覆盖旧 D-1 对设计开始时间的限制；不授予源码实施或动态运行权限。

## 2. 用户任务与成功结果

- 开发/验收人员：用同一份旅途操作 Web 与 Android，观察控件、selector 与 request，区分真实输入和语义准备。
- 现场管理员：在既有终端管理的「运行状态」内容中，看出本构建是否开启自动化和连接地址；没有操作按钮。
- 成功：同一 case 在两端有对应的控件、业务 selector、command 结果断言；失败立即停止后续业务动作并回收本 run 资源。
- 失败仍成立：网络恢复不重建业务 Runtime；自动化失败不写业务 state，不阻断正常业务；断链后的 command 不自动重发。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 必需事实 | 来源类型 | 产生/确认位置 | 来源证据 | 不满足时 |
|---|---|---|---|---|---|---|
| 静态开关/可信地址/令牌 | 开发人员 | 已审核构建输入 | IN_SCOPE_PRODUCED | 本批 package.json→assembly | 需求 R-02～04 | 开关关时 no-op；坏配置明确失败但业务继续 |
| 管理员入口 | 现场管理员 | 既有 admin 登录规则 | ESTABLISHED_SOURCE | admin-shell | `apps/terminal/ui/base/admin-shell/src/hooks/useAdminLogin.ts` | 沿用既有登录拒绝，不新增免认证入口 |
| App、设备与 display 身份 | 验收人员 | 当前 run 明确拥有设备/连接 | IN_SCOPE_PRODUCED | 新 driver preflight | `tools/terminal-topology/device-identity.mjs`；需求 R-09/R-13 | 不猜 display，不接管未知设备/进程 |
| 终端已激活 | 冻结旅途 | 真实有效绑定 | IN_SCOPE_PRODUCED | driver fixture adapter 通过 CBS 既有管理能力准备，再经 TDC command 激活 | TDC acceptance/operationsFixture.ts（实施期抽取；原acceptance和driver共同消费）；seed契约 stableFixtures.organization.storeTerminals 按key共享终端（dual=term-front、mobile=term-handheld），激活码仅契约内存读取；REQUIRE_INACTIVE/本driver manifest身份回收见详设 §10b | 没有真实 fixture 就 BLOCKED；不得注入 active slice |
| DEV/集团空间/门店 | 冻结旅途 | 同一服务空间的合法 fixture | ESTABLISHED_SOURCE | 既有 r5-full 数据和受管 DEV | `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`（终端与门店唯一fixture来源）、`scripts/dev/start`（受管运行）；本批不改seed/不自动seed | 未授权/未就绪就停止；不自动 reset/seed |
| 店员凭据 | sample 旅途 | sample 本地登录常量 | ESTABLISHED_SOURCE | sample-staff-session owner | `apps/terminal/kernel/feature/sample-staff-session/src/features/actors/actors.ts#credentials` | 与原样例一致；不增后台登录模块 |
| 顾客输入 | sample 旅途 | run 隔离的姓名/电话/年龄 | IN_SCOPE_PRODUCED | 旅途 fixture | 需求 R-17 与冻结需求 §4.3～4.5 | 输入仍须真实逐键点击；落盘脱敏 |

## 4. 任务边界、非目标与禁推

新增可见 UI 仅为两项构建常量。automation 并不是终端业务 owner、远程运维产品或权限系统。
不新增 adapter port、后台接口、TDP 消息、运行期启停按钮、脚本执行方法、selector 业务副本。
mobile 虚拟机为 Dexter 最新指定的追加执行面；不能代替 R-17 的单机双屏 Android。
双机 F-2 只证明两条自动化连接独立，不让副机连接 TDS。

## 5. Corpus 命中与冲突

| 术语/关系 | 来源 | 本 Journey 使用 | 冲突/未知 | 需裁决 |
|---|---|---|---|---|
| 门店与组织 | corpus G-03 | 仅复用合法激活 fixture，不增组织业务 | 无新增语义 | 否 |
| 运维/运营后台 | corpus G-10 与 AGENTS | 此 UI 是 TER admin console，不是两个管理后台 | 不继承后台页面体系 | 否 |
| 主副机、MMP/LMP/LMS/LSP | terminal-coding-standard §4 | 业务形态保持，自动化 surface 另用 PRIMARY/SECONDARY | 两种角色不能混为一个字段 | 否 |
| 自动化状态行位置 | 需求 R-04 | 运行状态内容区，mobile/laptop 各实现 | 本线框尚未看图 | 是：仅 UI 确认 |

## 6. UI 适用性与后续工件

IA：`doc/decisions/2026-10-05-ter-automation-agent-ia-claude.md`。
交互：`doc/decisions/2026-10-05-ter-automation-agent-ui-interaction-claude.md`。
本包是可评审提案；Dexter 看图前不标记 implementation-facing 定稿。

### 6.1 管理后台交互一致性

`frontend-coding-standard.md` §3-K-1..§3-K-10 的 admin-web 专属容器 N/A：本屏属 TER，复用 admin-shell 与 primitives；不引入 admin-ui-foundation 的 DOM/Ant Design 宿主。可访问性、状态文字、单滚动容器仍适用。

## 7. Dexter 裁决

已定：R-18 fresh只读报告完整全文/命令，main逐字转录执行，任一改字修skill换fresh，结果交同一fresh；实施允许抽取TDC共享fixture。两项不授权本轮源码写入。本轮追加裁决按 seed key 共享 term-front/term-handheld，不新增数据；同一时间仅一个受管运行，不与TDC acceptance并行。DEV readback跨owner扩展属于未来实施授权须单独点名的改动，本轮只设计。
UI结论UNSET：等待本设计包与两个状态行线框审阅。当前只允许设计与静态评审；实现、依赖安装、编译及运行均 NOT_AUTHORIZED。
