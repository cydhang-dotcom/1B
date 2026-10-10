/**
 * 多主体申请的模型、规则与初始化自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-applications.ts
 *
 * 覆盖：
 *   1. **键空间**：每主体一套键（表单/诊断/单号/申报表），与旧的全局键不重名；
 *   2. **列表收口**：坏项丢掉、重复 id 只留第一个、超过 5 个只认前 5、activeAppId 认不出落第一个；
 *   3. **业务规则**：最多 5 个主体、已支付不可作废、作废当前主体后自动切走、最后一个作废后补空白主体、改名；
 *   4. **旧结构不再迁移**（2026-09 去掉）：只剩单主体时代的全局键时照样建全新主体落第 1 步，
 *      旧键不读、不搬、也不删；已有主体列表时直接复用；
 *   5. **初始化**：什么都没有时建空白主体；activeAppId 以存档里的为准。
 */
import {
  ACTIVE_APP_KEY,
  APPLICATIONS_KEY,
  MAX_APPLICATIONS,
  addApplication,
  applyPaidOrder,
  canAddApplication,
  createApplication,
  deriveApplicationName,
  discardApplication,
  mergeApplicationsWrite,
  ensureApplicationsState,
  parseApplicationsState,
  patchOrderSummary,
  planFormKey,
  planRecordKey,
  planReportKey,
  readApplicationsState,
  registrationKey,
  renameApplication,
  setActiveApplication,
  suggestedContactPhone,
  updateApplication,
  writeApplicationsState,
  type ApplicationsState,
  type ApplicationRecord,
  type StorageLike,
} from '../src/copreg/applications';
/**
 * 单主体时代的旧键：**字面量写在这里**（不从 planDraft 引 —— 那个模块会 import config/api.ts，
 * 里面有 import.meta.env，tsx 下直接崩）。这条自检要断言的就是「这些键现在没人读」。
 */
