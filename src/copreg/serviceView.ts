/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * **服务人员只读查看**的纯逻辑：地址栏参数怎么认、接口响应里怎么取出申报表。
 *
 * 背景：客户填的申报资料（第 5 步 `#fill-details` 的那几个对象：基本信息 / 股东出资 / 主要人员 /
 * 委托书 / 确认）以 JSON 字符串存在服务端 `openAccApply.var2` 里（真机响应实测），
 * 由 `POST {DOC_HOST}/xcx/yqt-co/subscribe/open-info` 写入、key 是委托单号 `busUnionId`；
 * 服务人员手上只有**开户单 uuid（`scbUuid`）**，所以要按它读回来 —— 走
 * `subscribeQuery.ts`（地址与凭据照 www 站 `static/js/page-display.js` 的 code 版）。
 *
 * 这里不碰 DOM、不读 import.meta.env、不发请求，`scripts/check-service-view.ts` 直接引它做离线自检。
 */

import { serverMessageOf } from '../utils/serverError';
import { normalizeRegistrationForm } from './registration/formSnapshot';
import type { RegistrationFullForm } from './registration/types';

/**
 * 开户单 uuid 的参数名。**`scbUuid` 是本项目/接口文档里的名字**；`uuid` 是 www 站那批
 * code 版页面（page-display.js 读的就是 `uuid`）的写法 —— 两边指向同一个值，
 * 所以两个名字都认，方便服务人员手上那条链接是哪种写法都能打开。
 */
export const SERVICE_UUID_PARAMS = ['scbUuid', 'uuid'] as const;

/** 查看码参数名（与 page-display.js 一致） */
export const SERVICE_CODE_PARAM = 'code';

/** 地址栏里的查看意图：`?scbUuid=<id>[&uuid=…][&code=<访问码>]` */
export interface ServiceViewQuery {
  /** 开户单 uuid（scbUuid） */
  uuid: string;
  /** 查看码；没带就是空串（照样发请求，服务端说不行就照实显示它那句人话） */
  code: string;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * 解析地址栏：有开户单 uuid 就是「服务人员查看模式」，否则返回 null（页面照常走客户流程）。
 *
 * **只看有没有 uuid**：`code` 缺失 / 为空不改变模式（服务端可能放行，测试环境实测就不校验），
 * 真正决定能不能看到内容的是接口的答复 —— 前端不自己编一套「没码就不给看」的规则，
 * 否则服务端改了凭据口径，页面还得跟着改。
 */
export const serviceViewQueryOf = (search: string | undefined): ServiceViewQuery | null => {
  const query = (search ?? '').replace(/^\?/, '');
  if (query === '') return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query);
  } catch {
    return null; // 畸形查询串就当没传
  }

  let uuid = '';
  for (const name of SERVICE_UUID_PARAMS) {
    uuid = textOf(params.get(name));
    if (uuid !== '') break;
  }
  if (uuid === '') return null;

  return { uuid, code: textOf(params.get(SERVICE_CODE_PARAM)) };
};

/** 取出申报表的结果：成功给归一化后的表单，失败给一句能直接显示的人话 */
export type ServiceFormResult =
  | { ok: true; form: RegistrationFullForm; busUnionId: string }
  | { ok: false; message: string };

/**
 * 从开户单详情响应里取出「用户提交的那几个对象」。
 *
 * 取值路径：`openAccApply.var2` —— 字符串时按 JSON 解，已经是对象时直接用（服务端若改成
 * 直接给对象，这里不用改）。解出来的东西交给 `normalizeRegistrationForm` 收口（空骨架打底 +
 * 缺字段补默认值 + 附件逐项过滤），与填报页读本地草稿是同一份规则。
 *
 * 失败原因分档，都是服务人员能看懂、也知道下一步该做什么的话：
 *   响应不是对象 / 200 里是错误信封   服务端那句人话（没有就「返回格式异常，暂时无法查看」）
 *   没有 openAccApply                  「这条记录里没有开户申请信息」
 *   没有 var2 / var2 为空              「该客户还没有提交申报资料」
 *   var2 不是 JSON / 不是申报表        「申报资料内容无法识别」
 */
export const serviceFormOf = (payload: unknown): ServiceFormResult => {
  if (!isRecord(payload)) {
    return { ok: false, message: '申报资料查看返回格式异常，暂时无法查看' };
  }

  const openAccApply = payload.openAccApply;
  if (!isRecord(openAccApply)) {
    // 200 里带业务错误信封（`{reasons:[…]}`）时，服务端那句话比「没有开户申请信息」有用得多
    const serverMessage = serverMessageOf(payload);
    return { ok: false, message: serverMessage ?? '这条记录里没有开户申请信息，暂时无法查看' };
  }

  const rawVar2 = openAccApply.var2;
  let parsed: unknown;
  if (typeof rawVar2 === 'string') {
    const text = rawVar2.trim();
    if (text === '') return { ok: false, message: '该客户还没有提交申报资料' };
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, message: '申报资料内容无法解析，暂时无法查看' };
    }
  } else if (isRecord(rawVar2)) {
    parsed = rawVar2;
  } else {
    return { ok: false, message: '该客户还没有提交申报资料' };
  }

  const form = normalizeRegistrationForm(parsed);
  if (form === null) {
    return { ok: false, message: '申报资料内容无法识别（缺少基本信息或人员信息），暂时无法查看' };
  }

  return { ok: true, form, busUnionId: textOf(payload.busUnionId) };
};
