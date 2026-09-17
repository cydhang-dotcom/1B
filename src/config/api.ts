export const API_HOST = import.meta.env.VITE_API_HOST;
export const DOC_HOST = import.meta.env.VITE_DOC_HOST;

/**
 * 企业服务确认（《企业服务委托单》第八节）的独立保存接口。
 * 该节单独调用接口保存，不并入企业侧主表单的提交载荷。
 * ponytail: 路径待接口方确认后填入（如 '/xcx/xhr-co/...'）；留空时不发起任何请求。
 */
export const SERVICE_CONFIRM_SAVE_PATH: string = '';

/**
 * 微信支付 Native（PC 扫码）—— 下单与查单。
 *
 * 只写路径，不含 host、不含 /v1：VITE_API_HOST 本身已经带 /v1（见 .env.*）。
 * 下单  POST  期望请求 { bizType: string; bizId: string; subject?: string;
 *                        idempotencyKey?: string; shareUserUuid?: string }
 *             ★ 绝不传金额：服务端按 bizType/bizId 自行定价，前端传来的金额一律忽略
 *            期望响应 { outTradeNo: string; codeUrl?: string; qrImageUrl?: string;
 *                       expiresAt?: number | string; amount?: number | string; currency?: string }
 * 查单  GET   期望请求 { outTradeNo }（query）
 *            期望响应 { outTradeNo: string; tradeState: string; amount?: number | string }
 *            tradeState: SUCCESS | NOTPAY | USERPAYING | CLOSED | REVOKED | PAYERROR | REFUND
 *
 * ponytail: 路径待接口方确认后填入（如 '/xcx/xhr-pay/native/create'）。
 * 留空时模块抛 PaymentNotConfiguredError 并让 UI 进入「未开通」态，不静默降级。
 */
export const WECHAT_NATIVE_CREATE_PATH: string = '';
export const WECHAT_NATIVE_QUERY_PATH: string = '';

/** 两个路径都填了才算开通；只填一个同样是没开通 */
export const PAYMENT_CONFIGURED =
  Boolean(WECHAT_NATIVE_CREATE_PATH) && Boolean(WECHAT_NATIVE_QUERY_PATH);

if (import.meta.env.DEV && !PAYMENT_CONFIGURED) {
  console.warn('[payment] 微信支付接口路径未配置，调用下单时会抛错');
}
