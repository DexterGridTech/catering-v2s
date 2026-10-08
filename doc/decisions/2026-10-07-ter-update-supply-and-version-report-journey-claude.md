# TER 更新供给与主机版本报告：阶段 B Journey

### 2026-10-07 Dexter 最新裁决（覆盖旧报告方案）

1. 报告存 CBS PostgreSQL，由 `terminal-update` owner 写入；运营右 Tab 可按门店和当前实际版本查询。Dexter 最终更正“仅包含启用”：范围为当前项目 **启用门店下的启用终端**，停用/作废均排除；未报告终端仍有列表行。显示门店名、终端名、实际版本、最新升级报告状态，点击终端打开标准详情 Drawer，显示最新报告及历史报告。
2. 上传成功且解析校验成功后才可保存；按钮名称统一“保存”，之前禁用。HOT 还必须选定与声明五事实完全匹配的最小 FULL。换文件、解析失败、stage 过期或上下文改变立即撤销旧保存资格。
3. 升级报告经 CBS HTTP 上报；失败正文缓存到升级 owner 的持久化 state。TDC 对有效匹配 PONG 发公开本机广播 command，业务 actor 消费后重试自己的未发送内容。TDC 不保存其他 owner 的失败正文，广播不证明 CBS HTTP 成功，不通过报告失败重连 TDS。
4. N/M 界面单位为分钟；InputNumber 正整数分钟 1～1440 为本设计的有限参数，canonical/API/持久字段仍明确为秒，提交乘 60、读取除 60，服务端检查 60～86400 且为 60 的倍数；正常 DEV 用 N=5/M=10 分钟，边界值只进 acceptance fixture。
5. 运维保留 APK、JS、runtime、构建号、applicationId、publicationId、摘要等真实技术字段；不得暴露凭证、下载 grant 或原始异常。
6. 规则详情增加“操作历史”，复用标准审计能力，不新建审计流水/弹窗容器/operation。

后续直接确认：“每个更新任务一条报告”。阶段变化更新同一任务记录，历次任务保留；每次 HTTP 重送与心跳不新增历史行。此前“包含启用和停用”的答复已被“仅包含启用”覆盖，不作为当前输入。

正式需求 R-15 中旧双后台、最后值而无任务历史、TDS 上报路径由上述直接裁决覆盖。本轮只改 B 设计包及 intake；需求正本、开发规范、项目记忆、A、源码均不修改。未来实施授权须覆盖正式来源同步与终端标准唯一正本中的心跳触发重试条款；当前仍无实施或运行授权。大致 IA 已确认，本次新增历史/筛选/审计细节为修订设计，未冒充逐控件看图或动态 PASS。

## 1 · 裁决元数据

```text
JOURNEY_ID=TER_UPDATE_SUPPLY_AND_REPORT
STATUS=PROPOSED
SKILL_USED=NONE
DECISION_OWNER=Dexter
UI_BEARING=true
IMPLEMENTATION_AUTHORITY=false
DEXTER_WIREFRAME_REVIEW=ACCEPTED@2026-10-07_SCOPE_APPROXIMATE_IA_DYNAMIC_NOT_RUN
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
```

