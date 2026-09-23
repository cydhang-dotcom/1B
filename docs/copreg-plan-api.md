# copreg 方案接口字段说明

**两个接口**同属企业方案服务，都在 `/api/company-plan/*` 下，都在第 1 步（问卷页）调用：
AI 智能填充出经营范围 / 资质建议，架构诊断出方案内容**并当场建单**（返回 `recordId`）。
第 2 步（方案页）**不调任何接口** —— 它只把第 1 步的结果展示出来，点「前往支付」直接拿那个
单号进支付页。本文整理**接口参数与返回值**，即服务端照这份清单做即可 —— 参数以前端为准，
第 1 步的字段名与前端问卷（`SurveyData`，`src/copreg/types.ts:6`）逐字一致。

| 用途 | 方法 / 路径 | 触发点 | 调用模块 |
|---|---|---|---|
| AI 智能填充：出经营范围、许可资质、敏感要素建议 | `POST {host}/api/company-plan/ai-fill` | 问卷页「AI 智能填充」按钮 | `src/copreg/aiFill.ts` |
| 生成需求方案（架构诊断 + 建单）：出方案内容，并返回委托单号 `recordId` | `POST {host}/api/company-plan/diagnose-architecture` | 问卷页「生成需求方案」按钮（先过手机验证弹框） | `src/copreg/planGenerate.ts` |
| ~~确认并前往支付~~ | ~~`POST {host}/api/company-plan/confirm-proposal`~~ | **已不再调用**（2026-09）：单号改由诊断接口返回，第 2 步成了纯展示页 | 见第三节 |

`host` 与两个路径都能用环境变量覆盖（`VITE_COMPANY_PLAN_HOST` / `VITE_AI_FILL_PATH` /
`VITE_PLAN_DIAGNOSE_PATH`），默认值见 `src/config/api.ts`
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

三个字段都是「没有建议就空数组」，不是 `null`。前端写入规则：**空数组 = 明确「没有」，照样写回
（即把该项清空）** —— 与架构诊断的覆盖口径一致。理由：换了描述再点「重新生成」，页面上就该是
这一版的答案；留着一版 AI 填的旧内容，用户会以为那就是新结果。`sensitive` 里不在固定选项内的
标签会被丢掉（表单渲染不出来，也就删不掉）；若过滤后为空，同样按「清空敏感要素」处理。
三项都返回空数组时会 toast 说明「已清空这三项」，而不是静默什么都不做。

---

## 二、生成需求方案（架构诊断）`POST /api/company-plan/diagnose-architecture`

### 2.1 请求信封

**手机号在这一个接口上验证**（2026-09 从第 2 步挪过来的）：点「生成需求方案」先弹手机验证弹框
（`components/PhoneVerifyModal.tsx`：`获取验证码` 那一步自己会过腾讯行为验证码 → 发短信），
验证通过后才带着手机号与短信凭据发这个请求；服务端拿 `smsCodeId` + `smsValidCode` 比对验证码，
比对不过这次请求就不算成功。**这里没有腾讯行为验证码 query 参数**（那一道在发短信时用掉了）。

```json
{ "formData": { ...见 2.2... },
  "phoneNumber": { "mobile": "13800000000", "smsCodeId": "…", "smsValidCode": "654321" } }
```

| 位置 | 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|---|
| body | `formData` | `object` | 是 | 问卷 16 个字段，逐项见 2.2 |
| body | `phoneNumber` | `object` | 是 | 手机验证弹框给出的三件套（`verification.ts` 的 `PhoneVerification`） |
| body | `phoneNumber.mobile` | `string` | 是 | 用户填的手机号，已 trim |
| body | `phoneNumber.smsCodeId` | `string` | 是 | 发短信时服务端返回的会话 id |
| body | `phoneNumber.smsValidCode` | `string` | 是 | 用户填的短信验证码，服务端与 `smsCodeId` 一起校验 |

