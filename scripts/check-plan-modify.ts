/**
 * 「已建单后改问卷走 modify-proposal」的**请求契约**自检：不联网、不碰 React、不开浏览器。
 *   npx tsx scripts/check-plan-modify.ts
 *
 * 为什么用源码级断言（而不是直接 import `planGenerate.ts`）：那个模块 import 了
 * `src/config/api.ts`，而后者读 `import.meta.env` —— tsx 下跑不起来（见 AGENTS.md 的三层自检约定）。
 * 真正的**行为**验证在 `.mcp-work/verify-modify-proposal.mjs`（无头 Chrome 打真链路、看真实请求）；
 * 这里盯的是「契约有没有被写歪」，改一个字就会红：
 *
 *   1. 路径常量 `PLAN_MODIFY_PATH` 存在、默认值就是 `/api/company-plan/modify-proposal`，
 *      且能用 `VITE_PLAN_MODIFY_PATH` 覆盖；
 *   2. `modifyProposal` 的 body **只有** `recordId` + `formData` 两个字段，**没有 `phoneNumber`**
 *      —— 手机号是建单那一次验过的，这一步不再验短信；
 *   3. body 里的 recordId 是**必填**的（trim 后为空要直接抛，不能把空单号发出去）；
 *   4. 腾讯行为验证码四件套（captchaAppId / userIp / jcaptchaCode / jcaptchaId）拼在 **query** 上
 *      —— 这正是「只需要腾讯行为验证参数」那一条；漏拼任何一个，服务端就会拒；
 *   5. 走的是 `showTencentCaptcha`（与 AI 智能填充同一套弹窗），且弹窗在 `postJson` **之外**
 *      （用户取消不该被算成网络故障、也不该吃 5 分钟超时）；
 *   6. 响应里没给 recordId 时**沿用传进来那个**（改方案不是建单，本地凭据仍然有效）。
 */
import fs from 'node:fs';
import path from 'node:path';

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

const apiSource = read('src/config/api.ts');
const genSource = read('src/copreg/planGenerate.ts');
const appSource = read('src/copreg/App.tsx');
const surveySource = read('src/copreg/components/SurveyStep.tsx');

/* ------------------------------------------------- 1. 路径常量 */

ok(
  'PLAN_MODIFY_PATH 默认值 = /api/company-plan/modify-proposal',
  /export const PLAN_MODIFY_PATH\s*=\s*\n?\s*import\.meta\.env\.VITE_PLAN_MODIFY_PATH\s*\|\|\s*'\/api\/company-plan\/modify-proposal'/.test(apiSource)
);
ok('PLAN_MODIFY_PATH 可用 VITE_PLAN_MODIFY_PATH 覆盖', apiSource.includes('VITE_PLAN_MODIFY_PATH'));

/* ------------------------------------------------- 2. 请求体只有 recordId + formData */

/** 取出 `export const modifyProposal ... };` 这一段源码（到下一个顶层 export 或文件尾） */
const modifyBody = (() => {
  const start = genSource.indexOf('export const modifyProposal');
  if (start === -1) return '';
  const rest = genSource.slice(start);
  const nextExport = rest.indexOf('\nexport ', 1);
  return nextExport === -1 ? rest : rest.slice(0, nextExport);
})();