依据：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` R-01～09、R-15、§20.4；讨论稿 `doc/plans/platform/2026-10-04-ter-version-and-js-apk-update-requirements-discussion-claude.md` 中 FULL/HOT 唯一配对、不可编辑规则及最后状态裁决。本次 Dexter 允许在 A 尚未完成验收时起草 B；没有接受 A 的运行结果，也没有授权 B 实施。本文是完整设计候审稿，不把拟议 Journey 当作已接受决定。

### 2026-10-07 Dexter 后台职责裁定（本批优先输入）

Dexter：“PLATFORM-REPORT这个业务……做成和RULE-LIST是一个页面，但是两个不同的tab，左边……这个项目中所有的更新规则，右边……这个项目中所有门店终端的更新状态”；随后确认：“运维管理后台，只定义终端的更新版本，运营后台才是规则与更新情况报告”。

platform-admin 只负责更新包/版本定义；operations-admin“项目终端版本管理”同页左“更新规则”、右“终端更新状态”。右 Tab 查询当前项目启用门店下的启用终端，包含尚无报告者；标准详情 Drawer 显示最新报告及按任务保存的历史。规则操作历史使用现有标准审计 Modal；仍只有两个内容页/两个路由，无手工任务重试或任务看板。

当前产品输入以“Dexter 最新裁决”节为准；旧 R-15 文字只作来源对照，不能恢复旧后台或旧报告通道。正式来源同步安排在未来实施授权内，当前仅设计、NOT_RUN。

## 2 · 用户任务与成功结果

运维管理员要把开发人员制作的 FULL/HOT ZIP 保存到当前集团空间；系统给出从实际内容核验出的类型、版本、身份和 HOT 固定最小 FULL。坏包不成为可用目标，换空间不带走暂存或详情。

拥有项目终端版本管理权限的业务管理员要为当前项目创建一条不可编辑的版本规则，随后启用或停用；只有读权限的管理员仍可读规则及合法关联包候选。规则启停只改变供给，B 不自动安装。

终端主机要取得当前项目的完整启用规则快照，可靠地保存到唯一更新 owner，并报告实际安装/运行版本与最近更新状态。运营管理后台查看最后主机报告；没有报告、未知字段、报告过时和没有更新任务分别呈现。

### 2.1 失败后仍成立的事实

| actor | 失败后仍成立的事实 |
| --- | --- |
| 运维管理员 | 解析失败不保存可用包；既有工件不覆盖；stage只回收本actor确有所有权对象。 |
| 业务管理员 | 创建/启停拒绝不写规则/审计/topic；已有规则内容和createdAt不变；读权限不由写cap删掉。 |
| 主机 | 快照读取/flush失败保留旧完整事实但非当前；报告失败不伪PG提交、不变actual、不触发安装。 |

## 3 · 逐 actor 前提链

| 前提 | 对谁 | 事实/来源类型 | 产生或确认位置 | 未满足行为 |
| --- | --- | --- | --- | --- |
| 运维身份 | 运维管理员 | ESTABLISHED_SOURCE：platform session、enabled administrator | `PlatformGovernanceAuthorization.requireEnabledPlatformAdministrator`；现有 platform 登录 | 拒绝，不新增 platform capability |
| 集团空间 | 运维管理员 | ESTABLISHED_SOURCE：壳层验证后的唯一空间上下文 | `platform-admin/src/app/state/WorkspaceScope.tsx` | 提示先选择空间；路由不携空间编码 |
| 工件 | 运维管理员 | ESTABLISHED_SOURCE：A 打包器与 canonical artifact；当前未验收 | `scripts/build/terminal-update-artifact.mjs`、`contracts/terminal/terminal-update-artifact.schema.json` | B 实施前冻结 A 已验收格式；不靠假包补前置 |
| 可用包与最小 FULL | 两管理员 | IN_SCOPE_PRODUCED：同空间校验保存 | 本 Journey 的上传/保存任务 | 未校验、跨空间或配对不符不得选择 |
| 运营身份/项目可读范围 | 业务管理员 | ESTABLISHED_SOURCE：operations session、实际 PROJECT 节点 | `WorkspaceCapabilityScopeResolver`、operations scope bar | 缺项目引导既有左下角选择；范围拒绝 |
| 项目写授权 | 写规则的业务管理员 | IN_SCOPE_PRODUCED：新 capability `MANAGE_PROJECT_TERMINAL_VERSION`（业务名：项目终端版本管理） | 本批 IAM/contract/seed 同步；owner 最终复核 | GET 不要求此 capability；无 grant 不写 |
| 项目与门店 | 业务管理员 | ESTABLISHED_SOURCE：organization 真实引用/归属 | organization task read APIs | 指定 refs 跨项目拒绝；空 refs 不暗指全部 |
| 主机合法绑定 | 主机 | ESTABLISHED_SOURCE：TDC 唯一凭证与 CBS 当前 binding | terminal-binding credential verification；HTTP 不以 TDS ready 为前置 | 无凭证/非主机不请求；TDS 仅提供规则通知和重试心跳，不虚构副机对象 |
| 当前项目已加载 | 主机 | IN_SCOPE_PRODUCED：复用store-basic HTTP，补明确本启动周期PROJECT flush成功信号 | 现有storeBasicInformationLoadedCommand仅STORE成功；本批storeOrganizationPathLoadedCommand与selectStoreBasicLoadReadiness在STORE/PROJECT各HTTP及flush完成后提供同boot/binding非持久状态，composition可重建两项成功；公开selectStoreProject只核对值 | 等待；旧 hydrated 数据不能宣布本周期 ready |
| 快照与升级报告 | 主机/后台 | IN_SCOPE_PRODUCED：规则 HTTP/TDP；报告 CBS HTTP/PG | 详设 §8.5 | 报告持久化失败没有成功 receipt；失败正文在业务 owner state 中保留 |
| A 真实版本/更新结果 | 主机 | ESTABLISHED_SOURCE，A 当前静态接口与未完成验收 | A actual/task/recent selectors；详设 §0.1 | 未知附原因；不使用目标版本拼 actual |

上表没有未决外部账号、默认终端或新业务身份。A 是明确的未完成工程依赖，不能以 seed、Web fixture 或本稿的状态替代其验收。

## 4 · 任务边界、非目标与禁推

1. 包库：打开包列表→上传 ZIP→查看解析→HOT 选择与声明完全匹配的已保存 FULL→保存→详情读回。用户不手填版本，不选择清单自报的空间。
2. 项目规则：打开项目列表→新建→选 FULL-only 或固定 FULL/HOT→门店范围→N/HOT 策略/M→创建→详情。初始状态在新建面显式选择启用/停用，默认停用，避免把保存暗作发布；这是已展示IA的交互选择，不增加第三种状态。详情仅操作菜单中的启用/停用，确认后读回，内容不可编辑。
3. 主机：激活后的当前项目完成加载→HTTP 全快照→owner 持久化→TDC 订阅；每次 TDP ready 再核对，在线 topic 通知后重新读取/接受。保存快照不调用 A 的 accept-target/prepare/apply。
4. 报告：先订阅 A actual/task/recent 再读初值→升级 owner 生成持久报告→TDC typed HTTP POST→CBS owner 提交 PG→HTTP receipt→删除匹配 pending。失败由有效 PONG 广播再次触发；taskId 稳定，阶段变化更新同一任务行，历次任务保留；普通启动 actual 无任务则只更新当前观察，不造假任务。
5. 已固定任务的来源授权不因规则停用而消失；binding 失效会拒绝新的下载。后台不承诺已经提交的数据流立即中断。
6. 非目标：C 的最新规则选择、N 提醒、M 无点击、自动执行及副机同步/执行；无副机上报、任务看板、手工失败重试、用途/机型维度、灰度、MQ/outbox/轮询。任务报告历史是 B 本次新增明确目标，不再列为非目标。

### 4.1 禁推与禁止伪修复

禁止由保存/启用推导终端已更新，由目标推导actual，由旧hydration推导当前boot成功，由selector可见推导写授权；禁止seed伪报告、直接SQL造session/report、另建后台报告入口、用历史PASS代当前代码。

## 5 · Corpus 命中与冲突

| 术语/关系 | 正本 | 使用与边界 | 冲突/未知 | Dexter裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运维管理后台/运营管理后台 | corpus G-01/G-02 | platform-admin 保存包；operations-admin 维护项目规则；不交换 session  技术文案按最新直接裁决；无待选词汇方案 | 否 |
| 主对象读/关联候选/写授权 | corpus G-05A/G-05B | PROJECT 主读按节点；包候选不附加写 cap；创建/启停 owner 重核 grant  技术文案按最新直接裁决；无待选词汇方案 | 否 |
| 集团空间 | corpus G-10 | 唯一壳层上下文；URL 不携空间 key；切换关闭原空间面  技术文案按最新直接裁决；无待选词汇方案 | 否 |
| 最后主机报告 | 正式需求 R-15 | 副机只是扩展，不创建 CBS/TDS 身份；最新报告与任务历史不称实时在线状态  技术文案按最新直接裁决；无待选词汇方案 | 否 |
| 更新包/版本规则 | 正式需求 R-04/R-05、backend§1-K | 新语汇由原需求直接确立；owner返回结构化发布事实，首列及候选label由前端feature按应用/类型/版本呈现，不新增必填名称/编码或后端装配标题  技术文案按最新直接裁决；无待选词汇方案 | 否 |

## 6 · UI 适用性与后续工件

同日期 `ter-update-supply-and-version-report-ia-claude.md` 和 `...ui-interaction-claude.md` 覆盖运维包库及运营规则/最后报告。没有新增终端手工更新页。逐交互面遵循 `doc/platform/frontend-coding-standard.md` §3-K-1..§3-K-10；报告列表与详情均用现成标准查询/列表/分页/只读Drawer，不扩旧Card作为额外入口。

## 7 · Dexter 裁决

当前：本次只授权文档设计。Journey/线框均待本轮审阅；A 当前字节不等于已验收。B 实施需 A 交接前置关闭、Dexter 接受 Journey/IA/UI 与详设计划，并另行明确实施/运行范围。

### 7.1 外部参考意见与最新处置

外部 NO-GO 0M/3S/8N 对应旧设计字节，原报告保留。本次不是独立 verdict；六项产品裁决及两次补充答复均已收到，没有未选的 A/B 候选。旧独立 cycle 不重开；修订字节交 Dexter/Claude 复核。

| 产品问题 | 唯一当前方案 | 状态 |
| --- | --- | --- |
| 报告事实/历史与有效范围 | CBS PG，每任务一行；仅启用门店＋启用终端；最新与任务历史可读 | DEXTER_CONFIRMED |
| 上传保存 | 上传及解析成功才启用“保存”，HOT 配对复核仍必要 | DEXTER_CONFIRMED |
| 上报与失败补发 | CBS HTTP；升级 owner 持久 pending；有效 PONG 本机 command 触发重试，不重连救报告 | DEXTER_CONFIRMED |
| N/M | 分钟；API seconds 显式换算 | DEXTER_CONFIRMED |
| 运维技术文案 | 保留真实技术细节，秘密不展示 | DEXTER_CONFIRMED |
| 规则操作历史 | 标准审计 Modal/通用审计 GET，真实 PROJECT 范围读 | DEXTER_CONFIRMED |

后台 L2 有报告的合法生产者改为本 run 真实绑定＋CBS HTTP POST，不需要为报告另起 TDS；无 SQL 直写、不复用 DEV 报告。HTTP fixture 不证明原生实际版本；原生真实性仍由 TER 场景验证。

## 8 · 用户确认导航

两个内容页及全部页内交互的后台、完整菜单入口、宿主控件、页面访问/真实数据节点读范围、具名动作cap及无权限表现以IA§2为唯一逐交互面定位。新运维“终端更新包”一级菜单、运营“门店经营→项目终端版本管理”、运营项目同页右侧终端更新状态Tab与运营报告详情Drawer大致IA已获Dexter确认；IA_ACCEPTANCE=CONFIRMED_BY_DEXTER，线框不能代替权限设计。

## 9 · 2026-10-09 验收输入补充（不增加产品操作）

阶段B未来实施agent可按需受管reset非生产库，无需重复请求Dexter授权；实际前置/准入与命令见实施计划§1.1/§10。当前仍只改设计、不运行。

完整验收必须顺次保留同一DEV数据面：真实打包→运维UI上传解析保存→运营GROUP任职/PROJECT节点新建与启用规则→TER完整snapshot→automation显式发送既有A accept command固定该规则→CBS grant下载/真实FULL及HOT→CBS HTTP任务报告→运营右Tab与历史读回。具体fixture、权限、版本、身份、资源、cleanup在详设§15.2a唯一维护。本触发是受管基础设施验收，不增加用户按钮，不代表C自动择新/闲时/双机行为通过；隔离浏览器L2仍不读取DEV，正常数据报告来自本链TER而非fixture。
