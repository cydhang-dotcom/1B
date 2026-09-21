# copreg 第 5 步：企业注册申报资料填报

本文整理 `copreg.html` 内「企业注册申报资料填报与初审」这一步采集哪些字段、怎么校验、
草稿存在哪，以及提交后怎么回写到「办理进度」页。

| | |
|---|---|
| 页面入口 | `copreg.html` → 支付 → 专属服务群 → **填写企业注册申报资料** |
| 页面组件 | `src/copreg/components/RegistrationDetailsStep.tsx` |
| 章节组件 | `src/copreg/registration/`（BasicInfoSection / ShareholderSection / PersonnelSection / AuthorizationSection / ReviewSection + 4 个弹窗） |
| 数据模型 | `src/copreg/registration/types.ts` 的 `RegistrationFullForm` |
| 空白骨架与初始数据 | 骨架 `src/copreg/registration/defaultData.ts` 的 `createBlankForm()`；初始数据由 `src/copreg/registrationSeed.ts` 的 `registrationSeedFrom()` **从前面步骤转换**（不再有示例表单） |
| 页面状态持有者 | 全部在 `RegistrationDetailsStep` 内部（`useState`），不放 `App.tsx` |
| 草稿落点 | `localStorage`，键 `banbu-registration-20260913-v1`（`defaultData.ts` 的 `STORAGE_KEY`） |
| 提交后去向 | `App.tsx` 的 `handleSubmitForReview()` → 第 6 步「办理进度」 |

> 这一步最初是独立的 `registration.html`，现已并入 `copreg.html`，与「问卷 → 方案 → 支付 → 服务群 → 进度」
> 共用同一次会话状态，不再有跨页面的数据搬运层。

---

## 〇、初始数据从哪来（`src/copreg/registrationSeed.ts`）

没有草稿时，这一步的表单**由前面几步的数据转换而来**，不再预置示例数据：

| 申报表字段 | 来源 |
|---|---|
| `basic.intro` / `basic.service` / `basic.scope` | 第 1 步问卷的 `companyDesc` / `bizDesc` / `scope`（多条用「；」拼接） |
| `basic.capital` | 问卷 `capitalAmount`（用户自填时）；否则取第 2 步方案建议句里的**第一个数字** |
| `basic.expert` | 问卷 `capitalRec === '是'`（金额由服务人员定 → 专家建议） |
| `basic.names` | 第 2 步方案的 `companyNameProposal`（拆出主名与备选，最多 3 个） |
| `basic.org` | 方案 `companyType` 里能认出「股份有限公司 / 合伙」才改，否则「有限责任公司」 |
| `basic.regRecommend` / `workRecommend` | 问卷里「要不要推荐注册地址 / 办公场地」是否以「是」开头 |
| `shareholders` | 问卷的股东人数（「3 个及以上」按下限 3 行）× 股东类型（自然人 / 企业 / 其他），**只铺结构** |
| `submissionPhone` | 第 2/3 步确认时用过的经办手机号（本地不落，能拿到才带上） |
| 其余字段（姓名、证件号、股比、出资额、地址、附件、人员、角色、员工数、各类勾选） | **一律留空**，由用户在这一步自己填 |

三条硬规矩：

1. **拿不到就空着**，不编姓名、不编证件号、不编股比金额；
2. **需要本人确认的勾选**（信息属实、免于申报）不预先勾上；
3. **空值渲染不许回落到示例数据** —— 委托书模板、复核摘要这些地方曾经用写死的示例姓名 /
   证件号 / 手机号兜底，现改为下划线占位或破折号。

守门断言：`npx tsx scripts/check-no-fake-demo-data.ts` 扫全量源码，出现示例姓名 / 身份证号 /
手机号 / 企业描述 / 顾问工号即失败；转换规则本身由 `scripts/check-registration-seed.ts`（50 项）覆盖。

---

## 一、五个章节与字段

章节标题与序号在 `RegistrationDetailsStep.tsx` 的 `CHAPTERS`：基本信息 01 / 股东出资 02 /
主要人员 03 / 委托书办理 04 / 确认提交 05。

### 1.1 基本信息 —— `BasicInfoSection.tsx`

数据落在 `RegistrationFullForm.basic`（`BasicInfoData`）。

