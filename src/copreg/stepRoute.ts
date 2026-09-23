/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 步骤 ↔ URL hash。
 *
 *   #survey       第 1 步 业务信息调研
 *   #proposal     第 2 步 注册方案与报价
 *   #payment      第 3 步 协议确认与支付（待支付）
 *   #paid         第 3 步 协议确认与支付（**已支付**的那个界面）
 *   #group        第 4 步 专属服务群
 *   #fill-details 第 5 步 申报资料填报
 *   #progress     第 6 步 办理进度
 *
 * 四条约定：
 *
 * 1. **刷新时忽略 hash**：首屏落点只由本地进度证据算（`progressRouteOf`），
 *    `resolveStep` 不参与首帧；落点确定后由 App 的 effect 把地址栏改写成真实步骤。
 *    收藏 / 转发出去的链接会过期、也会在别人手里，照 hash 进会把人带进空壳页面 ——
 *    谁该看到哪一步，只有本地证据说了算。
 * 2. **地址栏只读**：没人会去解析 hash 决定去哪一步（`stepOfHash` / `resolveStep` 因此都删掉了）。
 *    App 只在跳步时把当前步骤**写**进地址栏（`replaceState`，不压历史条目），
 *    手敲 / 前进后退改出来的 hash 会被立刻改回来。地址栏与页面必须说的是同一件事，
 *    但地址栏不指挥页面。
 * 3. **`#paid` 只表示「第 3 步的已支付界面」**：写不写它由
 *    `showsPaidView(订单已支付, 申报资料已提交)` 决定；支付状态本身仍以服务端查单为准
 *    （见 paymentStatus.ts）。
 * 4. **映射写死在这张表里**，不直接拿 ProcessStep 当 slug：`fill_details` 带下划线做 URL
 *    不好看，而且内部步骤名以后要改时不该连带把已经发出去的链接改掉。
 *    已废弃的 `agreement` 归到 `#payment`（它本来就并进了支付）。
 *
 * 纯函数，不碰 DOM：写 hash 的部分留在 App（见 App.tsx 的两个 effect）。
 */

import type { ProcessStep } from './types';

/** 「已支付」那个界面自己的 hash。它是第 3 步内部的状态，不占 ProcessStep 的位置 */
export const PAID_HASH = '#paid';

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

/** 步骤对应的 hash（带 `#`）：写地址栏用 */
export const stepHash = (step: ProcessStep): string => `#${STEP_SLUGS[step] ?? STEP_SLUGS.survey}`;

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
  /**
   * 有第 1 步**接口返回的**架构诊断结果（存档 `1b_copreg_plan_report`）。
   *
   * **这才是「有方案」的凭据**：方案页上的组织形式 / 税务身份 / 资本与地址建议都来自这个接口，
   * 光有一份问卷存档（`1b_copreg_plan_form`：填到一半、或诊断失败/超时）进去只有本地模板，
   * 那不是一份方案。问卷存档本身在这里没有用武之地 —— 诊断结果存在就意味着问卷也存过
   * （`loadPlanDraft` 没有问卷存档就直接返回 null）。
   */
  hasPlanReport: boolean;
  /** 有第 1 步诊断接口返回的委托单号（存档 `1b_copreg_plan_record`）：能直接进第 3 步 */
  hasRecord: boolean;
  /** 服务端说订单已支付（只有异步查单后才知道，首帧为 false） */
  orderPaid: boolean;
  /** 第 5 步申报资料已提交（草稿里 status === 'submitted'） */
  detailsSubmitted: boolean;
}

/**
 * 第 3 步该显示哪个界面：**支付成功界面**（`#paid`）还是待支付。
 *
 * 服务端说已支付当然算；**申报资料已提交也算** —— 填报页（第 5 步）只有支付成功页上的
 * 「申报资料填报」按钮能进，所以「资料已提交」本身就说明这笔早就付过款了。
 * 刷新时不必等查单结果：等的话会先渲染出一屏「待支付」，查不动时还会一直停在那儿
 * （这正是之前修过的 bug）。
 *
 * 纯函数，App 用它决定地址栏写 `#paid` 还是 `#payment`，也用它告诉第 3 步渲染哪个界面。
 */
export const showsPaidView = (orderPaid: boolean, detailsSubmitted: boolean): boolean =>
  orderPaid || detailsSubmitted;

/**
 * 由已知进度推出「最远能到哪一步」与「该解锁哪些步骤」。
 *
 * 申报资料已提交 ⇒ 必然走过支付与服务群；订单已支付 ⇒ 必然下过单；下过单 ⇒ 必然拿到过委托单号；
 * 拿到过单号 ⇒ 必然生成过方案，所以从最靠后的那条证据一路往回退即可。
 * **第 2 步要拿到接口返回的诊断结果才解锁**：只有问卷存档时留在第 1 步
 * （不然刷新会跳进一份没有服务端内容的方案页 —— 用户报过这个 bug）。
 */
export interface ProgressRoute {
  /** 落点：刷新后默认显示哪一步 */
  landing: ProcessStep;
  /** 解锁到哪一步为止（含）—— 比 landing 靠后是正常的：已支付就该能进服务群 */
  unlocked: ProcessStep[];
}

export const progressRouteOf = (progress: KnownProgress): ProgressRoute => {
  // 落点：从最靠后的证据往回退。已支付落「支付成功」界面（第 3 步的已支付态，hash 为 #paid），
  // 而不是直接跳进服务群或填报页 —— 用户刚付完款，先看到「支付成功」这个 milestone 更清楚；
  // 那一页的主按钮是「申报资料填报」（第 5 步），服务群仍在导航里可直达。
  //
  // hasRecord 那一档不看 hasPlanReport：单号是服务端在生成方案时建的，有它就说明那次请求成功过，
  // 本地那份诊断结果被清掉/存不下（隐私模式、配额满）不该把人挡在支付页外。
  // 已提交也落第 3 步（不是第 6 步）：那一页就是「支付成功 + 服务进度状态与办理清单」，
  // 提交完正好回来看清单变成「资料已提交 · 专员初审中」；进度页仍然解锁，#progress 手敲可达。
  const landing: ProcessStep = progress.detailsSubmitted
    ? 'payment'
    : progress.orderPaid
    ? 'payment'
    : progress.hasRecord
    ? 'payment'
    : progress.hasPlanReport
    ? 'proposal'
    : 'survey';

  // 解锁范围：有诊断结果才解锁第 2 步 —— 手敲 #proposal 也收口回第 1 步，方案页不是「随便看看」
  // 的页面，它得先有服务端给的内容。已支付连服务群一起解锁（能不能*直达*是另一回事，由 hash 决定）
  const deepest: ProcessStep = progress.detailsSubmitted
    ? 'progress'
    : progress.orderPaid
    ? 'group'
    : landing;
  const base: ProcessStep = progress.hasPlanReport ? 'proposal' : 'survey';
  const depth = Math.max(STEP_ORDER.indexOf(deepest), STEP_ORDER.indexOf(base));
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
