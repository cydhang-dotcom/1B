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
| `submissionPhone` | 第 1 步手机验证通过的那个经办手机号（只存在 App 内存里，本地不落；刷新后由支付查单返回的 `mobile` 补回来，拿得到才带上） |
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

本步骤的卡片（7 个面板 + 股东出资 / 主要人员 / 委托书办理三章）与 `#survey` 用**同一套高亮口径**：
**只有「这一块没有待完善项」时才亮** —— 左侧青绿渐变竖条 + 右上柔光 + 青绿描边与浅色底；
**没验证通过的卡片保持普通白底，不许是绿的**（用户 2026-10-08 明确要求）。
样式与类名抽在 `src/copreg/components/SectionDecor.tsx`（`sectionCardClass(done)` + `<SectionDecor />`），
两个页面共用；每张卡片带 `data-fill-panel` / `data-card-done` 便于自检与截图核对。

| 字段 | 类型 / 控件 | 必填与否 | 注释 |
|---|---|---|---|
| `org` | 单选卡 | 必填 | `有限责任公司` / `股份有限公司` / `合伙企业` / `其他` |
| `orgOther` | 文本 | `org === '其他'` 时必填 | 具体组织形式 |
| `names` | 文本列表 | 至少 1 个非空；第 4 个起不能留空 | **只填字号（关键词）**，按优先级排序，开箱 3 个栏位、上限 9 个 —— 例：要注册「上海班步企程服务有限公司」只填「班步企程」，行政区划与组织形式由系统按所选组织形式补全（面板说明与首个输入框的示例占位都这么写，见 `registration/nameHints.ts`） |
| `capital` | 数字文本 | 必填，须为 > 0 的整数 | 注册资本（万元人民币）。预填的可能是**方案建议值**（问卷选了「需要注册资本专家建议」时）；**用户一旦自己改这一格，就等于他自己定了金额** —— 顺手撤掉 `expert` 标记（`registration/capitalHints.ts`） |
| `intro` / `service` | 文本（只读展示） | —— | 企业简介与主营服务，**来自第 1 步问卷**（`companyDesc` / `bizDesc`），页面上标注「仅供展示」；问卷没填就显示「尚未填写」 |
| `scope` | 多行文本 | 必填 | 经营范围，按市监规范表述 |
| `expert` | 开关 | —— | 金额由服务人员提供建议（来源是问卷 `capitalRec === '是'`）。**只在用户没动过这一格时保持 true**；05 确认提交那一章的显示规则见 §三末尾 |
| `regAddress` | 文本 | 未勾选 `regRecommend` 时必填 | 法定注册详细地址 |
| `regRecommend` | 开关 | —— | 注册地址由服务商提供 |
| `regAddressNature` | 单选 | 未勾选 `regRecommend` 时必填 | 租赁用房 / 自有房产 / 无偿使用证明（2026-10-08 下架了「集中办公·众创空间」「园区孵化器」两档，老存档选中它们会清空让用户重选，见 §1.1.1） |
| `regFiles` | 附件 | 未勾选 `regRecommend` 时至少 1 份 | 法定注册场地证明材料 |
| `workAddress` | 文本 | 未勾选 `workRecommend` 时必填 | 实际经营办公地址 |
| `workRecommend` | 开关 | —— | 经营地址由服务商提供 |
| `workAddressNature` | 单选 | 未勾选 `workRecommend` 时必填 | **与 `regAddressNature` 同一套**（2026-10-08 起）：租赁用房 / 自有房产 / 无偿使用证明；老存档旧值（商业租赁 / 自有产权）加载时同义平移，其余已下架的档清空让用户重选 |
| `workFiles` | 附件 | 未勾选 `workRecommend` 时至少 1 份 | 实际经营场地证明材料 |
| `board` | 单选 | —— | 设董事会 / 不设董事会 |
| `directors` | 数字文本 | 设董事会时必填，且不少于 3 人 | 董事会人数 |
| `singleDirector` | 单选 | 不设董事会时使用 | 设 1 名董事 / 由总经理代行职务（不设董事） |
| `singleSupervisor` | 单选 | —— | 设 1 名监事 / 不设监事 |
| `unanimous` | 勾选 | `singleSupervisor === '不设监事'` 时必须为真 | 全体股东一致同意不设监事 |

