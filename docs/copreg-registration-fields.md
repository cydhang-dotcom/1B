# copreg 支付前字段 与 registration 字段对照

本文整理两个入口各自采集哪些字段、字段长什么样、以及两边怎么对齐。

| | copreg.html | registration.html |
|---|---|---|
| 定位 | 售前：问卷 → 方案报价 → 支付 | 售中：企业设立资料填报 |
| 采集范围 | 需求意向、报价选择、付款人手机号 | 拟注册企业的全部法定登记信息 |
| 代码入口 | `src/copreg/`（`App.tsx` 持有全部状态） | `src/registration/`（`model.ts` 定义数据模型） |
| 数据落点 | 全在内存，刷新即丢 | 草稿持久化（IndexedDB 首选 / localStorage 兜底，key `1b_company_registration`） |
| 映射层 | `src/shared/registrationBridge.ts`（已实现，**尚未接线**） | 同左 |

> 本文里的行号对应 2026-09-18 的代码状态，改代码后请一并更新。

---

## 一、copreg：支付前采集的字段

支付前一共 3 个采集页面：问卷（第 1 步）、方案报价（第 2 步）、协议与支付（第 3 步）。

### 1.1 问卷 —— `src/copreg/components/SurveyStep.tsx`

数据落在 `SurveyStep` 组件外层的 `SurveyData`（`src/copreg/types.ts:6`），由 `App.tsx` 持有。

| 字段 | 类型 / 控件 | 选项或来源 | 必填 | 注释 |
|---|---|---|---|---|
| `coreNeeds` | `string[]` 多选卡 | 需公司主体 / 需对公收款 / 需开票 / 需用工并缴社保（`:265`） | 是（页面上没有必填标记，但 `surveyCheck.ts` 会拦） | 需求意向。**只用于问卷完成度判断**，不进方案生成，桥接层也未映射 |
| `companyDesc` | `string` textarea | 自由文本（`:352`） | 是（`:350`） | AI 智能填充的必填入参；`buildPlan` 的行业匹配输入；桥接为 `basic.intro` |
| `bizDesc` | `string` textarea | 自由文本（`:365`） | 是（`:363`） | 同上；桥接为 `basic.service` |
| `scope` | `string[]` 标签 | AI 智能填充，或输入后回车自建（`:443`） | 否 | 初步经营范围。用词与市监规范表述一致，桥接时按「、」拼成 `basic.scope` |
| `license` | `string[]` 标签 | AI 建议或自定义（`:486`） | 否 | **「涉及许可 / 备案资质」**（食品经营许可证这类）→ `plan.postQualifications`。⚠️ 与 registration 的营业执照附件同名不同义，不互相映射 |
| `sensitive` | `string[]` 多选，固定 11 项 | 教培 / 医疗·器械 / 食品·餐饮 / 进出口 / 直播·MCN / 金融·理财 / 人力·劳务 / 建筑·施工 / 危化·环保 / 网络文化·ICP / 其他（`:504`，取自 `plan.ts` 的 `SENSITIVE_OPTIONS`） | 否 | 命中「进出口」时 `plan.preQualifications` 追加海关与外汇登记 |
| `invoiceReq` | `string` 单选，3 项 | 不确定 / 增值税专用发票 / 增值税普通发票（`:551`） | 是（`:548`） | 只影响方案里的纳税人身份说明，不进桥接 |
| `monthlyAmount` | `string` 单选，4 档 | < 10 万 / 10 - 50 万 / 50 - 200 万 / > 200 万（`:576`） | 是（`:573`） | 同上 |
| `revenue` | `string[]` 多选 | 服务费 / 货物销售 / 平台抽佣 / 项目·阶段款 / 其他（`:601`） | 至少 1 项（`:598`） | 同上 |
| `revenueOther` | `string` | —— | —— | **无 UI，恒为空**：只在 `emptySurvey()` 与问卷重置里出现（`App.tsx:49`、`SurveyStep.tsx:207`） |
| `shareholderType` | `string[]` 多选 | 自然人 / 公司股东 / 境外主体（`:647`） | 至少 1 项（`:644`） | 这是「前端预判」，桥接的反向映射直接用 registration 的实际股东类型覆盖 |
| `shareholderCount` | `string` 单选 | 1 个 / 2 个 / 3 个及以上（`:673`） | 是（`:670`） | 同上，反向用实际条数覆盖 |
| `capitalRec` | `string` 单选 | 是 · 需要专家建议 / 否 · 已有明确数额（`:699`） | 是（`:696`） | 「是」= 金额交给服务人员定。桥接为 `basic.expert`，且此时 `basic.capital` 留空 |
| `capitalAmount` | `string` 数字输入框 | 用户输入，仅 `capitalRec === '否'` 时出现（`:729`） | 选「否」时是（`surveyCheck.ts`；`:734` 的过滤保证非空即整数） | 只是 `plan.capitalAmount` 的上游，而**下单以 `plan.capitalAmount` 为准**：`plan.ts` 会补上「万元人民币」单位，桥接层再用 `digitsOf` 剥回数字串。输入框只收整数，与 registration 的「非负整数」规则一致 |
| `regAddress` | `string` 单选 | 是（需推荐）/ 否（自有地址）（`:770`） | 是（`:767`） | ⚠️ **存的是「要不要推荐」，不是地址本身**。真实注册地址 copreg 全程不采集。桥接为 `basic.regRecommend` |
| `officeSpace` | `string` 单选 | 是 · 需要推荐 / 否 · 暂不需要（`:795`） | 是（`:792`） | 问的是「要不要推荐实体办公场地」，桥接到 `basic.workRecommend`（语义最接近，但严格说不等同） |

