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
 * 3. **`#paid` 只表示「第 3 步的已支付界面」，且只有服务端说了算**：写不写它由
 *    `showsPaidView(查单确认已支付, 申报资料已提交)` 决定（见 paymentStatus.ts）。
 *    **有委托单号不等于已支付** —— 单号是生成方案时服务端就建好的，本地那份 `order.status`
 *    不作为依据；有单号只保证落在第 3 步，落的是「待支付」还是「支付成功」要看查单结论。
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

/* ---------------------------------------------------- 步骤的「登记上限」 */

/**
 * **登记（落盘）的步骤最大到 payment**（2026-09 定）。
 *
 * 依据：`progressRouteOf` 的落点从来不会超过第 3 步（申报资料已提交也只落「支付成功界面」），
 * 所以第 5 步申报资料填报、第 6 步办理进度都是**会话内的浏览位置**，不是「进度」——
 * 把它们写进主体记录只会让下次进来莫名其妙地落在那一页。
 *
 * 于是 `App.setCurrentStep` 分两路：
 *   - `payment` 及更早的步骤 → 正常写进主体记录（这才是「进度」）；
 *   - 更靠后的步骤（`fill_details` / `progress`）→ **只在本次会话里显示**，不落盘。
 *
 * 第 5 步因此**只能从支付成功页进**（新标签页那个按钮带 `?open=fill-details` 深链，
 * 或会话内点按钮跳过去）：刷新 / 重开页面都会回到第 3 步 —— 想再填就再从支付页点一次。
 */
export const MAX_PERSISTED_STEP: ProcessStep = 'payment';

/** 这一步能不能写进主体记录（「进度」只到 payment） */
export const canPersistStep = (step: ProcessStep): boolean =>
  STEP_ORDER.indexOf(step) <= STEP_ORDER.indexOf(MAX_PERSISTED_STEP);

/** 把超限的步骤收口回登记上限；已在范围内的原样返回（读旧存档时用） */
export const clampPersistedStep = (step: ProcessStep): ProcessStep =>
  canPersistStep(step) ? step : MAX_PERSISTED_STEP;

/* ------------------------------------------------- 「新标签页」深链（只有第 5 步） */

/**
 * 支付成功页那个「申报资料填报」按钮要**在新标签页**打开填报页，而新标签页打开时
 * 地址栏是不指挥页面的（见本文件开头的约定）—— 光带 `#fill-details` 它只会按本地证据
 * 落回第 3 步。所以用一个**显式的意图参数**告诉它「这次是奔着填报页来的」：
 *
 *   copreg.html?open=fill-details
 *
 * 三条约束：
 *   1. **只有白名单里的值认**（现在只有 `fill-details`），其余一律忽略；
 *   2. 解析出来只是一个「意图」，**能不能真的进那一步还要看本地证据**（见
 *      `allowsFillDetailsIntent`：付过款才放行），否则链接就成了绕过支付的入口；
 *   3. 参数**用过就抹掉**（App 里 replaceState），刷新 / 转发出去的地址不会再触发跳步。
 */
export const OPEN_INTENT_PARAM = 'open';
export const OPEN_FILL_DETAILS_VALUE = 'fill-details';

/** 解析深链意图：认识的返回目标步骤，不认识 / 没传返回 null */
export const openIntentOf = (search: string | undefined): ProcessStep | null => {
  const query = (search ?? '').replace(/^\?/, '');
  if (query === '') return null;
  let value = '';
  try {
    value = new URLSearchParams(query).get(OPEN_INTENT_PARAM) ?? '';
  } catch {
    return null; // 畸形查询串就当没传
  }
  return value === OPEN_FILL_DETAILS_VALUE ? 'fill_details' : null;
};

/** 深链地址：`{origin}{pathname}?open=fill-details`（不带 hash —— 落点后由页面自己写进地址栏） */
export const fillDetailsOpenUrl = (origin: string, pathname: string): string =>
  `${origin}${pathname}?${OPEN_INTENT_PARAM}=${OPEN_FILL_DETAILS_VALUE}`;

/**
 * 深链要不要真的放行：**必须已经付过款**。
 *
 * 判据与第 3 步两个界面同源：服务端查单确认已支付，或**申报资料已提交**（后者本身就说明付过款）。
 * 不满足就完全忽略这个参数，仍按本地证据落点 —— 否则 `?open=fill-details` 会变成一条
 * 绕过支付直接进填报页的链接。
 *
 * 注：这里用的是**打开那一刻的本地证据**（`activeApp.order.status === 'paid'` 或
 * `isDetailsSubmitted`）。深链是用户点按钮主动过来的，本地摘要足以放行；服务端查单随后照样会
 * 校正/推翻状态，填报表单的提交本来也还要单号与支付。
 */
