---
title: TER 版本更新阶段 A 实施计划
status: PROPOSED_FOR_DEXTER_CLAUDE_REVIEW
implementationAuthority: false
---

# 阶段 A 实施计划

## 0. 任务、来源与授权

目标：完整完成 `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md` §20.3，以及 `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md` 的全部A判据。
当前只写文档；本计划里的命令、proof、CP和动态运行全为未来，不能据本文件开始实施。
同一批次按CP-01→06顺序推进，单批交付；不提前实现B/C、不并行干扰 Codex 的 automation-agent 工作，其运行交付状态本轮未核验。
模板正本 `doc/platform/implementation-task-template.md`；IA/交互/第三方附件是设计输入。Dexter 已确认三个面的界面内容；工程OPEN与实施授权仍须先处置，界面确认不是运行证明。
STANDARD_DEPENDENCY=APPROVED_PENDING_CP02_IMPLEMENTATION_SYNC：Dexter 已批准详设§12所述仅取消激活根级清除的精确 TR-09 例外；现行正本尚未同步。当前计划不授予规范修订权，未来实施授权下须在 CP-02 之前落地正本与 focused/red，不能把批准当实现完成。

## 1. RECALL 与开始条件

每个实际变更点重开需求条款、详设对应段、IA/交互、六维命中记忆和owning source；focused后用同组回读。
全部kernel和deterministic-context-only；路由词来自scripts/memory/query合法词汇，不把navigation当规则。
实施授权必须显式覆盖native/两App/build/automation扩展及Web/设备；企业签名/目标设备/api/current automation接口未核实时不冒称具备条件。
FULL 最低 API 须在实施授权前按详设§12由 Dexter 选择：API≥29 使用公开 isCommitted，或允许API24～28并接受无法判定的 session 在系统实际回收前保持 UNKNOWN、无承诺期限。静态默认min24不代表已经选定；具体系统回收行为在 CP-03 按目标 API 官方依据及获批分支验证。
不在本轮运行依赖解析/安装/构建或feasibility；未来在对应CP早期闭合，不等待整体验收首次发现。

## 2. CP-01 · 单源版本、工件与自动化登记

RECALL：R01/02/03；详设§8.1/9a/9a.1；两App package/Gradle/Hermescompiler、canonical生成惯例。
允许修改：artifact schema/能力生成器/Node打包器、两App package/Gradle/签名发布配置；当前automation CLI与资源/health/format登记。
步骤：
1. 建立四字段单源/严格比较/内容身份，不手写Gradle另一值；冻结生产三脚本。
2. 同 compiled 发布树生成 embedded INSTALL 及 FULL，同次 APK 字节；embedded 保持 assets:// bundle+res，不复制整树；构建 publicationId/实际 asset 名写入签名 APK metadata。从最终签名 APK 解出实际 embedded bundle，SHA-256 必须等于发布树入口摘要，不允许 RN Gradle 另一轮 Metro 产物替换。资源核对发布树清单与实际 assets/res 名称及尺度/限定符映射；AAPT 会转换 drawable，故不比较转换后的 drawable 与原始字节，实际可用性由 F-LOAD 证明。HOT 显式最小 FULL 与全部资源。
3. 生产版本源与受管测试descriptor副本隔离；真实APK包名/签名/版本读回校验；所有路径realpath仓内，包括子文件symlink红例。
4. 记录实际Expo/RN/compiler版本与Gradle解析，不能把compiler NPM号当nativeHermes；新候选依赖官方同版依据。
5. 现有automation runner增phase=update和有限case解析、复用同run根/profile/kind；health/format/预算门红例同时做；不先建场景后补资源登记。
6. 当前 runner 对 journey/skill 接 DEV，给新增 update.flush/compatibility/rollback真实业务子断言明确requiresManagedDev=true并接既有managedActivation父流程；技术子断言false。合法fixture/context缺失fail closed；不只增加phase枚举。沿用详设§9a.3的 transport/fixtures/selector 真实接口与 TestId options 形状。重开 automation 静态评审中修复后的公共 helper，不假定旧 selector 等待、session 隔离或设备 cleanup 已闭合，也不另建 driver；未受影响的已完成 CP 不重复对账。
PROOF：schema/generator check+self-test；owned typecheck；两App三产物打包检查及非法版本/identity/根外red；保留metadata/版本而替换实际embedded入口的红夹具必须报摘要不符，资源缺项/错映射同样拒绝。当前全部NOT_RUN。
CP出口：全部工作/必要修复与focused完毕，fresh独立完整CP三维对账MATCHED。不声称设备可用。

## 3. CP-02 · UpdatePort契约、最终本机owner与Web先行

