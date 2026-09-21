import { useCallback, useEffect, useRef, useState } from 'react';

import {
  PAY_HOST,
  WECHAT_NATIVE_CREATE_PATH,
  WECHAT_NATIVE_QUERY_PATH,
} from '../config/api';
import { createPayClient, missingEndpointPaths, type CreateOrderPayload, type PayClient } from './client';
import {
  MAX_CONSECUTIVE_FAILURES,
  isAbortError,
  isFatalQueryError,
  mapOpenAccState,
  paidFieldsOf,
  paidSnapshotOf,
  nextPollDelay,
  toPhaseForError,
  toUserMessage,
  type OpenAccPaySnapshot,
  type PayPhase,
  type PaymentOrder,
  type QrSource,
} from './model';

/**
 * 微信支付 Native 扫码的无头 hook。
 *
 * 只吐状态，不管样式、不管弹窗、不管按钮：调用方自己决定怎么渲染。
 *
 * 三条刻意的设计：
 *   1. 绝不在 mount 时自动下单。React 19 的 StrictMode 在 dev 下会跑
 *      effect → cleanup → effect，自动下单会真的产生两个订单。
 *      create() 只能由用户操作触发；服务端下单接口没有去重键，所以同一次点击只发一次请求
 *      全靠这里的状态机（creating 相位把按钮挡住）。
 *   2. 网络抖动不改 phase，只置 pollError。否则二维码会被卸载，
 *      用户正举着手机对着屏幕扫，码突然没了。
 *   3. paid 只认服务端。不看 URL 参数、不看 localStorage —— 任何本地信号都不作数。
 */

export type UseWechatNativePayResult = {
  phase: PayPhase;
  /** 当前订单；idle/creating/unconfigured 时为 null */
  order: PaymentOrder | null;
  /** 渲染二维码用的数据，直接喂给 PayQrCode */
  qr: QrSource | null;
  /** 就绪倒计时剩余毫秒；已过期或没有订单时为 0 */
  remainingMs: number;
  /** 不可重试的失败（含未配置）才给的建议文案 */
  error: string | null;
  /** 轮询期间的网络抖动；非 null 时只是提示，二维码照常显示 */
  pollError: { message: string; attempts: number } | null;
  /** 接口路径是否已配置。false 时 UI 应显示「未开通」且不给重试按钮 */
  configured: boolean;
  /** 缺哪个常量，仅开发期提示用 */
  missingPaths: string[];
  /** 查单确认已支付时带回的订单号 / 支付时间 / 经办手机号 */
  paidOrder: { orderNo?: string; payTime?: string; mobile?: string } | null;
  /** 下单并开始盯单；同一时刻只会有一个订单 */
  create: (payload: CreateOrderPayload) => Promise<void>;
  /** 重新下单。过期二维码不可复用，必须换新订单 */
  restart: (payload: CreateOrderPayload) => Promise<void>;
  /** 取消盯单并清空状态 */
  reset: () => void;
};

/** 只有这一层读 config/api.ts：它依赖 import.meta.env，是 Vite 专有的 */
const ENDPOINTS = {
  host: PAY_HOST,
  createPath: WECHAT_NATIVE_CREATE_PATH,
  queryPath: WECHAT_NATIVE_QUERY_PATH,
};

/**
 * 下单被拒后的补救：按业务关联 id 查一次订单状态。
 * 已支付返回快照；没付、查不动、或请求被取消都返回 null（调用方据此照常报下单那一刻的错误）。
 */
const queryPaidSnapshot = async (
  client: PayClient,
  busUnionId: string,
  signal?: AbortSignal,
): Promise<OpenAccPaySnapshot | null> => {
  try {
    return paidSnapshotOf(await client.queryOrder(busUnionId, signal));
  } catch {
    return null;
  }
};

