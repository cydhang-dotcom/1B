/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 订单状态核实的「单飞」闸门：同一个单据号只请求一次，在途时复用同一个 promise。
 *
 * 为什么需要它 —— 这是真机上调了半天才抓到的一个坑：
 * 核实是在 effect 里发起的，而 React 在 dev 的 StrictMode 下会「挂载 → 清理 → 再挂载」。
 * 第一轮请求的结果按「已取消」丢弃，如果那时就把「这个单据号查过了」记上，
 * 第二轮不会再查 —— 于是**明明服务端说已支付，界面却一直停在待支付**。
 * （生产构建没有 StrictMode，所以只在开发期现形；纯函数自检也跑不到 effect，只有真浏览器能看见。）
 *
 * 现在的语义：
 *   - 同一个单据号在途 → 返回同一个 promise（第二轮挂载复用它，1 次请求就够）；
 *   - 已在途/已出结果后不再发新请求（出结果即记上，失败也一样 —— 只读预判，不反复打服务端）；
 *   - 换了单据号（重新确认过方案）→ 允许再查一次。
 *
 * 请求本身由调用方注入，所以这里完全不碰 fetch / React，可以离线自检。
 */

/** 与 paymentStatus 的返回结构对齐，但不 import 它（避免把 React 那一层拉进来） */
export interface OrderStatusResult {
  status: 'paid' | 'unpaid' | 'unknown';
  orderNo?: string;
  paidAt?: string;
  mobile?: string;
}

export interface OrderStatusChecker {
  /**
   * 该不该为这个单据号发请求：
   * 返回 promise = 等它的结果（可能是复用的在途请求）；返回 null = 不用查（空号 / 查过 / 已有结果）
   */
  check(recordId: string): Promise<OrderStatusResult> | null;
}

export const createOrderStatusChecker = (
  fetchStatus: (recordId: string) => Promise<OrderStatusResult>
): OrderStatusChecker => {
  let inflight: { recordId: string; promise: Promise<OrderStatusResult> } | null = null;
  let settledFor: string | null = null;

  return {
    check(recordId: string): Promise<OrderStatusResult> | null {
      const id = recordId.trim();
      if (id === '') return null;
      if (settledFor === id) return null;
      if (inflight !== null && inflight.recordId === id) return inflight.promise;

      const promise = fetchStatus(id).then((result) => {
        // 出结果（哪怕是 unknown）就记上：这类核实是只读预判，不该反复打服务端
        settledFor = id;
        if (inflight !== null && inflight.recordId === id) inflight = null;
        return result;
      });

      inflight = { recordId: id, promise };
      return promise;
    },
  };
};