前端只校验格式（11 位手机号、4~6 位数字），真正的比对在服务端 —— 前端没有任何接口能验证它，
所以这三个字段必须原样收下。与 caa 同接口的信封（`{ formData, phoneNumber }`）完全一致。

**验证失败与接口失败都留在手机验证弹框里**（弹框不关、错误写在弹框里、可改验证码原地重试）：
手机号没验过就不该出方案，所以这个接口**没有**「失败就按本地规则生成一份方案」的兜底 ——
这一条是随手机验证一起改的，见第四节的失败行为。

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
| `recordId` | `string` | ✅ | 本地存档 `1b_copreg_plan_record` | **委托单号**：服务端在生成方案时就建好了单，第 3 步下单（支付接口的 `busUnionId`）与查单都用它。**必给** —— 缺失时这次请求按失败处理（提示「生成需求方案未返回委托单号」），因为没它下不了单 |
| `status` | `string` | ❌ 不取 | —— | 服务端自报的状态（线上形如 `SUCCESS`）。前端不读：内容与单号都在，就是一份可用方案；真失败时 `hasPlanContent` 与 `recordId` 两条已经拦住了 |
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

## 三、确认并前往支付 `POST /api/company-plan/confirm-proposal`（已废弃）

**2026-09 起前端不再调用这个接口**，服务端可以下线它。

原来它承担两件事：① 把第 1 步的两份存档（问卷 + 套餐/加购、诊断结果）交给服务端留档；
② 服务端据此建委托单并返回 `recordId`。现在**建单挪到了诊断接口**（第二节的响应字段
`recordId`）—— 生成方案那一次就把单建好，方案页只负责展示，点「前往支付」直接拿这个单号
下单。于是：

- 第 2 步（方案页）**没有任何接口调用**，也不再需要手机号（第 1 步已验）、不需要行为验证码；
- 前端删掉了整个确认请求链路（`serviceConfirm.ts`、`VITE_CONFIRM_PROPOSAL_PATH`、
  `1b_copreg_plan_confirm` 键与「凭据是否与当前套餐一致」的过期判断）；
- 单号存在 `1b_copreg_plan_record`，**改套餐 / 换自选项都不作废它**：那些只影响前端报价，
  服务端按单号复核价格。

若以后要恢复，历史请求体是 `{ formData, proposalResult }`（两个 `JsonNode`，都 `@NotNull`）：
`formData` 是本地存档 `1b_copreg_plan_form` 那份形状（`{ survey, tier, addons }`，
`addons` 为 `{ id, name, price }` 对象数组），`proposalResult` 是第二节 2.3 那个响应
（前端取的 10 项）。

---

## 四、接口的公共约定

| 项 | 约定 |
|---|---|
| 超时 | 两个接口都是 60s（`apiClient.ts` 的默认值），大模型生成长文本比普通接口慢。验证码弹窗等待不计入 |
| 请求头 | `Content-Type: application/json` |
| 响应体 | 必须是 JSON 对象；不是 JSON / 是数组 / 是 `null` 一律按「返回格式异常」处理 |
| 「有响应但没内容」 | 架构诊断额外判一条：200 且 JSON 合法、但 2.3 里要取的那些字段一个都没给，按失败处理，走同一条提示通道 —— 否则用户会看到一份本地模板方案却以为它是服务端给的 |
| 错误文案 | 非 2xx 时优先用响应体里的文字（以 `<` 开头认为是网关 HTML，改用兜底文案）；超时「{接口名}超时，请稍后重试」；网络不通「网络异常，请检查网络后重试」；解析失败「{接口名}返回格式异常，请稍后重试」 |
| 类型收口 | `tsconfig` 没开 `strict`，所有响应字段在 `apiClient.ts` 里显式校验：字符串数组过滤掉非字符串与空串并去重，单字符串字段非字符串或空串即视为「没给」（`recordId` 例外：它是必给项，给不出就算这次失败） |

失败时的界面行为：

