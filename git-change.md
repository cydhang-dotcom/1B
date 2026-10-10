# 变更记录

> 下次发布后清空此文件

## [开发中]

### 分享人 shareUserUuid：对齐 caa 的请求信封，并修掉 copreg 内部丢分享人的两处
- 调整 用户要求：「查看同目录的 caa 项目，把 shareUserUuid 的逻辑搬到 copreg.html 中」（做前已确认范围：
  修洞 + 请求带上分享人；`modify-proposal` 是否带**等后端确认**）
- 说明 caa 的 shareUserUuid 逻辑是三件事：① 从 URL 读分享人；② 查分享人的专属客服码（拿不到回落通用码）；
  ③ 生成方案请求把它塞进 `phoneNumber` 上送。核对后：①② 本项目**早就有**（`utils/customerServiceQr.ts` +
  `hooks/useCustomerServiceQr.ts`，用在第 3 步与第 5 步弹窗，有 20 项自检与真机脚本），
  缺的是 ③，以及 copreg 自己的地址栏/新标签页机制会把分享人弄丢（caa 没有这些机制，所以当初没搬）
- 新增 `src/utils/shareUserUuid.ts`（纯逻辑）：参数名常量、`readShareUserUuid(search)`、
  `appendShareUserUuid(href, uuid)`（从 `hooks/useShareUserUuid.ts` 搬出来，hook 再转出，
  Hero/Navbar/CTA 的 import 一行没改）；**只认 URL、不落盘**（落盘会让先点开 A 链接、再点开 B 链接的串味）
- 调整 `src/hooks/useShareUserUuid.ts` 用纯逻辑读（顺手补 SSR 判空，check:entry 下不再裸读 window）
- 修复 **P1 新标签页丢分享人**：`fillDetailsOpenUrl(origin, pathname, shareUserUuid?)` 复用
  `appendShareUserUuid` 把分享人拼进深链；`AgreementAndPaymentStep` 传 `useShareUserUuid()`。
  真机复现过：修前打开地址是 `copreg.html?open=fill-details`（没有分享人）→ 新标签页第 5 步的
  「微信扫码咨询」只能显示通用码，分享人的客户扫到的是公共码
- 修复 **P2 抹意图参数时把整条查询串一起抹掉**：新增 `searchAfterOpenIntentUsed(search)`
  （白名单：只留 `shareUserUuid`），`App.tsx` 抹 `open` 时改用它 —— 以前是 `${pathname}${hash}`，
  分享人跟着没了，同标签页刷新一次专属码就退化；顺带在写步骤 hash 那两处补注释说明
  「纯 fragment 会保留 pathname 与查询串，别改成 `${pathname}${hash}`」
- 调整 **P3 生成方案请求带上分享人**（对齐 caa）：`PlanGenerateRequest.phoneNumber` 变成
  `PhoneVerification & { shareUserUuid: string }`（**空串而不是省略字段**），
  `generatePlanReport(survey, phoneNumber, shareUserUuid)` 组装；App 的 `handleSurveySubmit` 传当前分享人；
  `modify-proposal` **不带**（归属在建单那一次就定了），已在代码注释与 `docs/copreg-plan-api.md`
  写成「等后端确认字段位置再补」
- 更新 `docs/copreg-steps.md`：深链那节改成 `?open=fill-details[&shareUserUuid=…]`，第 3 条约束改为
  「只抹 `open`，分享人留下」，补一段「分享人为什么要跟着深链走」与各层自检清单；「微信扫码咨询」那节
  补分享人的口径与存放位置
- 更新 `docs/copreg-plan-api.md`：2.1 的请求示例与字段表加 `phoneNumber.shareUserUuid`（必给、可空串），
  2b 节写明 `modify-proposal` 不带它的理由，第四节结论同步
- 新增 `scripts/check-share-user-uuid.ts`（**26 项**）：纯逻辑（读/拼/转义/往返一致、七种「没有分享人」）
  + 三个接线点的源码级断言（App 交给 generatePlanReport、信封形状是必给字段、深链带上、modify 不带）
- 更新 `scripts/check-step-route.ts`（54 → **65 项**）：深链带分享人、没有分享人时地址一字不差、
  只抹 `open`、白名单不留别的参数、空白分享人当没有、转义；`ok()` 补第三个参数用于打印失败详情
- 更新 `.mcp-work/verify-wecom-qr.mjs`（2 幕 → **3 幕**）：新增「支付成功页**真手势**点按钮 → 新标签页
  地址栏留着 `?shareUserUuid=SHARE-1`、弹窗拿到专属码 `doc/uuid/EWM-9/get`」；桩抽成共用 `STUB`
- 更新 `.mcp-work/verify-diagnose-report.mjs`（24 → **25 项**）与 `.page.js`：带着 `?shareUserUuid=SHARE-7`
  走完问卷 → 手机验证，断言**真实请求体**里 `phoneNumber.shareUserUuid === 'SHARE-7'`
