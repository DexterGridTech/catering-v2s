# TER T1 正式需求 · R2 reviewer input checklist

REVIEW_CYCLE_ID=TER_T1_REQUIREMENTS_20261013
REVIEW_TARGET=DESIGN
DOCUMENT_KIND=FORMAL_REQUIREMENTS
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerContext=FRESH_V2S_ROOTED_READ_ONLY
reviewedObject=doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md
reviewedObjectSha256=b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e
reviewerInputChecklist=doc/review/platform/2026-10-13-ter-t1-requirements-review-r2-inputs-codex.md
blindReviewDeclaration=先读取用户原话和明确裁决、规范、项目记忆、完整正式需求及适用owning source，独立形成GO/0M/0S/0N并发送给主agent；之后才打开R1、作者intake及讨论稿其余作者分析。
authorMaterialReadAfterIndependentVerdict=true

## 1 · 身份、授权与字节

- 仓根：`/Users/dexter/Documents/workspace/idea/catering-v2s`。
- 独立 reviewer：`/root/t1_requirements_r2`；不是作者或 R1 reviewer。
- 主agent提供的 Dexter 授权原文：“好的，请根据需求讨论稿，生成正式的需求文档，并完成几轮对抗式的review”。
- 批准范围：完整正式需求的 DESIGN 审查，不是 implementation-facing 详设审查或实施评审。
- 起读及结束前分别执行 `shasum -a 256`；两次均为上述 SHA，无漂移。
- 所有命令仅用于读取、定位、SHA计算及确定性 memory query。没有文件写入、子agent派生、Git动作、生成、编译、构建、测试、verify、DEV、浏览器、设备或数据操作。
- 未读取 `.runtime/`。读取 runner 源码中涉及 manifest 的实现，不等于读取 manifest 或运行 runner。
- 曾以候选路径读取不存在的 `createModule.ts`、State application 目录和 server-config managedServerSpaces；随后用 `rg --files` 找到真实 owning path。这些不存在的候选路径未用作结论证据。

## 2 · 入口与 skill

| 输入 | 实际读取 |
|---|---|
| `AGENTS.md` | 全文；首次较大输出中段截断后分块补读 |
| `CLAUDE.md` | 全文 |
| `PLATFORM-BLUEPRINT.md` | 全文 |
| `doc/platform/README.md` | 全文 |
| `scripts/README.md` | 开始任务、协议生成/运行面导航、旧TER runner退役、验证、测试健康、对抗审查及运行边界等适用部分 |
| `.agents/skills/cs-review/SKILL.md` | 全文；只使用仓内 skill |
| `project-memory/index.md` | 全文，全部 kernel 导航 |
| `doc/platform/review-standard.md` | 全文，使用动作1-B及固定结论块 |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | 全文 |
| `project-memory/operations/verification-governance.md` | 全文 |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 全文 |
| `doc/platform/foundation-charter.md` | 全文，分块读取 |
| `doc/platform/terminal-coding-standard.md` | 全文，分块读取；重点重开TR-01/03/04/06/09/11/12/15/16/17、§4-D/E/F与§7 |
| `doc/platform/third-party-library-usage-standard.md` | 全文 |

## 3 · 用户原始材料

独立阶段先只读取：

- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md` §1：原始八个方向。
- 同文件 §11：declarations、静态ParameterDefinition、取消地址固定数量上限三项回答。
- 同文件 §13.1：补充要求及最终澄清；尤其“不修改transport”“API由使用包内部声明/消费”“跨包command/selector”。

随后读取正式需求全文，包括R-01～R-17、V-01～V-18及授权/未决/事实档位，不把作者CLOSED字段当作判据。

独立结论形成并已向主agent发送之后，才读取：

- `doc/review/platform/2026-10-13-ter-t1-requirements-review-r1-codex.md` 全文。
- `doc/review/platform/2026-10-13-ter-t1-requirements-review-intake-codex.md` 全文。
- 讨论稿其余全文。
- `doc/plans/platform/2026-10-13-ter-key-code-structure-t1-source-inventory-claude.json` 元数据、限制声明和40包导航；未把附件的文件摘要当作逐分支源码审计。

R1 inputs 已落盘，但本轮未另外打开。它不是本轮最小输入，也未用于继承R1阅读证据。

## 4 · 六维 query 与全部命中原文

实际命令：

```bash
scripts/memory/query \
  --task-kind design \
  --domain platform \
  --consumer-face operations-admin \
  --owner platform \
  --impact architecture \
  --trigger task-start