点「生成需求方案」时的必填校验清单统一在 `src/copreg/surveyCheck.ts`（11 项，顺序与页面一致），缺哪一项就弹那一项的提示、并滚动到对应区块；同时缺多项时只在提示后带一句「另有 N 项未完成」，不连弹一串。上表「必填」列的 `:NNN` 是页面上那个必填 / 必选标记本身，真正拦人的是这张清单。

「AI 智能填充」按钮（`:92` `handleAiGenerate`）先校验两个描述都非空，然后弹腾讯行为验证码，通过后才调 `src/copreg/aiFill.ts`（`POST /api/company-plan/ai-fill`，ticket / randstr 以 `jcaptchaCode` / `jcaptchaId` 走 query，host 与路径见 `src/config/api.ts` 的 `COMPANY_PLAN_HOST` / `AI_FILL_PATH`），把返回的 `scope` / `license` / `sensitive` 三个数组写进问卷，只写这三个字段。返回值里某项是空数组表示「这项没有建议」，此时保留用户已填内容；`sensitive` 会先按 `SENSITIVE_OPTIONS` 过滤，不在固定选项内的标签一律丢弃（表单渲染不出来，也就删不掉）。失败时把接口的中文错误提示原样弹 toast；用户自己关掉验证码弹窗则静默返回，不报错也不做本地兜底 —— 详见 `aiFill.ts` 的文件头注释。

「生成需求方案」按钮（`:840` `handleValidateAndSubmit`，定义在 `:172`）在必填校验通过后调 `src/copreg/planGenerate.ts`（`POST /api/company-plan/diagnose-architecture`，body 就是上面这张表的逐字段镜像，接口参数以前端为准），把服务端返回的架构诊断结果（企业名称方案 / 组织形式 / 纳税人身份 / 资本与出资安排 / 地址 / 前置与后置许可资质 / 风险提示）覆盖到本地方案上；没给的项保留 `plan.ts` 的本地值，价格与套餐一律不动。请求期间按钮置灰显示「生成方案中…」；接口失败不拦人前进（本地方案本身完整可用），但会在页面底部弹一条提示说明这版是本地生成的（提示放在 `App.tsx` 的 `notice` 里，因为问卷页的 toast 会随跳转卸载）—— **请求字段清单、响应字段清单与失败处理见 `docs/copreg-plan-api.md`**。

提交时这份问卷会**存进 localStorage**（`src/copreg/planDraft.ts`），分两份键、写的时机也不同：**「填写的」在调接口之前写**（`1b_copreg_plan_form`：问卷 + 第 2 步选过的套餐 / 加购 —— 接口超时或用户等待时关掉页面，问卷都还能捞回来），**「返回的」只在接口成功后写**（`1b_copreg_plan_report`：架构诊断结果，它和上面那份问卷是配套的）。下次打开只要有「填写的」就直接落到第 2 步，不用重填上表这 16 个字段；有「返回的」再把诊断结果叠上去。存的是「输入」而不是算出来的方案，方案进页面时用 `buildPlan(survey, quoteFor(tier, addons))` 现算，所以报价改版后回来看到的是新价。**手机号与订单不落本地**（手机号按约定不保存，订单是服务端说了算的状态，前端恢复它只会造出一个「看着像已支付」的假象），所以刷新后仍要重新验证手机号；支付、服务群、办理进度这几步也不在存档范围，一律从第 2 步重来。提交新问卷时会先作废上一份「返回的」（旧结论对应的是旧问卷），问卷页点「重置」则两份一起作废（`onReset`），否则重置完刷新一下又跳回第 2 步。

