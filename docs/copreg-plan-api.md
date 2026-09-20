# copreg 方案接口字段说明

三个接口**同属企业方案服务**，都在 `/api/company-plan/*` 下：第 1 步（问卷页）调 AI 智能填充与
架构诊断，第 2 步（方案页）在「确认并前往支付」时调确认保存。本文整理**接口参数与返回值**，
即服务端照这份清单做即可 —— 参数以前端为准，第 1 步的字段名与前端问卷
（`SurveyData`，`src/copreg/types.ts:6`）逐字一致。

| 用途 | 方法 / 路径 | 触发点 | 调用模块 |
|---|---|---|---|
| AI 智能填充：出经营范围、许可资质、敏感要素建议 | `POST {host}/api/company-plan/ai-fill` | 问卷页「AI 智能填充」按钮（`SurveyStep.tsx:89`） | `src/copreg/aiFill.ts` |
| 生成需求方案（架构诊断，含企业概况评估） | `POST {host}/api/company-plan/diagnose-architecture` | 问卷页「生成需求方案」按钮（`SurveyStep.tsx:169`） | `src/copreg/planGenerate.ts` |
| 确认并前往支付：第 1 步两份存档（自选增值服务带名称与实收价）+ 手机号验证信息一并留档 | `POST {host}/api/company-plan/confirm-proposal` | 方案页手机号验证弹窗的「确认并前往支付」按钮（`ProposalStep.tsx:126`） | `src/copreg/serviceConfirm.ts` |

`host` 与三个路径都能用环境变量覆盖（`VITE_COMPANY_PLAN_HOST` / `VITE_AI_FILL_PATH` /
`VITE_PLAN_DIAGNOSE_PATH` / `VITE_CONFIRM_PROPOSAL_PATH`），默认值见 `src/config/api.ts`
（host 默认 `https://caa001.ibanbu.com`，取自 caa 项目生产配置，1b 侧待确认）。

---

## 一、AI 智能填充 `POST /api/company-plan/ai-fill`

### 1.1 请求

| 位置 | 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| query | `captchaAppId` | `string` | 是 | 腾讯云行为验证码 appId（前端公开值） |
| query | `userIp` | `string` | 是 | 腾讯侧风控用的出口 IP |
| query | `jcaptchaCode` | `string` | 是 | 验证码票据 ticket，弹窗成功回调里拿到 |
| query | `jcaptchaId` | `string` | 是 | 验证码 randstr，与 ticket 同时下发 |
| body | `companyDesc` | `string` | 是 | 企业描述，来自问卷同名字段，已 trim；后端标了 `@NotBlank` |
| body | `bizDesc` | `string` | 是 | 业务描述，来自问卷同名字段，已 trim；后端标了 `@NotBlank` |

验证码参数只走 query，不重复塞进 body —— body 的 DTO 只声明了上面两个字段，
多传字段在严格反序列化下会直接换回 400。

### 1.2 响应

| 字段 | 类型 | 说明 |
|---|---|---|
| `scope` | `string[]` | 按重要性排序的标准经营范围条目 |
| `license` | `string[]` | 行政许可 / 备案资质全称 |
| `sensitive` | `string[]` | 业务涉及的敏感领域标签，取值限定在问卷固定选项内（`plan.ts` 的 `SENSITIVE_OPTIONS`） |

三个字段都是「没有建议就空数组」，不是 `null`。前端写入规则：空数组**不覆盖**用户已填内容；
`sensitive` 里不在固定选项内的标签会被丢掉（表单渲染不出来，也就删不掉）。

---

## 二、生成需求方案（架构诊断）`POST /api/company-plan/diagnose-architecture`

### 2.1 请求信封

```json
{ "formData": { ...见 2.2... } }
```