| 字段 | 类型 / 控件 | 必填与否 | 注释 |
|---|---|---|---|
| `org` | 单选卡 | 必填 | `有限责任公司` / `股份有限公司` / `合伙企业` / `其他` |
| `orgOther` | 文本 | `org === '其他'` 时必填 | 具体组织形式 |
| `names` | 文本列表 | 至少 1 个非空；第 4 个起不能留空 | 拟注册名称，按优先级排序，开箱 3 个栏位、上限 9 个 |
| `capital` | 数字文本 | 必填，须为 > 0 的整数 | 注册资本（万元人民币） |
| `intro` / `service` | 文本（只读展示） | —— | 企业简介与主营服务，**来自第 1 步问卷**（`companyDesc` / `bizDesc`），页面上标注「仅供展示」；问卷没填就显示「尚未填写」 |
| `scope` | 多行文本 | 必填 | 经营范围，按市监规范表述 |
| `expert` | 开关 | —— | 由服务人员提供资本建议 |
| `regAddress` | 文本 | 未勾选 `regRecommend` 时必填 | 法定注册详细地址 |
| `regRecommend` | 开关 | —— | 注册地址由服务商提供 |
| `regAddressNature` | 单选 | 未勾选 `regRecommend` 时必填 | 租赁用房 / 自有房产 / 集中办公·众创空间 / 园区孵化器 / 无偿使用证明 |
| `regFiles` | 附件 | 未勾选 `regRecommend` 时至少 1 份 | 法定注册场地证明材料 |
| `workAddress` | 文本 | 未勾选 `workRecommend` 时必填 | 实际经营办公地址 |
| `workRecommend` | 开关 | —— | 经营地址由服务商提供 |
| `workAddressNature` | 单选 | 未勾选 `workRecommend` 时必填 | 商业租赁 / 自有产权 / 联合办公·众创工位 / 居家办公申报 |
| `workFiles` | 附件 | 未勾选 `workRecommend` 时至少 1 份 | 实际经营场地证明材料 |
| `board` | 单选 | —— | 设董事会 / 不设董事会 |
| `directors` | 数字文本 | 设董事会时必填，且不少于 3 人 | 董事会人数 |
| `singleDirector` | 单选 | 不设董事会时使用 | 设 1 名董事 / 由总经理代行职务（不设董事） |
| `singleSupervisor` | 单选 | —— | 设 1 名监事 / 不设监事 |
| `unanimous` | 勾选 | `singleSupervisor === '不设监事'` 时必须为真 | 全体股东一致同意不设监事 |

董事与监事的设置会反过来决定「主要人员」章节里必须指定哪些角色，见 1.3。

### 1.2 股东及出资 —— `ShareholderSection.tsx` + `RecordModal.tsx`

股东是列表 `shareholders: ShareholderRecord[]`，自然人股东的基础信息存在按 id 去重的
`people: Record<string, PersonRecord>` 里。

| 记录 | 字段 | 必填与否 |
|---|---|---|
| 自然人股东 | 关联人员 `name` / `phone` / `address` | 必填 |
| | 关联人员 `email` / `education` | 选填 |
| | 身份证人像面 + 国徽面 | 必填（按 `files[].slot` 判定，`idFront` / `idBack`） |
| 企业股东 | `name`（企业全称）、`code`（统一社会信用代码） | 必填 |
| | 营业执照照片（`slot === 'license'`） | 必填 |
| 其他 | `name` 作为股东说明 | 必填 |
| 全部股东 | `ratio` 出资比例 | 必填，> 0 且 ≤ 100 |
| | `amount` 出资金额 | 选填，非负数字 |
| | `method` 出资形式 | 选填，多选：货币 / 实物 / 知识产权 / 土地使用权 / 劳务 / 其他 |

### 1.3 主要人员 —— `PersonnelSection.tsx` + `RecordModal.tsx`

`roles: RoleRecord[]`，每条记录指向 `people` 里的一位人员，可多选角色。

- 固定角色：法定代表人 / 财务负责人 / 联系人 / 总经理。
- `board === '设董事会'` 或 `singleDirector === '设 1 名董事'` 时追加**董事**；
- `singleSupervisor === '设 1 名监事'` 时追加**监事**。
- 必设角色：法定代表人、财务负责人、联系人；命中上面的条件时，董事 / 总经理 / 监事也进入必设清单。
- 监事不得兼任董事、法定代表人、总经理、财务负责人（《公司法》口径）。
- 每位人员都要有姓名、电话、居住地址与身份证正反面照片。

### 1.4 委托书办理 —— `AuthorizationSection.tsx`

