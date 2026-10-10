/**
 * 「分享人 uuid」透传链路自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-share-user-uuid.ts
 *
 * 分两层：
 *   1. **纯逻辑**（可直接 import）：`utils/shareUserUuid.ts` 的读与拼 —— 没有 / 空白 / 畸形
 *      查询串要老老实实返回「没有分享人」（调用方据此不发请求、显示通用客服码）；
 *      拼的时候转义不能漏（分享人里出现 `&` 会把地址拼坏）。
 *   2. **接线**（源码级断言）：分享人有**两个用途、两个真源**，每个接口点都必须接对 ——
 *      接错一个就是「客户扫到别人的客服码」这种要人工收拾的错：
 *        · 归属（建单那一次）：URL → `generatePlanReport` 的 `phoneNumber.shareUserUuid`
 *          → **存进这一单的 `plan_record.shareUserUuid`**；改方案沿用原值，不许改口；
 *        · 客服码：读 `plan_record.shareUserUuid`（props 下发到两处 copreg 弹窗），
 *          **不许读地址栏** —— 客户中途点开别人的分享链接时地址栏会变，那不代表这单换了人；
 *          落地页（TrustModal）没有单，才用 URL 上那份。
 *      用源码级断言而不是 import 的原因：这几个模块（App / 组件 / planDraft / planGenerate）
 *      要么是 JSX、要么 import 了读 `import.meta.env` 的 config/api.ts，tsx 下起不来
 *      （见 AGENTS.md 的三层自检）。真正的行为验证在 `.mcp-work/verify-wecom-qr.mjs`
 *      （记录优先 / 记录空则兜底 / 真实按钮开新标签页）与 `verify-diagnose-report.mjs`（建单落库）。
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  SHARE_USER_UUID_PARAM,
  appendShareUserUuid,
  readShareUserUuid,
} from '../src/utils/shareUserUuid';

let passed = 0;
let failed = 0;

function ok(label: string, condition: boolean, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.error(`✗ ${label}${extra ? ` —— ${extra}` : ''}`);
  }
}

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

/* ------------------------------------------------ 一、读：什么时候算「有分享人」 */

{
  ok('参数名与后端/落地页口径一致', SHARE_USER_UUID_PARAM === 'shareUserUuid');
  ok('带 ? 的查询串读得出分享人', readShareUserUuid('?shareUserUuid=abc-123') === 'abc-123');
  ok('不带 ? 也认（内部拼查询串时是这个形状）', readShareUserUuid('shareUserUuid=abc-123') === 'abc-123');
  ok('和一串别的参数混在一起也读得出', readShareUserUuid('?open=fill-details&shareUserUuid=U1&x=2') === 'U1');
  ok('前后空白去掉（复制粘贴带进来的）', readShareUserUuid('?shareUserUuid=%20U1%20') === 'U1');
  ok('值里的转义还原', readShareUserUuid('?shareUserUuid=a%26b') === 'a&b');

  ok('没传 / 空串 → null', readShareUserUuid('') === null && readShareUserUuid('?') === null && readShareUserUuid(undefined) === null && readShareUserUuid(null) === null);
  ok('只有空白 → null（当没有分享人）', readShareUserUuid('?shareUserUuid=%20%20') === null);
  ok('空值 → null', readShareUserUuid('?shareUserUuid=') === null);
  ok('别的参数不算分享人', readShareUserUuid('?shareUserUUID=U1') === null && readShareUserUuid('?share_user_uuid=U1') === null);
  ok('畸形百分号编码不抛异常（当没有）', readShareUserUuid('?shareUserUuid=%E0%A4%A') !== undefined);
}

/* ------------------------------------------------ 二、拼：没有分享人时原样返回 */

{
  ok('没有分享人 → 原样返回（调用方不必判空）', appendShareUserUuid('https://x/p', null) === 'https://x/p' && appendShareUserUuid('https://x/p', '') === 'https://x/p' && appendShareUserUuid('https://x/p', '   ') === 'https://x/p');
  ok('没有查询串时用 ? 接上', appendShareUserUuid('https://x/p', 'U1') === 'https://x/p?shareUserUuid=U1');
  ok('已有查询串时用 & 接上', appendShareUserUuid('https://x/p?open=fill-details', 'U1') === 'https://x/p?open=fill-details&shareUserUuid=U1');
  ok('值做 URL 转义', appendShareUserUuid('https://x/p', 'a&b=c') === 'https://x/p?shareUserUuid=a%26b%3Dc');
  ok('分享人前后空白去掉后再拼', appendShareUserUuid('https://x/p', '  U1  ') === 'https://x/p?shareUserUuid=U1');
  // 拼出去的东西必须能原样读回来（两边不能各写各的口径）
  ok('★ 拼与读往返一致', readShareUserUuid(appendShareUserUuid('https://x/p', 'a&b=c').replace('https://x/p', '')) === 'a&b=c');
}

/* ------------------------------------------------ 三、接线：两个用途、两个真源 */

