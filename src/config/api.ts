export const API_HOST = import.meta.env.VITE_API_HOST;
export const DOC_HOST = import.meta.env.VITE_DOC_HOST;

/**
 * 微信支付 Native（PC 扫码）—— 下单（出码）与查单。
 *
 * 下单挂在**文档 / 业务服务 DOC_HOST** 下（与弹窗里取企微客服码同一个 host；注意 DOC_HOST
 * 自带 /v1，路径直接接在后面）：
 *   下单  POST  {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/pay
 *        请求体 { payAmount: number（元）, busUnionId: string（= 第 1 步生成方案时返回的 recordId）}
 *        ★ 金额是前端传的：服务端必须按 busUnionId 复核价格，否则改请求体就能少付钱
 *        ★ 没有去重键：一次点击只许发一次（前端状态机负责），失败也不自动重试
 *        响应  形如 { outTradeNo, codeUrl | qrImageUrl, expiresAt?, amount?, currency? }
 *              —— 二维码字段两种来源都支持（见 payment/model.ts 的 resolveQrSource）
 *
 * 查单  GET  {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay?busUnionId=<委托单号>
 *       —— 收银台轮询与「#paid」的直达判断都用它（同一个接口，同一个入参）
 *       响应 { scbUuid, orderNo, payTime, mobile, status, payAmount }，status: '1' 已支付 / '0' 未支付
 *       ★ 只认 status='1' 为已支付；缺 status 按「查不动」处理（不猜），
 *         不认识的 status 只 warn、继续当未支付（服务端会加状态）
 */
export const WECHAT_NATIVE_CREATE_PATH: string =
  import.meta.env.VITE_WECHAT_NATIVE_CREATE_PATH || '/xcx/yqt-co/wx-pay/open-acc/pay';
/** 查单（收银台轮询 + #paid 核实）。留空 = 还没接 */
export const WECHAT_NATIVE_QUERY_PATH: string =
  import.meta.env.VITE_WECHAT_NATIVE_QUERY_PATH || '/xcx/yqt-co/wx-pay/open-acc/query/pay';

/** 下单与查单的 host：两个接口都挂在文档 / 业务服务 DOC_HOST 下 */
export const PAY_HOST = DOC_HOST;

/** 两个路径都填了才算开通；只填一个同样是没开通（下单出码缺一不可） */
export const PAYMENT_CONFIGURED =
  Boolean(WECHAT_NATIVE_CREATE_PATH) && Boolean(WECHAT_NATIVE_QUERY_PATH);

if (import.meta.env.DEV && !PAYMENT_CONFIGURED) {
  console.warn(
    `[payment] 微信支付未接通：下单路径 ${WECHAT_NATIVE_CREATE_PATH ? '已配' : '缺失'}、查单路径 ${
      WECHAT_NATIVE_QUERY_PATH ? '已配' : '缺失'
    }`
  );
}

/**
 * 短信验证码 —— 腾讯行为验证码通过后调用，用于校验手机号。
 *
 * 与上面的支付接口不同，短信走的是独立服务，不在 VITE_API_HOST 下，所以这里单独配 host。
 * 申请   GET   {mobile, captchaAppId, userIp, jcaptchaCode, jcaptchaId, type}
 *              jcaptchaCode = 腾讯验证码 ticket，jcaptchaId = randstr
 *              期望响应 { smsCodeId?: string; message?: string; code?: string }
 *
 * ponytail: 以下三项取自 caa 项目同款接口（https://isp001.ibanbu.com/v1/sy/sms/send_sms），
 * 1b 侧尚无自己的短信服务配置。上线前需与接口方确认 host / 路径 / 业务场景号是否一致，
 * 不一致时用 .env 的 VITE_SMS_HOST、VITE_SMS_SEND_PATH、VITE_SMS_SCENE_TYPE 覆盖，无需改代码。
 */
export const SMS_HOST = import.meta.env.VITE_SMS_HOST || 'https://isp001.ibanbu.com';
export const SMS_SEND_PATH = import.meta.env.VITE_SMS_SEND_PATH || '/v1/sy/sms/send_sms';
/** 业务场景号，决定服务端下发哪套短信模板 */
export const SMS_SCENE_TYPE = import.meta.env.VITE_SMS_SCENE_TYPE || '20260311';