### 1.2 方案与报价 —— `src/copreg/components/ProposalStep.tsx`

| 字段 | 类型 | 选项 | 注释 |
|---|---|---|---|
| 套餐 `selectedTier` | `ServiceTierType` | `standard` / `bundle_small` / `bundle_general`（`proposalQuote.ts`） | 组件本地 `useState`，选定后写进 `plan.selectedTier`，金额同步到 `order.amount` |
| 增值服务 `selectedAddons` | `string[]` | `addon-bank` / `addon-tax` / `addon-social`（`proposalQuote.ts` 的 `ALL_ADDON_IDS`） | 只有 `standard` 套餐能选，其他套餐下单时被过滤掉 |
| 经办人手机号 `contactPhone` | `string` | 11 位，`/^1\d{10}$/`（`:104`） | 需先过腾讯行为验证码才发短信；校验通过后经 `onProceed(phone)` 写入 `order.contactPhone`（`App.tsx:228`）。**这一步不走本地存档**，刷新后要重新验证 |
| 短信验证码 `smsCode` / `smsCodeId` / `smsSentTo` | 组件本地态 | 4~6 位 | **不落库**：`smsCodeId` 交给服务端比对；`smsSentTo` 记住验证码实际发往的号码，改号后必须重新获取；改号后旧的验证码不认（`:131`） |

报价本身（套餐明细、赠品、合计金额）由 `proposalQuote.ts` 的 `quoteFor()` 算，不是用户填的字段。

### 1.3 协议与支付 —— `src/copreg/components/AgreementAndPaymentStep.tsx`

| 字段 | 类型 | 注释 |
|---|---|---|
| 协议勾选 `hasAgreed` | `boolean` | 组件本地态，未勾选时拦住支付（`:100`）。⚠️ 初始值为 `true`，等于预勾选 |
| `order.paymentMethod` | `'wechat' \| 'alipay'` | 收银台里选，支付成功时写入（`:124`） |
| `order.orderNo` | `string` | 支付成功那一刻用同一个 `Date` 现场生成（`:120` 的 `makeOrderNo`），没有后端下发 |
| `order.paidAt` / `order.status` / `order.amount` | `string` / `'paid'` / `number` | 同上，均在支付成功时写入（`:118-124`） |

### 1.4 只在类型里、界面不采集的字段

以下字段在 `PaymentOrder`（`src/copreg/types.ts:86`）里有定义，但**全项目没有任何写入方**，读到的永远是初始空值：

| 字段 | 界面上被读到的位置 | 现状 |
|---|---|---|
| `order.contactName` | 支付页「经办人姓名」（`:505`）、协议甲方「委托方（甲方）：＿＿＿＿」（`:755`）、服务群在线成员（`ServiceGroupStep.tsx:184`）、聊天发言人（`App.tsx:259`） | **无人写入**（全项目只有 `App.tsx:116` 的空初始化）→ 支付页与协议里是空白，服务群成员行退化成「客户本人」，聊天发言人退化成「我」 |
| `order.invoiceType` / `invoiceTitle` / `invoiceTaxId` / `invoiceEmail` | 未被读取 | 无人写入，发票信息整体未采集 |
| `order.receiptNumber` | 未被读取 | 无人写入 |

---

## 二、registration：字段清单

数据模型在 `src/registration/model.ts`，表格是「一份文档」而不是字段树：人员和股东都是记录列表，靠 id 互相引用。

### 2.0 结构总览