董事与监事的设置会反过来决定「主要人员」章节里必须指定哪些角色，见 1.3。

#### 1.1.1 两个地址输入框的提示词随「地址性质」变化

`regAddress` / `workAddress` 两个输入框的**占位提示、缺填报错、以及「需上传材料」清单都按已选性质换词**，
文案集中在 `src/copreg/registration/addressNatureHints.ts`（纯逻辑，界面与校验共用同一份文案）。

**两个地址用的是同一套性质**（2026-10-08 用户要求「2 个地址性质改为相同的，以法定注册地址为准」），
且当天又按用户要求**只剩三项**（`集中办公/众创空间` 与 `园区孵化器` 两档下架）：

| 性质（类型） | 地址怎么填（= 输入框占位；没填时下面那行红字是缺填报错） | 需上传材料 |
|---|---|---|
| 1 · 租赁用房 | 按房产证或租赁合同上的地址填写。 | 房屋租赁合同（需在有效期内）／房东的房产证复印件（需房东签字或盖章）／（部分区域要求）房东身份证复印件 |
| 2 · 自有房产 | 按房产证上的地址填写。 | 房产证复印件（需产权人签字或盖章）／（如产权人为股东）股东身份证明 |
| 3 · 无偿使用证明 | **红字重点**：报错逐字是「必须填写与《无偿使用证明》完全一致的房产地址（包含门牌号及房号）」（这一档**不留退路**）；占位是短句「请输入与《无偿使用证明》完全一致的房产地址（含门牌号及房号）」 | 关联方出具的《无偿使用证明》（需盖章/签字）／无偿提供方的房产证复印件 |

- 同一档下**两个地址的占位逐字相同**（用户给的那三句），只有缺填报错各说自己的场景
  （「法定注册详细地址」/「经营办公地址」）。
- 「需上传材料（<性质>）」那一块排在证明材料上传框上面；只有无偿使用证明那一档是红字重点
  （占位标红，`AddressHint.emphasis`）。
- **输入框下面只留一行**（2026-10-08 用户要求：小字说明和红字报错叠在一起、说的还是同一件事，不好看）：
  没报错时下面什么都没有（口径看占位），有报错时只有那一行红字。
- 性质值认不出时回落通用文案（材料清单回落成空数组 → 界面显示原来的通用举例）；
  性质值两端空白会被 trim 后再匹配。
- **老存档的性质会平移**（`normalizeAddressNature()`，在 `normalizeRegistrationForm` 里对**两个地址**都跑）：
  商业租赁 → 租赁用房、自有产权 → 自有房产；**已下架的档（联合办公·众创工位 / 集中办公·众创空间 /
  园区孵化器 / 居家办公申报）一律清空让用户重选** —— 性质决定要传哪些场地材料，不能替他猜。
- 「同法定注册地址」复制按钮（在实际经营办公详细地址标签右侧，两个地址都不勾选服务商提供、
  且法定注册地址已填时才出现）现在**三样一起搬**：地址输入框、地址性质（两边同一套 → 原样切过去，
  `workNatureForCopiedRegNature()` 认不出时返回 `null`，那就不动性质）、以及**场地证明材料**
  —— 材料**保留原来的 `fileUuid`**（服务端已经收过这份文件，不必重传），只换本地行 id 免得两份清单
  共用同一个 id；注册地址那份材料为空时只搬前两样。提示语相应分开：
  「已复制法定注册地址，并同步地址性质与场地证明材料」/「已复制法定注册地址并同步地址性质」。
- 界面上的性质选项表（`ADDRESS_NATURES`，`REG_ADDRESS_NATURES` / `WORK_ADDRESS_NATURES` 都指向它）
  从该模块取；截图存证脚本 `.mcp-work/shot-address-hints.mjs` 两张图（两张里两栏的性质按钮应当完全一样）。

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
| `trusteeName` | 文本 | **由接口带入、界面上没有输入框**（2026-10-08 起）：打开填报页时读一次经办人接口并把值写进这里；字段本身保留（委托书正文、打印件与下载件、05 确认提交那一章都用它）。也不再默认取「联系人」那个人 —— 受托人要与「一窗通」公章经办人一致，未必是联系人 |
| `trusteeIdNumber` | 文本 | 同上，由接口带入（写入时按手填老口径清洗成「数字 + 结尾 X」、统一大写）。接口这次没给的那一项保留原值，不会把已有的好数据抹空 |
| `entrustDate` | 日期 | 委托日期 |
| `files` | 附件 | 已签字盖章的委托书扫描件，提交前至少 1 份 |

