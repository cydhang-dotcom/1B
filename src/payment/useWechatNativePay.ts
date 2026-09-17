import { useCallback, useEffect, useRef, useState } from 'react';

import {
  API_HOST,
  WECHAT_NATIVE_CREATE_PATH,
  WECHAT_NATIVE_QUERY_PATH,
} from '../config/api';
import { createPayClient, missingEndpointPaths, type CreateOrderPayload } from './client';
import {
  MAX_CONSECUTIVE_FAILURES,
  isAbortError,
  isFatalQueryError,
  mapTradeState,
  nextPollDelay,
  toPhaseForError,
  toUserMessage,
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
 *      create() 只能由用户操作触发，并且带 idempotencyKey 让服务端兜底去重。
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
  /** 下单并开始盯单；同一时刻只会有一个订单 */
  create: (payload: CreateOrderPayload) => Promise<void>;
  /** 重新下单。过期二维码不可复用，必须换新订单 */
  restart: (payload: CreateOrderPayload) => Promise<void>;
  /** 取消盯单并清空状态 */
  reset: () => void;
};

/** 只有这一层读 config/api.ts：它依赖 import.meta.env，是 Vite 专有的 */
const ENDPOINTS = {
  host: API_HOST,
  createPath: WECHAT_NATIVE_CREATE_PATH,
  queryPath: WECHAT_NATIVE_QUERY_PATH,
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

  const start = useCallback(
    async (payload: CreateOrderPayload) => {
      createRef.current?.abort();
      const controller = new AbortController();
      createRef.current = controller;

      setPhase('creating');
      setError(null);
      setPollError(null);

      try {
        const result = await client.createOrder(payload, controller.signal);
        if (controller.signal.aborted) return;
        if (result.status === 'error') {
          setError(result.message);
          setPhase('error');
          return;
        }
        setOrder(result.order);
        setNow(Date.now());
        setPhase('awaiting');
      } catch (cause) {
        if (controller.signal.aborted || isAbortError(cause)) return;
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
          const result = await client.queryOrder(order.outTradeNo, loop.signal);
          if (loop.signal.aborted) return;
          if (result.status === 'error') throw new Error(result.message);

          failures = 0;
          attempt += 1;
          setPollError(null);

          const next = mapTradeState(result.snapshot, Date.now(), order.expiresAt);
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
