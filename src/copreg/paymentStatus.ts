/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 支付状态查询：刷新或换个人打开 `#paid` 时，判断能不能真的落到「支付成功」界面
 * （见 stepRoute.ts 的 `#paid` 与 App.tsx 的首帧核实）。
 *
 * **走支付模块的查单接口**（`src/payment/client.ts` 的 `queryOrder`，即
 * `GET {DOC_HOST}/xcx/yqt-co/wx-pay/open-acc/query/pay?busUnionId=…`），不另起一套；
 * 状态判定复用 `mapOpenAccState`（只有 status='1' 算已支付）。
 *
 * 查询键用的就是委托单号（`1b_copreg_plan_record` 的 recordId，第 1 步生成方案时服务端给的）
 * —— 服务端的开户支付查单正是按它查的（参数名 busUnionId）。
 *
 * **三态，不是布尔**：
 *   'paid'    查单明确 SUCCESS → 才允许进「支付成功」界面
 *   'unpaid'  查单说还在待支付 / 已关闭 / 已退款 / 支付失败
 *   'unknown' 路径没配、请求失败、超时、响应认不出（如缺 tradeState）→ 一律按「不能直达」处理
 *
 * 两条底线：
 *
 * 1. **认不出的响应绝不当已支付**。宁可让用户多点一次「立即支付」（那本来就还能付），
 *    也不能凭一个没看懂的响应造出「看着像已支付」的界面。
 * 2. **失败不弹错、不拦人**。这是只读的预判，不是支付动作：查不动就当没付，用户停在
 *    待支付页，照常付款即可 —— 所以这里不抛异常，只回 'unknown'。
 */

import { createPayClient, type PayEndpoints } from '../payment/client';
import { mapOpenAccState, paidFieldsOf } from '../payment/model';

export type PaymentStatus = 'paid' | 'unpaid' | 'unknown';

/** 查询结果。orderNo 有就带回来（支付成功界面显示订单编号），没有不影响判断 */
export interface PaymentStatusResult {
  status: PaymentStatus;
  /** 服务端给了 outTradeNo 才有；没给就让界面留空，前端不自己编单号 */
  orderNo?: string;
  /** 查单返回的支付时间（服务端格式，原样展示） */
  paidAt?: string;
  /** 查单返回的经办手机号：重新进入页面时用它补上「经办联系电话」 */
  mobile?: string;
}

/** 只读预判，比下单短得多：8s 拿不到就当查不动，用户照常付款 */
export const PAYMENT_STATUS_TIMEOUT_MS = 8_000;

/**
 * 查一次支付状态。**不抛异常**：路径没配 / 超时 / 网络不通 / 响应认不出一律回 'unknown'，
 * 由调用方按「不能直达已支付」处理。
 *
 * 端点由调用方注入（就是支付模块那份 host + createPath + queryPath），因此本模块不 import
 * config/api.ts，tsx 下可以直接跑自检。
 */
export const fetchPaymentStatus = async (
  endpoints: PayEndpoints,
  orderNo: string,
  options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<PaymentStatusResult> => {
  if (!endpoints.queryPath || orderNo.trim() === '') return { status: 'unknown' };

  try {
    const client = createPayClient(endpoints, {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs ?? PAYMENT_STATUS_TIMEOUT_MS,
    });
    const result = await client.queryOrder(orderNo.trim());
    // 查单自身的错误码（含「响应里没有 tradeState」）也算认不出：不确定就不放行
    if (result.status === 'error') return { status: 'unknown' };

    // 服务端 status 只有 '1'（已支付）算数，'0' 与没见过的值都当未支付
    const phase = mapOpenAccState(result.snapshot);

    const fields = paidFieldsOf(result.snapshot);
    return {
      status: phase === 'paid' ? 'paid' : 'unpaid',
      orderNo: fields.orderNo,
      paidAt: fields.payTime,
      // 没支付时也可能有手机号（下单时填过），一并带回去补页面
      mobile: fields.mobile,
    };
  } catch {
    // 只读预判，失败不当错误：用户停在待支付页，点一下照样能付
    return { status: 'unknown' };
  }
};
