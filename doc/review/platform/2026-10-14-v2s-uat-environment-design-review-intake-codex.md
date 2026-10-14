# V2S UAT 环境详设与计划 · 主 agent intake 与 cycle 收口

REVIEW_CYCLE_ID=TER_UAT_ENV_2026-10-14
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2/2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT（R1/R2）；作者处置由主 agent 完成
AUTHOR_STATUS=READY_FOR_EXTERNAL_DESIGN_REVIEW

## 输入与审查顺序

本轮设计依据是 Dexter 在当前会话明确提出的 UAT 目标：新增独立远端服务、独立数据库、远端部署两个后台、两个终端 package 声明 UAT 地址，以及 UAT 首次初始化完成 seed；后续补充要求 UAT 与 DEV 可在远端同机并行且各自预算独立。正式需求基线被写入详设 UAT-R01～R10。

主 agent 重开了仓库入口、模板、脚本规范、当前 DEV runner 与 seed 实际消费者、两个终端 app 的 package/server-config 地址链、两个后台 Vite/origin 消费者、CBS IAM bootstrap owner 与仓内 one-shot CLI 先例。R1、R2均为fresh独立子 agent；按先源后历史规则，分别先对当时的当前详设、计划及owner source形成 verdict，再读取本 intake 或对照历史。R2未继承R1或作者处置，且是cycle最后一轮。R1只review修订前字节，R2 review R1修订后的字节；均未执行动态运行。

| 轮次 | 报告 | 独立结论 | 字节范围 |
| --- | --- | --- | --- |
| R1 | `doc/review/platform/2026-10-14-v2s-uat-environment-design-review-round1-codex.md` | NO-GO，M/S/N=0/2/1 | 初始详设/计划版本；R1两S、一N均确认 |
| R2 | `doc/review/platform/2026-10-14-v2s-uat-environment-design-review-round2-codex.md` | NO-GO，M/S/N=0/1/0 | R1修订后的详设/计划；确认动态准备门缺口 |

## R1 intake

### S-1 · r5-full seed 仍绑定 DEV 身份/HTTP/DB 假设

**分类：CONFIRMED。**

主 agent 重开 `scripts/dev/r5-complete-seed-executor.mjs`、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-dev-environment.mjs`，以及主/子 stage executor、manifest/report/validator。现有链不仅检查 runId，还要求 DEV manifest kind、fresh database、DEV namespace/数据库名、loopback HTTP base、`V2S_DEV_*` 子进程环境、OTP与DEV tunnel身份。因此只改父报告字段或把UAT伪装成DEV会失败或破坏隔离。

**影响：**首次 UAT init 无法复用当前完整 r5-full seed，或者seed误连DEV。

**最小修正：**详设 §10b.4 和计划 CP-04 定义environment-neutral seed target，列出当前完整消费闭集及需同步的身份/HTTP/数据库/凭证/OTP/进程/父子报告字段；DEV/UAT各由自己的manifest adapter生成target；复用唯一业务fixture和owner executor。UAT本机受管seed控制命令直连manifest指定的远端UAT CBS ingress，不建立数据库连接/tunnel；DEV loopback语义不变。

**反例/边界：**共享业务seed逻辑并不代表共享DEV数据或执行入口；UAT target必须可被所有六个stage和validator识别。owner SQL仍留在CBS。

### S-2 · platform-admin 跨后台链接缺 UAT origin

**分类：CONFIRMED。**

重开 `WorkspaceManagementPage.tsx` 与 `PlatformInvitationPanel.tsx`，两处均消费`VITE_OPERATIONS_ADMIN_ORIGIN`，本机以外没有正确远端origin时会退回当前页面origin。

**影响：**两个远端后台各自可打开，但platform-admin创建的工作空间登录/邀请链接可能回到错误后台。

**最小修正：**详设 CP-05 和计划 build步骤规定platform-admin执行Vite build前设置UAT operations-admin origin，并在产物与浏览器检查两类链接和API目标；不增加新导航API或运行时回写。

### N-1 · Vite build-time env 行为未纳入验证输入

**分类：CONFIRMED。**

实际依赖声明/锁定Vite 8.0.0；其 `import.meta.env` build-time替换由官方文档说明。详设第三方表、CP-05、计划build步骤现要求build前注入并build后读回dist。未执行本地依赖重解析或构建，不能写成运行PASS。

## R2 intake

### S-01 · 动态验收前日志owner/调用链及源码证伪门不足

**分类：CONFIRMED。**

主 agent 重开 `doc/decisions/templates/implementation-design-template.md:320-322`。模板要求日志机制表、真实验收设计与计划具体列出完整调用链、边界日志owner/落点/关联字段，以及日志补齐到两轮fresh源码证伪和授权focused dynamic的顺序。旧详设/计划只有通用manifest和失败字段，不能让实施者直接定位seed、bootstrap、前端、终端/TDS、生命周期各段的观察点。

**影响：**低级源码/诊断缺口可能拖到首次UAT运行才发现；失败日志无法从本机控制入口沿远端资源和业务owner关联。

**最小修正：**详设新增 §11b，按UAT-01～UAT-11闭合集群列调用链、日志owner/落点、run/environment/resource/stage/request身份和可验证事实；计划第5节增加对应前置表；两份文档均明确“日志就绪→R1 fresh源码证伪→主agent最小修复→R2 fresh定向复核→缺口关闭→满足授权与准入后focused dynamic”。不新增日志平台、流程runner或额外账本。

**反例/边界：**两轮是未来动态链路的运行前源码准入，不是已关闭DESIGN cycle的第三轮，也没有在当前设计授权内实际执行；所有UAT动态状态保持NOT_RUN。

## 用户补充要求核验

UAT与DEV同时运行且预算分账：CONFIRMED并已落实到详设 §1.1、§2.2、UAT-R10、UAT-11和计划CP-01/§3。每个环境的预算独立核算，不把另一方的资源用量记入自己的cap，不因一方预算或stop控制另一方。相同远端物理host仍存在不可消除的物理容量边界；host aggregate headroom只防止超卖，若不够仅拒绝新增UAT资源，不停止/清理DEV。这样保留“环境预算互不占用”同时不虚构物理资源无限。

## 最终字节自查与处置

- 详设：`doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-design-codex.md`
- 计划：`doc/plans/platform/2026-10-14-v2s-uat-environment-implementation-plan-codex.md`
- 最终待外部复评字节 SHA-256：详设 `a7c9e2fb60840130cea21a0b737e9285c973036a5bc00a166e5b1d7660fccea7`；计划 `275d88fb270099bdf2eb082a34b97682626c7db081aea73174be7fa30b802294`。
- R1与R2报告分别保留各自审查时的字节范围和原始NO-GO；主 agent 修订不回写旧verdict。
- R2的S-01已按模板补入详设 §11b 和计划“动态验收前日志与源码证伪”，逐场景区分了日志owner、路径、关联字段和业务/cleanup观察。主 agent重新阅读对应文本并确认R1 seed/frontend闭包仍保留。
- 两轮内部 DESIGN cycle 到此硬停止，不召集第三轮。`ROUND_FINAL_DECISION=SELF_DECIDED`；主 agent判断已处置所有已报告的文档缺口，当前详设和计划可交Dexter/Claude作外部 DESIGN review。此状态是作者收口，不是独立GO，也不是实施授权。
- 构建、容器解析、DEV/UAT、数据库、seed、浏览器、终端及动态验收均未运行；当前全部NOT_RUN。远端host/端口/资源、镜像digest、UAT初始secret与实际protocol仍按详设 §12 OPEN。