```
ApplicationData
├── basic        企业基本信息        （第 1 步 / section 0）
├── shareholders 股东及出资，列表     （第 2 步 / section 1）
├── people       人员，按 id 去重存放  ← 自然人股东与角色记录都指向这里
├── roles        企业主要人员，列表    （第 3 步 / section 2）
├── setup        企业设立信息         （第 4 步 / section 3）
├── authorization 委托书办理          （第 5 步 / section 4）
├── confirm      信息确认             （第 6 步 / section 5）
└── status / savedAt / submittedAt / submissionPhone / id
```

六个步骤的标题见 `model.ts:24` 的 `TITLES`；`schema.ts` 的 `ValidationError.section` 就是这里的 0~5，页面用它把错误挂回对应步骤。

### 2.1 `basic`（企业基本信息）

| 字段 | 类型 / 控件 | 必填与否 | 注释 |
|---|---|---|---|
| `org` | `string` 单选 | 必填（`schema.ts:65`） | 取值 `ORG_OPTIONS` = 有限责任公司 / 股份有限公司 / 合伙企业 |
| `orgOther` | `string` | `org === '其他'` 时必填 | copreg 的 `plan.companyType` 匹配不到 `ORG_OPTIONS` 时，原文落到这里 |
| `intro` | `string` | 必填 | 企业简介 ← copreg `survey.companyDesc` |
| `service` | `string` | 必填 | 主营服务简介 ← copreg `survey.bizDesc` |
| `scope` | `string` **自由文本** | 必填 | 经营范围。copreg 侧是数组，两边靠「、」互转 |
| `capital` | `string` 数字文本 | `expert` 为假时必须是整数 | 注册资本（人民币，币种固定见 `CONFIG.currency`） |
| `expert` | `boolean` | —— | 「由服务人员提供注册资金建议」。为真时不校验 `capital` |
| `names` | `string[]` | 至少 1 个非空；第 4 个起不能留空 | 拟注册名称。开箱 3 个栏位（`CONFIG.nameInitial`），上限 9 个 |
| `regAddress` | `string` | `regRecommend` 为假时必填 | 注册地址 |
| `regRecommend` | `boolean` | —— | 注册地址由服务商推荐 |
| `workAddress` | `string` | `workRecommend` 为假时必填 | 实际经营地址 |
| `workRecommend` | `boolean` | —— | 经营地址由服务商推荐 |

### 2.2 `people`（人员，按 id 去重的池子）

| 字段 | 类型 | 必填与否 | 注释 |
|---|---|---|---|
| `name` | `string` | 必填 | 姓名 |
| `phone` | `string` | 必填 | 联系电话 |
| `email` | `string` | 选填，填了要符合格式 | 电子邮箱 |
| `education` | `string` | 选填 | 取值 `EDUCATION_OPTIONS` 8 项（博士研究生 … 初中及以下 / 其他） |
| `address` | `string` | 必填 | 居住地址 |
| `files` | `Attachment[]` | 见 2.7 | 自然人挂在人身上，所以同一人的证件照只存一份 |

### 2.3 `shareholders`（股东及出资，列表）

| 字段 | 类型 | 必填与否 | 注释 |
|---|---|---|---|
| `type` | `'自然人' \| '企业' \| '其他'` | 必填 | 决定这一条要企业主体信息还是关联人员 |
| `personId` | `string \| null` | 自然人必填 | 指向 `people` 的一条；企业/其他为 `null` |
| `name` | `string` | `企业` 必填、`其他` 必填（作股东说明） | 自然人股东这里留空，显示时取关联人员的姓名（`model.ts:212` `titleOf`） |
| `code` | `string` | `企业` 必填 | 统一社会信用代码 |
| `ratio` | `string` | 必填，> 0 且 ≤ 100 | 出资比例（百分数） |
| `amount` | `string` | 选填，非负数字 | 出资金额 |
| `method` | `string[]` | 选填 | 出资形式，取值 `CONTRIBUTION_METHODS` 6 项：货币 / 实物 / 知识产权 / 土地使用权 / 劳务 / 其他 |
| `files` | `Attachment[]` | 非自然人股东：`license` 位必传 | 企业股东的营业执照。**与 copreg 的 `survey.license` 无关** |

校验口径：自然人股东要过人员必填项 + 出资项 + 身份证正反面；企业股东要过主体信息 + 出资项 + 营业执照。证件照允许先存后补，提交前必须齐。

### 2.4 `roles`（企业主要人员，列表）