export const allowsFillDetailsIntent = (orderPaid: boolean, detailsSubmitted: boolean): boolean =>
  orderPaid || detailsSubmitted;

/**
 * 刷新时能确认到的进度证据。
 *
 * **「有委托单号」只证明建过单，不证明付过款** —— 单号是第 1 步生成方案时服务端就建好的；
 * 支付状态只有服务端查单说了才算（见 paymentStatus.ts），本地那份 `order.status` 一律不作为
 * 「已支付」的依据（它可能过期、也可能上一笔留下）。所以这里的 `orderPaid` 是
 * **查单确认过的结果**，不是存档里读出来的状态。
 *
 * 判断顺序是「从后往前」：先看最后的步骤做没做，再往回退 —— 已经填完申报资料的人不该被
 * 送回「待支付」。**「申报资料已提交」排在「已支付」前面**：填报页只有支付成功页的入口能进，
 * 所以它本身就说明这笔早就付过款了，比一次查单更硬（查单接口挂了也不该把人甩回支付页）。
 */
export interface KnownProgress {
  /**
   * 有第 1 步**接口返回的**架构诊断结果（存档 `1b_copreg_plan_report`）。
   *
   * **这才是「有方案」的凭据**：方案页上的组织形式 / 税务身份 / 资本与地址建议都来自这个接口，
   * 光有一份问卷存档（`1b_copreg_plan_form`：填到一半、或诊断失败/超时）进去只有本地模板，
   * 那不是一份方案。问卷存档本身在这里没有用武之地 —— 诊断结果存在就意味着问卷也存过
   * （`loadPlanDraftFor(appId)` 没有问卷存档就直接返回 null）。
   */
  hasPlanReport: boolean;
  /**
   * 有第 1 步诊断接口返回的委托单号（存档 `1b_copreg_plan_record`）。
   * **只代表建过单**：能不能进「支付成功」界面还得看 `orderPaid` / `detailsSubmitted`。
   *
   * 调用方要按「单号是那次成功请求里给的」来算：**只有问卷的存档不算有单号**（单号是生成方案时
   * 服务端建的，没有方案就没有那张单）。本地诊断结果被清掉/存不下时，有单号照样算 —— 否则
   * 用户会被挡在第 1 步重新生成方案，把已经建好的单丢掉。
   */
  hasRecord: boolean;
  /** 服务端查单确认已支付（首帧还不知道，查回来才算） */
  orderPaid: boolean;
  /** 第 5 步申报资料已提交（草稿里 status === 'submitted'） */
  detailsSubmitted: boolean;
}

/**
 * 第 3 步该显示哪个界面：**支付成功界面**（`#paid`）还是待支付。
 *
 * 只有两条依据，都指向「这笔真的付过」：
 *   1. **服务端查单说已支付**（`orderPaid`，见 paymentStatus.ts）；
 *   2. **申报资料已提交** —— 填报页（第 5 步）只有支付成功页上的「申报资料填报」按钮能进，
 *      所以「资料已提交」本身就说明这笔早就付过款了。刷新时不必等查单：等的话会先渲染出
 *      一屏「待支付」，查不动时还会一直停在那儿（这正是之前修过的 bug）。
 *
 * **本地存档里的 `order.status` 不算依据**（2026-09 改）：有委托单号不等于付过款，
 * 唯一能说「已支付」的是查单结果。所以 `orderPaid` 的实参必须是查单结论。
 *
 * 纯函数，App 用它决定地址栏写 `#paid` 还是 `#payment`，也用它告诉第 3 步渲染哪个界面。
 */
export const showsPaidView = (orderPaid: boolean, detailsSubmitted: boolean): boolean =>
  orderPaid || detailsSubmitted;

/**
 * 由已知进度推出「最远能到哪一步」与「该解锁哪些步骤」。
 *
 * 申报资料已提交 ⇒ 必然付过款、也必然有单号；订单已支付（查单确认）⇒ 必然有单号；
 * 有单号 ⇒ 必然生成过方案，所以从最靠后的那条证据一路往回退即可。
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
  // 落点：从最靠后的证据往回退。**有单号但还没查单（或查回未支付）也落第 3 步**，只是落的是
  // 那一页的「待支付」界面 —— 单号只说明建过单，付款与否要等查单/用户去付；
  // 已支付 / 已提交再落同一页的「支付成功」界面（由 showsPaidView 决定，见 App）。
  // 不直接跳服务群或填报页：用户刚付完款，先看到「支付成功」这个 milestone 更清楚；
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
