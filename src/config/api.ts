export const API_HOST = import.meta.env.VITE_API_HOST;
export const DOC_HOST = import.meta.env.VITE_DOC_HOST;

/**
 * 企业服务确认（《企业服务委托单》第八节）的独立保存接口。
 * 该节单独调用接口保存，不并入企业侧主表单的提交载荷。
 * ponytail: 路径待接口方确认后填入（如 '/xcx/xhr-co/...'）；留空时不发起任何请求。
 */
export const SERVICE_CONFIRM_SAVE_PATH: string = '';