/**
 * 企业方案服务（/api/company-plan/*）—— 问卷页的两个 AI 接口都在这里：
 * 「AI 智能填充」（填经营范围 / 资质 / 敏感要素）与「生成需求方案」（出行业架构、税务身份、资本与地址建议）。
 *
 * 和短信一样是独立服务，不在 VITE_API_HOST 下（VITE_API_HOST 自己带 /v1，这个服务挂在 /api），
 * 所以单独配 host。两个接口的形态都与 caa 项目同源，只是数据变了。
 *
 * ── AI 智能填充 ──────────────────────────────────────────────────────────
 * 请求  POST  {host}/api/company-plan/ai-fill?captchaAppId=&userIp=&jcaptchaCode=&jcaptchaId=
 *      query 腾讯行为验证码票据：jcaptchaCode = ticket、jcaptchaId = randstr，
 *            由 src/utils/tencentCaptcha.ts 弹窗取得；没有 ticket 的请求会被直接拒绝
 *      body  { companyDesc: string; bizDesc: string }   ★ 两者都必填，后端标了 @NotBlank
 * 响应  { scope: string[]; license: string[]; sensitive: string[] }
 *      scope     按重要性排序的标准经营范围条目，无则为空数组
 *      license   行政许可 / 备案资质全称，不需要时为空数组
 *      sensitive 业务涉及的敏感领域标签，取值限定在表单固定选项内（见 plan.ts 的 SENSITIVE_OPTIONS）
 *      三个字段都是「无建议给空数组」，不是 null。
 *
 * ── 生成需求方案（架构诊断）────────────────────────────────────────────
 * 请求  POST  {host}/api/company-plan/diagnose-architecture
 *      body  { formData: <问卷字段，逐项见 planGenerate.ts 的 PlanFormData>,
 *              phoneNumber: { mobile, smsCodeId, smsValidCode } }
 *            phoneNumber 就是第 1 步手机验证弹框给出的那三样（见 verification.ts 的
 *            PhoneVerification）：服务端拿 smsCodeId + smsValidCode 比对短信验证码，
 *            比对不过这次请求就不算成功 —— **验证手机号是出方案的前置条件**，
 *            不再有「接口失败就用本地规则生成一份」的兜底。
 *            这里没有腾讯行为验证码：那一道在手机验证弹框的「获取验证码」上（发短信时用）
 * 响应  架构诊断结果（都是长文本 / 清单）：
 *      companyNameProposal    企业名称方案建议
 *      companyType            组织形式（含股东结构建议）
 *      taxpayerIdentity       纳税人身份规划
 *      taxReason              这么定的理由
 *      capitalAmount          注册资本建议（一句话，含金额）
 *      capitalAdvice          出资节奏与实缴安排建议
 *      registeredAddressAdvice 注册地址合规策略
 *      preQualifications      前置许可 / 备案清单（空数组 = 明确没有）
 *      postQualifications     后置许可 / 资质清单
 *      riskTips               合规风险提示
 *      model                  服务端自报的模型名（前端不展示，未取）
 *      recordId               委托单号（**必给**）：服务端在生成方案时就建好了单，
 *                             第 3 步下单（busUnionId）与查单都用它；缺了这次请求算失败，
 *                             前端提示「生成需求方案未返回委托单号」
 *      status                 服务端自报的状态（形如 SUCCESS）。前端不读：内容与单号都在，
 *                             就是一份可用方案；真失败时上面两条已经拦住了
 *      缺字段 / 传 null / 传空串 = 这一项没给，沿用本地方案（plan.ts 的 buildPlan）；
 *      传空数组 = 明确「没有」，就用空数组。前端取哪几项见 planGenerate.ts 的 PlanSuggestion。
 *
 * ── 确认并前往支付（confirm-proposal）—— **已不再调用**（2026-09）────────
 * 委托单号改成诊断接口同一次响应里返回（上面的 recordId），第 2 步因此变成纯展示页：
 * 它只把第 1 步的结果摆出来，点「前往支付」直接拿单号下单，前端不再有任何确认请求。
 * 服务端那个接口可以下线；要恢复时，历史请求体是 { formData, proposalResult }，
 * 形状见 docs/copreg-plan-api.md 第三节（已标注废弃）。
 *
 * ponytail: host 取自 caa 项目生产配置（https://caa001.ibanbu.com），1b 侧尚无自己的方案服务配置。
 * 上线前需与接口方确认 host 是否一致，不一致时用 .env 的 VITE_COMPANY_PLAN_HOST、
 * VITE_AI_FILL_PATH、VITE_PLAN_DIAGNOSE_PATH 覆盖，无需改代码。
 */