RECALL：R06/09/10/15；详设§8.3～8.6；runtime initialize/flush/resource、state persistence/sync约束。
进入前：已有 Dexter 精确例外批准，仍须未来实施授权明确覆盖规范同步，并完成唯一 TR-09 正本修改及 focused/red。只覆盖取消激活原因 TERMINAL_ACTIVATION_CANCELLED；未满足不实现 retain，不以通用 state 能力或第二存储绕过。
规范同步同时写明 retain 按 slice.resetIntent 生效、不读取原因；当前唯一生产根级触发点是 TDC 取消激活。任何新增 requestApplicationReset 生产调用点必须重新评审例外，CP-02 review checklist 核查这一调用点集合。选择文字义务加既有字段 focused/red，不另增扫描门；当前单生产调用点可直接复核，Runtime 测试中的其他原因不属生产集合，新增独立门的维护成本不值。
同步既有 skeleton 的 runStateResetRetentionOnly：当前精确允许 server-config 且声明数量为1；随已批准例外接纳 terminal-update 自有持久 descriptor，更新精确 owner/source 与数量判定。保留其他 owner/非持久字段/orphan 清除的 focused/red，不扩大通用 retain、不新建机械门。该门修改须由未来实施授权覆盖，本轮不改规范或门源码。
可选前置：未来授权可单列一次性、不进入产品代码的 F-LOAD 技术探针，在 CP-02 冻结端口形状前，仅证伪公开 Host handler 的 embedded asset/HOT file 加载与离线资源布局。探针需单独授权、受管所有权及 cleanup，用后移除；UI 观察复用最新 automation driver，不建旧 runner，不写产品 selection/任务、不提供应用内更新旁路，不替代 CP-03 最终 owner+启动保护链的验收。本轮 NOT_RUN，也不因列入计划而取得运行授权。
未来授权需覆盖的修改范围：platform-ports契约及默认实现/所有消费者；kernel/base/terminal-update及测试；两integration composition/selector registry；tools/terminal-skeleton/check-static.mjs 中上述精确 retain 门与直接 red。本计划本身不授予修改权。
步骤：
1. 换六项UpdatePort、删除旧七方法/descriptor及fixture消费者；TR-05类型边界；Android暂时默认unavailable，不先暴露无保护HOT。
2. 建立最终owner固定target/currentTask/recentStatus/failedArtifactIds；串行claim/await后重读，isolated+owner-only。
   仅在上述规范前置闭合后采用resetIntent=retain，并测试只保留update持久字段、其他owner/ephemeral/orphan不扩保留；来源授权失效禁止借新凭证替换target。两integration的module.ts装配具名source provider，生产A无来源则拒绝，run-owned允许工件只进入automation-enabled profile；正式owner不分测试执行分支。
3. task.actionId与target持久化屏障；应用前业务dirty slice flush；typed失败零提交；两屏/冲突/旧action/原始JS下限与UNKNOWN。
4. initialize 在 hydration 后续接；Web 生产构建始终用 unavailable UpdatePort，只有 automation-enabled Web 测试构建显式注入 typed fixture port（与来源 provider 同边界），测试 facts 不冒充真实 APK。包/构建 red 证明 production 夹入 fixture 被拒，缺 native 不能自动切 mock。
5. Web通过automation正式command/selector验证fixed/full-hot/compatibility/install-result/flush/recent；candidate保护协议做focused，Android首次真实触发等待CP-03完整接线。
PROOF：owner/契约owned typecheck与focused；automation Web单case。native纯单元测试可直接port，安装App内不能用run-onlyport旁路作为更新触发。
CP出口：完整owner与Web行为闭合，完整CP三维MATCHED；尚无native加载proof，不宣称具备真实更新能力。

## 4. CP-03 · Android执行者与保护同时交付

