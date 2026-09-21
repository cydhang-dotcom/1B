/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 「微信扫码咨询」弹窗里的客服码：**先查询，再判断，后显示**。
 *
 * 弹窗一打开（`enabled`）就去问服务端这位分享人有没有专属企微码；问到就用它，
 * 问不到 / 没分享人 / 接口挂了就用 www 上的通用兜底图。查询期间 `loading` 为 true，
 * 弹窗显示「正在获取专属顾问二维码…」而不是先闪一张兜底图再换成专属码。
 *
 * 判断逻辑与地址拼接在 src/utils/customerServiceQr.ts（纯函数、有自检），
 * 这里只负责请求与状态；只有这一层读 config/api.ts（它依赖 import.meta.env，是 Vite 专有的）。
 *
 * 三处共用：落地页的提交成功弹窗（TrustModal）、第 3 步的「微信扫码咨询」（AgreementAndPaymentStep）、
 * 填报页的同一个弹窗（RegistrationDetailsStep）—— 行为必须一致，所以只有这一份实现。
 */

import { useEffect, useState } from 'react';
import { DOC_HOST } from '../config/api';
import { useShareUserUuid } from './useShareUserUuid';
import { FALLBACK_CUSTOMER_SERVICE_QR, perShareQrEndpoint, perShareQrUrl } from '../utils/customerServiceQr';

/** 取码是弹窗里的小请求，慢过 6s 就当拿不到，直接用兜底图，别让人对着转圈 */
const QUERY_TIMEOUT_MS = 6_000;

export interface CustomerServiceQr {
  /** 该显示的图片地址：查询期间是兜底图，查到专属码后换成专属码 */
  url: string;
  /** 正在查专属码 */
  loading: boolean;
}

export function useCustomerServiceQr(enabled: boolean): CustomerServiceQr {
  const shareUserUuid = useShareUserUuid();
  const [url, setUrl] = useState(FALLBACK_CUSTOMER_SERVICE_QR);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // 关掉弹窗就把状态收回去：下次打开重新查一次，也避免上一次的专属码留在界面上
      setUrl(FALLBACK_CUSTOMER_SERVICE_QR);
      setLoading(false);
      return;
    }

    const endpoint = perShareQrEndpoint(DOC_HOST, shareUserUuid);
    if (endpoint === null) {
      setUrl(FALLBACK_CUSTOMER_SERVICE_QR);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, QUERY_TIMEOUT_MS);

    setLoading(true);
    fetch(endpoint, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (controller.signal.aborted) return;
        setUrl(perShareQrUrl(DOC_HOST, data));
      })
      .catch(() => {
        // 超时 / 网络不通 / 不是 JSON：一律回落兜底图（用户自己关掉弹窗也不算失败，同样静默）
        if (!controller.signal.aborted || timedOut) setUrl(FALLBACK_CUSTOMER_SERVICE_QR);
      })
      .finally(() => {
        clearTimeout(timer);
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, shareUserUuid]);

  return { url, loading };
}
