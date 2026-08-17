# 实施工单 · Agent Enablement 第 1 批

- 日期:2026-08-17 · 作者:Claude
- 状态:待 Codex 实施。**只做本文列出的五项,范围外看到也不动。**
- 来源:`doc/plans/platform/2026-08-17-v2s-agent-enablement-implementation-input-claude.md`
  经五轮独立盲审后,**只取其中已被独立验证可执行的部分**。

---

## 0 · 先说价值边界

⚠️ **第四、五项(修两道门)对「提高实施 agent 一次做对的概率」贡献接近零。**
那两道门**未接进 `verify`**,实施者日常跑 `--validate-only` 只跑 static 档,**碰不到它们**。
修完仍然未接线。做它们只是清噪音,不要以为做完门这条线就解决了。

**真正有价值的是第一到第三项。**

⚠️ **不接线,门这条线的价值就一直不会兑现** —— 13 道红全在 `verify` 之外。
接线是价值兑现的那一步,但它当前不可执行(档位分配未定、基线未测、marker 有坑),不在本批。

---

## 1 · 详设新增 `RECALL` 字段(⚠️ 本批**无动作**)

⚠️ **本项在本批没有可执行动作,原因如下,不要制造一个出来。**

工单原写「只给 `CP-INV-7` 补 RECALL」。**那是错的** ——
我用 grep 找「未完成的 CP」时读到它标题上的 `[盘点已产出 · 口径需重做]`,
而**那个标记是我在他做 §8 数据流重判之前写的、事后从未更新**。
§8 已完成 26 项逐条判定、结论 0 项,我评审时也确认过。
⇒ **CP-INV-7 实际已完成**,给它补 RECALL 违反本项自己的 FORBID(已完成的不补)。

⇒ **本项在本批只是一条面向未来的规矩,没有目标可做。**
详设状态由 Claude 同步(不在你的范围)。

**规矩本身**:此后新写或修订的实施详设,每个**未完成** CP 新增一个字段:

```text
RECALL    进入前重开:<该项对应的原始业务条目 / 裁决 / 记忆条目,逐条给路径>
          本项失败条件:「出现 <X> 即未做到」
```

失败条件写不出来 ⇒ 该项详设不合格,停下来问,不要凭理解补一个。

**执行纪律正本**:`doc/platform/implementation-task-template.md`。
派活时从正本逐字复制,不得改写。⛔ 本文不再放副本。

## 2 · `PLATFORM-BLUEPRINT.md` 事实纠正

```text
RECALL    进入前重开:
          · PLATFORM-BLUEPRINT.md 的 `## Backend acceptance 设计红线` 整节
          · AGENTS.md 中对应的 backend-acceptance 段落(它是对的,用来对照)
          · doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md
          本项失败条件:改完后 `grep -F 'getPublicInvitationView' PLATFORM-BLUEPRINT.md` 仍有命中

FILE      PLATFORM-BLUEPRINT.md · 小节 `## Backend acceptance 设计红线`
LOCATE    锚点 `getPublicInvitationView` · 锚点 `197 个 provider 与 scenario registry`
BEFORE    该节三段。⚠️ **它不是均匀过时的**:
            第 1 段「当前只验证 getPublicInvitationView…」—— 过时
            第 2 段前半「197 个 provider 与 scenario registry 是未来待办目录,不是实现或覆盖。」—— 过时
            第 2 段后半「新增 operation 时只复制…不能以 response.ok…代替业务真值。」—— **仍然有效**
            第 3 段「PERFORMANCE/CLEANUP verdict…DB 调用数只用于人工观察,不设预算门」—— **仍然有效**
AFTER     删除第 1 段整段、第 2 段前半那一句;补一句当前事实:
            「后台动态验收当前实现并运行 28 条真实场景,覆盖 IAM、ORG、商业合同、asset 与 Catalog;
              原 196 个 provider 壳与 scenario registry 已下线删除。」
ACTION    删除 + 新增
FORBID    ⛔⛔ **不得删除第 2 段后半与第 3 段** —— 「不得以 response.ok / 路径字符串 /
             『不抛异常』代替业务真值」是防假绿验收的核心判据,「DB 调用数不设预算门」同理
          ⛔ 不得自行扩大删除范围到本节之外
          ⛔ 若你读下来发现本节还有别的过时内容,**报告,不要自己删**
INVARIANT 第 2 段后半与第 3 段逐字不变
PROOF     `grep -F 'getPublicInvitationView' PLATFORM-BLUEPRINT.md` 归零
          `grep -F '197 个 provider' PLATFORM-BLUEPRINT.md` 归零
          `grep -F 'response.ok' PLATFORM-BLUEPRINT.md` **仍有命中**(证明没删过头)
          `grep -F '不设预算门' PLATFORM-BLUEPRINT.md` **仍有命中**(同上)
