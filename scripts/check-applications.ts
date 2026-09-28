/**
 * 多主体申请的模型、规则与迁移自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-applications.ts
 *
 * 覆盖：
 *   1. **键空间**：每主体一套键（表单/诊断/单号/申报表），与旧的全局键不重名；
 *   2. **列表收口**：坏项丢掉、重复 id 只留第一个、超过 5 个只认前 5、activeAppId 认不出落第一个；
 *   3. **业务规则**：最多 5 个主体、已支付不可作废、作废当前主体后自动切走、最后一个作废后补空白主体、改名；
 *   4. **老存档迁移**：三份全局键 + 全局申报表 → 主体 #1（逐键搬运、落点按旧证据、旧键清掉），
 *      幂等、写失败不删旧键、已有主体列表时不再迁移；
 *   5. **初始化**：什么都没有时建空白主体；activeAppId 以存档里的为准。
 */
import {
  ACTIVE_APP_KEY,
  APPLICATIONS_KEY,
  LEGACY_PLAN_FORM_KEY,
  LEGACY_PLAN_RECORD_KEY,
  LEGACY_PLAN_REPORT_KEY,
  LEGACY_REGISTRATION_KEY,
  MAX_APPLICATIONS,
  addApplication,
  applyLegacyMigration,
  canAddApplication,
  createApplication,
  deriveApplicationName,
  discardApplication,
  ensureApplicationsState,
  parseApplicationsState,
  patchOrderSummary,
  planFormKey,
  planRecordKey,
  planReportKey,
  planLegacyMigration,
  readApplicationsState,
  registrationKey,
  renameApplication,
  setActiveApplication,
  updateApplication,
  writeApplicationsState,
  type ApplicationsState,
  type StorageLike,
} from '../src/copreg/applications';

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

  /* ---------------------------------------------------------- 迁移 */
  {
    const legacyForm = JSON.stringify({ survey: { companyDesc: '旧问卷企业' }, tier: 'standard', addons: [] });
    const legacyReport = JSON.stringify({ companyNameProposal: '诊断给的名字' });
    const legacyRecord = JSON.stringify({ recordId: 'REC-1' });
    const legacyRegistration = JSON.stringify({ status: 'submitted', basic: { names: ['申报表里的名字'] } });
    const { storage, map } = fakeStorage({
      [LEGACY_PLAN_FORM_KEY]: legacyForm,
      [LEGACY_PLAN_REPORT_KEY]: legacyReport,
      [LEGACY_PLAN_RECORD_KEY]: legacyRecord,
      [LEGACY_REGISTRATION_KEY]: legacyRegistration,
    });

    const result = ensureApplicationsState(storage, NOW);
    const app = result?.state.applications[0];
    ok('迁移建出主体 #1（标记 migrated）', result?.migrated === true && result.state.applications.length === 1);
    ok('迁移主体落在第 3 步（有单号 + 已提交）', app?.currentStep === 'payment' && app.isDetailsSubmitted === true && app.unlockedSteps.includes('progress'));
    ok('迁移主体的名字取申报表名称', app?.name === '申报表里的名字');
    ok('旧键逐份搬到该主体的键上（内容一字不改）', map.get(planFormKey(app!.id)) === legacyForm && map.get(planReportKey(app!.id)) === legacyReport && map.get(planRecordKey(app!.id)) === legacyRecord && map.get(registrationKey(app!.id)) === legacyRegistration);
    ok('主体列表与 activeAppId 已写', map.has(APPLICATIONS_KEY) && map.get(ACTIVE_APP_KEY) === app!.id);
    ok('旧键全部清掉', ![LEGACY_PLAN_FORM_KEY, LEGACY_PLAN_REPORT_KEY, LEGACY_PLAN_RECORD_KEY, LEGACY_REGISTRATION_KEY].some((key) => map.has(key)));

    const again = ensureApplicationsState(storage, NOW + 1000);
    ok('再跑一次不会重复迁移', again?.migrated === false && again.state.applications.length === 1);
  }

  {
    const { storage, map } = fakeStorage({ [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '只填了问卷' }, tier: 'bundle_small', addons: [] }) });
    const result = ensureApplicationsState(storage, NOW);
    const app = result?.state.applications[0];
    ok('只有问卷存档 → 落第 1 步', result?.migrated === true && app?.currentStep === 'survey' && app.unlockedSteps.join(',') === 'survey');
    ok('只有问卷时旧键照样清掉', !map.has(LEGACY_PLAN_FORM_KEY));
  }

  {
    // 只有诊断结果、没有问卷：与旧 loadPlanDraft 同口径 —— 问卷没填过就没有方案，落第 1 步
    const { storage, map } = fakeStorage({ [LEGACY_PLAN_REPORT_KEY]: JSON.stringify({ companyNameProposal: '只有诊断' }) });
    const result = ensureApplicationsState(storage, NOW);
    const app = result?.state.applications[0];
    ok('只有诊断结果（没问卷）→ 仍迁移但落第 1 步', result?.migrated === true && app?.currentStep === 'survey' && app.unlockedSteps.join(',') === 'survey');
    ok('只有诊断结果时原始值照样搬过去（不丢数据）', map.get(planReportKey(app!.id)) === JSON.stringify({ companyNameProposal: '只有诊断' }));
  }

  {
    // 问卷 + 诊断、没有单号 → 第 2 步
    const { storage } = fakeStorage({
      [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '旧问卷' }, tier: 'standard', addons: [] }),
      [LEGACY_PLAN_REPORT_KEY]: JSON.stringify({ companyType: '有限责任公司' }),
    });
    const result = ensureApplicationsState(storage, NOW);
    ok('问卷 + 诊断（无单号）→ 落第 2 步', result?.state.applications[0].currentStep === 'proposal' && result.state.applications[0].unlockedSteps.join(',') === 'survey,proposal');
  }

  {
    // 有问卷与诊断，但单号是空白串 → 单号不算（与 parsePlanRecord 同口径）
    const { storage } = fakeStorage({
      [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '旧问卷' }, tier: 'standard', addons: [] }),
      [LEGACY_PLAN_REPORT_KEY]: JSON.stringify({ companyType: '有限责任公司' }),
      [LEGACY_PLAN_RECORD_KEY]: JSON.stringify({ recordId: '   ' }),
    });
    const result = ensureApplicationsState(storage, NOW);
    ok('坏单号（空白串）不算证据 → 落第 2 步', result?.state.applications[0].currentStep === 'proposal');
  }

  {
    const { storage, map } = fakeStorage();
    const result = ensureApplicationsState(storage, NOW);
    ok('什么存档都没有 → 建一个空白主体落第 1 步', result?.migrated === false && result.state.applications.length === 1 && result.state.applications[0].currentStep === 'survey');
    ok('空白主体也写进存档', map.has(APPLICATIONS_KEY));
  }

  {
    // 写失败（配额满）：整体放弃，旧键一个都不能删
    const { storage, map, failOn } = fakeStorage({
      [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '旧问卷' }, tier: 'standard', addons: [] }),
      [LEGACY_PLAN_REPORT_KEY]: JSON.stringify({ companyNameProposal: '旧诊断' }),
    });
    const plan = planLegacyMigration(storage, NOW);
    // 让「诊断结果」那一条写入失败（其余键都成功），验证不会写一半就把旧键删了
    failOn(plan.writes.map((write) => write.key).filter((key) => key.includes(':plan_report')));
    ok('迁移写失败时返回 false', applyLegacyMigration(storage, plan) === false);
    ok('写失败后旧键原样保留', map.has(LEGACY_PLAN_FORM_KEY) && map.has(LEGACY_PLAN_REPORT_KEY));
    ok('写失败后不写主体列表', !map.has(APPLICATIONS_KEY));
  }

  {
    // 已经有主体列表：不再迁移，旧键不动（万一还有残留）
    const existing: ApplicationsState = { applications: [createApplication(NOW, 0)], activeAppId: '' };
    const { storage, map } = fakeStorage({ [LEGACY_PLAN_FORM_KEY]: JSON.stringify({ survey: { companyDesc: '残留旧档' }, tier: 'standard', addons: [] }) });
    writeApplicationsState(storage, existing);
    const plan = planLegacyMigration(storage, NOW);
    ok('已有主体列表时迁移计划为空', plan.state === null && plan.writes.length === 0 && plan.removals.length === 0);
    ok('已有主体列表时旧键不动', map.has(LEGACY_PLAN_FORM_KEY));
    const ensured = ensureApplicationsState(storage, NOW);
    ok('已有主体列表时直接复用（不新增主体）', ensured?.migrated === false && ensured.state.applications.length === 1);
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
