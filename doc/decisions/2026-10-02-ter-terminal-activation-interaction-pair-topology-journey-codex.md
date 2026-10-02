# 终端激活交互与双机拓扑优化 · Journey

```text
JOURNEY_ID=TERMINAL_ACTIVATION_INTERACTION_PAIR_TOPOLOGY
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@1e909f3a92fb4ecff9b4eafb360129bdbf4dad5900a49443b0ece0bc434cda9c
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md
DESIGN_STATUS=DESIGN_ARTIFACTS_COMPLETE_PENDING_DEXTER_AND_CLAUDE_REVIEW
IMPLEMENTATION_AUTHORITY=false
EVIDENCE_STATUS=STATIC_SOURCE_AND_REQUIREMENTS_ONLY
```

## 1. 用户任务与成功结果

| Actor | 此刻任务 | 可观察成功结果 | 失败后仍成立的事实 |
| --- | --- | --- | --- |
| 店员 | 在正确服务空间激活终端，然后登录并使用当前 sample | 仅输入 8 位激活码；激活事实由 client selector 确认；随后显示店员登录或对应业务页 | 网络/权限/持久化失败不显示成功，不生成第二份凭证 |
| 终端管理员 | 在设备本地检查激活/连接、维护服务配置或恢复配对 | admin console 展示 selector readback；仅合格主机能改配置/取消激活；副机管理只读但能在断链时本地修复配对 | 管理 UI 失败不解除业务断链遮罩，不绕过 owner command |
| 顾客 | 在当前面完成会员信息核对并确认/拒绝 | 本次提交及发起端被精确识别；会员集合在两端一致，两个终端的待确认互不覆盖 | 断链、迟到结果、回包丢失不误报，不重复添加 |
| 终端管理员 | 为指定物理显示面选择本地壁纸 | 主/副机各自壁纸可独立确认；LMS 只显示主机已确认壁纸 | 主机投影不覆盖副机本地确认与待选值 |

## 2. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 店员 | 当前终端真实设备身份与设备形态 | `ESTABLISHED_SOURCE` | DevicePort 与 application composition | 正式需求 R-04；`apps/terminal/kernel/base/platform-ports/src/types/device.ts` | 不提交激活；显示可恢复错误 |
| 访问资格 | 店员 | 8 位激活码对应可激活终端 | `ESTABLISHED_SOURCE` | terminal-binding 后端 | 正式需求 R-04；终端激活需求 R-1.1～R-1.7 | 保持表单并展示业务拒绝原因 |
| 服务空间 | 店员 | 每次请求使用当前选中的服务空间及其有效 URL 前缀 | `IN_SCOPE_PRODUCED` | package `serverSpaces` → composition → server-config owner selector | 正式需求 R-04/R-07/R-08；Dexter 本轮裁定“始终使用当前选中的服务空间” | defaults 无效则配置初始化失败，不猜另一环境；若当前空间不能接受现有凭证，显示 owner 拒绝并保留凭证 |
| 终端凭证 | 主机 client | 激活成功后由 client 独占 generation 与 secret | `IN_SCOPE_PRODUCED` | `terminal-data-client` owner | 终端激活需求 R-2.1/R-9.6 | 不在 UI、server-config 或副机投影中暴露 secret |
| 配对资格 | 主/副机 | 已接受的 peer 身份、应用修订与当前连接状态 | `ESTABLISHED_SOURCE` | topology/state owner | 正式需求 R-01/R-10/R-11；`apps/terminal/kernel/base/topology/src` | 未就绪或失效时业务不启动/保持遮罩 |
| 店员会话 | sample UI | 主机当前有效登录事实 | `ESTABLISHED_SOURCE` | `sample-staff-session` owner，主机下行投影 | 正式需求 R-09/R-10 | 副机不复制口令、不独立登录；失效时退回登录引导 |
| 会员 | 顾客 | 本次精确录入与确认操作 | `IN_SCOPE_PRODUCED` | `sample-member-registry` commands | 正式需求 R-09a | 旧操作不得确认新录入；回包丢失时先读回，不盲目重发 |
| 壁纸 | 管理员 | 本端已确认值及主机已确认投影 | `IN_SCOPE_PRODUCED` | `sample-wallpaper` owner | 正式需求 R-09b | 主机投影不得覆盖副机本地值 |