caa 同接口的 body 是 `{ formData, phoneNumber }`，其中 `phoneNumber` 承载短信校验信息
（`mobile` / `smsCodeId` / `smsValidCode` / `password` / 验证码四件套 / `shareUserUuid`）。
copreg 在问卷提交这一步**还没有手机号**（手机号是下一步确认方案时才收并验证），所以这个字段不发。
短信验证信息改由第 2 步的确认接口承载（见第三节的 `phoneNumber`）。若后端要求这个诊断接口
也过短信闸门，得把调用点后移到 `ProposalStep` 的手机号验证之后，再补上该字段。

### 2.2 请求字段 `formData`

字段名、取值口径与问卷完全一致（单选字段直接给用户看到的那句文案，不做二次编码）。

| # | 字段 | 类型 | 来源（问卷控件） | 说明 |
|---|---|---|---|---|
| 1 | `coreNeeds` | `string[]` | 01 核心需求 · 多选卡 | 办理诉求：需公司主体 / 需对公收款 / 需开票 / 需用工并缴社保 |
| 2 | `companyDesc` | `string` | 01 企业描述 · textarea | 字号、行业、主营方向，出方案的主要依据之一 |
| 3 | `bizDesc` | `string` | 01 业务描述 · textarea | 具体做什么、面向企业还是消费者、线上还是线下 |
| 4 | `scope` | `string[]` | 01 经营范围 · 标签 | 标准经营范围条目，可能来自 AI 智能填充，也可能是用户自己加的 |
| 5 | `license` | `string[]` | 01 许可资质 · 标签 | 行政许可 / 备案资质全称 |
| 6 | `sensitive` | `string[]` | 01 敏感要素 · 固定 11 项多选 | 取值限定在 `SENSITIVE_OPTIONS` 内 |
| 7 | `invoiceReq` | `string` | 02 近期开票要求 · 单选 3 项 | 不确定 / 增值税专用发票 / 增值税普通发票 |
| 8 | `monthlyAmount` | `string` | 02 预计月开票额 · 单选 4 档 | `< 10 万` / `10 - 50 万` / `50 - 200 万` / `> 200 万` |
| 9 | `revenue` | `string[]` | 02 收入模式 · 多选 | 服务费 / 货物销售 / 平台抽佣 / 项目·阶段款 / 其他 |
| 10 | `revenueOther` | `string` | 02 收入模式 ·（暂无 UI） | 选了「其他」时用户自己写的补充；当前恒为空串 |
| 11 | `shareholderType` | `string[]` | 04 股东类型 · 多选 | 自然人 / 公司股东 / 境外主体 |
| 12 | `shareholderCount` | `string` | 04 股东人数 · 单选 | `1 个` / `2 个` / `3 个及以上` |
| 13 | `capitalRec` | `string` | 04 注册资本专家建议 · 单选 | `是` = 金额由服务人员定，`否` = 用户自己填了金额 |
| 14 | `capitalAmount` | `string` | 04 注册资本金额 · 数字输入框 | **万元**为单位的纯数字串；仅 `capitalRec === '否'` 时非空（切回「是」时前端按空串送） |
| 15 | `regAddress` | `string` | 05 注册地址 · 单选 | `是（需推荐）` / `否（自有地址）`；⚠️ 存的是「要不要推荐」，不是地址本身 |
| 16 | `officeSpace` | `string` | 05 办公场地 · 单选 | `是` / `否`；问的是要不要推荐实体办公场地 |

### 2.3 响应

真实返回是**长文本 + 清单**（不是 caa 的 `{ content, model }` 整段文本）。服务端返回下面任意
若干项即可；前端只取 `planGenerate.ts` 的 `PlanSuggestion` 里列出的那几项，其余字段照实收下但不接。

