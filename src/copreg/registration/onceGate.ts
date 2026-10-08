/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **单次闸门**：同一个 key 只真正执行一次任务，在途 / 已出结果都复用同一个 promise。
 *
 * 为什么需要它 —— 服务人员查看页踩到的真问题：那页的读接口凭据（`code`）是**一次性的**，
 * 用掉就失效；而 React 在 dev 的 StrictMode 下会「挂载 → 清理 → 再挂载」，effect 跑两遍。
 * 没有闸门时第二遍会真再打一次接口，服务端回「查询码无效或已过期」，页面就永远只能看到报错。
 *
 * 与 `src/copreg/orderStatusCheck.ts` 的单飞闸门同一套路（那边挡的是查单接口的重复请求），
 * 区别只有一点：**这里给出 `reset`** —— 失败之后「重新读取」要能真的再发一次
 * （网络抖一下没打到服务端时，同一枚码还是能用的）。
 *
 * 不碰 DOM / 不读 import.meta.env，`scripts/check-service-view.ts` 直接引它做离线自检。
 */

export interface OnceGate<T> {
  /**
   * 跑一次任务：同 key 已有记录（在途或已完成）就返回那一个 promise，不再执行 `task`。
   * **失败的 promise 也会被记住**（同 key 不会因为失败就自动重打）——要重来请显式 `reset`。
   */
  run(key: string, task: () => Promise<T>): Promise<T>;
  /** 抹掉某个 key 的记录，下次 `run` 会重新执行任务 */
  reset(key: string): void;
}

export const createOnceGate = <T,>(): OnceGate<T> => {
  const records = new Map<string, Promise<T>>();

  return {
    run(key: string, task: () => Promise<T>): Promise<T> {
      const cached = records.get(key);
      if (cached !== undefined) return cached;

      const promise = task();
      records.set(key, promise);
      return promise;
    },
    reset(key: string): void {
      records.delete(key);
    },
  };
};

/**
 * 查看页的 key：开户单编号 + 查看码。两者任一不同就是另一次查看（换了一枚码就该重新请求）。
 * 用不可见字符分隔，避免「uuid 里带 code 前缀」这类拼接歧义。
 */
export const serviceViewGateKey = (uuid: string, code: string): string => `${uuid}\u0000${code}`;