- **AI 智能填充**：把错误文案弹 toast；用户自己关掉验证码弹窗则静默返回（不算失败），
  不做本地兜底 —— 没拿到建议就不改问卷。
- **生成需求方案**：必填项过关后弹手机验证弹框（`PhoneVerifyModal`，「获取验证码」自己过腾讯行为验证码）。
  用户直接关掉弹框（或取消）＝**整件事没发生过**：一个请求都不发、问卷与方案存档不动、
  页面原地留在第 1 步，静默不报错。验证通过后带着手机号调诊断接口，
  **接口失败一样拦人**：弹框不关、原因写在弹框里、按钮恢复可点，改验证码原地重试
  —— 手机号没验过就不该出方案（这里没有「用本地规则生成一份」的兜底，见 2.1）。
  请求期间弹框整体置灰、「生成需求方案」按钮也置灰显示「生成方案中…」，避免连点发两次请求；
  「AI 智能填充」与「生成需求方案」互斥（在途时都置灰），免得 AI 结果落进一个已经离开的问卷页。
- **第 2 步（方案页）**：**不调任何接口**。切套餐 / 勾加购只是前端重算报价
  （`quoteFor`）并把结果刷进本地存档；点「前往支付」就是往后走一步，用的是第 1 步给的委托单号。
  所以在第 2 步不可能出现「接口失败要拦人」这种情况 —— 会拦住人的只有第 1 步
  （手机验证 / 诊断失败）与第 3 步（缺单号时下不了单）。

---

## 五、第 1 步的本地存档（`src/copreg/planDraft.ts`）

「填写的」和「返回的」**分开存**，写作时机也不同：

| 键 | 内容 | 什么时候写 |
|---|---|---|
| `1b_copreg_plan_form` | 「填写的」：`{ survey, tier, addons }` | **调诊断接口之前**写一次（接口超时 / 不通 / 用户在等待时关掉页面，问卷都还能捞回来）；方案页切套餐 / 勾加购时再刷新一次档位 |
| `1b_copreg_plan_report` | 「返回的」：2.3 里前端取的那 10 项诊断结果 | **只在接口成功后**写。提交新问卷时先 `clearPlanReport`，成功后写新的 —— 旧的结论对应的是旧问卷 |
| `1b_copreg_plan_record` | 「委托单凭据」：`{ recordId }`（诊断接口同一次响应里给的） | **只在诊断接口成功、且拿到了 `recordId` 之后**写。提交新问卷 / 重置问卷时 `clearPlanRecord`；改套餐不作废 |

```json
// 1b_copreg_plan_form —— 填写的输入，方案由它现算
{ "survey": { "…": "SurveyData 的 16 个字段，就是 2.2 那张表" },
  "tier": "standard",
  "addons": [ { "id": "addon-bank", "name": "银行对公账户开通", "price": 200 } ] }

// 1b_copreg_plan_record —— 有它下次进来直接落在第 3 步
{ "recordId": "D8DrdkCZoNvQhEzdQD5vTN" }
```

下次打开：**有「返回的」才落到第 2 步**（问卷答案、选过的套餐、服务端诊断都在），
有「委托单凭据」再往前一步落到第 3 步。
只有「填写的」时留在第 1 步 —— 方案是诊断接口给的，没拿到结果就不进方案页
（本地规则那版不算方案），问卷答案照旧填在表单里，重新点「生成需求方案」即可。

- **委托单号决定停在第三步还是第二步**：`loadPlanDraft()` 一次把三份键读齐，App 首帧看
  `record` 决定 `currentStep` 与 `unlockedSteps`（有单号 = `payment` 且解锁到支付）。
  它必须和「填写的」配套：没有 form 就没有方案，光有单号不会把人送进支付页。
- **单号不作废于改套餐**：单号是第 1 步生成方案时服务端建的，改档位 / 自选项只改前端报价，
  服务端按单号自己复核价格；`parsePlanRecord` 只认 `{ recordId: 非空字符串 }`，其余当没有。