RECALL：R03/11/13/14；详设§8.2/8.6/8.7/8.8；公开ExpoPackage/Host接口、nativeLoading、现有reset三族、network配置provider。
允许修改：adapter/android/update、application/base/android装配与loading/PRIMARY确认桥、两App autolink/native签名配置。
步骤：
1. 流式download→digest→central directory/path/symlink/duplicate校验→完整资源树；明确预算/取消资源，配置经compositionprovider。
2. 在任何真实HOT触发前完成native selection/boot/action原子记录与独立T、不可变ReactContexttoken、同Activityreload和三个reset消费者、获准一次恢复/失败文本。
3. Host handler getter 只读同 attempt；embedded assets://+res，HOT/获准文件恢复目标 file root，同 Host reload。selection/previous/candidate 均绑定创建时 applicationId+actual versionCode+embedded publicationId；beginBoot 先比较当前 APK，变化则作废旧资格、显式选新 embedded 并读回 APK_CHANGED_SELECTION_RESET。同 runtime FULL 与外部更高 APK 都不能沿用旧 HOT；缺失 HOT 不默退 assets。最小 FULL 与原始 JS 版本约束由 CP-02 最终 owner 裁决。
4. Session INTENT→create→sessionId/STAGED→COMMITTING→系统 callback/readback 完整窗口；按获批FULL最低API实现并验证：API≥29的isCommitted=false仅证明未commit，还须session合法可续接；API24～28无法判定时保留UNKNOWN直至系统实际回收读回，不设应用TTL、不假定三天自动回收。成功读回确认 session 消失且未安装→ENDED_NOT_INSTALLED→WAITING_USER，下次呈现以新 action/session 邀请同固定工件，不标坏/FAILED、不重 commit 旧 action。仍存不可判定或查询失败保持 UNKNOWN；BUSY_UNKNOWN 有事件读回、占用结束后的成功/等待出口，不清未知资源、不轮询抢占。取消/迟到 callback 精确隔离；不做 N 提醒。
5. F-LOAD/F-INSTALL/F-BOOT第一场景走automation→最终accept command→真实UpdatePort，不能直调port或测试私有装配；类型及纯原生focused可直接调用技术类。
PROOF：实际Gradle/Hermes/ZIP/SDK解析，embedded asset/res 与受保护 HOT file 的 HBC+图片/字体各自离线、真实installer、故障boot/旧token拒绝；非adapter逻辑已有CP-02 Web同case。
CP出口：第一次真实HOT已同时有有效保护；F-LOAD/F-INSTALL/F-BOOT、focused/cleanup及完整CP MATCHED。关键public接缝失败先修本CP，不留到all。

## 5. CP-04 · 兼容发布与完整跨启动反例

RECALL：R13/14及V21～26；详设§8.7；nativeLoading/integration PRIMARY real-ready与failure、持久数据读取。
允许修改：adapter nativeboot/selection、integration-assembly确认桥、application loading必要接缝；发布compat测试和driver原生观察。
步骤：
1. 回读CP-03保护链，扩展中断/迟到/failure的完整反例；新candidate、PRIMARY/hydration、failure-hide规则不另建第二保护机制。
2. identity精确匹配、旧boot迟到、多屏确认幂等；原生错误/期限有界恢复到获准previous；没有目标显示原生失败文本。
3. 新native不加载旧runtimeHOT；确认后普通HTTP/断链不回退；进程退出记录unconfirmed不假称代码BUG。
4. 两 App 真实 fixture 证明同 runtime APK1/HOT JS5 写入→FULL2 首次只能 embedded4 读回→HOT6；另覆盖外部安装更高 APK 后三类旧记录失效、实际 embedded 与复位事实、旧 token 拒绝。HOT 候选确认前写入→上一成功包读取；坏迁移发布不被“声明兼容”掩盖。
5. 原生T及资源预算单场景测量，60s为候选；不为PASS盲延timeout；保留firstfailure/lastknown good。
PROOF：bootguard/rollback/compatibility/interruption focused与真实native；图片/字体离线证据；共享Host单机双屏。
CP出口：F-BOOT/F-COMPAT/预算关闭，完整CP MATCHED；有未解释native失败不推进全体验收。

## 6. CP-05 · 统一automation完整场景

RECALL：全部A范围§11a；automation正式需求/已交付设计/current接口；TR08/TR16/受管资源、日志/cleanup。
允许修改：当前driver fixture/scenario/Android adapter及测试；两App自动化run配置；业务fixture只复用既有共享helper，不复制TDC acceptance。
步骤：
1. 受管静态文件HTTP根只供本run构建/可信工件；source/expectedhash由fixture登记，关闭后cleanup，不用第二业务mockserver。
2. automation连接→selector baseline+动作前订阅→command dispatch/requestId；语义触发使用 driver.transport.request，新 UI 动作使用现有 requests.observeUiAction({server, sessionId, workspace, displayMode, commandName, action})。reload后重新取得当前应用 session，重建固定 sessionId 的 Web/Android UI port、selector 与 request 观察，不复用旧对象；runtimeId/bootToken区别明确。业务 fixture 使用 ensureActivated({shape, deviceId, runId})，Android deviceId 从新会话 runtime.info 的生产 DevicePort 读回，Web 使用本 run 注入。
3. 同runapplicationId/signature/storage稳定；现有androidBuild新run后缀机制只用于第一次安装，不每FULL另起新run。FULL成功后等待当前package actualfacts/新agent，而非等待旧request完成。
4. 系统install真实点击及native失败读取走同driver扩展；安装、来源设置与原生启动失败文本三类非 React 界面按 automation R-10 用同 driver 内 uiautomator 窄例外（失败文本只读），注明来源；不启动旧 ter-*-android/Web/UiAutomator runner，TER React 节点仍走 agent。
5. 两App，每case mobile及单机双屏；非adapter W先AND后且同断言清单；双机更新规则/投影不属A。
6. cleanup：退订/HTTP server/agent/ports/process trees/prepared/installer引用均按identity；别删除active/previous或未知session文件；cleanup失败先修。设备 APK/reverse 清理失败及 setup 中部分创建后的释放失败，必须进入当前受管 runner 的 cleanup 判定，不能仅将 Vitest 非零记为 business FAIL、同时以本机目录/进程清空记 cleanup PASS。复用修复后的现有清理通路与设备身份，不新增恢复服务。
PROOF：driver focused、Web→AND精确case，不运行all做发现；R18相关fresh skill试跑只在已批准automation能力要求内复用，不本批重做全部agent验收。
CP出口：整套场景源码与focused/必要动态完成、完整CP MATCHED；未受影响已MATCHED内容不再重做。