- 回归：`npm run lint`、`npx tsx scripts/check-share-user-uuid.ts`（26 项）、
  `npx tsx scripts/check-step-route.ts`（65 项）、`npm run check:entry`（78 项）、
  `.mcp-work/verify-wecom-qr.mjs`（3 幕全过）、`.mcp-work/verify-diagnose-report.mjs`（25 项）、
  `.mcp-work/verify-paid-cta.mjs`（12 项，确认「不带分享人」那条老口径没被改坏）

### 第 3 步 · 「服务内容与交付清单」弹框删掉底部的包邮文案
- 调整 用户要求：`#paid` 的「服务内容与交付清单」弹框里，删除最底部那句「办结物料顺丰安全包邮寄达」
- 调整 `AgreementAndPaymentStep` 弹框里的「服务保障承诺」块：整句从
  「所选套餐与增值服务已完全缴清，绝无任何二次巧立名目加价**；办结物料顺丰安全包邮寄达**。」
  改成「所选套餐与增值服务已完全缴清，绝无任何二次巧立名目加价。」（只删包邮那半句，
  承诺本身保留；分号也跟着收成句号），原地补了注释
- 更新 `.mcp-work/shot-paid-checklist.mjs`（5 → **8 项**，真机 + 截图）：点开「服务内容详情」，
  断言弹框文案里**不再出现**「包邮寄达 / 顺丰安全」、「服务保障承诺」那句仍在；截图前把弹框滚到底，
  出图 `.mcp-work/paid-service-content.png`（已看图核对：底部只剩服务保障承诺那一行）
- 回归：`npm run lint`、`.mcp-work/shot-paid-checklist.mjs`（8 项 + 两张图已看）

### 第 3 步 · 「服务进度状态与办理清单」删掉 2~7 项
- 调整 用户要求：「#paid 中『服务进度状态与办理清单』删除 2~7 步，没有这些功能」——
  原来那张清单里排着 7 项（1 申报资料填报与合规初审 / 2 市监行政审批送审与执照领办 / 3 公安特行备案
  防伪芯片印章刻制 / 4 合作商业银行对公账户开户预约 / 5 电子税务局税种核定 / 6 全年记账报税托管 /
  7 单位社保与公积金开户），后面 6 项功能目前都**没有**，列在这里等于承诺做不到的事
- 调整 `AgreementAndPaymentStep` 的 `checklistItems`：**只留第 1 项**，其余 6 项整段删掉；
  渲染逻辑没动（这一项本来就有两态：待填报时是「当前进行阶段 + 申报资料填报」按钮，
  提交后是「已完成填报 · 专员初审中 + 查看/修改申报资料」），原地补了注释说明为什么只留一项
- 说明 套餐/报价里的「公安备案防伪芯片印章 5 枚」「全年 12 个月记账报税托管」这些**描述没动**
  —— 那是套餐包含什么的说明，不是这张清单里的「办理进度」
- 新增 `.mcp-work/shot-paid-checklist.mjs`（**5 项**，真机 + 截图）：桩查单回「已支付」→ 断言清单里
  **只剩 1 项**、留下的正是「企业注册申报资料在线填报与合规初审」、2~7 项的字样都不再出现、
  「申报资料填报」按钮还在；并出图 `.mcp-work/paid-checklist.png`（已看图核对）
- 更新 `docs/copreg-registration-fields.md` 的联动表那一行（写明只列这一项与原因）
- 回归：`npm run lint`、`.mcp-work/shot-paid-checklist.mjs`（5 项 + 截图已看）

### 第 1 步 · 手机号预填：新主体借「别的已生成方案的主体」用过的号
- 调整 用户要求：「#survey 手机号如果有其他主体已生成过方案，就带入其他主体的手机号，方便客户不用再次输入」
- 新增 `applications.suggestedContactPhone(state, activeAppId, ownPhone)`（纯逻辑）：**本主体验过的号优先**；
  本主体还没有号时，借**别的已生成过方案的主体**摘要里的号（多个候选取 `updatedAt` 最新的那个）。
  「生成过方案」的判据就用「摘要里有号」—— 手机号只在**生成方案 / 查单确认已支付**时写进
  `order.contactPhone`，有号即说明那个主体走过一次手机验证，不必再判断它的步骤或单号。
  **只读不写**：预填的号不会落到这个主体上，真正写回仍在 `runPlanSubmit`（用他验证过的那个号）
- 调整 `App.tsx`：问卷那一步的 `contactPhone` 从 `order.contactPhone` 换成
  `suggestedContactPhone(apps, activeApp.id, order.contactPhone)`（只影响手机验证弹框的预填）