{
  const appSource = read('src/copreg/App.tsx');
  const genSource = read('src/copreg/planGenerate.ts');
  const draftSource = read('src/copreg/planDraft.ts');
  const paySource = read('src/copreg/components/AgreementAndPaymentStep.tsx');
  const fillSource = read('src/copreg/components/RegistrationDetailsStep.tsx');
  const qrSource = read('src/hooks/useCustomerServiceQr.ts');
  const trustSource = read('src/components/TrustModal.tsx');
  const hookSource = read('src/hooks/useShareUserUuid.ts');

  /* ---- ① 归属：建单那一次上报，并把分享人存进这一单 ---- */

  ok('App 读了链接上的分享人（useShareUserUuid）', /const shareUserUuid = useShareUserUuid\(\);/.test(appSource));
  ok('★ App 生成方案时把分享人交给 generatePlanReport', /generatePlanReport\(survey,\s*verification,\s*shareUserUuid\)/.test(appSource));
  ok('★ 建单成功时把分享人写进委托单凭据（plan_record）', /const record: PlanRecord = \{ recordId, shareUserUuid: attributedShareUserUuid \};/.test(appSource));
  ok('★ 建单那条路传的是这条链接的分享人（空串兜底）', /null,\s*verification\.mobile,\s*shareUserUuid \?\? ''/.test(appSource));
  ok('★ 改方案沿用这一单原来的分享人（不改成地址栏上那个）', /modifyProposal\(survey, recordId, onCaptchaPassed\),\s*recordId,\s*order\.contactPhone,\s*planRecord\?\.shareUserUuid \?\? ''/.test(appSource));

  ok('★ planGenerate 把分享人放进 phoneNumber 信封', /phoneNumber:\s*\{\s*\.\.\.phoneNumber,\s*shareUserUuid:\s*shareUserUuid \?\? ''\s*\}/.test(genSource));
  ok('信封类型里 shareUserUuid 是**必给**字段（空串而不是省略）', /phoneNumber:\s*PhoneVerification\s*&\s*\{[\s\S]*?shareUserUuid:\s*string;/.test(genSource));
  // 只看接口体（PlanModifyRequest 头上那段注释里是**说明为什么不带**，别把注释当字段）
  const modifyStart = genSource.indexOf('export interface PlanModifyRequest');
  const modifyBody = modifyStart === -1 ? '' : genSource.slice(modifyStart, genSource.indexOf('}', modifyStart));
  ok('改方案（modify）不带分享人 —— 归属在建单那一次就定了', modifyBody !== '' && !modifyBody.includes('shareUserUuid'));

  ok('委托单凭据里有 shareUserUuid 字段', /interface PlanRecord \{[\s\S]*?shareUserUuid: string;/.test(draftSource));
  ok('★ 读回老存档时收口：缺失/非字符串/空白都收成空串（不猜、不回落到地址栏）', /recordId === '' \? null : \{ recordId, shareUserUuid: textOf\(raw\.shareUserUuid\)\.trim\(\) \}/.test(draftSource));

  /* ---- ② 客服码：认这一单，不认地址栏 ---- */

  const qrReadsUrl = /useShareUserUuid/.test(qrSource);
  ok('★ 客服码 hook **不读地址栏**（分享人由调用方传进来）', qrReadsUrl === false);
  ok('客服码 hook 用传进来的分享人查（perShareQrEndpoint 的第二个参数就是它）', /perShareQrEndpoint\(DOC_HOST, shareUserUuid\)/.test(qrSource) && /shareUserUuid: string \| null \| undefined/.test(qrSource));

  ok('★ 第 3 步弹窗查的是这一单的分享人（props 下发）', /useCustomerServiceQr\(showWecomModal, shareUserUuid\)/.test(paySource));
  ok('★ 第 5 步弹窗查的是这一单的分享人（props 下发）', /useCustomerServiceQr\(showWecomModal, shareUserUuid\)/.test(fillSource));
  ok('★ App 把 plan_record 的分享人下发给这两步', (appSource.match(/shareUserUuid=\{planRecord\?\.shareUserUuid \?\? ''\}/g) ?? []).length === 2);
  ok('落地页没有单 → 仍用这次进站链接上的分享人', /useCustomerServiceQr\(isSuccess, shareUserUuid\)/.test(trustSource) && /useShareUserUuid\(\)/.test(trustSource));

  /* ---- ③ 链接上下文：进新标签页不丢，供以后再建单上报 ---- */

  ok('★ 支付成功页开填报页时把链接上的分享人带进深链', /fillDetailsOpenUrl\(window\.location\.origin, window\.location\.pathname, shareUserUuid\)/.test(paySource));
  ok('★ App 抹深链意图参数时用的是「只抹 open」那个函数（不是 pathname + hash 直接拼）', /searchAfterOpenIntentUsed\(window\.location\.search\)/.test(appSource) && !/replaceState\(null, '', `\$\{window\.location\.pathname\}\$\{window\.location\.hash\}`\)/.test(appSource));

  ok('hook 走纯逻辑读（参数名只留一份）', /readShareUserUuid\(/.test(hookSource));
  const hookDup = /new URLSearchParams\(window\.location\.search\)/.test(hookSource);
  ok('hook 里不再自己写一份 URLSearchParams 读法', hookDup === false);
}

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