DEPENDS   无
```

**真值取值命令**(不要用文档里的快照):

```bash
grep -rho '@AcceptanceScenario' apps/backend/catering-business-server/src/test/java --include='*AcceptanceScenarios.java' | wc -l
```

**Dexter 裁定**:原话是「随整段退役删掉」。我读完该节后**收窄了范围**,
理由是它含两条仍在生效的规则。若他坚持整节删,以他为准。

---

## 3 · `CLAUDE.md` 事实纠正

```text
RECALL    进入前重开:
          · CLAUDE.md 中含「Catalog group」的那一句原文
          · 上一项(第 2 项)的真值取值命令与结果
          本项失败条件:改完后 `grep -F '18 条' CLAUDE.md` 仍有命中

FILE      CLAUDE.md
LOCATE    锚点 `Catalog group 的 8 条场景`
BEFORE    「当前已实现并运行 18 条 IAM、ORG、商业合同和 asset 真实场景;
            Catalog group 的 8 条场景作为 P3-1 同批实现,完成后总数为 26。」
AFTER     「当前已实现并运行 28 条真实场景,覆盖 IAM、ORG、商业合同、asset 与 Catalog。」
ACTION    替换
FORBID    ⛔⛔ **不得只换数字** —— 这一句的错不在数字,在于它说「Catalog 尚待实现」,
             而 Catalog 实测**已有 10 条在跑**。8→10、26→28 之后仍然是错的模型。
             **必须重写句子。**
          ⛔ 不得动同段里「总数保持在 80 条以内」那句 —— **那是上限,不是场景数**
INVARIANT 「80 条以内」逐字不变
PROOF     `grep -F '18 条' CLAUDE.md` 归零
          `grep -F '80 条以内' CLAUDE.md` **仍有命中**
DEPENDS   第 2 项(共用同一个真值)
```

---

## 4 · `capability-invariants` 变绿(**只给不变量,形态你定**)

⚠️ **本项已因「规定形态」往返三次,现改为不变量式。**
前两版规定了「必须用四条嵌套类 import」「必须用外层类限定名」——
两次都撞 `backendJavaUtf8LineLimit`(120 字节),而设计方无法逐行预演行长。
**能跑门的人是你,形态由你定。**

```text
RECALL    进入前重开:
          · tools/capability-invariants/cli.mjs 第 308–321 行(javaImports 与 resolveJavaType)
          · apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java
          · build.gradle.kts 里 backendJavaUtf8LineLimit 的判据

FILE      apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java

不变量(必须**同时**满足,缺一不算完成):
  1. `bash scripts/check/capability-invariants`   rc=0
  2. `gradle backendJavaUtf8LineLimit`            通过
  3. `gradle spotlessCheck`                       通过
  4. `gradle compileJava`                         通过
  5. `@ExceptionHandler` 映射集合**逐字不变**;业务行为不变

FORBID    ⛔ 不改门(解析器不动、97 冻结不动)
          ⛔ 不改任何业务逻辑
          ⛔ 不为了让某一道门绿而破坏另一道

形态      **由你定。** 满足上面五条即可,不必回来问。
          在报告里登记一行:「我选了 X 而不是 Y,因为 Z」。

PROOF     五条不变量的真实运行输出,逐条贴出。
```

**已知的可行路径(供参考,不是规定)**:删掉四条 `import static`,
把引用改为外层类限定名(外层类已有普通 import,解析器的 `imports.get(segments[0])` 命中);
若某一行仍超 120 字节,该文件已有 `spotless:off`,可按 Java 合法换行排版。

---

## 5 · `protable-compact` —— 三个动作(Dexter 裁定 B)

```text
RECALL    进入前重开:
          · doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md 的「适用分母」一节
          · scripts/check/protable-compact.mjs 第 26–31 行(正则)与第 71 行(判据)
          · apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx
            门点名的那个实例(**先打开看,它其实已经有 size**)
          本项失败条件:`node scripts/check/protable-compact.mjs` 退出码非零

⚠️ **工单前一版对本项的判断是错的,已整体重写。**
前一版写「该实例缺 size="small",补上」——**它本来就有**(在 `rowKey` 之后)。
我是从门的失败输出读出「缺」这个事实的,**没打开文件**。
⛔ **绝不许给已有该属性的实例再加一个。**

真实病因有两条,都在门自己身上:
① 正则 `/^<ProTable(?:<[^>\r\n]+>)?\s+size="small"(?=\s|>)/` 要求
   `size` 必须是**紧跟标签的第一个属性**;该实例把 `rowKey` 写在前面 ⇒ **假阳性**
② 第 71 行 `findings.length !== 13` 是**冻结计数**,实际已 15 ⇒ 随正常新增而红