| 响应字段 | 类型 | 前端是否取 | 覆盖到方案里的 | 方案页 / 进度页位置 |
|---|---|---|---|---|
| `companyNameProposal` | `string` | ✅ | `plan.companyNameProposal` 企业名称方案（含备选名） | 方案页 01「企业名称方案」整行块（`:229`，取不到就整块不渲染） |
| `companyType` | `string` | ✅ | `plan.companyType` 组织形式（含股东结构建议） | 方案页 01 架构与组织形式（`:241`、`:823`） |
| `taxpayerIdentity` | `string` | ✅ | `plan.taxpayerIdentity` 纳税人身份规划 | 方案页 01（`:249`） |
| `taxReason` | `string` | ✅ | `plan.taxReason` 这么定的理由 | 方案页 01（`:251`） |
| `capitalAmount` | `string` | ✅ | `plan.capitalAmount` 注册资本建议（一整句话，首个数即金额） | 方案页 01（`:257`、`:824`） |
| `capitalAdvice` | `string` | ✅ | `plan.capitalAdvice` 出资节奏与实缴安排 | 方案页 01「注册资本规划」卡片正文（`:259`） |
| `registeredAddressAdvice` | `string` | ✅ | `plan.registeredAddressAdvice` 注册地址合规策略 | 方案页 01（`:269`） |
| `preQualifications` | `string[]` | ✅ | `plan.preQualifications` 前置许可 / 备案 | 进度页「需办理资质」（`ProgressAndReviewStep.tsx:719`） |
| `postQualifications` | `string[]` | ✅ | `plan.postQualifications` 后置许可 / 资质 | 方案页 01「后续需协同办理的行业资质」（`:287`） |
| `riskTips` | `string[]` | ✅ | `plan.riskTips` 合规风险提示 | 方案页 01「合规专家提醒」（`:307`） |
| `model` | `string` | ❌ 不取 | —— | 服务端自报的模型名，前端没有展示位；要排查时看这里或服务端日志 |

### 2.4 覆盖规则（`applyPlanSuggestion`）

- **`null` / 缺字段 / 空串 / 不是数组** = 服务端没给这一项 → **保留本地方案的值**
  （本地值由 `plan.ts` 的 `buildPlan` 按行业关键词模板生成）。
- **空数组 `[]`** = 服务端明确说「没有」→ **就用空数组**，本地模板猜的那条会被清掉。
  例：真实响应里 `preQualifications: []`，进度页就只列后置资质，不再显示本地猜的「名称自主申报核准」。
- **不参与覆盖**的字段：`selectedTier` / `taxpayerTier` / `tierName` / `items` / `selectedAddons` /
  `totalOriginal` / `totalDiscount` / `finalPrice` —— 价格与套餐是产品定价，只由前端报价
  （`components/proposalQuote.ts` 的 `quoteFor`）决定，服务端给什么都不改。
- 服务端建议会被记住（`App.tsx` 的 `planSuggestion`）：方案页切套餐 / 勾加购会用本地方案重建一份，
  重建后自动重新叠上建议，所以那些操作不会把诊断结果冲掉。
- 每次提交都是**重算 + 重叠**，而不是把响应叠到上一份方案上：本地方案由
  `buildPlan(本次问卷, quoteFor(用户当前套餐, 加购))` 现算（套餐取 `planRef`，因为请求在途时
  用户可能已经去方案页切过档），再叠这一次的响应。否则上一次诊断的结论会留在本次响应
  没给的字段上 —— 问卷已经改了，那些旧结论可能早就不成立了。
- `companyNameProposal` 本地**没有兜底值**（`buildPlan` 里恒为空）：命名依赖字号，本地凑不出来，
  所以接口失败或服务端没给时，方案页那一块整块不渲染，而不是显示一句拼出来的假名称方案。

提交时这份问卷会先存到本地（调接口之前），诊断结果则在成功后单独存一份 —— 见下一节。

---

## 三、确认并前往支付 `POST /api/company-plan/confirm-proposal`

第 2 步方案页的手机号验证弹窗里，点「确认并前往支付」时调一次。作用是把**第 1 步的两份本地存档**
交给服务端留档（自选增值服务带上名称与实收价，服务端好照它出单），确认落库之后才放人进支付页。