| 字段 | 类型 | 注释 |
|---|---|---|
| `personId` | `string \| null` | 指向 `people` |
| `roles` | `RoleName[]` | 取值 `ROLES` = 法定代表人 / 财务负责人 / 总经理 / 联系人，可多选；总经理为选填 |

必设角色见 `CONFIG.requiredRoles`：法定代表人、财务负责人、联系人。同一个人只允许一条记录，多角色并进同一条（否则报「该人员已重复添加」）。

### 2.5 `setup`（企业设立信息）

| 字段 | 类型 | 选项 / 校验 |
|---|---|---|
| `board` | `string` | 设董事会 / 不设董事会 |
| `directors` | `string` | `board === '设董事会'` 时启用，人数须为非负整数 |
| `singleDirector` | `string` | 不设董事会时的单一董事 |
| `supervisorBoard` | `string` | 设监事会 / 不设监事会 |
| `supervisors` | `string` | `supervisorBoard === '设监事会'` 时启用，人数须为非负整数 |
| `singleSupervisor` | `string` | 不设监事会时的监事安排 |
| `unanimous` | `boolean` | 「全体股东一致同意不设监事」；`singleSupervisor === '不设监事'` 时必须勾选才算完成 |
| `term` | `string` | 营业期限；`固定年限` 时 `termYears` 必填且 > 0 |
| `termYears` | `string` | 固定年限的年数 |
| `legacyTerm` | `string` | 旧草稿把「20 年」写在 `term` 上，迁移后暂存于此，非用户字段 |
| `employees` | `string` | 用工人数，须为非负整数。`setupComplete()`（`schema.ts:284`）要求它已填 |

`setup` 不参与提交拦截，只影响导航上的「完成」标记。

### 2.6 `authorization`（委托书办理）

| 字段 | 类型 | 注释 |
|---|---|---|
| `trusteeName` | `string` | **数据里留空**，显示时实时取「联系人」角色的姓名，保证改了人员信息委托书跟着变（`model.ts:253`） |
| `trusteeIdNumber` | `string` | 本版不收集，打印时留空白下划线 |
| `files` | `Attachment[]` | 已签署的委托书扫描件，只保留一份，重传即替换 |

这一步不参与提交拦截，`validate()` 里没有它的规则。

### 2.7 附件 `Attachment` 与证件位

| 字段 | 类型 | 注释 |
|---|---|---|
| `id` / `name` / `size` / `type` | `string` / `string` / `number` / `string` | 文件元信息 |
| `data` | `string` | **dataURL，只存在本地**，不会发往服务端 |
| `slot` | `'idFront' \| 'idBack' \| 'license'` | 证件位语义见 `PHOTO_SLOTS`：身份证正面 / 身份证反面 / 营业执照 |

判完整度的两个工具：`idPhotosComplete()` 要求两个身份证位都在；`hasLicense()` 要求营业执照位在。

### 2.8 `confirm` 与顶层

| 字段 | 类型 | 注释 |
|---|---|---|
| `confirm.exemption` | `boolean` | 免申报受益所有人承诺。只在全体股东都是自然人时才有意义（`isPureNatural`） |
| `confirm.accurate` | `boolean` | 信息真实性确认，**提交拦截项**（未勾选直接报错） |
| `status` | `'draft' \| 'submitted'` | 草稿 / 已提交 |
| `savedAt` / `submittedAt` | `string \| null` | 保存时间 / 提交时间；`savedAt` 也是草稿择新载入的依据 |
| `submissionPhone` | `string` | 提交时短信核验用的手机号（`RegistrationApp.tsx:385`） |
| `id` | `string` | 申请单 id，`uid()` 生成 |

---

## 三、两边怎么对齐

映射实现在 `src/shared/registrationBridge.ts`，两个方向：`applicationFromCopreg()` 预填、`copregFromApplication()` 回填。

### 3.1 三个同名不同义的词（改名硬对必出错）

| 词 | copreg 的含义 | registration 的含义 | 处理 |
|---|---|---|---|
| `regAddress` | 「**要不要**推荐注册地址」的单选值（`是（需推荐）`） | 注册地址**字符串本身** | copreg → `basic.regRecommend`；真实地址 copreg 不采集，映射时 registration 侧保持原值 |
| `license` | 「涉及许可 / 备案资质」（食品经营许可证这类） | 企业股东的**营业执照照片**（`slot === 'license'`） | 两者无关，**不互相映射** |
| `scope` | `string[]` | `string` 自由文本 | 在本层双向转换，分隔符统一为「、」 |