- **落点自检**：`npm run check:entry` 用**真实组件树**在 Node 里渲染首屏（走 Vite 的 SSR 构建，
  因为 App 依赖 `import.meta.env` 与 JSX），覆盖有单号 / 只有诊断结果 / 只有问卷 / 什么都没有
  这几种组合分别落在第 3 / 第 2 / 第 1 步。这是唯一覆盖「存档 → 首屏落点」这条链的自检。
- **存档形状**：`addons` 是 `{ id, name, price }` 对象数组，不是 id 字符串数组 ——
  由 `proposalQuote.addonsOf` 从方案页那份报价明细派生，存下来的就是页面上显示的那批、
  同一个价格（派生与迁移的自检见 `scripts/check-plan-archive.ts`）。报价明细只存在于内存，
  `quoteFor` 重算用的输入仍是 `addons` 里的 id。
- **旧存档（字符串数组）仍能读回**：`normalizeAddons` 两种形状都认，字符串 id 会按
  `OPTIONAL_ADDON_SERVICES` 目录补上名称与价格，认不出的 id 与重复项丢掉。
- **存输入不存算出来的方案**：进入页面时用 `buildPlan(survey, quoteFor(tier, addons 的 id))` 现算、
  再 `applyPlanSuggestion(report)`，所以报价改版后回来看到的是新价，而不是上次存的旧数字。
- **「返回的」不存失败的那次**：诊断失败时（现在连方案页都进不去）更不该存，
  所以只有成功的那次才写 report；单号同理，只有拿到才写。
- **不存手机号与订单**：手机号按约定不落本地；订单 / 支付是服务端说了算的状态，前端恢复它
  只会造出一个「看着像已支付」的假象。所以支付、服务群、办理进度这几步不在存档范围 ——
  「委托单凭据」只说明**建过单**，不代表已支付。
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
3. **验证与建单都在诊断接口**（2026-09）：诊断接口带 `phoneNumber`（第 1 步手机验证弹框给出）
   并在同一次响应里返回委托单号 `recordId` —— 与 caa「诊断前先短信验证」的顺序一致。
   前端这一侧的弹框在 `SurveyStep`（`PhoneVerifyModal`）；确认接口整个不再调用（见第三节），
   所以第 2 步没有任何接口调用、也没有任何验证框。
4. **host 待接口方确认**：两个接口同属企业方案服务，host 默认值取自 caa 项目生产配置
   （`https://caa001.ibanbu.com`），1b 侧尚无自己的方案服务配置 —— 按 `ponytail:` 标注在
   `src/config/api.ts`，可用 `VITE_COMPANY_PLAN_HOST` 覆盖。
5. **套餐内含的服务项前端不上报**：`formData.addons` 只报「自选增值服务」，套餐里含的
   「全年财务代记账服务」「公安备案印章」等行项目由服务端按 `tier` 自己映射（前端不再另发
   服务清单）。若后端希望连套餐内含项也一起收，再加一项字段即可。
6. **刷新后能不能停在「已支付」界面，靠服务端查单**：有委托单号就落在第 3 步；地址栏是 `#paid`
   时前端会拿委托单号调支付模块的查单接口核实（见 [copreg-steps.md](copreg-steps.md)），
   查单说 SUCCESS 才显示支付成功界面，否则收口回 `#payment`。**当前两个支付路径还是空的**
   （`WECHAT_NATIVE_CREATE_PATH` / `WECHAT_NATIVE_QUERY_PATH`），所以 `#paid` 一律收口 ——
   路径一填好就通。前端不会把「已支付」落本地来假装续上，那会造出「看着像已支付」的假象。
7. **`model` 仍未取**：服务端自报的模型名（如 `deepseek-flash`），前端没有展示位。
   要在方案页标一句「本方案由 ⋯ 生成」的话，在这里加一项、`applyPlanSuggestion` 里接上即可。