后端 DTO 是 `{ formData: JsonNode, proposalResult: JsonNode, phoneNumber: PhoneNumber }`，
其中 `formData` 与 `proposalResult` 标了 `@NotNull`，`phoneNumber` 注释写明必填。

### 3.1 请求

请求体恰好三个字段：

```json
{
  "formData": {
    "survey": { "…见 2.2…" },
    "tier":   "standard",
    "addons": [
      { "id": "addon-bank", "name": "银行对公账户开通", "price": 200 },
      { "id": "addon-tax",  "name": "电子税务局开户",   "price": 300 }
    ]
  },
  "proposalResult": { "…见 2.3…" },
  "phoneNumber":    { "mobile": "13800000000", "smsCodeId": "…", "smsValidCode": "654321" }
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `formData` | `JsonNode` | 是（`@NotNull`） | 就是本地存档 `1b_copreg_plan_form` 那份形状（见第五节），存下去什么这里就发什么 |
| `formData.survey` | `object` | 是 | 问卷 16 个字段，逐个见 2.2 那张表 |
| `formData.tier` | `string` | 是 | 选中的套餐档位：`bundle_small` / `bundle_general` / `standard`（取点击那一刻方案页上的选择）。套餐内含的服务项不上报，服务端按这个档位自己映射 |
| `formData.addons` | `object[]` | 是 | **勾选的自选增值服务**，没勾就是空数组。**只有 `standard` 档会有值**（见下） |
| `formData.addons[].id` | `string` | 是 | `addon-bank` / `addon-tax` / `addon-social` |
| `formData.addons[].name` | `string` | 是 | 服务名称，如「银行对公账户开通」「电子税务局开户」 |
| `formData.addons[].price` | `number` | 是 | 实收金额（元），取自报价明细，与页面上显示的一致 |
| `proposalResult` | `JsonNode` | 是（`@NotNull`） | 本地存档 `1b_copreg_plan_report`：架构诊断结果，就是 2.3 那个响应（前端取的那 10 项）。**绝不能为 `null`**：诊断没成功过时前端就地拦住、不发请求，见 3.2 |
| `phoneNumber` | `PhoneNumber` | 是 | 服务端据此比对短信验证码 |
| `phoneNumber.mobile` | `string` | 是 | 用户填的手机号 |
| `phoneNumber.smsCodeId` | `string` | 是 | 发短信时服务端返回的会话 id（`verification.ts`） |
| `phoneNumber.smsValidCode` | `string` | 是 | 用户填的短信验证码，服务端与 `smsCodeId` 一起校验 |

`survey` / `tier` / `addons` **三个字段与本地存档**（`planDraft.ts` 的 `1b_copreg_plan_form`）
**逐字一致** —— 请求体的类型就是存档类型本身（`PlanForm`），不存在两套形状。
自选项的名称与价格两边都由 `proposalQuote.addonsOf` 从同一份报价明细派生，所以存下来的、
页面上显示的、发出去的，是同一个数。

价格与套餐以页面上显示的为准，服务端不需要自己算价。

**两档「全年无忧」的 `addons` 恒为空数组**，这不是漏传：bundle 档的银行开户 / 税局开户 /
社保公积金开户是套餐内置的必选服务（页面上的报价明细里 `isFree: true`、`tag` 为
「全年无忧必选服务」），页面上没有勾选框，所以没有「自选」可言；自选增值服务只在
`standard` 档提供。套餐内这些服务项前端**一概不上报**，服务端按 `tier` 自己映射即可。

`addons` 的顺序固定为报价明细里的顺序（银行开户 → 税局开户 → 社保公积金开户），
与用户勾选的先后无关。

前端只校验验证码的**格式**（4~6 位数字），真正的比对在服务端 —— 前端没有任何接口能验证它，
所以这三个字段必须原样收下。

请求体里的每一项都是**深拷贝**后交出去的（`serviceConfirmRequestOf`）：请求在途时用户改问卷、
切套餐、勾加购都不会改到已经在途的载荷。

### 3.2 `proposalResult` 为空的处理

第 1 步的架构诊断接口失败**不拦人前进**（既有产品行为：本地方案照样完整可用），所以
「人已经走到方案页、手上却没有诊断结果」是真实可达的状态。后端 `proposalResult` 是 `@NotNull`，
这种时候前端**就地拦住、一个请求都不发**，提示「方案诊断结果缺失，请返回第 1 步点
『生成需求方案』重新生成后再确认」。不硬送 `null` 去换一句看不懂的 400，也不编一份空壳冒充满意。

### 3.3 响应

```json
{ "recordId": "VHpX5NqoXLHwPyMnVeBzCN", "status": "SUCCESS" }
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `recordId` | `string` | 确认单据号。**必给**：它既是「已确认」的凭据（见 3.4），也是后续微信支付下单的 `bizId` |
| `status` | `string` | 目前只认 `SUCCESS`。别的值（或没给）一律按失败处理，提示里带上服务端给的原值 |