**经办人信息接口（`registration/jingbanren.ts`）**：

```
GET {DOC_HOST}/xcx/yqt-co/subscribe/handler?busUnionId={委托单号}
→ { handName, handIdNumber }
```

（2026-10-08 服务端口径：路径 `subscribe/handler`、参数 `busUnionId`、返回 `handName / handIdNumber`；
解析仍然不猜死结构 —— 平铺认，套一层 `data` / `result` / `obj`（含 JSON 字符串）也认。）

- 触发时机：**每打开一次填报页读一次**（`RegistrationDetailsStep` 挂载时；刷新也算一次）。
  走 `onceGate` 单飞闸门 —— dev 的 StrictMode 会挂载两次，没有闸门就是两次 GET；
  读失败时页面上给一颗「重新获取」（会先 `reset` 闸门再读，所以是真重读）。
- 拿不到就只提示、**不写脏数据**：读失败或返回空时，草稿里原来填过的值原样保留；
  确实一直是空的，提示用户联系企服专员。
- 端点与超时：`config/api.ts` 的 `JINGBANREN_PATH`（可用 `VITE_JINGBANREN_PATH` 覆盖），15 秒超时。

**打印版式（`registration/authorizationDoc.ts`）**：「直接打印」与「下载模板」印的是同一份 HTML，
`@page { size:A4; margin:0 }` + `.page{ width:210mm; min-height:285mm; padding:22mm 22mm 15mm }`。
高度**刻意小于 A4**（285mm）而不是正好 297mm：正好一页时，打印勾了「页眉和页脚」或多出几毫米，
内容就会被挤到第二页（白印一张）。底部留白也从 25mm 收到 15mm（签名与日期块靠 `margin-top:auto`
贴住这个底边，于是整体往上移）。自检：`scripts/check-authorization-doc.ts`（版式文本断言）+
`.mcp-work/verify-authorization-print.mjs`（真打成 PDF 数页数：1 页、页面 ≤290mm、底部留白 ≥10mm）。

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
  `RegistrationFullForm` 一起存，`savedAt` 记录保存时间。页面初始化时先读这份存档；
  读不到就按第〇节从前面步骤转换一份（不再有示例表单）。
  **附件只存 `fileUuid`**（不存 dataURL，见下面「附件」小节），所以存档很小。
- **读取旧存档**：`RegistrationDetailsStep` 初始化时会对缺字段做兜底（`board` / `singleDirector` /
  `unanimous` / `regAddressNature` / `workAddressNature`），旧结构不会让页面白屏；
  附件再走一遍 `sanitizeFormAttachments` —— **没有 `fileUuid` 的一律丢掉**（旧版本存的是
  dataURL，服务端并不知道那些文件，留着只会渲染出裂图、提交上空附件）。

### 附件：选完文件直接上传

- **时机**：选完文件的当下就调上传接口（`useAttachmentUpload` 的 `upload()`，三处选文件的地方
  都走它：场地证明 / 证件照与营业执照 / 委托书）。上传中那些入口置灰，成功后表单里只多一行
  `{ id, fileUuid, fileName, size, type, slot }`；**失败只提示原因、不加行**（半截的附件比没有更糟）。
- **接口**：`POST {API 站点根}/zuul/v1/xcx/yqt-co/subscribe/upload/file`（dev：`http://testv3001.yowits.net/zuul/v1/…`），
  `multipart/form-data`、字段名 `file`，返回 `{ fileUuid, fileName }`（`src/utils/fileUpload.ts`
  负责请求与错误文案）。**上传走 zuul 网关**（与普通接口的 `/v1` 是两个前缀，老项目的
  `axios.defaults.uploadConfig.baseURL` 也是 `{站点根}/zuul/v1`），而**取图走 DOC_HOST**
  （`{DOC_HOST}/doc/uuid/{fileUuid}/get`）—— 两者不是同一个 host。
  某个环境地址不同时用 `.env` 的 `VITE_FILE_UPLOAD_HOST` / `VITE_FILE_UPLOAD_PATH` 覆盖。