```

命中原文全部已打开。较大合并输出发生截断时，后续按文件和行段补读；不以截断输出中的路径列表冒充正文阅读。

### 全部 kernel

- `project-memory/kernel/01-workspace-and-authorization.md`
- `project-memory/kernel/02-service-shape-and-owner.md`
- `project-memory/kernel/03-transaction-data-and-dependencies.md`
- `project-memory/kernel/04-contract-consumer-and-admin.md`
- `project-memory/kernel/05-evidence-runtime-and-git.md`
- `project-memory/kernel/06-heritage-and-change.md`

### 全部 routed 命中

- `project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/decisions/http-crud-efficiency-design-redlines.md`
- `project-memory/decisions/independent-subagent-adversarial-review.md`
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`
- `project-memory/operations/business-corpus-adoption-and-read-policy.md`
- `project-memory/operations/business-corpus-parked-domain-intake.md`
- `project-memory/operations/execution-economics-and-failure-family-closure.md`
- `project-memory/pitfalls/designing-from-conversation-not-system.md`
- `project-memory/pitfalls/invisible-dimension-drifts-at-implementation.md`
- `project-memory/pitfalls/platform-detail-reverse-inference.md`
- `project-memory/practices/backend-capability-lookup.md`
- `project-memory/practices/collection-boundary-modes.md`
- `project-memory/practices/module-call-boundary-ownership.md`
- `project-memory/practices/ordering-only-for-consumer-facing.md`
- `project-memory/operations/terminal-coding-standard.md`
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`
- `project-memory/decisions/terminal-build-order-and-batches.md`
- `project-memory/practices/ter-input-and-virtual-keyboard-usage.md`
- `project-memory/practices/third-party-library-official-source-verification.md`

## 5 · Corpus 与 applicable sourceRefs

Corpus 原文已完整读取。候选词包括门店、项目、集团、合同、店员/登录、绑定、服务地址/URL、业务读取和写入。

| 命中 | 本轮边界 |
|---|---|
| G-01/G-02 | 集团空间不等于集团，组织事实不能从启动输入或代码身份推导 |
| G-03/G-04 | 门店、经营租户、总公司身份分开；不借结构重组新增业务关联 |
| G-05/G-05A/G-07 | 读取事实、写资格、账号/任职不能互推；本稿不改变CBS鉴权或新增登录任务 |
| G-08/G-09 | 门店启停、合同衍生状态不互推；结构保真不意味着新增停机/登出策略 |
| G-10 | URL定位不构成授权，不硬写默认空间或集团路径 |
| G-11/G-12/CIPG-01 | 原文已读；本稿不新增商品、库存、制作、扫码或销售能力，不从示例包推导这些业务范围 |

实际回读的适用 sourceRefs：

- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md` 全文。
- `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` 全文。
- `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md` 全文。
- `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` 全文。
- `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` 全文，含2026-10-10/12修订。
- `doc/decisions/2026-09-25-v2s-roadmap-mechanism-retirement.md` 全文。
- `doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md` D.7/D.8适用上下文，按当前退役与日志决定判优先级。
- `doc/review/platform/2026-08-13-v2s-compliance-control-retirement-decision-claude.md` 全文；不恢复其中后来也已退役的旧业务验收资产。
- `doc/review/platform/2026-08-28-newposv1-package-analysis-claude/00-ter-build-order-claude.md` §1/§2、§4B.1～3、§4B.7/8/9b/10/11及T-5等适用原始裁决。
- `doc/plans/platform/2026-08-29-v2s-terminal-skeleton-requirements-claude.md` §6.2/6.3/§9；只用作结构/依赖与证据边界来源，未复活历史骨架批次。
- 四份设计模板、review-standard、foundation-charter、terminal-coding-standard、third-party-library-usage-standard，阅读见本清单其他节。
- `project-memory/operations/execution-economics-and-failure-family-closure.md`、`project-memory/practices/ter-input-and-virtual-keyboard-usage.md` 已读正文及所指适用TER规范。