| 字段 | 类型 | 注释 |
|---|---|---|
| `trusteeName` | 文本 | 受托人，默认取「联系人」角色的人员姓名 |
| `trusteeIdNumber` | 文本 | 本版不强制收集 |
| `entrustDate` | 日期 | 委托日期 |
| `files` | 附件 | 已签字盖章的委托书扫描件，提交前至少 1 份 |

### 1.5 确认提交 —— `ReviewSection.tsx`

| 字段 | 类型 | 注释 |
|---|---|---|
| `confirm.exemption` | 勾选 | 免申报受益所有人承诺，仅全体股东均为自然人时成立 |
| `confirm.beneficiary` | 文本 | 受益所有人信息 |
| `confirm.files` | 附件 | 相关证明材料 |
| `confirm.accurate` | 勾选 | 信息真实性确认，未勾选直接拦提交 |

---

## 二、草稿与校验

- **草稿**：手动「保存草稿」按钮与提交成功时都写 `localStorage[STORAGE_KEY]`，整份
  `RegistrationFullForm` 一起存（含附件 dataURL），`savedAt` 记录保存时间。页面初始化时
  先读这份存档；读不到就地生成一份示例表单，方便直接走通演示。
- **读取旧存档**：`RegistrationDetailsStep` 初始化时会对缺字段做兜底（`board` / `singleDirector` /
  `unanimous` / `regAddressNature` / `workAddressNature`），旧结构不会让页面白屏。
- **校验**：`validate()` 在组件内，按章节返回 `ValidationErrorItem[]`（`s` = 章节下标，
  `record` 用于把错误挂回具体股东 / 人员记录）。点「确认并提交申请」时若还有错误，会跳到
  第一个出错章节并在顶部列出本章节的待完善项；导航圆圈只按校验结果标记完成，与提交动作无关。

## 三、提交链路

1. 点「确认并提交申请」→ 无错误则弹出 `VerificationModal`（演示短信：验证码页面上直接给出）。
2. 验证通过后把 `status: 'submitted'`、`submittedAt`、`submissionPhone` 写回表单并落盘。
3. `onUpdateDetails(...)` 把申报结果回写成 `App.tsx` 的 `details: RegistrationDetails`
   （企业名称、备选名称、注册资本、法定代表人 / 财务负责人 / 监事、股东结构、收件地址）。
   申报表里没有的字段（身份证号）保留原值，不用示例常量兜底。
4. `onSubmitForReview()` → `App.tsx` 把 `isDetailsSubmitted` 置真并切到第 6 步「办理进度」。

## 四、与其它步骤的联动

| 位置 | 读什么 | 说明 |
|---|---|---|
| `App.tsx` 的 `isDetailsSubmitted` | `localStorage[STORAGE_KEY].status === 'submitted'` | 刷新后仍记得已提交 |
| `AgreementAndPaymentStep` 的「服务进度状态与办理清单」 | 同上（prop 或本地兜底） | 第一项在提交后转为「已完成填报 · 专员初审中」，并出现「查看/修改申报资料」入口 |
| `ProgressAndReviewStep` | `details` | 企业名称 / 法定代表人 / 收件地址 / 股东结构；空值统一显示「待同步」，不编造 |
| `ServiceGroupStep` | —— | 「进入资料填报模块」按钮把用户送进本步骤 |
| `RegistrationDetailsStep` 的「返回办理清单」「返回企微沟通群」 | —— | 回到第 4 步服务群 |

## 五、改哪里

| 想改什么 | 去哪里 |
|---|---|
| 章节标题、校验规则、提交链路、弹窗编排 | `src/copreg/components/RegistrationDetailsStep.tsx` |
| 基本信息字段与地址性质选项 | `src/copreg/registration/BasicInfoSection.tsx` |
| 股东 / 人员记录弹窗（字段、附件位、角色互斥） | `src/copreg/registration/RecordModal.tsx` |
| 委托书模板、打印与下载 | `src/copreg/registration/AuthorizationSection.tsx` |
| 确认页展示与真实性确认 | `src/copreg/registration/ReviewSection.tsx` |
| 空白表单、示例表单、`STORAGE_KEY` | `src/copreg/registration/defaultData.ts` |
| 填报状态在支付页 / 进度页的呈现 | `src/copreg/components/AgreementAndPaymentStep.tsx`、`ProgressAndReviewStep.tsx`、`App.tsx` |