## 7. CP-06 · 批次收尾和整体验收

先完成本CP的必要源码/脚本收尾、focused、入口清理与文档同步，再做本CP退出三维对账MATCHED及全批6b MATCHED。
随后执行批次整体场景回归；实际修复按受影响CP/6b差量复查，不循环要求所有无关CP重对。
交付前13c逐代码设计对账MATCHED；fresh独立REVIEW_TARGET=IMPLEMENTATION整批审查；NO-GO确认部分最小修复后fresh复评，不受DESIGN两轮上限。
最终给Dexter/Claude提供每条§11a的当前字节结果及firstfailure/lastknown good，分清Web/native/business/cleanup；计划不提前填PASS。
默认scripts/verify应当前字节完整PASS，validate-only不能替代；若中断报告NO_VERDICT且不包装成通过。

## 8. 未来命令与执行面

打包拟接口：两application的 `yarn package:install`、`yarn package:full --install <owned-apk>`、`yarn package:hot --minimum-full <owned-full-manifest>`；脚本尚不存在。
automation拟接口：`scripts/test/terminal-automation.mjs --phase update --case update.fixed --sample console --platform web --shape mobile`；case换§11a之一，Android再`--platform android --device-serial <本run登记serial>`，双屏`--shape dual`。当前CLI无update分支，CP-01实现并self-test后才是可运行命令。
真实执行用仓内包管理器/解释器和script shebang；具体现有runner语法重新读源码，发现参数不符修本计划/adapter，不发明旁路。
不涉及adapter的判据使用W同一case；native安装/loader/断进程不写“Web已证明”。系统用户动作是真实点击，而正式owner command是能力trigger；两类不混用。

## 9. 动态准入、fixture和cleanup

所有首次动态前：当前CP静态三维准入、fixture/actions/assertions审查、资源所有权预算预检；focused后阶段退出独立对账。
整体动态前：全CP MATCHED、全批6b、适用UI/testId、manifest资源预检；reset/seed/BrowserL2均N/A，不能对它们作空分母通过。
本地case不需DEV；业务数据恢复case复用当前automation既有DEVfixture（term-front/term-handheld、REQUIRE_INACTIVE、manifestdevice身份才cancel），须相应执行授权；不隐式reset/seed。
resources：本机PID+OSstarttoken，远端若有DEV则host/boot/ticks；只停本run拥有资源。长运行manifest+heartbeat、脱敏日志、business与cleanup分开。
本批A不新增Testcontainers需求；若未来选用已授权backendacceptance则遵守既有DEV stop/test/restart联动，不能自行扩张本地Java/PGtunnel。
未知installer是业务UNKNOWN，不允许通过清文件或杀系统进程拿cleanupPASS；可释放本run服务连接但保留安装仍需内容，明确native资源仍owned/awaiting并阻止新冲突run。

## 10. 停机与失败处置

首次失败保留并读日志/owning source，修同根路径，再同casefocused；同failureCategory第二次冻结该族推进。
只在确有硬约束或需改变产品/授权时交Dexter；不因脚本失败结束整个已授权实施批次。
没有手工失败工件重试、恢复框架、延timeout掩盖、旧runner或跳过nativeproof的捷径。

## 11. 交付清单和当前状态

未来交付：两App真实三产物、生产源码/生成输入输出、阶段/6b/13c、逐case proof、source binding、完整verify、freshimplementationreview、business/cleanup与外部handoff。
本次实际完成只有设计文档与静态来源研究；上述所有实施/生成/编译/测试/verify/DEV/ExpoWeb/Android/cleanup均NOT_RUN。
UI_CONTENT=ACCEPTED；DEXTER_WIREFRAME_REVIEW=ACCEPTED（2026-10-06，三个面内容均已确认）。OPEN列表见详设§12，最低FULL API仍待Dexter选择；无实施授权，设备行为仍NOT_RUN。外部差量复核的历史结论为GO_WITH_UNVERIFIED_UI、0M/0S/3N，本轮仅补三条文档注记与界面确认，不重开内部cycle、不另要求完整外部复核。