其余 query sourceRefs 的适用性处置：

- catalog/识别与制作信息的正式需求、IA和交互 sourceRefs：本轮不修改其业务或UI；未打开这些原始专题全文，不将它们作为T1产品目标。
- base-1及后台性能需求/详设/复评/根因报告、M1 extension、public invitation、RM1 U13/U26 evidence、后台standards review、外部协作spec：本轮不修改这些HTTP操作、owner命令、SQL/事务、扩展字段或页面；未打开这些后台历史专题全文，不将TER包私有API组织误当后台接口重划。
- `build.gradle.kts`、`tools/verify-gates/verify.mjs`、销售菜单执行诊断：本轮不修改或运行这些执行图，也不声称性能/verify结果；未打开其全文。测试链路要求直接回读当前日志决定与execution-economics原文。
- 冻结 `logging-and-debugging-foundation-standard.md`：未重读全文；本轮无运行或日志实现评审，当前日志内容与测试前置依据已直接读取现行日志决定，未引用冻结旧脱敏要求。
- `doc/platform/backend-coding-standard.md`、`doc/platform/implementation-task-template.md`：未读全文；本轮非后台实施/详设，未来实施义务由正式稿明确指向现行规范，不据此宣称后台接线或执行准入已通过。

这些N/A只限定当前正式需求审查，不豁免未来详设/实施按真实影响面重开原文。

## 6 · Decisions inventory 与适用 decision

执行并读取完整标题输出：

```bash
rg -n '^# ' doc/decisions/*.md
```

结合TER规范及本轮边界筛选适用决定。除第5节列出的治理/sourceRefs外，读取：

- `doc/decisions/2026-09-28-ter-third-party-usage-remediation.md` 全文。
- `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md` 全文，分块补读。
- `doc/decisions/2026-10-02-v2s-terminal-activation-batch-3-amendment-proposal.md` 全文。

现行阶段B/C、主副机、topic、凭证及生命周期判据以当前terminal规范§4-D/E/F和真实owner源码核验。本轮没有改其产品规则，不为T1重开既有Journey或声称那些Journey已经动态通过。

## 7 · Owning source 回读范围

下面记录实际读取的关键文件/片段；不是全TER逐分支实现review。

| 接缝 | 实际读取 |
|---|---|
| 静态error/parameter工厂 | `kernel/base/contracts/src/foundations/definition.ts`、`types/parameter.ts`、`types/module.ts` |
| Runtime具体定义/metadata/注册 | `kernel/base/runtime/src/types/module.ts`；`application/createRuntime.ts`的validateModuleShape、selector注册、模块集合、启动时stateSlices汇总 |
| State registration与reset | `kernel/base/state/src/types/slice.ts`；`foundations/createStateRuntime.ts`的retain、hydrate和reset actor；`persistenceEngine.ts`的reset完整执行边界 |
| UI声明派生 | `ui/base/feature-assembly/src/types/featureAssembly.ts`、`foundations/createFeatureAssemblyModule.ts` |
| 通用integration | `ui/base/integration-assembly/src/foundations/integrationAssembly.tsx`的类型/注册开头；`stateSyncSlices.ts`全文 |
| 两个integration | 两个`src/assembly/assembly.tsx`中的createIntegrationAssembly调用、全部相关模块装配、sync外部名单、update资格及TDC/transport输入 |
| TDC公开面与请求归属 | `kernel/base/terminal-data-client/src/index.ts`；`types/client.ts`相关类型/import；`features/actors/terminalDataClientActor.ts`中readTerminalData处理、credential flush、取消/离线取消、根reset和reset后native接缝 |
| TDC持久/同步 | `features/slices/terminalDataClient.ts`的initial/credential同步/持久registration；status projection的descriptor |
| 业务API调用者 | store-basic/project-basic actors的readOperation与TDC调用；terminal-update报告/下载grant；remote-control登记/报告调用 |
| transport owner | `kernel/base/transport/src/moduleName.ts`、`application/createTransportModule.ts`的owner、command gateway、HTTP关联及资源释放 |
| generator | `contracts/policy/terminal-client-generation.json`全文；`scripts/generate/terminal-client-api.mjs`输入/目标/根内路径校验与多target模型部分 |
| server-config | `foundations/validateServerConfigDefaults.ts`地址数量/URL/名称校验定位 |
| Android入口 | 两个application `src/assembly/managedServerSpaces.ts`全文；platformPorts调用定位 |
| Web入口 | 两个integration `test-expo/App.tsx`的managed One/Two生产消费定位 |
| automation/DEV | `tools/terminal-automation/src/runner.ts` managed endpoint结构、验证及环境变量消费者；androidDevice/Journey/test消费者定位；`scripts/dev/r5-dev-runner.mjs` readiness/manifest地址生产片段 |
| input既有能力 | `ui/base/input/README.md`定位、公共面、输入/焦点/生命周期适用部分 |