const LEGACY_PLAN_FORM_KEY = '1b_copreg_plan_form';
const LEGACY_PLAN_REPORT_KEY = '1b_copreg_plan_report';
const LEGACY_PLAN_RECORD_KEY = '1b_copreg_plan_record';
const LEGACY_REGISTRATION_KEY = 'banbu-registration-20260913-v1';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean) {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}`);
  }
}

/** 假 localStorage：可选让某些键写入抛错，模拟配额满 */
const fakeStorage = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  let failOn: Set<string> | null = null;
  const storage: StorageLike = {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      if (failOn?.has(key)) throw new Error('QuotaExceededError');
      map.set(key, value);
    },
    removeItem: (key) => void map.delete(key),
  };
  return { storage, map, failOn: (keys: string[]) => void (failOn = new Set(keys)) };
};

const ISO = '2026-09-24T02:00:00.000Z';
const NOW = Date.parse(ISO);

const state1 = (): ApplicationsState => ({ applications: [createApplication(NOW, 0)], activeAppId: '' });

function main() {
  /* ---------------------------------------------------------- 键空间 */
  ok('四类键各按主体拼', planFormKey('app-1') === '1b_copreg_app:app-1:plan_form' && planReportKey('app-1') === '1b_copreg_app:app-1:plan_report' && planRecordKey('app-1') === '1b_copreg_app:app-1:plan_record' && registrationKey('app-1') === 'banbu-registration-app-1');
  ok(
    '主体键不与旧的全局键重名',
    [planFormKey('x'), planReportKey('x'), planRecordKey('x'), registrationKey('x')].every(
      (key) => ![LEGACY_PLAN_FORM_KEY, LEGACY_PLAN_REPORT_KEY, LEGACY_PLAN_RECORD_KEY, LEGACY_REGISTRATION_KEY].includes(key)
    )
  );
  ok('上限是 5', MAX_APPLICATIONS === 5);

  /* ------------------------------------------------------ 列表收口 */
  ok('非对象 / 空列表都收成 null', parseApplicationsState(null) === null && parseApplicationsState([]) === null && parseApplicationsState({ applications: [] }) === null);
  ok('坏项（没 id）丢掉', parseApplicationsState({ applications: [{ name: '没 id' }, { id: 'app-1', name: '有 id' }] })?.applications.length === 1);
  ok(
    '重复 id 只留第一个',
    (() => {
      const parsed = parseApplicationsState({ applications: [{ id: 'a', name: '第一次' }, { id: 'a', name: '第二次' }] });
      return parsed?.applications.length === 1 && parsed.applications[0].name === '第一次';
    })()
  );
  ok(
    '超过 5 个只认前 5 个',
    parseApplicationsState({ applications: Array.from({ length: 8 }, (_, i) => ({ id: `app-${i}` })) })?.applications.length === 5
  );
  ok(
    'activeAppId 认不出就落到第一个',
    parseApplicationsState({ applications: [{ id: 'a' }, { id: 'b' }], activeAppId: '不存在' })?.activeAppId === 'a'
  );
  ok(
    '坏字段回落：步数非法→survey、unlocked 归一、订单默认',
    (() => {
      const app = parseApplicationsState({
        applications: [{ id: 'a', currentStep: '不存在的步', unlockedSteps: ['progress', 'survey', 'progress'], order: { status: '什么' } }],
      })?.applications[0];
      return (
        app?.currentStep === 'survey' &&
        app.unlockedSteps.join(',') === 'survey,progress' &&
        app.order.status === 'pending' &&
        app.order.amount === 0 &&
        app.unlockedSteps.includes('survey')
      );
    })()
  );

  /* ------------------------------------------------------ 新增 / 改名 */
  {
    let state: ApplicationsState = { applications: [], activeAppId: '' };
    let limitHit = false;
    for (let i = 0; i < MAX_APPLICATIONS; i += 1) {
      const result = addApplication(state, { now: NOW + i });
      if (!result.ok) throw new Error('第 ' + (i + 1) + ' 个不该被拒');
      state = result.state;
    }
    const sixth = addApplication(state, { now: NOW + 100 });
    limitHit = sixth.ok === false && sixth.reason === 'limit';

    ok('能连建 5 个主体', state.applications.length === 5 && state.applications.every((app) => app.currentStep === 'survey' && app.unlockedSteps.join(',') === 'survey'));
    ok('第 6 个被拒（limit）', limitHit);
    ok('到顶后 canAddApplication 为 false', canAddApplication(state) === false);
    ok('新增后 activeAppId 指向新主体', state.activeAppId === state.applications[4].id);
    ok('新主体：订单 pending、未提交、金额 0', state.applications[4].order.status === 'pending' && state.applications[4].isDetailsSubmitted === false && state.applications[4].order.amount === 0);
    ok('主体 id 互不相同', new Set(state.applications.map((app) => app.id)).size === 5);

    const renamed = renameApplication(state, state.applications[0].id, '  云帆科技  ', NOW + 200);
    ok('改名去掉首尾空格', renamed.applications[0].name === '云帆科技');
    ok('改名刷新 updatedAt', renamed.applications[0].updatedAt !== state.applications[0].updatedAt);
    ok('空名不生效', renameApplication(state, state.applications[0].id, '   ') === state);
  }

  /* ---------------------------------------------------------- 作废 */
  {
    // 两个主体，active 是第二个
    const added = addApplication(state1(), { now: NOW + 1 });
    if (!added.ok) throw new Error('前置：第二个主体不该被拒');
    const base: ApplicationsState = added.state;
    const [first, second] = base.applications;
    ok('（前置）确实是两个主体且 active 为第二个', base.applications.length === 2 && base.activeAppId === second.id);

    ok('作废不存在的主体 → missing', discardApplication(base, '不存在').ok === false);
    ok(
      '已支付主体不可作废',
      (() => {
        const paidState: ApplicationsState = {
          applications: [first, { ...second, order: { ...second.order, status: 'paid' } }],
          activeAppId: second.id,
        };
        const result = discardApplication(paidState, second.id);
        return result.ok === false && result.reason === 'paid';
      })()
    );
    ok(
      '作废非当前主体：当前主体不变、列表少一个',
      (() => {
        const result = discardApplication(base, first.id);
        return result.ok === true && result.state.applications.length === 1 && result.state.activeAppId === second.id;
      })()
    );
    ok(
      '作废当前主体：自动切到剩下的第一个',
      (() => {
        const result = discardApplication(base, second.id);
        return result.ok === true && result.state.applications.length === 1 && result.state.activeAppId === first.id;
      })()
    );
    ok(
      '作废最后一个：补一个空白主体，列表不为空',
      (() => {
        const single: ApplicationsState = { applications: [first], activeAppId: first.id };
        const result = discardApplication(single, first.id);
        return (
          result.ok === true &&
          result.state.applications.length === 1 &&
          result.state.applications[0].id !== first.id &&
          result.state.activeAppId === result.state.applications[0].id &&
          result.state.applications[0].currentStep === 'survey'
        );
      })()
    );
  }

  /* ------------------------------------------------------ 名称派生 */
  ok('名称优先取申报表名称', deriveApplicationName({ registrationName: '云帆科技', companyNameProposal: '备选名', companyDesc: '描述' }, 0) === '云帆科技');
  ok('其次取诊断给的企业名称', deriveApplicationName({ companyNameProposal: '云帆科技', companyDesc: '描述' }, 0) === '云帆科技');
  ok('再次取截断的企业描述', deriveApplicationName({ companyDesc: '一家主营跨境电商与直播带货的有限责任公司' }, 0) === '一家主营跨境电商与直播带货的有限…');
  ok('都没有则用默认名', deriveApplicationName({}, 2) === '企业设立申请（主体 3）');

  /* ------------------------------------------- 跨标签页的「合并写」 */

  {
    const NOW2 = NOW + 1000;
    const a = { ...createApplication(NOW2, 0, '甲'), id: 'app-a' };
    const b = { ...createApplication(NOW2, 1, '乙'), id: 'app-b' };
    const mineAB: ApplicationsState = { applications: [a, b], activeAppId: 'app-a' };

    // 场景：本标签页（填报页）启动时的快照是 [a]；另一个标签页新增了 b 并切到了 b
    const storedWithB: ApplicationsState = { applications: [a, b], activeAppId: 'app-b' };
    const mineA: ApplicationsState = { applications: [a], activeAppId: 'app-a' };

    const dirtyA = mergeApplicationsWrite(storedWithB, mineA, { dirtyAppIds: ['app-a'], removedAppIds: [], takeActiveAppId: false }, NOW2);
    ok('合并写：别的标签页新增的主体不会被抹掉', dirtyA.state.applications.map((x) => x.id).join(',') === 'app-a,app-b');
    ok('★ 合并写：本标签页保存时**不改**存档里的 activeAppId（另一个标签页切的主体保住了）', dirtyA.state.activeAppId === 'app-b');
    ok('合并写：没改别的标签页那一条（用存档里的版本）', dirtyA.state.applications.find((x) => x.id === 'app-b') === b);

    // 本标签页自己改了 a 的名字：dirty 里的那条以自己的为准
    const renamedA = { ...a, name: '甲改名' };
    const dirtyRename = mergeApplicationsWrite(storedWithB, { applications: [renamedA, b], activeAppId: 'app-a' }, { dirtyAppIds: ['app-a'], removedAppIds: [], takeActiveAppId: false }, NOW2);
    ok('合并写：自己改过的字段以自己的为准', dirtyRename.state.applications.find((x) => x.id === 'app-a')?.name === '甲改名');
    ok('合并写：自己没改过的主体仍用存档里的', dirtyRename.state.applications.find((x) => x.id === 'app-b') === b);

    // 本标签页自己切了主体：这次才动 activeAppId
    const tookActive = mergeApplicationsWrite(storedWithB, mineAB, { dirtyAppIds: [], removedAppIds: [], takeActiveAppId: true }, NOW2);
    ok('合并写：自己切过主体才写 activeAppId', tookActive.state.activeAppId === 'app-a');

    // 本标签页新增（存档里没有）→ 追加
    const c = { ...createApplication(NOW2, 2, '丙'), id: 'app-c' };
    const added = mergeApplicationsWrite({ applications: [a], activeAppId: 'app-a' }, { applications: [a, c], activeAppId: 'app-c' }, { dirtyAppIds: [], removedAppIds: [], takeActiveAppId: true }, NOW2);
    ok('合并写：本标签页新增的主体被追加', added.state.applications.map((x) => x.id).join(',') === 'app-a,app-c');
    ok('合并写：本标签页新增会写 activeAppId（它同时是切主体）', added.state.activeAppId === 'app-c');

    // 作废：removedAppIds 里的删掉；存档里剩下的仍保留
    const removed = mergeApplicationsWrite(storedWithB, { applications: [a], activeAppId: 'app-a' }, { dirtyAppIds: [], removedAppIds: ['app-b'], takeActiveAppId: false }, NOW2);
    ok('合并写：本标签页作废的主体被删掉', removed.state.applications.map((x) => x.id).join(',') === 'app-a');
    ok('合并写：删掉当前主体后落点切到剩下的第一个', removed.state.activeAppId === 'app-a');

    // 全删光 → 补一个空白主体（与 discardApplication 同口径）
    const emptied = mergeApplicationsWrite(storedWithB, { applications: [], activeAppId: '' }, { dirtyAppIds: [], removedAppIds: ['app-a', 'app-b'], takeActiveAppId: false }, NOW2);
    ok('合并写：全删光会补一个空白主体（列表永不为空）', emptied.state.applications.length === 1 && emptied.state.activeAppId === emptied.state.applications[0].id);

    // 没有存档（首次进来）→ 以本标签页那份为准
    const noStored = mergeApplicationsWrite(null, mineAB, { dirtyAppIds: ['app-a'], removedAppIds: [], takeActiveAppId: false }, NOW2);
    ok('合并写：没有存档时以本标签页那份为准', noStored.state.applications.length === 2 && noStored.state.activeAppId === 'app-a');

    // 什么都没变 → changed=false（调用方据此跳过写入，避免无谓的跨标签页覆盖）
    const noop = mergeApplicationsWrite(mineAB, mineAB, { dirtyAppIds: [], removedAppIds: [], takeActiveAppId: false }, NOW2);
    ok('合并写：没有实际变化时 changed=false', noop.changed === false);
    // 名单里标了 dirty、但那份内容和存档里一模一样时，同样算「没变化」（别白写一次）
    ok('合并写：标了 dirty 但内容一样也算没变化', dirtyA.changed === false);
    ok('合并写：确实有变化时 changed=true', dirtyRename.changed === true);
  }

  /* ------------------------------------------------- 旧结构（不再迁移） */
  // 2026-09 去掉「老存档迁移」：单主体时代的全局键不再读、不再搬。有旧键但没有主体列表时，
  // 就是**全新一份申请**（旧存档不参与落点，也不会被顺手删掉）。
  {
    const legacyKeys = {
      [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '旧问卷企业' }, tier: 'standard', addons: [] }),
      [LEGACY_PLAN_REPORT_KEY]: JSON.stringify({ companyNameProposal: '诊断给的名字' }),
      [LEGACY_PLAN_RECORD_KEY]: JSON.stringify({ recordId: 'REC-1' }),
      ['banbu-registration-20260913-v1']: JSON.stringify({ status: 'submitted', basic: { names: ['申报表里的名字'] } }),
    };
    const { storage, map } = fakeStorage(legacyKeys);

    const result = ensureApplicationsState(storage, NOW);
    const app = result?.state.applications[0];
    ok('只剩旧全局键时 → 建全新主体、落第 1 步（不再迁移）', result?.state.applications.length === 1 && app?.currentStep === 'survey' && app.unlockedSteps.join(',') === 'survey');
    ok('旧键里的进度证据不再被采用（isDetailsSubmitted 等一律从头来）', app?.isDetailsSubmitted === false && app.order.status === 'pending');
    ok('旧键不搬（该主体没有 per-app 存档）', !map.has(planFormKey(app!.id)) && !map.has(planRecordKey(app!.id)));
    ok('旧键也不删（留着无害，硬删可能删掉别人正在用的东西）', Object.keys(legacyKeys).every((key) => map.has(key)));
  }

  {
    // 已经有主体列表：直接复用，不新增主体、不动旧键
    const existing: ApplicationsState = { applications: [createApplication(NOW, 0)], activeAppId: '' };
    const { storage, map } = fakeStorage({ [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '残留旧档' }, tier: 'standard', addons: [] }) });
    writeApplicationsState(storage, existing);
    const ensured = ensureApplicationsState(storage, NOW);
    ok('已有主体列表时直接复用（不新增主体）', ensured?.state.applications.length === 1);
    ok('已有主体列表时旧键不动', map.has(LEGACY_PLAN_FORM_KEY));
  }

  /* ------------------------------------------------- 初始化 / activeApp */
  {
    const a = createApplication(NOW, 0);
    const b = createApplication(NOW + 1, 1);
    const { storage, map } = fakeStorage();
    writeApplicationsState(storage, { applications: [a, b], activeAppId: a.id });
    map.set(ACTIVE_APP_KEY, b.id);
    const result = ensureApplicationsState(storage, NOW);
    ok('activeAppId 以存档里的为准（切回上次那个主体）', result?.state.activeAppId === b.id);

    map.set(ACTIVE_APP_KEY, '不存在的主体');
    const result2 = ensureApplicationsState(storage, NOW);
    ok('ACTIVE_APP_KEY 无效时沿用列表里的 activeAppId', result2?.state.activeAppId === b.id);

    ok('setActiveApplication 不认的 id 不生效', setActiveApplication({ applications: [a], activeAppId: a.id }, 'x').activeAppId === a.id);
  }

  /* ------------------------------------------------------ 摘要回填 */
  {
    const a = createApplication(NOW, 0);
    const base: ApplicationsState = { applications: [a], activeAppId: a.id };
    ok('空白主体的摘要：套餐名与金额都是空/0', a.order.tierName === '' && a.order.amount === 0);

    const filled = patchOrderSummary(base, a.id, { tierName: '企业注册服务', amount: 600 }, NOW + 1);
    ok('回填补上套餐名与金额', filled.applications[0].order.tierName === '企业注册服务' && filled.applications[0].order.amount === 600);

    const keepTier = patchOrderSummary(filled, a.id, { tierName: '另一个套餐', amount: 999 }, NOW + 2);
    ok('已有套餐名不被覆盖', keepTier.applications[0].order.tierName === '企业注册服务');
    ok('付过款的金额不被现算报价盖掉', keepTier.applications[0].order.amount === 600);

    const paid: ApplicationsState = {
      applications: [{ ...a, order: { ...a.order, status: 'paid', tierName: '', amount: 2500 } }],
      activeAppId: a.id,
    };
    const paidFilled = patchOrderSummary(paid, a.id, { tierName: '全年无忧服务（小规模）', amount: 600 }, NOW + 3);
    ok('已支付但缺套餐名：补名字、金额保持原样', paidFilled.applications[0].order.tierName === '全年无忧服务（小规模）' && paidFilled.applications[0].order.amount === 2500);

    const noop = patchOrderSummary(filled, a.id, { tierName: '企业注册服务', amount: 600 }, NOW + 4);
    ok('没什么可补时原样返回（App 据此跳过落盘）', noop === filled);
    ok('认不出的主体不动', patchOrderSummary(base, '不存在', { tierName: 'x' }) === base);
  }

  /* ------------------------------------------------------ 付款成功写回摘要 */
  {
    // 用户报的 bug：在支付页付完款，顶栏下拉还是「待支付」+ 留着「作废服务」，
    // 支付成功页新开的填报页深链也被拒 —— 因为「已支付」只落在运行时订单上，没写回主体记录。
    const a = createApplication(NOW, 0);
    const before: ApplicationRecord = {
      ...a,
      name: '甲乙丙科技',
      currentStep: 'payment',
      unlockedSteps: ['survey', 'proposal', 'payment'],
      order: { status: 'pending', orderNo: '', paidAt: '', contactPhone: '', amount: 2500, tierName: '企业注册服务' },
    };
    const paid = applyPaidOrder(before, { orderNo: 'ORD-1', paidAt: '2026-10-01 12:00', contactPhone: '13800000000' }, NOW + 10);

    ok('付款成功把摘要置为已支付', paid.order.status === 'paid');
    ok('付款成功写回单号 / 支付时间 / 手机号', paid.order.orderNo === 'ORD-1' && paid.order.paidAt === '2026-10-01 12:00' && paid.order.contactPhone === '13800000000');
    ok('付款成功解锁服务群', paid.unlockedSteps.includes('group') && paid.unlockedSteps.length === 4);
    ok('付款成功不动已付金额与套餐名', paid.order.amount === 2500 && paid.order.tierName === '企业注册服务');
    ok('付款成功不改当前步（仍在支付页看支付成功界面）', paid.currentStep === 'payment');
    ok('付款成功刷新 updatedAt', paid.updatedAt !== before.updatedAt);
    ok('付款成功不动原记录（纯函数）', before.order.status === 'pending' && before.unlockedSteps.length === 3);

    // 服务端什么都没带回来：保留摘要里原有的，前端不自己编，也不清空
    const bare = applyPaidOrder(before, {}, NOW + 11);
    ok('服务端没给字段时保留摘要原值', bare.order.status === 'paid' && bare.order.orderNo === '' && bare.order.paidAt === '' && bare.order.contactPhone === '');

    // 重复调用（查单与付款两条路都写一次是正常的）：解锁范围不能写重复
    const again = applyPaidOrder(paid, { orderNo: 'ORD-1' }, NOW + 12);
    ok('重复写回不把 group 写重复', again.unlockedSteps.filter((step) => step === 'group').length === 1);
    ok('重复写回不会把已有单号清掉', again.order.orderNo === 'ORD-1' && again.order.contactPhone === '13800000000');

    // 空串是「服务端没给」而不是有效值：不能被空串盖掉已有的单号 / 手机号
    const emptyFields = applyPaidOrder(paid, { orderNo: '', paidAt: '', contactPhone: '' }, NOW + 13);
    ok('空串字段不覆盖已有值', emptyFields.order.orderNo === 'ORD-1' && emptyFields.order.paidAt === '2026-10-01 12:00' && emptyFields.order.contactPhone === '13800000000');
  }

  /* ------------------------------------------- 第 1 步手机号预填（借别的主体的号） */
  {
    // 一个「已经生成过方案」的主体：摘要里有手机号（手机号只在生成方案 / 查单确认支付时写进去）
    const withPhone = (name: string, phone: string, updatedAt: string): ApplicationRecord => ({
      ...createApplication(NOW, 0, name),
      order: { status: 'pending', orderNo: 'ORD-1', paidAt: '', contactPhone: phone, amount: 600, tierName: '企业注册服务' },
      updatedAt,
    });
    const a = withPhone('甲科技', '13800000000', '2026-10-01T00:00:00.000Z');
    const b = withPhone('乙科技', '13911112222', '2026-10-05T00:00:00.000Z');
    const fresh = createApplication(NOW, 2, '丙科技');
    const state: ApplicationsState = { applications: [a, b, fresh], activeAppId: fresh.id };

    ok('本主体自己没号 → 借别的主体的号', suggestedContactPhone(state, fresh.id, '') === '13911112222');
    ok(
      '★ 多个候选时取最近更新的那个（最近用过的号最可能是同一个人的号）',
      suggestedContactPhone(state, fresh.id, '') === b.order.contactPhone
    );
    ok(
      '本主体自己已经有号 → 用自己的（不借别人的）',
      suggestedContactPhone(state, fresh.id, '13700000000') === '13700000000'
    );
    ok(
      '两端的空格都算掉（自己的号只写空格也算没号，照样借）',
      suggestedContactPhone(state, fresh.id, '   ') === '13911112222'
    );
    ok(
      '不会拿**自己**的号当「别人的号」（自己那条被排除）',
      suggestedContactPhone({ applications: [a, b], activeAppId: b.id }, b.id, '') === '13800000000'
    );
    ok(
      '谁都没号 → 空串（不编、不回落默认）',
      suggestedContactPhone({ applications: [fresh], activeAppId: fresh.id }, fresh.id, '') === ''
    );

    // 真的走一遍「新增一个空白主体 → 它的问卷预填」：新增后自己没号，借老主体的号
    const added = addApplication(state);
    const addedId = added.ok ? added.state.activeAppId : '';
    ok(
      '新增主体（空白）之后，它的手机号预填就是老主体用过的号',
      added.ok === true && addedId !== '' && suggestedContactPhone(added.state, addedId, '') === '13911112222'
    );
  }

  /* ------------------------------------------------------ 更新主体 */
  {
    const a = createApplication(NOW, 0);
    const state: ApplicationsState = { applications: [a], activeAppId: a.id };
    const updated = updateApplication(state, a.id, (app) => ({ ...app, currentStep: 'proposal', unlockedSteps: ['survey', 'proposal'] }), NOW + 5);
    ok('updateApplication 改字段并刷新 updatedAt', updated.applications[0].currentStep === 'proposal' && updated.applications[0].updatedAt !== a.updatedAt);
    ok('updateApplication 不动别的字段', updated.applications[0].id === a.id && updated.activeAppId === a.id);

    const { storage: empty } = fakeStorage();
    ok('没写过时读不到主体列表', readApplicationsState(empty, NOW) === null);
    const { storage: writable } = fakeStorage();
    writeApplicationsState(writable, state);
    const back = readApplicationsState(writable, NOW);
    ok('列表写进去再读回来一致', back?.applications[0].id === a.id && back.activeAppId === a.id);
  }
}

main();

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