ok('找得到 modifyProposal 实现', modifyBody !== '');
ok(
  '请求体带 recordId 与 formData',
  /const body:\s*PlanModifyRequest\s*=\s*\{\s*recordId:[\s\S]*?formData:/.test(modifyBody)
);
ok(
  '请求体里**没有** phoneNumber（不再验短信）',
  !/phoneNumber/.test(modifyBody),
  'modifyProposal 里出现了 phoneNumber'
);
ok(
  'recordId 是必填：App 侧单号为空就直接抛，不发请求',
  /if \(recordId === ''\) throw new Error/.test(appSource)
);
ok(
  'PlanModifyRequest 类型里 recordId 标了必填',
  /interface PlanModifyRequest[\s\S]*?调查问卷记录 ID[\s\S]*?必填[\s\S]*?recordId: string;/.test(genSource)
);

/* ------------------------------------------------- 3. 验证码四件套在 query 上 */

/** 取出 URLSearchParams 那一段，逐个确认四个参数都真的写进去了 */
const paramsBlock = (() => {
  const start = genSource.indexOf('new URLSearchParams({');
  if (start === -1) return '';
  const end = genSource.indexOf('});', start);
  return end === -1 ? '' : genSource.slice(start, end);
})();
ok(
  '腾讯四件套拼在 query（captchaAppId / userIp / jcaptchaCode / jcaptchaId）',
  ['captchaAppId', 'userIp', 'jcaptchaCode', 'jcaptchaId'].every((name) => paramsBlock.includes(name)) &&
    paramsBlock.includes('TENCENT_CAPTCHA_APP_ID') && paramsBlock.includes('TENCENT_CAPTCHA_USER_IP')
);
ok(
  'ticket / randstr 真正进了 query（不是只声明了参数）',
  /jcaptchaCode:\s*ticket/.test(genSource) && /jcaptchaId:\s*randstr/.test(genSource)
);
ok(
  'query 用 URLSearchParams 拼（不用 new URL，避免相对 host 抛原生 TypeError）',
  /new URLSearchParams\(\{[\s\S]*?captchaAppId/.test(genSource)
);
ok(
  'url 拼接函数把参数接在路径后面',
  /\$\{joinUrl\(COMPANY_PLAN_HOST, PLAN_MODIFY_PATH\)\}\?\$\{params\.toString\(\)\}/.test(genSource)
);

/* ------------------------------------------------- 4. 验证码弹窗在请求之外 */

ok('走的是 showTencentCaptcha（与 AI 智能填充同一套）', modifyBody.includes('showTencentCaptcha(TENCENT_CAPTCHA_APP_ID)'));
ok(
  '弹窗在 postJson 之前（不在 postJson 参数里）',
  modifyBody.indexOf('showTencentCaptcha') < modifyBody.indexOf('await postJson(')
);
ok(
  '取消验证码有专门的处理（SurveyStep 静默吞 CaptchaCancelledError）',
  /CaptchaCancelledError/.test(surveySource)
);

/* ------------------------------------------------- 5. 弹框顺序：先验证码、后生成弹框 */

ok(
  'modifyProposal 提供 onCaptchaPassed 回调（验证码通过后触发）',
  modifyBody.includes('onCaptchaPassed?: () => void') && modifyBody.includes('onCaptchaPassed?.()')
);
const captchaIndex = modifyBody.indexOf('showTencentCaptcha');
const callbackIndex = modifyBody.indexOf('onCaptchaPassed?.()');
ok(
  '回调在验证码之后、请求之前（顺序不能反）',
  captchaIndex !== -1 && callbackIndex > captchaIndex && callbackIndex < modifyBody.indexOf('await postJson('),
  `captcha=${captchaIndex} callback=${callbackIndex} postJson=${modifyBody.indexOf('await postJson(')}`
);
ok(
  'App 把回调一路透给 modifyProposal',
  /modifyProposal\(survey, recordId, onCaptchaPassed\)/.test(appSource)
);
ok(
  '「AI 推演中」生成弹框只在回调里打开（不再一点按钮就盖上验证码）',
  /await onModify\(\(\) => setIsGeneratingPlan\(true\)\)/.test(surveySource) &&
    !/handleModify = async \(\) => \{\s*setIsSubmitting\(true\);\s*setIsGeneratingPlan\(true\)/.test(surveySource)
);

/* ------------------------------------------------- 6. 单号兜底 + 两条路的分岔 */

ok(
  '响应没给 recordId 时沿用传进来那个',
  /optionalStringOf\(payload\.recordId\)\s*\?\?\s*body\.recordId/.test(modifyBody)
);
ok(
  '改方案时**不作废**单号存档（只有第一次生成方案才清）',
  /fallbackRecordId === null\) clearPlanRecordFor\(appId\)/.test(appSource)
);
ok(
  '分岔判据是「本地有没有委托单号」（SurveyStep 按 modifyRecordId 分流）',
  /modifyRecordId !== ''/.test(surveySource) && /onModify=\{handleSurveyModify\}/.test(appSource)
);

/* ------------------------------------------------- 7. 超时没被顺手改短 */

const argCounts = (() => {
  const counts: number[] = [];
  const needle = 'postJson(';
  let from = 0;
  for (;;) {
    const start = genSource.indexOf(needle, from);
    if (start === -1) break;
    let depth = 0;
    let commas = 0;
    let i = start + needle.length - 1;
    for (; i < genSource.length; i += 1) {
      const ch = genSource[i];
      if (ch === '(' || ch === '[' || ch === '{') depth += 1;
      else if (ch === ')' || ch === ']' || ch === '}') {
        depth -= 1;
        if (depth === 0) break;
      } else if (ch === ',' && depth === 1) commas += 1;
    }
    counts.push(commas + 1);
    from = i + 1;
  }
  return counts;
})();
ok('planGenerate 里每个 postJson 都吃默认超时（3 个参数，不自己写死）', argCounts.length === 2 && argCounts.every((n) => n === 3), JSON.stringify(argCounts));

console.log(`\n${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exit(1);
