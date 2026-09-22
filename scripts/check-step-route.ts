/**
 * 步骤 hash 路由的纯函数自检：不联网、不碰 DOM、不开浏览器。
 *   npx tsx scripts/check-step-route.ts
 *
 * 覆盖两件事：步骤 ↔ slug 的往返（含容错写法与已废弃的 agreement），
 * 以及「hash 只是请求」这条收口规则 —— 没解锁的步骤必须被挡回实际所在的那一步。
 */
import {
  PAID_HASH,
  STEP_ORDER,
  advanceOnPaid,
  hashClaimsPaid,
  progressRouteOf,
  showsPaidView,
  resolveStep,
  stepHash,
  stepOfHash,
} from '../src/copreg/stepRoute';
import type { ProcessStep } from '../src/copreg/types';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

/* ------------------------------------------------------------ 步骤 → hash */

{
  ok('第 1 步是 #survey', stepHash('survey') === '#survey');
  ok('第 2 步是 #proposal', stepHash('proposal') === '#proposal');
  ok('第 3 步是 #payment', stepHash('payment') === '#payment');
  ok('第 4 步是 #group', stepHash('group') === '#group');
  ok('第 5 步是 #fill-details（下划线换成连字符）', stepHash('fill_details') === '#fill-details');
  ok('第 6 步是 #progress', stepHash('progress') === '#progress');
  ok('已废弃的 agreement 归到 #payment', stepHash('agreement') === '#payment');
}

/* ------------------------------------------------------------ hash → 步骤 */

{
  ok('认 #survey', stepOfHash('#survey') === 'survey');
  ok('认 #fill-details', stepOfHash('#fill-details') === 'fill_details');
  ok('不带 # 也认', stepOfHash('progress') === 'progress');
  ok('#/payment 这种带斜杠的写法也认', stepOfHash('#/payment') === 'payment');
  ok('#payMent 大小写不敏感', stepOfHash('#payMent') === 'payment');
  ok('#fill_details 下划线写法也认（内部名直接粘过来也能用）', stepOfHash('#fill_details') === 'fill_details');
  ok('前后空白无所谓', stepOfHash('  #group  ') === 'group');
  ok('空 hash 返回 null', stepOfHash('') === null && stepOfHash('#') === null && stepOfHash('#/') === null);
  ok('认不出的 hash 返回 null', stepOfHash('#foo') === null && stepOfHash('#agreement') === null);
  ok('数字片段不认（不玩隐式编号）', stepOfHash('#3') === null);
  ok('null / undefined 不炸', stepOfHash(null as unknown as string) === null && stepOfHash(undefined as unknown as string) === null);
}

/* --------------------------------------------------- 已支付（#paid） */

{
  ok('#paid 解析成第 3 步（它只是那一页的另一个状态）', stepOfHash('#paid') === 'payment');
  ok('#paid 也认带斜杠/大小写写法', stepOfHash('#/paid') === 'payment' && stepOfHash('#PAID') === 'payment');
  ok('hashClaimsPaid 认 #paid', hashClaimsPaid('#paid') && hashClaimsPaid('#/PAID'));
  ok('#payment 不是「声称已支付」', !hashClaimsPaid('#payment'));
  ok('别的 hash 也不是', !hashClaimsPaid('#group') && !hashClaimsPaid('') && !hashClaimsPaid('#nonsense'));
  ok('PAID_HASH 就是 #paid', PAID_HASH === '#paid');
  ok('stepHash 永远不会吐出 #paid（它属于状态，不属于步骤）', stepHash('payment') === '#payment');
}

/* ------------------------------------------------------------------ 往返 */

{
  const steps: ProcessStep[] = ['survey', 'proposal', 'agreement', 'payment', 'group', 'fill_details', 'progress'];
  const roundTrip = steps.every((step) => stepOfHash(stepHash(step)) === (step === 'agreement' ? 'payment' : step));
  ok('每个步骤 hash 出去再解回来都是同一步（agreement 归 payment）', roundTrip);
}