export function useWechatNativePay(options: { autoQuery?: boolean } = {}): UseWechatNativePayResult {
  const missingPaths = missingEndpointPaths(ENDPOINTS);
  const configured = missingPaths.length === 0;
  const [phase, setPhase] = useState<PayPhase>(configured ? 'idle' : 'unconfigured');
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<UseWechatNativePayResult['pollError']>(null);
  const [now, setNow] = useState(() => Date.now());

  /** 客户端是纯函数产物，只为拿稳定引用，无需 memo */
  const clientRef = useRef(createPayClient(ENDPOINTS));
  const client = clientRef.current;

  /** 在途的下单请求，reset/重下单时取消 */
  const createRef = useRef<AbortController | null>(null);
  /** 回前台时立刻补一枪，绕开退避等待 */
  const wakeRef = useRef<(() => void) | null>(null);
  /** 查单要用的业务关联 id：下单时记下，轮询拿它去查（服务端按它查，不是按订单号） */
  const busUnionIdRef = useRef('');
  /** 查单在已支付时会带回订单号 / 支付时间，页面要显示，所以留一份 */
  const [paidOrder, setPaidOrder] = useState<{ orderNo?: string; payTime?: string; mobile?: string } | null>(null);

  const start = useCallback(
    async (payload: CreateOrderPayload) => {
      createRef.current?.abort();
      const controller = new AbortController();
      createRef.current = controller;

      setPhase('creating');
      setError(null);
      setPollError(null);
      setPaidOrder(null);
      busUnionIdRef.current = payload.busUnionId;

      /**
       * 下单被拒**不一定**是失败：更常见的是这笔单早就付过了（本地凭据丢了、换了浏览器、
       * 用户手删了 localStorage），服务端会回「当前订单已完成支付，或请联系客服。」
       * —— 这句话既可能出现在 200 + reasons[] 里，也可能直接是 **HTTP 400**。
       * 两条路都先补查一次状态：确实已支付就直接进「支付成功」，不把人卡在一句像失败的提示上。
       */
      const recoverIfAlreadyPaid = async (): Promise<boolean> => {
        const snapshot = await queryPaidSnapshot(client, payload.busUnionId, controller.signal);
        if (controller.signal.aborted) return true; // 已取消：什么都别写，交给清理逻辑
        if (!snapshot) return false;
        setPaidOrder(paidFieldsOf(snapshot));
        setPhase('paid');
        return true;
      };

      try {
        const result = await client.createOrder(payload, controller.signal);
        if (controller.signal.aborted) return;
        if (result.status === 'error') {
          if (await recoverIfAlreadyPaid()) return;
          setError(result.message);
          setPhase('error');
          return;
        }
        setOrder(result.order);
        setNow(Date.now());
        setPhase('awaiting');
      } catch (cause) {
        // 用户离开 / 重下单导致的取消：静默丢弃，不去打扰服务端
        if (controller.signal.aborted || isAbortError(cause)) return;
        // 同一个「已经付过了」在 400 时也走这里：补查一次再决定是自愈还是报错
        if (await recoverIfAlreadyPaid()) return;
        setError(toUserMessage(cause));
        setPhase(toPhaseForError(cause));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    createRef.current?.abort();
    createRef.current = null;
    wakeRef.current = null;
    setOrder(null);
    setError(null);
    setPollError(null);
    setPhase(configured ? 'idle' : 'unconfigured');
  }, [configured]);

  /* --------------------------------------------------------------- 倒计时 */

  useEffect(() => {
    if (phase !== 'awaiting' || !order) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase, order]);

  const remainingMs = order ? Math.max(0, order.expiresAt - now) : 0;

  /** 本地倒计时到点只是「观测」，真正的终态仍以服务端为准（见 mapTradeState） */
  useEffect(() => {
    if (phase === 'awaiting' && order && remainingMs <= 0) setPhase('expired');
  }, [phase, order, remainingMs]);

  /* ------------------------------------------------------------------ 轮询 */

  useEffect(() => {
    if (options.autoQuery === false) return;
    if (phase !== 'awaiting' || !order) return;

    const loop = new AbortController();
    /** 一个 controller 同时管睡眠与在途请求，cleanup 就一行 */
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        if (loop.signal.aborted) {
          resolve();
          return;
        }
        const finish = () => {
          clearTimeout(timer);
          wakeRef.current = null;
          loop.signal.removeEventListener('abort', finish);
          resolve();
        };
        const timer = setTimeout(finish, ms);
        wakeRef.current = finish;
        loop.signal.addEventListener('abort', finish, { once: true });
      });

    void (async () => {
      let attempt = 0;
      let failures = 0;

      while (!loop.signal.aborted) {
        await sleep(nextPollDelay(attempt, failures));
        if (loop.signal.aborted) return;

        try {
          const result = await client.queryOrder(busUnionIdRef.current || order.outTradeNo, loop.signal);
          if (loop.signal.aborted) return;
          if (result.status === 'error') throw new Error(result.message);

          failures = 0;
          attempt += 1;
          setPollError(null);

          const next = mapOpenAccState(result.snapshot);
          if (next === 'paid') {
            // 查单顺手带回单号 / 支付时间 / 经办手机号：支付成功界面要显示，别让用户看着空格
            setPaidOrder(paidFieldsOf(result.snapshot));
          }
          if (next !== 'awaiting') {
            setPhase(next);
            return;
          }
        } catch (cause) {
          // 卸载或重下单导致的 abort：不说、不计数、不写状态
          if (loop.signal.aborted || isAbortError(cause)) return;
          failures += 1;
          if (isFatalQueryError(cause) || failures >= MAX_CONSECUTIVE_FAILURES) {
            setError(toUserMessage(cause));
            setPhase(toPhaseForError(cause));
            return;
          }
          setPollError({ message: toUserMessage(cause), attempts: failures });
        }
      }
    })();

    return () => loop.abort();
  }, [phase, order, options.autoQuery]);

  /**
   * 用户扫完码会切到微信 App，回来时浏览器可能已把后台 timer 节流到分钟级。
   * 不补这一枪，UI 会几分钟不更新，用户以为没成功而重复支付。
   */
  useEffect(() => {
    if (phase !== 'awaiting') return;
    const onVisible = () => {
      if (!document.hidden) wakeRef.current?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase]);

  /* 卸载时取消下单与轮询 */
  useEffect(
    () => () => {
      createRef.current?.abort();
      wakeRef.current = null;
    },
    [],
  );

  return {
    phase,
    order,
    qr: order?.qr ?? null,
    /** 查单确认已支付时带回的订单号 / 支付时间（没查到时是 null） */
    paidOrder,
    remainingMs,
    error,
    pollError,
    configured,
    missingPaths,
    create: start,
    restart: start,
    reset,
  };
}