## 3. Journey 序列

1. runtime 完成本机初始化与 hydration；integration 用现有 owner selector 持续重判，不保存第二份业务阶段。
2. 主机未激活时，MMP/LMP 显示 8 位激活表单；LMS/LSP 显示各自的主机激活引导。显式调用激活交互且主机已激活时，四面显示“设备已激活成功”；该状态不自动计时、不增加继续按钮，integration 随后按当前 owner selector 将阶段交给相应业务包路由。断链/同步未就绪遮罩优先于该成功状态。
3. 主机已激活但未登录时，主屏显示登录页；副屏/副机只显示在主机登录的说明。登录成功后按 sample 进入会员桌面或壁纸选择。
4. 配对副机只有在当前连接和所需投影已就绪后进入业务。中断、退配或换主机过程中，业务面统一遮罩；本地 admin 入口仍可用。
5. 会员列表由主机 owner 持有；LMP/LSP 的录入与待确认各自隔离，MMP 与无 LMS 的 LMP 在单屏确认面完成姓名/电话核对和可选年龄输入。单机 LMS（主机同一 runtime 的 SECONDARY）消费主机本地 pending 并本地派发确认/拒绝；双机 LMS（SLAVE+VICE）只消费带主机操作身份的 pending 投影，确认/拒绝显式发给 MASTER owner，过期操作由 owner 拒绝。LSP 始终在自身独立页面确认。年龄只在顾客确认命令中提交，不进入会员登记请求。
6. 壁纸由每个设备本地 owner 持有；LMS 展示主机已确认投影，LSP 始终展示自身已确认与待选值。MMP 与 LMP 壁纸页均提供店员登出 command；LMP 的“退出”只结束壁纸选择页，不能替代登出；LSP 不提供登出入口。
7. 本地管理员可从各面打开共享 admin console；激活状态与配置 tab 使用 selector/command，副机只读。断链时本地 topology tab 承担取消配对或改主机地址的恢复入口。

## 4. 边界、非目标与方案选择

- 产品语义由正式需求 R-01～R-16 及其已记录 Dexter 裁决决定；本提案不改 8 位码、`serverSpaces`、配置 URL 前缀与 generated 后缀、代理密码明文同步、副机管理只读或 LSP 独立页面等决定。
- 按正式需求 R-03，激活交互与服务配置面分别由共享 UI base 包 `apps/terminal/ui/base/terminal-activation`、`apps/terminal/ui/base/server-config-panel` 承载；两者只消费既有 owner 的公开 command/selector，不拥有激活凭证、服务配置事实或第二份业务状态。sample-staff-auth、sample-member-desk、sample-wallpaper-picker 仍是各自的 `ui/feature`。integration 组合这些包并按 owner selector 路由阶段。
- 替代方案是 integration 直接渲染并跨包读写 state/HTTP；这会把业务入口复制到两个 integration，并破坏现有 owner 边界。
- 不建设通用流程引擎、同步框架、业务事件总线、离线队列、多主合并、独立会员后端 API 或第三份状态副本。
- 对实现缺口只设计最小的 owner state/command/sync 声明；不从物理屏、内容简称、可达性缓存推导设备主机资格。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 集团空间与商业集团是不同事实 | `project-memory/decisions/confirmed-business-language-corpus.md#G-01` | UI 显示的服务空间名称来自本机 `serverSpaces` 配置；不显示或反查集团空间编码，不从服务空间推导商业集团、门店或权限 | 正式需求中的服务空间配置与集团空间不是同一对象；无冲突 | 否 |
| 店铺运营方、门店与本地终端角色 | `project-memory/decisions/confirmed-business-language-corpus.md#G-03`、`#G-05` | “店员、顾客、本机终端管理员”仅按本专项正式需求作为 TER actor；不映射成运营账号、运营角色或任职，也不由可见页面推导读写权 | corpus 未定义 TER 的店员或设备本地管理员；其语义由专项正式需求 R-01～R-16 提供 | 否；不补造 IAM 映射 |
| 服务空间 URL 与显示名称 | `project-memory/decisions/confirmed-business-language-corpus.md#G-10` | 服务地址与 URL 前缀由 `server-config` owner 提供；URL 只供定位，不作授权、不从显示名称反查；与运营后台 URL 中的集团空间编码分开 | G-10 具体约束双后台 URL；本 Journey 的设备服务 URL 由专项正式需求定义，不扩大 G-10 的适用对象 | 否 |
| MMP/LMP/LMS/LSP、MAIN/BRANCH 与实例角色 | `doc/platform/terminal-coding-standard.md` §4-E、§4-D | MMP/LMP/LMS/LSP 只标注内容场景；实际状态仍使用已有 `surfaceForm`、`workspace`、`displayMode`、`instanceMode` 与 MAIN/BRANCH 写入归属，不新建持久拓扑枚举 | 这些终端术语不属于 G-01～G-12 business corpus；按终端规范与专项正式需求使用 | 否 |
| 激活码、终端凭证、代理密码、会员草稿与壁纸 | corpus 无对应条目 | 仅按专项正式需求及各 owner 当前 command/selector 使用；终端凭证只在 `terminal-data-client`，代理密码仍属 `server-config`，会员与壁纸仍属各自 owner | `confirmed-business-language-corpus.md` 的权威范围是 G-01～G-12 与 CIPG-01；无条目不表示可从类似领域类推 | 否；不新增 corpus 规则 |

