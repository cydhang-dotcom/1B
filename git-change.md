# 变更记录

> 下次发布后清空此文件

## [开发中]

### 分享人 shareUserUuid：建单上报 + 归属落进这一单（客服码只认单，不认地址栏）
- 调整 用户要求：「查看同目录的 caa 项目，把 shareUserUuid 的逻辑搬到 copreg.html 中」；
  随后用户指出「查看专属二维码的逻辑不对，应该建单后把 shareUserUuid 存到 plan_record 再本地取，
  不然可能联系上不对的客服」—— 本次按后者实现（**归属跟单走**），同一件事的最终口径如下
- 说明 caa 的 shareUserUuid 逻辑是三件事：① 从 URL 读分享人；② 查分享人的专属客服码（拿不到回落通用码）；
  ③ 生成方案请求把它塞进 `phoneNumber` 上送。核对后：本项目 ② 早就有（`utils/customerServiceQr.ts` +
  `hooks/useCustomerServiceQr.ts`），缺 ③；而**② 的分享人来源原来是错的** —— 它读当前地址栏，
  老客户点开别人的分享链接就会显示**别人的**专属码，客户扫过去直接联系错顾问
- 新增 `src/utils/shareUserUuid.ts`（纯逻辑）：参数名常量、`readShareUserUuid(search)`、
  `appendShareUserUuid(href, uuid)`（从 `hooks/useShareUserUuid.ts` 搬出来，hook 再转出，
  Hero/Navbar/CTA 的 import 一行没改）；调整 `useShareUserUuid` 用纯逻辑读（顺手补 SSR 判空）
- 调整 **生成方案请求带上分享人**（对齐 caa 的信封）：`PlanGenerateRequest.phoneNumber` 变成
  `PhoneVerification & { shareUserUuid: string }`（**空串而不是省略字段**），
  `generatePlanReport(survey, phoneNumber, shareUserUuid)` 组装；App 的 `handleSurveySubmit` 传链接上的分享人；
  `modify-proposal` **不带**（归属在建单那一次就定了），已在代码注释与 `docs/copreg-plan-api.md`
  写成「等后端确认字段位置再补」
- 新增 **归属落进这一单**：`PlanRecord` 增加 `shareUserUuid`（空串 = 没有），
  `runPlanSubmit` 接第四个参数 `attributedShareUserUuid` —— 建单用链接上的那个、**改方案沿用单上原有的**
  （不改成地址栏上那个）；`parsePlanRecord` 把缺失 / 非字符串 / 空白一律收成空串
  （老单没存过 → 显示通用码，不拿地址栏上别人去猜）。`App` 把 `planRecord.shareUserUuid` 下发给
  第 3 步与第 5 步
- 修复 **客服码改认单、不认地址栏**：`useCustomerServiceQr(enabled, shareUserUuid)` 不再自己读 URL，
  由调用方传 —— copreg 两处传**这一单的**（props），落地页 TrustModal 没有单，仍传这次进站链接上的
  （与它提交表单带的是同一个值）。老单（这次改动之前建的、凭据里没这个字段）显示通用兜底码
- 调整 链接上下文（上一版为「让地址栏撑住分享人」加的两处，口径改为「供以后再建单上报」）：
  `fillDetailsOpenUrl(origin, pathname, shareUserUuid?)` 把链接上的分享人带进新标签页、
  `searchAfterOpenIntentUsed` 只抹 `open` 而留下分享人；顺带在写步骤 hash 那两处补注释说明
  「纯 fragment 会保留 pathname 与查询串，别改成 `${pathname}${hash}`」
- 更新 `docs/copreg-steps.md`：「微信扫码咨询」那节改成**两个真源**的表格（URL 管建单上报、
  `plan_record` 管此后显示 + 老单空串就走兜底图不许猜）；深链那节写明带过去的是链接上下文、
  不是客服码依据；两节的自检清单同步
- 更新 `docs/copreg-plan-api.md`：2.1 的请求示例与字段表加 `phoneNumber.shareUserUuid`（必给、可空串）
  并说明「这次上报的分享人同时落进这一单的本地凭据」；2b 节写明 `modify-proposal` 不带它、也不覆盖本地那份
- 新增 `scripts/check-share-user-uuid.ts`（**37 项**）：纯逻辑（读/拼/转义/往返一致、七种「没有分享人」）
  + 接线点源码级断言（建单上报、**写进 plan_record**、改方案沿用原值、读档收口空串、
  **客服码 hook 不读地址栏**、两处 copreg 弹窗用 props 的根本、落地页仍用 URL、深链带上、modify 不带）
- 更新 `scripts/check-step-route.ts`（54 → **65 项**）：深链带分享人、没有分享人时地址一字不差、
  只抹 `open`、白名单不留别的参数、空白分享人当没有、转义；`ok()` 补第三个参数用于打印失败详情
- 更新 `.mcp-work/verify-wecom-qr.mjs`（2 幕 → **4 幕**，且每幕一个独立 browser context ——
  共享 context 时 localStorage 串场会让「老单」那一幕假过）：**记录优先于地址栏**（单上是 OWNER-1、
  地址栏是别人的 OTHER-9 → 只查 OWNER-1）、**老单没有分享人 + 地址栏有别人 → 一个请求都不发、
  显示兜底图**、地址栏什么都没有也照样拿专属码、支付成功页**真手势**点按钮 → 新标签页里仍是单上那个人的码
- 更新 `.mcp-work/verify-diagnose-report.mjs`（25 → **26 项**）与 `.page.js`：带着 `?shareUserUuid=SHARE-7`
  走完问卷 → 手机验证，既断言**真实请求体**里 `phoneNumber.shareUserUuid === 'SHARE-7'`，
  也断言**这张单的凭据里存下了 SHARE-7**
- 回归：`npm run lint`、`npx tsx scripts/check-share-user-uuid.ts`（37 项）、
  `npx tsx scripts/check-step-route.ts`（65 项）、`npx tsx scripts/check-customer-service-qr.ts`（20 项）、
  `npx tsx scripts/check-plan-archive.ts`（38 项）、`npm run check:entry`（78 项）、
  `.mcp-work/verify-wecom-qr.mjs`（4 幕全过）、`.mcp-work/verify-diagnose-report.mjs`（26 项）、
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