export const COMPANY_PLAN_HOST =
  import.meta.env.VITE_COMPANY_PLAN_HOST || 'https://caa001.ibanbu.com';
export const AI_FILL_PATH = import.meta.env.VITE_AI_FILL_PATH || '/api/company-plan/ai-fill';
export const PLAN_DIAGNOSE_PATH =
  import.meta.env.VITE_PLAN_DIAGNOSE_PATH || '/api/company-plan/diagnose-architecture';
/**
 * 第 5 步（#fill-details）申报资料的保存 / 提交：
 *   POST {DOC_HOST}/xcx/yqt-co/subscribe/open-info
 *   body { busUnionId, var2, savaType }（var2 是本地存档的 JSON 字符串；
 *   savaType 0 = 临时保存「保存草稿」，1 = 保存「确认并提交申请」）
 * 与微信支付、企微码同一个 host（/xcx/yqt-co/… 这一族都挂在 DOC_HOST 上）。
 * 见 src/copreg/registration/openInfo.ts。
 */
export const OPEN_INFO_PATH =
  import.meta.env.VITE_OPEN_INFO_PATH || '/xcx/yqt-co/subscribe/open-info';

/**
 * 申报资料附件上传（第 5 步 #fill-details：选完文件直接上传）。
 *
 * POST {站点根}/zuul/v1/xcx/yqt-co/subscribe/upload/file，multipart/form-data，字段名 file；
 * 成功后返回 { fileUuid, fileName }，之后图片 / 附件地址用全局工具 fileUrlOf(fileUuid) 现拼
 * （{DOC_HOST}/doc/uuid/{fileUuid}/get，与上传不是同一个 host）。见 src/utils/fileUpload.ts
 * 与 src/copreg/registration/useAttachmentUpload.ts。
 *
 * ★ **上传要加 zuul 前缀**（接口方给的地址是 `http://testv3001.yowits.net/zuul/v1/`）：
 *   老项目里上传也是走 `{站点根}/zuul/v1/…`（axios 的 uploadConfig.baseURL），与普通接口的
 *   `{站点根}/v1/…` 是两个前缀 —— 所以这里把 VITE_API_HOST 结尾的 `/v1` 换成 `/zuul/v1`
 *   作为站点根，路径再带上 zuul/v1。某个环境地址不同时用 .env 的
 *   VITE_FILE_UPLOAD_HOST / VITE_FILE_UPLOAD_PATH 覆盖即可，无需改代码。
 */
const API_SITE_ROOT = API_HOST.replace(/\/v1\/?$/, '');
export const FILE_UPLOAD_HOST = import.meta.env.VITE_FILE_UPLOAD_HOST || API_SITE_ROOT;
export const FILE_UPLOAD_PATH =
  import.meta.env.VITE_FILE_UPLOAD_PATH || '/zuul/v1/xcx/yqt-co/subscribe/upload/file';

/**
 * 腾讯云行为验证码 appId。appId 是前端公开值，真正的票据校验在服务端完成，可安全暴露。
 * userIp 供腾讯侧做风控，取的是网关出口 IP，caa 同款接口即固定传此值。
 */
export const TENCENT_CAPTCHA_APP_ID =
  import.meta.env.VITE_TENCENT_CAPTCHA_APP_ID || '2053902296';
export const TENCENT_CAPTCHA_USER_IP =
  import.meta.env.VITE_TENCENT_CAPTCHA_USER_IP || '139.196.23.161';