/* ------------------------------------------- 刷新落点：从后往前看进度证据 */

{
  const nothing = progressRouteOf({ hasPlanReport: false, hasRecord: false, orderPaid: false, detailsSubmitted: false });
  ok('什么都没做 → 落在第 1 步', nothing.landing === 'survey');
  ok('什么都没做只解锁第 1 步（没有诊断结果就没有方案可看）', nothing.unlocked.join(',') === 'survey');

  // 用户报的 bug：本地只存了问卷（1b_copreg_plan_form）、没拿到接口返回的诊断结果时，
  // 刷新却跳进了方案页 —— 那一页的行业内容全来自诊断接口，进去只有本地模板
  const formOnly = progressRouteOf({ hasPlanReport: false, hasRecord: false, orderPaid: false, detailsSubmitted: false });
  ok('只填过问卷、没有诊断结果 → 仍是第 1 步，且不解锁第 2 步', formOnly.landing === 'survey' && formOnly.unlocked.join(',') === 'survey');

  const report = progressRouteOf({ hasPlanReport: true, hasRecord: false, orderPaid: false, detailsSubmitted: false });
  ok('拿到接口返回的诊断结果 → 第 2 步', report.landing === 'proposal');
  ok('拿到诊断结果才解锁第 2 步', report.unlocked.join(',') === 'survey,proposal');

  const recorded = progressRouteOf({ hasPlanReport: true, hasRecord: true, orderPaid: false, detailsSubmitted: false });
  ok('拿到过委托单号 → 第 3 步', recorded.landing === 'payment');
  ok('拿到过单号只解锁到第 3 步（没支付不给进服务群）', recorded.unlocked.join(',') === 'survey,proposal,payment');
  ok(
    '有委托单号但诊断结果本地丢了 → 仍进第 3 步（单号本身就说明那次请求成功过）',
    progressRouteOf({ hasPlanReport: false, hasRecord: true, orderPaid: false, detailsSubmitted: false }).landing === 'payment'
  );

  const paid = progressRouteOf({ hasPlanReport: true, hasRecord: true, orderPaid: true, detailsSubmitted: false });
  ok('订单已支付 → 落在第 3 步的「支付成功」界面（hash 为 #paid）', paid.landing === 'payment');
  ok('已支付时服务群也解锁了（能直达，但不默认跳进去）', paid.unlocked.join(',') === 'survey,proposal,payment,group');

  // 用户报的 bug（已两次）：申报资料填完了，刷新却落到别处
  const submitted = progressRouteOf({ hasPlanReport: true, hasRecord: true, orderPaid: true, detailsSubmitted: true });
  ok('申报资料已提交 → 第 3 步的支付成功界面（#paid），不是第 6 步', submitted.landing === 'payment');
  ok(
    '已提交时首帧还没查单也照样按支付成功界面渲染（不用等 orderPaid）',
    progressRouteOf({ hasPlanReport: true, hasRecord: true, orderPaid: false, detailsSubmitted: true }).landing === 'payment'
  );
  ok('已提交时六步全解锁（可以回去改申报资料）', submitted.unlocked.length === 6 && submitted.unlocked.join(',') === STEP_ORDER.join(','));

  ok(
    '后面的证据优先：同时满足「已支付」与「已提交」时同样落在支付成功界面',
    progressRouteOf({ hasPlanReport: true, hasRecord: true, orderPaid: true, detailsSubmitted: true }).landing === 'payment'
  );
  ok(
    '没有委托单号却有已提交的申报表（本地凭据被删）→ 仍落支付成功界面',
    progressRouteOf({ hasPlanReport: false, hasRecord: false, orderPaid: false, detailsSubmitted: true }).landing === 'payment'
  );

  // 与 hash 收口配合：已解锁的 hash 直接生效，没解锁的才回退
  ok('#progress + 已提交 → 第 6 步（进度页仍解锁、手敲可达）', resolveStep('progress', submitted.unlocked, submitted.landing) === 'progress');
  ok('#fill-details + 已提交 → 第 5 步（可回去改）', resolveStep('fill_details', submitted.unlocked, submitted.landing) === 'fill_details');
  ok('#group + 已支付 → 第 4 步', resolveStep('group', paid.unlocked, paid.landing) === 'group');
  ok(
    '#proposal 但没有诊断结果 → 收口回第 1 步（方案页不是随便看看的页面）',
    resolveStep('proposal', nothing.unlocked, nothing.landing) === 'survey'
  );
  ok(
    '#progress 但只是拿到过单号（没支付）→ 仍收口回第 3 步',
    resolveStep('progress', recorded.unlocked, recorded.landing) === 'payment'
  );
}