**Corpus 检索结论**：复读 corpus 的 G-01、G-03、G-05、G-10；其余专项术语未由该 corpus 定义，已回指终端规范与正式需求。没有把“集团空间”“商业集团”“服务空间”互换，也没有从身份、URL、内容简称或壁纸配置推导授权。当前无需 Dexter 裁决。

## 6. UI 适用性与后续工件

`UI_BEARING=true`。正式需求新增了激活、服务配置、激活状态、四面 sample 与本地双机恢复交互；2026-09-26 Journey 中“本期无设备侧 UI”已被新正式需求覆盖，不能作为本提案的排除理由。

本 Journey 由 Dexter 于 2026-10-02 接受交互方向：四面激活/登录、共享本机 admin 状态/配置/拓扑、本地 admin 在副机断链时仍可恢复、LSP 独立会员与壁纸页面、LMS 展示主机投影。该接受仅确认本文件第 3～4 节所述用户路径，不把后续待审线框的控件细节或任何未运行判据视为产品批准/验证通过。

本 Journey 仅取代 2026-09-26 Journey 中“本批没有终端 UI”这一范围判断。激活与连接的 owner、协议与契约语义仍由正式需求和已接受 service-shape decision 决定；旧 `TERMINAL_ADMIN_CONSOLE` proposal 不是本 Journey 的接受依据。

```text
DEXTER_JOURNEY_DECISION=ACCEPTED@2026-10-02
DEXTER_WIREFRAME_REVIEW=DIRECTION_ACCEPTED@2026-10-02; SCREEN_AND_CONTROL_DETAILS_REMAIN_REVIEWABLE
IMPLEMENTATION_FACING_DESIGN=IN_PROGRESS; DESIGN_AND_PLAN_REMAIN_SUBJECT_TO_INDEPENDENT_REVIEW
```

### 6.1 管理后台交互一致性

本 Journey 的消费面是独立 TER public UI 与本机 admin console，不是 `platform-admin` 或 `operations-admin`。管理后台 §3-K-1..§3-K-10 不直接适用；TER 的输入、设备、焦点与承载约束按 `doc/platform/terminal-coding-standard.md` TR-16、TR-17、§4-D、§4-E 执行。不得把本机 admin console 与两个后台 app 混同。

## 7. Dexter 裁决

- 裁决：接受整体交互方向。
- 精确范围：四面激活/登录；共享本机 admin 状态、配置、拓扑；副机断链时本地 admin 恢复；LSP 独立会员与壁纸；LMS 展示主机投影。
- 已知前提：按正式需求 R-01～R-16 与本 Journey §2 的逐 actor 前提链；没有未决外部前提。
- 未决项：R2 已按修订前字节完成独立静态复核；本轮 S-1 修订后的详设包交 Dexter 与 Claude 评审，逐屏运行与实现细节仍未验证。
- 后续允许动作：编写交互、IA、详设和实施计划；不含源码实施或动态验证授权。