### 3.2 copreg → registration（预填）

| copreg 来源 | registration 落点 | 说明 |
|---|---|---|
| `survey.companyDesc` | `basic.intro` | 原样 |
| `survey.bizDesc` | `basic.service` | 原样 |
| `survey.scope[]` | `basic.scope` | `joinScope()`，用「、」拼接 |
| `plan.companyType` | `basic.org` / `basic.orgOther` | 命中 `ORG_OPTIONS` 就选它，否则落「其他」并把原文放进 `orgOther` |
| `plan.capitalAmount`（回退 `survey.capitalAmount`） | `basic.capital` | 取数字串（「万元人民币」后缀由 `digitsOf` 剥掉）；`capitalRec === '是'` 时改写 `expert: true` 且金额留空 |
| `survey.capitalRec` | `basic.expert` | 首字为「是」即视为需要专家建议 |
| `survey.regAddress` | `basic.regRecommend` | 只看首字，不依赖括号里的说明文案 |
| `survey.officeSpace` | `basic.workRecommend` | 语义最接近的一项映射 |
| `details.primaryName` / `backupName1` / `backupName2` | `basic.names[0..2]` | 正好对上开箱的三个名称栏位 |
| `details.legalRepresentative` | `people` + 「法定代表人」角色 | 按身份证号（无号则按姓名）去重后并入 |
| `details.financeOfficer` | `people` + 「财务负责人」角色 | 同上 |
| `details.shareholders[]` | `shareholders`（type 自然人）+ `people` | `ratio` / `amount` 数字转字符串；`method` 留空由用户补 |
| `order.contactName` / `contactPhone` | `people` + 「联系人」角色 | ⚠️ `contactName` 目前无人写入，见 1.4 |
| `details.officeAddress.region` + `detail` | `basic.workAddress` | 两段拼成一行；`propertyType` / `area` 无落点 |
| `survey.license`、`survey.sensitive`、`survey.coreNeeds`、`survey.invoiceReq`、`survey.monthlyAmount`、`survey.revenue`、`survey.revenueOther` | —— | registration 没有对应字段，不映射 |
| `details.supervisor` | —— | registration 的 `ROLES` 里没有「监事」，只有一个监事会设置，安放不了具名监事 |
| `details.docs` | —— | registration 的附件是 dataURL 二进制 + slot 语义，copreg 的 docs 只是「传没传」的清单 |
| `plan`（套餐、报价、风险提示、交付物） | —— | registration 没有报价概念 |

人员去重规则：同一个人（靠身份证号，没号则靠姓名）在 copreg 里可能同时是股东、法定代表人、财务负责人、联系人（四份独立记录），到 registration 侧必须合成**一条** `people` 记录，多条角色并进同一条 `roles` 记录，否则 schema 报错。

### 3.3 registration → copreg（回填）

| registration 来源 | copreg 落点 | 说明 |
|---|---|---|
| `basic.intro` / `basic.service` | `survey.companyDesc` / `bizDesc` | 原样 |
| `basic.scope` | `survey.scope[]` | `splitScope()`，按「、,，;；换行」切分 |
| `basic.expert` | `survey.capitalRec` | 真 → `'是'` |
| `basic.capital` | `survey.capitalAmount` | 原样 |
| `basic.regRecommend` | `survey.regAddress` | 真 → `'是（需推荐）'` |
| `basic.workRecommend` | `survey.officeSpace` | 真 → `'是'` |
| `shareholders[].type` 去重 | `survey.shareholderType` | 这是反向独有的信息 |
| `shareholders.length` | `survey.shareholderCount` | 形如 `'3 个'` |
| 「联系人」角色的人 | `order.contactName` / `contactPhone` | 同一角色多人时不取（视为未定） |
| `basic.names[0..2]` | `details.primaryName` / `backupName1` / `backupName2` | 原样 |
| 「法定代表人」/「财务负责人」角色的人 | `details.legalRepresentative` / `financeOfficer` | 同上，多人时不取 |
| 自然人股东 + 关联人员 | `details.shareholders[]` | `ratio` / `amount` 转数字，转不出给 0 |
| `basic.workAddress` | `details.officeAddress.region` | 整串塞进 `region`，拆不出详址/性质/面积，其余三段保留原值 |