- **图片 / 附件地址**：全局工具函数 **`fileUrlOf(fileUuid)`**（`src/utils/fileUrl.ts`）现拼
  `{DOC_HOST}/doc/uuid/{fileUuid}/get`；空 id 返回空串。表单里不存地址（会过期），也不存文件内容。
- 预览弹窗（`FilePreviewModal`）图片走这个地址；PDF / 其它格式给「在新窗口打开」链接。
### 关联冲突校验（`src/copreg/registration/conflicts.ts`）

`validate()` 只管「这一项填了没有、格式对不对」；**几项之间自相矛盾**由 `conflictErrorsOf()` 管：
产出同样是 `ValidationErrorItem`，调用方（`RegistrationDetailsStep`）把它并进 `allErrors`，
于是它和普通校验完全同权 —— 章节顶部「本章节尚有 N 项需完善」会列出来、点提交会跳到第一个
出错章节、**不解决就提交不出去**。自检：`npx tsx scripts/check-conflicts.ts`（53 项）。

| 章节 | 冲突 | 例子 |
|---|---|---|
| 股东出资 | 出资比例合计 ≠ 100% | 「合计 90%，应为 100%（还差 10%）」 |
| 股东出资 | **出资额合计 ≠ 注册资本**（全部填了才算） | 「各股东认缴出资合计 90 万元，与基本信息里的注册资本 100 万元不一致（差 10 万元）」 |
| 股东出资 | 出资额**只填了一部分**（填就得填全，否则没法对账） | 「有 1 位股东没填认缴出资金额（共 2 位）：请补齐，或全部留空」 |
| 股东出资 | 单行：**比例 × 注册资本 ≠ 出资额** | 「股东 1：按出资比例 30% × 注册资本 100 万元 = 30 万元，与填写的 50 万元不一致」（挂到那一行） |
| 股东出资 | 自然人股东没关联人员（或关联到不存在的人） | 「必须关联一位已录入的人员（当前未关联，姓名与证件照都取不到）」 |
| 主要人员 | 法定代表人 / 财务负责人多于一位 | 「法定代表人由 2 位人员同时担任（张三、李四），只能有一位」 |
| 主要人员 | 设董事会 N 名董事 ↔ 实际指派「董事」的人数 | 「基本信息里设 3 名董事，但主要人员里指派了 1 位董事，请对齐」 |
| 主要人员 | 不设董事会（由总经理代行）却指派了董事 | 「两者矛盾」 |
| 主要人员 | 不设监事却指派了监事 / 设 1 名监事却不是 1 位 | 「两者矛盾」/「请对齐」 |
| 基本信息 | ~~企业名称含「股份」/「合伙」↔ 组织形式不符~~ | **2026-10-08 已去掉**：名称那一格只填**字号（关键词）**，组织形式后缀由系统补全，跨表对账没有依据 |
| 基本信息 | ~~组织形式选了股份 / 合伙，但名称里都没该字样~~ | **2026-10-08 已去掉**（用户要求）：只填字号之后这类报错必然是误伤 |
| 委托书 | 受托人姓名与身份证号**只读到一项** | 「委托书上两项都要有，请联系企服专员核对『一窗通』经办人信息」（两项现在由接口带入，用户自己也补不了） |
| 委托书 | 身份证号不是 18 位（17 位数字 + 数字或 X） | 带原值回显，同样提示联系企服专员核对 |
| 确认页 | 勾了「股东均为自然人」的免申报承诺，却有非自然人股东 | 「两者矛盾」并点名那几位股东 |

两条口径：

1. **只报「矛盾」，不报「没填」**。「不设董事会时必须有总经理」这类属于必填（`validate()` 的
   `requiredRoles` 已经管了），不在这里重复报。
2. **宁可不报，也不误报**。认缴出资额是选填：**一份都没填就不跟注册资本对账**，全填了才比合计；
   金额/比例的浮点尾巴留 0.01 的容差（33.33 + 33.33 + 33.34 不会误报）。

**看过但没做的**（连同理由，免得以后重复讨论）：

- 手机号重复 / 同名不同人：可疑但不构成矛盾，做了会误报（一人多号、同名常见）—— 想做的话
  更适合做「提示级」而不是拦提交；
