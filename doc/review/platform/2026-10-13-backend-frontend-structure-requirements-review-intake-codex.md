# 前后台重点代码结构正式需求 · 作者 finding intake

日期2026-10-13。作者处置，不是独立verdict。`REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_REQUIREMENTS_20261013`，`REVIEW_TARGET=DESIGN`。不重开TER T1的已关闭cycle。

## 1 · R1 输入与结论范围

fresh readonly `/root/bf_requirements_blind_r1` 独立GO、M/S/N=0/0/1，针对需求SHA `c8603b2a33ac69fb67c12da12059f7609f898eeb7595d9f3d1ed5b40542f1c13`。原始计数不因作者补正改写；报告与真实输入清单分别为本目录`2026-10-13-backend-frontend-structure-requirements-review-r1-codex.md`及`-review-inputs-r1-codex.md`。

## 2 · 主agent辩证处置

| 输入 | 核验/反例及更小方案 | 处置 | 修改 |
|---|---|---|---|
| R1 N-01 corpus缺指针 | 确认。read-policy:25–27要求任务文档记录命中ID，原需求§4确无。重开corpus G02–05/05A/05B、G08–12/CIPG01；不能复制正文或按语料推新业务/权限。更小方案是一段住址/命中/禁推引用，不建台账 | CONFIRMED / CLOSED（作者；待R2独立复核） | 正式需求§4语料段 |
| 作者补正 A-01 视频消费者易被验收文字遗漏 | 源码PlatformAssetService:1366–1386、1389–1434、1512–1551；materializeAndValidate也消费video/mp4、maxBytes/magic不同，图片才decode。原R05/V04只点ZIP/图片，R01已要求保留所有现行为，未证实已引代码缺陷。最小把已有视频保留条件写明，无新视频能力、无解析框架 | CONFIRMED / CLOSED（作者补充，不计入R1 finding） | R05、V04 |
| 作者澄清 A-02 focused不豁免最终acceptance | 复读后台规范R-READ-07:438–445，最终全量应在全部生产/测试改动后。原R17/§5已说F不是豁免；增加显式正本指针与执行顺序防误读，不新增运行授权、不默认扩完整verify | CLOSED（澄清；不计入R1 finding） | R17 |

同根回读：§0五裁定、§2全部14族、R01–17、V01–18和非目标再次核对。两延后项B4/B5仍本期不执行，B7不新构造框架；视频只是同一现路径消费者，语料不产生新产品语义，后续验收不因F跳过适用规范。

失败模式：有行为保真要求但缺实际消费者/规范出处，导致后续实施者自行缩验收范围。最小防再犯落在本需求§4、R05/R17与V04，后续V16/V17要求文档/详设读回；无需新memory或机器门。本次不改正本/代码。

## 3 · 修订字节与状态

R2送审需求SHA：`dd865fea25517586e654ab8e372ba8c13c2bbaa849404d7ba1a8f1422149c336`。R1原结论只对应旧字节；修订由新fresh reviewer独立复核，不以本intake判GO。

详设/计划、所有实现、生成、编译、测试、verify、HTTP/browser L2、DEV、reset/seed、设备、UAT、部署及cleanup均NOT_RUN。子agent只读，全部文档写入由主agent完成。本轮未修改源码、规范、记忆、canonical或依赖。

## 4 · R2处置与持续审查依据

R2 fresh `/root/bf_requirements_blind_r2`：NO-GO、0M/1S/0N，SHA `dd865fea25517586e654ab8e372ba8c13c2bbaa849404d7ba1a8f1422149c336`；原始计数/默认第二轮硬停止声明保留在review-r2，不改写。

**S-01：CONFIRMED，作者已修正，待新字节独立核验。** 主agent亲读PlatformAssetService:480–497、1319–1337：公共stage只准当前图片用途/格式，privatePackage只准ZIP。suffix/maxBytes/magic出现video不是可达消费者。§2 A-01的原作者判断被证伪，标记`REJECTED_WITH_EVIDENCE / SUPERSEDED_BY_R2_S01`，不能继续称其源事实确认。

最小修正只改需求R05:84、V04:169：正向等价覆盖现可达ZIP/图片；视频公共入口继续拒绝，不开放新用途；底层保留分支不误加图片decode。没有删除代码、建视频框架/上传业务或新schema。同根核对R01:67、§2 B2、R05、V04、§6非目标：保持产品/公开边界一致。

失败模式是“下层类型/私有分支存在，被误作上层合法路径”；与分析P-9同族。防再犯写在R05/V04的准入反例，后续V16/V17真实调用链与producer/consumer审查，不加关键词门或新记忆正文。

**继续审查权限**：默认DESIGN两轮规则已被两份原始报告如实保留；Dexter本任务最新原话明确要求“完成对抗性review，直至go”，本次按该直接持续授权追加定向fresh审查以关闭上述文案错误，记作同一cycle R3，不改名/改目标重置轮次，不重开TER T1 cycle。额外审查不产生详设、实现或运行权限。主agent不自行判GO。

R3送审SHA：`07ebaf95e16e78b1951ae52ca65e38bb5d451bfd757f87a09e667bfd7a232120`。授权仍只文档；全部实现/运行仍NOT_RUN。

## 5 · 当前字节的独立结果与关闭

fresh readonly `/root/bf_requirements_blind_r3` 对以上同一SHA独立GO、M/S/N=0/0/0，报告`2026-10-13-backend-frontend-structure-requirements-review-r3-codex.md`。reviewer开始及结束亲算相同SHA，主agent接收后只保存报告/本intake，未再改需求正文。

| 处置 | 当前结果与位置 |
|---|---|
| R1 N-01 | CLOSED；需求§4:145，corpus住址/命中ID/禁推；R3全文及语料读取核验 |
| R2 S-01（原作者A-01被证伪部分） | CLOSED；需求R05:84、V04:169；R3按真实公共stage准入、private分支、公开caller/canonical区分后核验，不开放视频上传 |
| 作者A-02规范义务澄清 | CLOSED；R17:138，最终全量backend-acceptance晚于所有生产/测试改动，不以focused/F豁免；R2/R3均核验 |
| 其他13来源族/五裁定/R01–17/V01–18 | 无新增finding；B4/B5仍本期不执行，B7仍保留构造，未扩业务/契约/数据库/TER |

默认两轮与本次直接“直至go”的续审权限差异见§4，原R1/R2结论没有改写。不存在未决产品项或未关闭的当前需求finding。

结束闸门：active goal未创建；当前任务仅正式需求＋对抗review，文档和当前字节独立结果已完成，无本task剩余可执行项。未来详设/实施/运行均未授权，不是当前任务未完成项。business/cleanup运行证据N/A：本次无运行或资源启动，所有未来验证NOT_RUN。未改生产/测试/规范/记忆/契约/依赖。