反向映射**只覆盖 registration 确实掌握的部分**：问卷里的意向选项、`license`、`sensitive`、发票与收入、`details.supervisor`、`details.docs`、`plan` 全部保留原值，不清空。

### 3.4 结构性有损（做不到无损，已在代码里注明）

1. **身份证号**：copreg 以文本收集，registration 只收正反面照片（`Person` 里没有证件号字段）→ 两个方向都补不出来。
2. **监事**：copreg 有具名监事，registration 的 `ROLES` 里没有这个角色 → 单向丢失。
3. **经营地址**：registration 只有一行自由文本，copreg 是四段（区 / 详址 / 性质 / 面积）→ 反向只能整串放进 `region`。
4. **出资形式**：copreg 不采集，`method` 只能留空由用户补（schema 也不列为必填）。
5. **附件**：registration 是二进制 + 证件位语义，copreg 只有「传没传」的清单 → 形状对不上。
6. **经营范围**：数组 ↔ 自由文本，靠「、」往返，用户自己输的顿号会在往返中归一。

---

## 四、当前能验证到的缺口

| # | 缺口 | 证据 |
|---|---|---|
| 1 | `order.contactName` 没有写入方 | 全项目仅读取（`AgreementAndPaymentStep.tsx:505`、`:755`、`ServiceGroupStep.tsx:184`、`App.tsx:259`）与 `App.tsx:116` 的空初始化；结果：支付页「经办人姓名」空白、协议甲方是空下划线、服务群发言人退化成「我」、桥接的「联系人」角色拿不到姓名 |
| 2 | 发票相关字段（`invoiceType` / `invoiceTitle` / `invoiceTaxId` / `invoiceEmail`）与 `receiptNumber` 无写入方 | 同上，且这些字段也没有被任何界面读取 |
| 3 | `survey.revenueOther` 无 UI | 只有 `App.tsx:49`、`SurveyStep.tsx:207` 两处空值 |
| 4 | `survey.coreNeeds` 未参与方案生成，也未进桥接 | `plan.ts` 不读它；`registrationBridge.ts:325` 的注释明确把它列在「没有对应字段」一组 |
| 5 | 映射层未接线 | `src/shared/registrationBridge.ts` 已被 `tsc` 纳入编译，但 copreg 与 registration 两个入口都没有调用它；copreg 的 `details` 因此恒为空，进度页里企业名称 / 法定代表人 / 收件地址显示「待同步」 |

---

## 附：字段来源速查

| 想改什么 | 去哪里 |
|---|---|
| copreg 问卷字段与选项 | `src/copreg/components/SurveyStep.tsx`；类型 `src/copreg/types.ts` 的 `SurveyData` |
| copreg 套餐 / 增值服务 / 报价算法 | `src/copreg/components/proposalQuote.ts` |
| 问卷必填校验清单 | `src/copreg/surveyCheck.ts`（`SurveyStep.tsx` 的 `handleValidateAndSubmit` 用它） |
| 方案生成、本地行业关键词模型 | `src/copreg/plan.ts` |
| AI 智能填充（接口地址与调用） | 地址 `src/config/api.ts` 的 `COMPANY_PLAN_HOST` / `AI_FILL_PATH`；调用 `src/copreg/aiFill.ts` |
| 生成需求方案（接口地址、请求 / 响应字段与调用） | 地址同上的 `PLAN_DIAGNOSE_PATH`；调用 `src/copreg/planGenerate.ts`；字段清单见 `docs/copreg-plan-api.md` |
| 两个 AI 接口共用的请求底座（超时 / 响应校验 / 错误文案） | `src/copreg/apiClient.ts` |
| 第 1 步的本地存档（填写的与返回的分开存，下次直接进第 2 步） | `src/copreg/planDraft.ts`；初始化与落盘在 `src/copreg/App.tsx`；与注册页草稿同款做法见 `src/registration/draft.ts` |
| 支付订单字段 | `src/copreg/types.ts` 的 `PaymentOrder`；写入点 `AgreementAndPaymentStep.tsx` 的 `handleCompletePayment` |
| registration 数据模型 | `src/registration/model.ts` |
| registration 校验规则 | `src/registration/schema.ts` |
| registration 草稿持久化 | `src/registration/draft.ts` |
| 两边字段映射 | `src/shared/registrationBridge.ts` |