必须是 JSON 对象（数组 / `null` / 不是 JSON 都按「返回格式异常」处理，与另外两个接口一致）。
**HTTP 200 不等于确认成功**：`status` 不是 `SUCCESS`、或 `recordId` 为空，都算失败 ——
没有单据号的「成功」续不上，等于白确认一场。

### 3.4 本地凭据与续步（`1b_copreg_plan_confirm`）

```json
{ "recordId": "VHpX5NqoXLHwPyMnVeBzCN", "status": "SUCCESS",
  "tier": "standard", "addonIds": ["addon-bank"] }
```

`recordId` / `status` 是**服务端给的**，前端原样存下；`tier` / `addonIds` 是**前端附加的注解**，
记下这份确认是为哪套选择做的。之后：

- **下次进入这个页面直接落在第 3 步**（协议确认与支付），不必重新验证手机号、也不必重新提交问卷；
  方案页顶栏仍可回看，第 2 步的主按钮会变成「已确认，前往支付」，点了直接走，**不再重复调用
  确认接口**（重复调用会在服务端多出一份委托单）。
- **凭据必须与「填写的」存档配套**：没有 `1b_copreg_plan_form`（或问卷全空）时只有凭据不会跳 ——
  方案是从问卷算出来的，没有方案就没有可支付的第三步。
- **凭据会过期作废**：重新提交问卷、问卷页点「重置」、或把套餐档位 / 自选项改成与确认时不同，
  凭据立刻清掉，回到「先确认再进支付」的流程。旧凭据代表的方案已经不是页面上这份了，
  继续用会把人送进一份与价格不符的支付页。
- **校验口径：服务端字段严格，附加注解尽力而为**。不是对象、`status` 不是 `SUCCESS`、`recordId`
  为空 → 整个凭据不认（等于没确认过）。而 `tier` 认不出、`addonIds` 缺了或混进未知 id →
  只当作「这一项没记」，**不作废凭据**：服务端只返回 `recordId` / `status`，手写的或老版本写入的
  凭据本来就没有这两个注解。App 首帧读到缺注解的凭据会**接受它并把当前选择补记上去**，
  之后过期判断照常生效。
- **自选项比较按集合看**：勾选先后与报价明细顺序不同，不算「改过」；只比较凭据里记了的那几项。
- 凭据存不下（隐私模式 / 配额满）不拦人：本次已经确认成功、能正常进支付，但会提示
  「下次进入需要重新确认（可能产生重复委托单）」—— 丢凭据的代价是服务端多一份单据，
  这个不能静默。

### 3.5 失败行为

超时 **15s**（不是大模型接口的 60s —— 按钮转圈超过十几秒，用户只会以为卡死）。失败一律
**拦在方案页**：弹窗不关、按钮恢复可点、错误文案直接显示在弹窗里，用户能原地重试，
不会带着一份服务端并不知道的确认进支付页。

