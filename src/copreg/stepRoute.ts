/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 步骤 ↔ URL hash。
 *
 * 每一步一个 hash，刷新、收藏、转发都能直接回到同一步，浏览器前进/后退也能按步走：
 *
 *   #survey       第 1 步 业务信息调研
 *   #proposal     第 2 步 注册方案与报价
 *   #payment      第 3 步 协议确认与支付（待支付）
 *   #paid         第 3 步 协议确认与支付（**已支付**的那个界面）
 *   #group        第 4 步 专属服务群
 *   #fill-details 第 5 步 申报资料填报
 *   #progress     第 6 步 办理进度
 *
 * 三条约定：
 *
 * 1. **hash 只是请求，不是命令**。`#payment` 只有在「确认凭据已落本地」时才作数；
 *    没有方案就想进支付页、没支付就想进服务群，一律收口回实际能到的那一步，
 *    并把地址栏改回真实步骤。地址栏与页面必须说的是同一件事 —— 否则用户复制出去的链接
 *    会把别人带到一份空壳页面。
 * 2. **`#paid` 比别的 hash 更严格**：它声称「已支付」，而支付状态是服务端说了算的，
 *    前端没有凭据。所以它到不了第 3 步就算完 —— 调用方要拿确认单据号去服务端核实
 *    （见 paymentStatus.ts）之后才敢显示「支付成功」界面；核实不通过就收口回 `#payment`。
 *    详见 App.tsx 的首帧核实与 writeTarget。
 * 3. **映射写死在这张表里**，不直接拿 ProcessStep 当 slug：`fill_details` 带下划线做 URL
 *    不好看，而且内部步骤名以后要改时不该连带把已经发出去的链接改掉。
 *    已废弃的 `agreement` 归到 `#payment`（它本来就并进了支付）。
 * 4. 解析容错：`#/payment`、`#Payment`、`#fill_details` 都认；认不出的值返回 null
 *    （调用方按「没给 hash」处理，不报错、不停在空白页）。
 *
 * 纯函数，不碰 DOM：读写 hash 的部分留在 App（见 App.tsx 的两个 effect）。
 */

import type { ProcessStep } from './types';

/** 「已支付」那个界面自己的 hash。它是第 3 步内部的状态，不占 ProcessStep 的位置 */
export const PAID_HASH = '#paid';
const PAID_SLUG = 'paid';

/** 步骤 → slug */
const STEP_SLUGS: Record<ProcessStep, string> = {
  survey: 'survey',
  proposal: 'proposal',
  // 已废弃：协议确认与支付合并成 payment，URL 也归到支付那一个
  agreement: 'payment',
  payment: 'payment',
  group: 'group',
  fill_details: 'fill-details',
  progress: 'progress',
};

/** slug → 步骤（由上面那张表反向生成，两处不会各写一份） */
const SLUG_STEPS: Record<string, ProcessStep> = Object.entries(STEP_SLUGS).reduce(
  (acc, [step, slug]) => {
    // agreement 与 payment 共用 'payment' 这个 slug：反向映射只认 payment 本身，
    // 绝不能让它把 #payment 解析成那个已经没有任何入口的 agreement
    if (step === 'agreement') return acc;
    acc[slug] = step as ProcessStep;
    return acc;
  },
  {} as Record<string, ProcessStep>
);

/** 步骤对应的 hash（带 `#`），直接赋给 location.hash 用 */
export const stepHash = (step: ProcessStep): string => `#${STEP_SLUGS[step] ?? STEP_SLUGS.survey}`;

/** 归一化 hash 文本：去掉 # 与前后斜杠、下划线换连字符、转小写。认不出时返回空串 */
const slugOf = (hash: string): string =>
  String(hash ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/_/g, '-')
    .toLowerCase();

/**
 * 解析 hash。认不出返回 null，交给调用方决定兜底到哪一步。
 * `#paid` 也是第 3 步（它只是那一页的另一个状态），所以在这里一并归到 'payment'。
 * 大小写、多余的前后斜杠、下划线写法都容错。
 */
export const stepOfHash = (hash: string): ProcessStep | null => {
  const slug = slugOf(hash);
  if (slug === '') return null;
  if (slug === PAID_SLUG) return 'payment';
  return SLUG_STEPS[slug] ?? null;
};

/** 这个 hash 是不是在声称「已支付」（`#paid`）。声称不等于事实，调用方要拿凭据去核实 */
export const hashClaimsPaid = (hash: string): boolean => slugOf(hash) === PAID_SLUG;