- 更新 `scripts/check-applications.ts`（74 → **81 项**）：+7 条断言（自己没号→借别人的 / 多候选取最近更新的 /
  自己的号优先 / 只写空格也算没号 / 不拿自己的号当别人的 / 谁都没号→空串 / 新增主体后预填就是老主体的号）
- 新增 `.mcp-work/verify-phone-prefill.mjs`（**8 项**，真机 · 三段）：
  ① 新空白主体 → 手机验证框预填的是**别的主体**用过的号（候选两个时取最近更新的那个）、验证码框仍是空的；
  ② 本主体自己有过号（例如生成方案后又「重置问卷」）→ 预填**自己的**，不借别人的；
  ③ **真链路**：第一个主体走完「填问卷 → 获取验证码 → 验证并生成方案」（短信 / 诊断 / 腾讯行为验证码都打桩）
  → 断言手机号写进了主体摘要 → 再从顶栏「新增企业注册」开一个空白主体 → 它的手机框**自动带上第一个主体的号**
- 更新 `docs/copreg-multi-app.md`：业务规则表里「手机号不复用」改成「手机号预填、但各主体各存各的」，
  实现要点补 `suggestedContactPhone` 的判据与「只读不写」
- 回归：`npm run lint`、`npx tsx scripts/check-applications.ts`（81 项）、
  `.mcp-work/verify-phone-prefill.mjs`（8 项，含真链路）

### 第 2 步 · 「初创期合规避坑建议」的内容合并到一张卡片里
- 调整 用户要求：方案页 01 区块的「初创期合规避坑建议（针对性提示）」下面原来是**每条提示一张卡**
  竖排（避坑指南 + 行业合规提示一共好几张），条目一多就像一串各自独立的板块；合并成**一张卡**，
  卡内逐条列出（圆点小标题 + 说明，条目间距 `space-y-3`），标题与文案都没动
- 调整 `src/copreg/components/PlanReportView.tsx`：`pitfalls` 的容器从 `flex flex-col gap-2.5`
  改成单张卡（`p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-3`，
  圆角/边框/底色沿用原来每张卡的那套），保留外层 `h3` 小标题；顶部段式注释同步
- 说明 「存为 PDF / 打印」那条路径（`proposalReportDoc.ts` 第四部分）本来就是**一个框里逐条列**，
  这次页面版式与导出件口径终于一致了
- 更新 `docs/copreg-steps.md`（第 2 步版式那段）：把「初创期合规避坑竖排卡片」改成「合并在一张卡里」
- 回归：`npm run lint` 跑过；`.mcp-work/verify-diagnose-report.mjs`（只断言这段文案在不在，未改口径）
  与 `shot-proposal-page.mjs` 未跑（本层未跑，等发版前整套回归）

### 第 1 步 · 「AI 财税与合规引擎正在推演」弹框的四段文案对齐第 2 步的四张建议卡
- 调整 用户要求：生成方案弹框里的四段推演文案改成**符合第 2 步那 4 个建议**的说法，
  并且每段标题要**带动词**（像原来「生成 / 解析」那样的动作词）。原四段是从参考实现逐字搬的
  （业务分类与行业经营范围 / 股权治理与新公司法实缴 / 经营场所与税务身份 / 生成报告与服务清单），
  其中第 1、4 段在方案页上**没有对应物**，弹框承诺了下面看不到的东西
- 调整 `src/copreg/components/PlanGeneratingModal.tsx` 的 `GENERATION_STEPS`：标题改成
  **动词前缀 + 方案页 01 区块四张「核心决策」建议卡的标题**（动词按参考实现那种口气：
  推演 / 测算 / 匹配 / 核验，动词后面那半截与卡片标题逐字一致）—— 推演组织形式与股权架构 /
  测算注册资本与出资规划 / 匹配财税身份与发票统筹 / 核验经营场所与住所合规（即 `report.coreDecisions`
  的四个维度，与 `PlanReportView` / `proposalReportDoc` 第二部分同一口径），描述改成那一档在方案页上
  给出的结论口径（股东构成与表决权、认缴额与 5 年实缴、身份比对与开票、地址类型与住所要件）；
  组件顶部注释记下这条**有意偏离参考实现**的理由；动画节奏（每 10 秒一段 + 停在 95%）与版式未动
- 更新 `.mcp-work/verify-generating-modal.page.js`：`genStep1` / `genStep4` 两条探针换成新文案
  （推演组织形式与股权架构 / 核验经营场所与住所合规），脚本没改判定口径
- 更新 `docs/copreg-plan-api.md`（生成需求方案一节的弹框说明）：补上「四段文案对应四张建议卡、
  不承诺方案页看不到的东西」这条口径
- 回归：`npm run lint` 跑过；`verify-generating-modal.mjs` 未跑（本层未跑，等发版前整套回归）