| 情况 | 提示 |
|---|---|
| 诊断结果缺失（3.2） | 方案诊断结果缺失，请返回第 1 步点「生成需求方案」重新生成后再确认（且一个请求都不发） |
| 路径被清空（`VITE_CONFIRM_PROPOSAL_PATH` 置空） | 确认方案接口尚未接入，暂时无法前往支付（且一个请求都不发） |
| `status` 不是 `SUCCESS` | 确认方案未成功（{服务端给的状态}） |
| `status` 缺失 | 确认方案未返回状态，请稍后重试 |
| `recordId` 缺失或为空 | 确认方案未返回单据号，请稍后重试 |
| 非 2xx | 优先用响应体里的文字；是网关 HTML 则用「确认方案失败（状态码）」 |
| 超时 | 确认方案超时，请稍后重试 |
| 网络不通 | 网络异常，请检查网络后重试 |
| 响应不是合法 JSON 对象 | 确认方案返回格式异常，请稍后重试 |

请求在途时：手机号输入框、验证码输入框、「获取验证码」、「取消」、右上角关闭全部置灰，
主按钮显示「提交中…」—— 半途关掉弹窗但请求已经发出去，是最容易出重复确认的路径。

---

## 四、三个接口的公共约定

| 项 | 约定 |
|---|---|
| 超时 | 两个 AI 接口 60s（`apiClient.ts` 的默认值），大模型生成长文本比普通接口慢；确认接口 15s。验证码弹窗等待不计入 |
| 请求头 | `Content-Type: application/json` |
| 响应体 | 必须是 JSON 对象；不是 JSON / 是数组 / 是 `null` 一律按「返回格式异常」处理 |
| 「有响应但没内容」 | 架构诊断额外判一条：200 且 JSON 合法、但 2.3 里要取的那些字段一个都没给，按失败处理，走同一条提示通道 —— 否则用户会看到一份本地模板方案却以为它是服务端给的 |
| 错误文案 | 非 2xx 时优先用响应体里的文字（以 `<` 开头认为是网关 HTML，改用兜底文案）；超时「{接口名}超时，请稍后重试」；网络不通「网络异常，请检查网络后重试」；解析失败「{接口名}返回格式异常，请稍后重试」 |
| 类型收口 | `tsconfig` 没开 `strict`，所有响应字段在 `apiClient.ts` 里显式校验：字符串数组过滤掉非字符串与空串并去重，单字符串字段非字符串或空串即视为「没给」 |

失败时的界面行为：

- **AI 智能填充**：把错误文案弹 toast；用户自己关掉验证码弹窗则静默返回（不算失败），
  不做本地兜底 —— 没拿到建议就不改问卷。
- **生成需求方案**：接口失败**不拦人前进**（本地方案本身是完整可用的，用户填的问卷也能落进方案），
  但会在页面底部弹一条提示说明这版方案是本地规则生成的，不静默降级。
  请求期间「生成需求方案」按钮置灰显示「生成方案中…」，避免连点发两次请求；
  「AI 智能填充」与「生成需求方案」互斥（在途时都置灰），免得 AI 结果落进一个已经离开的问卷页。
- **确认并前往支付**：与上面两个相反，接口失败**拦人**——停在方案页、弹窗不关、错误写在弹窗里。
  这是唯一一个「没成功就不许往下走」的调用：支付页要挂在一份服务端已确认的方案上。

---

## 五、第 1 步的本地存档（`src/copreg/planDraft.ts`）

「填写的」和「返回的」**分开存**，写作时机也不同：