FILE      A:doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md
          B:scripts/check/protable-compact.mjs(正则)
          C:scripts/check/protable-compact.mjs(判据)
LOCATE    A:锚点 `当前分母为 13 个实例`
          B:锚点 `size="small"(?=\s|>)`
          C:锚点 `findings.length !== 13`
BEFORE    A:「本规范覆盖两个后台所有生产 `.tsx` 中实际渲染的 ProTable:当前分母为 13 个实例
             (platform-admin 8、operations-admin 5)」
          B:正则要求 size 为首个属性
          C:`if (findings.length !== 13 || missing.length > 0)`
AFTER     A:删掉固定分母那句,改为「本规范覆盖两个后台所有生产 `.tsx` 中实际渲染的每一个 ProTable。
             ⛔ 不冻结实例总数 —— 冻结计数会随合法新增而变红,传达的信息是错的
             (让人以为密度不对,实际只是数字过期)。」
          B:改为**在开标签内任意位置**匹配 `size="small"`,不再要求它排第一
          C:改为 `if (missing.length > 0)`,砍掉计数条件
ACTION    A 替换 · B 替换 · C 删除
FORBID    ⛔⛔ **不得给任何已有 `size="small"` 的实例再加一个**
          ⛔ **不得连带砍掉 `missing.length > 0`** —— 那是这道门真正守的不变量
          ⛔ 不得改任何 .tsx 生产文件 —— 本项**一行前端代码都不动**
          ⛔ 动作 A 必须先做 —— 决策是门的依据,先改门后改决策等于门无依据
INVARIANT 「每个 ProTable 实例必须显式声明 size="small"」这条断言保留;
          `--self-test` 的红变异仍必须失败
PROOF     1. `node scripts/check/protable-compact.mjs` 退出码为 0,贴真实输出
          2. `node scripts/check/protable-compact.mjs --self-test` 仍 PASS
             (证明砍掉计数没把红夹具一起砍掉)
          3. `grep -c 'size="small"' <该 tsx 文件>` 与改动前**相同**
             (证明没有加重复属性)
          4. `grep -F '13 个实例' doc/decisions/2026-08-05-v2s-dual-admin-protable-compact-standard.md` 归零
DEPENDS   无
```

**Dexter 2026-08-17 裁定:方案 B**(取消数量冻结,只留每实例断言)。
理由:冻结计数会随正常工作变红,同步 13→15 只是把同一个问题推到下一次。

## 6 · 完成检查表(逐条打勾再报告)

- [ ] **第 1 项本批无动作** —— 没有给任何 CP 补 RECALL(CP-INV-7 已完成)
- [ ] 第 2 项:`getPublicInvitationView` 与 `197 个 provider` 归零,
      而 `response.ok` 与 `不设预算门` **仍在**
- [ ] 第 3 项:`18 条` 归零,而 `80 条以内` **仍在**
- [ ] 第 4 项:`bash scripts/check/capability-invariants` rc=0,输出已贴
- [ ] 第 5 项:决策里 `13 个实例` 归零 · 门 rc=0 · `--self-test` 仍 PASS ·
      **该 tsx 文件的 `size="small"` 计数与改动前相同**(没加重复属性)
- [ ] **一行前端生产代码都没改**
- [ ] 每条 PROOF 贴的是**真实运行输出**,不是「预期会绿」
- [ ] 报告里凡出现「全仓 / 唯一 / 零 / 只有」,都先跑过搜索并写了条数
- [ ] 证据档位已声明,且**没有把静态门说成业务通过**
- [ ] 第 4 项的「改门 vs 改代码」取舍:若倾向改门,**已停下来说**
- [ ] 做的每一件事都在工单内,**没有做工单之外的任何事**

## 7 · 明确不在本批

建 `scripts/check/all` · `rp12-final-state`(真分母 115–212 处、10–17 个文件,
且 `execution-context` 模块**零 `project(` 依赖**、根本 import 不到常量类,不是「改两行」的事)·
删 `gate-0` · `provider-free-context`(它的「慢」和「红」是两件不同的事,本批都不碰)·
把任何门接进 `verify` · 入口文件的结构瘦身 · 读完其余 8 个 skill 正文 ·
CP-INV-1/2/4/5 · D-3 · 后端→脚本跨界盘点

## 8 · 授权边界

本批只授权:第 1 项的制度变更 · 第 2–3 项的两处入口文件修改 · 第 4–5 项的两道门修复。

**不授权**:其他任何门 · 接线 · 建新脚本 · 改 `verify.mjs` ·
`rp12` / `gate-0` / `provider-free-context` · 下一个 Roadmap step ·
DEV / reset / seed / 浏览器 L2 / UAT。