/** 步骤先后顺序（从早到晚）：解锁范围与「最远进度」都按它算 */
export const STEP_ORDER: ProcessStep[] = [
  'survey',
  'proposal',
  'payment',
  'group',
  'fill_details',
  'progress',
];

/**
 * 刷新时能确认到的进度证据。**判断顺序是「从后往前」**：先看最后的步骤做没做，
 * 再往回退 —— 已经填完申报资料的人不该被送回支付页，已经付过款的人也不该被送回「待支付」。
 * 这是第一版落点规则的错处：只看了「有确认凭据 → 第 3 步」，把后面完成的活全忽略了。
 */
export interface KnownProgress {
  /** 有第 1 步的问卷存档 */
  hasPlanForm: boolean;
  /** 有确认凭据（第 2 步确认过） */
  hasConfirm: boolean;
  /** 服务端说订单已支付（只有异步查单后才知道，首帧为 false） */
  orderPaid: boolean;
  /** 第 5 步申报资料已提交（草稿里 status === 'submitted'） */
  detailsSubmitted: boolean;
}

/**
 * 由已知进度推出「最远能到哪一步」与「该解锁哪些步骤」。
 *
 * 申报资料已提交 ⇒ 必然走过支付与服务群；订单已支付 ⇒ 必然确认过；确认过 ⇒ 必然填过问卷，
 * 所以从最靠后的那条证据一路往回退即可。
 * 解锁范围至少到第 2 步（方案页任何时候都能点进去看看，与既有行为一致）。
 */
export interface ProgressRoute {
  /** 落点：刷新后默认显示哪一步 */
  landing: ProcessStep;
  /** 解锁到哪一步为止（含）—— 比 landing 靠后是正常的：已支付就该能进服务群 */
  unlocked: ProcessStep[];
}

export const progressRouteOf = (progress: KnownProgress): ProgressRoute => {
  // 落点：从最靠后的证据往回退。已支付落「支付成功」界面（第 3 步的已支付态，hash 为 #paid），
  // 而不是直接跳进服务群 —— 用户刚付完款，先看到「支付成功」这个milestone 更清楚，
  // 那一页本身就有进服务群的入口。
  const landing: ProcessStep = progress.detailsSubmitted
    ? 'progress'
    : progress.orderPaid
    ? 'payment'
    : progress.hasConfirm
    ? 'payment'
    : progress.hasPlanForm
    ? 'proposal'
    : 'survey';

  // 解锁范围：已支付连服务群一起解锁（能不能*直达*是另一回事，由 hash 决定）
  const deepest: ProcessStep = progress.detailsSubmitted
    ? 'progress'
    : progress.orderPaid
    ? 'group'
    : landing;
  const depth = Math.max(STEP_ORDER.indexOf(deepest), STEP_ORDER.indexOf('proposal'));
  return { landing, unlocked: STEP_ORDER.slice(0, depth + 1) };
};

/**
 * 服务端确认「已支付」之后，要不要把当前步骤往前推一格。
 *
 * 这笔已支付只有异步查单才知道，首帧算落点时还不知道，于是可能先把人放在第 2 步；
 * 查回来若发现「人还停在首帧那一步」就把落点补到支付成功界面。
 *
 * 两种情况不推：**用户自己走开过**（他可能是特意回来看方案的），以及**已经停在支付页或更后**。
 * 返回 null 表示不用动。
 */
export const advanceOnPaid = (
  current: ProcessStep,
  initial: ProcessStep,
  options: { userNavigated: boolean }
): ProcessStep | null => {
  if (options.userNavigated) return null;
  if (current !== initial) return null;
  if (STEP_ORDER.indexOf(current) >= STEP_ORDER.indexOf('payment')) return null;
  return 'payment';
};

/**
 * 收口出**实际要显示**的步骤：
 * 请求的步骤已解锁就用它；没解锁、认不出、或压根没给 hash，用 fallback（App 按本地存档算出来的那一步）。
 * fallback 自己都不在解锁列表里（不该发生）时，退到第一个解锁的步骤。
 */
export const resolveStep = (
  requested: ProcessStep | null,
  unlockedSteps: ProcessStep[],
  fallback: ProcessStep
): ProcessStep => {
  if (requested !== null && unlockedSteps.includes(requested)) return requested;
  if (unlockedSteps.includes(fallback)) return fallback;
  return unlockedSteps[0] ?? 'survey';
};