| 键 | 内容 | 什么时候写 |
|---|---|---|
| `1b_copreg_plan_form` | 「填写的」：`{ survey, tier, addons }`，**与确认接口的 `formData` 同一形状** | **调接口之前**写一次（接口超时 / 不通 / 用户在等待时关掉页面，问卷都还能捞回来）；方案页切套餐 / 勾加购时再刷新一次档位 |
| `1b_copreg_plan_report` | 「返回的」：2.3 里前端取的那 10 项，与确认接口的 `proposalResult` 同一份 | **只在接口成功后**写。提交新问卷时先 `clearPlanReport`，成功后写新的 —— 旧的结论对应的是旧问卷 |
| `1b_copreg_plan_confirm` | 「确认凭据」：`{ recordId, status, tier, addonIds }`（见 3.4） | **只在 `confirm-proposal` 返回 `SUCCESS` 后**写。提交新问卷、重置问卷、或方案改过（`isPlanConfirmStale`）时 `clearPlanConfirm` |

```json
// 1b_copreg_plan_form —— 与 3.1 的 formData 逐字相同，存下去什么就发什么
{ "survey": { "…": "SurveyData 的 16 个字段，就是 2.2 那张表" },
  "tier": "standard",
  "addons": [ { "id": "addon-bank", "name": "银行对公账户开通", "price": 200 } ] }

// 1b_copreg_plan_confirm —— 有它下次进来直接落在第 3 步
{ "recordId": "VHpX5NqoXLHwPyMnVeBzCN", "status": "SUCCESS",
  "tier": "standard", "addonIds": ["addon-bank"] }
```

下次打开：有「填写的」就直接落到第 2 步（问卷答案、选过的套餐都在），有「确认凭据」再往前一步
落到第 3 步，有「返回的」再把诊断结果叠上去；只有「填写的」时方案页显示的是本地规则那一版
（和刷新前看到的一致）。

- **确认凭据决定停在第三步还是第二步**：`loadPlanDraft()` 一次把三份键读齐，App 首帧看
  `confirm` 决定 `currentStep` 与 `unlockedSteps`（有凭据 = `payment` 且解锁到支付）。
  「确认凭据」必须和「填写的」配套：没有 form 就没有方案，光有凭据不会把人送进支付页。
- **凭据的失效规则**（过期判断在 `isPlanConfirmStale`，纯函数、有自检）：
  档位或自选项与确认时不同即作废；自选项按集合比较，勾选先后不算改过。
  首帧读存档时也会再判一次（防「新问卷 + 旧凭据」这种两次写入之间崩溃留下的组合）。
- **落点自检**：`npm run check:entry` 用**真实组件树**在 Node 里渲染首屏（走 Vite 的 SSR 构建，
  因为 App 依赖 `import.meta.env` 与 JSX），断言四种存档状态下分别落在第 3 / 第 2 / 第 1 步。
  这是唯一覆盖「存档 → 首屏落点」这条链的自检。
- **存档形状与请求体一致**：`addons` 是 `{ id, name, price }` 对象数组，不是 id 字符串数组 ——
  两边都由 `proposalQuote.addonsOf` 从同一份报价明细派生（App 存盘与
  `serviceConfirmRequestOf` 调的是同一个函数），所以「存下来的」与「发出去的」永远同一批对象、
  同一个价格。报价明细只存在于内存，`quoteFor` 重算用的输入仍是 `addons` 里的 id。
- **旧存档（字符串数组）仍能读回**：`normalizeAddons` 两种形状都认，字符串 id 会按
  `OPTIONAL_ADDON_SERVICES` 目录补上名称与价格，认不出的 id 与重复项丢掉。
- **存输入不存算出来的方案**：进入页面时用 `buildPlan(survey, quoteFor(tier, addons 的 id))` 现算、
  再 `applyPlanSuggestion(report)`，所以报价改版后回来看到的是新价，而不是上次存的旧数字。
- **「返回的」不存失败的那次**：接口失败时方案页那份是本地规则拼的，存下来下次就会被当成
  服务端给的结果 —— 所以只有成功的那次才写 report。