路径以上均以`apps/terminal/`为基准，另明确标出的contracts/scripts/tools除外。源码只是证明需求接缝有现成能力及明确约束，未升级为任何测试或运行PASS。

## 8 · 第三方依据适用性

已读取第三方规范及TER第三方整改裁决。本次正式需求未指定新增第三方API、升级版本、默认行为或资源阈值；关键可行性依据是仓内已有factory/registration/command接缝。

因此未查询外部官网或执行解析图/实验，不声称任何第三方行为已验证。后续详设实际依赖具体API/初始化时序/原生生命周期时，仍须按对应解析版本核验官方依据。

## 9 · 四模板逐节适用性

本次不是T1详设定稿；不得把未授权产物缺失转成需求finding。

### journey-decision-template.md

| 节 | 对正式需求适用性 |
|---|---|
| §1裁决元数据 | 有等价内容：正式稿§0的来源、类型与授权；不伪造新Journey接受 |
| §2用户任务与成功结果 | 有：§0.1维护者任务及成功标准 |
| §3逐actor前提链 | N/A：未新增业务actor/资格/入口任务；既有前提须后续按影响面保持 |
| §4边界/非目标/禁推 | 有：R-01、各R的禁止项与授权 |
| §5corpus命中/冲突 | 通过本清单核验；未新增业务事实或改变命中条目 |
| §6 UI及后续工件 | 有：R-16/17、§7.3；无新页面，不要求现在画线框 |
| §6.1后台一致性 | N/A：非后台UI设计 |
| §7 Dexter裁决 | 有：Q-1/2/3及API澄清映射；无详设/实施授权 |

### ia-design-template.md

| 节 | 对正式需求适用性 |
|---|---|
| 模板背景/§1元数据 | N/A于独立IA产物；需求§0明确阶段与来源 |
| §2.1可见维度 | N/A于新UI；V-04/16保留既有错误消费/交互保真 |
| §2.2不可见维度 | 有需求级对应：owner、sync/readiness、身份、失败、地址链及可执行V场景；细化归详设 |
| §2.1.1负载行为 | N/A于新容器；不新增规模/布局阈值 |
| §3共用IA规则 | N/A于独立IA工件；现有规则保留 |
| §4错误映射 | 有需求义务R-05/V-04；本轮不要求新增逐problem界面表 |
| §5交叉对账 | 已比用户裁决/正式稿/现行TER规则；R-16要求后续工件一致 |
| §6完成判定 | N/A：不宣称IA已交付或已获看图接受 |

### ui-interaction-design-template.md