/* ------------------------------------------- 第 3 步显示哪个界面（#paid / #payment） */

{
  ok('服务端说已支付 → 支付成功界面', showsPaidView(true, false));
  ok('申报资料已提交（查单还没回来）→ 也按支付成功界面', showsPaidView(false, true));
  ok('两者都不成立 → 待支付界面', !showsPaidView(false, false));
  ok('两者都成立 → 支付成功界面', showsPaidView(true, true));
}

/* --------------------------------------- 异步查回「已支付」后要不要往前推 */

{
  const noNav = { userNavigated: false };
  const navigated = { userNavigated: true };

  // 用户报的 bug：首帧落在第 2 步，服务端随后说已支付 —— 不推的话就一直停在第 2 步
  ok('还停在首帧的第 2 步 → 推进到支付成功界面', advanceOnPaid('proposal', 'proposal', noNav) === 'payment');
  ok('首帧在第 1 步也一样推', advanceOnPaid('survey', 'survey', noNav) === 'payment');
  ok('已经停在支付页 → 不用动（已支付界面本来就显示在那里）', advanceOnPaid('payment', 'proposal', noNav) === null);
  ok('已经走到服务群或更后 → 不把人拽回来', advanceOnPaid('group', 'proposal', noNav) === null && advanceOnPaid('progress', 'proposal', noNav) === null);
  ok('用户自己走动过（当前步 ≠ 首帧落点）→ 不动', advanceOnPaid('proposal', 'payment', noNav) === null);
  ok('明确标记为「用户操作过」→ 不动', advanceOnPaid('proposal', 'proposal', navigated) === null);
}

/* -------------------------------------------------- 收口：hash 只是请求 */

{
  const fresh: ProcessStep[] = ['survey', 'proposal'];
  const withConfirm: ProcessStep[] = ['survey', 'proposal', 'payment'];

  ok('请求的步骤已解锁 → 用它', resolveStep('proposal', fresh, 'survey') === 'proposal');
  ok('请求 #payment 但没有确认凭据 → 退回本该在的那一步', resolveStep('payment', fresh, 'proposal') === 'proposal');
  ok('请求 #group（没支付）→ 退回本该在的那一步', resolveStep('group', fresh, 'survey') === 'survey');
  ok('请求 #progress（没支付）→ 退回本该在的那一步', resolveStep('progress', withConfirm, 'payment') === 'payment');
  ok('有凭据时请求 #payment 就进支付页', resolveStep('payment', withConfirm, 'payment') === 'payment');
  ok('有凭据时手敲 #survey 也能回第 1 步', resolveStep('survey', withConfirm, 'payment') === 'survey');
  ok('没给 hash（认不出）→ 用 fallback', resolveStep(null, withConfirm, 'payment') === 'payment');
  ok('fallback 自己没解锁 → 退到第一个解锁的步骤', resolveStep(null, ['survey'], 'proposal') === 'survey');
  ok('解锁列表为空也不返回 undefined', resolveStep('payment', [], 'payment') === 'survey');
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