- **不存手机号与订单**：手机号按约定不落本地；订单 / 支付是服务端说了算的状态，前端恢复它
  只会造出一个「看着像已支付」的假象。所以支付、服务群、办理进度这几步不在存档范围 ——
  「确认凭据」只说明**确认过**，不代表已支付。
- **读取时逐字段校验**（`parsePlanSuggestion` 复用 2.3 的收口，问卷字段同样逐项过一遍，
  `addons` 走 `normalizeAddons`）：tsconfig 没开 strict，存档又可能来自旧版本或被手改过，
  任何一处对不上就当没有存档；问卷全空也不恢复（否则「重置后刷新」会直接跳到第 2 步）。
  坏 JSON 顺手删掉。
- **问卷页点「重置」两份一起作废**（`SurveyStep` 的 `onReset`），否则重置完刷新一下又跳回第 2 步。
- 写不进去（隐私模式 / 配额满）不拦人前进，但会跟接口失败合并成一条提示说出来
  （问卷存不下与诊断结果存不下是两句不同的提示）；方案页切套餐时的重复落盘失败不提示
  （太吵，下次提交时会再说）。

---

## 六、还没对齐的几处

1. **长文本与页面版式的落差**：真实响应里 `companyType` 是一两百字的一段、`postQualifications`
   每条都是一整句（如「食品经营许可证或食品销售备案：经营范围含⋯⋯」），而方案页把
   `postQualifications` 渲染成一排小标签（`:287` 的 `flex flex-wrap`），长句会撑成很大的胶囊块；
   `capitalAmount` 也是整句（「建议100万元人民币（认缴），不建议低于50万元⋯⋯」），
   现在显示在「注册资本规划」的加粗一行里（下面那行正文已经是服务端的 `capitalAdvice`）。
   要不要把资质改成列表、把 `capitalAmount` 只取金额？属于版式决策，没动。
2. **`capitalAmount` 的取数**：`registrationBridge.ts` 已随 registration.html 一并移除，原来靠它把
   整句 `capitalAmount` 用 `digitsOf` 取第一个数字串写进 `basic.capital`；现在的申报表在
   `BasicInfoSection` 里直接收纯数字，服务端那句建议仍只用于方案页展示。
3. **诊断接口的短信闸门**：caa 的架构诊断接口是在短信验证通过后调的，copreg 现在调在问卷提交
   （那时还没收手机号），不带 `phoneNumber`。短信验证信息目前只在第 2 步的确认接口里送
   （第三节）。若后端要求诊断接口也过闸门，得把调用点后移到 `ProposalStep` 的手机号验证之后。
4. **host 待接口方确认**：三个接口同属企业方案服务，host 默认值取自 caa 项目生产配置
   （`https://caa001.ibanbu.com`），1b 侧尚无自己的方案服务配置 —— 按 `ponytail:` 标注在
   `src/config/api.ts`，可用 `VITE_COMPANY_PLAN_HOST` 覆盖。
5. **套餐内含的服务项前端不上报**：`formData.addons` 只报「自选增值服务」，套餐里含的
   「全年财务代记账服务」「公安备案印章」等行项目由服务端按 `tier` 自己映射（前端不再另发
   服务清单）。若后端希望连套餐内含项也一起收，再加一项字段即可。
6. **刷新后的落点靠本地凭据，不靠服务端状态**：有确认凭据就落在第 3 步，所以**支付成功后再刷新
   也会回到第 3 步**（订单 / 支付状态按约定不落本地，见第五节）。要把「已支付」这一步也续上，
   得等微信支付接口接进 copreg，由服务端查单（`queryOrder`）决定停在支付页还是服务群 ——
   单靠前端存一个标记会造出「看着像已支付」的假象，这是刻意不做的。
7. **`model` 仍未取**：服务端自报的模型名（如 `deepseek-flash`），前端没有展示位。
   要在方案页标一句「本方案由 ⋯ 生成」的话，在这里加一项、`applyPlanSuggestion` 里接上即可。