| 节 | 对正式需求适用性 |
|---|---|
| §1元数据、§1.1标准、§1.2后台引用 | N/A：无新screen/后台UI |
| surface ownership自检 | N/A：本稿没有线框 |
| 业务语言/owner-definition槽位 | 不新增文案/字段；保留既有owner和错误类别 |
| §2 interaction map | N/A：不新增Journey |
| §3 v2页面盘点 | N/A：不搬新页面 |
| §4线框、screen声明 | N/A：当前正式需求无新可见操作 |
| testId表、控件roster | N/A于需求交付；未来automation影响面仍须对读 |
| 表单依赖图、mutation事实矩阵 | N/A：不新增或改变业务表单 |
| 主从集合布局 | N/A：不改变该类UI |
| §1.3搜索/§1.3.1候选协议 | N/A：不新增搜索或候选 |
| §5状态/边界 | 需求级R-04/05/09/12及V-12/15/16有保真要求；不要求新交互工件 |
| §6操作合理性 | N/A于新增UI操作；既有操作保留，后续不可从API反推新操作 |
| §7face/owner | 有边界：R-01/07/14，不改变CBS鉴权/事实owner |
| §8 Manifest B.4/B.5 | 退役compliance-control不恢复，不作为当前缺项 |
| §9高保真demo | N/A |
| §10看图结论 | N/A，不伪造接受 |

### implementation-design-template.md

| 节 | 对正式需求适用性 |
|---|---|
| 收录尺度/§0授权 | 有：任务与明确不授权 |
| §1目标/替代 | 需求给目标；本review独立比较替代；完整详设方案比较属后续 |
| §2 CP总览 | N/A：未授权实施计划，未自行切CP |
| §3横切机制 | 有需求级R-05～R-15；逐CP四列表属后续 |
| 第三方API依据 | 当前不选具体新API；未来适用时按规范 |
| §3a UI/testId与L2全集 | N/A于当前无新UI需求；不以N/A豁免后续受影响automation |
| §4 CP门控 | N/A于当前计划产物；R-17已有比例验证原则 |
| §5 operation/path/face/集合 | R-07/R-11/R-16规定逐operation与可变集合；具体分配留详设 |
| §6跨owner写/事务 | N/A于后台事务变更；TERcommand/selector边界保留 |
| §7声明—传递—消费 | 有：R-16点名API、地址、sync及身份全链 |
| §8规则→owner | 有R-01/07/09/10/12/14需求约束；具体判定点留详设 |
| §9 API/consumer | 有：R-07/R-16及V-06～08；不冻结内部factory签名 |
| §9a同步清单 | 有R-01/14/15/16；逐文件全集留当前字节详设 |
| §9b定位 | 本稿为需求，不含逐编辑施工指令 |
| §10迁移 | R-12/R-16明确持久身份与旧设备数据处理；无当前迁移执行 |
| §10b、10b.1～6 seed | N/A于当前业务数据物化；受影响配置producer/fixture纳入R-11；无reset/seed授权 |
| §11场景、§11a判据映射 | 有V-01～18与§8方向映射；测试文件/具体面留详设 |
| §12未决 | 有§7.2/7.3，明确内部设计义务与产品差异求裁 |
| §13停机/测试链准备 | 有R-17、现行日志正本引用，无动态授权 |
| §13b三维、§13c逐代码 | 有R-17要求完整CP及全批按实施规范；实际对账产物未到当前阶段 |
| §14交付自查 | 当前需求由本review逐条核验；不宣称实施exit完成 |

## 10 · 证据与未读项

- STATIC_REVIEW=PERFORMED。
- 新UI工件：无；L3当前被审UI未验证项为空。
- 代码符合T1、生成链结果、编译/类型/测试、Expo Web、Android、DEV、L2/UAT均未证明，`NOT_RUN`。
- cleanup=`NOT_APPLICABLE_NO_RESOURCE_STARTED`，不写动态cleanup PASS。
- 未读全文的后台历史sourceRefs、R1 inputs及完整库存文件内容已如上披露；不影响本次需求边界的判断，也不代表未来实施可以跳读。
- 独立阶段与后读阶段完成，当前只读task没有剩余必需动作；以本轮综合结论硬停止，不建议第三轮。