- 注册资本 vs 问卷里填的金额 / 方案建议值：那句建议本来就是给用户覆盖的，不算冲突；
- 股东行数 vs 问卷里的「股东人数」：问卷只用来铺行，行数才是准的；
- 委托书受托人 vs 法定代表人：允许不是同一人（受托人要跟「一窗通」公章经办人一致）；
- 地址性质 vs 是否自有房产、`setup.*` 那套旧治理字段：前者语义上不矛盾，后者界面上已无入口。

- **校验**：`validate()` 在组件内，按章节返回 `ValidationErrorItem[]`（`s` = 章节下标，
  `record` 用于把错误挂回具体股东 / 人员记录）。点「确认并提交申请」时若还有错误，会跳到
  第一个出错章节并在顶部列出本章节的待完善项；导航圆圈只按校验结果标记完成，与提交动作无关。

## 三、保存与提交链路

**保存 / 提交接口**：`POST {DOC_HOST}/xcx/yqt-co/subscribe/open-info`（与微信支付、企微码同一个
host），请求体恰好三个字段（后端 DTO 原文，`savaType` 就是这个拼写）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `busUnionId` | `string` | 开户业务关联 id = **第 1 步生成方案时服务端给的委托单号**（`planRecord.recordId`）；App 以 `busUnionId` prop 传给填报页，缺了就地拦住不发请求 |
| `var2` | `string` | **本地存档那份 JSON 的字符串**（就是写进 `localStorage[STORAGE_KEY]` 的那份表单，含附件 `fileUuid`） |
| `savaType` | `string` | `0` = 临时保存（「保存草稿」）、`1` = 保存（「确认并提交申请」） |

响应体前端**不解析：2xx 即成功**（接口说明里没有响应字段，不猜 `code`/`status` 误判）；
非 2xx 用响应体文字当错误文案，超时 15s。请求与错误文案在
`src/copreg/registration/openInfo.ts`，自检 `scripts/check-open-info.ts`（30 项）。

**读回来**（服务人员查看）：这份 `var2` 落在服务端开户单的 `openAccApply.var2` 上，按开户单编号
`scbUuid` 读：`GET {DOC_HOST}/xcx/yqt-co/subscribe/{scbUuid}[?code=…]` → 只读页面
`copreg-view.html`。读回来的快照与本地草稿走**同一份收口**
（`registration/formSnapshot.ts` 的 `normalizeRegistrationForm`）。见
[copreg-service-view.md](copreg-service-view.md)。

两条链路：

1. **保存草稿**（`savaType: '0'`）：**先写本地**（服务端不通也不丢用户刚填的东西），再调接口做临时保存；
   服务端没存上会提示「…（本地草稿已保存，可继续填写）」，但不撤掉本地那份。
2. **确认并提交申请**（`savaType: '1'`）：
   1. 点「确认并提交申请」→ 逐项校验 + 关联冲突都过了就**直接提交**（不再弹演示短信验证弹框：
      验证码是页面上现编的，验证不了任何东西，只多一次点击）；
   2. **先调保存接口**，成功了才把 `status: 'submitted'`、`submittedAt`、`submissionPhone`
      写回表单并落盘 —— 手机号沿用申报表里已有的那份（第 1 步手机验证通过后由 seed 带进来的
      `submissionPhone`，拿不到回落到 App 的 `contactPhone`），这一步不再收手机号；
   3. 接口失败（未接通 / 没委托单号 / 超时 / 服务端报错）一律**拦在填报页**：toast 出原因、
      状态仍是草稿、可原地重试 —— 反过来的话服务端没有这份资料、页面却显示「已提交」，
      进度页会一直等一个不存在的初审；
      **已经提交过的申报表再点一次也会照样调接口**（同样是 `savaType: 1`，提示改成
      「已更新并重新提交」）：从「查看/修改申报资料」回来改完就该存回服务端，
      早先那种「已提交就直接跳走、一个请求都不发」的短路会让用户以为改动提交上去了；
   4. `onUpdateDetails(...)` 把申报结果回写成 `App.tsx` 的 `details: RegistrationDetails`
      （企业名称、备选名称、注册资本、法定代表人 / 财务负责人 / 监事、股东结构、收件地址）；
      申报表里没有的字段（身份证号）保留原值，不用示例常量兜底；
   5. `onSubmitForReview()` → `App.tsx` 把 `isDetailsSubmitted` 置真，**切回第 3 步的支付成功页
      （`#paid`）**：那一页的「服务进度状态与办理清单」当场变成「资料已提交 · 专员初审中」，
      并出现「查看/修改申报资料」入口。**刷新落点同样是它**（`#paid`，见 `docs/copreg-steps.md`）；
      第 6 步进度页仍然解锁、手敲 `#progress` 可达，只是不再是提交后的落点。

