/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 查看页的**会话内快照**：把这次读到的开户单详情按「开户单编号 + 查看码」记下来，
 * 刷新时直接拿它渲染，**不再打接口**。
 *
 * 为什么必须有（2026-10 用户报的「刷新就会失败」）：查看码是一次性的，刷新 = 页面重新加载 =
 * 单次闸门也是新的 → 再打一次接口必然被拒。同一条链接的第二、第三次打开只能靠本地快照兜住。
 *
 * 三条口径：
 *   1. **只写 sessionStorage**（随标签页关闭消失），`localStorage` 一个键都不写 ——
 *      那是客户页的地盘，服务人员的浏览器里不该落下长期可读的客户资料；
 *   2. **键里含查看码**：换了一条新链接（新码）不会命中旧快照，照常去读最新内容；
 *   3. **只留最近 `SERVICE_SNAPSHOT_LIMIT` 条**：一个浏览器里连着看好几个客户也不会越堆越多。
 *
 * 纯逻辑（吃 JSON 字符串、吐 JSON 字符串），不碰 DOM / 不读 import.meta.env，
 * `scripts/check-service-view.ts` 直接引它做离线自检。
 */

/** sessionStorage 里那一个键（整张表放一个键里，免得一个客户一个键散在存储里） */
export const SERVICE_SNAPSHOT_KEY = '1b_copreg_service_view';

/** 最多留几条（超出丢最旧的） */
export const SERVICE_SNAPSHOT_LIMIT = 5;

export interface ServiceViewSnapshot {
  /** 闸门同款 key：`开户单编号 \0 查看码`（见 onceGate.ts 的 serviceViewGateKey） */
  key: string;
  /** 这次读取的时刻（给人看的时间串，服务端返回里没有「读取时间」这个概念） */
  fetchedAt: string;
  /** 接口原样响应（结构仍交给 serviceFormOf 判，这里不预设形状） */
  payload: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** 读出整张表：坏 JSON / 不是数组 / 条目形状不对，一律当空表（不抛错、不崩页面） */
export const snapshotsOf = (raw: string | null | undefined): ServiceViewSnapshot[] => {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item): item is ServiceViewSnapshot =>
      isRecord(item) && typeof item.key === 'string' && item.key !== '' && typeof item.fetchedAt === 'string'
  );
};

/** 找这一条：key 对得上才算命中（换了查看码就是另一次查看，必须重新去读） */
export const snapshotFor = (
  raw: string | null | undefined,
  key: string
): ServiceViewSnapshot | null => snapshotsOf(raw).find((item) => item.key === key) ?? null;

/**
 * 写回整张表（返回新的 JSON 字符串）：同 key 覆盖、最新的放最前、超出上限丢最旧的。
 * 调用方自己决定存哪里（页面里是 sessionStorage），写不进去也不影响本次查看。
 */
export const withSnapshot = (
  raw: string | null | undefined,
  snapshot: ServiceViewSnapshot,
  limit: number = SERVICE_SNAPSHOT_LIMIT
): string => {
  const kept = snapshotsOf(raw).filter((item) => item.key !== snapshot.key);
  return JSON.stringify([snapshot, ...kept].slice(0, Math.max(1, limit)));
};