### 05 确认提交那一章怎么显示「注册资本」

`ReviewSection` 用 `registration/capitalHints.ts` 的 `capitalReviewTextOf`：

- **有数字就先显示数字**：`10 万元人民币`；若 `expert` 还是 true（用户没动过、这数字是方案建议值），
  后面附注 `（专家建议值，最终由顾问确定）`；
- 数字为空（正常被必填校验拦住）时，`expert` 为真写「专家推荐（由顾问出资建议方案确定）」、否则「未填写」。

为什么改成「有数字就显示」：`expert` 是**建表那一刻**从问卷抄来的快照，用户在基本信息里把金额改成 10
以后它并不会自己变 —— 旧版确认页只看这个标记、于是把用户填的数字整个吞掉（用户报过这个 bug）。
现在两处一起收口：改输入框顺手撤标记（治本），显示层也不再因为标记而丢数字（旧草稿也不会显示错）。

## 四、与其它步骤的联动

| 位置 | 读什么 | 说明 |
|---|---|---|
| `App.tsx` 的 `isDetailsSubmitted` | `localStorage[STORAGE_KEY].status === 'submitted'` | 刷新后仍记得已提交 |
| `AgreementAndPaymentStep` 的「服务进度状态与办理清单」 | 同上（prop 或本地兜底） | 第一项在提交后转为「已完成填报 · 专员初审中」，并出现「查看/修改申报资料」入口 |
| `ProgressAndReviewStep` | `details` | 企业名称 / 法定代表人 / 收件地址 / 股东结构；空值统一显示「待同步」，不编造 |
| `ServiceGroupStep` | —— | 「进入资料填报模块」按钮把用户送进本步骤 |
| `RegistrationDetailsStep` 的页头 / 底部操作条 | —— | **不显示全局顶栏、也没有回办理清单的入口**（2026-10-08 用户要求）：这一页是独立模块，平时从支付成功页**新开标签页**进来，回去的方式就是关掉这一页 / 切回原来那个标签页；同标签页兜底进来时可以「保存草稿」慢慢填，提交后会自己回到 `#paid`。底部操作条只剩「上一项 / 下一步 · 保存草稿 · 提交」 |

## 五、改哪里

| 想改什么 | 去哪里 |
|---|---|
| 章节标题、校验规则、提交链路、弹窗编排 | `src/copreg/components/RegistrationDetailsStep.tsx` |
| 基本信息字段与地址性质选项 | `src/copreg/registration/BasicInfoSection.tsx` |
| 地址性质的选项表与「按性质换提示词 / 报错 / 需上传材料」文案 | `src/copreg/registration/addressNatureHints.ts` |
| 卡片高亮条（问卷与第 5 步共用同一份 DOM） | `src/copreg/components/SectionDecor.tsx` |
| 注册资本那一格的口径（改了就撤「专家推荐」+ 确认页显示） | `src/copreg/registration/capitalHints.ts` |
| 经办人信息接口（`/subscribe/handler`） | `src/copreg/registration/jingbanren.ts` |
| 股东 / 人员记录弹窗（字段、附件位、角色互斥） | `src/copreg/registration/RecordModal.tsx` |
| 附件的上传（hook）与收口（纯函数） | `src/copreg/registration/useAttachmentUpload.ts`、`attachments.ts` |
| 上传请求与错误文案 / 附件地址拼法 | `src/utils/fileUpload.ts`、`src/utils/fileUrl.ts`、`src/utils/docUuidUrl.ts` |
| 委托书文档本体（HTML）/ 页面与按钮 | `src/copreg/registration/authorizationDoc.ts`、`AuthorizationSection.tsx` |
| 只打印一段文档（隐藏 iframe） | `src/utils/printDocument.ts` |
| 确认页展示与真实性确认 | `src/copreg/registration/ReviewSection.tsx` |
| 空白表单与 `STORAGE_KEY` | `src/copreg/registration/defaultData.ts` |
| 填报状态在支付页 / 进度页的呈现 | `src/copreg/components/AgreementAndPaymentStep.tsx`、`ProgressAndReviewStep.tsx`、`App.tsx` |
